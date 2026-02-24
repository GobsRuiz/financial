# 0) Base do projeto ✅ CONCLUÍDA

## 0.1 Root

* [x] Garantir `db.json` no root com collections vazias (accounts, transactions, recurrents, investments, tags, history)
* [x] Root `package.json`: scripts `dev` (json-server + client) e dependências (`json-server`, `concurrently`)
* [x] Script `mock`: `json-server --watch db.json --port 3001 --delay 100`

## 0.2 Client (Nuxt 4)

* [x] `client/package.json`: instalar dependências (shadcn-vue, Pinia, Zod, vee-validate zod, vue-the-mask, dayjs, uuid, nuxt fonts, lucide-vue-next)
* [x] `nuxt.config.ts`:

  * [x] habilitar shadcn-nuxt
  * [x] configurar Nuxt Fonts (Inter)
  * [x] configurar Tailwind CSS
  * [x] configurar proxy/api baseURL (pra apontar pro json-server em dev)
* [x] Tema escuro fixo (classe `dark` no html)

## 0.3 Electron (estrutura)

* [ ] `electron/` com `package.json` (electron, electron-builder, fs-extra)
* [x] `electron/main.js`:

  * [x] DEV: carregar `http://localhost:3000`
  * [x] PROD: carregar arquivo do build Nuxt (`client/.output/public/index.html`)
* [ ] `electron-builder` config básico para Windows

---

# 1) Módulo 1 — MOVIMENTAÇÕES (primeiro)

## 1.1 Modelos e Schemas ✅ CONCLUÍDA

* [x] `client/schemas/zod-schemas.ts`:

  * [x] `accountSchema`
  * [x] `transactionSchema`
  * [x] `recurrentSchema`
  * [x] `investmentSchema`
  * [x] validações de consistência para parcelas (total vs parcela * n)
* [x] `client/utils/money.ts`:

  * [x] `parseBRLToCents(string)->int`
  * [x] `formatCentsToBRL(int)->string`
* [x] `client/utils/dates.ts`:

  * [x] `addMonths(date, n)`
  * [x] `toISODate(date)` -> YYYY-MM-DD

## 1.2 Acesso ao "DB" (json-server) ✅ CONCLUÍDA

* [x] `client/utils/api.ts` (fetch wrapper):

  * [x] `get(path)`
  * [x] `post(path, body)`
  * [x] `patch(path, body)`
  * [x] `del(path)`
* [x] Padronizar baseURL: `http://localhost:3001` (dev)

## 1.3 Stores (Pinia) ✅ CONCLUÍDA

* [x] `app/stores/useAccounts.ts`:

  * [x] `loadAccounts()`
  * [x] `addAccount()`
  * [x] `updateAccount()`
  * [x] `adjustBalance(accountId, deltaCents, note)`
* [x] `app/stores/useTags.ts`:

  * [x] `loadTags()`
  * [x] `createTag(name)`
  * [x] `ensureTag(name)` (retorna existente ou cria)
* [x] `app/stores/useTransactions.ts`:

  * [x] `loadTransactions(filters)`
  * [x] `addTransaction(tx)`
  * [x] `generateInstallments(tx)` (gera N transações)
  * [x] `markPaid(txId)` (paid + ajuste saldo + history)
* [x] `app/stores/useRecurrents.ts`:

  * [x] `loadRecurrents()`
  * [x] `addRecurrent()`
  * [x] `updateRecurrent()`
* [x] `app/stores/useInvestments.ts`:

  * [x] `loadInvestments()`
  * [x] `addInvestment()`
  * [x] `updateInvestment()`
* [x] `app/stores/useHistory.ts`:

  * [x] `appendHistory(accountId, balance, note)`
  * [x] `loadHistory()`

## 1.4 Componentes base (UI/UX) ✅ CONCLUÍDA

* [x] `app/components/AppSidebar.vue`

  * [x] links: Dashboard, Movimentações, Pendentes, Contas, Histórico, Settings
* [x] `app/layouts/default.vue`

  * [x] layout com sidebar + content
  * [x] tema escuro fixo aplicado
* [x] `app/components/TagSelect.vue`

  * [x] multi select
  * [x] criar tag na hora (ensureTag)
* [x] `app/components/ConfirmDialog.vue` (reutilizável)

## 1.5 Página Movimentações ✅ CONCLUÍDA

* [x] Criar `app/pages/movimentacoes.vue`

  * [x] topo: select tipo (Transação / Recorrente / Investimento)
  * [x] render form dinâmico conforme tipo
  * [x] render lista abaixo + filtros

## 1.6 Form Dinâmico (Movimentação) ✅ CONCLUÍDA

* [x] `app/components/MovimentacaoForm.vue`

  * [x] Select "tipo de movimentação" (ou receber por prop)
  * [x] Form "Transação":

    * [x] conta, tipo (expense/income/transfer), categoria, valor, data
    * [x] tags + descrição opcional
    * [x] toggle parcelado + campos (total, valor parcela, produto)
    * [x] toggle "pago"
    * [x] submit -> validação zod
    * [x] se parcelado -> generateInstallments
  * [x] Form "Recorrente":

    * [x] kind (income/expense/benefit), nome, valor, frequência, dia do mês opcional, vencimento opcional, descrição opcional, ativo
  * [x] Form "Investimento":

    * [x] conta, asset_tag (select+criar), aplicado, current opcional, descrição opcional
  * [ ] Máscaras (vue-the-mask) para valor/data/parcela

## 1.7 Lista + Expand de Parcelas ✅ CONCLUÍDA

* [x] `app/components/MovimentacoesList.vue`

  * [x] filtros: conta, mês, tipo, tags, categoria, status (pago/pendente)
  * [x] item transação parcelada aparece como resumo
  * [x] botão expandir
* [x] `app/components/ParcelasExpansion.vue`

  * [x] lista de parcelas do parentId
  * [x] checkbox pago por parcela -> markPaid

---

# 2) Módulo 2 — PENDENTES (segundo)

## 2.1 Página Pendentes

* [ ] Criar `app/pages/pendentes.vue`

  * [ ] header: mês selecionado (navegação com setas)
  * [ ] cards: total pendente / total pago / saldo previsto
  * [ ] lista de pendentes (scroll interno)
  * [ ] filtros: conta, tipo (recorrente/transação)

## 2.2 Gerar itens pendentes do mês

* [ ] `useTransactions`:

  * [ ] getter `unpaidForMonth(month)` retorna transações não pagas do mês
* [ ] Combinar transações não pagas + recorrentes ativos numa lista unificada
* [ ] `recurrentId` adicionado ao transactionSchema para vincular recorrente à transação criada
* [ ] Pendente do tipo "recurrent" ao marcar "pago" -> cria transaction daquele mês e já paga

## 2.3 Marcar pago (efeito completo)

* [ ] Ao marcar pago:

  * [ ] transaction: PATCH paid + update balance + history
  * [ ] recurrent: criar transaction + marcar pago + update balance + history

---

# 3) Módulo 3 — SETTINGS (terceiro)

## 3.1 Página Settings

* [ ] Criar `app/pages/settings.vue`

  * [ ] botão "Limpar histórico"
  * [ ] modal confirm
* [ ] Implementar "limpar":

  * [ ] DELETE collections no json-server (ou sobrescrever db.json via script dev)
  * [ ] no MVP: criar helper que faz "reset" via várias requisições DELETE (ou setar arrays vazias)

---

# 4) Módulo 4 — CONTAS (quarto)

## 4.1 Página Contas

* [ ] Criar `app/pages/contas.vue`

  * [ ] lista de accounts
  * [ ] botão adicionar
  * [ ] editar account (modal)
* [ ] `app/components/AccountFormModal.vue`

  * [ ] bank, label, saldo
  * [ ] card_closing_day (opcional)
  * [ ] card_due_day (opcional)

---

# 5) Módulo 5 — DASHBOARD (quinto)

## 5.1 Página Dashboard

* [ ] Atualizar `app/pages/index.vue`

  * [ ] cards: entradas mês, saídas mês, saldo, guardado/investido, pendente
  * [ ] mini gráficos com Nuxt Charts (bem simples)
  * [ ] lista últimas movimentações (top 10)
* [ ] Cálculos:

  * [ ] entradas = soma income mês
  * [ ] saídas = soma expense mês
  * [ ] pendentes = unpaid do mês
  * [ ] saldo total = soma balances

---

# 6) Módulo 6 — HISTÓRICO (último)

## 6.1 Página Histórico

* [ ] Criar `app/pages/historico.vue`

  * [ ] tabs: Transactions / Recurrents / Investments / Balance history
  * [ ] filtros e busca
* [ ] Nuxt Charts: evolução de saldo por mês (baseado em `history`)

---

# 7) Electron (integração real pós-MVP dev)

## 7.1 Modo dev

* [ ] Electron carrega `http://localhost:3000`
* [ ] json-server rodando no root: `http://localhost:3001`

## 7.2 Modo prod (build)

* [ ] build do nuxt
* [ ] Electron carrega `client/.output/public/index.html`
* [ ] substituir json-server por persistência direta via Electron (fase futura):

  * [ ] criar API no preload: read/write db.json em `userData`
  * [ ] client usa `window.api` ao invés de HTTP

---

# 8) Extras (depois)

* [ ] Notificações (contas vencendo)
* [ ] Agrupamento real de fatura por fechamento/vencimento
* [ ] Gráficos mais completos
* [ ] Export/Import JSON (você não quer agora)

---
