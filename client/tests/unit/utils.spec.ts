import { describe, expect, it } from 'vitest'
import { monthKey } from '~/utils/dates'
import { computeCreditInvoiceCycleMonth, computeCreditInvoiceDueDate } from '~/utils/invoice-cycle'

describe('utils/invoice-cycle', () => {
  it('calcula vencimento da fatura no mes seguinte quando due_day <= closing_day', () => {
    const dueDate = computeCreditInvoiceDueDate('2026-02-27', 3, 28)
    expect(dueDate).toBe('2026-03-03')
  })

  it('compra no dia do fechamento entra no proximo ciclo', () => {
    const dueDate = computeCreditInvoiceDueDate('2026-02-28', 3, 28)
    expect(dueDate).toBe('2026-04-03')
  })

  it('retorna null para data invalida', () => {
    const dueDate = computeCreditInvoiceDueDate('invalida', 10, 20)
    expect(dueDate).toBeNull()
  })

  it('calcula o mes do ciclo de fechamento corretamente', () => {
    expect(computeCreditInvoiceCycleMonth('2026-02-27', 28)).toBe('2026-02')
    expect(computeCreditInvoiceCycleMonth('2026-02-28', 28)).toBe('2026-03')
  })
})

describe('utils/dates', () => {
  it('retorna monthKey no formato YYYY-MM', () => {
    expect(monthKey('2026-02-27')).toBe('2026-02')
  })
})
