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
  * [x] Dialog para formulário (Nova Movimentação)
  * [x] Skeleton loading completo

## 1.6 Form Dinâmico (Movimentação) ✅ CONCLUÍDA

* [x] `app/components/MovimentacaoForm.vue`

  * [x] Tabs para tipo de movimentação (Transação/Recorrente/Investimento)
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

  * [x] Tabs por tipo (Transações/Recorrentes/Investimentos) com badge de contagem
  * [x] Filtros contextuais por tab (collapsible com estado persistente):
    * [x] Transações: Conta + Mês + Status (Pago/Pendente)
    * [x] Recorrentes: Conta + Status (Ativo/Inativo)
    * [x] Investimentos: Conta
  * [x] Botão "Limpar filtros" (só aparece quando tem filtro ativo)
  * [x] item transação parcelada aparece como resumo
  * [x] botão expandir
* [x] `app/components/ParcelasExpansion.vue`

  * [x] lista de parcelas do parentId
  * [x] checkbox pago por parcela -> markPaid

---

# 2) Módulo 2 — PENDENTES (segundo) ✅ CONCLUÍDA

## 2.1 Página Pendentes ✅ CONCLUÍDA

* [x] Criar `app/pages/pendentes.vue`

  * [x] header: mês selecionado (navegação com setas)
  * [x] cards: Saldo (receitas do mês) / Total Pendente (despesas a pagar) / Total Pago (despesas pagas)
  * [x] Skeleton loading (cards + lista)
  * [x] `app/components/PendentesList.vue` com lista unificada + filtros collapsible (Conta + Tipo)

## 2.2 Gerar itens pendentes do mês ✅ CONCLUÍDA

* [x] `useTransactions`:

  * [x] `unpaidForMonth(month)` retorna transações não pagas do mês
  * [x] `hasRecurrentTransaction(recurrentId, month)` verifica duplicata
  * [x] `payRecurrent(rec, month)` cria transaction + paga + ajusta saldo + history
* [x] Combinar transações não pagas + recorrentes ativos numa lista unificada
* [x] `recurrentId` já existia no transactionSchema

## 2.3 Marcar pago (efeito completo) ✅ CONCLUÍDA

* [x] Ao marcar pago:

  * [x] transaction: PATCH paid + update balance + history (via markPaid)
  * [x] recurrent: criar transaction + marcar pago + update balance + history (via payRecurrent)

---

# 3) Módulo 3 — SETTINGS (terceiro) ✅ CONCLUÍDA

## 3.1 Página Settings ✅ CONCLUÍDA

* [x] Criar `app/pages/settings.vue`

  * [x] botão "Limpar dados" com AlertDialog de confirmação (destructive)
  * [x] Deleta todos os itens de cada collection via API
  * [x] Limpa stores locais após reset
  * [x] Feedback visual de sucesso

---

# 4) Módulo 4 — CONTAS (quarto) ✅ CONCLUÍDA

## 4.1 Página Contas ✅ CONCLUÍDA

* [x] Criar `app/pages/contas.vue`

  * [x] lista de accounts em cards (grid 2 colunas)
  * [x] botão "Nova Conta" abre Dialog
  * [x] botão editar em cada card abre Dialog com dados preenchidos
  * [x] Skeleton loading
* [x] `app/components/AccountFormModal.vue`

  * [x] bank, label, saldo
  * [x] card_closing_day (opcional)
  * [x] card_due_day (opcional)
  * [x] modo criar/editar com watch na prop account

---

# 5) Módulo 5 — DASHBOARD (quinto) ✅ CONCLUÍDA

## 5.1 Página Dashboard ✅ CONCLUÍDA

* [x] Atualizar `app/pages/index.vue`

  * [x] 5 cards: Entradas, Saídas, Saldo Total, Investido, Pendentes (com ícones Lucide)
  * [ ] mini gráficos com Nuxt Charts (futuro — lib não instalada)
  * [x] lista últimas movimentações (top 10) com tabela
  * [x] Skeleton loading
* [x] Cálculos:

  * [x] entradas = soma income mês
  * [x] saídas = soma expense mês
  * [x] pendentes = unpaid do mês + recorrentes sem tx
  * [x] saldo total = soma balances
  * [x] investido = soma applied_cents

---

# 6) Módulo 6 — HISTÓRICO (último) ✅ CONCLUÍDA

## 6.1 Página Histórico ✅ CONCLUÍDA

* [x] Criar `app/pages/historico.vue`

  * [x] 4 tabs: Transações / Recorrentes / Investimentos / Saldo (balance history)
  * [x] Filtros collapsible por tab (Conta) com estado persistente
  * [x] Busca global (campo no header)
  * [x] Skeleton loading
  * [x] Badges de contagem por tab
* [ ] Nuxt Charts: evolução de saldo por mês (futuro — lib não instalada)

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
