<script setup lang="ts">
import dayjs from 'dayjs'
import { ChevronDown, ChevronRight, Filter, ChevronsUpDown, X, MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-vue-next'
import type { Transaction, Recurrent, InvestmentEvent, InvestmentPosition } from '~/schemas/zod-schemas'
import { useTransactionsStore } from '~/stores/useTransactions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useInvestmentPositionsStore } from '~/stores/useInvestmentPositions'
import { useInvestmentEventsStore } from '~/stores/useInvestmentEvents'
import { useAccountsStore } from '~/stores/useAccounts'
import { parseBRLToCents, formatCentsToBRL } from '~/utils/money'
import { monthKey, nowISO } from '~/utils/dates'
import { useAppToast } from '~/composables/useAppToast'

type MovimentacoesTab = 'transacoes' | 'recorrentes' | 'investimentos'

const props = withDefaults(defineProps<{
  initialTab?: MovimentacoesTab
}>(), {
  initialTab: 'transacoes',
})

const emit = defineEmits<{
  'edit-transaction': [tx: Transaction]
  'edit-recurrent': [rec: Recurrent]
  'tab-change': [tab: MovimentacoesTab]
}>()

const transactionsStore = useTransactionsStore()
const recurrentsStore = useRecurrentsStore()
const investmentPositionsStore = useInvestmentPositionsStore()
const investmentEventsStore = useInvestmentEventsStore()
const accountsStore = useAccountsStore()
const appToast = useAppToast()

// Estado dos filtros abertos por tab
const txFiltersOpen = ref(false)
const recFiltersOpen = ref(false)
const invFiltersOpen = ref(false)
const activeTab = ref<MovimentacoesTab>(props.initialTab)

// ── Filtros Transações ──
const txDefaultMonth = monthKey(nowISO())
const txFilterConta = ref<number | null>(null)
const txFilterMes = ref(txDefaultMonth)
const txFilterStatus = ref<'todos' | 'pago' | 'pendente'>('todos')

// ── Filtros Recorrentes ──
const recFilterConta = ref<number | null>(null)
const recFilterStatus = ref<'todos' | 'ativo' | 'inativo'>('todos')

// ── Filtros Investimentos ──
const invFilterConta = ref<number | null>(null)
const investmentEventTypeOptionsVariable = [
  { label: 'Compra', value: 'buy' },
  { label: 'Venda', value: 'sell' },
  { label: 'Rendimento', value: 'income' },
] as const
const investmentEventTypeOptionsFixed = [
  { label: 'Aporte', value: 'contribution' },
  { label: 'Resgate', value: 'withdrawal' },
  { label: 'Rendimento', value: 'income' },
  { label: 'Vencimento', value: 'maturity' },
] as const
const investmentEventDialogOpen = ref(false)
const editingInvestmentEvent = ref<InvestmentEvent | null>(null)
const savingInvestmentEvent = ref(false)
const investmentEventForm = reactive({
  positionId: '',
  date: nowISO(),
  event_type: 'buy' as InvestmentEvent['event_type'],
  quantity: '',
  unit_price: '',
  amount: '',
  fees: '',
  note: '',
})

// Expand state para parcelas
const expandedParents = ref<Set<string>>(new Set())

// ── Visualização Transação ──
const viewingTransaction = ref<Transaction | null>(null)
const transactionViewDialogOpen = ref(false)
const processingAction = ref<'delete' | 'mark-unpaid' | null>(null)
const isProcessing = computed(() => processingAction.value !== null || savingInvestmentEvent.value)
const deleteInstallmentProgress = ref(0)
const deleteInstallmentTotal = ref(0)
const showDeleteInstallmentModal = ref(false)

const deleteInstallmentPercent = computed(() => {
  if (!deleteInstallmentTotal.value) return 0
  return Math.round((deleteInstallmentProgress.value / deleteInstallmentTotal.value) * 100)
})

const deleteInstallmentCurrentStep = computed(() => {
  if (!deleteInstallmentTotal.value) return 0
  if (deleteInstallmentProgress.value >= deleteInstallmentTotal.value) return deleteInstallmentTotal.value
  return deleteInstallmentProgress.value + 1
})

const deleteInstallmentCurrentLabel = computed(() => {
  if (!deleteInstallmentTotal.value) return 'Excluindo parcelas...'
  return `Excluindo parcela ${deleteInstallmentCurrentStep.value} de ${deleteInstallmentTotal.value}...`
})

const deleteInstallmentStepMeta = computed(() => {
  if (!deleteInstallmentTotal.value) return ''
  return `Etapa ${deleteInstallmentCurrentStep.value} de ${deleteInstallmentTotal.value}`
})

function openViewTransaction(tx: Transaction) {
  if (isProcessing.value) return
  viewingTransaction.value = tx
  transactionViewDialogOpen.value = true
}

const viewingRecurrent = ref<Recurrent | null>(null)
const recurrentViewDialogOpen = ref(false)

function openViewRecurrent(rec: Recurrent) {
  if (isProcessing.value) return
  viewingRecurrent.value = rec
  recurrentViewDialogOpen.value = true
}

// ── Confirm Delete ──
const confirmDeleteOpen = ref(false)
const deleteTarget = ref<{ type: 'transaction' | 'installment-group' | 'recurrent' | 'investment-event'; id: string; label: string } | null>(null)

function toggleExpand(parentId: string) {
  if (isProcessing.value) return
  if (expandedParents.value.has(parentId)) {
    expandedParents.value.delete(parentId)
  } else {
    expandedParents.value.add(parentId)
  }
}

function getAccountLabel(accountId: number) {
  return accountsStore.accounts.find(a => a.id === accountId)?.label ?? '—'
}

function getPositionLabel(positionId: string) {
  const p = investmentPositionsStore.positions.find(pos => pos.id === positionId)
  if (!p) return '—'
  return p.name?.trim() ? `${p.asset_code} · ${p.name}` : p.asset_code
}

function getPositionBucketLabel(positionId: string) {
  const p = investmentPositionsStore.positions.find(pos => pos.id === positionId)
  if (!p) return '—'
  return p.bucket === 'variable' ? 'Renda Variável' : 'Renda Fixa'
}

const selectedInvestmentPosition = computed(() =>
  investmentPositionsStore.positions.find(pos => pos.id === investmentEventForm.positionId),
)

const availableSellQuantity = computed(() => {
  const position = selectedInvestmentPosition.value
  if (!position || position.bucket !== 'variable') return 0
  return getEffectiveAvailableQuantityForSell(position)
})

const investmentEventTypeOptions = computed(() => {
  const position = selectedInvestmentPosition.value
  if (position?.bucket === 'fixed') {
    if (position.investment_type === 'caixinha') {
      return investmentEventTypeOptionsFixed.filter(opt => opt.value !== 'maturity')
    }
    return investmentEventTypeOptionsFixed
  }
  return investmentEventTypeOptionsVariable
})

function formatDisplayDate(date: string) {
  return dayjs(date).isValid()
    ? dayjs(date).format('DD/MM/YYYY')
    : date
}

function formatCentsToInput(cents?: number) {
  if (cents == null) return ''
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function formatQuantityDisplay(quantity: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 8 }).format(quantity)
}

function getEffectiveAvailableQuantityForSell(position: InvestmentPosition) {
  let available = position.quantity_total ?? 0

  if (editingInvestmentEvent.value && editingInvestmentEvent.value.positionId === position.id) {
    const originalQty = editingInvestmentEvent.value.quantity ?? 0
    if (editingInvestmentEvent.value.event_type === 'sell') {
      available += originalQty
    } else if (editingInvestmentEvent.value.event_type === 'buy') {
      available -= originalQty
    }
  }

  return Math.max(0, available)
}

function resetInvestmentEventForm() {
  investmentEventForm.positionId = ''
  investmentEventForm.date = nowISO()
  investmentEventForm.event_type = 'buy'
  investmentEventForm.quantity = ''
  investmentEventForm.unit_price = ''
  investmentEventForm.amount = ''
  investmentEventForm.fees = ''
  investmentEventForm.note = ''
}

// ── Ações ──
function requestDelete(type: 'transaction' | 'installment-group' | 'recurrent' | 'investment-event', id: string, label: string) {
  if (isProcessing.value) return
  deleteTarget.value = { type, id, label }
  confirmDeleteOpen.value = true
}

function requestDeleteTransaction(tx: Transaction) {
  if (isProcessing.value) return
  if (tx.installment?.parentId) {
    if (transactionsStore.hasPaidCreditInInstallmentGroup(tx.installment.parentId)) {
      appToast.warning({
        title: 'Exclusão bloqueada',
        description: 'Não é possível excluir grupo com parcela de crédito já paga.',
      })
      return
    }

    requestDelete('installment-group', tx.installment.parentId, `${tx.installment.product} ${tx.installment.total}x`)
    return
  }

  if (transactionsStore.isPaidCreditTransaction(tx)) {
    appToast.warning({
      title: 'Exclusão bloqueada',
      description: 'Transações de crédito já pagas não podem ser excluídas.',
    })
    return
  }

  requestDelete('transaction', tx.id, tx.description || 'Transacao')
}

function editTransaction(tx: Transaction) {
  if (isProcessing.value) return
  emit('edit-transaction', tx)
}

function canMarkUnpaidTransaction(tx: Transaction) {
  return tx.paid && !tx.installment && tx.type !== 'transfer'
}

async function markTransactionUnpaid(tx: Transaction) {
  if (isProcessing.value || !canMarkUnpaidTransaction(tx)) return
  processingAction.value = 'mark-unpaid'

  try {
    await transactionsStore.markUnpaid(tx.id)
    appToast.success({
      title: 'Pagamento desfeito',
      description: `${tx.description || 'Transacao'} marcada como pendente.`,
    })
  } catch (e: any) {
    appToast.error({
      title: 'Erro ao desfazer pagamento',
      description: e?.message || 'Não foi possível desfazer o pagamento.',
    })
  } finally {
    processingAction.value = null
  }
}

function editRecurrent(rec: Recurrent) {
  if (isProcessing.value) return
  emit('edit-recurrent', rec)
}

function openEditInvestmentEvent(event: InvestmentEvent) {
  if (isProcessing.value) return
  editingInvestmentEvent.value = event
  investmentEventForm.positionId = event.positionId
  investmentEventForm.date = event.date
  investmentEventForm.event_type = event.event_type
  investmentEventForm.quantity = event.quantity != null ? String(event.quantity).replace('.', ',') : ''
  investmentEventForm.unit_price = formatCentsToInput(event.unit_price_cents)
  investmentEventForm.amount = formatCentsToInput(event.amount_cents)
  investmentEventForm.fees = formatCentsToInput(event.fees_cents)
  investmentEventForm.note = event.note ?? ''
  investmentEventDialogOpen.value = true
}

function onInvestmentEventDialogOpenChange(open: boolean) {
  if (!open && savingInvestmentEvent.value) return
  investmentEventDialogOpen.value = open
}

function cancelDelete() {
  if (isProcessing.value) return
  confirmDeleteOpen.value = false
  deleteTarget.value = null
}

function openDeleteInstallmentModal(total: number) {
  deleteInstallmentTotal.value = total
  deleteInstallmentProgress.value = 0
  showDeleteInstallmentModal.value = true
}

function closeDeleteInstallmentModal() {
  showDeleteInstallmentModal.value = false
  deleteInstallmentProgress.value = 0
  deleteInstallmentTotal.value = 0
}

onBeforeRouteLeave(() => {
  if (!showDeleteInstallmentModal.value) return true

  appToast.warning({
    title: 'Operação em andamento',
    description: 'Aguarde a conclusão. A navegação e os cliques estão temporariamente bloqueados.',
  })
  return false
})

async function confirmDelete() {
  if (!deleteTarget.value || isProcessing.value) return
  processingAction.value = 'delete'

  try {
    const { type, id } = deleteTarget.value
    if (type === 'transaction') {
      await transactionsStore.deleteTransaction(id)
    } else if (type === 'installment-group') {
      const total = transactionsStore.transactions.filter(tx => tx.installment?.parentId === id).length
      openDeleteInstallmentModal(total)
      await transactionsStore.deleteInstallmentGroup(id, (current, totalItems) => {
        deleteInstallmentProgress.value = current
        deleteInstallmentTotal.value = totalItems
      })
    } else if (type === 'recurrent') {
      await recurrentsStore.deleteRecurrent(id)
    } else {
      await investmentEventsStore.deleteEvent(id)
    }
    appToast.success({ title: 'Excluído com sucesso' })
  } catch (e: any) {
    appToast.error({ title: 'Erro ao excluir', description: e.message })
  } finally {
    closeDeleteInstallmentModal()
    processingAction.value = null
    confirmDeleteOpen.value = false
    deleteTarget.value = null
  }
}

async function submitInvestmentEvent() {
  if (isProcessing.value) return
  if (!editingInvestmentEvent.value) return
  savingInvestmentEvent.value = true

  try {
    if (!investmentEventForm.positionId) throw new Error('Selecione um ativo')
    if (!investmentEventForm.date) throw new Error('Informe a data')
    if (!investmentEventForm.amount) throw new Error('Informe o valor total')

    const position = selectedInvestmentPosition.value
    if (!position) throw new Error('Ativo invalido')

    if (position.investment_type === 'caixinha' && investmentEventForm.event_type === 'maturity') {
      throw new Error('Evento vencimento nao esta disponivel para caixinha')
    }

    if (position.bucket === 'variable' && (investmentEventForm.event_type === 'buy' || investmentEventForm.event_type === 'sell')) {
      const qty = Number(investmentEventForm.quantity.replace(',', '.'))
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Informe a quantidade')
      if (investmentEventForm.event_type === 'sell') {
        const availableQty = getEffectiveAvailableQuantityForSell(position)
        if (qty > availableQty) {
          throw new Error(`Voce possui apenas ${formatQuantityDisplay(availableQty)} cotas`)
        }
      }
    }

    const payload = {
      positionId: position.id,
      accountId: position.accountId,
      date: investmentEventForm.date,
      event_type: investmentEventForm.event_type,
      amount_cents: parseBRLToCents(investmentEventForm.amount),
      quantity: investmentEventForm.quantity ? Number(investmentEventForm.quantity.replace(',', '.')) : undefined,
      unit_price_cents: investmentEventForm.unit_price ? parseBRLToCents(investmentEventForm.unit_price) : undefined,
      fees_cents: investmentEventForm.fees ? parseBRLToCents(investmentEventForm.fees) : undefined,
      note: investmentEventForm.note || undefined,
    }

    await investmentEventsStore.updateEvent(editingInvestmentEvent.value.id, payload)
    appToast.success({ title: 'Lancamento atualizado' })
    investmentEventDialogOpen.value = false
  } catch (e: any) {
    appToast.error({
      title: 'Erro ao atualizar lancamento',
      description: e?.message || 'Nao foi possivel atualizar o lancamento.',
    })
  } finally {
    savingInvestmentEvent.value = false
  }
}

// Transações filtradas (agrupar parcelas pelo parentId)
const filteredTransactions = computed(() => {
  let txs = transactionsStore.transactions

  if (txFilterConta.value) {
    txs = txs.filter(t => t.accountId === txFilterConta.value)
  }
  if (txFilterMes.value) {
    txs = txs.filter(t => monthKey(t.date) === txFilterMes.value)
  }
  if (txFilterStatus.value === 'pago') {
    txs = txs.filter(t => t.paid)
  } else if (txFilterStatus.value === 'pendente') {
    txs = txs.filter(t => !t.paid)
  }

  // Ordenar por createdAt desc (mais recente primeiro)
  txs = [...txs].sort((a, b) => (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date))

  // Agrupar: mostrar apenas 1 linha por parentId (a primeira parcela)
  const seen = new Set<string>()
  return txs.filter(t => {
    if (t.installment?.parentId) {
      if (seen.has(t.installment.parentId)) return false
      seen.add(t.installment.parentId)
    }
    return true
  })
})

const filteredRecurrents = computed(() => {
  let recs = recurrentsStore.recurrents
  if (recFilterConta.value) {
    recs = recs.filter(r => r.accountId === recFilterConta.value)
  }
  if (recFilterStatus.value === 'ativo') {
    recs = recs.filter(r => r.active)
  } else if (recFilterStatus.value === 'inativo') {
    recs = recs.filter(r => !r.active)
  }
  return recs
})

const filteredInvestments = computed(() => {
  let invs = investmentEventsStore.events
  if (invFilterConta.value) {
    invs = invs.filter(i => i.accountId === invFilterConta.value)
  }
  return [...invs].sort((a, b) => b.date.localeCompare(a.date))
})

const pageSizeOptions = [10, 20, 40, 70, 100] as const

const txPageSize = ref<number>(40)
const txPage = ref(1)
const txGoToPage = ref('')
const txTotalItems = computed(() => filteredTransactions.value.length)
const txTotalPages = computed(() => Math.max(1, Math.ceil(txTotalItems.value / txPageSize.value)))
const txPageStart = computed(() => (txTotalItems.value ? (txPage.value - 1) * txPageSize.value + 1 : 0))
const txPageEnd = computed(() => Math.min(txPage.value * txPageSize.value, txTotalItems.value))
const paginatedTransactions = computed(() => {
  const start = (txPage.value - 1) * txPageSize.value
  return filteredTransactions.value.slice(start, start + txPageSize.value)
})

const recPageSize = ref<number>(40)
const recPage = ref(1)
const recGoToPage = ref('')
const recTotalItems = computed(() => filteredRecurrents.value.length)
const recTotalPages = computed(() => Math.max(1, Math.ceil(recTotalItems.value / recPageSize.value)))
const recPageStart = computed(() => (recTotalItems.value ? (recPage.value - 1) * recPageSize.value + 1 : 0))
const recPageEnd = computed(() => Math.min(recPage.value * recPageSize.value, recTotalItems.value))
const paginatedRecurrents = computed(() => {
  const start = (recPage.value - 1) * recPageSize.value
  return filteredRecurrents.value.slice(start, start + recPageSize.value)
})

const invPageSize = ref<number>(40)
const invPage = ref(1)
const invGoToPage = ref('')
const invTotalItems = computed(() => filteredInvestments.value.length)
const invTotalPages = computed(() => Math.max(1, Math.ceil(invTotalItems.value / invPageSize.value)))
const invPageStart = computed(() => (invTotalItems.value ? (invPage.value - 1) * invPageSize.value + 1 : 0))
const invPageEnd = computed(() => Math.min(invPage.value * invPageSize.value, invTotalItems.value))
const paginatedInvestments = computed(() => {
  const start = (invPage.value - 1) * invPageSize.value
  return filteredInvestments.value.slice(start, start + invPageSize.value)
})

const txStatusOptions = [
  { label: 'Todos', value: 'todos' },
  { label: 'Pago', value: 'pago' },
  { label: 'Pendente', value: 'pendente' },
]

const recStatusOptions = [
  { label: 'Todos', value: 'todos' },
  { label: 'Ativo', value: 'ativo' },
  { label: 'Inativo', value: 'inativo' },
]

const hasTxFilters = computed(() =>
  txFilterConta.value !== null || txFilterMes.value !== txDefaultMonth || txFilterStatus.value !== 'todos'
)
const hasRecFilters = computed(() =>
  recFilterConta.value !== null || recFilterStatus.value !== 'todos'
)
const hasInvFilters = computed(() =>
  invFilterConta.value !== null
)

function clearTxFilters() {
  if (isProcessing.value) return
  txFilterConta.value = null
  txFilterMes.value = txDefaultMonth
  txFilterStatus.value = 'todos'
}
function clearRecFilters() {
  if (isProcessing.value) return
  recFilterConta.value = null
  recFilterStatus.value = 'todos'
}
function clearInvFilters() {
  if (isProcessing.value) return
  invFilterConta.value = null
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(1, page), totalPages)
}

function setTxPage(page: number) {
  if (isProcessing.value) return
  txPage.value = clampPage(page, txTotalPages.value)
}

function setRecPage(page: number) {
  if (isProcessing.value) return
  recPage.value = clampPage(page, recTotalPages.value)
}

function setInvPage(page: number) {
  if (isProcessing.value) return
  invPage.value = clampPage(page, invTotalPages.value)
}

function goToPage(input: string, totalPages: number, setter: (page: number) => void) {
  const parsed = Number(input)
  if (!Number.isFinite(parsed) || parsed < 1) return
  setter(clampPage(Math.trunc(parsed), totalPages))
}

function submitTxGoToPage() {
  if (isProcessing.value) return
  goToPage(txGoToPage.value, txTotalPages.value, setTxPage)
  txGoToPage.value = ''
}

function submitRecGoToPage() {
  if (isProcessing.value) return
  goToPage(recGoToPage.value, recTotalPages.value, setRecPage)
  recGoToPage.value = ''
}

function submitInvGoToPage() {
  if (isProcessing.value) return
  goToPage(invGoToPage.value, invTotalPages.value, setInvPage)
  invGoToPage.value = ''
}

async function focusTransaction(txId: string) {
  if (isProcessing.value) return false
  const target = transactionsStore.transactions.find(tx => tx.id === txId)
  if (!target) return false

  activeTab.value = 'transacoes'
  txFilterConta.value = null
  txFilterMes.value = ''
  txFilterStatus.value = 'todos'
  txGoToPage.value = ''

  await nextTick()

  const groupedParentId = target.installment?.parentId
  const rowTarget = groupedParentId
    ? (filteredTransactions.value.find(tx => tx.installment?.parentId === groupedParentId) ?? target)
    : target

  const index = filteredTransactions.value.findIndex(tx => tx.id === rowTarget.id)
  if (index >= 0) {
    setTxPage(Math.floor(index / txPageSize.value) + 1)
  }

  openViewTransaction(target)
  return true
}

async function focusRecurrent(recId: string) {
  if (isProcessing.value) return false
  const target = recurrentsStore.recurrents.find(rec => rec.id === recId)
  if (!target) return false

  activeTab.value = 'recorrentes'
  recFilterConta.value = null
  recFilterStatus.value = 'todos'
  recGoToPage.value = ''

  await nextTick()

  const index = filteredRecurrents.value.findIndex(rec => rec.id === recId)
  if (index >= 0) {
    setRecPage(Math.floor(index / recPageSize.value) + 1)
  }

  openViewRecurrent(target)
  return true
}

watch(() => props.initialTab, (tab) => {
  if (tab && tab !== activeTab.value) {
    activeTab.value = tab
  }
})

watch(activeTab, (tab) => {
  emit('tab-change', tab)
}, { immediate: true })

watch([txFilterConta, txFilterMes, txFilterStatus], () => {
  txPage.value = 1
  txGoToPage.value = ''
})

watch([recFilterConta, recFilterStatus], () => {
  recPage.value = 1
  recGoToPage.value = ''
})

watch(invFilterConta, () => {
  invPage.value = 1
  invGoToPage.value = ''
})

watch(() => investmentEventForm.positionId, () => {
  const position = selectedInvestmentPosition.value
  if (!position) return

  const validTypes = position.bucket === 'fixed'
    ? ['contribution', 'withdrawal', 'income', 'maturity']
    : ['buy', 'sell', 'income']

  if (!validTypes.includes(investmentEventForm.event_type)) {
    investmentEventForm.event_type = position.bucket === 'fixed' ? 'contribution' : 'buy'
  }
})

watch(() => [investmentEventForm.quantity, investmentEventForm.unit_price], () => {
  if (!selectedInvestmentPosition.value || selectedInvestmentPosition.value.bucket !== 'variable') return
  if (!investmentEventForm.quantity || !investmentEventForm.unit_price) return

  const qty = Number(investmentEventForm.quantity.replace(',', '.'))
  if (!Number.isFinite(qty) || qty <= 0) return

  const cents = parseBRLToCents(investmentEventForm.unit_price)
  investmentEventForm.amount = formatCentsToBRL(Math.round(qty * cents))
})

watch(investmentEventDialogOpen, (open) => {
  if (!open) {
    editingInvestmentEvent.value = null
    resetInvestmentEventForm()
  }
})

watch([txPageSize, txTotalPages], () => {
  setTxPage(txPage.value)
})

watch([recPageSize, recTotalPages], () => {
  setRecPage(recPage.value)
})

watch([invPageSize, invTotalPages], () => {
  setInvPage(invPage.value)
})

defineExpose({
  focusTransaction,
  focusRecurrent,
})
</script>

<template>
  <div class="relative">
  <div :class="isProcessing ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'">
  <Card>
    <CardContent class="pt-6 space-y-4">
      <!-- Tabs por tipo -->
      <Tabs v-model="activeTab">
        <TabsList class="w-full justify-start">
          <TabsTrigger value="transacoes" :disabled="isProcessing">
            Transações
            <Badge v-if="filteredTransactions.length" variant="secondary" class="ml-2 text-xs">
              {{ filteredTransactions.length }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="recorrentes" :disabled="isProcessing">
            Recorrentes
            <Badge v-if="filteredRecurrents.length" variant="secondary" class="ml-2 text-xs">
              {{ filteredRecurrents.length }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="investimentos" :disabled="isProcessing">
            Investimentos
            <Badge v-if="filteredInvestments.length" variant="secondary" class="ml-2 text-xs">
              {{ filteredInvestments.length }}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <!-- ═══ TAB TRANSAÇÕES ═══ -->
        <TabsContent value="transacoes">
          <!-- Filtros Transações -->
          <Collapsible v-model:open="txFiltersOpen" class="mb-4">
            <CollapsibleTrigger as-child>
              <Button variant="ghost" size="sm" class="flex items-center gap-2 w-full justify-between">
                <span class="flex items-center gap-2">
                  <Filter class="h-4 w-4" />
                  Filtros
                </span>
                <ChevronsUpDown class="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent class="pt-3">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Select v-model="txFilterConta">
                  <SelectTrigger>
                    <SelectValue placeholder="Conta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="null">Todas</SelectItem>
                    <SelectItem v-for="acc in accountsStore.accounts" :key="acc.id" :value="acc.id">
                      {{ acc.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Input v-model="txFilterMes" type="month" placeholder="Mês" />

                <Select v-model="txFilterStatus">
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="opt in txStatusOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select v-model="txPageSize">
                  <SelectTrigger>
                    <SelectValue placeholder="Itens por página" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="size in pageSizeOptions" :key="`tx-page-size-${size}`" :value="size">
                      {{ size }} / página
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                v-if="hasTxFilters"
                variant="ghost"
                size="sm"
                class="gap-2 mt-2 ml-auto"
                @click="clearTxFilters"
              >
                <X class="h-4 w-4" />
                Limpar filtros
              </Button>
            </CollapsibleContent>
          </Collapsible>
          <Table v-if="txTotalItems">
            <TableHeader>
              <TableRow>
                <TableHead class="w-8"></TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead class="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-for="tx in paginatedTransactions" :key="tx.id">
                <TableRow
                  class="cursor-pointer"
                  @click="tx.installment ? toggleExpand(tx.installment.parentId) : openViewTransaction(tx)"
                >
                  <TableCell>
                    <button v-if="tx.installment" type="button" class="text-muted-foreground">
                      <ChevronDown v-if="expandedParents.has(tx.installment.parentId)" class="h-4 w-4" />
                      <ChevronRight v-else class="h-4 w-4" />
                    </button>
                  </TableCell>
                  <TableCell :class="tx.type === 'income' ? 'text-green-500' : tx.type === 'transfer' ? 'text-blue-500' : 'text-red-500'">
                    {{ formatCentsToBRL(tx.installment ? tx.amount_cents * tx.installment.total : tx.amount_cents) }}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {{ tx.type === 'expense' ? 'Despesa' : tx.type === 'income' ? 'Receita' : 'Transferência' }}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <template v-if="tx.type === 'transfer' && tx.destinationAccountId">
                      <span class="text-xs">{{ getAccountLabel(tx.accountId) }} → {{ getAccountLabel(tx.destinationAccountId) }}</span>
                    </template>
                    <template v-else>{{ getAccountLabel(tx.accountId) }}</template>
                  </TableCell>
                  <TableCell>
                    <Badge v-if="tx.payment_method === 'credit'" variant="secondary">Crédito</Badge>
                    <Badge v-else-if="tx.payment_method === 'debit'" variant="secondary">Débito</Badge>
                    <span v-else class="text-muted-foreground">—</span>
                  </TableCell>
                  <TableCell>
                    <Badge v-if="tx.paid" variant="outline" class="text-green-500 border-green-500/30">Pago</Badge>
                    <Badge v-else variant="outline" class="text-yellow-500 border-yellow-500/30">Pendente</Badge>
                  </TableCell>
                  <TableCell>{{ formatDisplayDate(tx.date) }}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button variant="ghost" size="icon" class="h-8 w-8" :disabled="isProcessing" @click.stop>
                          <MoreHorizontal class="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem :disabled="isProcessing" @click.stop="openViewTransaction(tx)">
                          <Eye class="h-4 w-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem :disabled="isProcessing" @click.stop="editTransaction(tx)">
                          <Pencil class="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="canMarkUnpaidTransaction(tx)"
                          :disabled="isProcessing"
                          @click.stop="markTransactionUnpaid(tx)"
                        >
                          <X class="h-4 w-4 mr-2" />
                          Desfazer pagamento
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          :disabled="isProcessing"
                          variant="destructive"
                          @click.stop="requestDeleteTransaction(tx)"
                        >
                          <Trash2 class="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                <!-- Parcelas expandidas -->
                <TableRow v-if="tx.installment && expandedParents.has(tx.installment.parentId)" :key="`${tx.id}-expand`">
                  <TableCell colspan="8" class="p-0 pt-0 pb-2">
                    <ParcelasExpansion :parent-id="tx.installment.parentId" />
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
          <div v-if="txTotalItems" class="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p class="text-sm text-muted-foreground">
              Mostrando {{ txPageStart }}-{{ txPageEnd }} de {{ txTotalItems }} itens
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" :disabled="txPage <= 1" @click="setTxPage(txPage - 1)">
                Anterior
              </Button>
              <Button variant="outline" size="sm" :disabled="txPage >= txTotalPages" @click="setTxPage(txPage + 1)">
                Próxima
              </Button>
              <Input
                v-model="txGoToPage"
                type="number"
                min="1"
                :max="txTotalPages"
                placeholder="Página"
                class="h-8 w-24"
                @keyup.enter="submitTxGoToPage"
              />
              <Button variant="secondary" size="sm" @click="submitTxGoToPage">
                Ir
              </Button>
            </div>
          </div>
          <p v-else class="text-center text-muted-foreground py-8">
            Nenhuma transação encontrada.
          </p>
        </TabsContent>

        <!-- ═══ TAB RECORRENTES ═══ -->
        <TabsContent value="recorrentes">
          <!-- Filtros Recorrentes -->
          <Collapsible v-model:open="recFiltersOpen" class="mb-4">
            <CollapsibleTrigger as-child>
              <Button variant="ghost" size="sm" class="flex items-center gap-2 w-full justify-between">
                <span class="flex items-center gap-2">
                  <Filter class="h-4 w-4" />
                  Filtros
                </span>
                <ChevronsUpDown class="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent class="pt-3">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select v-model="recFilterConta">
                  <SelectTrigger>
                    <SelectValue placeholder="Conta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="null">Todas</SelectItem>
                    <SelectItem v-for="acc in accountsStore.accounts" :key="acc.id" :value="acc.id">
                      {{ acc.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select v-model="recFilterStatus">
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="opt in recStatusOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select v-model="recPageSize">
                  <SelectTrigger>
                    <SelectValue placeholder="Itens por página" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="size in pageSizeOptions" :key="`rec-page-size-${size}`" :value="size">
                      {{ size }} / página
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                v-if="hasRecFilters"
                variant="ghost"
                size="sm"
                class="gap-2 mt-2 ml-auto"
                @click="clearRecFilters"
              >
                <X class="h-4 w-4" />
                Limpar filtros
              </Button>
            </CollapsibleContent>
          </Collapsible>

          <Table v-if="recTotalItems">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Dia</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notificar</TableHead>
                <TableHead class="text-right">Valor</TableHead>
                <TableHead class="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="rec in paginatedRecurrents"
                :key="rec.id"
                class="cursor-pointer"
                @click="openViewRecurrent(rec)"
              >
                <TableCell>{{ rec.name }}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{{ rec.kind === 'expense' ? 'Despesa' : 'Receita' }}</Badge>
                </TableCell>
                <TableCell>{{ getAccountLabel(rec.accountId) }}</TableCell>
                <TableCell>{{ rec.due_day ?? rec.day_of_month ?? '—' }}</TableCell>
                <TableCell>
                  <Badge v-if="rec.active" variant="outline" class="text-green-500 border-green-500/30">Ativo</Badge>
                  <Badge v-else variant="outline" class="text-muted-foreground">Inativo</Badge>
                </TableCell>
                <TableCell>
                  <Badge v-if="rec.notify" variant="outline" class="text-blue-500 border-blue-500/30">Sim</Badge>
                  <Badge v-else variant="outline" class="text-muted-foreground">Não</Badge>
                </TableCell>
                <TableCell class="text-right" :class="rec.amount_cents < 0 ? 'text-red-500' : 'text-green-500'">
                  {{ formatCentsToBRL(rec.amount_cents) }}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button variant="ghost" size="icon" class="h-8 w-8" :disabled="isProcessing" @click.stop>
                          <MoreHorizontal class="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                      <DropdownMenuItem :disabled="isProcessing" @click.stop="openViewRecurrent(rec)">
                        <Eye class="h-4 w-4 mr-2" />
                        Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem :disabled="isProcessing" @click.stop="editRecurrent(rec)">
                        <Pencil class="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        :disabled="isProcessing"
                        variant="destructive"
                        @click.stop="requestDelete('recurrent', rec.id, rec.name)"
                      >
                        <Trash2 class="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div v-if="recTotalItems" class="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p class="text-sm text-muted-foreground">
              Mostrando {{ recPageStart }}-{{ recPageEnd }} de {{ recTotalItems }} itens
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" :disabled="recPage <= 1" @click="setRecPage(recPage - 1)">
                Anterior
              </Button>
              <Button variant="outline" size="sm" :disabled="recPage >= recTotalPages" @click="setRecPage(recPage + 1)">
                Próxima
              </Button>
              <Input
                v-model="recGoToPage"
                type="number"
                min="1"
                :max="recTotalPages"
                placeholder="Página"
                class="h-8 w-24"
                @keyup.enter="submitRecGoToPage"
              />
              <Button variant="secondary" size="sm" @click="submitRecGoToPage">
                Ir
              </Button>
            </div>
          </div>
          <p v-else class="text-center text-muted-foreground py-8">
            Nenhuma recorrente encontrada.
          </p>
        </TabsContent>

        <!-- ═══ TAB INVESTIMENTOS ═══ -->
        <TabsContent value="investimentos">
          <!-- Filtros Investimentos -->
          <Collapsible v-model:open="invFiltersOpen" class="mb-4">
            <CollapsibleTrigger as-child>
              <Button variant="ghost" size="sm" class="flex items-center gap-2 w-full justify-between">
                <span class="flex items-center gap-2">
                  <Filter class="h-4 w-4" />
                  Filtros
                </span>
                <ChevronsUpDown class="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent class="pt-3">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select v-model="invFilterConta">
                  <SelectTrigger>
                    <SelectValue placeholder="Conta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="null">Todas</SelectItem>
                    <SelectItem v-for="acc in accountsStore.accounts" :key="acc.id" :value="acc.id">
                      {{ acc.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select v-model="invPageSize">
                  <SelectTrigger>
                    <SelectValue placeholder="Itens por página" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="size in pageSizeOptions" :key="`inv-page-size-${size}`" :value="size">
                      {{ size }} / página
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                v-if="hasInvFilters"
                variant="ghost"
                size="sm"
                class="gap-2 mt-2 ml-auto"
                @click="clearInvFilters"
              >
                <X class="h-4 w-4" />
                Limpar filtros
              </Button>
            </CollapsibleContent>
          </Collapsible>

          <Table v-if="invTotalItems">
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead class="text-right">Qtd</TableHead>
                <TableHead class="text-right">Preço Unit.</TableHead>
                <TableHead class="text-right">Valor</TableHead>
                <TableHead class="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="inv in paginatedInvestments" :key="inv.id">
                <TableCell>{{ formatDisplayDate(inv.date) }}</TableCell>
                <TableCell>{{ getPositionLabel(inv.positionId) }}</TableCell>
                <TableCell><Badge variant="secondary">{{ getPositionBucketLabel(inv.positionId) }}</Badge></TableCell>
                <TableCell>{{ getAccountLabel(inv.accountId) }}</TableCell>
                <TableCell><Badge variant="outline">{{ inv.event_type }}</Badge></TableCell>
                <TableCell class="text-right">{{ inv.quantity ?? '—' }}</TableCell>
                <TableCell class="text-right">{{ inv.unit_price_cents ? formatCentsToBRL(inv.unit_price_cents) : '—' }}</TableCell>
                <TableCell class="text-right">{{ formatCentsToBRL(inv.amount_cents) }}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon" class="h-8 w-8" :disabled="isProcessing">
                        <MoreHorizontal class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem :disabled="isProcessing" @click.stop="openEditInvestmentEvent(inv)">
                        <Pencil class="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        :disabled="isProcessing"
                        variant="destructive"
                        @click.stop="requestDelete('investment-event', inv.id, getPositionLabel(inv.positionId))"
                      >
                        <Trash2 class="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div v-if="invTotalItems" class="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p class="text-sm text-muted-foreground">
              Mostrando {{ invPageStart }}-{{ invPageEnd }} de {{ invTotalItems }} itens
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" :disabled="invPage <= 1" @click="setInvPage(invPage - 1)">
                Anterior
              </Button>
              <Button variant="outline" size="sm" :disabled="invPage >= invTotalPages" @click="setInvPage(invPage + 1)">
                Próxima
              </Button>
              <Input
                v-model="invGoToPage"
                type="number"
                min="1"
                :max="invTotalPages"
                placeholder="Página"
                class="h-8 w-24"
                @keyup.enter="submitInvGoToPage"
              />
              <Button variant="secondary" size="sm" @click="submitInvGoToPage">
                Ir
              </Button>
            </div>
          </div>
          <p v-else class="text-center text-muted-foreground py-8">
            Nenhum investimento encontrado.
          </p>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
  </div>
  <div
    v-if="isProcessing && !showDeleteInstallmentModal"
    class="absolute inset-0 z-20 grid place-items-center rounded-lg bg-background/45 backdrop-blur-[1px]"
  >
    <Spinner class="h-5 w-5" />
  </div>

  <!-- Modal de bloqueio com progresso -->
  <div
    v-if="showDeleteInstallmentModal"
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
          <Progress :model-value="deleteInstallmentPercent" class="h-2" />
          <p class="text-sm font-medium">{{ deleteInstallmentCurrentLabel }}</p>
          <p class="text-xs text-muted-foreground">{{ deleteInstallmentStepMeta }}</p>
        </CardContent>
      </Card>
    </div>
  </div>
  <!-- Modal Visualizacao Transacao -->
  <Dialog v-model:open="transactionViewDialogOpen">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Detalhes da Transação</DialogTitle>
        <DialogDescription>Informações completas da movimentação</DialogDescription>
      </DialogHeader>
      <div v-if="viewingTransaction" class="space-y-4 text-sm">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Valor</p>
            <p class="mt-1 text-lg font-semibold" :class="viewingTransaction.type === 'income' ? 'text-green-500' : 'text-red-500'">
              {{ formatCentsToBRL(viewingTransaction.amount_cents) }}
            </p>
          </div>

          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Tipo</p>
            <p class="mt-1 font-medium">{{ viewingTransaction.type === 'expense' ? 'Despesa' : viewingTransaction.type === 'income' ? 'Receita' : 'Transferência' }}</p>
          </div>
          <div v-if="viewingTransaction.type !== 'transfer'" class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Método</p>
            <p class="mt-1 font-medium">{{ viewingTransaction.payment_method === 'credit' ? 'Crédito' : viewingTransaction.payment_method === 'debit' ? 'Débito' : '—' }}</p>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
            <div class="mt-1">
              <Badge v-if="viewingTransaction.paid" variant="outline" class="text-green-500 border-green-500/30">Pago</Badge>
              <Badge v-else variant="outline" class="text-yellow-500 border-yellow-500/30">Pendente</Badge>
            </div>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Data</p>
            <p class="mt-1 font-medium">{{ formatDisplayDate(viewingTransaction.date) }}</p>
          </div>
          <div v-if="viewingTransaction.type === 'transfer' && viewingTransaction.destinationAccountId" class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Conta Origem</p>
            <p class="mt-1 font-medium">{{ getAccountLabel(viewingTransaction.accountId) }}</p>
          </div>
          <div v-if="viewingTransaction.type === 'transfer' && viewingTransaction.destinationAccountId" class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Conta Destino</p>
            <p class="mt-1 font-medium">{{ getAccountLabel(viewingTransaction.destinationAccountId) }}</p>
          </div>
          <div v-if="viewingTransaction.type !== 'transfer'" class="rounded-md border border-border/60 bg-muted/20 px-3 py-2 sm:col-span-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Conta</p>
            <p class="mt-1 font-medium">{{ getAccountLabel(viewingTransaction.accountId) }}</p>
          </div>
        </div>

        <div class="space-y-2">
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Descrição</p>
            <p class="mt-1 font-medium">{{ viewingTransaction.description || '—' }}</p>
          </div>


          <div v-if="viewingTransaction.installment" class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Parcela</p>
            <p class="mt-1 font-medium">{{ viewingTransaction.installment.index }}/{{ viewingTransaction.installment.total }} — {{ viewingTransaction.installment.product }}</p>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Modal Visualização Recorrente -->
  <Dialog v-model:open="recurrentViewDialogOpen">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Detalhes da Recorrente</DialogTitle>
        <DialogDescription>Informações completas da movimentação</DialogDescription>
      </DialogHeader>
      <div v-if="viewingRecurrent" class="space-y-4 text-sm">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Valor</p>
            <p class="mt-1 text-lg font-semibold" :class="viewingRecurrent.amount_cents < 0 ? 'text-red-500' : 'text-green-500'">
              {{ formatCentsToBRL(viewingRecurrent.amount_cents) }}
            </p>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Tipo</p>
            <p class="mt-1 font-medium">{{ viewingRecurrent.kind === 'expense' ? 'Despesa' : 'Receita' }}</p>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
            <div class="mt-1">
              <Badge v-if="viewingRecurrent.active" variant="outline" class="text-green-500 border-green-500/30">Ativo</Badge>
              <Badge v-else variant="outline" class="text-muted-foreground">Inativo</Badge>
            </div>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Frequência</p>
            <p class="mt-1 font-medium">{{ viewingRecurrent.frequency === 'monthly' ? 'Mensal' : viewingRecurrent.frequency }}</p>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Vencimento</p>
            <p class="mt-1 font-medium">{{ viewingRecurrent.due_day ?? viewingRecurrent.day_of_month ?? '—' }}</p>
          </div>
          <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2 sm:col-span-2">
            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Conta</p>
            <p class="mt-1 font-medium">{{ getAccountLabel(viewingRecurrent.accountId) }}</p>
          </div>
        </div>

        <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
          <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Nome</p>
          <p class="mt-1 font-medium">{{ viewingRecurrent.name }}</p>
        </div>

        <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
          <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Descrição</p>
          <p class="mt-1 font-medium">{{ viewingRecurrent.description || '—' }}</p>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Modal Edicao Evento de Investimento -->
  <Dialog :open="investmentEventDialogOpen" @update:open="onInvestmentEventDialogOpenChange">
    <DialogContent class="max-w-2xl" :show-close-button="!savingInvestmentEvent">
      <DialogHeader>
        <DialogTitle>Editar Lancamento</DialogTitle>
        <DialogDescription>Atualize os dados do evento de investimento.</DialogDescription>
      </DialogHeader>

      <div
        class="grid grid-cols-2 gap-4"
        :class="savingInvestmentEvent ? 'pointer-events-none opacity-70 transition-opacity' : 'transition-opacity'"
      >
        <div class="col-span-2 space-y-2">
          <Label>Ativo *</Label>
          <Select v-model="investmentEventForm.positionId">
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="position in investmentPositionsStore.positions" :key="position.id" :value="position.id">
                {{ getPositionLabel(position.id) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <template v-if="investmentEventForm.positionId">
          <div class="space-y-2">
            <Label>Data *</Label>
            <Input v-model="investmentEventForm.date" type="date" />
          </div>

          <div class="space-y-2">
            <Label>Evento *</Label>
            <Select v-model="investmentEventForm.event_type">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in investmentEventTypeOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <template v-if="selectedInvestmentPosition?.bucket === 'variable' && (investmentEventForm.event_type === 'buy' || investmentEventForm.event_type === 'sell')">
            <div class="space-y-2">
              <Label>Quantidade *</Label>
              <Input v-model="investmentEventForm.quantity" placeholder="Ex: 10" />
              <p
                v-if="investmentEventForm.event_type === 'sell'"
                class="text-xs text-muted-foreground"
              >
                Disponivel: {{ formatQuantityDisplay(availableSellQuantity) }} cotas
              </p>
            </div>
            <div class="space-y-2">
              <Label>Preco unitario</Label>
              <MoneyInput v-model="investmentEventForm.unit_price" />
            </div>
          </template>

          <div class="space-y-2">
            <Label>Valor total *</Label>
            <MoneyInput v-model="investmentEventForm.amount" />
          </div>

          <div class="space-y-2">
            <Label>Taxas</Label>
            <MoneyInput v-model="investmentEventForm.fees" />
          </div>

          <div class="col-span-2 space-y-2">
            <Label>Observação</Label>
            <Input v-model="investmentEventForm.note" placeholder="Opcional" />
          </div>
        </template>
      </div>

      <Button class="w-full" :disabled="isProcessing" @click="submitInvestmentEvent">
        <Spinner v-if="savingInvestmentEvent" class="h-4 w-4 mr-2" />
        {{ savingInvestmentEvent ? 'Salvando...' : 'Atualizar Lancamento' }}
      </Button>
    </DialogContent>
  </Dialog>

  <!-- Confirm Delete Dialog -->
  <ConfirmDialog
    :open="confirmDeleteOpen"
    title="Excluir item?"
    :description="`Deseja excluir '${deleteTarget?.label}'? Esta ação não pode ser desfeita.`"
    confirm-label="Sim, excluir"
    cancel-label="Cancelar"
    :loading="processingAction === 'delete'"
    :destructive="true"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
  />
  </div>
</template>
