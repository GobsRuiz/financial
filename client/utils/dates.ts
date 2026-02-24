import dayjs from 'dayjs'

/**
 * Converte Date ou string para "YYYY-MM-DD"
 */
export function toISODate(date: Date | string): string {
  return dayjs(date).format('YYYY-MM-DD')
}

/**
 * Soma N meses a uma data ISO e retorna "YYYY-MM-DD"
 */
export function addMonths(isoDate: string, n: number): string {
  return dayjs(isoDate).add(n, 'month').format('YYYY-MM-DD')
}

/**
 * Retorna chave do mês: "2026-02"
 */
export function monthKey(isoDate: string): string {
  return dayjs(isoDate).format('YYYY-MM')
}

/**
 * Data atual em "YYYY-MM-DD"
 */
export function nowISO(): string {
  return dayjs().format('YYYY-MM-DD')
}
