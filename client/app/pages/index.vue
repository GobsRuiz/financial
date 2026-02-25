<script setup lang="ts">
import { LayoutDashboard, TrendingUp, TrendingDown, Wallet, PiggyBank, Clock } from 'lucide-vue-next'
import { useAccountsStore } from '~/stores/useAccounts'
import { useTransactionsStore } from '~/stores/useTransactions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useInvestmentPositionsStore } from '~/stores/useInvestmentPositions'
import { formatCentsToBRL } from '~/utils/money'
import { monthKey } from '~/utils/dates'
import dayjs from 'dayjs'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const recurrentsStore = useRecurrentsStore()
const investmentPositionsStore = useInvestmentPositionsStore()

const loading = ref(true)
const currentMonth = monthKey(dayjs().format('YYYY-MM-DD'))

onMounted(async () => {
  try {
    await Promise.all([
      accountsStore.loadAccounts(),
      transactionsStore.loadTransactions(),
      recurrentsStore.loadRecurrents(),
      investmentPositionsStore.loadPositions(),
    ])
  } finally {
    loading.value = false
  }
})

// Entradas do mês (income)
const entradasMes = computed(() => {
  let total = 0
  for (const tx of transactionsStore.transactions) {
    if (monthKey(tx.date) === currentMonth && tx.amount_cents > 0) {
      total += tx.amount_cents
    }
  }
  return total
})

// Saídas do mês (expense)
const saidasMes = computed(() => {
  let total = 0
  for (const tx of transactionsStore.transactions) {
    if (monthKey(tx.date) === currentMonth && tx.amount_cents < 0) {
      total += Math.abs(tx.amount_cents)
    }
  }
  return total
})

// Saldo total (soma dos saldos das contas)
const saldoTotal = computed(() =>
  accountsStore.accounts.reduce((sum, a) => sum + a.balance_cents, 0)
)

// Investido (soma das posições de investimento)
const investidoTotal = computed(() =>
  investmentPositionsStore.positions.reduce((sum, position) => sum + (position.invested_cents ?? 0), 0)
)

// Pendentes do mês
const pendentesCount = computed(() => {
  let count = transactionsStore.unpaidForMonth(currentMonth).length
  for (const rec of recurrentsStore.recurrents) {
    if (!rec.active) continue
    if (transactionsStore.hasRecurrentTransaction(rec.id, currentMonth)) continue
    count++
  }
  return count
})

// Últimas 10 movimentações
const ultimasMovimentacoes = computed(() =>
  [...transactionsStore.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
)

function getAccountLabel(accountId: number) {
  return accountsStore.accounts.find(a => a.id === accountId)?.label ?? '—'
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <LayoutDashboard class="h-6 w-6 text-muted-foreground" />
      <h1 class="text-2xl font-bold">Dashboard</h1>
    </div>

    <!-- Skeleton -->
    <template v-if="loading">
      <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card v-for="i in 5" :key="i">
          <CardContent class="pt-6 space-y-2">
            <Skeleton class="h-4 w-20" />
            <Skeleton class="h-8 w-28" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent class="pt-6 space-y-2">
          <Skeleton class="h-5 w-40" />
          <Skeleton v-for="i in 5" :key="i" class="h-10 w-full" />
        </CardContent>
      </Card>
    </template>

    <template v-else>
      <!-- Cards resumo -->
      <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent class="pt-6">
            <div class="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp class="h-4 w-4" />
              Entradas
            </div>
            <p class="text-2xl font-bold text-green-500">
              {{ formatCentsToBRL(entradasMes) }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="pt-6">
            <div class="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown class="h-4 w-4" />
              Saídas
            </div>
            <p class="text-2xl font-bold text-red-500">
              {{ formatCentsToBRL(saidasMes) }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="pt-6">
            <div class="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Wallet class="h-4 w-4" />
              Saldo Total
            </div>
            <p class="text-2xl font-bold" :class="saldoTotal >= 0 ? 'text-green-500' : 'text-red-500'">
              {{ formatCentsToBRL(saldoTotal) }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="pt-6">
            <div class="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <PiggyBank class="h-4 w-4" />
              Investido
            </div>
            <p class="text-2xl font-bold text-blue-500">
              {{ formatCentsToBRL(investidoTotal) }}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="pt-6">
            <div class="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock class="h-4 w-4" />
              Pendentes
            </div>
            <p class="text-2xl font-bold text-yellow-500">
              {{ pendentesCount }}
            </p>
            <p class="text-xs text-muted-foreground">itens este mês</p>
          </CardContent>
        </Card>
      </div>

      <!-- Últimas movimentações -->
      <Card>
        <CardHeader>
          <CardTitle class="text-lg">Últimas Movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          <Table v-if="ultimasMovimentacoes.length">
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead class="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="tx in ultimasMovimentacoes" :key="tx.id">
                <TableCell>{{ tx.date }}</TableCell>
                <TableCell>
                  <span v-if="tx.installment">
                    {{ tx.installment.product }} ({{ tx.installment.index }}/{{ tx.installment.total }})
                  </span>
                  <span v-else>{{ tx.description || 'Transacao' }}</span>
                </TableCell>
                <TableCell>{{ getAccountLabel(tx.accountId) }}</TableCell>
                <TableCell>
                  <Badge v-if="tx.paid" variant="outline" class="text-green-500 border-green-500/30">Pago</Badge>
                  <Badge v-else variant="outline" class="text-yellow-500 border-yellow-500/30">Pendente</Badge>
                </TableCell>
                <TableCell class="text-right" :class="tx.amount_cents < 0 ? 'text-red-500' : 'text-green-500'">
                  {{ formatCentsToBRL(tx.amount_cents) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p v-else class="text-center text-muted-foreground py-8">
            Nenhuma movimentação registrada.
          </p>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
