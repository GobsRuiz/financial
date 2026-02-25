<script setup lang="ts">
import dayjs from 'dayjs'
import {
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  LayoutDashboard,
  PiggyBank,
  Repeat,
  TrendingDown,
  TrendingUp,
} from 'lucide-vue-next'
import type { AlertBucket, AlertItem } from '~/composables/useAlerts'
import { useAlerts } from '~/composables/useAlerts'
import { useAccountsStore } from '~/stores/useAccounts'
import { useInvestmentEventsStore } from '~/stores/useInvestmentEvents'
import { useInvestmentPositionsStore } from '~/stores/useInvestmentPositions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useTransactionsStore } from '~/stores/useTransactions'
import { monthKey } from '~/utils/dates'
import { formatCentsToBRL } from '~/utils/money'

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

type DashboardTx = {
  id: string
  accountId: number
  date: string
  type: 'expense' | 'income' | 'transfer'
  payment_method?: 'debit' | 'credit'
  amount_cents: number
  description?: string
  paid: boolean
  recurrentId?: string
  installment?: {
    product: string
    index: number
    total: number
  } | null
}

type DashboardRecurrent = {
  id: string
  active: boolean
  kind: 'expense' | 'income'
  amount_cents: number
}

type DashboardPosition = {
  id: string
  bucket?: 'variable' | 'fixed'
  investment_type?: string
  asset_code?: string
  name?: string
  invested_cents?: number
  current_value_cents?: number
  principal_cents?: number
}

type DashboardInvestmentEvent = {
  id: string
  positionId: string
  date: string
  event_type: 'buy' | 'sell' | 'income' | 'contribution' | 'withdrawal' | 'maturity'
  amount_cents: number
  fees_cents?: number
}

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const recurrentsStore = useRecurrentsStore()
const investmentPositionsStore = useInvestmentPositionsStore()
const investmentEventsStore = useInvestmentEventsStore()
const { groupedAlerts, counts } = useAlerts()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const refreshing = ref(false)
const loadFailedSources = ref<string[]>([])
const selectedMonth = ref(monthKey(dayjs().format('YYYY-MM-DD')))
const activeChartTab = ref<'flow' | 'type' | 'status'>('flow')
const investmentPeriodTab = ref<'month' | 'year' | 'all'>('month')
const hasSuccessfulDataLoad = ref(false)
const monthStorageKey = 'dashboard:selected-month'

const sourceLoaders = [
  { label: 'contas', load: () => accountsStore.loadAccounts() },
  { label: 'movimentacoes', load: () => transactionsStore.loadTransactions() },
  { label: 'recorrentes', load: () => recurrentsStore.loadRecurrents() },
  { label: 'investimentos', load: () => investmentPositionsStore.loadPositions() },
  { label: 'lancamentos de investimentos', load: () => investmentEventsStore.loadEvents() },
]

function parseMonthQuery(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null
  return value
}

function readStoredMonth(): string | null {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(monthStorageKey)
  return parseMonthQuery(raw)
}

function writeStoredMonth(month: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(monthStorageKey, month)
}

const currentMonthFallback = monthKey(dayjs().format('YYYY-MM-DD'))

watch(() => route.query.mes, (queryMonth) => {
  const parsed = parseMonthQuery(queryMonth)
  const next = parsed ?? readStoredMonth() ?? currentMonthFallback
  if (selectedMonth.value !== next) {
    selectedMonth.value = next
  }
}, { immediate: true })

watch(selectedMonth, (month) => {
  writeStoredMonth(month)

  const routeMonth = parseMonthQuery(route.query.mes)
  if (routeMonth === month) return

  void router.replace({
    query: {
      ...route.query,
      mes: month,
    },
  }).catch((error) => {
    console.error('Erro ao atualizar mes na URL:', error)
  })
})

const hasFatalLoadError = computed(() =>
  loadFailedSources.value.length === sourceLoaders.length && !hasSuccessfulDataLoad.value,
)

const hasPartialLoadError = computed(() =>
  loadFailedSources.value.length > 0 && !hasFatalLoadError.value,
)

const loadErrorMessage = computed(() => {
  if (!loadFailedSources.value.length) return ''
  return `Falha ao carregar: ${loadFailedSources.value.join(', ')}.`
})

async function loadDashboardData() {
  const firstLoad = !hasSuccessfulDataLoad.value && !refreshing.value
  if (firstLoad) {
    loading.value = true
  } else {
    refreshing.value = true
  }

  try {
    const results = await Promise.allSettled(
      sourceLoaders.map(item => item.load()),
    )

    const failedLabels: string[] = []
    let anySuccess = false

    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        anySuccess = true
        continue
      }

      const source = sourceLoaders[index]
      if (!source) continue
      failedLabels.push(source.label)
      console.error(`Erro ao carregar ${source.label}:`, result.reason)
    }

    loadFailedSources.value = failedLabels
    if (anySuccess) {
      hasSuccessfulDataLoad.value = true
    }
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

onMounted(async () => {
  const routeMonth = parseMonthQuery(route.query.mes)
  if (routeMonth !== selectedMonth.value) {
    try {
      await router.replace({
        query: {
          ...route.query,
          mes: selectedMonth.value,
        },
      })
    } catch (error) {
      console.error('Erro ao sincronizar mes na URL:', error)
    }
  }

  await loadDashboardData()
})

function belongsToMonth(date: string, targetMonth: string): boolean {
  return monthKey(date) === targetMonth || (typeof date === 'string' && date.slice(0, 7) === targetMonth)
}

function formatMonthLabel(month: string): string {
  const [year, value] = month.split('-')
  const date = new Date(Number(year), Number(value) - 1, 1)
  const formatted = monthFormatter.format(date)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

const selectedMonthLabel = computed(() => formatMonthLabel(selectedMonth.value))

function prevMonth() {
  selectedMonth.value = dayjs(`${selectedMonth.value}-01`).subtract(1, 'month').format('YYYY-MM')
}

function nextMonth() {
  selectedMonth.value = dayjs(`${selectedMonth.value}-01`).add(1, 'month').format('YYYY-MM')
}

function entriesForMonth(targetMonth: string): number {
  return (transactionsStore.transactions as DashboardTx[]).reduce((sum: number, tx: DashboardTx) => {
    if (!belongsToMonth(tx.date, targetMonth)) return sum
    if (tx.amount_cents <= 0) return sum
    return sum + tx.amount_cents
  }, 0)
}

function expensesForMonth(targetMonth: string): number {
  return (transactionsStore.transactions as DashboardTx[]).reduce((sum: number, tx: DashboardTx) => {
    if (!belongsToMonth(tx.date, targetMonth)) return sum
    if (tx.amount_cents >= 0) return sum
    return sum + Math.abs(tx.amount_cents)
  }, 0)
}

function buildVariation(current: number, previous: number, invert = false) {
  if (previous === 0) {
    if (current === 0) {
      return { label: 'Sem variacao', tone: 'text-muted-foreground' }
    }
    return {
      label: 'Novo no periodo',
      tone: invert ? 'text-red-500' : 'text-emerald-400',
    }
  }

  const deltaPercent = ((current - previous) / previous) * 100
  const tone = invert
    ? (deltaPercent <= 0 ? 'text-emerald-400' : 'text-red-500')
    : (deltaPercent >= 0 ? 'text-emerald-400' : 'text-red-500')

  return {
    label: `${deltaPercent >= 0 ? '+' : ''}${deltaPercent.toFixed(1)}% vs mes anterior`,
    tone,
  }
}

const monthTransactions = computed(() =>
  (transactionsStore.transactions as DashboardTx[]).filter(tx => belongsToMonth(tx.date, selectedMonth.value)),
)

const previousMonth = computed(() =>
  dayjs(`${selectedMonth.value}-01`).subtract(1, 'month').format('YYYY-MM'),
)

const monthEntriesCents = computed(() => entriesForMonth(selectedMonth.value))
const monthExpensesCents = computed(() => expensesForMonth(selectedMonth.value))

const previousMonthEntriesCents = computed(() => entriesForMonth(previousMonth.value))
const previousMonthExpensesCents = computed(() => expensesForMonth(previousMonth.value))

const entriesVariation = computed(() =>
  buildVariation(monthEntriesCents.value, previousMonthEntriesCents.value),
)

const expensesVariation = computed(() =>
  buildVariation(monthExpensesCents.value, previousMonthExpensesCents.value, true),
)

const monthNetCents = computed(() => monthEntriesCents.value - monthExpensesCents.value)
const monthNetVariation = computed(() => {
  const previousNet = previousMonthEntriesCents.value - previousMonthExpensesCents.value
  return buildVariation(monthNetCents.value, previousNet)
})

const balanceTotalCents = computed(() =>
  accountsStore.accounts.reduce((sum: number, account: any) => sum + account.balance_cents, 0),
)

const investedTotalCents = computed(() =>
  investmentPositionsStore.positions.reduce((sum: number, position: any) => sum + (position.invested_cents ?? 0), 0),
)

const openCreditInvoicesByAccount = computed(() =>
  transactionsStore.creditInvoicesByAccount(selectedMonth.value, 'open'),
)

const openInvoiceCount = computed(() => openCreditInvoicesByAccount.value.size)

const openInvoiceTotalCents = computed(() => {
  let total = 0
  for (const transactions of openCreditInvoicesByAccount.value.values()) {
    total += transactions.reduce((sum: number, tx: DashboardTx) => sum + Math.abs(tx.amount_cents), 0)
  }
  return total
})

const unpaidDebitMonth = computed(() =>
  (transactionsStore.transactions as DashboardTx[]).filter((tx: DashboardTx) =>
    belongsToMonth(tx.date, selectedMonth.value)
    && tx.amount_cents < 0
    && tx.payment_method !== 'credit'
    && !tx.recurrentId
    && !tx.paid,
  ),
)

const unpaidDebitMonthCents = computed(() =>
  unpaidDebitMonth.value.reduce((sum: number, tx: DashboardTx) => sum + Math.abs(tx.amount_cents), 0),
)

const recurringPendingExpenses = computed(() =>
  (recurrentsStore.recurrents as DashboardRecurrent[]).filter((rec: DashboardRecurrent) => {
    if (!rec.active || rec.kind !== 'expense') return false
    return !transactionsStore.hasRecurrentTransaction(rec.id, selectedMonth.value)
  }),
)

const recurringPendingExpenseCents = computed(() =>
  recurringPendingExpenses.value.reduce((sum: number, rec: DashboardRecurrent) => sum + Math.abs(rec.amount_cents), 0),
)

const pendingTotalCents = computed(() =>
  openInvoiceTotalCents.value + unpaidDebitMonthCents.value + recurringPendingExpenseCents.value,
)

const pendingCount = computed(() =>
  openInvoiceCount.value + unpaidDebitMonth.value.length + recurringPendingExpenses.value.length,
)

const daysInSelectedMonth = computed(() =>
  dayjs(`${selectedMonth.value}-01`).daysInMonth(),
)

type WeeklyFlow = {
  label: string
  start: number
  end: number
  inCents: number
  outCents: number
  netCents: number
}

const flowByWeek = computed<WeeklyFlow[]>(() => {
  const weekCount = Math.ceil(daysInSelectedMonth.value / 7)
  const buckets = Array.from({ length: weekCount }, (_item, index) => {
    const start = index * 7 + 1
    const end = Math.min(start + 6, daysInSelectedMonth.value)
    return {
      label: `S${index + 1}`,
      start,
      end,
      inCents: 0,
      outCents: 0,
      netCents: 0,
    }
  })

  for (const tx of monthTransactions.value) {
    const day = Number.parseInt(tx.date.slice(8, 10), 10)
    if (!Number.isFinite(day) || day < 1) continue

    const bucketIndex = Math.min(weekCount - 1, Math.floor((day - 1) / 7))
    const bucket = buckets[bucketIndex]
    if (!bucket) continue

    if (tx.amount_cents >= 0) {
      bucket.inCents += tx.amount_cents
    } else {
      bucket.outCents += Math.abs(tx.amount_cents)
    }

    bucket.netCents += tx.amount_cents
  }

  return buckets
})

const hasFlowData = computed(() =>
  flowByWeek.value.some(item => item.inCents > 0 || item.outCents > 0),
)

const flowMaxCents = computed(() => {
  const max = Math.max(
    ...flowByWeek.value.flatMap(item => [item.inCents, item.outCents]),
    0,
  )
  return max <= 0 ? 1 : max
})

const flowColumnsStyle = computed(() => ({
  gridTemplateColumns: `repeat(${Math.max(flowByWeek.value.length, 1)}, minmax(0, 1fr))`,
}))

function flowBarHeight(value: number): string {
  if (value <= 0) return '4%'
  const percentage = (value / flowMaxCents.value) * 100
  return `${Math.max(percentage, 8)}%`
}

const expenseByMethod = computed(() => {
  let credit = 0
  let debit = 0
  let other = 0

  for (const tx of monthTransactions.value) {
    if (tx.amount_cents >= 0) continue

    const amount = Math.abs(tx.amount_cents)
    if (tx.payment_method === 'credit') {
      credit += amount
    } else if (tx.payment_method === 'debit') {
      debit += amount
    } else {
      other += amount
    }
  }

  return {
    credit,
    debit,
    other,
    total: credit + debit + other,
  }
})

const expenseMixGradient = computed(() => {
  const { credit, debit, other, total } = expenseByMethod.value
  if (total <= 0) {
    return 'conic-gradient(#3f3f46 0deg 360deg)'
  }

  const slices: string[] = []
  let start = 0

  const addSlice = (value: number, color: string) => {
    if (value <= 0) return
    const end = start + (value / total) * 360
    slices.push(`${color} ${start}deg ${end}deg`)
    start = end
  }

  addSlice(credit, '#ef4444')
  addSlice(debit, '#f59e0b')
  addSlice(other, '#64748b')

  if (start < 360) {
    slices.push(`#3f3f46 ${start}deg 360deg`)
  }

  return `conic-gradient(${slices.join(', ')})`
})

function percentOf(value: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

function shareOf(value: number, total: number): number {
  if (total <= 0 || value <= 0) return 0
  return (value / total) * 100
}

function progressWidth(value: number, total: number): string {
  const ratio = shareOf(value, total)
  if (ratio <= 0) return '0%'
  return `${Math.max(ratio, 7)}%`
}

function flowTooltip(item: WeeklyFlow): string {
  return [
    `${item.label} (${item.start}-${item.end})`,
    `Entradas: ${formatCentsToBRL(item.inCents)}`,
    `Saidas: ${formatCentsToBRL(-item.outCents)}`,
    `Resultado: ${formatCentsToBRL(item.netCents)}`,
  ].join('\n')
}

const transactionTypeBreakdown = computed(() => {
  let income = 0
  let expense = 0
  let transfer = 0

  for (const tx of monthTransactions.value) {
    const amount = Math.abs(tx.amount_cents)

    if (tx.type === 'income') {
      income += amount
      continue
    }

    if (tx.type === 'transfer') {
      transfer += amount
      continue
    }

    expense += amount
  }

  return {
    income,
    expense,
    transfer,
    total: income + expense + transfer,
  }
})

const transactionTypeItems = computed(() => [
  { key: 'income', label: 'Receitas', value: transactionTypeBreakdown.value.income, color: 'bg-emerald-500' },
  { key: 'expense', label: 'Despesas', value: transactionTypeBreakdown.value.expense, color: 'bg-red-500' },
  { key: 'transfer', label: 'Transferencias', value: transactionTypeBreakdown.value.transfer, color: 'bg-blue-500' },
])

const expensePaymentStatus = computed(() => {
  let paidCents = 0
  let pendingCents = 0
  let paidCount = 0
  let pendingCount = 0

  for (const tx of monthTransactions.value) {
    if (tx.amount_cents >= 0) continue
    const amount = Math.abs(tx.amount_cents)

    if (tx.paid) {
      paidCents += amount
      paidCount += 1
    } else {
      pendingCents += amount
      pendingCount += 1
    }
  }

  return {
    paidCents,
    pendingCents,
    paidCount,
    pendingCount,
    totalCents: paidCents + pendingCents,
  }
})

const expensePaymentItems = computed(() => [
  {
    key: 'paid',
    label: 'Pagas',
    value: expensePaymentStatus.value.paidCents,
    count: expensePaymentStatus.value.paidCount,
    color: 'bg-emerald-500',
  },
  {
    key: 'pending',
    label: 'Pendentes',
    value: expensePaymentStatus.value.pendingCents,
    count: expensePaymentStatus.value.pendingCount,
    color: 'bg-yellow-500',
  },
])

const investmentSummary = computed(() => {
  let totalInvestedCents = 0
  let totalCurrentCents = 0
  let fixedCurrentCents = 0
  let variableCurrentCents = 0

  const items = (investmentPositionsStore.positions as DashboardPosition[])
    .map((position: DashboardPosition) => {
      const investedCents = position.invested_cents ?? position.principal_cents ?? 0
      const currentCents = position.current_value_cents ?? position.invested_cents ?? position.principal_cents ?? 0

      totalInvestedCents += investedCents
      totalCurrentCents += currentCents

      if (position.bucket === 'fixed') {
        fixedCurrentCents += currentCents
      } else {
        variableCurrentCents += currentCents
      }

      const label = position.asset_code?.trim() || position.name?.trim() || 'Posicao'
      return {
        id: position.id,
        label,
        bucket: position.bucket ?? 'variable',
        investedCents,
        currentCents,
        pnlCents: currentCents - investedCents,
      }
    })
    .filter(item => item.currentCents > 0 || item.investedCents > 0)

  const topPositions = [...items]
    .sort((a, b) => b.currentCents - a.currentCents)
    .slice(0, 5)

  return {
    totalInvestedCents,
    totalCurrentCents,
    totalPnlCents: totalCurrentCents - totalInvestedCents,
    fixedCurrentCents,
    variableCurrentCents,
    totalCurrentByBucket: fixedCurrentCents + variableCurrentCents,
    topPositions,
  }
})

const investmentBucketItems = computed(() => [
  {
    key: 'fixed',
    label: 'Renda fixa',
    value: investmentSummary.value.fixedCurrentCents,
    color: 'bg-blue-500',
  },
  {
    key: 'variable',
    label: 'Renda variavel',
    value: investmentSummary.value.variableCurrentCents,
    color: 'bg-cyan-500',
  },
])

function belongsToYear(date: string, targetYear: string): boolean {
  return typeof date === 'string' && date.slice(0, 4) === targetYear
}

const selectedYear = computed(() => selectedMonth.value.slice(0, 4))

const investmentEvents = computed(() =>
  investmentEventsStore.events as DashboardInvestmentEvent[],
)

const investmentEventsForPeriod = computed(() => {
  if (investmentPeriodTab.value === 'all') {
    return investmentEvents.value
  }

  if (investmentPeriodTab.value === 'year') {
    return investmentEvents.value.filter(event => belongsToYear(event.date, selectedYear.value))
  }

  return investmentEvents.value.filter(event => belongsToMonth(event.date, selectedMonth.value))
})

const monthInvestmentEvents = computed(() =>
  investmentEvents.value
    .filter(event => belongsToMonth(event.date, selectedMonth.value))
    .sort((a, b) => (b.date.localeCompare(a.date) || b.id.localeCompare(a.id))),
)

const investmentPeriodSummary = computed(() => {
  let incomingCents = 0
  let outgoingCents = 0
  let incomeCents = 0

  for (const event of investmentEventsForPeriod.value) {
    const amount = Math.abs(event.amount_cents)
    if (event.event_type === 'buy' || event.event_type === 'contribution') {
      incomingCents += amount
      continue
    }

    if (event.event_type === 'income') {
      incomeCents += amount
      continue
    }

    outgoingCents += amount
  }

  return {
    incomingCents,
    outgoingCents,
    incomeCents,
    eventCount: investmentEventsForPeriod.value.length,
    netCents: incomingCents + incomeCents - outgoingCents,
    totalFlowCents: incomingCents + outgoingCents + incomeCents,
  }
})

const investmentPeriodItems = computed(() => [
  {
    key: 'incoming',
    label: 'Aportes e compras',
    value: investmentPeriodSummary.value.incomingCents,
    color: 'bg-blue-500',
  },
  {
    key: 'income',
    label: 'Rendimentos',
    value: investmentPeriodSummary.value.incomeCents,
    color: 'bg-emerald-500',
  },
  {
    key: 'outgoing',
    label: 'Saidas e resgates',
    value: investmentPeriodSummary.value.outgoingCents,
    color: 'bg-red-500',
  },
])

const investmentPeriodDescription = computed(() => {
  if (investmentPeriodTab.value === 'month') return selectedMonthLabel.value
  if (investmentPeriodTab.value === 'year') return selectedYear.value
  return 'Todo o historico'
})

function investmentEventTypeLabel(eventType: DashboardInvestmentEvent['event_type']): string {
  if (eventType === 'buy') return 'Compra'
  if (eventType === 'sell') return 'Venda'
  if (eventType === 'contribution') return 'Aporte'
  if (eventType === 'withdrawal') return 'Resgate'
  if (eventType === 'maturity') return 'Vencimento'
  return 'Rendimento'
}

function investmentEventSignedCents(event: DashboardInvestmentEvent): number {
  if (event.event_type === 'buy' || event.event_type === 'contribution' || event.event_type === 'income') {
    return Math.abs(event.amount_cents)
  }
  return -Math.abs(event.amount_cents)
}

function investmentEventAmountClass(event: DashboardInvestmentEvent): string {
  if (event.event_type === 'income') return 'text-emerald-400'
  if (event.event_type === 'sell' || event.event_type === 'withdrawal' || event.event_type === 'maturity') {
    return 'text-red-500'
  }
  return 'text-blue-500'
}

function investmentPositionLabel(positionId: string): string {
  const position = (investmentPositionsStore.positions as DashboardPosition[])
    .find(item => item.id === positionId)

  if (!position) return 'Posicao'
  return position.asset_code?.trim() || position.name?.trim() || 'Posicao'
}

const dashboardAlerts = computed(() => [
  ...groupedAlerts.value.overdue,
  ...groupedAlerts.value.today,
  ...groupedAlerts.value.next,
].slice(0, 6))

function alertBucketLabel(bucket: AlertBucket): string {
  if (bucket === 'overdue') return 'Atrasado'
  if (bucket === 'today') return 'Hoje'
  return 'Proximo'
}

function alertBucketClass(bucket: AlertBucket): string {
  if (bucket === 'overdue') return 'border-red-500/30 text-red-500'
  if (bucket === 'today') return 'border-yellow-500/30 text-yellow-500'
  return 'border-blue-500/30 text-blue-500'
}

function isIncomeAlert(item: AlertItem): boolean {
  return item.kind === 'recurrent' && item.subtitle.toLowerCase().includes('receita')
}

function formatAlertAmount(item: AlertItem): string {
  if (!item.amountCents) return ''
  return formatCentsToBRL(isIncomeAlert(item) ? item.amountCents : -item.amountCents)
}

function alertAmountClass(item: AlertItem): string {
  return isIncomeAlert(item) ? 'text-emerald-400' : 'text-red-500'
}

function alertIcon(item: AlertItem) {
  if (item.kind === 'invoice_due' || item.kind === 'invoice_closing') {
    return CreditCard
  }
  return BellRing
}

function shortDateLabel(isoDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`
  }
  return isoDate
}

const latestTransactions = computed(() =>
  [...monthTransactions.value]
    .sort((a: DashboardTx, b: DashboardTx) => (b.date.localeCompare(a.date) || b.id.localeCompare(a.id)))
    .slice(0, 12),
)

function getAccountLabel(accountId: number) {
  return accountsStore.accounts.find((account: any) => account.id === accountId)?.label ?? 'Conta'
}

function txDisplayLabel(tx: DashboardTx): string {
  if (tx.installment) {
    return `${tx.installment.product} (${tx.installment.index}/${tx.installment.total})`
  }
  return tx.description || 'Transacao'
}

function txTypeLabel(tx: DashboardTx): string {
  if (tx.type === 'income') return 'Receita'
  if (tx.type === 'transfer') return 'Transferencia'
  return 'Despesa'
}

function txTypeIcon(tx: DashboardTx) {
  if (tx.type === 'income') return ArrowUpRight
  if (tx.type === 'transfer') return Repeat
  return ArrowDownRight
}

function txDateLabel(isoDate: string): string {
  const todayIso = dayjs().format('YYYY-MM-DD')
  const yesterdayIso = dayjs().subtract(1, 'day').format('YYYY-MM-DD')

  if (selectedMonth.value === todayIso.slice(0, 7)) {
    if (isoDate === todayIso) return 'Hoje'
    if (isoDate === yesterdayIso) return 'Ontem'
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`
  }

  return isoDate
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div class="space-y-1">
        <div class="flex items-center gap-3">
          <LayoutDashboard class="h-6 w-6 text-muted-foreground" />
          <h1 class="text-2xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <p class="text-sm text-muted-foreground">
          Visao consolidada de {{ selectedMonthLabel }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Mes anterior" @click="prevMonth">
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <Badge variant="secondary" class="px-3 py-1 text-sm font-medium">
          {{ selectedMonthLabel }}
        </Badge>
        <Button variant="outline" size="icon" aria-label="Proximo mes" @click="nextMonth">
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <template v-if="loading">
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card class="xl:col-span-2">
          <CardContent class="space-y-3 pt-6">
            <Skeleton class="h-4 w-36" />
            <Skeleton class="h-10 w-56" />
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Skeleton class="h-20 w-full" />
              <Skeleton class="h-20 w-full" />
              <Skeleton class="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="space-y-3 pt-6">
            <Skeleton class="h-4 w-28" />
            <Skeleton class="h-8 w-40" />
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-full" />
          </CardContent>
        </Card>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card v-for="item in 4" :key="item">
          <CardContent class="space-y-2 pt-6">
            <Skeleton class="h-4 w-24" />
            <Skeleton class="h-8 w-28" />
          </CardContent>
        </Card>
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card class="xl:col-span-2">
          <CardContent class="space-y-2 pt-6">
            <Skeleton class="h-4 w-40" />
            <Skeleton class="h-56 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent class="space-y-2 pt-6">
            <Skeleton class="h-4 w-32" />
            <Skeleton class="h-44 w-44 rounded-full mx-auto" />
            <Skeleton class="h-6 w-full" />
          </CardContent>
        </Card>
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card class="xl:col-span-2">
          <CardContent class="space-y-2 pt-6">
            <Skeleton class="h-4 w-40" />
            <Skeleton v-for="item in 7" :key="item" class="h-10 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent class="space-y-2 pt-6">
            <Skeleton class="h-4 w-32" />
            <Skeleton v-for="item in 4" :key="item" class="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    </template>

    <template v-else-if="hasFatalLoadError">
      <Card class="border-red-500/30 bg-red-500/5">
        <CardContent class="space-y-4 pt-6">
          <div class="space-y-1">
            <p class="font-semibold text-red-500">Nao foi possivel carregar o dashboard</p>
            <p class="text-sm text-muted-foreground">
              {{ loadErrorMessage || 'Verifique o servidor/API e tente novamente.' }}
            </p>
          </div>
          <Button :disabled="refreshing" @click="loadDashboardData">
            {{ refreshing ? 'Tentando novamente...' : 'Tentar novamente' }}
          </Button>
        </CardContent>
      </Card>
    </template>

    <template v-else>
      <Card
        v-if="hasPartialLoadError"
        class="border-yellow-500/30 bg-yellow-500/5"
      >
        <CardContent class="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="font-semibold text-yellow-500">Dados parciais no dashboard</p>
            <p class="text-sm text-muted-foreground">
              {{ loadErrorMessage }} Os dados visiveis podem estar incompletos.
            </p>
          </div>
          <Button variant="outline" :disabled="refreshing" @click="loadDashboardData">
            {{ refreshing ? 'Atualizando...' : 'Tentar novamente' }}
          </Button>
        </CardContent>
      </Card>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card class="xl:col-span-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
          <CardHeader class="pb-2">
            <CardDescription>Saldo consolidado</CardDescription>
            <CardTitle class="text-3xl md:text-4xl" :class="balanceTotalCents >= 0 ? 'text-emerald-400' : 'text-red-500'">
              {{ formatCentsToBRL(balanceTotalCents) }}
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div class="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
                <p class="text-xs text-muted-foreground">Entradas do mes</p>
                <p class="text-lg font-semibold text-emerald-400">{{ formatCentsToBRL(monthEntriesCents) }}</p>
                <p class="text-[11px]" :class="entriesVariation.tone">{{ entriesVariation.label }}</p>
              </div>

              <div class="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
                <p class="text-xs text-muted-foreground">Saidas do mes</p>
                <p class="text-lg font-semibold text-red-500">{{ formatCentsToBRL(monthExpensesCents) }}</p>
                <p class="text-[11px]" :class="expensesVariation.tone">{{ expensesVariation.label }}</p>
              </div>

              <div class="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
                <p class="text-xs text-muted-foreground">Resultado do mes</p>
                <p class="text-lg font-semibold" :class="monthNetCents >= 0 ? 'text-emerald-400' : 'text-red-500'">
                  {{ formatCentsToBRL(monthNetCents) }}
                </p>
                <p class="text-[11px]" :class="monthNetVariation.tone">{{ monthNetVariation.label }}</p>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <Button as-child size="sm">
                <NuxtLink to="/movimentacoes">Nova movimentacao</NuxtLink>
              </Button>
              <Button as-child variant="outline" size="sm">
                <NuxtLink to="/pagamentos">Ir para pagamentos</NuxtLink>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card class="border-yellow-500/20 bg-gradient-to-br from-card to-yellow-500/5 shadow-sm">
          <CardHeader class="pb-2">
            <CardDescription>Pendencias do mes</CardDescription>
            <CardTitle class="text-3xl text-yellow-500">{{ formatCentsToBRL(pendingTotalCents) }}</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <p class="text-xs text-muted-foreground">{{ pendingCount }} itens em aberto</p>

            <div class="space-y-2 text-sm">
              <div class="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2">
                <div class="flex items-center gap-2 text-muted-foreground">
                  <CreditCard class="h-4 w-4" />
                  Faturas
                </div>
                <span class="font-medium text-red-500">{{ formatCentsToBRL(openInvoiceTotalCents) }}</span>
              </div>

              <div class="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2">
                <div class="flex items-center gap-2 text-muted-foreground">
                  <Clock class="h-4 w-4" />
                  Avulsas
                </div>
                <span class="font-medium text-red-500">{{ formatCentsToBRL(unpaidDebitMonthCents) }}</span>
              </div>

              <div class="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2">
                <div class="flex items-center gap-2 text-muted-foreground">
                  <BellRing class="h-4 w-4" />
                  Recorrentes
                </div>
                <span class="font-medium text-red-500">{{ formatCentsToBRL(recurringPendingExpenseCents) }}</span>
              </div>
            </div>

            <Button as-child variant="outline" class="w-full">
              <NuxtLink to="/pagamentos">Abrir pagamentos</NuxtLink>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <NuxtLink to="/movimentacoes" class="group">
          <Card class="h-full border-border/70 bg-gradient-to-br from-card to-card/80 transition-colors group-hover:border-emerald-500/40">
            <CardContent class="space-y-1 pt-6">
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp class="h-4 w-4" />
                Entradas
              </div>
              <p class="text-2xl font-bold text-emerald-400">{{ formatCentsToBRL(monthEntriesCents) }}</p>
              <p class="text-xs" :class="entriesVariation.tone">{{ entriesVariation.label }}</p>
            </CardContent>
          </Card>
        </NuxtLink>

        <NuxtLink to="/movimentacoes" class="group">
          <Card class="h-full border-border/70 bg-gradient-to-br from-card to-card/80 transition-colors group-hover:border-red-500/40">
            <CardContent class="space-y-1 pt-6">
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingDown class="h-4 w-4" />
                Saidas
              </div>
              <p class="text-2xl font-bold text-red-500">{{ formatCentsToBRL(monthExpensesCents) }}</p>
              <p class="text-xs" :class="expensesVariation.tone">{{ expensesVariation.label }}</p>
            </CardContent>
          </Card>
        </NuxtLink>

        <NuxtLink to="/investimentos" class="group">
          <Card class="h-full border-border/70 bg-gradient-to-br from-card to-card/80 transition-colors group-hover:border-blue-500/40">
            <CardContent class="space-y-1 pt-6">
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <PiggyBank class="h-4 w-4" />
                Investido
              </div>
              <p class="text-2xl font-bold text-blue-500">{{ formatCentsToBRL(investedTotalCents) }}</p>
              <p class="text-xs text-muted-foreground">Total aplicado nas posicoes</p>
            </CardContent>
          </Card>
        </NuxtLink>

        <NuxtLink to="/pagamentos" class="group">
          <Card class="h-full border-border/70 bg-gradient-to-br from-card to-card/80 transition-colors group-hover:border-yellow-500/40">
            <CardContent class="space-y-1 pt-6">
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock class="h-4 w-4" />
                Pendencias
              </div>
              <p class="text-2xl font-bold text-yellow-500">{{ pendingCount }}</p>
              <p class="text-xs text-muted-foreground">Itens ainda nao pagos</p>
            </CardContent>
          </Card>
        </NuxtLink>
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card class="xl:col-span-2">
          <CardHeader>
            <CardTitle class="text-lg">Analises do mes</CardTitle>
            <CardDescription>Graficos de {{ selectedMonthLabel.toLowerCase() }} com leitura numerica</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs v-model="activeChartTab" class="space-y-4">
              <TabsList class="grid w-full grid-cols-3">
                <TabsTrigger value="flow">Fluxo</TabsTrigger>
                <TabsTrigger value="type">Tipos</TabsTrigger>
                <TabsTrigger value="status">Status</TabsTrigger>
              </TabsList>

              <TabsContent value="flow" class="space-y-3">
                <div class="rounded-lg border border-border/70 bg-muted/20 p-4">
                  <template v-if="hasFlowData">
                    <div class="grid h-56 items-end gap-3" :style="flowColumnsStyle">
                      <div
                        v-for="item in flowByWeek"
                        :key="item.label"
                        class="flex h-full min-w-0 flex-col justify-end"
                        :title="flowTooltip(item)"
                      >
                        <div class="flex flex-1 items-end justify-center gap-1">
                          <div
                            class="w-3 rounded-md bg-emerald-500/80 transition-all"
                            :style="{ height: flowBarHeight(item.inCents), opacity: item.inCents ? 1 : 0.25 }"
                          />
                          <div
                            class="w-3 rounded-md bg-red-500/80 transition-all"
                            :style="{ height: flowBarHeight(item.outCents), opacity: item.outCents ? 1 : 0.25 }"
                          />
                        </div>
                        <p class="mt-2 text-center text-[11px] text-muted-foreground">{{ item.label }}</p>
                      </div>
                    </div>
                  </template>

                  <p v-else class="flex h-56 items-center justify-center text-sm text-muted-foreground">
                    Sem dados para montar o grafico de fluxo.
                  </p>
                </div>

                <div class="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    Entrada total: <span class="font-semibold text-emerald-400">{{ formatCentsToBRL(monthEntriesCents) }}</span>
                  </div>
                  <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    Saida total: <span class="font-semibold text-red-500">{{ formatCentsToBRL(monthExpensesCents) }}</span>
                  </div>
                  <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    Resultado:
                    <span class="font-semibold" :class="monthNetCents >= 0 ? 'text-emerald-400' : 'text-red-500'">
                      {{ formatCentsToBRL(monthNetCents) }}
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="type" class="space-y-3">
                <div v-if="transactionTypeBreakdown.total > 0" class="space-y-3">
                  <div
                    v-for="item in transactionTypeItems"
                    :key="item.key"
                    class="rounded-md border border-border/60 bg-muted/20 px-3 py-3"
                  >
                    <div class="mb-2 flex items-center justify-between text-sm">
                      <span class="text-muted-foreground">{{ item.label }}</span>
                      <span class="font-medium">
                        {{ percentOf(item.value, transactionTypeBreakdown.total) }} - {{ formatCentsToBRL(item.value) }}
                      </span>
                    </div>
                    <div class="h-2 rounded-full bg-muted/60">
                      <div
                        class="h-2 rounded-full transition-all"
                        :class="item.color"
                        :style="{ width: progressWidth(item.value, transactionTypeBreakdown.total) }"
                      />
                    </div>
                  </div>
                </div>

                <p v-else class="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  Sem dados para analisar tipos de movimentacao.
                </p>
              </TabsContent>

              <TabsContent value="status" class="space-y-3">
                <div v-if="expensePaymentStatus.totalCents > 0" class="space-y-3">
                  <div
                    v-for="item in expensePaymentItems"
                    :key="item.key"
                    class="rounded-md border border-border/60 bg-muted/20 px-3 py-3"
                  >
                    <div class="mb-2 flex items-center justify-between text-sm">
                      <span class="text-muted-foreground">
                        {{ item.label }} ({{ item.count }})
                      </span>
                      <span class="font-medium">
                        {{ percentOf(item.value, expensePaymentStatus.totalCents) }} - {{ formatCentsToBRL(-item.value) }}
                      </span>
                    </div>
                    <div class="h-2 rounded-full bg-muted/60">
                      <div
                        class="h-2 rounded-full transition-all"
                        :class="item.color"
                        :style="{ width: progressWidth(item.value, expensePaymentStatus.totalCents) }"
                      />
                    </div>
                  </div>
                </div>

                <p v-else class="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  Sem despesas no mes para analisar status de pagamento.
                </p>
              </TabsContent>

            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-lg">Distribuicao das saidas</CardTitle>
            <CardDescription>Credito, debito e outras despesas no mes</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex justify-center">
              <div class="relative size-44 rounded-full" :style="{ background: expenseMixGradient }">
                <div class="absolute inset-[22%] rounded-full border border-border/70 bg-card" />
                <div class="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                  <p class="text-[11px] text-muted-foreground">Total</p>
                  <p class="text-sm font-semibold">{{ formatCentsToBRL(expenseByMethod.total) }}</p>
                </div>
              </div>
            </div>

            <div class="space-y-2 text-sm">
              <div class="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <div class="flex items-center gap-2">
                  <span class="h-2.5 w-2.5 rounded-full bg-red-500" />
                  Credito
                </div>
                <span class="font-medium">
                  {{ percentOf(expenseByMethod.credit, expenseByMethod.total) }} - {{ formatCentsToBRL(-expenseByMethod.credit) }}
                </span>
              </div>

              <div class="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <div class="flex items-center gap-2">
                  <span class="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  Debito
                </div>
                <span class="font-medium">
                  {{ percentOf(expenseByMethod.debit, expenseByMethod.total) }} - {{ formatCentsToBRL(-expenseByMethod.debit) }}
                </span>
              </div>

              <div class="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <div class="flex items-center gap-2">
                  <span class="h-2.5 w-2.5 rounded-full bg-slate-500" />
                  Outras
                </div>
                <span class="font-medium">
                  {{ percentOf(expenseByMethod.other, expenseByMethod.total) }} - {{ formatCentsToBRL(-expenseByMethod.other) }}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card class="border-blue-500/20 bg-gradient-to-br from-card via-card to-blue-500/5 shadow-sm">
        <CardHeader class="gap-3">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle class="text-lg">Analise de investimentos</CardTitle>
              <CardDescription>
                Mes, ano e todo o tempo com lancamentos exibidos apenas para {{ selectedMonthLabel.toLowerCase() }}
              </CardDescription>
            </div>

            <Tabs v-model="investmentPeriodTab" class="w-full md:w-auto">
              <TabsList class="grid w-full grid-cols-3 md:w-[320px]">
                <TabsTrigger value="month">Mes</TabsTrigger>
                <TabsTrigger value="year">Ano</TabsTrigger>
                <TabsTrigger value="all">Todo tempo</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div class="space-y-3 xl:col-span-2">
              <div class="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  Periodo:
                  <span class="font-semibold text-foreground">{{ investmentPeriodDescription }}</span>
                </div>
                <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  Entradas:
                  <span class="font-semibold text-blue-500">{{ formatCentsToBRL(investmentPeriodSummary.incomingCents) }}</span>
                </div>
                <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  Saidas:
                  <span class="font-semibold text-red-500">{{ formatCentsToBRL(-investmentPeriodSummary.outgoingCents) }}</span>
                </div>
                <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  Resultado:
                  <span class="font-semibold" :class="investmentPeriodSummary.netCents >= 0 ? 'text-emerald-400' : 'text-red-500'">
                    {{ formatCentsToBRL(investmentPeriodSummary.netCents) }}
                  </span>
                </div>
              </div>

              <div class="rounded-lg border border-border/70 bg-muted/20 p-4">
                <div class="mb-3 flex items-center justify-between">
                  <p class="text-sm font-medium">Fluxo por tipo no periodo</p>
                  <span class="text-xs text-muted-foreground">{{ investmentPeriodSummary.eventCount }} lancamento(s)</span>
                </div>

                <div v-if="investmentPeriodSummary.totalFlowCents > 0" class="space-y-3">
                  <div
                    v-for="item in investmentPeriodItems"
                    :key="item.key"
                    class="rounded-md border border-border/60 bg-background/40 px-3 py-3"
                  >
                    <div class="mb-2 flex items-center justify-between text-sm">
                      <span class="text-muted-foreground">{{ item.label }}</span>
                      <span class="font-medium">
                        {{ percentOf(item.value, investmentPeriodSummary.totalFlowCents) }} - {{ formatCentsToBRL(item.value) }}
                      </span>
                    </div>
                    <div class="h-2 rounded-full bg-muted/60">
                      <div
                        class="h-2 rounded-full transition-all"
                        :class="item.color"
                        :style="{ width: progressWidth(item.value, investmentPeriodSummary.totalFlowCents) }"
                      />
                    </div>
                  </div>
                </div>

                <p v-else class="py-8 text-center text-sm text-muted-foreground">
                  Sem lancamentos de investimentos no periodo selecionado.
                </p>
              </div>
            </div>

            <div class="space-y-3">
              <div class="rounded-lg border border-border/70 bg-muted/20 p-4">
                <p class="mb-3 text-sm font-medium">Composicao atual da carteira</p>
                <div v-if="investmentSummary.totalCurrentByBucket > 0" class="space-y-3">
                  <div
                    v-for="item in investmentBucketItems"
                    :key="item.key"
                    class="rounded-md border border-border/60 bg-background/40 px-3 py-3"
                  >
                    <div class="mb-2 flex items-center justify-between text-sm">
                      <span class="text-muted-foreground">{{ item.label }}</span>
                      <span class="font-medium">
                        {{ percentOf(item.value, investmentSummary.totalCurrentByBucket) }} - {{ formatCentsToBRL(item.value) }}
                      </span>
                    </div>
                    <div class="h-2 rounded-full bg-muted/60">
                      <div
                        class="h-2 rounded-full transition-all"
                        :class="item.color"
                        :style="{ width: progressWidth(item.value, investmentSummary.totalCurrentByBucket) }"
                      />
                    </div>
                  </div>
                </div>
                <p v-else class="py-8 text-center text-sm text-muted-foreground">
                  Carteira sem valores atuais para compor o grafico.
                </p>
              </div>

              <div class="rounded-lg border border-border/70 bg-muted/20 p-4">
                <p class="mb-3 text-sm font-medium">Top posicoes por valor atual</p>
                <div v-if="investmentSummary.topPositions.length" class="space-y-2">
                  <div
                    v-for="item in investmentSummary.topPositions"
                    :key="item.id"
                    class="rounded-md border border-border/60 bg-background/40 px-3 py-2"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <p class="truncate text-sm font-medium">{{ item.label }}</p>
                      <p class="shrink-0 text-sm font-medium text-cyan-500">{{ formatCentsToBRL(item.currentCents) }}</p>
                    </div>
                    <p class="mt-1 text-xs" :class="item.pnlCents >= 0 ? 'text-emerald-400' : 'text-red-500'">
                      Resultado: {{ formatCentsToBRL(item.pnlCents) }}
                    </p>
                  </div>
                </div>
                <p v-else class="py-8 text-center text-sm text-muted-foreground">
                  Sem posicoes para exibir ranking.
                </p>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-border/70 bg-muted/20 p-4">
            <div class="mb-3 flex items-center justify-between">
              <p class="text-sm font-medium">Lancamentos de investimentos do mes</p>
              <span class="text-xs text-muted-foreground">{{ selectedMonthLabel }}</span>
            </div>

            <div v-if="monthInvestmentEvents.length" class="space-y-2">
              <div
                v-for="event in monthInvestmentEvents.slice(0, 10)"
                :key="event.id"
                class="rounded-md border border-border/60 bg-background/40 px-3 py-2"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium">{{ investmentPositionLabel(event.positionId) }}</p>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      {{ shortDateLabel(event.date) }} - {{ investmentEventTypeLabel(event.event_type) }}
                    </p>
                  </div>
                  <span class="text-sm font-semibold" :class="investmentEventAmountClass(event)">
                    {{ formatCentsToBRL(investmentEventSignedCents(event)) }}
                  </span>
                </div>
              </div>
            </div>

            <p v-else class="py-8 text-center text-sm text-muted-foreground">
              Nenhum lancamento de investimento em {{ selectedMonthLabel.toLowerCase() }}.
            </p>
          </div>
        </CardContent>
      </Card>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card class="xl:col-span-2">
          <CardHeader class="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle class="text-lg">Ultimas movimentacoes</CardTitle>
              <CardDescription>Lancamentos mais recentes de {{ selectedMonthLabel.toLowerCase() }}</CardDescription>
            </div>
            <Button as-child variant="ghost" size="sm">
              <NuxtLink to="/movimentacoes">Ver tudo</NuxtLink>
            </Button>
          </CardHeader>
          <CardContent>
            <Table v-if="latestTransactions.length">
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Movimentacao</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead class="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="tx in latestTransactions" :key="tx.id">
                  <TableCell>{{ txDateLabel(tx.date) }}</TableCell>
                  <TableCell>
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/30">
                        <component :is="txTypeIcon(tx)" class="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <div class="min-w-0">
                        <p class="truncate font-medium">{{ txDisplayLabel(tx) }}</p>
                        <p class="truncate text-xs text-muted-foreground">{{ getAccountLabel(tx.accountId) }} - {{ txTypeLabel(tx) }}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge v-if="tx.payment_method === 'credit'" variant="secondary">Credito</Badge>
                    <Badge v-else-if="tx.payment_method === 'debit'" variant="secondary">Debito</Badge>
                    <span v-else class="text-xs text-muted-foreground">-</span>
                  </TableCell>
                  <TableCell>
                    <Badge v-if="tx.paid" variant="outline" class="border-green-500/30 text-green-500">Pago</Badge>
                    <Badge v-else variant="outline" class="border-yellow-500/30 text-yellow-500">Pendente</Badge>
                  </TableCell>
                  <TableCell class="text-right font-medium" :class="tx.amount_cents < 0 ? 'text-red-500' : 'text-emerald-400'">
                    {{ formatCentsToBRL(tx.amount_cents) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <p v-else class="py-10 text-center text-muted-foreground">
              Nenhuma movimentacao encontrada para {{ selectedMonthLabel.toLowerCase() }}.
            </p>
          </CardContent>
        </Card>

        <Card class="h-max">
          <CardHeader>
            <CardTitle class="text-lg">Proximos alertas</CardTitle>
            <CardDescription>{{ counts.total }} alerta(s) no periodo</CardDescription>
          </CardHeader>
          <CardContent class="space-y-2">
            <template v-if="dashboardAlerts.length">
              <div
                v-for="alert in dashboardAlerts"
                :key="alert.id"
                class="rounded-md border border-border/70 bg-muted/20 px-3 py-2"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <component :is="alertIcon(alert)" class="h-4 w-4 text-muted-foreground" />
                      <p class="truncate text-sm font-medium">{{ alert.title }}</p>
                    </div>
                    <p class="mt-1 truncate text-xs text-muted-foreground">
                      {{ alert.accountLabel }} - {{ alert.subtitle }}
                    </p>
                  </div>

                  <Badge variant="outline" class="shrink-0 text-[10px]" :class="alertBucketClass(alert.bucket)">
                    {{ alertBucketLabel(alert.bucket) }}
                  </Badge>
                </div>

                <div class="mt-2 flex items-center justify-between text-xs">
                  <span class="text-muted-foreground">{{ shortDateLabel(alert.targetDate) }}</span>
                  <span v-if="alert.amountCents" :class="alertAmountClass(alert)">
                    {{ formatAlertAmount(alert) }}
                  </span>
                </div>
              </div>

              <Button as-child variant="ghost" class="w-full">
                <NuxtLink to="/alertas">Abrir central de alertas</NuxtLink>
              </Button>
            </template>

            <p v-else class="py-8 text-center text-sm text-muted-foreground">
              Nenhum alerta pendente para este periodo.
            </p>
          </CardContent>
        </Card>
      </div>
    </template>
  </div>
</template>

