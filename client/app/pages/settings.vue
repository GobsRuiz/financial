<script setup lang="ts">
import { Download, Settings, Trash2, Upload } from 'lucide-vue-next'
import { useAppToast } from '~/composables/useAppToast'
import { useAccountsStore } from '~/stores/useAccounts'
import { useTransactionsStore } from '~/stores/useTransactions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useHistoryStore } from '~/stores/useHistory'
import { useInvestmentPositionsStore } from '~/stores/useInvestmentPositions'
import { useInvestmentEventsStore } from '~/stores/useInvestmentEvents'
import {
  EMPTY_BACKUP_DATA,
  exportBackupJson,
  parseBackupFileContent,
  replaceDataWithBackup,
  summarizeBackup,
} from '~/utils/export-import'
import type {
  BackupCollectionKey,
  BackupData,
  ExportBackupProgressEvent,
  ReplaceBackupProgressEvent,
} from '~/utils/export-import'

type ProgressKind = 'clear' | 'export' | 'import'

interface ProgressSession {
  kind: ProgressKind
  title: string
  steps: string[]
}

const appToast = useAppToast()

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const recurrentsStore = useRecurrentsStore()
const historyStore = useHistoryStore()
const investmentPositionsStore = useInvestmentPositionsStore()
const investmentEventsStore = useInvestmentEventsStore()

const clearConfirmOpen = ref(false)
const importConfirmOpen = ref(false)

const clearing = ref(false)
const exportingJson = ref(false)
const parsingImport = ref(false)
const importing = ref(false)

const importInputRef = ref<HTMLInputElement | null>(null)
const pendingImportData = ref<BackupData | null>(null)
const pendingImportFileName = ref('')
const progressSession = ref<ProgressSession | null>(null)
const progressStepIndex = ref(0)
const progressResetTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const EXPORT_MODAL_MIN_DURATION_MS = 1000

const EXPORT_PROGRESS_STEPS = [
  'Coletando dados...',
  'Gerando arquivo...',
  'Download concluído!',
]

const IMPORT_PROGRESS_STEPS = [
  'Limpando dados...',
  'Importando contas...',
  'Importando transações...',
  'Importando recorrentes...',
  'Importando investimentos...',
  'Importando histórico...',
  'Atualizando dados na tela...',
  'Concluído!',
]

const CLEAR_PROGRESS_STEPS = [
  'Limpando transações...',
  'Limpando recorrentes...',
  'Limpando investimentos...',
  'Limpando contas...',
  'Atualizando dados na tela...',
  'Concluído!',
]

const isBusy = computed(() =>
  clearing.value
  || exportingJson.value
  || parsingImport.value
  || importing.value,
)

const pendingImportSummary = computed(() => {
  if (!pendingImportData.value) return null
  return summarizeBackup(pendingImportData.value)
})

const showProgress = computed(() => !!progressSession.value)

const progressPercent = computed(() => {
  if (!progressSession.value?.steps.length) return 0
  return Math.round(((progressStepIndex.value + 1) / progressSession.value.steps.length) * 100)
})

const progressCurrentLabel = computed(() => {
  if (!progressSession.value) return ''
  return progressSession.value.steps[progressStepIndex.value] ?? ''
})

const progressStepMeta = computed(() => {
  if (!progressSession.value) return ''
  return `Etapa ${Math.min(progressStepIndex.value + 1, progressSession.value.steps.length)} de ${progressSession.value.steps.length}`
})

const importConfirmDescription = computed(() => {
  const summary = pendingImportSummary.value
  if (!summary) {
    return 'Isso substituirá TODO o banco de dados atual do projeto. Deseja continuar?'
  }

  return [
    `Arquivo: ${pendingImportFileName.value || 'backup.json'}`,
    'Isso substituirá TODO o banco de dados atual do projeto.',
    'O backup é restaurado por completo (não por conta).',
    `Contas: ${summary.accounts}`,
    `Transações: ${summary.transactions}`,
    `Recorrentes: ${summary.recurrents}`,
    `Posições: ${summary.investmentPositions}`,
    `Eventos: ${summary.investmentEvents}`,
    `Histórico: ${summary.history}`,
  ].join('\n')
})

function resetPendingImport() {
  pendingImportData.value = null
  pendingImportFileName.value = ''
}

function clearProgressResetTimer() {
  if (!progressResetTimer.value) return
  clearTimeout(progressResetTimer.value)
  progressResetTimer.value = null
}

function resetProgress() {
  clearProgressResetTimer()
  progressSession.value = null
  progressStepIndex.value = 0
}

function scheduleProgressReset(delayMs = 1800) {
  clearProgressResetTimer()
  progressResetTimer.value = setTimeout(() => {
    if (!isBusy.value) {
      resetProgress()
    }
  }, delayMs)
}

function startProgress(kind: ProgressKind, title: string, steps: string[]) {
  clearProgressResetTimer()
  progressSession.value = { kind, title, steps }
  progressStepIndex.value = 0
}

function setProgressStep(index: number) {
  if (!progressSession.value) return
  const maxIndex = Math.max(0, progressSession.value.steps.length - 1)
  progressStepIndex.value = Math.min(Math.max(index, 0), maxIndex)
}

function advanceProgressStep(index: number) {
  if (index > progressStepIndex.value) {
    setProgressStep(index)
  }
}

function completeProgress() {
  if (!progressSession.value) return
  setProgressStep(progressSession.value.steps.length - 1)
  scheduleProgressReset()
}

function failProgress() {
  if (!progressSession.value) return
  scheduleProgressReset(3200)
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function applyExportProgress(event: ExportBackupProgressEvent) {
  if (event.stage === 'collecting-data') {
    setProgressStep(0)
    return
  }
  if (event.stage === 'generating-file') {
    advanceProgressStep(1)
    return
  }
  if (event.stage === 'completed') {
    advanceProgressStep(2)
  }
}

function applyImportProgress(event: ReplaceBackupProgressEvent) {
  if (event.stage === 'deleting-collection') {
    setProgressStep(0)
    return
  }
  if (event.stage !== 'inserting-collection' || !event.collectionKey) return

  const stepByCollection: Record<BackupCollectionKey, number> = {
    accounts: 1,
    transactions: 2,
    recurrents: 3,
    investment_positions: 4,
    investment_events: 4,
    history: 5,
  }

  advanceProgressStep(stepByCollection[event.collectionKey])
}

function applyClearProgress(event: ReplaceBackupProgressEvent) {
  if (event.stage !== 'deleting-collection' || !event.collectionKey) return

  const stepByCollection: Record<BackupCollectionKey, number> = {
    transactions: 0,
    recurrents: 1,
    investment_events: 2,
    investment_positions: 2,
    history: 3,
    accounts: 3,
  }

  advanceProgressStep(stepByCollection[event.collectionKey])
}

onBeforeUnmount(() => {
  clearProgressResetTimer()
})

onBeforeRouteLeave(() => {
  if (!isBusy.value) return true

  appToast.warning({
    title: 'Operação em andamento',
    description: 'Aguarde o término para trocar de tela.',
  })
  return false
})

async function reloadAllStores() {
  await Promise.all([
    accountsStore.loadAccounts(),
    transactionsStore.loadTransactions(),
    recurrentsStore.loadRecurrents(),
    historyStore.loadHistory(),
    investmentPositionsStore.loadPositions(),
    investmentEventsStore.loadEvents(),
  ])

  const recomputeResult = await investmentEventsStore.recomputeAllPositions()
  if (recomputeResult.failed > 0) {
    console.error(
      `Falha ao recalcular ${recomputeResult.failed} de ${recomputeResult.total} posicoes`,
    )
  }

  await investmentPositionsStore.loadPositions()
}

async function handleClearAll() {
  if (clearing.value) return

  clearing.value = true
  clearConfirmOpen.value = false
  startProgress('clear', 'Limpando dados do projeto', [...CLEAR_PROGRESS_STEPS])

  try {
    await replaceDataWithBackup(EMPTY_BACKUP_DATA, {
      onProgress: applyClearProgress,
    })

    advanceProgressStep(4)
    await reloadAllStores()
    completeProgress()

    appToast.success({
      title: 'Dados removidos',
      description: 'Todos os dados foram limpos com sucesso.',
    })
  } catch (error: any) {
    console.error('Erro ao limpar dados:', error)
    appToast.error({
      title: 'Erro ao limpar dados',
      description: error?.message || 'Ocorreu um erro ao remover os dados.',
    })
    failProgress()
  } finally {
    clearing.value = false
    clearConfirmOpen.value = false
  }
}

async function handleExportJson() {
  if (exportingJson.value) return

  exportingJson.value = true
  startProgress('export', 'Exportando backup completo', [...EXPORT_PROGRESS_STEPS])
  const startedAtMs = Date.now()

  try {
    const filename = await exportBackupJson({
      onProgress: applyExportProgress,
    })
    const elapsedMs = Date.now() - startedAtMs
    if (elapsedMs < EXPORT_MODAL_MIN_DURATION_MS) {
      await delay(EXPORT_MODAL_MIN_DURATION_MS - elapsedMs)
    }
    completeProgress()

    appToast.success({
      title: 'Backup completo exportado',
      description: `Snapshot completo do banco gerado: ${filename}`,
    })
  } catch (error: any) {
    console.error('Erro ao exportar JSON:', error)
    appToast.error({
      title: 'Falha na exportação',
      description: error?.message || 'Não foi possível exportar o backup JSON.',
    })
    failProgress()
  } finally {
    exportingJson.value = false
  }
}

function openImportPicker() {
  if (isBusy.value) return
  importInputRef.value?.click()
}

async function handleImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  parsingImport.value = true
  try {
    const text = await file.text()
    const data = parseBackupFileContent(text)

    pendingImportData.value = data
    pendingImportFileName.value = file.name
    importConfirmOpen.value = true
  } catch (error: any) {
    console.error('Erro ao ler backup:', error)
    appToast.error({
      title: 'Arquivo inválido',
      description: error?.message || 'Não foi possível validar o arquivo selecionado.',
    })
    resetPendingImport()
  } finally {
    parsingImport.value = false
    input.value = ''
  }
}

async function confirmImport() {
  if (importing.value || !pendingImportData.value) return

  importing.value = true
  importConfirmOpen.value = false
  startProgress('import', 'Importando backup completo', [...IMPORT_PROGRESS_STEPS])

  try {
    const summary = summarizeBackup(pendingImportData.value)

    await replaceDataWithBackup(pendingImportData.value, {
      onProgress: applyImportProgress,
    })

    advanceProgressStep(6)
    await reloadAllStores()
    completeProgress()

    appToast.success({
      title: 'Backup completo restaurado',
      description: `Banco do projeto substituído com sucesso (${summary.accounts} contas, ${summary.transactions} transações, ${summary.recurrents} recorrentes, ${summary.investmentPositions} posições, ${summary.investmentEvents} eventos, ${summary.history} histórico).`,
    })
  } catch (error: any) {
    console.error('Erro ao importar backup:', error)
    appToast.error({
      title: 'Falha na importação',
      description: error?.message || 'Não foi possível importar o backup.',
    })
    failProgress()
  } finally {
    importing.value = false
    importConfirmOpen.value = false
    resetPendingImport()
  }
}

function cancelImport() {
  importConfirmOpen.value = false
  resetPendingImport()
}
</script>

<template>
  <div>
    <div class="mb-6 flex items-center gap-3">
      <Settings class="h-6 w-6 text-muted-foreground" />
      <h1 class="text-2xl font-bold">Configurações</h1>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Gerenciamento de Dados</CardTitle>
        <CardDescription>
          Exporte backup, importe dados e mantenha seus registros seguros.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex flex-col gap-4 md:flex-row">
          <div class="rounded-lg border p-4 space-y-3">
            <div>
              <p class="font-medium">Exportar backup completo (JSON)</p>
              <p class="text-sm text-muted-foreground">
                Exporta TODO o banco de dados do projeto (todas as colecoes) no formato financeiro-backup-YYYY-MM-DD.json.
              </p>
            </div>
            <Button variant="outline" :disabled="isBusy" @click="handleExportJson">
              <Download class="h-4 w-4 mr-2" />
              {{ exportingJson ? 'Exportando...' : 'Exportar backup completo' }}
            </Button>
          </div>
  
          <div class="rounded-lg border p-4 space-y-3">
            <div>
              <p class="font-medium">Importar backup completo (JSON)</p>
              <p class="text-sm text-muted-foreground">
                Importa o mesmo arquivo exportado pelo backup completo e substitui TODO o banco de dados do projeto.
              </p>
            </div>
            <Button variant="outline" :disabled="isBusy" @click="openImportPicker">
              <Upload class="h-4 w-4 mr-2" />
              {{ parsingImport ? 'Lendo arquivo...' : 'Selecionar backup JSON' }}
            </Button>
            <input
              ref="importInputRef"
              type="file"
              accept=".json,application/json"
              class="hidden"
              @change="handleImportFileChange"
            >
          </div>
        </div>

        <div class="rounded-lg border p-4">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="font-medium">Limpar todos os dados</p>
              <p class="text-sm text-muted-foreground">
                Remove contas, transações, recorrentes, investimentos e histórico.
              </p>
            </div>
            <Button
              variant="destructive"
              class="bg-destructive!"
              :disabled="isBusy"
              @click="clearConfirmOpen = true"
            >
              <Trash2 class="h-4 w-4 mr-2" />
              {{ clearing ? 'Limpando...' : 'Limpar Tudo' }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <ConfirmDialog
      :open="clearConfirmOpen"
      title="Limpar todos os dados?"
      description="Esta ação é irreversível. Todos os dados serão removidos."
      confirm-label="Sim, limpar tudo"
      cancel-label="Cancelar"
      :destructive="true"
      :loading="clearing"
      @confirm="handleClearAll"
      @cancel="clearConfirmOpen = false"
    />

    <ConfirmDialog
      :open="importConfirmOpen"
      title="Importar backup completo e substituir banco?"
      :description="importConfirmDescription"
      confirm-label="Sim, importar"
      cancel-label="Cancelar"
      :destructive="true"
      :loading="importing"
      @confirm="confirmImport"
      @cancel="cancelImport"
    />

    <div
      v-if="isBusy && showProgress"
      class="fixed inset-0 z-[200] bg-background/80 backdrop-blur-[1px] cursor-wait"
    >
      <div class="absolute inset-0" />
      <div class="absolute inset-x-0 top-20 px-4">
        <Card class="mx-auto max-w-2xl border-primary/30 shadow-lg">
          <CardContent class="pt-6 space-y-3">
            <div class="flex items-center gap-2">
              <Spinner class="h-4 w-4 text-primary" />
              <p class="font-medium">Operação em andamento</p>
            </div>
            <p class="text-sm text-muted-foreground">
              Aguarde a conclusão. A navegação e os cliques estão temporariamente bloqueados.
            </p>
            <Progress :model-value="progressPercent" class="h-2" />
            <p class="text-sm font-medium">{{ progressCurrentLabel }}</p>
            <p class="text-xs text-muted-foreground">{{ progressStepMeta }}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
