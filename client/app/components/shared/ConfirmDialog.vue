<script setup lang="ts">
const props = defineProps<{
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

function onOpenChange(value: boolean) {
  if (!value) emit('cancel')
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ title ?? 'Confirmar' }}</DialogTitle>
        <DialogDescription>
          {{ description ?? 'Tem certeza que deseja continuar?' }}
        </DialogDescription>
      </DialogHeader>
      <div class="flex justify-end gap-2 pt-4">
        <Button variant="outline" @click="emit('cancel')">
          {{ cancelLabel ?? 'Cancelar' }}
        </Button>
        <Button
          :variant="destructive ? 'destructive' : 'default'"
          :class="destructive ? 'bg-destructive!' : ''"
          @click="emit('confirm')"
        >
          {{ confirmLabel ?? 'Confirmar' }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
