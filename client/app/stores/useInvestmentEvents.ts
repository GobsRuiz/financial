import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { InvestmentEvent } from '~/schemas/zod-schemas'
import { apiGet, apiPost, apiPatch, apiDelete } from '~/utils/api'
import { useInvestmentPositionsStore } from './useInvestmentPositions'
import { useAccountsStore } from './useAccounts'

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

    // Ajustar saldo da conta: compra/aporte debita, venda/resgate/vencimento credita
    await adjustAccountForEvent(created)

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

    // Reverter saldo do evento antigo e aplicar o novo
    if (original) await adjustAccountForEvent(original, true)
    await adjustAccountForEvent(updated)

    return updated
  }

  async function deleteEvent(id: string) {
    const event = events.value.find(e => e.id === id)
    await apiDelete(`/investment_events/${id}`)
    events.value = events.value.filter(e => e.id !== id)
    if (event) {
      await recomputePosition(event.positionId)
      // Reverter ajuste de saldo
      await adjustAccountForEvent(event, true)
    }
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
    let totalCents = 0

    for (const event of positionEvents) {
      if (event.event_type === 'contribution') {
        principalCents += event.amount_cents
        totalCents += event.amount_cents
        continue
      }
      if (event.event_type === 'income') {
        totalCents += event.amount_cents
        continue
      }
      if (event.event_type === 'withdrawal' || event.event_type === 'maturity') {
        principalCents -= event.amount_cents
        totalCents -= event.amount_cents
        continue
      }
    }

    const normalizedPrincipal = Math.max(0, principalCents)
    const normalizedTotal = Math.max(0, totalCents)
    await positionsStore.updatePosition(positionId, {
      principal_cents: normalizedPrincipal,
      current_value_cents: normalizedTotal,
      invested_cents: normalizedTotal,
    })
  }

  async function recomputeAllPositions() {
    const positionsStore = useInvestmentPositionsStore()
    const positionIds = positionsStore.positions.map(position => position.id)

    if (!positionIds.length) {
      return { total: 0, succeeded: 0, failed: 0 }
    }

    const results = await Promise.allSettled(
      positionIds.map(positionId => recomputePosition(positionId)),
    )

    let failed = 0
    results.forEach((result, index) => {
      if (result.status !== 'rejected') return
      failed += 1
      console.error(`Erro ao recalcular posicao ${positionIds[index]}:`, result.reason)
    })

    return {
      total: positionIds.length,
      succeeded: positionIds.length - failed,
      failed,
    }
  }

  /**
   * Ajusta saldo da conta vinculada ao evento.
   * - buy/contribution: debita (saiu dinheiro da conta)
   * - sell/withdrawal/maturity: credita (dinheiro voltou para conta)
   * - income: nenhum ajuste (rendimento fica no ativo)
   * Se reverse=true, inverte o sinal (usado ao excluir evento).
   */
  async function adjustAccountForEvent(event: InvestmentEvent, reverse = false) {
    const { event_type, amount_cents, accountId } = event
    let delta = 0

    if (event_type === 'buy' || event_type === 'contribution') {
      delta = -amount_cents // debita da conta
    } else if (event_type === 'sell' || event_type === 'withdrawal' || event_type === 'maturity') {
      delta = amount_cents // credita na conta
    }

    if (delta === 0) return

    if (reverse) delta = -delta

    const accountsStore = useAccountsStore()
    const label = event_type === 'buy' ? 'Compra investimento'
      : event_type === 'sell' ? 'Venda investimento'
      : event_type === 'contribution' ? 'Aporte investimento'
      : event_type === 'withdrawal' ? 'Resgate investimento'
      : 'Vencimento investimento'

    await accountsStore.adjustBalance(accountId, delta, label)
  }

  return {
    events,
    loadEvents,
    addEvent,
    updateEvent,
    deleteEvent,
    listByPosition,
    recomputePosition,
    recomputeAllPositions,
  }
})
