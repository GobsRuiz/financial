import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAccountsStore } from '~/stores/useAccounts'
import { useTransactionsStore } from '~/stores/useTransactions'
import { getMockDb, resetMockApi } from '../helpers/mockApi'

describe('useTransactionsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('markPaid e markUnpaid ajustam saldo da conta', async () => {
    resetMockApi({
      accounts: [
        { id: 1, label: 'Conta Principal', bank: 'Banco X', balance_cents: 10000 },
      ],
      transactions: [
        {
          id: 'tx-1',
          accountId: 1,
          date: '2026-02-20',
          type: 'expense',
          payment_method: 'debit',
          amount_cents: -500,
          description: 'Cafe',
          paid: false,
          installment: null,
          createdAt: '2026-02-20',
        },
      ],
      history: [],
    })

    const accountsStore = useAccountsStore()
    accountsStore.accounts = [
      { id: 1, label: 'Conta Principal', bank: 'Banco X', balance_cents: 10000 } as any,
    ]

    const transactionsStore = useTransactionsStore()
    transactionsStore.transactions = [
      {
        id: 'tx-1',
        accountId: 1,
        date: '2026-02-20',
        type: 'expense',
        payment_method: 'debit',
        amount_cents: -500,
        description: 'Cafe',
        paid: false,
        installment: null,
        createdAt: '2026-02-20',
      } as any,
    ]

    await transactionsStore.markPaid('tx-1')
    expect(transactionsStore.transactions[0]?.paid).toBe(true)
    expect(accountsStore.accounts[0]?.balance_cents).toBe(9500)

    await transactionsStore.markUnpaid('tx-1')
    expect(transactionsStore.transactions[0]?.paid).toBe(false)
    expect(accountsStore.accounts[0]?.balance_cents).toBe(10000)
  })

  it('deleteInstallmentGroup remove grupo completo, reporta progresso e estorna saldo', async () => {
    resetMockApi({
      accounts: [
        { id: 1, label: 'Conta Principal', bank: 'Banco X', balance_cents: 10000 },
      ],
      transactions: [
        {
          id: 'inst-1',
          accountId: 1,
          date: '2026-01-10',
          type: 'expense',
          payment_method: 'debit',
          amount_cents: -1000,
          description: 'Notebook',
          paid: true,
          installment: { parentId: 'grp-1', total: 3, index: 1, product: 'Notebook' },
          createdAt: '2026-01-10',
        },
        {
          id: 'inst-2',
          accountId: 1,
          date: '2026-02-10',
          type: 'expense',
          payment_method: 'debit',
          amount_cents: -1000,
          description: 'Notebook',
          paid: true,
          installment: { parentId: 'grp-1', total: 3, index: 2, product: 'Notebook' },
          createdAt: '2026-02-10',
        },
        {
          id: 'inst-3',
          accountId: 1,
          date: '2026-03-10',
          type: 'expense',
          payment_method: 'debit',
          amount_cents: -1000,
          description: 'Notebook',
          paid: true,
          installment: { parentId: 'grp-1', total: 3, index: 3, product: 'Notebook' },
          createdAt: '2026-03-10',
        },
      ],
      history: [],
    })

    const accountsStore = useAccountsStore()
    accountsStore.accounts = [
      { id: 1, label: 'Conta Principal', bank: 'Banco X', balance_cents: 10000 } as any,
    ]

    const transactionsStore = useTransactionsStore()
    transactionsStore.transactions = cloneTransactions(getMockDb().transactions)

    const progress: Array<[number, number]> = []
    await transactionsStore.deleteInstallmentGroup('grp-1', (current, total) => {
      progress.push([current, total])
    })

    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]])
    expect(transactionsStore.transactions).toEqual([])
    expect(getMockDb().transactions).toEqual([])
    expect(accountsStore.accounts[0]?.balance_cents).toBe(13000)
  })

  it('bloqueia exclusao de grupo quando houver parcela de credito paga', async () => {
    resetMockApi()

    const transactionsStore = useTransactionsStore()
    transactionsStore.transactions = [
      {
        id: 'credit-paid-1',
        accountId: 1,
        date: '2026-01-01',
        type: 'expense',
        payment_method: 'credit',
        amount_cents: -1000,
        description: 'Compra cartao',
        paid: true,
        installment: { parentId: 'grp-credit', total: 2, index: 1, product: 'Cartao' },
        createdAt: '2026-01-01',
      } as any,
    ]

    await expect(transactionsStore.deleteInstallmentGroup('grp-credit')).rejects.toThrow(
      'O grupo possui parcela de credito ja paga e nao pode ser excluido.',
    )
  })
})

function cloneTransactions<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}
