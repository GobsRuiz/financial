<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import type { Transaction } from '~/schemas/zod-schemas'
import { useTransactionsStore } from '~/stores/useTransactions'
import { formatCentsToBRL } from '~/utils/money'

const props = defineProps<{
  parentId: string
}>()

const transactionsStore = useTransactionsStore()

const parcelas = computed(() =>
  transactionsStore.transactions
    .filter(t => t.installment?.parentId === props.parentId)
    .sort((a, b) => (a.installment?.index ?? 0) - (b.installment?.index ?? 0))
)

async function togglePaid(tx: Transaction) {
  if (tx.paid) return
  await transactionsStore.markPaid(tx.id)
}
</script>

<template>
  <div class="space-y-1 pl-4 border-l-2 border-border ml-2">
    <div
      v-for="p in parcelas"
      :key="p.id"
      class="flex items-center justify-between py-1.5 px-3 rounded text-sm"
      :class="p.paid ? 'bg-muted/50' : 'hover:bg-muted/30'"
    >
      <div class="flex items-center gap-3">
        <Checkbox
          :checked="p.paid"
          :disabled="p.paid"
          @update:checked="togglePaid(p)"
        />
        <span :class="p.paid ? 'line-through text-muted-foreground' : ''">
          Parcela {{ p.installment?.index }}/{{ p.installment?.total }}
        </span>
        <span class="text-muted-foreground text-xs">{{ p.date }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span :class="p.amount_cents < 0 ? 'text-red-500' : 'text-green-500'">
          {{ formatCentsToBRL(Math.abs(p.amount_cents)) }}
        </span>
        <Check v-if="p.paid" class="h-3.5 w-3.5 text-green-500" />
      </div>
    </div>
  </div>
</template>
