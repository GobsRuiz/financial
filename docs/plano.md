Abaixo está o **PLANO COMPLETO (arquivo único)** com **todas as etapas** e **tarefas**, cada uma com: objetivo, arquivos a criar/editar, responsabilidades, contrato de dados, fluxo e critérios de pronto. Você pode copiar e colar como `docs/plan.md` (ou substituir seu `docs/blueprint.md`).

---

````markdown
# Plano de Desenvolvimento — FINANCEIRO (Nuxt 4 + Electron + json-server)
Versão: 1.0 (estrutura igual ao projeto atual)

## 1) Objetivo do produto
App desktop (Electron) para controle financeiro local, manual, com:
- Movimentações (Transação, Recorrente, Investimento) via 1 tela com form dinâmico
- Pendentes do mês (marcar como pago/recebido e atualizar saldo)
- Contas bancárias (com opcional fechamento/vencimento de fatura)
- Settings (limpar histórico)
- Dashboard e Histórico depois
- Tema escuro fixo (sem alternância)

## 2) Estrutura real do projeto (congelada)
FINANCEIRO/
- client/ (Nuxt 4)
  - app/
    - components/
    - composables/
    - layouts/default.vue
    - middleware/
    - pages/
    - stores/
    - app.vue
  - assets/
  - public/
  - schemas/zod-schemas.ts
  - server/
  - utils/
  - nuxt.config.ts
  - package.json
- electron/
- docs/
  - blueprint.md (ou plan.md)
- db.json
- package.json (root)

---

# ETAPA 0 — BASE DO PROJETO E DEPENDÊNCIAS

## Objetivo
Deixar o projeto rodando com:
- Nuxt dev (client)
- json-server rodando no root
- Estrutura e estilos globais (dark fixo)
- Navegação base (layout + sidebar)

## Arquivos (Root)
### 0.1 /db.json
**Responsabilidade:** iniciar collections vazias.
```json
{
  "accounts": [],
  "transactions": [],
  "recurrents": [],
  "investments": [],
  "tags": [],
  "history": []
}
````

### 0.2 /package.json (root)

**Responsabilidade:** orquestrar dev (mock + nuxt).
Scripts esperados:

* dev: sobe json-server + nuxt (client)
* mock: json-server no root

Checklist:

* [ ] json-server na porta 3001
* [ ] concurrently rodando mock + nuxt

## Arquivos (Client)

### 0.3 client/package.json

**Responsabilidade:** deps Nuxt UI + validação + máscara + charts + icons + fonts.

### 0.4 client/nuxt.config.ts

**Responsabilidade:**

* Nuxt UI habilitado
* Nuxt Fonts (Inter)
* CSS global (assets)
* (Dev) baseURL do json-server definido (via runtimeConfig ou util)

### 0.5 client/assets/styles/main.scss

**Responsabilidade:** tema escuro fixo global.

* body background escuro
* textos claros
* bordas e cards com contraste
* espaçamentos consistentes

### 0.6 client/app/layouts/default.vue

**Responsabilidade:** layout base (sidebar + conteúdo).

* Sidebar fixa
* Content com padding e largura consistente
* Scroll interno para listas grandes

### 0.7 client/app/components/Sidebar.vue

**Responsabilidade:** navegação.
Rotas:

* /
* /movimentacoes
* /pendentes
* /contas
* /settings
* (/historico depois)

## Critério de pronto (Etapa 0)

* [ ] `npm run dev` no root sobe Nuxt + json-server
* [ ] Página inicial renderiza com layout e sidebar
* [ ] Tema escuro aplicado
* [ ] Rotas navegam (mesmo que páginas vazias)

---

# ETAPA 1 — FUNDAÇÃO DE DADOS (Schemas, Utils, API)

## Objetivo

Criar o alicerce:

* validação Zod
* utilidades de money e dates
* wrapper de API (json-server)
* modelos “de fato” que o app vai usar

## Arquivos

### 1.1 client/schemas/zod-schemas.ts

**Responsabilidade:** schemas oficiais.
Schemas:

* accountSchema
* transactionSchema (+ parcelas)
* recurrentSchema
* investmentSchema

Regras:

* centavos = int
* datas ISO YYYY-MM-DD
* parcelas: total >= 2, index 1..total
* validação de consistência:

  * total informado e parcela*total coerente (tolerância 0)

### 1.2 client/utils/money.ts

**Responsabilidade:**

* parseBRLToCents(input: string): number
* formatCentsToBRL(cents: number): string
* sanitizeMoneyInput(str): string (opcional)

### 1.3 client/utils/dates.ts

**Responsabilidade:**

* toISODate(Date|string): string
* addMonths(isoDate: string, n: number): string
* monthKey(isoDate): "YYYY-MM"
* nowISO(): string

### 1.4 client/utils/api.ts

**Responsabilidade:** wrapper para json-server.

* baseURL: [http://localhost:3001](http://localhost:3001) (dev)
  Funções:
* apiGet(path, params?)
* apiPost(path, body)
* apiPatch(path, body)
* apiDelete(path)

## Critério de pronto (Etapa 1)

* [ ] Schemas validam corretamente exemplos
* [ ] Money converte e formata
* [ ] API wrapper consegue GET /accounts e retorna array

---

# ETAPA 2 — STORES (Pinia) COMPLETAS

## Objetivo

Centralizar toda a regra de negócio:

* CRUD via json-server
* cálculo de saldo e histórico
* geração de parcelas
* criação de tags on-the-fly
* filtros básicos (mais tarde)

## Arquivos

### 2.1 client/app/stores/useAccounts.ts

**State:**

* accounts: Account[]
  **Actions:**
* loadAccounts()
* addAccount(data)
* updateAccount(id, patch)
* adjustBalance(accountId, deltaCents, note)

  * patch account.balance_cents
  * append history snapshot

### 2.2 client/app/stores/useHistory.ts

**State:** history: HistoryItem[]
**Actions:**

* loadHistory()
* appendHistory(item)

### 2.3 client/app/stores/useTags.ts

**State:** tags: Tag[]
**Actions:**

* loadTags()
* createTag(name)
* ensureTag(name) -> Tag

### 2.4 client/app/stores/useTransactions.ts

**State:** transactions: Transaction[]
**Actions:**

* loadTransactions(filters)
* addTransaction(tx)
* generateInstallments(tx) -> Transaction[]
* markPaid(txId)

  * PATCH paid true
  * accounts.adjustBalance(accountId, amount_cents, note)

### 2.5 client/app/stores/useRecurrents.ts

**State:** recurrents: Recurrent[]
**Actions:**

* loadRecurrents()
* addRecurrent()
* updateRecurrent()
* getRecurrentsForMonth(monthKey)

### 2.6 client/app/stores/useInvestments.ts

**State:** investments: Investment[]
**Actions:**

* loadInvestments()
* addInvestment()
* updateInvestment()

## Critério de pronto (Etapa 2)

* [ ] Criar conta e ver em GET /accounts
* [ ] Criar transação e ver em GET /transactions
* [ ] Marcar transação como paga atualiza saldo e cria history
* [ ] Criar tag “MXRF11” e reutilizar

---

# ETAPA 3 — MOVIMENTAÇÕES (Tela 1 - MVP)

## Objetivo

Entregar a tela principal do app:

* Form dinâmico (Transação / Recorrente / Investimento)
* Lista unificada com filtros
* Parcelas resumidas + expansão

## Arquivos

### 3.1 client/app/pages/movimentacoes.vue

**Responsabilidade:**

* carregar accounts/tags/transactions/recurrents/investments
* mostrar:

  * form dinâmico
  * filtros
  * lista

### 3.2 client/app/components/MovimentacaoForm.vue

**Entradas:**

* tipo selecionado (interno)
  **Saídas:**
* emite "saved"
  **Responsabilidades:**
* valida com Zod (via vee-validate zod)
* usa vue-the-mask em:

  * valor
  * data (se não usar input date nativo)
* comportamento:

  * transação parcelada: gera todas as parcelas automaticamente

Campos:
A) Transação:

* accountId*
* type expense/income/transfer*
* category*
* amount*
* date*
* tags (multi)
* description opcional
* parcelado (toggle)

  * total parcelas
  * valor parcela
  * produto
* paid (toggle)

B) Recorrente:

* accountId*
* kind (income/expense/benefit)*
* name*
* amount*
* frequency (monthly)*
* day_of_month opcional
* due_day opcional
* description opcional
* active (toggle)

C) Investimento:

* accountId*
* asset_tag* (select+create)
* applied*
* current opcional
* description opcional

### 3.3 client/app/components/TagSelect.vue

**Responsabilidade:**

* lista tags existentes
* permitir criar na hora
* retornar string[] tags selecionadas

### 3.4 client/app/components/MovimentacoesList.vue

**Responsabilidade:**

* render lista com:

  * filtros: tipo, conta, mês, tags, categoria, status
* para parceladas:

  * mostrar resumo (1 linha)
  * expandir mostra parcelas

### 3.5 client/app/components/ParcelasExpansion.vue

**Responsabilidade:**

* listar parcelas pelo parentId
* checkbox marcar pago por parcela (markPaid)

## Critério de pronto (Etapa 3)

* [ ] Criar transação simples
* [ ] Criar compra parcelada e ver N parcelas
* [ ] Expandir e marcar parcela paga, saldo atualiza
* [ ] Criar recorrente e ver na lista de recorrentes
* [ ] Criar investimento com asset_tag novo e reutilizar

---

# ETAPA 4 — PENDENTES (Tela 2 - MVP)

## Objetivo

Tela didática para pagar/receber.

* Mostra tudo pendente do mês
* Marca como pago e atualiza saldo/histórico

## Arquivos

### 4.1 client/app/pages/pendentes.vue

**Responsabilidade:**

* selecionar mês
* montar lista unificada de pendentes:

  * transactions unpaid do mês
  * recurrents ativos do mês (itens “pendentes”)
* cards:

  * total pendente
  * total pago
  * saldo previsto

### 4.2 client/app/components/PendentesList.vue

**Responsabilidade:**

* render lista
* ação “pagar”
* filtros: conta, tipo, vencimento

## Regras (pagar recorrente)

Ao marcar recorrente como pago:

* cria uma transaction daquele mês
* marca paid=true
* ajusta saldo e history

## Critério de pronto (Etapa 4)

* [ ] Pendentes do mês listam recorrentes + parcelas não pagas
* [ ] Marcar pendente como pago altera saldo e cria history
* [ ] Totais atualizam

---

# ETAPA 5 — SETTINGS (Tela 3 - MVP)

## Objetivo

Só limpar histórico/dados.

## Arquivos

### 5.1 client/app/pages/settings.vue

* botão “Limpar histórico”
* modal confirmação

### 5.2 client/utils/reset.ts (ou action em stores)

**Responsabilidade:**

* resetar collections:

  * accounts, transactions, recurrents, investments, tags, history

## Critério de pronto (Etapa 5)

* [ ] Apaga tudo e volta para estado inicial

---

# ETAPA 6 — CONTAS (Tela 4)

## Objetivo

Gerenciar contas bancárias, incluindo fechamento/vencimento de fatura (opcional).

## Arquivos

### 6.1 client/app/pages/contas.vue

* lista contas
* botão adicionar
* editar conta

### 6.2 client/app/components/AccountFormModal.vue

Campos:

* bank*
* label*
* balance*
* card_closing_day opcional
* card_due_day opcional

## Critério de pronto (Etapa 6)

* [ ] criar/editar conta
* [ ] salvar dias de fechamento/vencimento (opcional)

---

# ETAPA 7 — DASHBOARD (Tela 5 - depois)

## Objetivo

Resumo visual.

## Arquivos

### 7.1 client/app/pages/index.vue

Cards:

* entradas do mês
* saídas do mês
* saldo total
* investimentos (applied/current)
* pendentes

Charts (Nuxt Charts) — simples:

* saldo por mês (usando history)

## Critério de pronto (Etapa 7)

* [ ] cards corretos
* [ ] ao menos 1 gráfico simples

---

# ETAPA 8 — HISTÓRICO (Tela 6 - por último)

## Objetivo

Tela de histórico com abas por tipo.

## Arquivos

### 8.1 client/app/pages/historico.vue

Tabs:

* Transactions
* Recurrents
* Investments
* Balance history

Filtros e busca.

## Critério de pronto (Etapa 8)

* [ ] tabs funcionando
* [ ] filtros e busca

---

# ETAPA 9 — Electron PROD (após MVP)

## Objetivo

Parar de depender do json-server no app final.

## Arquivos

### 9.1 electron/main.js + preload.js

* expor API segura (read/write db)
* salvar em userData (recomendado)
* no PROD, client usa window.api ao invés de HTTP

## Critério de pronto (Etapa 9)

* [ ] build abre sem servidor
* [ ] dados persistem localmente

---

# ETAPA 10 — Extras (depois)

* Notificações de vencimento
* Fatura com cálculo real por fechamento/vencimento
* Gráficos avançados
* Export/import JSON (se quiser no futuro)

```

---

Se quiser, eu faço mais uma coisa que ajuda muito: um **“mapa de implementação por arquivo”** (tipo: `useTransactions.ts` linha a linha do que precisa ter, com funções e pseudo-código).
::contentReference[oaicite:0]{index=0}
```
