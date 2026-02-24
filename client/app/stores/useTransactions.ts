import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { Transaction } from '~/schemas/zod-schemas'
import { apiGet, apiPost, apiPatch } from '~/utils/api'
import { addMonths } from '~/utils/dates'
import { useAccountsStore } from './useAccounts'

export const useTransactionsStore = defineStore('transactions', () => {
  const transactions = ref<Transaction[]>([])

  async function loadTransactions(filters?: Record<string, string>) {
    transactions.value = await apiGet<Transaction[]>('/transactions', filters)
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

  return { transactions, loadTransactions, addTransaction, generateInstallments, markPaid }
})
