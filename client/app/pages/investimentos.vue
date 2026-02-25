<script setup lang="ts">
import { CandlestickChart, Plus, MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-vue-next'
import { useAccountsStore } from '~/stores/useAccounts'
import { useInvestmentPositionsStore } from '~/stores/useInvestmentPositions'
import { useInvestmentEventsStore } from '~/stores/useInvestmentEvents'
import { useAppToast } from '~/composables/useAppToast'
import { parseBRLToCents, formatCentsToBRL } from '~/utils/money'
import { nowISO } from '~/utils/dates'
import type { InvestmentPosition, InvestmentEvent } from '~/schemas/zod-schemas'

const accountsStore = useAccountsStore()
const positionsStore = useInvestmentPositionsStore()
const eventsStore = useInvestmentEventsStore()
const appToast = useAppToast()

const loading = ref(true)
const refreshing = ref(false)
const loadFailedSources = ref<string[]>([])
const hasSuccessfulLoad = ref(false)
const activeBucket = ref<'variable' | 'fixed'>('variable')

const sourceLoaders = [
  { label: 'contas', load: () => accountsStore.loadAccounts() },
  { label: 'posicoes de investimentos', load: () => positionsStore.loadPositions() },
  { label: 'eventos de investimentos', load: () => eventsStore.loadEvents() },
]

const positionDialogOpen = ref(false)
const eventDialogOpen = ref(false)
const positionViewDialogOpen = ref(false)
const eventViewDialogOpen = ref(false)

const editingPosition = ref<InvestmentPosition | null>(null)
const editingEvent = ref<InvestmentEvent | null>(null)
const viewingPosition = ref<InvestmentPosition | null>(null)
const viewingEvent = ref<InvestmentEvent | null>(null)

const confirmDeleteOpen = ref(false)
const deleteTarget = ref<{ type: 'position' | 'event'; id: string; label: string } | null>(null)

const positionForm = reactive({
  accountId: null as number | null,
  bucket: 'variable' as 'variable' | 'fixed',
  investment_type: 'fii' as InvestmentPosition['investment_type'],
  asset_code: '',
  name: '',
  issuer: '',
  indexer: '' as '' | 'CDI' | 'IPCA' | 'PRE' | 'SELIC' | 'OUTRO',
  rate_mode: 'pct_cdi' as 'annual_percent' | 'pct_cdi',
  rate_percent: '',
  maturity_date: '',
  liquidity: '' as '' | 'D0' | 'D1' | 'NO_VENCIMENTO' | 'OUTRA',
})

const eventForm = reactive({
  positionId: '',
  date: nowISO(),
  event_type: 'buy' as 'buy' | 'sell' | 'income' | 'contribution' | 'withdrawal' | 'maturity',
  quantity: '',
  unit_price: '',
  amount: '',
  fees: '',
  note: '',
})

const hasFatalLoadError = computed(() =>
  loadFailedSources.value.length === sourceLoaders.length && !hasSuccessfulLoad.value,
)

const hasPartialLoadError = computed(() =>
  loadFailedSources.value.length > 0 && !hasFatalLoadError.value,
)

const loadErrorMessage = computed(() => {
  if (!loadFailedSources.value.length) return ''
  return `Falha ao carregar: ${loadFailedSources.value.join(', ')}.`
})

async function loadPageData() {
  const firstLoad = !hasSuccessfulLoad.value && !refreshing.value
  if (firstLoad) {
    loading.value = true
  } else {
    refreshing.value = true
  }

  try {
    const results = await Promise.allSettled(sourceLoaders.map(item => item.load()))
    const failed = new Set<string>()
    let anySuccess = false

    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        anySuccess = true
        continue
      }

      const source = sourceLoaders[index]
      if (!source) continue
      failed.add(source.label)
      console.error(`Erro ao carregar ${source.label}:`, result.reason)
    }

    const positionsLoaded = results[1]?.status === 'fulfilled'
    const eventsLoaded = results[2]?.status === 'fulfilled'
    if (positionsLoaded && eventsLoaded) {
      try {
        // Recalcula posicoes para manter os totais consistentes com os eventos.
        for (const position of positionsStore.positions) {
          await eventsStore.recomputePosition(position.id)
        }
      } catch (error) {
        failed.add('recalculo de investimentos')
        console.error('Erro ao recalcular posicoes:', error)
      }
    }

    loadFailedSources.value = [...failed]
    if (anySuccess) {
      hasSuccessfulLoad.value = true
    }
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

onMounted(async () => {
  await loadPageData()
})

const investmentTypeOptions = [
  { label: 'FII', value: 'fii', bucket: 'variable' },
  { label: 'Criptomoeda', value: 'cripto', bucket: 'variable' },
  { label: 'CDB', value: 'cdb', bucket: 'fixed' },
  { label: 'CDI', value: 'cdi', bucket: 'fixed' },
  { label: 'LCI', value: 'lci', bucket: 'fixed' },
  { label: 'LCA', value: 'lca', bucket: 'fixed' },
  { label: 'Tesouro Direto', value: 'tesouro', bucket: 'fixed' },
  { label: 'Caixinha', value: 'caixinha', bucket: 'fixed' },
  { label: 'Outro', value: 'outro', bucket: 'fixed' },
] as const

const eventTypeOptionsVariable = [
  { label: 'Compra', value: 'buy' },
  { label: 'Venda', value: 'sell' },
  { label: 'Rendimento', value: 'income' },
] as const

const eventTypeOptionsFixed = [
  { label: 'Aporte', value: 'contribution' },
  { label: 'Resgate', value: 'withdrawal' },
  { label: 'Rendimento', value: 'income' },
  { label: 'Vencimento', value: 'maturity' },
] as const

const filteredTypes = computed(() =>
  investmentTypeOptions.filter(t => t.bucket === positionForm.bucket),
)

const requiresAssetCode = computed(() =>
  positionForm.investment_type !== 'caixinha',
)

const positionDialogTitle = computed(() =>
  editingPosition.value ? 'Editar Posicao' : 'Nova Posicao',
)

const eventDialogTitle = computed(() =>
  editingEvent.value ? 'Editar Lancamento' : 'Novo Lancamento',
)

const editingPositionHasEvents = computed(() =>
  editingPosition.value ? positionHasEvents(editingPosition.value.id) : false,
)

const variablePositions = computed(() =>
  positionsStore.positions.filter(p => p.bucket === 'variable'),
)

const fixedPositions = computed(() =>
  positionsStore.positions.filter(p => p.bucket === 'fixed'),
)

const selectedPosition = computed(() =>
  positionsStore.positions.find(p => p.id === eventForm.positionId),
)

const eventTypeOptions = computed(() =>
  {
    const position = selectedPosition.value
    if (position?.bucket === 'fixed') {
      if (position.investment_type === 'caixinha') {
        return eventTypeOptionsFixed.filter(opt => opt.value !== 'maturity')
      }
      return eventTypeOptionsFixed
    }
    return eventTypeOptionsVariable
  },
)

const filteredEvents = computed(() =>
  eventsStore.events
    .filter(e => {
      const position = positionsStore.positions.find(p => p.id === e.positionId)
      return activeBucket.value === 'variable'
        ? position?.bucket === 'variable'
        : position?.bucket === 'fixed'
    })
    .sort((a, b) => b.date.localeCompare(a.date)),
)

watch(() => positionForm.bucket, (bucket) => {
  positionForm.investment_type = bucket === 'variable' ? 'fii' : 'cdb'
})

watch(() => positionForm.investment_type, (type) => {
  if (type === 'caixinha') {
    positionForm.asset_code = ''
  }
})

watch(() => eventForm.positionId, () => {
  eventForm.event_type = selectedPosition.value?.bucket === 'fixed' ? 'contribution' : 'buy'
})

watch(() => [eventForm.quantity, eventForm.unit_price], () => {
  if (!selectedPosition.value || selectedPosition.value.bucket !== 'variable') return
  if (!eventForm.quantity || !eventForm.unit_price) return

  const qty = Number(eventForm.quantity.replace(',', '.'))
  if (!Number.isFinite(qty) || qty <= 0) return
  const cents = parseBRLToCents(eventForm.unit_price)
  eventForm.amount = formatCentsToBRL(Math.round(qty * cents))
})

function getAccountLabel(accountId: number) {
  return accountsStore.accounts.find(a => a.id === accountId)?.label ?? '—'
}

function getPositionLabel(positionId: string) {
  const position = positionsStore.positions.find(p => p.id === positionId)
  if (!position) return '—'
  return getPositionDisplay(position)
}

function getPositionDisplay(position: InvestmentPosition) {
  if (position.investment_type === 'caixinha') {
    return position.name?.trim() || 'Caixinha'
  }
  return position.name?.trim() ? `${position.asset_code} · ${position.name}` : position.asset_code
}

function getInvestmentTypeLabel(type: InvestmentPosition['investment_type']) {
  return investmentTypeOptions.find(opt => opt.value === type)?.label ?? type
}

function getEventTypeLabel(type: InvestmentEvent['event_type']) {
  const all = [...eventTypeOptionsVariable, ...eventTypeOptionsFixed]
  return all.find(opt => opt.value === type)?.label ?? type
}

function isOutflowEventType(type: InvestmentEvent['event_type']) {
  return type === 'sell' || type === 'withdrawal' || type === 'maturity'
}

function getEventValueColorClass(type: InvestmentEvent['event_type']) {
  if (type === 'income') return 'text-blue-500'
  return isOutflowEventType(type) ? 'text-red-500' : 'text-green-500'
}

function formatCentsToInput(cents?: number) {
  if (cents == null) return ''
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function positionHasEvents(positionId: string) {
  return eventsStore.events.some(event => event.positionId === positionId)
}

function getPositionEventsCount(positionId: string) {
  return eventsStore.events.filter(event => event.positionId === positionId).length
}

function getEventSignedValueCents(event: InvestmentEvent) {
  if (event.event_type === 'buy' || event.event_type === 'contribution' || event.event_type === 'income') {
    return Math.abs(event.amount_cents)
  }
  if (event.event_type === 'sell' || event.event_type === 'withdrawal' || event.event_type === 'maturity') {
    return -Math.abs(event.amount_cents)
  }
  return 0
}

const viewingPositionEvents = computed(() => {
  if (!viewingPosition.value) return [] as InvestmentEvent[]
  return eventsStore.events
    .filter(event => event.positionId === viewingPosition.value!.id)
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)))
})

const viewingPositionTimeline = computed(() => {
  const position = viewingPosition.value
  if (!position) {
    return [] as Array<{
      event: InvestmentEvent
      signedValueCents: number
      balanceCents: number
    }>
  }

  if (position.bucket === 'variable') {
    let quantity = 0
    let totalCostCents = 0

    return viewingPositionEvents.value.map((event) => {
      const signedValueCents = getEventSignedValueCents(event)

      if (event.event_type === 'buy') {
        const qty = event.quantity ?? 0
        const buyCost = Math.abs(event.amount_cents) + (event.fees_cents ?? 0)
        quantity += qty
        totalCostCents += buyCost
      } else if (event.event_type === 'sell') {
        const qty = event.quantity ?? 0
        if (qty > 0 && quantity > 0) {
          const avgCost = totalCostCents / quantity
          const costReduction = Math.round(avgCost * qty)
          totalCostCents = Math.max(0, totalCostCents - costReduction)
          quantity = Math.max(0, quantity - qty)
        }
      }

      return {
        event,
        signedValueCents,
        balanceCents: Math.max(0, totalCostCents),
      }
    })
  }

  let running = 0
  return viewingPositionEvents.value.map((event) => {
    const signedValueCents = getEventSignedValueCents(event)
    running += signedValueCents
    return {
      event,
      signedValueCents,
      balanceCents: Math.max(0, running),
    }
  })
})

const viewingCaixinhaSummary = computed(() => {
  let contributionsCents = 0
  let incomeCents = 0
  let outflowCents = 0

  for (const event of viewingPositionEvents.value) {
    if (event.event_type === 'contribution') {
      contributionsCents += Math.abs(event.amount_cents)
      continue
    }
    if (event.event_type === 'income') {
      incomeCents += Math.abs(event.amount_cents)
      continue
    }
    if (event.event_type === 'withdrawal' || event.event_type === 'maturity') {
      outflowCents += Math.abs(event.amount_cents)
    }
  }

  return {
    contributionsCents,
    incomeCents,
    outflowCents,
  }
})

const viewingVariableSummary = computed(() => {
  let buyCents = 0
  let sellCents = 0
  let incomeCents = 0

  for (const event of viewingPositionEvents.value) {
    if (event.event_type === 'buy') {
      buyCents += Math.abs(event.amount_cents)
      continue
    }
    if (event.event_type === 'sell') {
      sellCents += Math.abs(event.amount_cents)
      continue
    }
    if (event.event_type === 'income') {
      incomeCents += Math.abs(event.amount_cents)
    }
  }

  return {
    buyCents,
    sellCents,
    incomeCents,
  }
})

const showDetailedEvolution = computed(() =>
  !!viewingPosition.value && (viewingPosition.value.investment_type === 'caixinha' || viewingPosition.value.bucket === 'variable'),
)

const viewingTimelineTitle = computed(() =>
  viewingPosition.value?.investment_type === 'caixinha'
    ? 'Evolucao da Caixinha'
    : 'Evolucao da Posicao',
)

const timelineChartData = computed(() => {
  const values = viewingPositionTimeline.value.map(item => item.balanceCents)
  if (!values.length) return { points: '', min: 0, max: 0 }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const width = 620
  const height = 150
  const padX = 14
  const padY = 10
  const step = values.length > 1 ? (width - padX * 2) / (values.length - 1) : 0
  const range = max - min || 1

  const points = values
    .map((value, index) => {
      const x = padX + index * step
      const y = padY + (height - padY * 2) * (1 - (value - min) / range)
      return `${x},${y}`
    })
    .join(' ')

  return { points, min, max }
})

const timelineStartDate = computed(() =>
  viewingPositionTimeline.value[0]?.event.date ?? '—',
)

const timelineEndDate = computed(() =>
  viewingPositionTimeline.value[viewingPositionTimeline.value.length - 1]?.event.date ?? '—',
)

function resetPositionForm() {
  positionForm.accountId = null
  positionForm.bucket = 'variable'
  positionForm.investment_type = 'fii'
  positionForm.asset_code = ''
  positionForm.name = ''
  positionForm.issuer = ''
  positionForm.indexer = ''
  positionForm.rate_mode = 'pct_cdi'
  positionForm.rate_percent = ''
  positionForm.maturity_date = ''
  positionForm.liquidity = ''
}

function resetEventForm() {
  eventForm.positionId = ''
  eventForm.date = nowISO()
  eventForm.event_type = 'buy'
  eventForm.quantity = ''
  eventForm.unit_price = ''
  eventForm.amount = ''
  eventForm.fees = ''
  eventForm.note = ''
}

function openNewPosition() {
  editingPosition.value = null
  resetPositionForm()
  positionDialogOpen.value = true
}

function openEditPosition(position: InvestmentPosition) {
  editingPosition.value = position
  positionForm.accountId = position.accountId
  positionForm.bucket = position.bucket
  positionForm.investment_type = position.investment_type
  positionForm.asset_code = position.investment_type === 'caixinha' ? '' : position.asset_code
  positionForm.name = position.name ?? ''
  positionForm.issuer = position.metadata?.issuer ?? ''
  positionForm.indexer = position.metadata?.indexer ?? ''
  positionForm.rate_mode = position.metadata?.rate_mode ?? 'pct_cdi'
  positionForm.rate_percent = position.metadata?.rate_percent != null
    ? String(position.metadata.rate_percent).replace('.', ',')
    : ''
  positionForm.maturity_date = position.metadata?.maturity_date ?? ''
  positionForm.liquidity = position.metadata?.liquidity ?? ''
  positionDialogOpen.value = true
}

function openViewPosition(position: InvestmentPosition) {
  viewingPosition.value = position
  positionViewDialogOpen.value = true
}

function openNewEvent() {
  editingEvent.value = null
  resetEventForm()
  eventDialogOpen.value = true
}

function openEditEvent(event: InvestmentEvent) {
  editingEvent.value = event
  eventForm.positionId = event.positionId
  eventForm.date = event.date
  eventForm.event_type = event.event_type
  eventForm.quantity = event.quantity != null ? String(event.quantity).replace('.', ',') : ''
  eventForm.unit_price = formatCentsToInput(event.unit_price_cents)
  eventForm.amount = formatCentsToInput(event.amount_cents)
  eventForm.fees = formatCentsToInput(event.fees_cents)
  eventForm.note = event.note ?? ''
  eventDialogOpen.value = true
}

function openViewEvent(event: InvestmentEvent) {
  viewingEvent.value = event
  eventViewDialogOpen.value = true
}

function requestDeletePosition(position: InvestmentPosition) {
  deleteTarget.value = {
    type: 'position',
    id: position.id,
    label: getPositionDisplay(position),
  }
  confirmDeleteOpen.value = true
}

function requestDeleteEvent(event: InvestmentEvent) {
  deleteTarget.value = {
    type: 'event',
    id: event.id,
    label: `${getPositionLabel(event.positionId)} · ${event.date}`,
  }
  confirmDeleteOpen.value = true
}

async function deletePositionWithEvents(positionId: string) {
  const relatedEvents = eventsStore.events.filter(event => event.positionId === positionId)
  for (const event of relatedEvents) {
    await eventsStore.deleteEvent(event.id)
  }
  await positionsStore.deletePosition(positionId)
}

async function confirmDelete() {
  if (!deleteTarget.value) return

  try {
    if (deleteTarget.value.type === 'position') {
      await deletePositionWithEvents(deleteTarget.value.id)
      appToast.success({ title: 'Posicao excluida' })
    } else {
      await eventsStore.deleteEvent(deleteTarget.value.id)
      appToast.success({ title: 'Lancamento excluido' })
    }
  } catch (e: any) {
    appToast.error({
      title: 'Erro ao excluir',
      description: e.message || 'Nao foi possivel excluir',
    })
  } finally {
    confirmDeleteOpen.value = false
    deleteTarget.value = null
  }
}

watch(positionDialogOpen, (open) => {
  if (!open) {
    editingPosition.value = null
    resetPositionForm()
  }
})

watch(eventDialogOpen, (open) => {
  if (!open) {
    editingEvent.value = null
    resetEventForm()
  }
})

async function submitPosition() {
  try {
    if (!positionForm.accountId) throw new Error('Selecione uma conta')
    if (requiresAssetCode.value && !positionForm.asset_code.trim()) {
      throw new Error('Informe o codigo')
    }

    const normalizedCode = requiresAssetCode.value
      ? positionForm.asset_code.trim().toUpperCase()
      : 'CAIXINHA'

    if (editingPosition.value && editingPositionHasEvents.value) {
      if (editingPosition.value.accountId !== positionForm.accountId) {
        throw new Error('Nao e possivel alterar a conta de uma posicao com lancamentos')
      }
      if (editingPosition.value.bucket !== positionForm.bucket) {
        throw new Error('Nao e possivel alterar o grupo de uma posicao com lancamentos')
      }
    }

    if (positionForm.bucket === 'variable') {
      const duplicate = positionsStore.positions.find(p =>
        p.id !== editingPosition.value?.id
        && p.accountId === positionForm.accountId
        && p.bucket === 'variable'
        && p.investment_type === positionForm.investment_type
        && p.asset_code.toUpperCase() === normalizedCode,
      )
      if (duplicate) throw new Error('Ja existe posicao desse ativo para essa conta')
    }

    const payload = {
      accountId: positionForm.accountId,
      bucket: positionForm.bucket,
      investment_type: positionForm.investment_type,
      asset_code: normalizedCode,
      name: positionForm.bucket === 'fixed' ? (positionForm.name.trim() || undefined) : undefined,
      metadata: positionForm.bucket === 'fixed'
        ? {
            issuer: positionForm.issuer || undefined,
            indexer: positionForm.indexer || undefined,
            rate_mode: positionForm.rate_percent ? positionForm.rate_mode : undefined,
            rate_percent: positionForm.rate_percent ? Number(positionForm.rate_percent.replace(',', '.')) : undefined,
            maturity_date: positionForm.maturity_date || undefined,
            liquidity: positionForm.liquidity || undefined,
          }
        : undefined,
    }

    if (editingPosition.value) {
      await positionsStore.updatePosition(editingPosition.value.id, payload)
      appToast.success({ title: 'Posicao atualizada' })
    } else {
      await positionsStore.addPosition({
        ...payload,
        is_active: true,
        invested_cents: 0,
      })
      appToast.success({ title: 'Posicao criada' })
    }

    resetPositionForm()
    positionDialogOpen.value = false
  } catch (e: any) {
    appToast.error({
      title: editingPosition.value ? 'Erro ao atualizar posicao' : 'Erro ao criar posicao',
      description: e.message,
    })
  }
}

async function submitEvent() {
  try {
    if (!eventForm.positionId) throw new Error('Selecione uma posicao')
    if (!eventForm.date) throw new Error('Informe a data')
    if (!eventForm.amount) throw new Error('Informe o valor total')

    const position = selectedPosition.value
    if (!position) throw new Error('Posicao invalida')

    if (position.investment_type === 'caixinha' && eventForm.event_type === 'maturity') {
      throw new Error('Evento vencimento nao esta disponivel para caixinha')
    }

    if (position.bucket === 'variable' && (eventForm.event_type === 'buy' || eventForm.event_type === 'sell')) {
      const qty = Number(eventForm.quantity.replace(',', '.'))
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Informe a quantidade')
    }

    const payload = {
      positionId: position.id,
      accountId: position.accountId,
      date: eventForm.date,
      event_type: eventForm.event_type,
      amount_cents: parseBRLToCents(eventForm.amount),
      quantity: eventForm.quantity ? Number(eventForm.quantity.replace(',', '.')) : undefined,
      unit_price_cents: eventForm.unit_price ? parseBRLToCents(eventForm.unit_price) : undefined,
      fees_cents: eventForm.fees ? parseBRLToCents(eventForm.fees) : undefined,
      note: eventForm.note || undefined,
    }

    if (editingEvent.value) {
      await eventsStore.updateEvent(editingEvent.value.id, payload)
      appToast.success({ title: 'Lancamento atualizado' })
    } else {
      await eventsStore.addEvent(payload)
      appToast.success({ title: 'Lancamento registrado' })
    }

    resetEventForm()
    eventDialogOpen.value = false
  } catch (e: any) {
    appToast.error({
      title: editingEvent.value ? 'Erro ao atualizar lancamento' : 'Erro ao registrar lancamento',
      description: e.message,
    })
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <CandlestickChart class="h-6 w-6 text-muted-foreground" />
        <h1 class="text-2xl font-bold">Investimentos</h1>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" @click="openNewPosition">
          <Plus class="h-4 w-4 mr-2" />
          Nova Posicao
        </Button>
        <Button @click="openNewEvent">
          <Plus class="h-4 w-4 mr-2" />
          Novo Lancamento
        </Button>
      </div>
    </div>

    <template v-if="loading">
      <Card>
        <CardContent class="pt-6 space-y-2">
          <Skeleton v-for="i in 6" :key="i" class="h-10 w-full" />
        </CardContent>
      </Card>
    </template>

    <template v-else-if="hasFatalLoadError">
      <Card class="border-red-500/30 bg-red-500/5">
        <CardContent class="space-y-3 pt-6">
          <p class="font-semibold text-red-500">Nao foi possivel carregar investimentos</p>
          <p class="text-sm text-muted-foreground">
            {{ loadErrorMessage || 'Verifique o servidor/API e tente novamente.' }}
          </p>
          <Button :disabled="refreshing" @click="loadPageData">
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
          <p class="text-sm text-muted-foreground">
            {{ loadErrorMessage }} Alguns dados podem estar incompletos.
          </p>
          <Button variant="outline" :disabled="refreshing" @click="loadPageData">
            {{ refreshing ? 'Atualizando...' : 'Tentar novamente' }}
          </Button>
        </CardContent>
      </Card>

      <Tabs v-model="activeBucket">
        <TabsList>
          <TabsTrigger value="variable">Renda Variavel</TabsTrigger>
          <TabsTrigger value="fixed">Renda Fixa</TabsTrigger>
        </TabsList>

        <TabsContent value="variable" class="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Carteira Variavel</CardTitle>
            </CardHeader>
            <CardContent>
              <Table v-if="variablePositions.length">
                <TableHeader>
                  <TableRow>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead class="text-right">Qtd</TableHead>
                    <TableHead class="text-right">Custo Medio</TableHead>
                    <TableHead class="text-right">Investido</TableHead>
                    <TableHead class="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="p in variablePositions"
                    :key="p.id"
                    class="cursor-pointer"
                    @click="openViewPosition(p)"
                  >
                    <TableCell><Badge>{{ p.asset_code }}</Badge></TableCell>
                    <TableCell>{{ getAccountLabel(p.accountId) }}</TableCell>
                    <TableCell class="text-right">{{ p.quantity_total ?? 0 }}</TableCell>
                    <TableCell class="text-right">{{ p.avg_cost_cents ? formatCentsToBRL(p.avg_cost_cents) : '—' }}</TableCell>
                    <TableCell class="text-right">{{ formatCentsToBRL(p.invested_cents) }}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <Button variant="ghost" size="icon" class="h-8 w-8" @click.stop>
                            <MoreHorizontal class="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem @click="openViewPosition(p)">
                            <Eye class="h-4 w-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem @click="openEditPosition(p)">
                            <Pencil class="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            @click="requestDeletePosition(p)"
                          >
                            <Trash2 class="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p v-else class="text-center text-muted-foreground py-6">Sem posicoes de renda variavel.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fixed" class="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Carteira Fixa</CardTitle>
            </CardHeader>
            <CardContent>
              <Table v-if="fixedPositions.length">
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Indexador</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead class="text-right">Total</TableHead>
                    <TableHead class="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="p in fixedPositions"
                    :key="p.id"
                    class="cursor-pointer"
                    @click="openViewPosition(p)"
                  >
                    <TableCell>
                      <template v-if="p.investment_type === 'caixinha'">
                        {{ p.name ?? 'Caixinha' }}
                      </template>
                      <template v-else>
                        <Badge>{{ p.asset_code }}</Badge> {{ p.name ?? '—' }}
                      </template>
                    </TableCell>
                    <TableCell>{{ getAccountLabel(p.accountId) }}</TableCell>
                    <TableCell>{{ p.metadata?.indexer ?? '—' }}</TableCell>
                    <TableCell>
                      <template v-if="p.metadata?.rate_percent != null">
                        {{ p.metadata.rate_percent }}{{ p.metadata?.rate_mode === 'pct_cdi' ? '% CDI' : '% a.a.' }}
                      </template>
                      <template v-else>—</template>
                    </TableCell>
                    <TableCell>{{ p.metadata?.maturity_date ?? '—' }}</TableCell>
                    <TableCell class="text-right">{{ formatCentsToBRL(p.current_value_cents ?? p.invested_cents ?? p.principal_cents ?? 0) }}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <Button variant="ghost" size="icon" class="h-8 w-8" @click.stop>
                            <MoreHorizontal class="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem @click="openViewPosition(p)">
                            <Eye class="h-4 w-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem @click="openEditPosition(p)">
                            <Pencil class="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            @click="requestDeletePosition(p)"
                          >
                            <Trash2 class="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p v-else class="text-center text-muted-foreground py-6">Sem posicoes de renda fixa.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Lancamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table v-if="filteredEvents.length">
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Posicao</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead v-if="activeBucket === 'variable'" class="text-right">Qtd</TableHead>
                <TableHead v-if="activeBucket === 'variable'" class="text-right">Preco Unit.</TableHead>
                <TableHead class="text-right">Valor</TableHead>
                <TableHead class="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="e in filteredEvents"
                :key="e.id"
                class="cursor-pointer"
                @click="openViewEvent(e)"
              >
                <TableCell>{{ e.date }}</TableCell>
                <TableCell>{{ getPositionLabel(e.positionId) }}</TableCell>
                <TableCell><Badge variant="secondary">{{ getEventTypeLabel(e.event_type) }}</Badge></TableCell>
                <TableCell v-if="activeBucket === 'variable'" class="text-right">{{ e.quantity ?? '—' }}</TableCell>
                <TableCell v-if="activeBucket === 'variable'" class="text-right">{{ e.unit_price_cents ? formatCentsToBRL(e.unit_price_cents) : '—' }}</TableCell>
                <TableCell
                  class="text-right"
                  :class="getEventValueColorClass(e.event_type)"
                >
                  {{ formatCentsToBRL(getEventSignedValueCents(e)) }}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" class="h-8 w-8" @click.stop>
                        <MoreHorizontal class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @click="openViewEvent(e)">
                        <Eye class="h-4 w-4 mr-2" />
                        Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem @click="openEditEvent(e)">
                        <Pencil class="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        @click="requestDeleteEvent(e)"
                      >
                        <Trash2 class="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p v-else class="text-center text-muted-foreground py-6">Sem lancamentos nesse grupo.</p>
        </CardContent>
      </Card>
    </template>

    <Dialog v-model:open="positionDialogOpen">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ positionDialogTitle }}</DialogTitle>
          <DialogDescription>
            {{ editingPosition ? 'Atualize os dados da posicao.' : 'Cadastre a caixinha do ativo/produto.' }}
          </DialogDescription>
        </DialogHeader>

        <Alert v-if="editingPositionHasEvents" variant="default">
          <AlertDescription>
            Conta e grupo ficam bloqueados porque essa posicao ja possui lancamentos.
          </AlertDescription>
        </Alert>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Conta *</Label>
            <Select v-model="positionForm.accountId">
              <SelectTrigger :disabled="editingPositionHasEvents"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="acc in accountsStore.accounts" :key="acc.id" :value="acc.id">{{ acc.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Grupo *</Label>
            <Select v-model="positionForm.bucket">
              <SelectTrigger :disabled="editingPositionHasEvents"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="variable">Renda Variavel</SelectItem>
                <SelectItem value="fixed">Renda Fixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Tipo *</Label>
            <Select v-model="positionForm.investment_type">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="t in filteredTypes" :key="t.value" :value="t.value">{{ t.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div v-if="requiresAssetCode" class="space-y-2">
            <Label>Codigo *</Label>
            <Input v-model="positionForm.asset_code" placeholder="Ex: MXRF11 ou CDB-INTER-2028" />
          </div>

          <div class="col-span-2 space-y-2" v-if="positionForm.bucket === 'fixed'">
            <Label>Nome</Label>
            <Input v-model="positionForm.name" placeholder="Ex: CDB Inter 2028 (opcional)" />
          </div>

          <template v-if="positionForm.bucket === 'fixed'">
            <div class="space-y-2">
              <Label>Emissor</Label>
              <Input v-model="positionForm.issuer" placeholder="Ex: Banco Inter" />
            </div>
            <div class="space-y-2">
              <Label>Indexador</Label>
              <Select v-model="positionForm.indexer">
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CDI">CDI</SelectItem>
                  <SelectItem value="IPCA">IPCA</SelectItem>
                  <SelectItem value="PRE">Pre</SelectItem>
                  <SelectItem value="SELIC">Selic</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label>Tipo da taxa</Label>
              <Select v-model="positionForm.rate_mode">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pct_cdi">% do CDI</SelectItem>
                  <SelectItem value="annual_percent">% a.a.</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label>{{ positionForm.rate_mode === 'pct_cdi' ? 'Taxa (% do CDI)' : 'Taxa (% a.a.)' }}</Label>
              <Input v-model="positionForm.rate_percent" placeholder="Ex: 120" />
            </div>
            <div class="space-y-2">
              <Label>Vencimento (opcional)</Label>
              <Input v-model="positionForm.maturity_date" type="date" />
            </div>
          </template>
        </div>

        <Button class="w-full" @click="submitPosition">
          {{ editingPosition ? 'Atualizar Posicao' : 'Salvar Posicao' }}
        </Button>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="eventDialogOpen">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ eventDialogTitle }}</DialogTitle>
          <DialogDescription>
            {{ editingEvent ? 'Atualize os dados do lancamento.' : 'Registre compra, aporte, rendimento ou resgate.' }}
          </DialogDescription>
        </DialogHeader>

        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2 space-y-2">
            <Label>Posicao *</Label>
            <Select v-model="eventForm.positionId">
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in positionsStore.positions" :key="p.id" :value="p.id">
                  {{ getPositionDisplay(p) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Data *</Label>
            <Input v-model="eventForm.date" type="date" />
          </div>

          <div class="space-y-2">
            <Label>Evento *</Label>
            <Select v-model="eventForm.event_type">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in eventTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <template v-if="selectedPosition?.bucket === 'variable' && (eventForm.event_type === 'buy' || eventForm.event_type === 'sell')">
            <div class="space-y-2">
              <Label>Quantidade *</Label>
              <Input v-model="eventForm.quantity" placeholder="Ex: 10" />
            </div>
            <div class="space-y-2">
              <Label>Preco unitario</Label>
              <MoneyInput v-model="eventForm.unit_price" />
            </div>
          </template>

          <div class="space-y-2">
            <Label>Valor total *</Label>
            <MoneyInput v-model="eventForm.amount" />
          </div>

          <div class="space-y-2">
            <Label>Taxas</Label>
            <MoneyInput v-model="eventForm.fees" />
          </div>

          <div class="col-span-2 space-y-2">
            <Label>Observacao</Label>
            <Input v-model="eventForm.note" placeholder="Opcional" />
          </div>
        </div>

        <Button class="w-full" @click="submitEvent">
          {{ editingEvent ? 'Atualizar Lancamento' : 'Salvar Lancamento' }}
        </Button>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="positionViewDialogOpen">
      <DialogContent class="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da Posicao</DialogTitle>
          <DialogDescription>Informacoes completas da posicao.</DialogDescription>
        </DialogHeader>
        <div v-if="viewingPosition" class="space-y-4 text-sm">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Posicao</p>
              <p class="mt-1 font-medium">{{ getPositionDisplay(viewingPosition) }}</p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Tipo</p>
              <p class="mt-1 font-medium">{{ getInvestmentTypeLabel(viewingPosition.investment_type) }}</p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Grupo</p>
              <p class="mt-1 font-medium">{{ viewingPosition.bucket === 'variable' ? 'Renda Variavel' : 'Renda Fixa' }}</p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Conta</p>
              <p class="mt-1 font-medium">{{ getAccountLabel(viewingPosition.accountId) }}</p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Lancamentos</p>
              <p class="mt-1 font-medium">{{ getPositionEventsCount(viewingPosition.id) }}</p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Investido</p>
              <p class="mt-1 font-medium">{{ formatCentsToBRL(viewingPosition.invested_cents) }}</p>
            </div>
          </div>

          <div v-if="showDetailedEvolution" class="space-y-3">
            <div v-if="viewingPosition.investment_type === 'caixinha'" class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Aportes</p>
                <p class="mt-1 font-medium text-green-500">+{{ formatCentsToBRL(viewingCaixinhaSummary.contributionsCents) }}</p>
              </div>
              <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Rendimentos</p>
                <p class="mt-1 font-medium text-blue-500">+{{ formatCentsToBRL(viewingCaixinhaSummary.incomeCents) }}</p>
              </div>
              <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Saidas</p>
                <p class="mt-1 font-medium text-red-500">-{{ formatCentsToBRL(viewingCaixinhaSummary.outflowCents) }}</p>
              </div>
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Compras</p>
                <p class="mt-1 font-medium text-green-500">+{{ formatCentsToBRL(viewingVariableSummary.buyCents) }}</p>
              </div>
              <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Vendas</p>
                <p class="mt-1 font-medium text-red-500">-{{ formatCentsToBRL(viewingVariableSummary.sellCents) }}</p>
              </div>
              <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Rendimentos</p>
                <p class="mt-1 font-medium text-blue-500">+{{ formatCentsToBRL(viewingVariableSummary.incomeCents) }}</p>
              </div>
            </div>

            <div class="rounded-md border border-border/60 bg-muted/20 p-3">
              <div class="mb-2 flex items-center justify-between">
                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">{{ viewingTimelineTitle }}</p>
                <p class="text-sm font-medium">{{ formatCentsToBRL(viewingPosition.current_value_cents ?? viewingPosition.invested_cents ?? 0) }}</p>
              </div>
              <div v-if="viewingPositionTimeline.length">
                <svg viewBox="0 0 620 150" class="h-36 w-full">
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    class="text-primary"
                    :points="timelineChartData.points"
                  />
                </svg>
                <div class="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{{ timelineStartDate }}</span>
                  <span>Min: {{ formatCentsToBRL(timelineChartData.min) }}</span>
                  <span>Max: {{ formatCentsToBRL(timelineChartData.max) }}</span>
                  <span>{{ timelineEndDate }}</span>
                </div>
              </div>
              <p v-else class="text-xs text-muted-foreground">Sem eventos para montar a evolucao.</p>
            </div>

            <div class="rounded-md border border-border/60 bg-muted/20 p-3">
              <p class="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Todos os Lancamentos</p>
              <Table v-if="viewingPositionTimeline.length">
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead v-if="viewingPosition.bucket === 'variable'" class="text-right">Qtd</TableHead>
                    <TableHead class="text-right">Valor</TableHead>
                    <TableHead class="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="item in viewingPositionTimeline" :key="item.event.id">
                    <TableCell>{{ item.event.date }}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{{ getEventTypeLabel(item.event.event_type) }}</Badge>
                    </TableCell>
                    <TableCell v-if="viewingPosition.bucket === 'variable'" class="text-right">
                      {{ item.event.quantity ?? '—' }}
                    </TableCell>
                    <TableCell
                      class="text-right"
                      :class="item.event.event_type === 'income'
                        ? 'text-blue-500'
                        : (item.signedValueCents >= 0 ? 'text-green-500' : 'text-red-500')"
                    >
                      {{ item.signedValueCents >= 0 ? '+' : '-' }}{{ formatCentsToBRL(Math.abs(item.signedValueCents)) }}
                    </TableCell>
                    <TableCell class="text-right font-medium">
                      {{ formatCentsToBRL(item.balanceCents) }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p v-else class="text-xs text-muted-foreground">Nenhum lancamento para esta posicao.</p>
            </div>
          </div>

          <div v-if="viewingPosition.bucket === 'variable'" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Quantidade</p>
              <p class="mt-1 font-medium">{{ viewingPosition.quantity_total ?? 0 }}</p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Custo Medio</p>
              <p class="mt-1 font-medium">{{ viewingPosition.avg_cost_cents ? formatCentsToBRL(viewingPosition.avg_cost_cents) : '—' }}</p>
            </div>
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Indexador</p>
              <p class="mt-1 font-medium">{{ viewingPosition.metadata?.indexer ?? '—' }}</p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Taxa</p>
              <p class="mt-1 font-medium">
                <template v-if="viewingPosition.metadata?.rate_percent != null">
                  {{ viewingPosition.metadata.rate_percent }}{{ viewingPosition.metadata?.rate_mode === 'pct_cdi' ? '% CDI' : '% a.a.' }}
                </template>
                <template v-else>—</template>
              </p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Vencimento</p>
              <p class="mt-1 font-medium">{{ viewingPosition.metadata?.maturity_date ?? '—' }}</p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Emissor</p>
              <p class="mt-1 font-medium">{{ viewingPosition.metadata?.issuer ?? '—' }}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="eventViewDialogOpen">
      <DialogContent class="max-w-xl">
        <DialogHeader>
          <DialogTitle>Detalhes do Lancamento</DialogTitle>
          <DialogDescription>Informacoes completas do lancamento.</DialogDescription>
        </DialogHeader>
        <div v-if="viewingEvent" class="space-y-4 text-sm">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Data</p>
              <p class="mt-1 font-medium">{{ viewingEvent.date }}</p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Evento</p>
              <p class="mt-1 font-medium">{{ getEventTypeLabel(viewingEvent.event_type) }}</p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2 sm:col-span-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Posicao</p>
              <p class="mt-1 font-medium">{{ getPositionLabel(viewingEvent.positionId) }}</p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2 sm:col-span-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Conta</p>
              <p class="mt-1 font-medium">{{ getAccountLabel(viewingEvent.accountId) }}</p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Quantidade</p>
              <p class="mt-1 font-medium">{{ viewingEvent.quantity ?? '—' }}</p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Preco Unitario</p>
              <p class="mt-1 font-medium">{{ viewingEvent.unit_price_cents ? formatCentsToBRL(viewingEvent.unit_price_cents) : '—' }}</p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Valor</p>
              <p class="mt-1 font-medium">{{ formatCentsToBRL(viewingEvent.amount_cents) }}</p>
            </div>
            <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Taxas</p>
              <p class="mt-1 font-medium">{{ viewingEvent.fees_cents ? formatCentsToBRL(viewingEvent.fees_cents) : '—' }}</p>
            </div>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Observacao</p>
            <p class="mt-1 font-medium">{{ viewingEvent.note || '—' }}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      :open="confirmDeleteOpen"
      title="Excluir item?"
      :description="`Deseja excluir '${deleteTarget?.label}'? Esta acao nao pode ser desfeita.`"
      confirm-label="Sim, excluir"
      cancel-label="Cancelar"
      :destructive="true"
      @confirm="confirmDelete"
      @cancel="confirmDeleteOpen = false"
    />
  </div>
</template>

