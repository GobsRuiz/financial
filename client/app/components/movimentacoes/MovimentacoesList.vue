<script setup lang="ts">
import { ChevronDown, ChevronRight, Filter, ChevronsUpDown, X, MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-vue-next'
import type { Transaction, Recurrent, InvestmentEvent } from '~/schemas/zod-schemas'
import { useTransactionsStore } from '~/stores/useTransactions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useInvestmentPositionsStore } from '~/stores/useInvestmentPositions'
import { useInvestmentEventsStore } from '~/stores/useInvestmentEvents'
import { useAccountsStore } from '~/stores/useAccounts'
import { formatCentsToBRL } from '~/utils/money'
import { monthKey } from '~/utils/dates'
import { useAppToast } from '~/composables/useAppToast'

const emit = defineEmits<{
  'edit-transaction': [tx: Transaction]
  'edit-recurrent': [rec: Recurrent]
  'tab-change': [tab: 'transacoes' | 'recorrentes' | 'investimentos']
}>()

const transactionsStore = useTransactionsStore()
const recurrentsStore = useRecurrentsStore()
const investmentPositionsStore = useInvestmentPositionsStore()
const investmentEventsStore = useInvestmentEventsStore()
const accountsStore = useAccountsStore()
const appToast = useAppToast()

// Estado dos filtros abertos por tab
const txFiltersOpen = ref(false)
const recFiltersOpen = ref(false)
const invFiltersOpen = ref(false)
const activeTab = ref<'transacoes' | 'recorrentes' | 'investimentos'>('transacoes')

// ── Filtros Transações ──
const txFilterConta = ref<number | null>(null)
const txFilterMes = ref('')
const txFilterStatus = ref<'todos' | 'pago' | 'pendente'>('todos')

// ── Filtros Recorrentes ──
const recFilterConta = ref<number | null>(null)
const recFilterStatus = ref<'todos' | 'ativo' | 'inativo'>('todos')

// ── Filtros Investimentos ──
const invFilterConta = ref<number | null>(null)

// Expand state para parcelas
const expandedParents = ref<Set<string>>(new Set())

// ── Visualização Transação ──
const viewingTransaction = ref<Transaction | null>(null)
const transactionViewDialogOpen = ref(false)

function openViewTransaction(tx: Transaction) {
  viewingTransaction.value = tx
  transactionViewDialogOpen.value = true
}

const viewingRecurrent = ref<Recurrent | null>(null)
const recurrentViewDialogOpen = ref(false)

function openViewRecurrent(rec: Recurrent) {
  viewingRecurrent.value = rec
  recurrentViewDialogOpen.value = true
}

// ── Confirm Delete ──
const confirmDeleteOpen = ref(false)
const deleteTarget = ref<{ type: 'transaction' | 'installment-group' | 'recurrent' | 'investment-event'; id: string; label: string } | null>(null)

function toggleExpand(parentId: string) {
  if (expandedParents.value.has(parentId)) {
    expandedParents.value.delete(parentId)
  } else {
    expandedParents.value.add(parentId)
  }
}

function getAccountLabel(accountId: number) {
  return accountsStore.accounts.find(a => a.id === accountId)?.label ?? '—'
}

function getPositionLabel(positionId: string) {
  const p = investmentPositionsStore.positions.find(pos => pos.id === positionId)
  if (!p) return '—'
  return p.name?.trim() ? `${p.asset_code} · ${p.name}` : p.asset_code
}

function getPositionBucketLabel(positionId: string) {
  const p = investmentPositionsStore.positions.find(pos => pos.id === positionId)
  if (!p) return '—'
  return p.bucket === 'variable' ? 'Renda Variável' : 'Renda Fixa'
}

// ── Ações ──
function requestDelete(type: 'transaction' | 'installment-group' | 'recurrent' | 'investment-event', id: string, label: string) {
  deleteTarget.value = { type, id, label }
  confirmDeleteOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value) return

  try {
    const { type, id } = deleteTarget.value
    if (type === 'transaction') {
      await transactionsStore.deleteTransaction(id)
    } else if (type === 'installment-group') {
      await transactionsStore.deleteInstallmentGroup(id)
    } else if (type === 'recurrent') {
      await recurrentsStore.deleteRecurrent(id)
    } else {
      await investmentEventsStore.deleteEvent(id)
    }
    appToast.success({ title: 'Excluído com sucesso' })
  } catch (e: any) {
    appToast.error({ title: 'Erro ao excluir', description: e.message })
  } finally {
    confirmDeleteOpen.value = false
    deleteTarget.value = null
  }
}

// Transações filtradas (agrupar parcelas pelo parentId)
const filteredTransactions = computed(() => {
  let txs = transactionsStore.transactions

  if (txFilterConta.value) {
    txs = txs.filter(t => t.accountId === txFilterConta.value)
  }
  if (txFilterMes.value) {
    txs = txs.filter(t => monthKey(t.date) === txFilterMes.value)
  }
  if (txFilterStatus.value === 'pago') {
    txs = txs.filter(t => t.paid)
  } else if (txFilterStatus.value === 'pendente') {
    txs = txs.filter(t => !t.paid)
  }

  // Agrupar: mostrar apenas 1 linha por parentId (a primeira parcela)
  const seen = new Set<string>()
  return txs.filter(t => {
    if (t.installment?.parentId) {
      if (seen.has(t.installment.parentId)) return false
      seen.add(t.installment.parentId)
    }
    return true
  })
})

const filteredRecurrents = computed(() => {
  let recs = recurrentsStore.recurrents
  if (recFilterConta.value) {
    recs = recs.filter(r => r.accountId === recFilterConta.value)
  }
  if (recFilterStatus.value === 'ativo') {
    recs = recs.filter(r => r.active)
  } else if (recFilterStatus.value === 'inativo') {
    recs = recs.filter(r => !r.active)
  }
  return recs
})

const filteredInvestments = computed(() => {
  let invs = investmentEventsStore.events
  if (invFilterConta.value) {
    invs = invs.filter(i => i.accountId === invFilterConta.value)
  }
  return [...invs].sort((a, b) => b.date.localeCompare(a.date))
})

const txStatusOptions = [
  { label: 'Todos', value: 'todos' },
  { label: 'Pago', value: 'pago' },
  { label: 'Pendente', value: 'pendente' },
]

const recStatusOptions = [
  { label: 'Todos', value: 'todos' },
  { label: 'Ativo', value: 'ativo' },
  { label: 'Inativo', value: 'inativo' },
]

const hasTxFilters = computed(() =>
  txFilterConta.value !== null || txFilterMes.value !== '' || txFilterStatus.value !== 'todos'
)
const hasRecFilters = computed(() =>
  recFilterConta.value !== null || recFilterStatus.value !== 'todos'
)
const hasInvFilters = computed(() =>
  invFilterConta.value !== null
)

function clearTxFilters() {
  txFilterConta.value = null
  txFilterMes.value = ''
  txFilterStatus.value = 'todos'
}
function clearRecFilters() {
  recFilterConta.value = null
  recFilterStatus.value = 'todos'
}
function clearInvFilters() {
  invFilterConta.value = null
}

watch(activeTab, (tab) => {
  emit('tab-change', tab)
}, { immediate: true })
</script>

<template>
  <div>
  <Card>
    <CardContent class="pt-6 space-y-4">
      <!-- Tabs por tipo -->
      <Tabs v-model="activeTab">
        <TabsList class="w-full justify-start">
          <TabsTrigger value="transacoes">
            Transações
            <Badge v-if="filteredTransactions.length" variant="secondary" class="ml-2 text-xs">
              {{ filteredTransactions.length }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="recorrentes">
            Recorrentes
            <Badge v-if="filteredRecurrents.length" variant="secondary" class="ml-2 text-xs">
              {{ filteredRecurrents.length }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="investimentos">
            Investimentos
            <Badge v-if="filteredInvestments.length" variant="secondary" class="ml-2 text-xs">
              {{ filteredInvestments.length }}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <!-- ═══ TAB TRANSAÇÕES ═══ -->
        <TabsContent value="transacoes">
          <!-- Filtros Transações -->
          <Collapsible v-model:open="txFiltersOpen" class="mb-4">
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
              <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Select v-model="txFilterConta">
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

                <Input v-model="txFilterMes" type="month" placeholder="Mês" />

                <Select v-model="txFilterStatus">
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="opt in txStatusOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                v-if="hasTxFilters"
                variant="ghost"
                size="sm"
                class="gap-2 mt-2 ml-auto"
                @click="clearTxFilters"
              >
                <X class="h-4 w-4" />
                Limpar filtros
              </Button>
            </CollapsibleContent>
          </Collapsible>
          <Table v-if="filteredTransactions.length">
            <TableHeader>
              <TableRow>
                <TableHead class="w-8"></TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead class="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-for="tx in filteredTransactions" :key="tx.id">
                <TableRow
                  class="cursor-pointer"
                  @click="tx.installment ? toggleExpand(tx.installment.parentId) : openViewTransaction(tx)"
                >
                  <TableCell>
                    <button v-if="tx.installment" type="button" class="text-muted-foreground">
                      <ChevronDown v-if="expandedParents.has(tx.installment.parentId)" class="h-4 w-4" />
                      <ChevronRight v-else class="h-4 w-4" />
                    </button>
                  </TableCell>
                  <TableCell :class="tx.type === 'income' ? 'text-green-500' : 'text-red-500'">
                    {{ formatCentsToBRL(tx.installment ? tx.amount_cents * tx.installment.total : tx.amount_cents) }}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {{ tx.type === 'expense' ? 'Despesa' : tx.type === 'income' ? 'Receita' : 'Transferência' }}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge v-if="tx.payment_method === 'credit'" variant="secondary">Crédito</Badge>
                    <Badge v-else-if="tx.payment_method === 'debit'" variant="secondary">Débito</Badge>
                    <span v-else class="text-muted-foreground">—</span>
                  </TableCell>
                  <TableCell>
                    <Badge v-if="tx.paid" variant="outline" class="text-green-500 border-green-500/30">Pago</Badge>
                    <Badge v-else variant="outline" class="text-yellow-500 border-yellow-500/30">Pendente</Badge>
                  </TableCell>
                  <TableCell>{{ tx.date }}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button variant="ghost" size="icon" class="h-8 w-8" @click.stop>
                          <MoreHorizontal class="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem @click.stop="openViewTransaction(tx)">
                          <Eye class="h-4 w-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem @click.stop="emit('edit-transaction', tx)">
                          <Pencil class="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          @click.stop="tx.installment
                            ? requestDelete('installment-group', tx.installment.parentId, `${tx.installment.product} ${tx.installment.total}x`)
                            : requestDelete('transaction', tx.id, tx.description || 'Transacao')"
                        >
                          <Trash2 class="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                <!-- Parcelas expandidas -->
                <TableRow v-if="tx.installment && expandedParents.has(tx.installment.parentId)" :key="`${tx.id}-expand`">
                  <TableCell colspan="7" class="p-0 pt-0 pb-2">
                    <ParcelasExpansion :parent-id="tx.installment.parentId" />
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
          <p v-else class="text-center text-muted-foreground py-8">
            Nenhuma transação encontrada.
          </p>
        </TabsContent>

        <!-- ═══ TAB RECORRENTES ═══ -->
        <TabsContent value="recorrentes">
          <!-- Filtros Recorrentes -->
          <Collapsible v-model:open="recFiltersOpen" class="mb-4">
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
                <Select v-model="recFilterConta">
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

                <Select v-model="recFilterStatus">
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="opt in recStatusOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                v-if="hasRecFilters"
                variant="ghost"
                size="sm"
                class="gap-2 mt-2 ml-auto"
                @click="clearRecFilters"
              >
                <X class="h-4 w-4" />
                Limpar filtros
              </Button>
            </CollapsibleContent>
          </Collapsible>

          <Table v-if="filteredRecurrents.length">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Dia</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notificar</TableHead>
                <TableHead class="text-right">Valor</TableHead>
                <TableHead class="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="rec in filteredRecurrents"
                :key="rec.id"
                class="cursor-pointer"
                @click="openViewRecurrent(rec)"
              >
                <TableCell>{{ rec.name }}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{{ rec.kind === 'expense' ? 'Despesa' : 'Receita' }}</Badge>
                </TableCell>
                <TableCell>{{ getAccountLabel(rec.accountId) }}</TableCell>
                <TableCell>{{ rec.due_day ?? rec.day_of_month ?? '—' }}</TableCell>
                <TableCell>
                  <Badge v-if="rec.active" variant="outline" class="text-green-500 border-green-500/30">Ativo</Badge>
                  <Badge v-else variant="outline" class="text-muted-foreground">Inativo</Badge>
                </TableCell>
                <TableCell>
                  <Badge v-if="rec.notify" variant="outline" class="text-blue-500 border-blue-500/30">Sim</Badge>
                  <Badge v-else variant="outline" class="text-muted-foreground">Não</Badge>
                </TableCell>
                <TableCell class="text-right" :class="rec.amount_cents < 0 ? 'text-red-500' : 'text-green-500'">
                  {{ formatCentsToBRL(rec.amount_cents) }}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button variant="ghost" size="icon" class="h-8 w-8" @click.stop>
                          <MoreHorizontal class="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                      <DropdownMenuItem @click.stop="openViewRecurrent(rec)">
                        <Eye class="h-4 w-4 mr-2" />
                        Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem @click.stop="emit('edit-recurrent', rec)">
                        <Pencil class="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        @click.stop="requestDelete('recurrent', rec.id, rec.name)"
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
          <p v-else class="text-center text-muted-foreground py-8">
            Nenhuma recorrente encontrada.
          </p>
        </TabsContent>

        <!-- ═══ TAB INVESTIMENTOS ═══ -->
        <TabsContent value="investimentos">
          <!-- Filtros Investimentos -->
          <Collapsible v-model:open="invFiltersOpen" class="mb-4">
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
              <div class="grid grid-cols-1 gap-3">
                <Select v-model="invFilterConta">
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
              </div>
              <Button
                v-if="hasInvFilters"
                variant="ghost"
                size="sm"
                class="gap-2 mt-2 ml-auto"
                @click="clearInvFilters"
              >
                <X class="h-4 w-4" />
                Limpar filtros
              </Button>
            </CollapsibleContent>
          </Collapsible>

          <Table v-if="filteredInvestments.length">
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Posição</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead class="text-right">Qtd</TableHead>
                <TableHead class="text-right">Preço Unit.</TableHead>
                <TableHead class="text-right">Valor</TableHead>
                <TableHead class="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="inv in filteredInvestments" :key="inv.id">
                <TableCell>{{ inv.date }}</TableCell>
                <TableCell>{{ getPositionLabel(inv.positionId) }}</TableCell>
                <TableCell><Badge variant="secondary">{{ getPositionBucketLabel(inv.positionId) }}</Badge></TableCell>
                <TableCell>{{ getAccountLabel(inv.accountId) }}</TableCell>
                <TableCell><Badge variant="outline">{{ inv.event_type }}</Badge></TableCell>
                <TableCell class="text-right">{{ inv.quantity ?? '—' }}</TableCell>
                <TableCell class="text-right">{{ inv.unit_price_cents ? formatCentsToBRL(inv.unit_price_cents) : '—' }}</TableCell>
                <TableCell class="text-right">{{ formatCentsToBRL(inv.amount_cents) }}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" class="h-8 w-8">
                        <MoreHorizontal class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        variant="destructive"
                        @click="requestDelete('investment-event', inv.id, getPositionLabel(inv.positionId))"
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
          <p v-else class="text-center text-muted-foreground py-8">
            Nenhum investimento encontrado.
          </p>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>

  <!-- Modal Visualização Transação -->
  <Dialog v-model:open="transactionViewDialogOpen">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Detalhes da Transação</DialogTitle>
        <DialogDescription>Informações completas da movimentação</DialogDescription>
      </DialogHeader>
      <div v-if="viewingTransaction" class="space-y-4 text-sm">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Valor</p>
            <p class="mt-1 text-lg font-semibold" :class="viewingTransaction.type === 'income' ? 'text-green-500' : 'text-red-500'">
              {{ formatCentsToBRL(viewingTransaction.amount_cents) }}
            </p>
          </div>

          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Tipo</p>
            <p class="mt-1 font-medium">{{ viewingTransaction.type === 'expense' ? 'Despesa' : viewingTransaction.type === 'income' ? 'Receita' : 'Transferência' }}</p>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Método</p>
            <p class="mt-1 font-medium">{{ viewingTransaction.payment_method === 'credit' ? 'Crédito' : viewingTransaction.payment_method === 'debit' ? 'Débito' : '—' }}</p>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
            <div class="mt-1">
              <Badge v-if="viewingTransaction.paid" variant="outline" class="text-green-500 border-green-500/30">Pago</Badge>
              <Badge v-else variant="outline" class="text-yellow-500 border-yellow-500/30">Pendente</Badge>
            </div>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Data</p>
            <p class="mt-1 font-medium">{{ viewingTransaction.date }}</p>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2 sm:col-span-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Conta</p>
            <p class="mt-1 font-medium">{{ getAccountLabel(viewingTransaction.accountId) }}</p>
          </div>
        </div>

        <div class="space-y-2">
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Descrição</p>
            <p class="mt-1 font-medium">{{ viewingTransaction.description || '—' }}</p>
          </div>


          <div v-if="viewingTransaction.installment" class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Parcela</p>
            <p class="mt-1 font-medium">{{ viewingTransaction.installment.index }}/{{ viewingTransaction.installment.total }} — {{ viewingTransaction.installment.product }}</p>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Modal VisualizaÃ§Ã£o Recorrente -->
  <Dialog v-model:open="recurrentViewDialogOpen">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Detalhes da Recorrente</DialogTitle>
        <DialogDescription>InformaÃ§Ãµes completas da movimentaÃ§Ã£o</DialogDescription>
      </DialogHeader>
      <div v-if="viewingRecurrent" class="space-y-4 text-sm">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Valor</p>
            <p class="mt-1 text-lg font-semibold" :class="viewingRecurrent.amount_cents < 0 ? 'text-red-500' : 'text-green-500'">
              {{ formatCentsToBRL(viewingRecurrent.amount_cents) }}
            </p>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Tipo</p>
            <p class="mt-1 font-medium">{{ viewingRecurrent.kind === 'expense' ? 'Despesa' : 'Receita' }}</p>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
            <div class="mt-1">
              <Badge v-if="viewingRecurrent.active" variant="outline" class="text-green-500 border-green-500/30">Ativo</Badge>
              <Badge v-else variant="outline" class="text-muted-foreground">Inativo</Badge>
            </div>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">FrequÃªncia</p>
            <p class="mt-1 font-medium">{{ viewingRecurrent.frequency === 'monthly' ? 'Mensal' : viewingRecurrent.frequency }}</p>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Vencimento</p>
            <p class="mt-1 font-medium">{{ viewingRecurrent.due_day ?? viewingRecurrent.day_of_month ?? 'â€”' }}</p>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2 sm:col-span-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Conta</p>
            <p class="mt-1 font-medium">{{ getAccountLabel(viewingRecurrent.accountId) }}</p>
          </div>
        </div>

        <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
          <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Nome</p>
          <p class="mt-1 font-medium">{{ viewingRecurrent.name }}</p>
        </div>

        <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
          <p class="text-[11px] uppercase tracking-wide text-muted-foreground">DescriÃ§Ã£o</p>
          <p class="mt-1 font-medium">{{ viewingRecurrent.description || 'â€”' }}</p>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Confirm Delete Dialog -->
  <ConfirmDialog
    :open="confirmDeleteOpen"
    title="Excluir item?"
    :description="`Deseja excluir '${deleteTarget?.label}'? Esta ação não pode ser desfeita.`"
    confirm-label="Sim, excluir"
    cancel-label="Cancelar"
    :destructive="true"
    @confirm="confirmDelete"
    @cancel="confirmDeleteOpen = false"
  />
  </div>
</template>


