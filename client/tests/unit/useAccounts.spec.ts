import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAccountsStore } from '~/stores/useAccounts'
import { getMockDb, resetMockApi } from '../helpers/mockApi'

describe('useAccountsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adjustBalance atualiza saldo da conta e cria historico', async () => {
    resetMockApi({
      accounts: [
        { id: 1, label: 'Carteira', bank: 'Banco X', balance_cents: 10000 },
      ],
      history: [],
    })

    const store = useAccountsStore()
    store.accounts = [
      { id: 1, label: 'Carteira', bank: 'Banco X', balance_cents: 10000 } as any,
    ]

    await store.adjustBalance(1, -2500, 'Compra mercado')

    expect(store.accounts[0]?.balance_cents).toBe(7500)

    const db = getMockDb()
    expect(db.accounts[0]?.balance_cents).toBe(7500)
    expect(db.history).toHaveLength(1)
    expect(db.history[0]).toMatchObject({
      accountId: 1,
      balance_cents: 7500,
      note: 'Compra mercado',
    })
  })

  it('deleteAccount remove cascade e reporta progresso por etapa', async () => {
    resetMockApi({
      accounts: [
        { id: 1, label: 'Conta A', bank: 'Banco A', balance_cents: 1000 },
        { id: 2, label: 'Conta B', bank: 'Banco B', balance_cents: 5000 },
      ],
      transactions: [
        { id: 'tx-1', accountId: 1, destinationAccountId: 2 },
        { id: 'tx-2', accountId: 2, destinationAccountId: 1 },
      ],
      recurrents: [
        { id: 'rec-1', accountId: 1 },
      ],
      history: [
        { id: 'hist-1', accountId: 1 },
      ],
      investment_positions: [
        { id: 'pos-1', accountId: 1 },
      ],
      investment_events: [
        { id: 'evt-1', accountId: 1, positionId: 'pos-1' },
        { id: 'evt-2', accountId: 2, positionId: 'pos-1' },
      ],
    })

    const store = useAccountsStore()
    store.accounts = [
      { id: 1, label: 'Conta A', bank: 'Banco A', balance_cents: 1000 } as any,
      { id: 2, label: 'Conta B', bank: 'Banco B', balance_cents: 5000 } as any,
    ]

    const progress: string[] = []
    const summary = await store.deleteAccount(1, (step) => progress.push(step))

    expect(summary).toEqual({
      transactionsDeleted: 2,
      recurrentsDeleted: 1,
      historyDeleted: 1,
      investmentPositionsDeleted: 1,
      investmentEventsDeleted: 2,
    })

    expect(progress).toEqual([
      'Excluindo eventos de investimento...',
      'Excluindo posicoes...',
      'Excluindo transacoes...',
      'Excluindo recorrentes...',
      'Excluindo historico...',
      'Removendo conta...',
      'Concluido!',
    ])

    const db = getMockDb()
    expect(db.accounts.map(a => a.id)).toEqual([2])
    expect(db.transactions).toEqual([])
    expect(db.recurrents).toEqual([])
    expect(db.history).toEqual([])
    expect(db.investment_positions).toEqual([])
    expect(db.investment_events).toEqual([])
  })
})
