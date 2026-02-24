<script setup lang="ts">
import { Landmark, Plus, Pencil } from 'lucide-vue-next'
import type { Account } from '~/schemas/zod-schemas'
import { useAccountsStore } from '~/stores/useAccounts'
import { formatCentsToBRL } from '~/utils/money'

const accountsStore = useAccountsStore()

const loading = ref(true)
const dialogOpen = ref(false)
const editingAccount = ref<Account | null>(null)

onMounted(async () => {
  try {
    await accountsStore.loadAccounts()
  } finally {
    loading.value = false
  }
})

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

    <!-- Skeleton -->
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

    <!-- Lista de Contas -->
    <template v-else-if="accountsStore.accounts.length">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card v-for="acc in accountsStore.accounts" :key="acc.id">
          <CardContent class="pt-6">
            <div class="flex items-start justify-between">
              <div class="space-y-1">
                <p class="font-medium text-lg">{{ acc.label }}</p>
                <p class="text-sm text-muted-foreground">{{ acc.bank }}</p>
              </div>
              <Button variant="ghost" size="icon" @click="openEdit(acc)">
                <Pencil class="h-4 w-4" />
              </Button>
            </div>

            <p class="text-2xl font-bold mt-3" :class="acc.balance_cents >= 0 ? 'text-green-500' : 'text-red-500'">
              {{ formatCentsToBRL(Math.abs(acc.balance_cents)) }}
            </p>

            <div v-if="acc.card_closing_day || acc.card_due_day" class="flex gap-4 mt-3 text-sm text-muted-foreground">
              <span v-if="acc.card_closing_day">Fechamento: dia {{ acc.card_closing_day }}</span>
              <span v-if="acc.card_due_day">Vencimento: dia {{ acc.card_due_day }}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </template>

    <Card v-else>
      <CardContent class="py-8">
        <p class="text-center text-muted-foreground">Nenhuma conta cadastrada.</p>
      </CardContent>
    </Card>
  </div>
</template>
