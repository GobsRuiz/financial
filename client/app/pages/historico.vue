<script setup lang="ts">
import { History, Filter, ChevronsUpDown, X, Search } from 'lucide-vue-next'
import { useAccountsStore } from '~/stores/useAccounts'
import { useTransactionsStore } from '~/stores/useTransactions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useInvestmentsStore } from '~/stores/useInvestments'
import { useHistoryStore } from '~/stores/useHistory'
import { formatCentsToBRL } from '~/utils/money'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const recurrentsStore = useRecurrentsStore()
const investmentsStore = useInvestmentsStore()
const historyStore = useHistoryStore()

const loading = ref(true)

// Busca global
const searchQuery = ref('')

// Filtros por tab
const txFilterConta = ref<number | null>(null)
const recFilterConta = ref<number | null>(null)
const invFilterConta = ref<number | null>(null)
const histFilterConta = ref<number | null>(null)

const txFiltersOpen = ref(false)
const recFiltersOpen = ref(false)
const invFiltersOpen = ref(false)
const histFiltersOpen = ref(false)

onMounted(async () => {
  try {
    await Promise.all([
      accountsStore.loadAccounts(),
      transactionsStore.loadTransactions(),
      recurrentsStore.loadRecurrents(),
      investmentsStore.loadInvestments(),
      historyStore.loadHistory(),
    ])
  } finally {
    loading.value = false
  }
})

function getAccountLabel(accountId: number) {
  return accountsStore.accounts.find(a => a.id === accountId)?.label ?? '—'
}

function getInvestmentTypeLabel(type?: string) {
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

function getInvestmentSummary(inv: (typeof investmentsStore.investments)[number]) {
  const quantity = inv.details?.quantity
  if (quantity != null) return `${quantity} unidades`
  if (inv.details?.indexer || inv.details?.rate_percent != null) {
    const indexer = inv.details.indexer ?? '—'
    const rate = inv.details.rate_percent != null ? `${inv.details.rate_percent}%` : '—'
    return `${indexer} • ${rate}`
  }
  return inv.description ?? '—'
}

const q = computed(() => searchQuery.value.toLowerCase().trim())

// Transações filtradas
const filteredTransactions = computed(() => {
  let txs = transactionsStore.transactions
  if (txFilterConta.value) txs = txs.filter(t => t.accountId === txFilterConta.value)
  if (q.value) {
    txs = txs.filter(t =>
      (t.description ?? '').toLowerCase().includes(q.value)
      || t.category.toLowerCase().includes(q.value)
      || t.installment?.product.toLowerCase().includes(q.value)
    )
  }
  return [...txs].sort((a, b) => b.date.localeCompare(a.date))
})

// Recorrentes filtrados
const filteredRecurrents = computed(() => {
  let recs = recurrentsStore.recurrents
  if (recFilterConta.value) recs = recs.filter(r => r.accountId === recFilterConta.value)
  if (q.value) {
    recs = recs.filter(r =>
      r.name.toLowerCase().includes(q.value)
      || (r.description ?? '').toLowerCase().includes(q.value)
    )
  }
  return recs
})

// Investimentos filtrados
const filteredInvestments = computed(() => {
  let invs = investmentsStore.investments
  if (invFilterConta.value) invs = invs.filter(i => i.accountId === invFilterConta.value)
  if (q.value) {
    invs = invs.filter(i =>
      i.asset_tag.toLowerCase().includes(q.value)
      || (i.description ?? '').toLowerCase().includes(q.value)
      || (i.investment_type ?? 'outro').toLowerCase().includes(q.value)
      || (i.details?.indexer ?? '').toLowerCase().includes(q.value)
    )
  }
  return invs
})

// Histórico de saldo filtrado
const filteredHistory = computed(() => {
  let items = historyStore.history
  if (histFilterConta.value) items = items.filter(h => h.accountId === histFilterConta.value)
  if (q.value) {
    items = items.filter(h => (h.note ?? '').toLowerCase().includes(q.value))
  }
  return [...items].sort((a, b) => b.date.localeCompare(a.date))
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <History class="h-6 w-6 text-muted-foreground" />
        <h1 class="text-2xl font-bold">Histórico</h1>
      </div>

      <!-- Busca -->
      <div class="relative w-64">
        <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Buscar..." class="pl-9" />
      </div>
    </div>

    <!-- Skeleton -->
    <template v-if="loading">
      <Card>
        <CardContent class="pt-6 space-y-4">
          <div class="flex gap-2">
            <Skeleton class="h-9 w-full rounded-md" />
            <Skeleton class="h-9 w-full rounded-md" />
            <Skeleton class="h-9 w-full rounded-md" />
            <Skeleton class="h-9 w-full rounded-md" />
          </div>
          <div class="space-y-2 pt-2">
            <Skeleton v-for="i in 6" :key="i" class="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    </template>

    <Card v-else>
      <CardContent class="pt-6">
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
            <TabsTrigger value="saldo">
              Saldo
              <Badge v-if="filteredHistory.length" variant="secondary" class="ml-2 text-xs">
                {{ filteredHistory.length }}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <!-- ═══ TAB TRANSAÇÕES ═══ -->
          <TabsContent value="transacoes">
            <Collapsible v-model:open="txFiltersOpen" class="mb-4">
              <CollapsibleTrigger as-child>
                <Button variant="ghost" size="sm" class="flex items-center gap-2 w-full justify-between">
                  <span class="flex items-center gap-2"><Filter class="h-4 w-4" /> Filtros</span>
                  <ChevronsUpDown class="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent class="pt-3">
                <div class="grid grid-cols-1 gap-3">
                  <Select v-model="txFilterConta">
                    <SelectTrigger><SelectValue placeholder="Conta" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem :value="null">Todas</SelectItem>
                      <SelectItem v-for="acc in accountsStore.accounts" :key="acc.id" :value="acc.id">{{ acc.label }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button v-if="txFilterConta !== null" variant="ghost" size="sm" class="gap-2 mt-2 ml-auto" @click="txFilterConta = null">
                  <X class="h-4 w-4" /> Limpar filtros
                </Button>
              </CollapsibleContent>
            </Collapsible>

            <Table v-if="filteredTransactions.length">
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead class="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="tx in filteredTransactions" :key="tx.id">
                  <TableCell>{{ tx.date }}</TableCell>
                  <TableCell>
                    <span v-if="tx.installment">{{ tx.installment.product }} ({{ tx.installment.index }}/{{ tx.installment.total }})</span>
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
              </TableBody>
            </Table>
            <p v-else class="text-center text-muted-foreground py-8">Nenhuma transação encontrada.</p>
          </TabsContent>

          <!-- ═══ TAB RECORRENTES ═══ -->
          <TabsContent value="recorrentes">
            <Collapsible v-model:open="recFiltersOpen" class="mb-4">
              <CollapsibleTrigger as-child>
                <Button variant="ghost" size="sm" class="flex items-center gap-2 w-full justify-between">
                  <span class="flex items-center gap-2"><Filter class="h-4 w-4" /> Filtros</span>
                  <ChevronsUpDown class="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent class="pt-3">
                <div class="grid grid-cols-1 gap-3">
                  <Select v-model="recFilterConta">
                    <SelectTrigger><SelectValue placeholder="Conta" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem :value="null">Todas</SelectItem>
                      <SelectItem v-for="acc in accountsStore.accounts" :key="acc.id" :value="acc.id">{{ acc.label }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button v-if="recFilterConta !== null" variant="ghost" size="sm" class="gap-2 mt-2 ml-auto" @click="recFilterConta = null">
                  <X class="h-4 w-4" /> Limpar filtros
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
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="rec in filteredRecurrents" :key="rec.id">
                  <TableCell>{{ rec.name }}</TableCell>
                  <TableCell><Badge variant="secondary">{{ rec.kind }}</Badge></TableCell>
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
            <p v-else class="text-center text-muted-foreground py-8">Nenhuma recorrente encontrada.</p>
          </TabsContent>

          <!-- ═══ TAB INVESTIMENTOS ═══ -->
          <TabsContent value="investimentos">
            <Collapsible v-model:open="invFiltersOpen" class="mb-4">
              <CollapsibleTrigger as-child>
                <Button variant="ghost" size="sm" class="flex items-center gap-2 w-full justify-between">
                  <span class="flex items-center gap-2"><Filter class="h-4 w-4" /> Filtros</span>
                  <ChevronsUpDown class="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent class="pt-3">
                <div class="grid grid-cols-1 gap-3">
                  <Select v-model="invFilterConta">
                    <SelectTrigger><SelectValue placeholder="Conta" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem :value="null">Todas</SelectItem>
                      <SelectItem v-for="acc in accountsStore.accounts" :key="acc.id" :value="acc.id">{{ acc.label }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button v-if="invFilterConta !== null" variant="ghost" size="sm" class="gap-2 mt-2 ml-auto" @click="invFilterConta = null">
                  <X class="h-4 w-4" /> Limpar filtros
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
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="inv in filteredInvestments" :key="inv.id">
                  <TableCell><Badge>{{ inv.asset_tag }}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{{ getInvestmentTypeLabel(inv.investment_type) }}</Badge></TableCell>
                  <TableCell>{{ getAccountLabel(inv.accountId) }}</TableCell>
                  <TableCell>{{ getInvestmentSummary(inv) }}</TableCell>
                  <TableCell class="text-right">{{ formatCentsToBRL(inv.applied_cents) }}</TableCell>
                  <TableCell class="text-right">{{ inv.current_cents ? formatCentsToBRL(inv.current_cents) : '—' }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p v-else class="text-center text-muted-foreground py-8">Nenhum investimento encontrado.</p>
          </TabsContent>

          <!-- ═══ TAB SALDO (Balance History) ═══ -->
          <TabsContent value="saldo">
            <Collapsible v-model:open="histFiltersOpen" class="mb-4">
              <CollapsibleTrigger as-child>
                <Button variant="ghost" size="sm" class="flex items-center gap-2 w-full justify-between">
                  <span class="flex items-center gap-2"><Filter class="h-4 w-4" /> Filtros</span>
                  <ChevronsUpDown class="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent class="pt-3">
                <div class="grid grid-cols-1 gap-3">
                  <Select v-model="histFilterConta">
                    <SelectTrigger><SelectValue placeholder="Conta" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem :value="null">Todas</SelectItem>
                      <SelectItem v-for="acc in accountsStore.accounts" :key="acc.id" :value="acc.id">{{ acc.label }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button v-if="histFilterConta !== null" variant="ghost" size="sm" class="gap-2 mt-2 ml-auto" @click="histFilterConta = null">
                  <X class="h-4 w-4" /> Limpar filtros
                </Button>
              </CollapsibleContent>
            </Collapsible>

            <Table v-if="filteredHistory.length">
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead class="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="h in filteredHistory" :key="h.id">
                  <TableCell>{{ h.date }}</TableCell>
                  <TableCell>{{ getAccountLabel(h.accountId) }}</TableCell>
                  <TableCell>{{ h.note || '—' }}</TableCell>
                  <TableCell class="text-right" :class="h.balance_cents >= 0 ? 'text-green-500' : 'text-red-500'">
                    {{ formatCentsToBRL(Math.abs(h.balance_cents)) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p v-else class="text-center text-muted-foreground py-8">Nenhum registro de saldo encontrado.</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  </div>
</template>
