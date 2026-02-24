<script setup lang="ts">
defineProps<{
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
</script>

<template>
  <AlertDialog :open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title ?? 'Confirmar' }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ description ?? 'Tem certeza que deseja continuar?' }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="emit('cancel')">
          {{ cancelLabel ?? 'Cancelar' }}
        </AlertDialogCancel>
        <AlertDialogAction
          :class="destructive ? 'bg-destructive text-white hover:bg-destructive/90' : ''"
          @click="emit('confirm')"
        >
          {{ confirmLabel ?? 'Confirmar' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
