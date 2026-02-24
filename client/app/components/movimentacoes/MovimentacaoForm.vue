<script setup lang="ts">
import { AlertCircleIcon, Save } from 'lucide-vue-next'
import type { Transaction, Recurrent, Investment } from '~/schemas/zod-schemas'
import { useAccountsStore } from '~/stores/useAccounts'
import { useTagsStore } from '~/stores/useTags'
import { useTransactionsStore } from '~/stores/useTransactions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useInvestmentsStore } from '~/stores/useInvestments'
import { parseBRLToCents, formatCentsToBRL } from '~/utils/money'
import { nowISO } from '~/utils/dates'
import { Alert, AlertDescription } from '../ui/alert'

const props = defineProps<{
  editTransaction?: Transaction | null
  editRecurrent?: Recurrent | null
  editInvestment?: Investment | null
}>()

const emit = defineEmits<{ saved: [] }>()

const accountsStore = useAccountsStore()
const tagsStore = useTagsStore()
const transactionsStore = useTransactionsStore()
const recurrentsStore = useRecurrentsStore()
const investmentsStore = useInvestmentsStore()

const isEdit = computed(() => !!props.editTransaction || !!props.editRecurrent || !!props.editInvestment)

const tipoMovimentacao = ref<'transacao' | 'recorrente' | 'investimento'>('transacao')
const loading = ref(false)
const error = ref('')

function centsToBRLDisplay(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(cents) / 100)
}

function parseDecimalInput(value: string): number | null {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
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

// ── Form Investimento ──
const invForm = reactive({
  accountId: null as number | null,
  investment_type: 'fii' as Investment['investment_type'],
  asset_tag: '',
  applied: '',
  current: '',
  description: '',
  quantity: '',
  avg_unit_price: '',
  issuer: '',
  title: '',
  indexer: '' as '' | 'CDI' | 'IPCA' | 'PRE' | 'SELIC' | 'OUTRO',
  rate_percent: '',
  maturity_date: '',
  liquidity: '' as '' | 'D0' | 'D1' | 'NO_VENCIMENTO' | 'OUTRA',
})

const quotaTypes = new Set<Investment['investment_type']>(['fii', 'cripto'])
const fixedIncomeTypes = new Set<Investment['investment_type']>(['caixinha', 'cdb', 'cdi', 'lci', 'lca'])

const hasQuotaFields = computed(() => quotaTypes.has(invForm.investment_type))
const hasFixedIncomeFields = computed(() => fixedIncomeTypes.has(invForm.investment_type))
const hasTesouroFields = computed(() => invForm.investment_type === 'tesouro')

const investmentTypeOptions = [
  { label: 'FII (Fundo Imobiliário)', value: 'fii' },
  { label: 'Criptomoeda', value: 'cripto' },
  { label: 'Caixinha', value: 'caixinha' },
  { label: 'CDB', value: 'cdb' },
  { label: 'CDI', value: 'cdi' },
  { label: 'Tesouro Direto', value: 'tesouro' },
  { label: 'LCI', value: 'lci' },
  { label: 'LCA', value: 'lca' },
  { label: 'Outro', value: 'outro' },
] as const

const indexerOptions = [
  { label: 'CDI', value: 'CDI' },
  { label: 'IPCA', value: 'IPCA' },
  { label: 'Pré-fixado', value: 'PRE' },
  { label: 'Selic', value: 'SELIC' },
  { label: 'Outro', value: 'OUTRO' },
] as const

const liquidityOptions = [
  { label: 'D+0', value: 'D0' },
  { label: 'D+1', value: 'D1' },
  { label: 'No vencimento', value: 'NO_VENCIMENTO' },
  { label: 'Outra', value: 'OUTRA' },
] as const

const assetLabel = computed(() => {
  if (invForm.investment_type === 'caixinha') return 'Produto *'
  return 'Ativo (Tag) *'
})

const assetPlaceholder = computed(() => {
  if (invForm.investment_type === 'fii') return 'Ex: MXRF11'
  if (invForm.investment_type === 'cripto') return 'Ex: BTC'
  if (invForm.investment_type === 'tesouro') return 'Ex: Tesouro Selic'
  return 'Ex: CDB Banco X'
})

watch(
  () => [invForm.quantity, invForm.avg_unit_price, invForm.investment_type],
  () => {
    if (!hasQuotaFields.value) return

    const quantity = parseDecimalInput(invForm.quantity)
    if (!quantity || quantity <= 0) return

    if (invForm.avg_unit_price) {
      const avgUnitPriceCents = parseBRLToCents(invForm.avg_unit_price)
      invForm.applied = formatCentsToBRL(Math.round(quantity * avgUnitPriceCents))
    }
  },
)

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

watch(() => props.editInvestment, (inv) => {
  if (inv) {
    const details = inv.details ?? {}
    tipoMovimentacao.value = 'investimento'
    invForm.accountId = inv.accountId
    invForm.investment_type = inv.investment_type ?? 'outro'
    invForm.asset_tag = inv.asset_tag
    invForm.applied = centsToBRLDisplay(inv.applied_cents)
    invForm.current = inv.current_cents ? centsToBRLDisplay(inv.current_cents) : ''
    invForm.description = inv.description ?? ''
    invForm.quantity = details.quantity != null ? String(details.quantity).replace('.', ',') : ''
    invForm.avg_unit_price = details.avg_unit_price_cents != null ? centsToBRLDisplay(details.avg_unit_price_cents) : ''
    invForm.issuer = details.issuer ?? ''
    invForm.title = details.title ?? ''
    invForm.indexer = details.indexer ?? ''
    invForm.rate_percent = details.rate_percent != null ? String(details.rate_percent).replace('.', ',') : ''
    invForm.maturity_date = details.maturity_date ?? ''
    invForm.liquidity = details.liquidity ?? ''
  }
}, { immediate: true })

function resetForms() {
  Object.assign(txForm, {
    accountId: null, type: 'expense', category: '', amount: '', date: nowISO(),
    description: '', tags: [], paid: false, parcelado: false, totalParcelas: '', produto: '',
  })
  Object.assign(recForm, {
    accountId: null, kind: 'expense', name: '', amount: '', frequency: 'monthly',
    day_of_month: '', due_day: '', description: '', active: true,
  })
  Object.assign(invForm, {
    accountId: null,
    investment_type: 'fii',
    asset_tag: '',
    applied: '',
    current: '',
    description: '',
    quantity: '',
    avg_unit_price: '',
    issuer: '',
    title: '',
    indexer: '',
    rate_percent: '',
    maturity_date: '',
    liquidity: '',
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

    await transactionsStore.generateInstallments({
      accountId: txForm.accountId,
      date: txForm.date,
      type: txForm.type,
      category: txForm.category,
      amount_cents,
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
  if (!invForm.accountId) throw new Error('Selecione uma conta')
  if (!invForm.asset_tag.trim()) throw new Error('Informe o ativo/produto')

  if (hasQuotaFields.value) {
    const quantity = parseDecimalInput(invForm.quantity)
    if (!quantity || quantity <= 0) throw new Error('Informe a quantidade de cotas/unidades')
  }

  if (hasFixedIncomeFields.value) {
    if (!invForm.indexer) throw new Error('Selecione o indexador')
    if (!invForm.rate_percent.trim()) throw new Error('Informe a taxa (% a.a.)')
  }

  if (hasTesouroFields.value) {
    if (!invForm.title.trim()) throw new Error('Informe o título do Tesouro')
    if (!invForm.maturity_date) throw new Error('Informe o vencimento')
  }

  if (!invForm.applied) throw new Error('Informe o valor aplicado')

  const details: NonNullable<Investment['details']> = {}

  if (hasQuotaFields.value) {
    const quantity = parseDecimalInput(invForm.quantity)
    if (quantity && quantity > 0) details.quantity = quantity
    if (invForm.avg_unit_price) details.avg_unit_price_cents = parseBRLToCents(invForm.avg_unit_price)
  }

  if (hasFixedIncomeFields.value || hasTesouroFields.value) {
    if (invForm.issuer.trim()) details.issuer = invForm.issuer.trim()
    if (invForm.indexer) details.indexer = invForm.indexer
    if (invForm.rate_percent.trim()) {
      const rate = parseDecimalInput(invForm.rate_percent)
      if (rate != null) details.rate_percent = rate
    }
    if (invForm.maturity_date) details.maturity_date = invForm.maturity_date
    if (invForm.liquidity) details.liquidity = invForm.liquidity
  }

  if (hasTesouroFields.value && invForm.title.trim()) {
    details.title = invForm.title.trim()
  }

  const payload = {
    accountId: invForm.accountId,
    investment_type: invForm.investment_type,
    asset_tag: invForm.asset_tag.toUpperCase().trim(),
    applied_cents: parseBRLToCents(invForm.applied),
    description: invForm.description || undefined,
    details,
  }

  if (props.editInvestment) {
    await investmentsStore.updateInvestment(props.editInvestment.id, payload)
  } else {
    await investmentsStore.addInvestment(payload)
  }
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
      <!-- Tipo de movimentação -->
      <TabsList class="w-full" v-if="!isEdit">
        <TabsTrigger value="transacao" class="flex-1" @click="tipoMovimentacao = 'transacao'">Transação</TabsTrigger>
        <TabsTrigger value="recorrente" class="flex-1" @click="tipoMovimentacao = 'recorrente'">Recorrente</TabsTrigger>
        <TabsTrigger value="investimento" class="flex-1" @click="tipoMovimentacao = 'investimento'">Investimento</TabsTrigger>
      </TabsList>

      <!-- ═══ FORM TRANSAÇÃO ═══ -->
      <template v-if="tipoMovimentacao === 'transacao'">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Conta *</Label>
            <Select v-model="txForm.accountId">
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="acc in accountsStore.accounts"
                  :key="acc.id"
                  :value="acc.id"
                >
                  {{ acc.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Tipo *</Label>
            <Select v-model="txForm.type">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in txTypeOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
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
          <Checkbox
            :checked="txForm.paid"
            @update:checked="(val) => txForm.paid = !!val"
          />
          <Label>Pago</Label>
        </div>

        <!-- Parcelado (só na criação) -->
        <div v-if="!isEdit" class="space-y-3">
          <div class="flex items-center gap-2">
            <Checkbox
              :checked="txForm.parcelado"
              @update:checked="(val) => txForm.parcelado = !!val"
            />
            <Label>Parcelado</Label>
          </div>

          <div v-if="txForm.parcelado" class="grid grid-cols-2 gap-4 pl-6">
            <div class="space-y-2">
              <Label>Total de Parcelas *</Label>
              <Input v-model="txForm.totalParcelas" placeholder="Ex: 10" type="number" min="2" />
            </div>
            <div class="space-y-2">
              <Label>Produto *</Label>
              <Input v-model="txForm.produto" placeholder="Ex: Geladeira" />
            </div>
          </div>
        </div>
      </template>

      <!-- ═══ FORM RECORRENTE ═══ -->
      <template v-if="tipoMovimentacao === 'recorrente'">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Conta *</Label>
            <Select v-model="recForm.accountId">
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="acc in accountsStore.accounts"
                  :key="acc.id"
                  :value="acc.id"
                >
                  {{ acc.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Tipo *</Label>
            <Select v-model="recForm.kind">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in kindOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
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
          <Checkbox
            :checked="recForm.active"
            @update:checked="(val) => recForm.active = !!val"
          />
          <Label>Ativo</Label>
        </div>
      </template>

      <!-- ═══ FORM INVESTIMENTO ═══ -->
      <template v-if="tipoMovimentacao === 'investimento'">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Conta *</Label>
            <Select v-model="invForm.accountId">
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="acc in accountsStore.accounts"
                  :key="acc.id"
                  :value="acc.id"
                >
                  {{ acc.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Tipo de Investimento *</Label>
            <Select v-model="invForm.investment_type">
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in investmentTypeOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>{{ assetLabel }}</Label>
            <Input v-model="invForm.asset_tag" :placeholder="assetPlaceholder" />
          </div>

          <div v-if="hasQuotaFields" class="space-y-2">
            <Label>Quantidade *</Label>
            <Input v-model="invForm.quantity" type="text" placeholder="Ex: 10,5" />
          </div>

          <template v-if="hasQuotaFields">
            <div class="space-y-2">
              <Label>Custo Médio (por cota)</Label>
              <MoneyInput v-model="invForm.avg_unit_price" placeholder="0,00" />
            </div>
          </template>

          <template v-if="hasFixedIncomeFields || hasTesouroFields">
            <div class="space-y-2">
              <Label>Emissor</Label>
              <Input v-model="invForm.issuer" placeholder="Ex: Banco Inter" />
            </div>

            <div class="space-y-2">
              <Label>Indexador *</Label>
              <Select v-model="invForm.indexer">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in indexerOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-2">
              <Label>Taxa (% a.a.) *</Label>
              <Input v-model="invForm.rate_percent" type="text" placeholder="Ex: 12,5" />
            </div>

            <div class="space-y-2">
              <Label>Vencimento</Label>
              <Input v-model="invForm.maturity_date" type="date" />
            </div>

            <div class="space-y-2">
              <Label>Liquidez</Label>
              <Select v-model="invForm.liquidity">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in liquidityOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </template>

          <div v-if="hasTesouroFields" class="space-y-2">
            <Label>Título do Tesouro *</Label>
            <Input v-model="invForm.title" placeholder="Ex: Tesouro Selic 2029" />
          </div>

          <div class="space-y-2">
            <Label>Valor Aplicado *</Label>
            <MoneyInput v-model="invForm.applied" />
          </div>

          <div class="col-span-2 space-y-2">
            <Label>Descrição</Label>
            <Input v-model="invForm.description" placeholder="Opcional" />
          </div>
        </div>
      </template>

      <!-- Erro -->
      <Alert v-if="error" variant="destructive">
        <AlertCircleIcon class="size-4" />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <!-- Submit -->
      <Button type="submit" :disabled="loading" class="w-full">
        <Save class="h-4 w-4 mr-2" />
        {{ loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Salvar') }}
      </Button>
    </form>
  </Tabs>
</template>
