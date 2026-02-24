<script setup lang="ts">
import { Save, AlertCircleIcon } from 'lucide-vue-next'
import { Alert, AlertDescription } from '../ui/alert'
import type { Account } from '~/schemas/zod-schemas'
import { useAccountsStore } from '~/stores/useAccounts'
import { parseBRLToCents } from '~/utils/money'

const props = defineProps<{
  account?: Account | null
}>()

const emit = defineEmits<{ saved: [] }>()

const accountsStore = useAccountsStore()

const isEdit = computed(() => !!props.account)
const loading = ref(false)
const error = ref('')

const form = reactive({
  bank: '',
  label: '',
  balance: '',
  card_closing_day: '',
  card_due_day: '',
})

const lastAutoLabel = ref('')
const hasManualLabelEdit = ref(false)

watch(() => props.account, (acc) => {
  if (acc) {
    form.bank = acc.bank
    form.label = acc.label
    form.balance = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(acc.balance_cents / 100)
    form.card_closing_day = acc.card_closing_day?.toString() ?? ''
    form.card_due_day = acc.card_due_day?.toString() ?? ''
    lastAutoLabel.value = ''
    hasManualLabelEdit.value = true
  } else {
    resetForm()
  }
}, { immediate: true })

watch(() => form.bank, (bank) => {
  if (isEdit.value) return

  const normalizedBank = bank.trim()
  if (!normalizedBank) {
    if (!hasManualLabelEdit.value || form.label === lastAutoLabel.value) {
      form.label = ''
      lastAutoLabel.value = ''
      hasManualLabelEdit.value = false
    }
    return
  }

  if (hasManualLabelEdit.value && form.label !== lastAutoLabel.value) return

  const suggestedLabel = `${normalizedBank} Principal`
  form.label = suggestedLabel
  lastAutoLabel.value = suggestedLabel
})

watch(() => form.label, (label) => {
  if (isEdit.value) return
  if (label !== lastAutoLabel.value) {
    hasManualLabelEdit.value = true
  }
})

function resetForm() {
  form.bank = ''
  form.label = ''
  form.balance = ''
  form.card_closing_day = ''
  form.card_due_day = ''
  error.value = ''
  lastAutoLabel.value = ''
  hasManualLabelEdit.value = false
}

async function handleSubmit() {
  if (!form.bank.trim()) { error.value = 'Informe o banco'; return }
  if (!form.label.trim()) { error.value = 'Informe o nome da conta'; return }

  loading.value = true
  error.value = ''

  try {
    const data = {
      bank: form.bank.trim().toLowerCase(),
      label: form.label.trim(),
      type: 'bank' as const,
      balance_cents: parseBRLToCents(form.balance),
      card_closing_day: form.card_closing_day ? parseInt(form.card_closing_day) : undefined,
      card_due_day: form.card_due_day ? parseInt(form.card_due_day) : undefined,
    }

    if (isEdit.value && props.account) {
      await accountsStore.updateAccount(props.account.id, data)
    } else {
      await accountsStore.addAccount(data)
    }

    resetForm()
    emit('saved')
  } catch (e: any) {
    error.value = e.message || 'Erro ao salvar'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-2">
        <Label>Banco *</Label>
        <Input v-model="form.bank" placeholder="Ex: nubank" />
      </div>

      <div class="space-y-2">
        <Label>Nome da Conta *</Label>
        <Input v-model="form.label" placeholder="Ex: Nubank Principal" />
      </div>

      <div class="space-y-2">
        <Label>Saldo</Label>
        <MoneyInput v-model="form.balance" />
      </div>

      <div class="space-y-2">
        <Label>Dia Fechamento Fatura</Label>
        <Input v-model="form.card_closing_day" placeholder="1-31" type="number" min="1" max="31" />
      </div>

      <div class="space-y-2">
        <Label>Dia Vencimento Fatura</Label>
        <Input v-model="form.card_due_day" placeholder="1-31" type="number" min="1" max="31" />
      </div>
    </div>

    <Alert v-if="error" variant="destructive">
      <AlertCircleIcon class="size-4" />
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <Button type="submit" :disabled="loading" class="w-full">
      <Save class="h-4 w-4 mr-2" />
      {{ loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar Conta') }}
    </Button>
  </form>
</template>
