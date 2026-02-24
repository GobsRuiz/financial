<script setup lang="ts">
import { Clock } from 'lucide-vue-next'
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <Clock class="h-6 w-6 text-muted-foreground" />
      <h1 class="text-2xl font-bold">Pendentes</h1>
    </div>
    <Card>
      <CardContent class="p-6">
        <p class="text-muted-foreground">Em desenvolvimento...</p>
      </CardContent>
    </Card>
  </div>
</template>
