<script setup lang="ts">
import { ChevronDown, ChevronRight, Filter, ChevronsUpDown, X } from 'lucide-vue-next'
import { useTransactionsStore } from '~/stores/useTransactions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useInvestmentsStore } from '~/stores/useInvestments'
import { useAccountsStore } from '~/stores/useAccounts'
import { formatCentsToBRL } from '~/utils/money'
import { monthKey } from '~/utils/dates'

const transactionsStore = useTransactionsStore()
const recurrentsStore = useRecurrentsStore()
const investmentsStore = useInvestmentsStore()
const accountsStore = useAccountsStore()

// Filtros
const filterConta = ref<number | null>(null)
const filterMes = ref('')
const filterStatus = ref<'todos' | 'pago' | 'pendente'>('todos')

// Expand state para parcelas
const expandedParents = ref<Set<string>>(new Set())

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

// Transações filtradas (agrupar parcelas pelo parentId)
const filteredTransactions = computed(() => {
  let txs = transactionsStore.transactions

  if (filterConta.value) {
    txs = txs.filter(t => t.accountId === filterConta.value)
  }
  if (filterMes.value) {
    txs = txs.filter(t => monthKey(t.date) === filterMes.value)
  }
  if (filterStatus.value === 'pago') {
    txs = txs.filter(t => t.paid)
  } else if (filterStatus.value === 'pendente') {
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
  if (filterConta.value) {
    recs = recs.filter(r => r.accountId === filterConta.value)
  }
  return recs
})

const filteredInvestments = computed(() => {
  let invs = investmentsStore.investments
  if (filterConta.value) {
    invs = invs.filter(i => i.accountId === filterConta.value)
  }
  return invs
})

const statusOptions = [
  { label: 'Todos', value: 'todos' },
  { label: 'Pago', value: 'pago' },
  { label: 'Pendente', value: 'pendente' },
]

const hasActiveFilters = computed(() =>
  filterConta.value !== null || filterMes.value !== '' || filterStatus.value !== 'todos'
)

function clearFilters() {
  filterConta.value = null
  filterMes.value = ''
  filterStatus.value = 'todos'
}
</script>

<template>
  <Card>
    <CardContent class="pt-6 space-y-4">
      <!-- Filtros -->
      <Collapsible>
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
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
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

            <Input v-model="filterMes" type="month" placeholder="Mês" />

            <Select v-model="filterStatus">
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              v-if="hasActiveFilters"
              variant="ghost"
              size="sm"
              class="gap-2"
              @click="clearFilters"
            >
              <X class="h-4 w-4" />
              Limpar
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

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
          <Table v-if="filteredTransactions.length">
            <TableHeader>
              <TableRow>
                <TableHead class="w-8"></TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead class="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-for="tx in filteredTransactions" :key="tx.id">
                <TableRow
                  class="cursor-pointer"
                  @click="tx.installment ? toggleExpand(tx.installment.parentId) : undefined"
                >
                  <TableCell>
                    <button v-if="tx.installment" type="button" class="text-muted-foreground">
                      <ChevronDown v-if="expandedParents.has(tx.installment.parentId)" class="h-4 w-4" />
                      <ChevronRight v-else class="h-4 w-4" />
                    </button>
                  </TableCell>
                  <TableCell>{{ tx.date }}</TableCell>
                  <TableCell>
                    <span v-if="tx.installment">
                      {{ tx.installment.product }} {{ tx.installment.total }}x
                    </span>
                    <span v-else>{{ tx.description || tx.category }}</span>
                  </TableCell>
                  <TableCell>{{ tx.category }}</TableCell>
                  <TableCell>{{ getAccountLabel(tx.accountId) }}</TableCell>
                  <TableCell>
                    <Badge v-if="tx.paid" variant="outline" class="text-green-500 border-green-500/30">Pago</Badge>
                    <Badge v-else variant="outline" class="text-yellow-500 border-yellow-500/30">Pendente</Badge>
                  </TableCell>
                  <TableCell class="text-right" :class="tx.amount_cents < 0 ? 'text-red-500' : 'text-green-500'">
                    {{ formatCentsToBRL(Math.abs(tx.amount_cents)) }}
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
          <Table v-if="filteredRecurrents.length">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Dia</TableHead>
                <TableHead>Status</TableHead>
                <TableHead class="text-right">Valor</TableHead>
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
              </TableRow>
            </TableBody>
          </Table>
          <p v-else class="text-center text-muted-foreground py-8">
            Nenhuma recorrente encontrada.
          </p>
        </TabsContent>

        <!-- ═══ TAB INVESTIMENTOS ═══ -->
        <TabsContent value="investimentos">
          <Table v-if="filteredInvestments.length">
            <TableHeader>
              <TableRow>
                <TableHead>Ativo</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead class="text-right">Aplicado</TableHead>
                <TableHead class="text-right">Atual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="inv in filteredInvestments" :key="inv.id">
                <TableCell>
                  <Badge>{{ inv.asset_tag }}</Badge>
                </TableCell>
                <TableCell>{{ getAccountLabel(inv.accountId) }}</TableCell>
                <TableCell>{{ inv.description ?? '—' }}</TableCell>
                <TableCell class="text-right">{{ formatCentsToBRL(inv.applied_cents) }}</TableCell>
                <TableCell class="text-right">
                  {{ inv.current_cents ? formatCentsToBRL(inv.current_cents) : '—' }}
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
</template>
