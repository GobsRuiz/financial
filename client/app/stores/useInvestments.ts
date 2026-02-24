import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { Investment } from '~/schemas/zod-schemas'
import { apiGet, apiPost, apiPatch, apiDelete } from '~/utils/api'

export const useInvestmentsStore = defineStore('investments', () => {
  const investments = ref<Investment[]>([])

  function normalizeInvestment(inv: any): Investment {
    return {
      ...inv,
      investment_type: inv.investment_type ?? 'outro',
      details: inv.details ?? {},
    }
  }

  async function loadInvestments() {
    const raw = await apiGet<Investment[]>('/investments')
    investments.value = raw.map(normalizeInvestment)
  }

  async function addInvestment(data: Omit<Investment, 'id'>) {
    const created = await apiPost<Investment>('/investments', {
      ...data,
      investment_type: data.investment_type ?? 'outro',
      details: data.details ?? {},
      id: uuid(),
    })
    investments.value.push(normalizeInvestment(created))
    return created
  }

  async function updateInvestment(id: string, patch: Partial<Investment>) {
    const updated = await apiPatch<Investment>(`/investments/${id}`, patch)
    const idx = investments.value.findIndex(i => i.id === id)
    if (idx !== -1) investments.value[idx] = normalizeInvestment(updated)
    return updated
  }

  async function deleteInvestment(id: string) {
    await apiDelete(`/investments/${id}`)
    investments.value = investments.value.filter(i => i.id !== id)
  }

  return { investments, loadInvestments, addInvestment, updateInvestment, deleteInvestment }
})
