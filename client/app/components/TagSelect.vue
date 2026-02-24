<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { useTagsStore } from '~/stores/useTags'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const tagsStore = useTagsStore()
const inputValue = ref('')

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
})

async function addTag(name: string) {
  await tagsStore.ensureTag(name)
  emit('update:modelValue', [...props.modelValue, name.toLowerCase().trim()])
  inputValue.value = ''
}

function removeTag(name: string) {
  emit('update:modelValue', props.modelValue.filter(t => t !== name))
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

    <!-- Input + dropdown -->
    <Popover>
      <PopoverTrigger as-child>
        <Input
          v-model="inputValue"
          placeholder="Buscar ou criar tag..."
          class="h-8 text-sm"
        />
      </PopoverTrigger>
      <PopoverContent class="w-[200px] p-0" align="start">
        <div class="max-h-[200px] overflow-y-auto">
          <button
            v-for="tag in filteredTags"
            :key="tag"
            type="button"
            class="flex w-full items-center px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            @click="addTag(tag)"
          >
            {{ tag }}
          </button>
          <button
            v-if="showNew"
            type="button"
            class="flex w-full items-center px-3 py-1.5 text-sm text-primary hover:bg-accent"
            @click="addTag(inputValue.trim())"
          >
            + Criar "{{ inputValue.trim() }}"
          </button>
          <p v-if="!filteredTags.length && !showNew" class="px-3 py-2 text-sm text-muted-foreground">
            Nenhuma tag encontrada
          </p>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
