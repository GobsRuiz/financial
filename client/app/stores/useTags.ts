import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { Tag } from '~/schemas/zod-schemas'
import { apiGet, apiPost } from '~/utils/api'

export const useTagsStore = defineStore('tags', () => {
  const tags = ref<Tag[]>([])

  async function loadTags() {
    tags.value = await apiGet<Tag[]>('/tags')
  }

  async function createTag(name: string) {
    const created = await apiPost<Tag>('/tags', {
      id: uuid(),
      name: name.toLowerCase().trim(),
    })
    tags.value.push(created)
    return created
  }

  async function ensureTag(name: string) {
    const normalized = name.toLowerCase().trim()
    const existing = tags.value.find(t => t.name === normalized)
    if (existing) return existing
    return await createTag(normalized)
  }

  return { tags, loadTags, createTag, ensureTag }
})
