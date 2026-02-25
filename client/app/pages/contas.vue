<script setup lang="ts">
import { Landmark, Plus, Pencil } from 'lucide-vue-next'
import type { Account } from '~/schemas/zod-schemas'
import { useAccountsStore } from '~/stores/useAccounts'
import { useTransactionsStore } from '~/stores/useTransactions'
import { formatCentsToBRL } from '~/utils/money'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()

const loading = ref(true)
const refreshing = ref(false)
const loadFailedSources = ref<string[]>([])
const hasSuccessfulLoad = ref(false)
const dialogOpen = ref(false)
const editingAccount = ref<Account | null>(null)

const sourceLoaders = [
  { label: 'contas', load: () => accountsStore.loadAccounts() },
  { label: 'movimentacoes', load: () => transactionsStore.loadTransactions() },
]

onMounted(async () => {
  await loadPageData()
})

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

const creditInvoiceByAccount = computed(() => {
  const grouped = new Map<number, number>()

  for (const tx of transactionsStore.transactions) {
    if (tx.paid || tx.payment_method !== 'credit') continue
    const current = grouped.get(tx.accountId) ?? 0
    grouped.set(tx.accountId, current + tx.amount_cents)
  }

  return grouped
})

function getCreditInvoiceCents(accountId: number) {
  return creditInvoiceByAccount.value.get(accountId) ?? 0
}

function openNew() {
  editingAccount.value = null
  dialogOpen.value = true
}

function openEdit(acc: Account) {
  editingAccount.value = acc
  dialogOpen.value = true
}

function onSaved() {
  dialogOpen.value = false
  editingAccount.value = null
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Landmark class="h-6 w-6 text-muted-foreground" />
        <h1 class="text-2xl font-bold">Contas</h1>
      </div>

      <Dialog v-model:open="dialogOpen">
        <DialogTrigger as-child>
          <Button @click="openNew">
            <Plus class="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </DialogTrigger>
        <DialogContent class="max-w-lg">
          <DialogHeader>
            <DialogTitle>{{ editingAccount ? 'Editar Conta' : 'Nova Conta' }}</DialogTitle>
            <DialogDescription>Preencha os dados da conta bancária</DialogDescription>
          </DialogHeader>
          <AccountFormModal :account="editingAccount" @saved="onSaved" />
        </DialogContent>
      </Dialog>
    </div>

    <template v-if="loading">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card v-for="i in 2" :key="i">
          <CardContent class="pt-6 space-y-3">
            <Skeleton class="h-5 w-32" />
            <Skeleton class="h-8 w-40" />
            <Skeleton class="h-4 w-24" />
          </CardContent>
        </Card>
      </div>
    </template>

    <template v-else-if="hasFatalLoadError">
      <Card class="border-red-500/30 bg-red-500/5">
        <CardContent class="space-y-3 pt-6">
          <p class="font-semibold text-red-500">Nao foi possivel carregar contas</p>
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

      <div v-if="accountsStore.accounts.length" class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card
          v-for="acc in accountsStore.accounts"
          :key="acc.id"
          class="gap-3 py-3 border-border/70 bg-gradient-to-br from-card to-card/70 shadow-sm hover:shadow-md transition-shadow"
        >
          <CardContent class="px-4">
            <div class="flex items-start justify-between">
              <div class="space-y-0.5">
                <p class="font-semibold text-base">{{ acc.label }}</p>
                <p class="text-xs text-muted-foreground">{{ acc.bank }}</p>
              </div>
              <Button variant="ghost" size="icon" @click="openEdit(acc)">
                <Pencil class="h-4 w-4" />
              </Button>
            </div>

            <div
              class="mt-3 grid gap-3"
              :class="acc.card_closing_day || acc.card_due_day ? 'grid-cols-2' : 'grid-cols-1'"
            >
              <div class="rounded-md border border-border/60 bg-background/30 px-3 py-2">
                <p class="text-[10px] uppercase tracking-wide text-muted-foreground">Saldo</p>
                <p class="text-lg font-semibold leading-tight" :class="acc.balance_cents >= 0 ? 'text-green-500' : 'text-red-500'">
                  {{ formatCentsToBRL(acc.balance_cents) }}
                </p>
              </div>

              <div
                class="rounded-md border border-border/60 bg-background/30 px-3 py-2"
                v-if="acc.card_closing_day || acc.card_due_day"
              >
                <p class="text-[10px] uppercase tracking-wide text-muted-foreground">Fatura</p>
                <p
                  class="text-lg font-semibold leading-tight"
                  :class="getCreditInvoiceCents(acc.id) < 0 ? 'text-red-500' : 'text-muted-foreground'"
                >
                  {{ formatCentsToBRL(getCreditInvoiceCents(acc.id)) }}
                </p>
              </div>
            </div>

            <div v-if="acc.card_closing_day || acc.card_due_day" class="flex gap-3 mt-3 text-[11px] text-muted-foreground">
              <span v-if="acc.card_closing_day">Fechamento: dia {{ acc.card_closing_day }}</span>
              <span v-if="acc.card_due_day">Vencimento: dia {{ acc.card_due_day }}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card v-else>
        <CardContent class="py-8">
          <p class="text-center text-muted-foreground">Nenhuma conta cadastrada.</p>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
