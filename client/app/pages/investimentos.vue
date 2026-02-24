<script setup lang="ts">
import { CandlestickChart, Plus } from 'lucide-vue-next'
import { useAccountsStore } from '~/stores/useAccounts'
import { useInvestmentPositionsStore } from '~/stores/useInvestmentPositions'
import { useInvestmentEventsStore } from '~/stores/useInvestmentEvents'
import { useAppToast } from '~/composables/useAppToast'
import { parseBRLToCents, formatCentsToBRL } from '~/utils/money'
import { nowISO } from '~/utils/dates'
import type { InvestmentPosition } from '~/schemas/zod-schemas'

const accountsStore = useAccountsStore()
const positionsStore = useInvestmentPositionsStore()
const eventsStore = useInvestmentEventsStore()
const appToast = useAppToast()

const loading = ref(true)
const activeBucket = ref<'variable' | 'fixed'>('variable')

const positionDialogOpen = ref(false)
const eventDialogOpen = ref(false)

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

onMounted(async () => {
  try {
    await Promise.all([
      accountsStore.loadAccounts(),
      positionsStore.loadPositions(),
      eventsStore.loadEvents(),
    ])
  } finally {
    loading.value = false
  }
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
  selectedPosition.value?.bucket === 'fixed' ? eventTypeOptionsFixed : eventTypeOptionsVariable,
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
  return position.name?.trim() ? `${position.asset_code} · ${position.name}` : position.asset_code
}

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

async function submitPosition() {
  try {
    if (!positionForm.accountId) throw new Error('Selecione uma conta')
    if (!positionForm.asset_code.trim()) throw new Error('Informe o codigo')

    const normalizedCode = positionForm.asset_code.trim().toUpperCase()

    if (positionForm.bucket === 'variable') {
      const duplicate = positionsStore.positions.find(p =>
        p.accountId === positionForm.accountId
        && p.bucket === 'variable'
        && p.investment_type === positionForm.investment_type
        && p.asset_code.toUpperCase() === normalizedCode,
      )
      if (duplicate) throw new Error('Ja existe posicao desse ativo para essa conta')
    }

    await positionsStore.addPosition({
      accountId: positionForm.accountId,
      bucket: positionForm.bucket,
      investment_type: positionForm.investment_type,
      asset_code: normalizedCode,
      name: positionForm.bucket === 'fixed' ? (positionForm.name.trim() || undefined) : undefined,
      is_active: true,
      invested_cents: 0,
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
    })

    appToast.success({ title: 'Posicao criada' })
    resetPositionForm()
    positionDialogOpen.value = false
  } catch (e: any) {
    appToast.error({ title: 'Erro ao criar posicao', description: e.message })
  }
}

async function submitEvent() {
  try {
    if (!eventForm.positionId) throw new Error('Selecione uma posicao')
    if (!eventForm.date) throw new Error('Informe a data')
    if (!eventForm.amount) throw new Error('Informe o valor total')

    const position = selectedPosition.value
    if (!position) throw new Error('Posicao invalida')

    if (position.bucket === 'variable' && (eventForm.event_type === 'buy' || eventForm.event_type === 'sell')) {
      const qty = Number(eventForm.quantity.replace(',', '.'))
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Informe a quantidade')
    }

    await eventsStore.addEvent({
      positionId: position.id,
      accountId: position.accountId,
      date: eventForm.date,
      event_type: eventForm.event_type,
      amount_cents: parseBRLToCents(eventForm.amount),
      quantity: eventForm.quantity ? Number(eventForm.quantity.replace(',', '.')) : undefined,
      unit_price_cents: eventForm.unit_price ? parseBRLToCents(eventForm.unit_price) : undefined,
      fees_cents: eventForm.fees ? parseBRLToCents(eventForm.fees) : undefined,
      note: eventForm.note || undefined,
    })

    appToast.success({ title: 'Lancamento registrado' })
    resetEventForm()
    eventDialogOpen.value = false
  } catch (e: any) {
    appToast.error({ title: 'Erro ao registrar lancamento', description: e.message })
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
        <Button variant="outline" @click="positionDialogOpen = true">
          <Plus class="h-4 w-4 mr-2" />
          Nova Posicao
        </Button>
        <Button @click="eventDialogOpen = true">
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

    <template v-else>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="p in variablePositions" :key="p.id">
                    <TableCell><Badge>{{ p.asset_code }}</Badge></TableCell>
                    <TableCell>{{ getAccountLabel(p.accountId) }}</TableCell>
                    <TableCell class="text-right">{{ p.quantity_total ?? 0 }}</TableCell>
                    <TableCell class="text-right">{{ p.avg_cost_cents ? formatCentsToBRL(p.avg_cost_cents) : '—' }}</TableCell>
                    <TableCell class="text-right">{{ formatCentsToBRL(p.invested_cents) }}</TableCell>
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
                    <TableHead class="text-right">Principal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="p in fixedPositions" :key="p.id">
                    <TableCell><Badge>{{ p.asset_code }}</Badge> {{ p.name ?? '—' }}</TableCell>
                    <TableCell>{{ getAccountLabel(p.accountId) }}</TableCell>
                    <TableCell>{{ p.metadata?.indexer ?? '—' }}</TableCell>
                    <TableCell>
                      <template v-if="p.metadata?.rate_percent != null">
                        {{ p.metadata.rate_percent }}{{ p.metadata?.rate_mode === 'pct_cdi' ? '% CDI' : '% a.a.' }}
                      </template>
                      <template v-else>—</template>
                    </TableCell>
                    <TableCell>{{ p.metadata?.maturity_date ?? '—' }}</TableCell>
                    <TableCell class="text-right">{{ formatCentsToBRL(p.principal_cents ?? p.invested_cents) }}</TableCell>
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
                <TableHead class="text-right">Qtd</TableHead>
                <TableHead class="text-right">Preco Unit.</TableHead>
                <TableHead class="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="e in filteredEvents" :key="e.id">
                <TableCell>{{ e.date }}</TableCell>
                <TableCell>{{ getPositionLabel(e.positionId) }}</TableCell>
                <TableCell><Badge variant="secondary">{{ e.event_type }}</Badge></TableCell>
                <TableCell class="text-right">{{ e.quantity ?? '—' }}</TableCell>
                <TableCell class="text-right">{{ e.unit_price_cents ? formatCentsToBRL(e.unit_price_cents) : '—' }}</TableCell>
                <TableCell class="text-right">{{ formatCentsToBRL(e.amount_cents) }}</TableCell>
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
          <DialogTitle>Nova Posicao</DialogTitle>
          <DialogDescription>Cadastre a caixinha do ativo/produto.</DialogDescription>
        </DialogHeader>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Conta *</Label>
            <Select v-model="positionForm.accountId">
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="acc in accountsStore.accounts" :key="acc.id" :value="acc.id">{{ acc.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Grupo *</Label>
            <Select v-model="positionForm.bucket">
              <SelectTrigger><SelectValue /></SelectTrigger>
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

          <div class="space-y-2">
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

        <Button class="w-full" @click="submitPosition">Salvar Posicao</Button>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="eventDialogOpen">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Lancamento</DialogTitle>
          <DialogDescription>Registre compra, aporte, rendimento ou resgate.</DialogDescription>
        </DialogHeader>

        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2 space-y-2">
            <Label>Posicao *</Label>
            <Select v-model="eventForm.positionId">
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in positionsStore.positions" :key="p.id" :value="p.id">
                  {{ p.name ? `${p.asset_code} · ${p.name}` : p.asset_code }}
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

        <Button class="w-full" @click="submitEvent">Salvar Lancamento</Button>
      </DialogContent>
    </Dialog>
  </div>
</template>
