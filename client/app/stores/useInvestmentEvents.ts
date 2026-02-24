import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { InvestmentEvent } from '~/schemas/zod-schemas'
import { apiGet, apiPost, apiPatch, apiDelete } from '~/utils/api'
import { useInvestmentPositionsStore } from './useInvestmentPositions'

export const useInvestmentEventsStore = defineStore('investment-events', () => {
  const events = ref<InvestmentEvent[]>([])

  async function loadEvents() {
    events.value = await apiGet<InvestmentEvent[]>('/investment_events')
  }

  function listByPosition(positionId: string) {
    return events.value
      .filter(e => e.positionId === positionId)
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  async function addEvent(data: Omit<InvestmentEvent, 'id'>) {
    const created = await apiPost<InvestmentEvent>('/investment_events', {
      ...data,
      id: uuid(),
    })
    events.value.push(created)
    await recomputePosition(created.positionId)
    return created
  }

  async function updateEvent(id: string, patch: Partial<InvestmentEvent>) {
    const original = events.value.find(e => e.id === id)
    const updated = await apiPatch<InvestmentEvent>(`/investment_events/${id}`, patch)
    const idx = events.value.findIndex(e => e.id === id)
    if (idx !== -1) events.value[idx] = updated

    const affected = new Set<string>()
    if (original) affected.add(original.positionId)
    affected.add(updated.positionId)
    for (const positionId of affected) {
      await recomputePosition(positionId)
    }

    return updated
  }

  async function deleteEvent(id: string) {
    const event = events.value.find(e => e.id === id)
    await apiDelete(`/investment_events/${id}`)
    events.value = events.value.filter(e => e.id !== id)
    if (event) await recomputePosition(event.positionId)
  }

  async function recomputePosition(positionId: string) {
    const positionsStore = useInvestmentPositionsStore()
    const position = positionsStore.positions.find(p => p.id === positionId)
    if (!position) return

    const positionEvents = listByPosition(positionId)

    if (position.bucket === 'variable') {
      let quantity = 0
      let totalCostCents = 0

      for (const event of positionEvents) {
        if (event.event_type === 'buy') {
          const qty = event.quantity ?? 0
          quantity += qty
          totalCostCents += event.amount_cents + (event.fees_cents ?? 0)
          continue
        }

        if (event.event_type === 'sell') {
          const qty = event.quantity ?? 0
          if (qty > 0 && quantity > 0) {
            const avgCost = totalCostCents / quantity
            totalCostCents = Math.max(0, Math.round(totalCostCents - avgCost * qty))
          }
          quantity = Math.max(0, quantity - qty)
          continue
        }
      }

      const avgCostCents = quantity > 0 ? Math.round(totalCostCents / quantity) : 0

      await positionsStore.updatePosition(positionId, {
        quantity_total: quantity,
        avg_cost_cents: avgCostCents || undefined,
        invested_cents: Math.max(0, totalCostCents),
      })
      return
    }

    let principalCents = 0

    for (const event of positionEvents) {
      if (event.event_type === 'contribution') {
        principalCents += event.amount_cents
        continue
      }
      if (event.event_type === 'withdrawal' || event.event_type === 'maturity') {
        principalCents -= event.amount_cents
        continue
      }
    }

    const normalizedPrincipal = Math.max(0, principalCents)
    await positionsStore.updatePosition(positionId, {
      principal_cents: normalizedPrincipal,
      invested_cents: normalizedPrincipal,
    })
  }

  return {
    events,
    loadEvents,
    addEvent,
    updateEvent,
    deleteEvent,
    listByPosition,
    recomputePosition,
  }
})
