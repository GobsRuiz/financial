# BLUEPRINT COMPLETO

## 0) Estrutura final do repositório (igual ao seu print)

```text
FINANCEIRO/
├─ client/
│  ├─ .nuxt/
│  ├─ app/
│  │  ├─ components/
│  │  ├─ composables/
│  │  ├─ layouts/
│  │  │  └─ default.vue
│  │  ├─ middleware/
│  │  ├─ pages/
│  │  │  └─ index.vue
│  │  ├─ stores/
│  │  │  └─ useTransactions.ts
│  │  └─ app.vue
│  ├─ assets/
│  ├─ public/
│  ├─ schemas/
│  │  └─ zod-schemas.ts
│  ├─ server/
│  ├─ utils/
│  ├─ nuxt.config.ts
│  ├─ package.json
│  └─ tsconfig.json
├─ docs/
│  └─ blueprint.md
├─ electron/
├─ db.json
└─ package.json
```

---

## 1) Regras do projeto (decisões finais)

* App **desktop**: Electron (Windows).
* UI: Nuxt UI + tema **escuro fixo** (sem light mode, sem troca).
* Dados: **manual**, sem conexão bancária e sem import de extrato.
* Persistência: `db.json` como base e `json-server` no dev.
* IDs:

  * `accounts.id`: incremental (number)
  * movimentações (transactions/recurrents/investments/history): UUID (string)
* Dinheiro: sempre em **centavos** (int) no armazenamento.
* Tag de ativo (investimentos): **seleciona existente** ou **cria na hora**, e reutiliza depois.
* Parcelas: cria automaticamente **todas** as parcelas futuras.
* Tela de Pendentes: existe e é separada, organizada e didática.
* Cartão: **não existe como entidade separada**, mas **fatura existe** vinculada à conta bancária (opcional: fechamento e vencimento).

---

## 2) Dependências (confirmadas)

### Root (`/package.json`)

* `json-server`
* `concurrently`

### Client (`/client/package.json`)

* Nuxt 4
* Nuxt UI
* Sass
* Nuxt Fonts
* Lucide icons (Vue)
* Pinia
* Zod + @vee-validate/zod
* vue-the-mask
* dayjs
* uuid
* Nuxt Charts

### Electron (`/electron/package.json`)

* electron
* electron-builder
* fs-extra
* electron-log (opcional)

> Observação arquitetural importante:
> No build final, você pode (depois) **parar de depender do json-server** e escrever/ler JSON direto via Electron. No MVP, dev com json-server é perfeito.

---

## 3) Banco de dados (db.json) – modelo final

### Collections

* `accounts[]`
* `transactions[]`
* `recurrents[]`
* `investments[]`
* `tags[]`
* `history[]`

### Account

* `id` number incremental
* `bank` string (nubank/inter/mp etc)
* `label` string (nome amigável)
* `type` `"bank"` (por enquanto)
* `balance_cents` int
* `card_closing_day?` int 1-31 (opcional)
* `card_due_day?` int 1-31 (opcional)

### Transaction (movimentação única)

* `id` uuid
* `accountId` number
* `date` YYYY-MM-DD
* `type` `expense|income|transfer`
* `category` string
* `amount_cents` int (expense negativo; income positivo)
* `description?` string opcional
* `tags?` string[] (names ou ids — recomendo **names** pra simplificar)
* `paid` boolean
* `installment?`:

  * `parentId` uuid
  * `total` int
  * `index` int
  * `product` string

### Recurrent (recorrente)

* `id` uuid
* `accountId` number
* `kind` `"income"|"expense"|"benefit"` (pra VR/VA e salários)
* `name` string
* `amount_cents` int
* `frequency` `"monthly"` (MVP)
* `day_of_month?` int 1-31 (opcional)
* `due_day?` int 1-31 (opcional) (para contas como luz/aluguel)
* `description?` string (opcional)
* `active` boolean

### Investment

* `id` uuid
* `accountId` number
* `asset_tag` string (ex: MXRF11)
* `applied_cents` int
* `current_cents?` int (pra rendimento manual)
* `description?` string

### Tags

* `id` uuid (ou string simples)
* `name` string

### History (histórico de saldo)

* `id` uuid
* `accountId` number
* `date` YYYY-MM-DD
* `balance_cents` int
* `note?` string

---

## 4) Telas e fluxo (atualizado)

### 4.1 Dashboard (`client/app/pages/index.vue`) — **depois**

**Objetivo**: visão rápida.
**Conteúdo** (MVP+):

* Cards: Entradas mês, Saídas mês, Saldo, Investido/Guardado, Pendente do mês.
* Mini-gráficos: Nuxt Charts (depois).
* Lista: pendentes (atalho) e últimas movimentações.

> Você disse: dashboard é uma das últimas coisas. Perfeito.

---

### 4.2 Movimentações (`/client/app/pages/movimentacoes.vue`) — **primeiro**

Tela única com:

1. **Form dinâmico** (select “tipo de movimentação”)
2. **Lista** (com filtro e expansão)

#### Tipo de movimentação (select)

* `Transação`
* `Recorrente`
* `Investimento`

> Benefício entra como `Recorrente(kind="benefit")`.

#### Form: Transação

Campos:

* Conta (select) **obrigatório**
* Tipo: expense/income/transfer **obrigatório**
* Categoria **obrigatório**
* Valor (máscara) **obrigatório**
* Data **obrigatório**
* Parcelado? (toggle)

  * total parcelas
  * valor parcela
  * produto
* Tags (multi select / creatable)
* Descrição (opcional)
* Pago? (toggle) (default: false)

Ação ao salvar:

* Se não parcelado: cria 1 transaction.
* Se parcelado: cria parentId e gera N transactions:

  * `installment.index` 1..N
  * datas somando +1 mês
  * cada parcela `paid=false` (ou a 1ª conforme toggle)
* Se `paid=true` na parcela marcada:

  * atualiza saldo na hora + gera history

#### Form: Recorrente

Campos:

* Conta*
* `kind` select: income / expense / benefit*
* Nome*
* Valor*
* Frequência (monthly)*
* Dia do mês (opcional)
* Vencimento (opcional)
* Descrição (opcional)
* Ativo (toggle)

Ação ao salvar:

* cria/edita recorrente.
* Pendentes do mês puxa dessa collection.

#### Form: Investimento

Campos:

* Conta*
* Asset Tag* (select + “criar”)
* Valor aplicado*
* Valor atual (opcional)
* Descrição (opcional)

Ação ao salvar:

* cria investimento.
* Se você quiser refletir aporte no saldo da conta, isso pode ser opção futura (MVP: só informativo).

#### Lista (na própria tela)

* Filtros:

  * tipo (transação/recorrente/investimento)
  * conta
  * mês
  * tags
  * categoria
  * status (pago/pendente)
* Cada item:

  * Mostra resumo
  * Se for parcelado: mostra “Geladeira 10x (3/10)” e botão expandir
  * Expandir: lista todas as parcelas com checkbox de pago

---

### 4.3 Pendentes (Contas do mês) (`/client/app/pages/pendentes.vue`) — **segundo**

**Objetivo**: tela didática para marcar tudo como pago/recebido.

Conteúdo:

* Header com mês selecionado
* Cards:

  * Total pendente
  * Total pago
  * Saldo previsto após pagar tudo
* Lista pendente agrupável:

  * por conta
  * por vencimento
  * por “tipo” (recorrentes vs parcelas vs fatura)

Entradas nessa tela:

1. `recurrents` ativos do mês (gera “itens pendentes” do mês)
2. `transactions` com `paid=false` (inclui parcelas)
3. Fatura (ver abaixo)

Ação “Marcar pago”:

* Marca item pago:

  * se item é transaction: `paid=true` e `balance += amount_cents` e history
  * se item é recorrente: cria uma transaction daquele mês e já marca como pago (ou cria pendente e marca)

    * (MVP: recomendo criar transaction e marcar pago na hora, pra ter histórico real)

---

### 4.4 Contas (`/client/app/pages/contas.vue`) — lista/edição — **depois das pendentes**

**Objetivo**: cadastrar contas bancárias e metadados de fatura.

Conteúdo:

* Lista de contas (com banco/label/saldo)
* Botão “Adicionar conta”
* Editar conta

Form de conta:

* Banco*
* Label*
* Saldo inicial*
* (Opcional) Fechamento da fatura (dia)
* (Opcional) Vencimento da fatura (dia)
* Salvar

---

### 4.5 Histórico (`/client/app/pages/historico.vue`) — **por último**

* Abas por tipo:

  * Transactions
  * Recurrents
  * Investments
  * History (saldo por mês)
* Filtros + busca

---

### 4.6 Settings (`/client/app/pages/settings.vue`) — **simples**

* Botão: “Limpar histórico”
* Confirmação: apaga collections (ou reseta db.json)
* No Electron final: também limpa arquivo local

---

## 5) Fatura de cartão vinculada à conta (sem entidade cartão)

Você vai ter na `account`:

* `card_closing_day` (opcional)
* `card_due_day` (opcional)

Como funciona:

* Uma transação pode ter categoria “cartão” (ou flag futura `payment_method="card"`).
* A fatura do mês é:

  * conjunto de transactions do período: do último fechamento até o fechamento atual
* Na tela de pendentes:

  * mostra “Fatura Nubank (vence dia X)” com total
  * Ao marcar pago:

    * marca todas as transactions daquela fatura como pagas (ou cria uma transaction única “Pagamento fatura” — **prefiro marcar cada transação**, pra manter histórico granular e coerente com parcelas)

MVP simplificado:

* Você pode começar sem cálculo automático por fechamento:

  * Só use `card_due_day` para mostrar um “lembrete de vencimento”.
  * O agrupamento por fatura entra depois.

---

## 6) Lógica de saldo + histórico (regra final)

Quando algo vira “Pago”:

1. Atualiza `transactions.paid=true` (ou cria transaction se veio de recorrente)
2. Atualiza `accounts.balance_cents += amount_cents` (income +, expense -)
3. Cria `history` snapshot:

   * `{ accountId, date, balance_cents: novoSaldo, note }`

> Você pediu “legal salvar histórico” — é isso.

---

## 7) Máscaras (vue-the-mask)

Campos com máscara:

* Valor monetário: entrada “R$ 0,00” (você converte para centavos no submit)
* Data: `##/##/####` (ou use input date nativo)
* Dia do mês: `##`
* Parcelas: `##`

---

## 8) Ícones (Lucide)

Usos:

* Sidebar: home, plus, list, wallet, calendar, settings
* Botões: add, edit, delete, check
* Status pago: check-circle

---

## 9) Fontes (Nuxt Fonts)

* Fonte recomendada para dashboard e tabelas: **Inter**
* Config: via `@nuxt/font` no `client/nuxt.config.ts`.

---

## 10) Scripts (fluxo separado)

### Root (`/package.json`) — orquestra

* `dev`: roda json-server + client dev
* `build`: build do nuxt + build electron (depois)

### Client

* `dev`: nuxt dev
* `build`: nuxt build

### Electron

* `start`: abre a janela apontando pra URL dev (durante dev) ou pro build do Nuxt (produção)
* `build`: gera `.exe` (windows)

**Nota prática**: no DEV, o Electron costuma carregar `http://localhost:3000` (Nuxt dev).
No PROD, carrega `client/.output/public/index.html`.

---

## 11) Ordem de implementação (como você definiu)

1. Movimentações (form dinâmico + lista + parcelas)
2. Pendentes (marcar pago + saldo + history)
3. Settings (limpar histórico)
4. Contas (cadastro + campos fatura)
5. Dashboard (cards + nuxt charts)
6. Histórico (abas + filtros)
7. Gráficos avançados, notificações

---

## 12) O que está “pronto” para começar (check)

* Estrutura de pastas: ✅ (igual seu print)
* Decisões de dados e telas: ✅
* Form dinâmico com 3 tipos: ✅
* Parcelas auto: ✅
* Fatura via conta (opcional): ✅
* Tema escuro fixo: ✅