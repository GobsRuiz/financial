<script setup lang="ts">
import { Clock, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useAccountsStore } from '~/stores/useAccounts'
import { useTransactionsStore } from '~/stores/useTransactions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { monthKey } from '~/utils/dates'
import dayjs from 'dayjs'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const recurrentsStore = useRecurrentsStore()

const loading = ref(true)

// Mês selecionado (inicia no mês atual)
const selectedMonth = ref(monthKey(dayjs().format('YYYY-MM-DD')))

const selectedMonthLabel = computed(() => {
  const d = dayjs(`${selectedMonth.value}-01`)
  const label = d.format('MMMM YYYY')
  return label.charAt(0).toUpperCase() + label.slice(1)
})

function prevMonth() {
  const d = dayjs(`${selectedMonth.value}-01`).subtract(1, 'month')
  selectedMonth.value = d.format('YYYY-MM')
}

function nextMonth() {
  const d = dayjs(`${selectedMonth.value}-01`).add(1, 'month')
  selectedMonth.value = d.format('YYYY-MM')
}

onMounted(async () => {
  try {
    await Promise.all([
      accountsStore.loadAccounts(),
      transactionsStore.loadTransactions(),
      recurrentsStore.loadRecurrents(),
    ])
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Clock class="h-6 w-6 text-muted-foreground" />
        <h1 class="text-2xl font-bold">Pendentes</h1>
      </div>

      <!-- Navegação de mês -->
      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" @click="prevMonth">
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <span class="text-sm font-medium min-w-[140px] text-center">
          {{ selectedMonthLabel }}
        </span>
        <Button variant="outline" size="icon" @click="nextMonth">
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- Skeleton -->
    <template v-if="loading">
      <!-- Cards skeleton -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card v-for="i in 3" :key="i">
          <CardContent class="pt-6 space-y-2">
            <Skeleton class="h-4 w-24" />
            <Skeleton class="h-8 w-32" />
          </CardContent>
        </Card>
      </div>
      <!-- Lista skeleton -->
      <Card>
        <CardContent class="pt-6 space-y-4">
          <Skeleton class="h-9 w-full rounded-md" />
          <Separator />
          <div class="space-y-2 pt-2">
            <Skeleton v-for="i in 5" :key="i" class="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    </template>

    <!-- Conteúdo -->
    <PendentesList v-else :month="selectedMonth" />
  </div>
</template>
