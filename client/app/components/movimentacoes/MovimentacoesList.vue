<script setup lang="ts">
import { ChevronDown, ChevronRight, Filter, ChevronsUpDown, X, MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-vue-next'
import type { Transaction, Recurrent, Investment } from '~/schemas/zod-schemas'
import { useTransactionsStore } from '~/stores/useTransactions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useInvestmentsStore } from '~/stores/useInvestments'
import { useAccountsStore } from '~/stores/useAccounts'
import { formatCentsToBRL } from '~/utils/money'
import { monthKey } from '~/utils/dates'
import { useAppToast } from '~/composables/useAppToast'

const emit = defineEmits<{
  'edit-transaction': [tx: Transaction]
  'edit-recurrent': [rec: Recurrent]
  'edit-investment': [inv: Investment]
}>()

const transactionsStore = useTransactionsStore()
const recurrentsStore = useRecurrentsStore()
const investmentsStore = useInvestmentsStore()
const accountsStore = useAccountsStore()
const appToast = useAppToast()

// Estado dos filtros abertos por tab
const txFiltersOpen = ref(false)
const recFiltersOpen = ref(false)
const invFiltersOpen = ref(false)

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
const viewDialogOpen = ref(false)

function openViewTransaction(tx: Transaction) {
  viewingTransaction.value = tx
  viewDialogOpen.value = true
}

// ── Confirm Delete ──
const confirmDeleteOpen = ref(false)
const deleteTarget = ref<{ type: 'transaction' | 'recurrent' | 'investment'; id: string; label: string } | null>(null)

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

function getInvestmentTypeLabel(type?: Investment['investment_type']) {
  const map: Record<string, string> = {
    fii: 'FII',
    cripto: 'Cripto',
    caixinha: 'Caixinha',
    cdb: 'CDB',
    cdi: 'CDI',
    tesouro: 'Tesouro',
    lci: 'LCI',
    lca: 'LCA',
    outro: 'Outro',
  }
  return map[type ?? 'outro'] ?? 'Outro'
}

function getInvestmentDetailsSummary(inv: Investment) {
  const quantity = inv.details?.quantity
  if (quantity != null) return `${quantity} unidades`
  if (inv.details?.indexer || inv.details?.rate_percent != null) {
    const indexer = inv.details.indexer ?? '—'
    const rate = inv.details.rate_percent != null ? `${inv.details.rate_percent}%` : '—'
    return `${indexer} • ${rate}`
  }
  return inv.description ?? '—'
}

// ── Ações ──
function requestDelete(type: 'transaction' | 'recurrent' | 'investment', id: string, label: string) {
  deleteTarget.value = { type, id, label }
  confirmDeleteOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value) return

  try {
    const { type, id } = deleteTarget.value
    if (type === 'transaction') {
      await transactionsStore.deleteTransaction(id)
    } else if (type === 'recurrent') {
      await recurrentsStore.deleteRecurrent(id)
    } else {
      await investmentsStore.deleteInvestment(id)
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
  let invs = investmentsStore.investments
  if (invFilterConta.value) {
    invs = invs.filter(i => i.accountId === invFilterConta.value)
  }
  return invs
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
</script>

<template>
  <div>
  <Card>
    <CardContent class="pt-6 space-y-4">
      <!-- Tabs por tipo -->
      <Tabs default-value="transacoes">
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
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Conta</TableHead>
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
                  <TableCell :class="tx.amount_cents < 0 ? 'text-red-500' : 'text-green-500'">
                    {{ formatCentsToBRL(Math.abs(tx.amount_cents)) }}
                  </TableCell>
                  <TableCell>{{ tx.category }}</TableCell>
                  <TableCell>
                    <span v-if="tx.installment">
                      {{ tx.installment.product }} {{ tx.installment.total }}x
                    </span>
                    <span v-else>{{ tx.description || '—' }}</span>
                  </TableCell>
                  <TableCell>
                    <Badge v-if="tx.paid" variant="outline" class="text-green-500 border-green-500/30">Pago</Badge>
                    <Badge v-else variant="outline" class="text-yellow-500 border-yellow-500/30">Pendente</Badge>
                  </TableCell>
                  <TableCell>{{ tx.date }}</TableCell>
                  <TableCell>
                    <div v-if="tx.tags?.length" class="flex flex-wrap gap-1">
                      <Badge v-for="tag in tx.tags" :key="tag" variant="secondary" class="text-xs">
                        {{ tag }}
                      </Badge>
                    </div>
                    <span v-else class="text-muted-foreground">—</span>
                  </TableCell>
                  <TableCell>{{ getAccountLabel(tx.accountId) }}</TableCell>
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
                          @click.stop="requestDelete('transaction', tx.id, tx.description || tx.category)"
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
                  <TableCell colspan="9" class="p-0 pt-0 pb-2">
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
                <TableHead class="text-right">Valor</TableHead>
                <TableHead class="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="rec in filteredRecurrents" :key="rec.id">
                <TableCell>{{ rec.name }}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{{ rec.kind }}</Badge>
                </TableCell>
                <TableCell>{{ getAccountLabel(rec.accountId) }}</TableCell>
                <TableCell>{{ rec.day_of_month ?? '—' }}</TableCell>
                <TableCell>
                  <Badge v-if="rec.active" variant="outline" class="text-green-500 border-green-500/30">Ativo</Badge>
                  <Badge v-else variant="outline" class="text-muted-foreground">Inativo</Badge>
                </TableCell>
                <TableCell class="text-right" :class="rec.amount_cents < 0 ? 'text-red-500' : 'text-green-500'">
                  {{ formatCentsToBRL(Math.abs(rec.amount_cents)) }}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" class="h-8 w-8">
                        <MoreHorizontal class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @click="emit('edit-recurrent', rec)">
                        <Pencil class="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        @click="requestDelete('recurrent', rec.id, rec.name)"
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
                <TableHead>Ativo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Resumo</TableHead>
                <TableHead class="text-right">Aplicado</TableHead>
                <TableHead class="text-right">Atual</TableHead>
                <TableHead class="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="inv in filteredInvestments" :key="inv.id">
                <TableCell>
                  <Badge>{{ inv.asset_tag }}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{{ getInvestmentTypeLabel(inv.investment_type) }}</Badge>
                </TableCell>
                <TableCell>{{ getAccountLabel(inv.accountId) }}</TableCell>
                <TableCell>{{ getInvestmentDetailsSummary(inv) }}</TableCell>
                <TableCell class="text-right">{{ formatCentsToBRL(inv.applied_cents) }}</TableCell>
                <TableCell class="text-right">
                  {{ inv.current_cents ? formatCentsToBRL(inv.current_cents) : '—' }}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" class="h-8 w-8">
                        <MoreHorizontal class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @click="emit('edit-investment', inv)">
                        <Pencil class="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        @click="requestDelete('investment', inv.id, inv.asset_tag)"
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
  <Dialog v-model:open="viewDialogOpen">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Detalhes da Transação</DialogTitle>
        <DialogDescription>Informações completas da movimentação</DialogDescription>
      </DialogHeader>
      <div v-if="viewingTransaction" class="space-y-3 text-sm">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <p class="text-muted-foreground">Valor</p>
            <p class="font-medium" :class="viewingTransaction.amount_cents < 0 ? 'text-red-500' : 'text-green-500'">
              {{ formatCentsToBRL(Math.abs(viewingTransaction.amount_cents)) }}
            </p>
          </div>
          <div>
            <p class="text-muted-foreground">Tipo</p>
            <p class="font-medium">{{ viewingTransaction.type === 'expense' ? 'Despesa' : viewingTransaction.type === 'income' ? 'Receita' : 'Transferência' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Categoria</p>
            <p class="font-medium">{{ viewingTransaction.category }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Data</p>
            <p class="font-medium">{{ viewingTransaction.date }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Conta</p>
            <p class="font-medium">{{ getAccountLabel(viewingTransaction.accountId) }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Status</p>
            <Badge v-if="viewingTransaction.paid" variant="outline" class="text-green-500 border-green-500/30">Pago</Badge>
            <Badge v-else variant="outline" class="text-yellow-500 border-yellow-500/30">Pendente</Badge>
          </div>
        </div>
        <div v-if="viewingTransaction.description">
          <p class="text-muted-foreground">Descrição</p>
          <p class="font-medium">{{ viewingTransaction.description }}</p>
        </div>
        <div v-if="viewingTransaction.tags?.length">
          <p class="text-muted-foreground mb-1">Tags</p>
          <div class="flex flex-wrap gap-1">
            <Badge v-for="tag in viewingTransaction.tags" :key="tag" variant="secondary">
              {{ tag }}
            </Badge>
          </div>
        </div>
        <div v-if="viewingTransaction.installment">
          <p class="text-muted-foreground">Parcela</p>
          <p class="font-medium">{{ viewingTransaction.installment.index }}/{{ viewingTransaction.installment.total }} — {{ viewingTransaction.installment.product }}</p>
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
