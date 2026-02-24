<script setup lang="ts">
import { Save } from 'lucide-vue-next'
import { useAccountsStore } from '~/stores/useAccounts'
import { useTagsStore } from '~/stores/useTags'
import { useTransactionsStore } from '~/stores/useTransactions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useInvestmentsStore } from '~/stores/useInvestments'
import { parseBRLToCents } from '~/utils/money'
import { nowISO } from '~/utils/dates'

const emit = defineEmits<{ saved: [] }>()

const accountsStore = useAccountsStore()
const tagsStore = useTagsStore()
const transactionsStore = useTransactionsStore()
const recurrentsStore = useRecurrentsStore()
const investmentsStore = useInvestmentsStore()

const tipoMovimentacao = ref<'transacao' | 'recorrente' | 'investimento'>('transacao')
const loading = ref(false)
const error = ref('')

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
  asset_tag: '',
  applied: '',
  current: '',
  description: '',
})

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
    accountId: null, asset_tag: '', applied: '', current: '', description: '',
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

  // Garantir tags existam
  for (const tag of txForm.tags) {
    await tagsStore.ensureTag(tag)
  }

  if (txForm.parcelado) {
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
    const tx = await transactionsStore.addTransaction({
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

    // Se já marcou como pago, ajustar saldo
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

async function submitInvestimento() {
  if (!invForm.accountId) throw new Error('Selecione uma conta')
  if (!invForm.asset_tag) throw new Error('Informe o ativo')
  if (!invForm.applied) throw new Error('Informe o valor aplicado')

  await investmentsStore.addInvestment({
    accountId: invForm.accountId,
    asset_tag: invForm.asset_tag.toUpperCase().trim(),
    applied_cents: parseBRLToCents(invForm.applied),
    current_cents: invForm.current ? parseBRLToCents(invForm.current) : undefined,
    description: invForm.description || undefined,
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
        <!-- Tipo de movimentação -->
        <TabsList class="w-full">
          <TabsTrigger value="transacao" class="flex-1" @click="tipoMovimentacao = 'transacao'">Transação</TabsTrigger>
          <TabsTrigger value="recorrente" class="flex-1" @click="tipoMovimentacao = 'recorrente'">Recorrente</TabsTrigger>
          <TabsTrigger value="investimento" class="flex-1" @click="tipoMovimentacao = 'investimento'">Investimento</TabsTrigger>
        </TabsList>

        <!-- ═══ FORM TRANSAÇÃO ═══ -->
        <template v-if="tipoMovimentacao === 'transacao'">
          <div class="grid grid-cols-2 gap-4">
            <!-- Conta -->
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

            <!-- Tipo -->
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

            <!-- Categoria -->
            <div class="space-y-2">
              <Label>Categoria *</Label>
              <Input v-model="txForm.category" placeholder="Ex: supermercado" />
            </div>

            <!-- Valor -->
            <div class="space-y-2">
              <Label>Valor *</Label>
              <Input v-model="txForm.amount" placeholder="R$ 0,00" />
            </div>

            <!-- Data -->
            <div class="space-y-2">
              <Label>Data *</Label>
              <Input v-model="txForm.date" type="date" />
            </div>

            <!-- Descrição -->
            <div class="space-y-2">
              <Label>Descrição</Label>
              <Input v-model="txForm.description" placeholder="Opcional" />
            </div>
          </div>

          <!-- Tags -->
          <div class="space-y-2">
            <Label>Tags</Label>
            <TagSelect v-model="txForm.tags" />
          </div>

          <!-- Pago -->
          <div class="flex items-center gap-2">
            <Checkbox
              :checked="txForm.paid"
              @update:checked="txForm.paid = !txForm.paid"
            />
            <Label>Pago</Label>
          </div>

          <!-- Parcelado -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <Checkbox
                :checked="txForm.parcelado"
                @update:checked="txForm.parcelado = !txForm.parcelado"
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
              <Input v-model="recForm.amount" placeholder="R$ 0,00" />
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
              @update:checked="recForm.active = !recForm.active"
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
              <Label>Ativo (Tag) *</Label>
              <Input v-model="invForm.asset_tag" placeholder="Ex: MXRF11" />
            </div>

            <div class="space-y-2">
              <Label>Valor Aplicado *</Label>
              <Input v-model="invForm.applied" placeholder="R$ 0,00" />
            </div>

            <div class="space-y-2">
              <Label>Valor Atual</Label>
              <Input v-model="invForm.current" placeholder="R$ 0,00 (opcional)" />
            </div>

            <div class="col-span-2 space-y-2">
              <Label>Descrição</Label>
              <Input v-model="invForm.description" placeholder="Opcional" />
            </div>
          </div>
        </template>

        <!-- Erro -->
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

        <!-- Submit -->
        <Button type="submit" :disabled="loading" class="w-full">
          <Save class="h-4 w-4 mr-2" />
          {{ loading ? 'Salvando...' : 'Salvar' }}
        </Button>
    </form>
  </Tabs>
</template>