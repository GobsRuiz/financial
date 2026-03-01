import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { getMockDb, resetMockApi } from '../helpers/mockApi'

describe('useRecurrentsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('addRecurrent, updateRecurrent e deleteRecurrent funcionam no ciclo completo', async () => {
    resetMockApi({ recurrents: [] })

    const store = useRecurrentsStore()

    const created = await store.addRecurrent({
      accountId: 1,
      kind: 'expense',
      payment_method: 'debit',
      notify: true,
      name: 'Internet',
      amount_cents: -12000,
      frequency: 'monthly',
      day_of_month: undefined,
      due_day: 10,
      description: 'Plano fibra',
      active: true,
    } as any)

    expect(store.recurrents).toHaveLength(1)
    expect(created.name).toBe('Internet')

    const updated = await store.updateRecurrent(created.id, {
      amount_cents: -15000,
      due_day: 12,
      active: false,
    })

    expect(updated.amount_cents).toBe(-15000)
    expect(store.recurrents[0]?.due_day).toBe(12)
    expect(store.recurrents[0]?.active).toBe(false)

    await store.deleteRecurrent(created.id)
    expect(store.recurrents).toHaveLength(0)
    expect(getMockDb().recurrents).toHaveLength(0)
  })
})
