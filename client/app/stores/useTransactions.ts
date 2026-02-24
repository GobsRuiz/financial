import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { Transaction, Recurrent } from '~/schemas/zod-schemas'
import { apiGet, apiPost, apiPatch } from '~/utils/api'
import { addMonths, monthKey, nowISO } from '~/utils/dates'
import { useAccountsStore } from './useAccounts'

export const useTransactionsStore = defineStore('transactions', () => {
  const transactions = ref<Transaction[]>([])

  async function loadTransactions(filters?: Record<string, string>) {
    transactions.value = await apiGet<Transaction[]>('/transactions', filters)
  }

  /** Transações não pagas de um mês específico (YYYY-MM) */
  function unpaidForMonth(month: string): Transaction[] {
    return transactions.value.filter(t => !t.paid && monthKey(t.date) === month)
  }

  /** Verifica se já existe transação criada a partir de um recorrente num mês */
  function hasRecurrentTransaction(recurrentId: string, month: string): boolean {
    return transactions.value.some(
      t => t.recurrentId === recurrentId && monthKey(t.date) === month,
    )
  }

  /** Paga um recorrente: cria transaction do mês + marca pago + ajusta saldo */
  async function payRecurrent(rec: Recurrent, month: string) {
    const date = rec.day_of_month
      ? `${month}-${String(rec.day_of_month).padStart(2, '0')}`
      : `${month}-01`

    const tx = await addTransaction({
      accountId: rec.accountId,
      date,
      type: rec.kind === 'expense' ? 'expense' : 'income',
      category: rec.name,
      amount_cents: rec.amount_cents,
      description: rec.description || undefined,
      paid: true,
      installment: null,
      recurrentId: rec.id,
    })

    const accountsStore = useAccountsStore()
    await accountsStore.adjustBalance(rec.accountId, rec.amount_cents, rec.name)

    return tx
  }

  async function addTransaction(tx: Omit<Transaction, 'id'>) {
    const created = await apiPost<Transaction>('/transactions', {
      ...tx,
      id: uuid(),
    })
    transactions.value.push(created)
    return created
  }

  /**
   * Gera N parcelas a partir dos dados base.
   * Retorna array das transactions criadas.
   */
  async function generateInstallments(base: {
    accountId: number
    date: string
    type: Transaction['type']
    category: string
    amount_cents: number
    description?: string
    tags?: string[]
    paid?: boolean
    product: string
    totalInstallments: number
  }) {
    const parentId = uuid()
    const created: Transaction[] = []

    for (let i = 1; i <= base.totalInstallments; i++) {
      const installmentDate = i === 1 ? base.date : addMonths(base.date, i - 1)
      const tx = await apiPost<Transaction>('/transactions', {
        id: uuid(),
        accountId: base.accountId,
        date: installmentDate,
        type: base.type,
        category: base.category,
        amount_cents: base.amount_cents,
        description: base.description,
        tags: base.tags,
        paid: i === 1 ? (base.paid ?? false) : false,
        installment: {
          parentId,
          total: base.totalInstallments,
          index: i,
          product: base.product,
        },
      })
      created.push(tx)
      transactions.value.push(tx)
    }

    // Se a primeira parcela já está paga, ajustar saldo
    if (base.paid && created[0]) {
      const accountsStore = useAccountsStore()
      await accountsStore.adjustBalance(
        base.accountId,
        base.amount_cents,
        `Parcela 1/${base.totalInstallments} - ${base.product}`,
      )
    }

    return created
  }

  async function markPaid(txId: string) {
    const tx = transactions.value.find(t => t.id === txId)
    if (!tx || tx.paid) return

    await apiPatch(`/transactions/${txId}`, { paid: true })
    tx.paid = true

    const accountsStore = useAccountsStore()
    const note = tx.installment
      ? `Parcela ${tx.installment.index}/${tx.installment.total} - ${tx.installment.product}`
      : tx.description || tx.category

    await accountsStore.adjustBalance(tx.accountId, tx.amount_cents, note)
  }

  return { transactions, loadTransactions, addTransaction, generateInstallments, markPaid, unpaidForMonth, hasRecurrentTransaction, payRecurrent }
})
