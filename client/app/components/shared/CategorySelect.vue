<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import { useTransactionsStore } from '~/stores/useTransactions'

const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const transactionsStore = useTransactionsStore()
const inputValue = ref(props.modelValue)
const open = ref(false)

function capitalize(str: string): string {
  const s = str.trim()
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// Sincronizar quando o pai muda o valor (ex: edição, reset)
watch(() => props.modelValue, (val) => {
  inputValue.value = val
})

// Categorias únicas já usadas nas transações (normalizadas com primeira letra maiúscula)
const existingCategories = computed(() => {
  const cats = new Set<string>()
  for (const tx of transactionsStore.transactions) {
    if (tx.category) {
      cats.add(capitalize(tx.category))
    }
  }
  return [...cats].sort()
})

const filteredCategories = computed(() => {
  if (!inputValue.value) return existingCategories.value
  const search = inputValue.value.toLowerCase()
  return existingCategories.value.filter(name => name.toLowerCase().includes(search))
})

const showNew = computed(() => {
  if (!inputValue.value.trim()) return false
  const search = inputValue.value.toLowerCase().trim()
  return !existingCategories.value.some(c => c.toLowerCase() === search)
})

const showDropdown = computed(() => {
  return open.value && (filteredCategories.value.length > 0 || showNew.value || inputValue.value.trim() === '')
})

function selectCategory(name: string) {
  const normalized = capitalize(name)
  inputValue.value = normalized
  emit('update:modelValue', normalized)
  open.value = false
}

function onInput() {
  emit('update:modelValue', inputValue.value)
}

function onFocus() {
  open.value = true
}

function onBlur() {
  setTimeout(() => {
    open.value = false
  }, 150)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    const val = inputValue.value.trim()
    if (!val) return

    const exactMatch = filteredCategories.value.find(c => c.toLowerCase() === val.toLowerCase())
    if (exactMatch) {
      selectCategory(exactMatch)
    } else {
      selectCategory(val)
    }
  }
}
</script>

<template>
  <div class="relative">
    <Input
      v-model="inputValue"
      :placeholder="placeholder ?? 'Ex: Supermercado'"
      class="h-8 text-sm"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown"
    />

    <div
      v-if="showDropdown"
      class="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      <div class="max-h-[200px] overflow-y-auto p-1">
        <!-- Categorias existentes filtradas -->
        <button
          v-for="cat in filteredCategories"
          :key="cat"
          type="button"
          class="flex w-full items-center rounded-sm px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          @mousedown.prevent
          @click="selectCategory(cat)"
        >
          {{ cat }}
        </button>

        <!-- Criar nova categoria -->
        <button
          v-if="showNew"
          type="button"
          class="flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-sm text-primary hover:bg-accent hover:text-accent-foreground"
          @mousedown.prevent
          @click="selectCategory(inputValue.trim())"
        >
          <Plus class="h-3.5 w-3.5" />
          Criar "{{ capitalize(inputValue.trim()) }}"
        </button>

        <!-- Mensagem quando não há categorias e input vazio -->
        <p
          v-if="!filteredCategories.length && !showNew"
          class="px-3 py-2 text-sm text-muted-foreground"
        >
          Digite para criar uma categoria
        </p>
      </div>
    </div>
  </div>
</template>
