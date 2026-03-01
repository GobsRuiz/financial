import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { Transaction, Recurrent } from '~/schemas/zod-schemas'
import { apiGet, apiPost, apiPatch, apiDelete } from '~/utils/api'
import { addMonths, monthKey, nowISO } from '~/utils/dates'
import { computeCreditInvoiceCycleMonth } from '~/utils/invoice-cycle'
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

      const cycleMonth = computeCreditInvoiceCycleMonth(tx.date, account.card_closing_day)
      if (!cycleMonth || cycleMonth !== month) continue

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
    totalAmountCents: number
    installmentAmountCents: number
    description?: string
    product: string
    totalInstallments: number
  }) {
    const parentId = uuid()
    const created: Transaction[] = []
    const isCredit = base.payment_method === 'credit'

    const regularInstallmentsTotal = base.installmentAmountCents * base.totalInstallments
    const roundingDiffCents = base.totalAmountCents - regularInstallmentsTotal

    for (let i = 1; i <= base.totalInstallments; i++) {
      const installmentDate = i === 1 ? base.date : addMonths(base.date, i - 1)
      // Crédito: todas as parcelas pendentes (acumula na fatura)
      // Débito: só 1ª parcela paga, demais pendentes
      const isPaid = isCredit ? false : (i === 1)
      // Absorve diferença de arredondamento na última parcela para fechar o total.
      const installmentAmountCents = i === base.totalInstallments
        ? base.installmentAmountCents + roundingDiffCents
        : base.installmentAmountCents

      const tx = await apiPost<Transaction>('/transactions', {
        id: uuid(),
        accountId: base.accountId,
        date: installmentDate,
        type: base.type,
        payment_method: base.payment_method,
        amount_cents: installmentAmountCents,
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

  function addAccountDelta(map: Map<number, number>, accountId: number | undefined, delta: number) {
    if (accountId == null) return
    if (!Number.isFinite(delta) || delta === 0) return
    map.set(accountId, (map.get(accountId) ?? 0) + delta)
  }

  function collectAppliedAccountDeltas(tx: Transaction) {
    const deltas = new Map<number, number>()
    if (!tx.paid) return deltas

    // Impacto principal na conta da transacao.
    addAccountDelta(deltas, tx.accountId, tx.amount_cents)

    // Transferencia tambem impacta a conta destino com sinal inverso.
    if (tx.type === 'transfer') {
      addAccountDelta(deltas, tx.destinationAccountId, -tx.amount_cents)
    }

    return deltas
  }

  function snapshotTransaction(tx: Transaction): Transaction {
    return {
      ...tx,
      installment: tx.installment ? { ...tx.installment } : tx.installment,
    }
  }

  async function updateTransaction(id: string, patch: Partial<Transaction>) {
    const old = transactions.value.find(t => t.id === id)
    const oldSnapshot = old ? snapshotTransaction(old) : null

    const updated = await apiPatch<Transaction>(`/transactions/${id}`, patch)
    const idx = transactions.value.findIndex(t => t.id === id)
    if (idx !== -1) transactions.value[idx] = updated

    // Sem snapshot anterior em memoria, nao ha como calcular diferenca de saldo com seguranca.
    if (!oldSnapshot) return updated

    const accountsStore = useAccountsStore()

    // Reverte o impacto antigo e aplica o impacto novo por conta.
    const oldDeltas = collectAppliedAccountDeltas(oldSnapshot)
    const newDeltas = collectAppliedAccountDeltas(updated)
    const netDeltas = new Map<number, number>()

    for (const [accountId, delta] of oldDeltas) {
      addAccountDelta(netDeltas, accountId, -delta)
    }
    for (const [accountId, delta] of newDeltas) {
      addAccountDelta(netDeltas, accountId, delta)
    }

    const label = updated.description
      || oldSnapshot.description
      || (updated.type === 'transfer' || oldSnapshot.type === 'transfer' ? 'Transferencia' : 'Transacao')

    for (const [accountId, delta] of netDeltas) {
      if (delta === 0) continue
      await accountsStore.adjustBalance(accountId, delta, `Ajuste edicao - ${label}`)
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

    const txSnapshot = tx ? snapshotTransaction(tx) : null

    await apiDelete(`/transactions/${id}`)
    transactions.value = transactions.value.filter(t => t.id !== id)

    if (!txSnapshot) return

    const accountsStore = useAccountsStore()
    const appliedDeltas = collectAppliedAccountDeltas(txSnapshot)
    const label = txSnapshot.description || (txSnapshot.type === 'transfer' ? 'Transferencia' : 'Transacao')

    for (const [accountId, delta] of appliedDeltas) {
      if (delta === 0) continue
      await accountsStore.adjustBalance(accountId, -delta, `Estorno exclusao - ${label}`)
    }
  }

  /** Exclui todas as parcelas de um grupo (mesmo parentId) */
  async function deleteInstallmentGroup(parentId: string, onProgress?: (current: number, total: number) => void) {
    if (hasPaidCreditInInstallmentGroup(parentId)) {
      throw new Error('O grupo possui parcela de credito ja paga e nao pode ser excluido.')
    }

    const parcelas = transactions.value.filter(t => t.installment?.parentId === parentId)
    const parcelasSnapshots = parcelas.map(snapshotTransaction)

    for (const [index, p] of parcelas.entries()) {
      await apiDelete(`/transactions/${p.id}`)
      onProgress?.(index + 1, parcelas.length)
    }
    transactions.value = transactions.value.filter(t => t.installment?.parentId !== parentId)

    if (!parcelasSnapshots.length) return

    const accountsStore = useAccountsStore()
    const reversalDeltas = new Map<number, number>()
    for (const parcela of parcelasSnapshots) {
      const applied = collectAppliedAccountDeltas(parcela)
      for (const [accountId, delta] of applied) {
        addAccountDelta(reversalDeltas, accountId, -delta)
      }
    }

    const groupLabel = parcelasSnapshots[0]?.installment?.product || 'Parcelas'
    for (const [accountId, delta] of reversalDeltas) {
      if (delta === 0) continue
      await accountsStore.adjustBalance(accountId, delta, `Estorno exclusao grupo - ${groupLabel}`)
    }
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
