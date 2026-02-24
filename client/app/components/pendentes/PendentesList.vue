<script setup lang="ts">
import { Check, Filter, ChevronsUpDown, X } from 'lucide-vue-next'
import type { Transaction, Recurrent } from '~/schemas/zod-schemas'
import { useTransactionsStore } from '~/stores/useTransactions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useAccountsStore } from '~/stores/useAccounts'
import { formatCentsToBRL } from '~/utils/money'

const props = defineProps<{
  month: string // "YYYY-MM"
}>()

const transactionsStore = useTransactionsStore()
const recurrentsStore = useRecurrentsStore()
const accountsStore = useAccountsStore()

// Filtros
const filtersOpen = ref(false)
const filterConta = ref<number | null>(null)
const filterTipo = ref<'todos' | 'transacao' | 'recorrente'>('todos')

type PendenteItem = {
  kind: 'transaction'
  data: Transaction
} | {
  kind: 'recurrent'
  data: Recurrent
}

const pendentes = computed<PendenteItem[]>(() => {
  const items: PendenteItem[] = []

  // Transações não pagas do mês
  const unpaid = transactionsStore.unpaidForMonth(props.month)
  for (const tx of unpaid) {
    items.push({ kind: 'transaction', data: tx })
  }

  // Recorrentes ativos que ainda não têm transação nesse mês
  for (const rec of recurrentsStore.recurrents) {
    if (!rec.active) continue
    if (transactionsStore.hasRecurrentTransaction(rec.id, props.month)) continue
    items.push({ kind: 'recurrent', data: rec })
  }

  return items
})

const filteredPendentes = computed(() => {
  let items = pendentes.value

  if (filterConta.value) {
    items = items.filter(i => i.data.accountId === filterConta.value)
  }
  if (filterTipo.value === 'transacao') {
    items = items.filter(i => i.kind === 'transaction')
  } else if (filterTipo.value === 'recorrente') {
    items = items.filter(i => i.kind === 'recurrent')
  }

  return items
})

// Totais
// Saldo: total de receitas do mês (pagas + recorrentes pendentes de receita)
const saldoCents = computed(() => {
  let total = 0
  // Receitas já registradas (pagas ou não)
  for (const tx of transactionsStore.transactions) {
    if (monthKey(tx.date) === props.month && tx.amount_cents > 0) {
      total += tx.amount_cents
    }
  }
  // Recorrentes de receita que ainda não viraram transação
  for (const rec of recurrentsStore.recurrents) {
    if (!rec.active || rec.amount_cents <= 0) continue
    if (transactionsStore.hasRecurrentTransaction(rec.id, props.month)) continue
    total += rec.amount_cents
  }
  return total
})

// Total pendente: despesas ainda não pagas (transações + recorrentes de despesa sem tx)
const totalPendenteCents = computed(() => {
  let total = 0
  // Transações de despesa não pagas do mês
  for (const tx of transactionsStore.unpaidForMonth(props.month)) {
    if (tx.amount_cents < 0) total += Math.abs(tx.amount_cents)
  }
  // Recorrentes de despesa que ainda não viraram transação
  for (const rec of recurrentsStore.recurrents) {
    if (!rec.active || rec.amount_cents >= 0) continue
    if (transactionsStore.hasRecurrentTransaction(rec.id, props.month)) continue
    total += Math.abs(rec.amount_cents)
  }
  return total
})

// Total pago: despesas pagas no mês
const totalPagoCents = computed(() => {
  let total = 0
  for (const tx of transactionsStore.transactions) {
    if (monthKey(tx.date) === props.month && tx.paid && tx.amount_cents < 0) {
      total += Math.abs(tx.amount_cents)
    }
  }
  return total
})

// Ações
const payingId = ref<string | null>(null)

async function handlePay(item: PendenteItem) {
  payingId.value = item.data.id
  try {
    if (item.kind === 'transaction') {
      await transactionsStore.markPaid(item.data.id)
    } else {
      await transactionsStore.payRecurrent(item.data as Recurrent, props.month)
    }
  } finally {
    payingId.value = null
  }
}

function getAccountLabel(accountId: number) {
  return accountsStore.accounts.find(a => a.id === accountId)?.label ?? '—'
}

function getItemLabel(item: PendenteItem): string {
  if (item.kind === 'recurrent') {
    return (item.data as Recurrent).name
  }
  const tx = item.data as Transaction
  if (tx.installment) {
    return `${tx.installment.product} (${tx.installment.index}/${tx.installment.total})`
  }
  return tx.description || tx.category
}

function getItemDate(item: PendenteItem): string {
  if (item.kind === 'transaction') return (item.data as Transaction).date
  const rec = item.data as Recurrent
  if (rec.day_of_month) return `Dia ${rec.day_of_month}`
  return '—'
}

// Filtros helpers
const tipoOptions = [
  { label: 'Todos', value: 'todos' },
  { label: 'Transação', value: 'transacao' },
  { label: 'Recorrente', value: 'recorrente' },
]

const hasActiveFilters = computed(() =>
  filterConta.value !== null || filterTipo.value !== 'todos'
)

function clearFilters() {
  filterConta.value = null
  filterTipo.value = 'todos'
}

// Import monthKey for use in computed
import { monthKey } from '~/utils/dates'
</script>

<template>
  <div class="space-y-4">
    <!-- Cards resumo -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent class="pt-6">
          <p class="text-sm text-muted-foreground">Saldo</p>
          <p class="text-2xl font-bold text-green-500">
            {{ formatCentsToBRL(saldoCents) }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">total recebido / a receber no mês</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="pt-6">
          <p class="text-sm text-muted-foreground">Total Pendente</p>
          <p class="text-2xl font-bold text-yellow-500">
            {{ formatCentsToBRL(totalPendenteCents) }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            {{ filteredPendentes.length }} {{ filteredPendentes.length === 1 ? 'item' : 'itens' }} a pagar
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="pt-6">
          <p class="text-sm text-muted-foreground">Total Pago</p>
          <p class="text-2xl font-bold text-blue-500">
            {{ formatCentsToBRL(totalPagoCents) }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">contas pagas no mês</p>
        </CardContent>
      </Card>
    </div>

    <!-- Lista -->
    <Card>
      <CardContent class="pt-6 space-y-4">
        <!-- Filtros -->
        <Collapsible v-model:open="filtersOpen">
          <CollapsibleTrigger as-child>
            <Button variant="ghost" size="sm" class="flex items-center gap-2 w-full justify-between">
              <span class="flex items-center gap-2">
                <Filter class="h-4 w-4" />
                Filtros
              </span>
              <ChevronsUpDown class="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent class="pt-3">
            <div class="grid grid-cols-2 gap-3">
              <Select v-model="filterConta">
                <SelectTrigger>
                  <SelectValue placeholder="Conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="null">Todas</SelectItem>
                  <SelectItem v-for="acc in accountsStore.accounts" :key="acc.id" :value="acc.id">
                    {{ acc.label }}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select v-model="filterTipo">
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt in tipoOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              v-if="hasActiveFilters"
              variant="ghost"
              size="sm"
              class="gap-2 mt-2 ml-auto"
              @click="clearFilters"
            >
              <X class="h-4 w-4" />
              Limpar filtros
            </Button>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        <!-- Tabela -->
        <Table v-if="filteredPendentes.length">
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>Data/Dia</TableHead>
              <TableHead class="text-right">Valor</TableHead>
              <TableHead class="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="item in filteredPendentes" :key="item.data.id">
              <TableCell>{{ getItemLabel(item) }}</TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {{ item.kind === 'recurrent' ? 'Recorrente' : 'Transação' }}
                </Badge>
              </TableCell>
              <TableCell>{{ getAccountLabel(item.data.accountId) }}</TableCell>
              <TableCell>{{ getItemDate(item) }}</TableCell>
              <TableCell class="text-right" :class="item.data.amount_cents < 0 ? 'text-red-500' : 'text-green-500'">
                {{ formatCentsToBRL(Math.abs(item.data.amount_cents)) }}
              </TableCell>
              <TableCell class="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  class="gap-1.5"
                  :disabled="payingId === item.data.id"
                  @click="handlePay(item)"
                >
                  <Check class="h-3.5 w-3.5" />
                  {{ payingId === item.data.id ? 'Pagando...' : 'Pagar' }}
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p v-else class="text-center text-muted-foreground py-8">
          Nenhum pendente encontrado para este mês.
        </p>
      </CardContent>
    </Card>
  </div>
</template>
