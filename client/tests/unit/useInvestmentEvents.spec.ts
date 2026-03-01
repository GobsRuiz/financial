import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAccountsStore } from '~/stores/useAccounts'
import { useInvestmentEventsStore } from '~/stores/useInvestmentEvents'
import { useInvestmentPositionsStore } from '~/stores/useInvestmentPositions'
import { resetMockApi } from '../helpers/mockApi'

describe('useInvestmentEventsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('recomputePosition atualiza quantidade e custo medio para renda variavel', async () => {
    resetMockApi({
      investment_positions: [
        {
          id: 'pos-var',
          accountId: 1,
          bucket: 'variable',
          asset_code: 'PETR4',
          name: 'Petrobras',
          investment_type: 'stock',
          quantity_total: 0,
          avg_cost_cents: 0,
          invested_cents: 0,
        },
      ],
    })

    const positionsStore = useInvestmentPositionsStore()
    positionsStore.positions = [
      {
        id: 'pos-var',
        accountId: 1,
        bucket: 'variable',
        asset_code: 'PETR4',
        name: 'Petrobras',
        investment_type: 'stock',
        quantity_total: 0,
        avg_cost_cents: 0,
        invested_cents: 0,
      } as any,
    ]

    const eventsStore = useInvestmentEventsStore()
    eventsStore.events = [
      {
        id: 'evt-1',
        positionId: 'pos-var',
        accountId: 1,
        date: '2026-01-01',
        event_type: 'buy',
        amount_cents: 10000,
        quantity: 10,
        fees_cents: 1000,
      },
      {
        id: 'evt-2',
        positionId: 'pos-var',
        accountId: 1,
        date: '2026-01-10',
        event_type: 'buy',
        amount_cents: 20000,
        quantity: 10,
        fees_cents: 0,
      },
      {
        id: 'evt-3',
        positionId: 'pos-var',
        accountId: 1,
        date: '2026-01-20',
        event_type: 'sell',
        amount_cents: 15000,
        quantity: 5,
      },
    ] as any

    await eventsStore.recomputePosition('pos-var')

    const updated = positionsStore.positions.find(p => p.id === 'pos-var')
    expect(updated?.quantity_total).toBe(15)
    expect(updated?.avg_cost_cents).toBe(1550)
    expect(updated?.invested_cents).toBe(23250)
  })

  it('recomputePosition atualiza principal e valor atual para renda fixa', async () => {
    resetMockApi({
      investment_positions: [
        {
          id: 'pos-fix',
          accountId: 1,
          bucket: 'fixed',
          asset_code: 'CDB-X',
          name: 'CDB',
          investment_type: 'cdb',
          principal_cents: 0,
          current_value_cents: 0,
          invested_cents: 0,
        },
      ],
    })

    const positionsStore = useInvestmentPositionsStore()
    positionsStore.positions = [
      {
        id: 'pos-fix',
        accountId: 1,
        bucket: 'fixed',
        asset_code: 'CDB-X',
        name: 'CDB',
        investment_type: 'cdb',
        principal_cents: 0,
        current_value_cents: 0,
        invested_cents: 0,
      } as any,
    ]

    const eventsStore = useInvestmentEventsStore()
    eventsStore.events = [
      {
        id: 'evt-a',
        positionId: 'pos-fix',
        accountId: 1,
        date: '2026-01-01',
        event_type: 'contribution',
        amount_cents: 10000,
      },
      {
        id: 'evt-b',
        positionId: 'pos-fix',
        accountId: 1,
        date: '2026-01-05',
        event_type: 'income',
        amount_cents: 1000,
      },
      {
        id: 'evt-c',
        positionId: 'pos-fix',
        accountId: 1,
        date: '2026-01-10',
        event_type: 'withdrawal',
        amount_cents: 3000,
      },
    ] as any

    await eventsStore.recomputePosition('pos-fix')

    const updated = positionsStore.positions.find(p => p.id === 'pos-fix')
    expect(updated?.principal_cents).toBe(7000)
    expect(updated?.current_value_cents).toBe(8000)
    expect(updated?.invested_cents).toBe(8000)
  })

  it('addEvent e deleteEvent aplicam ajuste de saldo da conta', async () => {
    resetMockApi({
      accounts: [
        { id: 1, label: 'Conta Investimentos', bank: 'Banco X', balance_cents: 50000 },
      ],
      investment_positions: [
        {
          id: 'pos-var',
          accountId: 1,
          bucket: 'variable',
          asset_code: 'BOVA11',
          name: 'ETF',
          investment_type: 'stock',
          quantity_total: 0,
          avg_cost_cents: 0,
          invested_cents: 0,
        },
      ],
      investment_events: [],
    })

    const accountsStore = useAccountsStore()
    accountsStore.accounts = [
      { id: 1, label: 'Conta Investimentos', bank: 'Banco X', balance_cents: 50000 } as any,
    ]

    const positionsStore = useInvestmentPositionsStore()
    positionsStore.positions = [
      {
        id: 'pos-var',
        accountId: 1,
        bucket: 'variable',
        asset_code: 'BOVA11',
        name: 'ETF',
        investment_type: 'stock',
        quantity_total: 0,
        avg_cost_cents: 0,
        invested_cents: 0,
      } as any,
    ]

    const adjustSpy = vi.spyOn(accountsStore, 'adjustBalance').mockResolvedValue(undefined as any)

    const eventsStore = useInvestmentEventsStore()
    const created = await eventsStore.addEvent({
      positionId: 'pos-var',
      accountId: 1,
      date: '2026-02-01',
      event_type: 'buy',
      amount_cents: 10000,
      quantity: 2,
      unit_price_cents: 5000,
      fees_cents: 0,
      note: 'Compra inicial',
    } as any)

    expect(adjustSpy).toHaveBeenCalledWith(1, -10000, 'Compra investimento')

    await eventsStore.deleteEvent(created.id)
    expect(adjustSpy).toHaveBeenCalledWith(1, 10000, 'Compra investimento')
  })
})
