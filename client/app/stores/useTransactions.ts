import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { Transaction, Recurrent } from '~/schemas/zod-schemas'
import { apiGet, apiPost, apiPatch, apiDelete } from '~/utils/api'
import { addMonths, monthKey, nowISO } from '~/utils/dates'
import { computeCreditInvoiceDueDate } from '~/utils/invoice-cycle'
import { useAccountsStore } from './useAccounts'

export const useTransactionsStore = defineStore('transactions', () => {
  const transactions = ref<Transaction[]>([])

  function resolveRecurringDate(month: string, referenceDay?: number): string {
    const match = /^(\d{4})-(\d{2})$/.exec(month)
    if (!match) return `${month}-01`

    const year = Number(match[1])
    const monthNumber = Number(match[2])
    const defaultDate = `${match[1]}-${match[2]}-01`

    if (!referenceDay || !Number.isFinite(referenceDay)) return defaultDate

    const daysInMonth = new Date(year, monthNumber, 0).getDate()
    const day = Math.min(Math.max(Math.trunc(referenceDay), 1), daysInMonth)

    return `${match[1]}-${match[2]}-${String(day).padStart(2, '0')}`
  }

  async function loadTransactions(filters?: Record<string, string>) {
    transactions.value = await apiGet<Transaction[]>('/transactions', filters)
  }

  /** Deriva o campo `paid` automaticamente com base no tipo e método */
  function derivePaid(type: Transaction['type'], method?: 'debit' | 'credit'): boolean {
    if (type === 'income') return true
    if (type === 'transfer') return method !== 'credit'
    return method === 'debit'
  }

  /** Transações não pagas de um mês específico (YYYY-MM) */
  function unpaidForMonth(month: string): Transaction[] {
    return transactions.value.filter(t => !t.paid && monthKey(t.date) === month)
  }

  /** Verifica se já existe transação criada a partir de um recorrente num mês */
  function hasRecurrentTransaction(recurrentId: string, month: string): boolean {
    return transactions.value.some((t) => {
      if (t.recurrentId !== recurrentId) return false
      if (monthKey(t.date) === month) return true
      // Fallback para registros legados com data invalida (ex.: 2026-02-30).
      return typeof t.date === 'string' && t.date.slice(0, 7) === month
    })
  }

  /**
   * Agrupa transações de crédito por conta no mês.
   * status:
   * - all: inclui pagas e pendentes
   * - open: somente pendentes
   * - paid: somente pagas
   */
  function creditInvoicesByAccount(month: string, status: 'all' | 'open' | 'paid' = 'all') {
    const accountsStore = useAccountsStore()
    const accountById = new Map(accountsStore.accounts.map(acc => [acc.id, acc]))

    const grouped = new Map<number, Transaction[]>()
    for (const tx of transactions.value) {
      if (tx.payment_method !== 'credit') continue

      const account = accountById.get(tx.accountId)
      if (!account?.card_due_day) continue

      const dueDate = computeCreditInvoiceDueDate(tx.date, account.card_due_day, account.card_closing_day)
      if (!dueDate || dueDate.slice(0, 7) !== month) continue

      if (status === 'open' && tx.paid) continue
      if (status === 'paid' && !tx.paid) continue

      const list = grouped.get(tx.accountId) ?? []
      list.push(tx)
      grouped.set(tx.accountId, list)
    }

    return grouped
  }

  /** Paga/Lanca um recorrente no mes */
  async function payRecurrent(rec: Recurrent, month: string) {
    const existing = transactions.value.find((t) =>
      t.recurrentId === rec.id
      && (monthKey(t.date) === month || (typeof t.date === 'string' && t.date.slice(0, 7) === month)),
    )
    if (existing) return existing

    const referenceDay = rec.due_day ?? rec.day_of_month
    const date = resolveRecurringDate(month, referenceDay)

    const type: Transaction['type'] = rec.kind === 'expense' ? 'expense' : 'income'
    const paymentMethod: Transaction['payment_method'] =
      type === 'expense' ? (rec.payment_method ?? 'debit') : undefined
    const paid = type === 'expense' ? paymentMethod === 'debit' : true

    const tx = await addTransaction({
      accountId: rec.accountId,
      date,
      type,
      payment_method: paymentMethod,
      amount_cents: rec.amount_cents,
      description: rec.description || rec.name,
      paid,
      installment: null,
      recurrentId: rec.id,
    })

    // Debito/receita impacta saldo na hora. Credito vai para fatura.
    if (paid) {
      const accountsStore = useAccountsStore()
      await accountsStore.adjustBalance(rec.accountId, rec.amount_cents, rec.name)
    }

    return tx
  }

  async function addTransaction(tx: Omit<Transaction, 'id'>) {
    const paid = tx.paid !== undefined ? tx.paid : derivePaid(tx.type, tx.payment_method)
    const created = await apiPost<Transaction>('/transactions', {
      ...tx,
      id: uuid(),
      paid,
      createdAt: nowISO(),
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
    payment_method?: 'debit' | 'credit'
    installmentAmountCents: number
    description?: string
    product: string
    totalInstallments: number
  }) {
    const parentId = uuid()
    const created: Transaction[] = []
    const isCredit = base.payment_method === 'credit'

    for (let i = 1; i <= base.totalInstallments; i++) {
      const installmentDate = i === 1 ? base.date : addMonths(base.date, i - 1)
      // Crédito: todas as parcelas pendentes (acumula na fatura)
      // Débito: só 1ª parcela paga, demais pendentes
      const isPaid = isCredit ? false : (i === 1)

      const tx = await apiPost<Transaction>('/transactions', {
        id: uuid(),
        accountId: base.accountId,
        date: installmentDate,
        type: base.type,
        payment_method: base.payment_method,
        amount_cents: base.installmentAmountCents,
        description: base.description,
        paid: isPaid,
        installment: {
          parentId,
          total: base.totalInstallments,
          index: i,
          product: base.product,
        },
        createdAt: nowISO(),
      })
      created.push(tx)
      transactions.value.push(tx)
    }

    // Ajustar saldo somente se débito (1ª parcela paga imediatamente)
    if (!isCredit && created[0]) {
      const accountsStore = useAccountsStore()
      await accountsStore.adjustBalance(
        base.accountId,
        base.installmentAmountCents,
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
      : tx.description || 'Transacao'

    await accountsStore.adjustBalance(tx.accountId, tx.amount_cents, note)
  }

  async function markUnpaid(txId: string) {
    const tx = transactions.value.find(t => t.id === txId)
    if (!tx || !tx.paid) return

    await apiPatch(`/transactions/${txId}`, { paid: false })
    tx.paid = false

    const accountsStore = useAccountsStore()
    const note = tx.installment
      ? `Estorno parcela ${tx.installment.index}/${tx.installment.total} - ${tx.installment.product}`
      : `Estorno - ${tx.description || 'Transacao'}`

    await accountsStore.adjustBalance(tx.accountId, -tx.amount_cents, note)
  }

  async function updateTransaction(id: string, patch: Partial<Transaction>) {
    const old = transactions.value.find(t => t.id === id)

    const updated = await apiPatch<Transaction>(`/transactions/${id}`, patch)
    const idx = transactions.value.findIndex(t => t.id === id)
    if (idx !== -1) transactions.value[idx] = updated

    // Sem snapshot anterior em memoria, nao ha como calcular diferenca de saldo com seguranca.
    if (!old) return updated

    const accountsStore = useAccountsStore()
    const oldApplied = old.paid ? old.amount_cents : 0
    const newApplied = updated.paid ? updated.amount_cents : 0

    if (old.accountId === updated.accountId) {
      const delta = newApplied - oldApplied
      if (delta !== 0) {
        const label = updated.description || old.description || 'Transacao'
        await accountsStore.adjustBalance(updated.accountId, delta, `Ajuste edicao - ${label}`)
      }
      return updated
    }

    // Conta alterada: remove impacto da conta antiga e aplica na nova, se houver.
    if (oldApplied !== 0) {
      const oldLabel = old.description || 'Transacao'
      await accountsStore.adjustBalance(old.accountId, -oldApplied, `Estorno edicao - ${oldLabel}`)
    }
    if (newApplied !== 0) {
      const newLabel = updated.description || 'Transacao'
      await accountsStore.adjustBalance(updated.accountId, newApplied, newLabel)
    }

    return updated
  }

  function isPaidCreditTransaction(tx: Transaction) {
    return tx.payment_method === 'credit' && tx.paid
  }

  function hasPaidCreditInInstallmentGroup(parentId: string) {
    return transactions.value.some(t =>
      t.installment?.parentId === parentId && isPaidCreditTransaction(t),
    )
  }

  async function deleteTransaction(id: string) {
    const tx = transactions.value.find(t => t.id === id)
    if (tx && isPaidCreditTransaction(tx)) {
      throw new Error('Transacoes de credito pagas nao podem ser excluidas.')
    }

    await apiDelete(`/transactions/${id}`)
    transactions.value = transactions.value.filter(t => t.id !== id)
  }

  /** Exclui todas as parcelas de um grupo (mesmo parentId) */
  async function deleteInstallmentGroup(parentId: string) {
    if (hasPaidCreditInInstallmentGroup(parentId)) {
      throw new Error('O grupo possui parcela de credito ja paga e nao pode ser excluido.')
    }

    const parcelas = transactions.value.filter(t => t.installment?.parentId === parentId)
    for (const p of parcelas) {
      await apiDelete(`/transactions/${p.id}`)
    }
    transactions.value = transactions.value.filter(t => t.installment?.parentId !== parentId)
  }

  return {
    transactions,
    loadTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    deleteInstallmentGroup,
    isPaidCreditTransaction,
    hasPaidCreditInInstallmentGroup,
    generateInstallments,
    markPaid,
    markUnpaid,
    unpaidForMonth,
    hasRecurrentTransaction,
    payRecurrent,
    derivePaid,
    creditInvoicesByAccount,
  }
})
