import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Account } from '~/schemas/zod-schemas'
import { apiDelete, apiGet, apiPost, apiPatch } from '~/utils/api'
import { useHistoryStore } from './useHistory'

export const useAccountsStore = defineStore('accounts', () => {
  const accounts = ref<Account[]>([])

  async function loadAccounts() {
    accounts.value = await apiGet<Account[]>('/accounts')
  }

  async function addAccount(data: Omit<Account, 'id'>) {
    const created = await apiPost<Account>('/accounts', data)
    accounts.value.push(created)
    return created
  }

  async function updateAccount(id: number, patch: Partial<Account>) {
    const updated = await apiPatch<Account>(`/accounts/${id}`, patch)
    const idx = accounts.value.findIndex(a => a.id === id)
    if (idx !== -1) accounts.value[idx] = updated
    return updated
  }

  async function adjustBalance(accountId: number, deltaCents: number, note?: string) {
    const account = accounts.value.find(a => a.id === accountId)
    if (!account) throw new Error(`Conta ${accountId} não encontrada`)

    const newBalance = account.balance_cents + deltaCents
    await apiPatch(`/accounts/${accountId}`, { balance_cents: newBalance })
    account.balance_cents = newBalance

    const historyStore = useHistoryStore()
    await historyStore.appendHistory(accountId, newBalance, note)
  }

  async function deleteAccount(accountId: number) {
    const [txFromAccount, txToAccount, recurrents, historyItems] = await Promise.all([
      apiGet<Array<{ id: string, accountId: number }>>('/transactions', { accountId: String(accountId) }),
      apiGet<Array<{ id: string, destinationAccountId?: number }>>('/transactions', { destinationAccountId: String(accountId) }),
      apiGet<Array<{ id: string, accountId: number }>>('/recurrents', { accountId: String(accountId) }),
      apiGet<Array<{ id: string, accountId: number }>>('/history', { accountId: String(accountId) }),
    ])

    const txMap = new Map<string, { id: string }>()
    for (const tx of txFromAccount) txMap.set(tx.id, tx)
    for (const tx of txToAccount) txMap.set(tx.id, tx)

    for (const tx of txMap.values()) {
      await apiDelete(`/transactions/${tx.id}`)
    }

    for (const rec of recurrents) {
      await apiDelete(`/recurrents/${rec.id}`)
    }

    for (const item of historyItems) {
      await apiDelete(`/history/${item.id}`)
    }

    await apiDelete(`/accounts/${accountId}`)
    accounts.value = accounts.value.filter(account => account.id !== accountId)

    return {
      transactionsDeleted: txMap.size,
      recurrentsDeleted: recurrents.length,
      historyDeleted: historyItems.length,
    }
  }

  return { accounts, loadAccounts, addAccount, updateAccount, adjustBalance, deleteAccount }
})
