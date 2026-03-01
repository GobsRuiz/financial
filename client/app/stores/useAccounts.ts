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

  async function deleteAccount(accountId: number, onProgress?: (step: string) => void) {
    const [txFromAccount, txToAccount, recurrents, historyItems, investmentPositions, eventsByAccount] = await Promise.all([
      apiGet<Array<{ id: string, accountId: number }>>('/transactions', { accountId: String(accountId) }),
      apiGet<Array<{ id: string, destinationAccountId?: number }>>('/transactions', { destinationAccountId: String(accountId) }),
      apiGet<Array<{ id: string, accountId: number }>>('/recurrents', { accountId: String(accountId) }),
      apiGet<Array<{ id: string, accountId: number }>>('/history', { accountId: String(accountId) }),
      apiGet<Array<{ id: string, accountId: number }>>('/investment_positions', { accountId: String(accountId) }),
      apiGet<Array<{ id: string, accountId: number }>>('/investment_events', { accountId: String(accountId) }),
    ])

    const txMap = new Map<string, { id: string }>()
    for (const tx of txFromAccount) txMap.set(tx.id, tx)
    for (const tx of txToAccount) txMap.set(tx.id, tx)

    const eventsByPosition = await Promise.all(
      investmentPositions.map(position =>
        apiGet<Array<{ id: string, positionId: string }>>('/investment_events', { positionId: position.id }),
      ),
    )

    const eventMap = new Map<string, { id: string }>()
    for (const event of eventsByAccount) eventMap.set(event.id, event)
    for (const events of eventsByPosition) {
      for (const event of events) {
        eventMap.set(event.id, event)
      }
    }

    onProgress?.('Excluindo eventos de investimento...')
    await Promise.all(
      [...eventMap.values()].map(event => apiDelete(`/investment_events/${event.id}`)),
    )

    onProgress?.('Excluindo posicoes...')
    await Promise.all(
      investmentPositions.map(position => apiDelete(`/investment_positions/${position.id}`)),
    )

    onProgress?.('Excluindo transacoes...')
    await Promise.all(
      [...txMap.values()].map(tx => apiDelete(`/transactions/${tx.id}`)),
    )

    onProgress?.('Excluindo recorrentes...')
    await Promise.all(
      recurrents.map(rec => apiDelete(`/recurrents/${rec.id}`)),
    )

    onProgress?.('Excluindo historico...')
    await Promise.all(
      historyItems.map(item => apiDelete(`/history/${item.id}`)),
    )

    onProgress?.('Removendo conta...')
    await apiDelete(`/accounts/${accountId}`)
    accounts.value = accounts.value.filter(account => account.id !== accountId)
    onProgress?.('Concluido!')

    return {
      transactionsDeleted: txMap.size,
      recurrentsDeleted: recurrents.length,
      historyDeleted: historyItems.length,
      investmentPositionsDeleted: investmentPositions.length,
      investmentEventsDeleted: eventMap.size,
    }
  }

  return { accounts, loadAccounts, addAccount, updateAccount, adjustBalance, deleteAccount }
})
