import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { Investment } from '~/schemas/zod-schemas'
import { apiGet, apiPost, apiPatch } from '~/utils/api'

export const useInvestmentsStore = defineStore('investments', () => {
  const investments = ref<Investment[]>([])

  async function loadInvestments() {
    investments.value = await apiGet<Investment[]>('/investments')
  }

  async function addInvestment(data: Omit<Investment, 'id'>) {
    const created = await apiPost<Investment>('/investments', {
      ...data,
      id: uuid(),
    })
    investments.value.push(created)
    return created
  }

  async function updateInvestment(id: string, patch: Partial<Investment>) {
    const updated = await apiPatch<Investment>(`/investments/${id}`, patch)
    const idx = investments.value.findIndex(i => i.id === id)
    if (idx !== -1) investments.value[idx] = updated
    return updated
  }

  return { investments, loadInvestments, addInvestment, updateInvestment }
})
