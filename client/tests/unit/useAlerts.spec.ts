import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAccountsStore } from '~/stores/useAccounts'
import { useAlerts } from '~/composables/useAlerts'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useTransactionsStore } from '~/stores/useTransactions'

describe('useAlerts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-28T12:00:00'))
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('gera alerta de recorrente para a proxima ocorrencia mensal e evita atraso falso', () => {
    const accountsStore = useAccountsStore()
    const transactionsStore = useTransactionsStore()
    const recurrentsStore = useRecurrentsStore()

    accountsStore.accounts = [
      { id: 1, label: 'Conta Casa', bank: 'Banco X', balance_cents: 0 } as any,
    ]
    transactionsStore.transactions = []
    recurrentsStore.recurrents = [
      {
        id: 'rec-1',
        accountId: 1,
        kind: 'expense',
        payment_method: 'debit',
        notify: true,
        name: 'Aluguel',
        amount_cents: -250000,
        frequency: 'monthly',
        day_of_month: undefined,
        due_day: 1,
        description: 'Aluguel mensal',
        active: true,
      } as any,
    ]

    const { allAlerts, groupedAlerts } = useAlerts()

    expect(allAlerts.value).toHaveLength(1)
    expect(allAlerts.value[0]).toMatchObject({
      alertType: 'recurrent',
      bucket: 'next',
      targetDate: '2026-03-01',
      daysUntil: 1,
    })
    expect(groupedAlerts.value.overdue).toHaveLength(0)
  })
})
