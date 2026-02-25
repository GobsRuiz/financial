<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header class="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div class="flex items-center gap-2">
          <SidebarTrigger class="-ml-1" />
          <Separator orientation="vertical" class="mr-2 h-4" />
          <span class="text-sm font-medium text-muted-foreground">Financeiro</span>
        </div>
        <AlertsBell />
      </header>
      <main class="flex-1 overflow-auto p-6">
        <slot />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>
