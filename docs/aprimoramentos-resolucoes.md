# Aprimoramentos e Resoluções
# As tarefas tem que estar muito claras, bem detalhadas e se possível com exemplos.

---

## EXECUTAR

### [ ] 21. Resumo anual
Tela ou seção mostrando totais por mês do ano inteiro.
- Formato tabela/grid: linhas = meses, colunas = Entradas, Saídas, Líquido, Saldo.
- Permite ver sazonalidade e tendências ao longo do ano.
- Pode ser uma tab dentro do Dashboard ou página separada.
**Definir:** localização (dashboard tab ou página nova).

### [ ] 22. Consistência visual e identidade dos bancos
- Ícones/cores por banco nos cards de conta (ex: Nubank = roxo, Inter = laranja, Mercado Pago = azul claro).
- Cores consistentes em todas as telas:
  - Income/Entradas: **verde**
  - Expense/Saídas: **vermelho**
  - Transfer: **azul**
  - Pendente: **amarelo/amber**
  - Pago: **verde** (com check)
- Badge colorido por tipo de transação em listas.
**Arquivos:** componentes de cards em `contas.vue`, `PendentesList.vue`, `MovimentacoesList.vue`, `index.vue`

### [x] 26. Textos sem acentos em strings de interface (encoding)
Diversas strings visíveis ao usuário (headers de tabela, mensagens de toast, labels de filtro, textos de dialog) estão sem acentos. O app mistura strings com acento (nos templates principais) e sem acento (em mensagens JS/toast).

**Lista completa por arquivo:**

**`PendentesList.vue`** — 6 strings visíveis:
- `"Transacoes Avulsas"` → `"Transações Avulsas"`
- `"Descricao"` (2x em headers de tabela) → `"Descrição"`
- `"Acao"` (3x em headers de tabela) → `"Ação"`
- `"Faturas do Cartao"` → `"Faturas do Cartão"`
- `"faturas, transacoes e recorrentes"` → `"faturas, transações e recorrentes"`

**`settings.vue`** — 12 strings:
- `"Operacao em andamento"` (2x) → `"Operação em andamento"`
- `"Aguarde a conclusao. A navegacao e os cliques estao temporariamente bloqueados."` → `"Aguarde a conclusão. A navegação e os cliques estão temporariamente bloqueados."`
- `"Importando transacoes..."` → `"Importando transações..."`
- `"Limpando transacoes..."` → `"Limpando transações..."`
- `"Nao foi possivel exportar o backup JSON."` → `"Não foi possível exportar o backup JSON."`
- `"Nao foi possivel validar o arquivo selecionado."` → `"Não foi possível validar o arquivo selecionado."`
- `"Nao foi possivel importar o backup."` → `"Não foi possível importar o backup."`
- `"Esta acao e irreversivel. Todos os dados serao removidos."` → `"Esta ação é irreversível. Todos os dados serão removidos."`
- `"Transacoes: "` → `"Transações: "`
- `"Posicoes: "` → `"Posições: "`
- `"Falha na exportacao"` → `"Falha na exportação"`
- `"Falha na importacao"` → `"Falha na importação"`

**`contas.vue`** — 5 strings:
- `"Esta acao e irreversivel."` (3x) → `"Esta ação é irreversível."`
- `"transacao(oes)"` → `"transação(ões)"`
- `"posicao(oes)"` → `"posição(ões)"`
- `"historico(s)"` → `"histórico(s)"`
- `"Nao foi possivel excluir a conta."` → `"Não foi possível excluir a conta."`
- `"Nao foi possivel carregar contas"` → `"Não foi possível carregar contas"`

**`MovimentacoesList.vue`** — 4 strings:
- `"Exclusao bloqueada"` (2x) → `"Exclusão bloqueada"`
- `"Transacoes de credito ja pagas nao podem ser excluidas."` → `"Transações de crédito já pagas não podem ser excluídas."`
- `"Nao e possivel excluir grupo com parcela de credito ja paga."` → `"Não é possível excluir grupo com parcela de crédito já paga."`
- `"Nao foi possivel desfazer o pagamento."` → `"Não foi possível desfazer o pagamento."`

**`investimentos.vue`** — 5 strings:
- `"Nao foi possivel excluir"` → `"Não foi possível excluir"`
- `"Nao e possivel alterar a conta de um ativo com lancamentos"` → `"Não é possível alterar a conta de um ativo com lançamentos"`
- `"Nao e possivel alterar o grupo de um ativo com lancamentos"` → `"Não é possível alterar o grupo de um ativo com lançamentos"`
- `"Nao foi possivel carregar investimentos"` → `"Não foi possível carregar investimentos"`
- `"Observacao"` (2x) → `"Observação"`
- `"Esta acao nao pode ser desfeita."` → `"Esta ação não pode ser desfeita."`

**`MovimentacaoForm.vue`** — 1 string:
- `"Selecione uma conta com cartao configurado"` → `"Selecione uma conta com cartão configurado"`

**`alertas.vue`** — 1 string:
- `"Nao foi possivel carregar alertas"` → `"Não foi possível carregar alertas"`

**`GlobalSearch.vue`** — 3 strings:
- `"Transacoes"` (label do grupo) → `"Transações"`
- `"Buscar transacoes, recorrentes e investimentos..."` → `"Buscar transações, recorrentes e investimentos..."`
- `"Digite para buscar por descricao, nome ou codigo do ativo."` → `"Digite para buscar por descrição, nome ou código do ativo."`

**`pagamentos.vue`** — 1 string:
- `"Nao foi possivel carregar pagamentos"` → `"Não foi possível carregar pagamentos"`

**`ParcelasExpansion.vue`** — 1 string:
- `"Nao foi possivel atualizar o status da parcela."` → `"Não foi possível atualizar o status da parcela."`

**Total: ~39 strings** que precisam receber acentos corretos.
**Solução:** Substituir cada string pela versão com acentos. Sem impacto em lógica, apenas visual.

### [x] 32. Implementar testes (unitários, componente e integração)

O projeto não possui nenhum teste automatizado. Implementar cobertura em 3 camadas:

**Ferramenta:** Vitest (já compatível com Nuxt/Vue 3) + @vue/test-utils para componentes + @pinia/testing para stores.

**Camada 1 — Testes unitários (stores Pinia):**
Testar a lógica de negócio isolada dos stores. São os testes de maior valor.
- `useAccounts` — `adjustBalance` (delta positivo/negativo), `deleteAccount` (cascade)
- `useTransactions` — `collectAppliedAccountDeltas` (transferências), `deleteInstallmentGroup`, `markPaid`/`markUnpaid` (ajuste de saldo)
- `useInvestmentEvents` — `recomputePosition` (variable: qty + avgCost, fixed: principal + currentValue), `addEvent`/`deleteEvent` (ajuste de conta)
- `useRecurrents` — criação com `derivePaid`, ativação/desativação
- `useAlerts` (composable) — `toBucket`, `dateForDayInCurrentMonth`, geração de alertas por recorrente/fatura
- Utilitários: `computeCreditInvoiceDueDate`, `formatDisplayDate`, `monthKey`

**Camada 2 — Testes de componente (Vue):**
Testar renderização e interação dos componentes principais.
- `MovimentacaoForm.vue` — validação de campos (valor zero, parcelas max 72, parcelas inteiras, due_day 1-31), submit com dados corretos
- `MovimentacoesList.vue` — filtros (mês, tipo, método), paginação, botões de ação (editar/excluir/pagar)
- `PendentesList.vue` — agrupamento por fatura, exibição de totais, botão pagar fatura
- `ParcelasExpansion.vue` — exibição de parcelas, status pago/pendente

**Camada 3 — Testes de integração (fluxos completos):**
Testar fluxos end-to-end com store real (mock apenas a API).
- Fluxo transação: criar → verificar saldo conta → editar valor → verificar novo saldo → excluir → verificar reversão
- Fluxo transferência: criar → verificar débito origem + crédito destino → excluir → verificar reversão ambas
- Fluxo parcelas: criar parcelada 12x → verificar 12 transações + valores → excluir grupo → verificar reversão
- Fluxo investimento: comprar → verificar qty/avgCost → vender parcial → verificar recompute → excluir → verificar reversão conta
- Fluxo fatura: criar N compras crédito → pagar fatura → verificar todas paid + saldo conta

**Setup necessário:**
1. Instalar: `vitest`, `@vue/test-utils`, `@pinia/testing`, `happy-dom` (ou `jsdom`)
2. Criar `vitest.config.ts` com alias do Nuxt (`~`, `#imports`)
3. Criar helpers de mock para `apiGet`/`apiPost`/`apiPatch`/`apiDelete`
4. Script npm: `"test": "vitest"`, `"test:coverage": "vitest --coverage"`

### [ ] Notificações nativas do Electron
Integrar `useAlerts` com a Notification API do Electron.
- Tray icon com badge de pendentes.
- Notificação push quando uma conta vence hoje.
**Quando:** após Electron prod estar estável.

### [ ] Atalhos de teclado
- `Ctrl+N` → Nova movimentação
- `Ctrl+K` → Busca global
- `Ctrl+F` → Focar nos filtros
**Quando:** avaliar necessidade.

---

## CONCLUÍDOS

### [x] 33. PendentesList agrupa faturas pelo mês do VENCIMENTO, deveria agrupar pelo mês do CICLO/FECHAMENTO (BUG)
Criado helper `computeCreditInvoiceCycleMonth` em `invoice-cycle.ts`. Agrupamento em `creditInvoicesByAccount` trocado de `dueDate.slice(0,7)` para o mês do ciclo de fechamento.

### [x] 16. Alerta de recorrente — alertas só consideravam o mês atual
Criada função `dateForNextMonthlyOccurrence` em `useAlerts.ts` que gera a próxima ocorrência mensal (mês atual ou seguinte). Substituída `dateForDayInCurrentMonth` na geração de alertas de recorrentes.

### [x] 23. Remover persistência do mês na URL do Dashboard
Removida lógica de query param `?mes=` e `localStorage`. O mês sempre inicia como o mês atual.

### [x] 24. Datas ISO sem formatar na página Pagamentos (PendentesList)
Adicionada `formatDisplayDate` no `PendentesList.vue`. Datas exibidas em DD/MM/YYYY.

### [x] 25. Dashboard: gráficos incluem transferências nos cálculos
Adicionado `if (tx.type === 'transfer') continue` nos 3 computeds: `flowByWeek`, `expenseByMethod`, `expensePaymentStatus`.

### [x] 27. Modal de bloqueio com progresso ao pagar fatura inteira (PendentesList)
Modal fullscreen com Progress e bloqueio de UI ao pagar fatura.

### [x] 28. Modal de bloqueio com progresso ao excluir grupo de parcelas (deleteInstallmentGroup)
Callback `onProgress` no store + modal fullscreen no `MovimentacoesList.vue`.

### [x] 29. Paralelizar deletes em `deleteAccount` com progresso visual
Deletes paralelizados com `Promise.all` + callback `onProgress` + modal fullscreen no `contas.vue`.

### [x] 30. Editar eventos de investimento na tab Investimentos do MovimentacoesList
Botão "Editar" + dialog de edição replicado de `investimentos.vue` para `MovimentacoesList.vue`.

### [x] 31. Extrair `recomputeAllPositions` para o store e usar `Promise.all`
Função `recomputeAllPositions()` criada no store `useInvestmentEventsStore`. Loops sequenciais substituídos em `investimentos.vue` e `settings.vue`.

### [x] 1. Remover schema legado `investmentSchema` do zod-schemas.ts
Deletados `investmentSchema`, `investmentDetailsSchema` e `type Investment`.

### [x] 2. `deleteAccount` remove investment_positions e investment_events
Inclusão de remoção de posições e eventos de investimento ao excluir conta.

### [x] 3. `updateTransaction` trata transferência corretamente
Ajuste de saldo da conta destino ao editar transferências (via `collectAppliedAccountDeltas`).

### [x] 4. Validação de valor zero em transações e investimentos
`if (cents <= 0)` bloqueia criação de transações/eventos com valor R$ 0,00.

### [x] 5. Limite máximo de parcelas (72x)
Campo com `max="72"` e validação no submit.

### [x] 6. Arredondamento de parcelas — diferença de centavos
Última parcela absorve diferença de arredondamento via `roundingDiffCents`.

### [x] 7. Datas exibidas em formato DD/MM/YYYY nas listas
Função `formatDisplayDate` com `dayjs(date).format('DD/MM/YYYY')` no MovimentacoesList.

### [x] 8. Traduzir "Settings" para "Configurações"
Menu e título da página traduzidos.

### [x] 9. `isIncome` em alertas usa campo tipado `kind`
`AlertItem` tem campo `kind: 'income' | 'expense'` no `useAlerts.ts`.

### [x] 10. Filtro "Limpar filtros" volta ao mês atual
`txFilterMes` restaurado para mês atual ao limpar filtros.

### [x] 11. Dashboard — estado de primeiro uso (sem dados)
`showFirstUseEmptyState` com call-to-action quando não há contas/transações.

### [x] 12. `markUnpaid` com botão na interface para transações avulsas
Opção "Desfazer pagamento" no dropdown de transações avulsas pagas.

### [x] 13. `deleteTransaction` e `updateTransaction` revertem saldo
`collectAppliedAccountDeltas` calcula e reverte saldos ao excluir/editar transações pagas.

### [x] 14. Dashboard não conta transferências como receita/despesa
Filtro `type === 'transfer'` em `entriesForMonth` e `expensesForMonth`.

### [x] 15. Validação de venda de cotas acima do disponível
Verificação `qty > availableQty` com mensagem de erro e exibição de cotas disponíveis.

### [x] 17. Parcelas: campo aceita apenas inteiros
Campo com `step="1"` e validação `Number.isInteger(total)`.

### [x] 18. `day_of_month` e `due_day` validados entre 1 e 31
Função `parseOptionalRecurringDay` valida range no submit.

### [x] 20. Barra de progresso em operações longas (Import, Export, Limpar dados)
Modal fullscreen com Progress, etapas e bloqueio de UI em `settings.vue`.

### [x] Fix encoding no MovimentacoesList.vue (Dialog Recorrente)
O dialog de visualização de Recorrente tinha strings com encoding quebrado.

### [x] Remover completamente Tags e Categorias do projeto
Removidos arquivos, schemas, stores e collections de tags e categorias.

### [x] Remover store legado useInvestments.ts
Deletada store antiga e atualizado `settings.vue`. Limpa collection `investments` do `db.json`.

### [x] Transações pagas não podem ter valor editado
Campo valor bloqueado quando `paid=true`. Descrição continua editável.

### [x] Exclusão de transação de crédito não paga atualiza fatura
Fatura recalculada ao excluir transação de crédito não paga. Transações pagas bloqueadas para exclusão.

### [x] Loading e bloqueio de UI em ações de Editar, Excluir e Pagar
Spinner + bloqueio de interface durante processamento de ações.

### [x] Dashboard — Gráficos
Implementados gráficos nas tabs fluxo/tipo/status e investimentos.

### [x] Opção de excluir conta
Exclusão de conta com confirmação e remoção de transações/recorrentes/history vinculados.

### [x] Filtro de mês padrão na tab Transações (MovimentacoesList)
Filtro de mês inicia com o mês atual selecionado.

### [x] Paginação em Movimentações e Investimentos
Paginação com seletor de itens por página (10, 20, 40, 70, 100).

### [x] Sidebar colapsável (modo ícones)
Toggle de sidebar com estado salvo em localStorage.

### [x] Busca global
Campo de busca no header com `Ctrl+K` pesquisando em todas as collections.

### [x] Export e Import de dados
Export/Import de backup JSON completo em Configurações.

### [x] Confirmação visual ao pagar
Animação e toast ao marcar como pago.
