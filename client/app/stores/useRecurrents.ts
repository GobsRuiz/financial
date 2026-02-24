import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { Recurrent } from '~/schemas/zod-schemas'
import { apiGet, apiPost, apiPatch, apiDelete } from '~/utils/api'

export const useRecurrentsStore = defineStore('recurrents', () => {
  const recurrents = ref<Recurrent[]>([])

  async function loadRecurrents() {
    recurrents.value = await apiGet<Recurrent[]>('/recurrents')
  }

  async function addRecurrent(data: Omit<Recurrent, 'id'>) {
    const created = await apiPost<Recurrent>('/recurrents', {
      ...data,
      id: uuid(),
    })
    recurrents.value.push(created)
    return created
  }

  async function updateRecurrent(id: string, patch: Partial<Recurrent>) {
    const updated = await apiPatch<Recurrent>(`/recurrents/${id}`, patch)
    const idx = recurrents.value.findIndex(r => r.id === id)
    if (idx !== -1) recurrents.value[idx] = updated
    return updated
  }

  async function deleteRecurrent(id: string) {
    await apiDelete(`/recurrents/${id}`)
    recurrents.value = recurrents.value.filter(r => r.id !== id)
  }

  return { recurrents, loadRecurrents, addRecurrent, updateRecurrent, deleteRecurrent }
})
