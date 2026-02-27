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
import type { BackupData } from '~/utils/export-import'

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

const importConfirmDescription = computed(() => {
  const summary = pendingImportSummary.value
  if (!summary) {
    return 'Isso substituira TODO o banco de dados atual do projeto. Deseja continuar?'
  }

  return [
    `Arquivo: ${pendingImportFileName.value || 'backup.json'}`,
    'Isso substituira TODO o banco de dados atual do projeto.',
    'O backup e restaurado por completo (nao por conta).',
    `Contas: ${summary.accounts}`,
    `Transacoes: ${summary.transactions}`,
    `Recorrentes: ${summary.recurrents}`,
    `Posicoes: ${summary.investmentPositions}`,
    `Eventos: ${summary.investmentEvents}`,
    `Historico: ${summary.history}`,
  ].join('\n')
})

function resetPendingImport() {
  pendingImportData.value = null
  pendingImportFileName.value = ''
}

async function reloadAllStores() {
  await Promise.all([
    accountsStore.loadAccounts(),
    transactionsStore.loadTransactions(),
    recurrentsStore.loadRecurrents(),
    historyStore.loadHistory(),
    investmentPositionsStore.loadPositions(),
    investmentEventsStore.loadEvents(),
  ])

  for (const position of investmentPositionsStore.positions) {
    try {
      await investmentEventsStore.recomputePosition(position.id)
    } catch (error) {
      console.error(`Erro ao recalcular posicao ${position.id}:`, error)
    }
  }

  await investmentPositionsStore.loadPositions()
}

async function handleClearAll() {
  if (clearing.value) return

  clearing.value = true
  try {
    await replaceDataWithBackup(EMPTY_BACKUP_DATA)
    await reloadAllStores()

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
  } finally {
    clearing.value = false
    clearConfirmOpen.value = false
  }
}

async function handleExportJson() {
  if (exportingJson.value) return

  exportingJson.value = true
  try {
    const filename = await exportBackupJson()
    appToast.success({
      title: 'Backup completo exportado',
      description: `Snapshot completo do banco gerado: ${filename}`,
    })
  } catch (error: any) {
    console.error('Erro ao exportar JSON:', error)
    appToast.error({
      title: 'Falha na exportacao',
      description: error?.message || 'Nao foi possivel exportar o backup JSON.',
    })
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
      title: 'Arquivo invalido',
      description: error?.message || 'Nao foi possivel validar o arquivo selecionado.',
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
  try {
    const summary = summarizeBackup(pendingImportData.value)

    await replaceDataWithBackup(pendingImportData.value)
    await reloadAllStores()

    appToast.success({
      title: 'Backup completo restaurado',
      description: `Banco do projeto substituido com sucesso (${summary.accounts} contas, ${summary.transactions} transacoes, ${summary.recurrents} recorrentes, ${summary.investmentPositions} posicoes, ${summary.investmentEvents} eventos, ${summary.history} historico).`,
    })
  } catch (error: any) {
    console.error('Erro ao importar backup:', error)
    appToast.error({
      title: 'Falha na importacao',
      description: error?.message || 'Nao foi possivel importar o backup.',
    })
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
      <h1 class="text-2xl font-bold">Settings</h1>
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
                Remove contas, transacoes, recorrentes, investimentos e historico.
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
      description="Esta acao e irreversivel. Todos os dados serao removidos."
      confirm-label="Sim, limpar tudo"
      cancel-label="Cancelar"
      :destructive="true"
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
      @confirm="confirmImport"
      @cancel="cancelImport"
    />
  </div>
</template>
