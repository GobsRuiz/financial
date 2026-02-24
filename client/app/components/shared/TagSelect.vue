<script setup lang="ts">
import { X, Plus } from 'lucide-vue-next'
import { useTagsStore } from '~/stores/useTags'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const tagsStore = useTagsStore()
const inputValue = ref('')
const open = ref(false)

const availableTags = computed(() =>
  tagsStore.tags
    .map(t => t.name)
    .filter(name => !props.modelValue.includes(name))
)

const filteredTags = computed(() => {
  if (!inputValue.value) return availableTags.value
  const search = inputValue.value.toLowerCase()
  return availableTags.value.filter(name => name.includes(search))
})

const showNew = computed(() => {
  if (!inputValue.value.trim()) return false
  const search = inputValue.value.toLowerCase().trim()
  return !tagsStore.tags.some(t => t.name === search)
    && !props.modelValue.includes(search)
})

const showDropdown = computed(() => {
  return open.value && (filteredTags.value.length > 0 || showNew.value || inputValue.value.trim() === '')
})

async function addTag(name: string) {
  await tagsStore.ensureTag(name)
  emit('update:modelValue', [...props.modelValue, name.toLowerCase().trim()])
  inputValue.value = ''
}

function removeTag(name: string) {
  emit('update:modelValue', props.modelValue.filter(t => t !== name))
}

function onFocus() {
  open.value = true
}

function onBlur() {
  // Delay para permitir click no dropdown antes de fechar
  setTimeout(() => {
    open.value = false
  }, 150)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    const val = inputValue.value.trim()
    if (!val) return

    // Se existe match exato na lista filtrada, adiciona
    const exactMatch = filteredTags.value.find(t => t === val.toLowerCase())
    if (exactMatch) {
      addTag(exactMatch)
    } else if (showNew.value) {
      addTag(val)
    }
  }
}
</script>

<template>
  <div class="space-y-2">
    <!-- Tags selecionadas -->
    <div v-if="modelValue.length" class="flex flex-wrap gap-1">
      <Badge
        v-for="tag in modelValue"
        :key="tag"
        variant="secondary"
        class="gap-1"
      >
        {{ tag }}
        <button type="button" @click="removeTag(tag)" class="hover:text-destructive">
          <X class="h-3 w-3" />
        </button>
      </Badge>
    </div>

    <!-- Input + dropdown manual -->
    <div class="relative">
      <Input
        v-model="inputValue"
        placeholder="Digite para buscar ou criar tag..."
        class="h-8 text-sm"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      />

      <div
        v-if="showDropdown"
        class="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md"
      >
        <div class="max-h-[200px] overflow-y-auto p-1">
          <!-- Tags existentes filtradas -->
          <button
            v-for="tag in filteredTags"
            :key="tag"
            type="button"
            class="flex w-full items-center rounded-sm px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            @mousedown.prevent
            @click="addTag(tag)"
          >
            {{ tag }}
          </button>

          <!-- Criar nova tag -->
          <button
            v-if="showNew"
            type="button"
            class="flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-sm text-primary hover:bg-accent hover:text-accent-foreground"
            @mousedown.prevent
            @click="addTag(inputValue.trim())"
          >
            <Plus class="h-3.5 w-3.5" />
            Criar "{{ inputValue.trim() }}"
          </button>

          <!-- Mensagem quando não há tags e input vazio -->
          <p
            v-if="!filteredTags.length && !showNew"
            class="px-3 py-2 text-sm text-muted-foreground"
          >
            Digite para criar uma tag
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
