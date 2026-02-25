/**
 * "1.234,56" ou "1234,56" ou "1234.56" → 123456 (centavos)
 */
const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function parseBRLToCents(input: string): number {
  const cleaned = input
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  const value = parseFloat(cleaned)
  if (isNaN(value)) return 0

  return Math.round(value * 100)
}

/**
 * 123456 → "R$ 1.234,56"
 */
export function formatCentsToBRL(cents: number): string {
  const formattedAbs = brlFormatter.format(Math.abs(cents) / 100)

  return cents < 0 ? `-${formattedAbs}` : formattedAbs
}
