import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { HistoryItem } from '~/schemas/zod-schemas'
import { apiGet, apiPost } from '~/utils/api'
import { nowISO } from '~/utils/dates'

export const useHistoryStore = defineStore('history', () => {
  const history = ref<HistoryItem[]>([])

  async function loadHistory() {
    history.value = await apiGet<HistoryItem[]>('/history')
  }

  async function appendHistory(accountId: number, balance_cents: number, note?: string) {
    const item: HistoryItem = await apiPost('/history', {
      id: uuid(),
      accountId,
      date: nowISO(),
      balance_cents,
      note: note ?? '',
    })
    history.value.push(item)
    return item
  }

  return { history, loadHistory, appendHistory }
})
