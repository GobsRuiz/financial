<script setup lang="ts">
import { Settings, Trash2 } from 'lucide-vue-next'
import { useAppToast } from '~/composables/useAppToast'
import { useAccountsStore } from '~/stores/useAccounts'
import { useTransactionsStore } from '~/stores/useTransactions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useInvestmentsStore } from '~/stores/useInvestments'
import { useTagsStore } from '~/stores/useTags'
import { useHistoryStore } from '~/stores/useHistory'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const recurrentsStore = useRecurrentsStore()
const investmentsStore = useInvestmentsStore()
const tagsStore = useTagsStore()
const historyStore = useHistoryStore()

const appToast = useAppToast()
const confirmOpen = ref(false)
const loading = ref(false)

async function handleClearAll() {
  loading.value = true

  try {
    const collections = [
      { items: transactionsStore.transactions, path: '/transactions' },
      { items: recurrentsStore.recurrents, path: '/recurrents' },
      { items: investmentsStore.investments, path: '/investments' },
      { items: tagsStore.tags, path: '/tags' },
      { items: historyStore.history, path: '/history' },
      { items: accountsStore.accounts, path: '/accounts' },
    ]

    for (const col of collections) {
      for (const item of [...col.items]) {
        await apiDelete(`${col.path}/${item.id}`)
      }
    }

    transactionsStore.transactions = []
    recurrentsStore.recurrents = []
    investmentsStore.investments = []
    tagsStore.tags = []
    historyStore.history = []
    accountsStore.accounts = []

    appToast.success({
      title: 'Dados removidos',
      description: 'Todos os dados foram limpos com sucesso.',
    })
  } catch (e: any) {
    console.error('Erro ao limpar dados:', e)
    appToast.error({
      title: 'Erro ao limpar dados',
      description: 'Ocorreu um erro ao tentar remover os dados.',
    })
  } finally {
    loading.value = false
    confirmOpen.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <Settings class="h-6 w-6 text-muted-foreground" />
      <h1 class="text-2xl font-bold">Settings</h1>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Gerenciamento de Dados</CardTitle>
        <CardDescription>
          Gerencie os dados armazenados no aplicativo.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p class="font-medium">Limpar todos os dados</p>
            <p class="text-sm text-muted-foreground">
              Remove todas as contas, transações, recorrentes, investimentos, tags e histórico.
            </p>
          </div>
          <Button
            variant="destructive"
            :disabled="loading"
            @click="confirmOpen = true"
            class="bg-destructive!"
          >
            <Trash2 class="h-4 w-4 mr-2" />
            Limpar Tudo
          </Button>
        </div>

      </CardContent>
    </Card>

    <ConfirmDialog
      :open="confirmOpen"
      title="Limpar todos os dados?"
      description="Esta ação é irreversível. Todos os dados (contas, transações, recorrentes, investimentos, tags e histórico) serão permanentemente removidos."
      confirm-label="Sim, limpar tudo"
      cancel-label="Cancelar"
      :destructive="true"
      @confirm="handleClearAll"
      @cancel="confirmOpen = false"
    />
  </div>
</template>
