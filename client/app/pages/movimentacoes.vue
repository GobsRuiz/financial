<script setup lang="ts">
import { ArrowLeftRight, Plus } from 'lucide-vue-next'
import type { Transaction, Recurrent } from '~/schemas/zod-schemas'
import { useAccountsStore } from '~/stores/useAccounts'
import { useTransactionsStore } from '~/stores/useTransactions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useInvestmentPositionsStore } from '~/stores/useInvestmentPositions'
import { useInvestmentEventsStore } from '~/stores/useInvestmentEvents'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const recurrentsStore = useRecurrentsStore()
const investmentPositionsStore = useInvestmentPositionsStore()
const investmentEventsStore = useInvestmentEventsStore()

type MovimentacoesTab = 'transacoes' | 'recorrentes' | 'investimentos'
type MovimentacaoTipo = 'transacao' | 'recorrente' | 'investimento'

const dialogOpen = ref(false)
const loading = ref(true)
const selectedListTab = ref<MovimentacoesTab>('transacoes')
const defaultNewType = ref<MovimentacaoTipo>('transacao')

// Estado de edição
const editingTransaction = ref<Transaction | null>(null)
const editingRecurrent = ref<Recurrent | null>(null)

const dialogTitle = computed(() => {
  if (editingTransaction.value) return 'Editar Transação'
  if (editingRecurrent.value) return 'Editar Recorrente'
  return 'Nova Movimentação'
})

onMounted(async () => {
  try {
    await Promise.all([
      accountsStore.loadAccounts(),
      transactionsStore.loadTransactions(),
      recurrentsStore.loadRecurrents(),
      investmentPositionsStore.loadPositions(),
      investmentEventsStore.loadEvents(),
    ])
  } finally {
    loading.value = false
  }
})

function openNew() {
  editingTransaction.value = null
  editingRecurrent.value = null
  defaultNewType.value = selectedListTab.value === 'recorrentes'
    ? 'recorrente'
    : selectedListTab.value === 'investimentos'
      ? 'investimento'
      : 'transacao'
  dialogOpen.value = true
}

function onTabChange(tab: MovimentacoesTab) {
  selectedListTab.value = tab
}

function onEditTransaction(tx: Transaction) {
  editingTransaction.value = tx
  editingRecurrent.value = null
  dialogOpen.value = true
}

function onEditRecurrent(rec: Recurrent) {
  editingTransaction.value = null
  editingRecurrent.value = rec
  dialogOpen.value = true
}

function onSaved() {
  dialogOpen.value = false
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <ArrowLeftRight class="h-6 w-6 text-muted-foreground" />
        <h1 class="text-2xl font-bold">Movimentações</h1>
      </div>

      <Dialog v-model:open="dialogOpen">
        <DialogTrigger as-child>
          <Button @click="openNew">
            <Plus class="h-4 w-4 mr-2" />
            Nova Movimentação
          </Button>
        </DialogTrigger>
        <DialogContent class="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{{ dialogTitle }}</DialogTitle>
            <DialogDescription>Preencha os dados da movimentação</DialogDescription>
          </DialogHeader>
          <MovimentacaoForm
            :edit-transaction="editingTransaction"
            :edit-recurrent="editingRecurrent"
            :default-type="defaultNewType"
            @saved="onSaved"
          />
        </DialogContent>
      </Dialog>
    </div>

    <!-- Skeleton -->
    <template v-if="loading">
      <Card>
        <CardContent class="pt-6 space-y-4">
          <Skeleton class="h-9 w-full rounded-md" />
          <Separator />
           <div class="flex gap-2">
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

    <!-- Lista -->
    <MovimentacoesList
      v-else
      @edit-transaction="onEditTransaction"
      @edit-recurrent="onEditRecurrent"
      @tab-change="onTabChange"
    />
  </div>
</template>
