import { computed, ref } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import { useAccountsStore } from '~/stores/useAccounts'
import { useTransactionsStore } from '~/stores/useTransactions'
import { useRecurrentsStore } from '~/stores/useRecurrents'
import { useInvestmentPositionsStore } from '~/stores/useInvestmentPositions'

const MAX_RESULTS_PER_GROUP = 8

export type GlobalSearchResultKind = 'transaction' | 'recurrent' | 'investment'

export interface GlobalSearchResult {
  id: string
  kind: GlobalSearchResultKind
  title: string
  subtitle: string
  route: {
    path: string
    query?: LocationQueryRaw
  }
}

interface SearchTransaction {
  id: string
  description?: string
  accountId: number
  date: string
  createdAt?: string
}

interface SearchRecurrent {
  id: string
  name: string
  accountId: number
  active: boolean
}

interface SearchInvestmentPosition {
  id: string
  asset_code: string
  name?: string
  accountId: number
  bucket: 'variable' | 'fixed'
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function matchesAllTokens(source: string, normalizedQuery: string) {
  if (!normalizedQuery) return false

  const normalizedSource = normalizeSearchText(source)
  if (!normalizedSource) return false

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  return tokens.every(token => normalizedSource.includes(token))
}

function parseAccountLabel(accountById: Map<number, string>, accountId: number) {
  return accountById.get(accountId) ?? 'Conta'
}

function parseBucketLabel(bucket: 'variable' | 'fixed') {
  return bucket === 'variable' ? 'Renda variavel' : 'Renda fixa'
}

export function useGlobalSearch() {
  const accountsStore = useAccountsStore()
  const transactionsStore = useTransactionsStore()
  const recurrentsStore = useRecurrentsStore()
  const positionsStore = useInvestmentPositionsStore()

  const query = ref('')
  const loading = ref(false)
  const initialized = ref(false)
  const loadError = ref('')

  let loadingPromise: Promise<void> | null = null

  async function ensureLoaded(force = false) {
    if (!force && initialized.value) return
    if (loadingPromise) return loadingPromise

    loadingPromise = (async () => {
      loading.value = true
      loadError.value = ''

      try {
        const results = await Promise.allSettled([
          accountsStore.loadAccounts(),
          transactionsStore.loadTransactions(),
          recurrentsStore.loadRecurrents(),
          positionsStore.loadPositions(),
        ])

        const failedSources: string[] = []
        const labels = ['contas', 'transacoes', 'recorrentes', 'investimentos']
        let anySuccess = false

        for (const [index, result] of results.entries()) {
          if (result.status === 'fulfilled') {
            anySuccess = true
            continue
          }

          failedSources.push(labels[index] ?? `fonte-${index + 1}`)
          console.error(`Erro ao carregar ${labels[index]} para busca global:`, result.reason)
        }

        if (failedSources.length > 0) {
          loadError.value = `Falha ao carregar: ${failedSources.join(', ')}.`
        }

        if (anySuccess) {
          initialized.value = true
        }
      } finally {
        loading.value = false
        loadingPromise = null
      }
    })()

    return loadingPromise
  }

  const normalizedQuery = computed(() => normalizeSearchText(query.value))

  const accountLabelById = computed(() => {
    const map = new Map<number, string>()
    for (const account of accountsStore.accounts) {
      map.set(account.id, account.label)
    }
    return map
  })

  const transactionResults = computed<GlobalSearchResult[]>(() => {
    const normalized = normalizedQuery.value
    if (!normalized) return []

    const transactions = transactionsStore.transactions as SearchTransaction[]

    return transactions
      .filter((tx: SearchTransaction) => {
        if (!tx.description?.trim()) return false
        return matchesAllTokens(tx.description, normalized)
      })
      .sort((a: SearchTransaction, b: SearchTransaction) => (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date))
      .slice(0, MAX_RESULTS_PER_GROUP)
      .map((tx: SearchTransaction) => ({
        id: tx.id,
        kind: 'transaction',
        title: tx.description!.trim(),
        subtitle: `${tx.date} - ${parseAccountLabel(accountLabelById.value, tx.accountId)}`,
        route: {
          path: '/movimentacoes',
          query: {
            tab: 'transacoes',
            txId: tx.id,
          },
        },
      }))
  })

  const recurrentResults = computed<GlobalSearchResult[]>(() => {
    const normalized = normalizedQuery.value
    if (!normalized) return []

    const recurrents = recurrentsStore.recurrents as SearchRecurrent[]

    return recurrents
      .filter((rec: SearchRecurrent) => matchesAllTokens(rec.name, normalized))
      .sort((a: SearchRecurrent, b: SearchRecurrent) => {
        if (a.active !== b.active) return a.active ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      .slice(0, MAX_RESULTS_PER_GROUP)
      .map((rec: SearchRecurrent) => ({
        id: rec.id,
        kind: 'recurrent',
        title: rec.name,
        subtitle: `${rec.active ? 'Ativa' : 'Inativa'} - ${parseAccountLabel(accountLabelById.value, rec.accountId)}`,
        route: {
          path: '/movimentacoes',
          query: {
            tab: 'recorrentes',
            recId: rec.id,
          },
        },
      }))
  })

  const investmentResults = computed<GlobalSearchResult[]>(() => {
    const normalized = normalizedQuery.value
    if (!normalized) return []

    const positions = positionsStore.positions as SearchInvestmentPosition[]

    return positions
      .filter((position: SearchInvestmentPosition) => {
        const searchable = `${position.asset_code} ${position.name ?? ''}`
        return matchesAllTokens(searchable, normalized)
      })
      .sort((a: SearchInvestmentPosition, b: SearchInvestmentPosition) => a.asset_code.localeCompare(b.asset_code))
      .slice(0, MAX_RESULTS_PER_GROUP)
      .map((position: SearchInvestmentPosition) => ({
        id: position.id,
        kind: 'investment',
        title: position.name?.trim()
          ? `${position.asset_code} - ${position.name}`
          : position.asset_code,
        subtitle: `${parseBucketLabel(position.bucket)} - ${parseAccountLabel(accountLabelById.value, position.accountId)}`,
        route: {
          path: '/investimentos',
          query: {
            positionId: position.id,
            bucket: position.bucket,
          },
        },
      }))
  })

  const groupedResults = computed(() => ({
    transactions: transactionResults.value,
    recurrents: recurrentResults.value,
    investments: investmentResults.value,
  }))

  const results = computed(() => [
    ...transactionResults.value,
    ...recurrentResults.value,
    ...investmentResults.value,
  ])

  function clearQuery() {
    query.value = ''
  }

  return {
    query,
    loading,
    loadError,
    initialized,
    ensureLoaded,
    results,
    groupedResults,
    clearQuery,
  }
}
