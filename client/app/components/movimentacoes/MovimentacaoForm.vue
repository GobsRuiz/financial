<script setup lang="ts">
import { AlertCircleIcon, Save } from 'lucide-vue-next'
import type { Transaction, Recurrent } from '~/schemas/zod-schemas'
import { useAccountsStore } from '~/stores/useAccounts'
import { useTagsStore } from '~/stores/useTags'
import { useTransactionsStore } from '~/stores/useTransactions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useInvestmentPositionsStore } from '~/stores/useInvestmentPositions'
import { useInvestmentEventsStore } from '~/stores/useInvestmentEvents'
import { parseBRLToCents, formatCentsToBRL } from '~/utils/money'
import { nowISO } from '~/utils/dates'
import { Alert, AlertDescription } from '../ui/alert'

const props = defineProps<{
  editTransaction?: Transaction | null
  editRecurrent?: Recurrent | null
}>()

const emit = defineEmits<{ saved: [] }>()

const accountsStore = useAccountsStore()
const tagsStore = useTagsStore()
const transactionsStore = useTransactionsStore()
const recurrentsStore = useRecurrentsStore()
const positionsStore = useInvestmentPositionsStore()
const eventsStore = useInvestmentEventsStore()

const isEdit = computed(() => !!props.editTransaction || !!props.editRecurrent)

const tipoMovimentacao = ref<'transacao' | 'recorrente' | 'investimento'>('transacao')
const loading = ref(false)
const error = ref('')

function centsToBRLDisplay(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(cents) / 100)
}

// ── Form Transação ──
const txForm = reactive({
  accountId: null as number | null,
  type: 'expense' as 'expense' | 'income' | 'transfer',
  category: '',
  amount: '',
  date: nowISO(),
  description: '',
  tags: [] as string[],
  paid: false,
  parcelado: false,
  totalParcelas: '',
  produto: '',
  valorParcela: '',
})

// ── Form Recorrente ──
const recForm = reactive({
  accountId: null as number | null,
  kind: 'expense' as 'income' | 'expense' | 'benefit',
  name: '',
  amount: '',
  frequency: 'monthly' as const,
  day_of_month: '',
  due_day: '',
  description: '',
  active: true,
})

// ── Form Investimento (lançamento) ──
const invForm = reactive({
  positionId: '',
  date: nowISO(),
  event_type: 'buy' as 'buy' | 'sell' | 'income' | 'contribution' | 'withdrawal' | 'maturity',
  quantity: '',
  unit_price: '',
  amount: '',
  fees: '',
  note: '',
})

const selectedPosition = computed(() =>
  positionsStore.positions.find(p => p.id === invForm.positionId),
)

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

const eventTypeOptions = computed(() =>
  selectedPosition.value?.bucket === 'fixed' ? eventTypeOptionsFixed : eventTypeOptionsVariable,
)

const investmentPositions = computed(() => {
  return positionsStore.positions
})

watch(() => invForm.positionId, () => {
  invForm.event_type = selectedPosition.value?.bucket === 'fixed' ? 'contribution' : 'buy'
  invForm.quantity = ''
  invForm.unit_price = ''
  invForm.amount = ''
  invForm.fees = ''
})

watch(() => [invForm.quantity, invForm.unit_price], () => {
  if (!selectedPosition.value || selectedPosition.value.bucket !== 'variable') return
  if (!invForm.quantity || !invForm.unit_price) return

  const qty = Number(invForm.quantity.replace(',', '.'))
  if (!Number.isFinite(qty) || qty <= 0) return
  const cents = parseBRLToCents(invForm.unit_price)
  invForm.amount = formatCentsToBRL(Math.round(qty * cents))
})

// Auto-calcular valor da parcela quando valor total ou nº de parcelas mudar
watch(() => [txForm.amount, txForm.totalParcelas], () => {
  if (!txForm.parcelado || !txForm.amount || !txForm.totalParcelas) return
  const total = parseInt(txForm.totalParcelas)
  if (!total || total < 2) return
  const cents = parseBRLToCents(txForm.amount)
  const parcelaCents = Math.round(cents / total)
  txForm.valorParcela = centsToBRLDisplay(parcelaCents)
})

// Preencher forms quando editando
watch(() => props.editTransaction, (tx) => {
  if (tx) {
    tipoMovimentacao.value = 'transacao'
    txForm.accountId = tx.accountId
    txForm.type = tx.type
    txForm.category = tx.category
    txForm.amount = centsToBRLDisplay(tx.amount_cents)
    txForm.date = tx.date
    txForm.description = tx.description ?? ''
    txForm.tags = tx.tags ?? []
    txForm.paid = tx.paid
    txForm.parcelado = false
    txForm.totalParcelas = ''
    txForm.produto = ''
  }
}, { immediate: true })

watch(() => props.editRecurrent, (rec) => {
  if (rec) {
    tipoMovimentacao.value = 'recorrente'
    recForm.accountId = rec.accountId
    recForm.kind = rec.kind
    recForm.name = rec.name
    recForm.amount = centsToBRLDisplay(rec.amount_cents)
    recForm.day_of_month = rec.day_of_month?.toString() ?? ''
    recForm.due_day = rec.due_day?.toString() ?? ''
    recForm.description = rec.description ?? ''
    recForm.active = rec.active
  }
}, { immediate: true })

function resetForms() {
  Object.assign(txForm, {
    accountId: null, type: 'expense', category: '', amount: '', date: nowISO(),
    description: '', tags: [], paid: false, parcelado: false, totalParcelas: '', produto: '', valorParcela: '',
  })
  Object.assign(recForm, {
    accountId: null, kind: 'expense', name: '', amount: '', frequency: 'monthly',
    day_of_month: '', due_day: '', description: '', active: true,
  })
  Object.assign(invForm, {
    positionId: '',
    date: nowISO(),
    event_type: 'buy',
    quantity: '',
    unit_price: '',
    amount: '',
    fees: '',
    note: '',
  })
  error.value = ''
}

async function handleSubmit() {
  loading.value = true
  error.value = ''

  try {
    if (tipoMovimentacao.value === 'transacao') {
      await submitTransacao()
    } else if (tipoMovimentacao.value === 'recorrente') {
      await submitRecorrente()
    } else {
      await submitInvestimento()
    }
    resetForms()
    emit('saved')
  } catch (e: any) {
    error.value = e.message || 'Erro ao salvar'
  } finally {
    loading.value = false
  }
}

async function submitTransacao() {
  if (!txForm.accountId) throw new Error('Selecione uma conta')
  if (!txForm.category) throw new Error('Informe a categoria')
  if (!txForm.amount) throw new Error('Informe o valor')
  if (!txForm.date) throw new Error('Informe a data')

  const cents = parseBRLToCents(txForm.amount)
  const amount_cents = txForm.type === 'expense' ? -cents : cents

  for (const tag of txForm.tags) {
    await tagsStore.ensureTag(tag)
  }

  if (props.editTransaction) {
    await transactionsStore.updateTransaction(props.editTransaction.id, {
      accountId: txForm.accountId,
      date: txForm.date,
      type: txForm.type,
      category: txForm.category,
      amount_cents,
      description: txForm.description || undefined,
      tags: txForm.tags.length ? txForm.tags : undefined,
      paid: txForm.paid,
    })
  } else if (txForm.parcelado) {
    const total = parseInt(txForm.totalParcelas)
    if (!total || total < 2) throw new Error('Mínimo 2 parcelas')
    if (!txForm.produto) throw new Error('Informe o produto')
    if (!txForm.valorParcela) throw new Error('Informe o valor da parcela')

    const parcelaCents = parseBRLToCents(txForm.valorParcela)
    const installmentAmountCents = txForm.type === 'expense' ? -parcelaCents : parcelaCents

    await transactionsStore.generateInstallments({
      accountId: txForm.accountId,
      date: txForm.date,
      type: txForm.type,
      category: txForm.category,
      amount_cents,
      installmentAmountCents,
      description: txForm.description || undefined,
      tags: txForm.tags.length ? txForm.tags : undefined,
      paid: txForm.paid,
      product: txForm.produto,
      totalInstallments: total,
    })
  } else {
    await transactionsStore.addTransaction({
      accountId: txForm.accountId,
      date: txForm.date,
      type: txForm.type,
      category: txForm.category,
      amount_cents,
      description: txForm.description || undefined,
      tags: txForm.tags.length ? txForm.tags : undefined,
      paid: txForm.paid,
      installment: null,
    })

    if (txForm.paid) {
      await accountsStore.adjustBalance(
        txForm.accountId,
        amount_cents,
        txForm.description || txForm.category,
      )
    }
  }
}

async function submitRecorrente() {
  if (!recForm.accountId) throw new Error('Selecione uma conta')
  if (!recForm.name) throw new Error('Informe o nome')
  if (!recForm.amount) throw new Error('Informe o valor')

  const cents = parseBRLToCents(recForm.amount)
  const amount_cents = recForm.kind === 'expense' ? -cents : cents

  if (props.editRecurrent) {
    await recurrentsStore.updateRecurrent(props.editRecurrent.id, {
      accountId: recForm.accountId,
      kind: recForm.kind,
      name: recForm.name,
      amount_cents,
      frequency: recForm.frequency,
      day_of_month: recForm.day_of_month ? parseInt(recForm.day_of_month) : undefined,
      due_day: recForm.due_day ? parseInt(recForm.due_day) : undefined,
      description: recForm.description || undefined,
      active: recForm.active,
    })
  } else {
    await recurrentsStore.addRecurrent({
      accountId: recForm.accountId,
      kind: recForm.kind,
      name: recForm.name,
      amount_cents,
      frequency: recForm.frequency,
      day_of_month: recForm.day_of_month ? parseInt(recForm.day_of_month) : undefined,
      due_day: recForm.due_day ? parseInt(recForm.due_day) : undefined,
      description: recForm.description || undefined,
      active: recForm.active,
    })
  }
}

async function submitInvestimento() {
  if (!invForm.positionId) throw new Error('Selecione uma posição')
  if (!invForm.date) throw new Error('Informe a data')
  if (!invForm.amount) throw new Error('Informe o valor total')

  const position = selectedPosition.value
  if (!position) throw new Error('Posição inválida')

  if (position.bucket === 'variable' && (invForm.event_type === 'buy' || invForm.event_type === 'sell')) {
    const qty = Number(invForm.quantity.replace(',', '.'))
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Informe a quantidade')
  }

  await eventsStore.addEvent({
    positionId: position.id,
    accountId: position.accountId,
    date: invForm.date,
    event_type: invForm.event_type,
    amount_cents: parseBRLToCents(invForm.amount),
    quantity: invForm.quantity ? Number(invForm.quantity.replace(',', '.')) : undefined,
    unit_price_cents: invForm.unit_price ? parseBRLToCents(invForm.unit_price) : undefined,
    fees_cents: invForm.fees ? parseBRLToCents(invForm.fees) : undefined,
    note: invForm.note || undefined,
  })
}

const txTypeOptions = [
  { label: 'Despesa', value: 'expense' },
  { label: 'Receita', value: 'income' },
  { label: 'Transferência', value: 'transfer' },
]

const kindOptions = [
  { label: 'Despesa', value: 'expense' },
  { label: 'Receita', value: 'income' },
  { label: 'Benefício', value: 'benefit' },
]
</script>

<template>
  <Tabs :default-value="tipoMovimentacao" class="space-y-4">
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <TabsList class="w-full" v-if="!isEdit">
        <TabsTrigger value="transacao" class="flex-1" @click="tipoMovimentacao = 'transacao'">Transação</TabsTrigger>
        <TabsTrigger value="recorrente" class="flex-1" @click="tipoMovimentacao = 'recorrente'">Recorrente</TabsTrigger>
        <TabsTrigger value="investimento" class="flex-1" @click="tipoMovimentacao = 'investimento'">Investimento</TabsTrigger>
      </TabsList>

      <template v-if="tipoMovimentacao === 'transacao'">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Conta *</Label>
            <Select v-model="txForm.accountId">
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="acc in accountsStore.accounts" :key="acc.id" :value="acc.id">{{ acc.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Tipo *</Label>
            <Select v-model="txForm.type">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in txTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Categoria *</Label>
            <CategorySelect v-model="txForm.category" />
          </div>

          <div class="space-y-2">
            <Label>Valor *</Label>
            <MoneyInput v-model="txForm.amount" />
          </div>

          <div class="space-y-2">
            <Label>Data *</Label>
            <Input v-model="txForm.date" type="date" />
          </div>

          <div class="space-y-2">
            <Label>Descrição</Label>
            <Input v-model="txForm.description" placeholder="Opcional" />
          </div>
        </div>

        <div class="space-y-2">
          <Label>Tags</Label>
          <TagSelect v-model="txForm.tags" />
        </div>

        <div class="flex items-center gap-2">
          <Checkbox v-model="txForm.paid" />
          <Label>Pago</Label>
        </div>

        <div v-if="!isEdit" class="space-y-3">
          <div class="flex items-center gap-2">
            <Checkbox v-model="txForm.parcelado" />
            <Label>Parcelado</Label>
          </div>

          <div v-if="txForm.parcelado" class="grid grid-cols-3 gap-4 pl-6">
            <div class="space-y-2">
              <Label>Total de Parcelas *</Label>
              <Input v-model="txForm.totalParcelas" placeholder="Ex: 10" type="number" min="2" />
            </div>
            <div class="space-y-2">
              <Label>Valor da Parcela *</Label>
              <MoneyInput v-model="txForm.valorParcela" />
            </div>
            <div class="space-y-2">
              <Label>Produto *</Label>
              <Input v-model="txForm.produto" placeholder="Ex: Geladeira" />
            </div>
          </div>
        </div>
      </template>

      <template v-if="tipoMovimentacao === 'recorrente'">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Conta *</Label>
            <Select v-model="recForm.accountId">
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="acc in accountsStore.accounts" :key="acc.id" :value="acc.id">{{ acc.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Tipo *</Label>
            <Select v-model="recForm.kind">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in kindOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Nome *</Label>
            <Input v-model="recForm.name" placeholder="Ex: Academia" />
          </div>

          <div class="space-y-2">
            <Label>Valor *</Label>
            <MoneyInput v-model="recForm.amount" />
          </div>

          <div class="space-y-2">
            <Label>Dia do mês</Label>
            <Input v-model="recForm.day_of_month" placeholder="1-31" type="number" min="1" max="31" />
          </div>

          <div class="space-y-2">
            <Label>Vencimento (dia)</Label>
            <Input v-model="recForm.due_day" placeholder="1-31" type="number" min="1" max="31" />
          </div>

          <div class="col-span-2 space-y-2">
            <Label>Descrição</Label>
            <Input v-model="recForm.description" placeholder="Opcional" />
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Checkbox v-model="recForm.active" />
          <Label>Ativo</Label>
        </div>
      </template>

      <template v-if="tipoMovimentacao === 'investimento'">
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2 space-y-2">
            <Label>Posição *</Label>
            <Select v-model="invForm.positionId">
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in investmentPositions" :key="p.id" :value="p.id">
                  {{ p.name ? `${p.asset_code} · ${p.name}` : p.asset_code }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Data *</Label>
            <Input v-model="invForm.date" type="date" />
          </div>

          <div class="space-y-2">
            <Label>Evento *</Label>
            <Select v-model="invForm.event_type">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in eventTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <template v-if="selectedPosition?.bucket === 'variable' && (invForm.event_type === 'buy' || invForm.event_type === 'sell')">
            <div class="space-y-2">
              <Label>Quantidade *</Label>
              <Input v-model="invForm.quantity" placeholder="Ex: 10" />
            </div>
            <div class="space-y-2">
              <Label>Preço Unitário</Label>
              <MoneyInput v-model="invForm.unit_price" />
            </div>
          </template>

          <div class="space-y-2">
            <Label>Valor Total *</Label>
            <MoneyInput v-model="invForm.amount" />
          </div>

          <div class="space-y-2">
            <Label>Taxas</Label>
            <MoneyInput v-model="invForm.fees" />
          </div>

          <div class="col-span-2 space-y-2">
            <Label>Observação</Label>
            <Input v-model="invForm.note" placeholder="Opcional" />
          </div>
        </div>
      </template>

      <Alert v-if="error" variant="destructive">
        <AlertCircleIcon class="size-4" />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <Button type="submit" :disabled="loading" class="w-full">
        <Save class="h-4 w-4 mr-2" />
        {{ loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Salvar') }}
      </Button>
    </form>
  </Tabs>
</template>
