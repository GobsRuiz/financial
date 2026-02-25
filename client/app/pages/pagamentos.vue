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
const refreshing = ref(false)
const loadFailedSources = ref<string[]>([])
const hasSuccessfulLoad = ref(false)

const sourceLoaders = [
  { label: 'contas', load: () => accountsStore.loadAccounts() },
  { label: 'movimentacoes', load: () => transactionsStore.loadTransactions() },
  { label: 'recorrentes', load: () => recurrentsStore.loadRecurrents() },
]

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

const hasFatalLoadError = computed(() =>
  loadFailedSources.value.length === sourceLoaders.length && !hasSuccessfulLoad.value,
)

const hasPartialLoadError = computed(() =>
  loadFailedSources.value.length > 0 && !hasFatalLoadError.value,
)

const loadErrorMessage = computed(() => {
  if (!loadFailedSources.value.length) return ''
  return `Falha ao carregar: ${loadFailedSources.value.join(', ')}.`
})

async function loadPageData() {
  const firstLoad = !hasSuccessfulLoad.value && !refreshing.value
  if (firstLoad) {
    loading.value = true
  } else {
    refreshing.value = true
  }

  try {
    const results = await Promise.allSettled(sourceLoaders.map(item => item.load()))

    const failed: string[] = []
    let anySuccess = false

    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        anySuccess = true
        continue
      }
      const source = sourceLoaders[index]
      if (!source) continue
      failed.push(source.label)
      console.error(`Erro ao carregar ${source.label}:`, result.reason)
    }

    loadFailedSources.value = failed
    if (anySuccess) {
      hasSuccessfulLoad.value = true
    }
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

onMounted(async () => {
  await loadPageData()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Clock class="h-6 w-6 text-muted-foreground" />
        <h1 class="text-2xl font-bold">Pagamentos</h1>
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
    <template v-else-if="hasFatalLoadError">
      <Card class="border-red-500/30 bg-red-500/5">
        <CardContent class="space-y-3 pt-6">
          <p class="font-semibold text-red-500">Nao foi possivel carregar pagamentos</p>
          <p class="text-sm text-muted-foreground">
            {{ loadErrorMessage || 'Verifique o servidor/API e tente novamente.' }}
          </p>
          <Button :disabled="refreshing" @click="loadPageData">
            {{ refreshing ? 'Tentando novamente...' : 'Tentar novamente' }}
          </Button>
        </CardContent>
      </Card>
    </template>

    <template v-else>
      <Card
        v-if="hasPartialLoadError"
        class="border-yellow-500/30 bg-yellow-500/5"
      >
        <CardContent class="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
          <p class="text-sm text-muted-foreground">
            {{ loadErrorMessage }} Alguns dados podem estar incompletos.
          </p>
          <Button variant="outline" :disabled="refreshing" @click="loadPageData">
            {{ refreshing ? 'Atualizando...' : 'Tentar novamente' }}
          </Button>
        </CardContent>
      </Card>

      <PendentesList :month="selectedMonth" />
    </template>
  </div>
</template>
