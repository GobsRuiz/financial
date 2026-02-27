# Aprimoramentos e Resoluções

---

## CORREÇÕES / BUGS

### [x] 1. Fix encoding no MovimentacoesList.vue (Dialog Recorrente)
O dialog de visualização de Recorrente tem strings com encoding quebrado.
Exemplo: `VisualizaÃ§Ã£o` em vez de `Visualização`, `FrequÃªncia` em vez de `Frequência`.
**Arquivo:** `client/app/components/movimentacoes/MovimentacoesList.vue` (linhas ~663-713)
**Solução:** Reescrever as strings corrompidas com os caracteres corretos em UTF-8.

### [x] 2. Remover completamente Tags e Categorias do projeto
O projeto não utiliza categorias nem tags. Existem arquivos, schemas, stores e collections que precisam ser removidos.
**Arquivos a DELETAR:**
- `client/app/components/shared/CategorySelect.vue`
- `client/app/components/shared/TagSelect.vue`
- `client/app/stores/useTags.ts`

**Arquivos a EDITAR (remover referências):**
- `client/schemas/zod-schemas.ts` — remover `tagSchema` e `type Tag` (linhas ~149-155)
- `db.json` — remover collection `"tags": []`
- `electron/db-handler.js` — remover `tags: []` do objeto `emptyDB` (linha ~33)
- `client/app/pages/settings.vue` — remover referência a tags no reset de dados (se existir)
- Verificar qualquer import de `useTagsStore` ou `TagSelect` em outros componentes

### [x] 3. Remover store legado useInvestments.ts
O sistema de investimentos migrou para `useInvestmentPositions` + `useInvestmentEvents`.
A store antiga `useInvestments.ts` ainda existe e é referenciada apenas no `settings.vue`.
**Arquivo:** `client/app/stores/useInvestments.ts`
**Solução:** Deletar a store e atualizar `settings.vue` para não referenciá-la. Limpar a collection `investments` do `db.json` se não for mais usada.

### [x] 4. Transações pagas não podem ter valor editado
Quando uma transação está com `paid=true`:
- O campo **valor** deve ser bloqueado (readonly/disabled).
- A **descrição** pode ser editada normalmente.
- Isso evita inconsistência de saldo (o valor já impactou o saldo da conta).
**Arquivos:** `client/app/components/movimentacoes/MovimentacaoForm.vue`, lógica de edição em `movimentacoes.vue`

### [x] 5. Exclusão de transação de crédito não paga deve atualizar fatura
Ao excluir uma transação de crédito (`payment_method=credit`) que ainda **não foi paga**:
- O valor da fatura daquela conta/cartão deve ser recalculado (subtrair o valor da transação excluída).
- Transações **já pagas** não podem ser excluídas (bloquear botão de exclusão ou mostrar aviso).
**Arquivos:** `client/app/components/movimentacoes/MovimentacoesList.vue` (ação de excluir), `client/app/stores/useTransactions.ts`

### [ ] 6. Remover schema legado `investmentSchema` do zod-schemas.ts
O `investmentSchema` (com `asset_tag`, `applied_cents`, `current_cents`, `details`) é código morto. O sistema atual usa `investmentPositionSchema` + `investmentEventSchema`.
**Arquivo:** `client/schemas/zod-schemas.ts` (linhas ~91-147)
**Solução:** Deletar `investmentSchema`, `investmentDetailsSchema` e `type Investment`.

### [ ] 7. `deleteAccount` não remove investment_positions e investment_events
Ao excluir conta, posições e eventos de investimento vinculados à conta ficam órfãos no banco.
**Arquivo:** `client/app/stores/useAccounts.ts` (função `deleteAccount`)
**Solução:** Incluir remoção de `investment_positions` e `investment_events` com `accountId` da conta.

### [ ] 8. `updateTransaction` não trata transferência corretamente
Ao editar uma transferência, o sistema só ajusta o saldo da conta de **origem** (`accountId`). A conta de **destino** (`destinationAccountId`) é completamente ignorada.

**Exemplo do problema:**
1. Você cria uma transferência: Inter → Nubank, R$ 50,00.
   - Saldo Inter: -R$ 50 | Saldo Nubank: +R$ 50 ✅
2. Você edita essa transferência e muda o destino para Mercado Pago.
   - O sistema ajusta o Inter (ok), mas **não tira os R$ 50 do Nubank** e **não coloca no Mercado Pago**.
   - Resultado: Nubank ficou com R$ 50 a mais, Mercado Pago com R$ 50 a menos ❌

**Outro cenário:** Editar o valor de R$ 50 para R$ 80.
   - O sistema ajusta o Inter (de -50 para -80, ok), mas o Nubank continua com +R$ 50 em vez de +R$ 80 ❌

**Arquivo:** `client/app/stores/useTransactions.ts` (função `updateTransaction`)
**Solução:**
- Ao editar transferência, reverter o saldo da conta destino **antiga** (desfazer o +R$ 50 no Nubank).
- Aplicar o novo valor na conta destino **nova** (aplicar +R$ 80 no Mercado Pago).
- Tratar também mudança de valor mantendo a mesma conta destino.

### [ ] 9. Validação de valor zero em transações e investimentos
Atualmente é possível criar uma transação ou evento de investimento com valor R$ 0,00. Isso não faz sentido — uma transação de zero reais não representa nenhuma movimentação financeira real.

**Como reproduzir:**
1. Abrir o formulário de nova transação.
2. No campo valor, digitar `0` ou `0,00` ou deixar o campo sem alterar.
3. Preencher os demais campos e clicar em salvar.
4. O sistema aceita e cria a transação com `amount_cents = 0` ❌

**Por que acontece:** A função `parseBRLToCents('0,00')` retorna `0`, e a validação atual (`if (!txForm.amount)`) só verifica se a string é vazia, não se o valor convertido é zero.

**Arquivos:** `client/app/components/movimentacoes/MovimentacaoForm.vue` (funções `submitTransacao` e `submitInvestimento`)
**Solução:** Após converter o valor para centavos, validar: `if (!cents || cents <= 0)` → exibir mensagem "Valor deve ser maior que R$ 0,00".

### [ ] 10. Limite máximo de parcelas (72x)
O campo de parcelas aceita qualquer número (mínimo 2, sem máximo). Se o usuário digitar 999 parcelas, o sistema tenta criar 999 transações com 999 requests sequenciais, podendo travar o app.
**Arquivo:** `client/app/components/movimentacoes/MovimentacaoForm.vue`
**Solução:** Limitar a no máximo 72 parcelas. Adicionar `max="72"` no campo HTML e validar no submit: `if (total > 72)` → exibir erro.

### [ ] 11. Arredondamento de parcelas — diferença de centavos
Quando o valor total não divide exato pelo número de parcelas, sobra ou falta centavos.

**Exemplo do problema:**
- Compra: R$ 100,00 (10.000 centavos) em 3 parcelas.
- Valor por parcela: 10.000 ÷ 3 = 3.333,33... → arredondado para 3.333 centavos.
- Soma das 3 parcelas: 3.333 + 3.333 + 3.333 = 9.999 centavos = R$ 99,99.
- **Faltou R$ 0,01** em relação ao total original de R$ 100,00 ❌

**Arquivo:** `client/app/stores/useTransactions.ts` (função `generateInstallments`)
**Solução:** Calcular a diferença entre o total e a soma das parcelas arredondadas. Adicionar essa diferença na **última parcela**.
- Parcelas 1 e 2: R$ 33,33 (3.333 centavos cada)
- Parcela 3: R$ 33,34 (3.334 centavos) ← absorve o centavo restante
- Soma: 3.333 + 3.333 + 3.334 = 10.000 centavos = R$ 100,00 ✅

### [ ] 13. Datas exibidas em formato ISO (YYYY-MM-DD) nas listas
As datas de transações e eventos são mostradas como `2026-02-26` em vez do padrão brasileiro `26/02/2026`.
**Arquivos:** `client/app/components/movimentacoes/MovimentacoesList.vue` (linhas de data nas listas e modais)
**Solução:** Formatar com `dayjs(date).format('DD/MM/YYYY')` em todos os pontos de exibição.

### [ ] 14. Traduzir "Settings" para "Configurações"
O menu e o título da página usam "Settings" em inglês. Todo o resto está em português.
**Arquivos:** `client/app/components/layout/AppSidebar.vue`, `client/app/pages/settings.vue`

### [ ] 14. `isIncome` em alertas usa verificação frágil por string
Na tela de alertas, o sistema precisa saber se um alerta é de receita ou despesa para exibir o botão correto ("Receber" vs "Pagar"). Atualmente isso é feito verificando o **texto** do subtítulo.

**Como funciona hoje (frágil):**
```js
function isIncome(item) {
  return item.subtitle.toLowerCase().includes('receita')
}
```
Se o subtítulo contém a palavra "receita", é tratado como income. Se amanhã o texto for alterado de "Receita" para "Entrada" ou "Recebimento", a verificação **para de funcionar** e todos os alertas de receita serão tratados como despesa.

**Solução (robusta):**
Adicionar um campo tipado `kind: 'income' | 'expense'` diretamente no objeto `AlertItem` dentro do composable `useAlerts.ts`. Assim a verificação não depende de texto:
```js
function isIncome(item) {
  return item.kind === 'income'  // campo de dados, não texto visual
}
```
Mesmo que o texto exibido mude, a lógica continua funcionando porque verifica um campo de dados, não uma string visual.

**Arquivos:**
- `client/app/composables/useAlerts.ts` — adicionar `kind` ao tipo `AlertItem` e preencher ao criar cada alerta
- `client/app/pages/alertas.vue` — trocar `isIncome()` para usar `item.kind`
- `client/app/components/layout/AlertsBell.vue` — idem

### [ ] 15. Filtro "Limpar filtros" em Transações deveria voltar ao mês atual
Ao clicar "Limpar filtros", `txFilterMes` é setado para `''` (vazio), mostrando todas as transações de todos os meses. Deveria restaurar para o mês atual.
**Arquivo:** `client/app/components/movimentacoes/MovimentacoesList.vue`

### [ ] 18. Dashboard — estado de primeiro uso (sem dados)
Quando não há contas/transações cadastradas, o dashboard mostra tudo zerado sem orientação. Falta um estado "vazio" com call-to-action (ex: "Cadastre sua primeira conta").
**Arquivo:** `client/app/pages/index.vue`

### [ ] 19. `markUnpaid` sem botão na interface para transações avulsas
`markUnpaid` existe no store mas só é acessível em parcelas (ParcelasExpansion). Transações avulsas pagas não podem ser revertidas pela UI.
**Arquivo:** `client/app/components/movimentacoes/MovimentacoesList.vue`
**Solução:** Adicionar opção "Desfazer pagamento" no dropdown de transações avulsas com `paid=true`.

### [ ] 20. Importação de backup sem indicador de progresso
A importação pode demorar (centenas de delete + insert). O usuário vê apenas "Importando..." sem progresso. Se falhar no meio, o banco fica inconsistente.
**Arquivo:** `client/app/pages/settings.vue`
**Solução:** Barra de progresso ou indicador de etapas (ex: "Limpando dados... Importando contas... Importando transações...").

### [x] 21. Loading e bloqueio de UI em ações de Editar, Excluir e Pagar
Atualmente, ao clicar em Editar, Excluir ou Pagar, não há indicação de loading nem bloqueio da interface. O usuário pode clicar em outras ações enquanto uma está processando, causando possíveis inconsistências.

**Comportamento esperado:**
- Ao clicar em **Excluir**: botão mostra spinner, **toda a interface fica bloqueada** (overlay ou disable geral) até a operação concluir. Nenhum outro botão pode ser clicado.
- Ao clicar em **Editar**: ao abrir o dialog de edição, se está buscando dados, mostrar loading/spinner dentro do dialog. Enquanto carrega, campos desabilitados. Ao salvar, botão com spinner e interface bloqueada até concluir.
- Ao clicar em **Pagar**: botão com spinner, interface bloqueada até a operação de pagamento + ajuste de saldo + history completar.
- Ao clicar em visualizar
- Em **todos os casos**: durante o processamento, nenhum outro botão de ação (editar, excluir, pagar, criar) pode ser clicado.

**Locais que precisam dessa implementação:**
- `client/app/components/movimentacoes/MovimentacoesList.vue` — botões Editar/Excluir de transações, recorrentes e investimentos
- `client/app/components/movimentacoes/ParcelasExpansion.vue` — checkbox de pagar parcela
- `client/app/components/pendentes/PendentesList.vue` — botões Pagar fatura, Pagar transação, Pagar/Lançar recorrente
- `client/app/pages/contas.vue` — botões Editar/Excluir conta
- `client/app/pages/investimentos.vue` — botões Editar/Excluir posição e eventos
- `client/app/components/movimentacoes/MovimentacaoForm.vue` — botão Salvar (criar/editar)

**Implementação sugerida:**
- Criar um `ref<boolean>` global ou por componente (ex: `isProcessing`) que controla o estado de bloqueio.
- Quando `isProcessing=true`: overlay semi-transparente sobre a lista/página ou `pointer-events: none` + `opacity: 0.5` nos elementos interativos.
- Botão que disparou a ação mostra `Spinner` do shadcn no lugar do ícone/texto.
- Usar `try/finally` para garantir que `isProcessing` volta a `false` mesmo em caso de erro.

---

## APRIMORAMENTOS DE FUNCIONALIDADE

### [x] 22. Dashboard — Gráficos
As tabs de gráfico (fluxo/tipo/status) e período de investimentos existem na lógica mas **não renderizam gráficos**.
**O que implementar:**
- **Tab Fluxo:** Gráfico de barras — Entradas vs Saídas por mês (últimos 6 meses ou período selecionado).
- **Tab Tipo:** Gráfico de pizza/donut — Distribuição dos gastos por tipo (débito, crédito, transferência).
- **Tab Status:** Gráfico de barras empilhadas — Pago vs Pendente no mês.
- **Investimentos:** Gráfico de linha — Evolução do valor investido por período (mês/ano/tudo).
**Lib sugerida:** `vue-chartjs` (Chart.js) ou `@unovis/vue` — avaliar a mais simples e leve.
**Detalhes visuais:**
- Cores consistentes: verde para entradas/income, vermelho para saídas/expense.
- Tooltip ao passar o mouse mostrando valor formatado em BRL.
- Responsivo dentro do card.

### [x] 23. Opção de excluir conta
Atualmente só existe criar e editar conta. Falta a opção de excluir.
**Regras:**
- Se a conta tem transações vinculadas: exibir aviso "Esta conta possui X transações. Deseja excluir tudo?"
- Se a conta tem recorrentes vinculados: avisar também.
- Confirmação via `ConfirmDialog` (destructive).
- Ao confirmar: deletar conta + transações + recorrentes vinculados + history da conta.
**Arquivos:** `client/app/pages/contas.vue`, `client/app/stores/useAccounts.ts` (adicionar `deleteAccount`)

### [x] 24. Filtro de mês padrão na tab Transações (MovimentacoesList)
Na tab de Transações dentro de Movimentações, o filtro de mês deve **iniciar já com o mês atual selecionado**.
- O usuário pode limpar o filtro para ver todas as datas.
- Evita que a lista cresça infinitamente mostrando todos os meses.
**Arquivo:** `client/app/components/movimentacoes/MovimentacoesList.vue`

### [x] 25. Paginação em Movimentações e Investimentos
Não existe paginação. Listas grandes ficam pesadas e difíceis de navegar.
**Implementar:**
- Paginação na lista de Transações, Recorrentes e Investimentos em `MovimentacoesList.vue`.
- Paginação na página de Investimentos (`investimentos.vue`).
- **Padrão:** 40 itens por página.
- **Seletor de itens por página** nos filtros: 10, 20, 40, 70, 100.
- Navegação de página: Anterior / Próxima / Ir para página X.
- Exibir: "Mostrando X-Y de Z itens".
**Arquivos:** `client/app/components/movimentacoes/MovimentacoesList.vue`, `client/app/pages/investimentos.vue`

### [x] 26. Sidebar colapsável (modo ícones)
Em telas menores ou por preferência, a sidebar deve poder ser colapsada mostrando apenas ícones.
- Toggle via botão no topo da sidebar.
- Estado salvo em localStorage.
- Tooltip nos ícones quando colapsada.
**Arquivo:** `client/app/components/layout/AppSidebar.vue`

### [ ] 27. Resumo anual
Tela ou seção mostrando totais por mês do ano inteiro.
- Formato tabela/grid: linhas = meses, colunas = Entradas, Saídas, Líquido, Saldo.
- Permite ver sazonalidade e tendências ao longo do ano.
- Pode ser uma tab dentro do Dashboard ou página separada.
**Definir:** localização (dashboard tab ou página nova).

### [x] 28. Busca global
Campo de busca no header que pesquisa em todas as collections.
- Busca em: transações (descrição), recorrentes (nome), investimentos (asset_code).
- Resultados em dropdown com link direto para o item.
- Atalho: `Ctrl+K` para focar na busca.
**Arquivos:** `client/app/layouts/default.vue` ou `client/app/components/layout/`, criar composable `useGlobalSearch.ts`

### [x] 29. Export e Import de dados
**Export:**
- Botão em Settings para exportar todos os dados em JSON.
- Nome do arquivo: `financeiro-backup-YYYY-MM-DD.json`
- O backup JSON representa o banco completo do projeto (snapshot total).

**Import:**
- Botão em Settings para importar arquivo JSON.
- Validação do formato antes de importar.
- Confirmação: "Isso substituirá todos os dados atuais. Continuar?"
- Importa e recarrega todas as stores.
- A restauração substitui o banco completo do projeto (não é por conta).

**Arquivos:** `client/app/pages/settings.vue`, criar `client/app/utils/export-import.ts`

---

## MELHORIAS VISUAIS / UX

### [ ] 30. Consistência visual e identidade dos bancos
- Ícones/cores por banco nos cards de conta (ex: Nubank = roxo, Inter = laranja, Mercado Pago = azul claro).
- Cores consistentes em todas as telas:
  - Income/Entradas: **verde**
  - Expense/Saídas: **vermelho**
  - Transfer: **azul**
  - Pendente: **amarelo/amber**
  - Pago: **verde** (com check)
- Badge colorido por tipo de transação em listas.
**Arquivos:** componentes de cards em `contas.vue`, `PendentesList.vue`, `MovimentacoesList.vue`, `index.vue`

### [x] 31. Confirmação visual ao pagar
Animação/feedback sutil ao marcar como pago:
- Check verde com transição suave.
- Toast de confirmação.
- Item muda de estilo (opacity ou strike-through com transição).
**Arquivos:** `client/app/components/pendentes/PendentesList.vue`, `client/app/components/movimentacoes/ParcelasExpansion.vue`

---

## ANOTAÇÕES FUTURAS (avaliar depois)

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
