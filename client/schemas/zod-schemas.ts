import { z } from 'zod'

// ── Account ──
export const accountSchema = z.object({
  id: z.number().int().optional(),
  bank: z.string().min(1, 'Banco é obrigatório'),
  label: z.string().min(1, 'Nome é obrigatório'),
  type: z.literal('bank'),
  balance_cents: z.number().int(),
  card_closing_day: z.number().int().min(1).max(31).optional(),
  card_due_day: z.number().int().min(1).max(31).optional(),
})

export type Account = z.infer<typeof accountSchema> & { id: number }

// ── Installment (sub-objeto de Transaction) ──
export const installmentSchema = z.object({
  parentId: z.string().uuid(),
  total: z.number().int().min(2, 'Mínimo 2 parcelas'),
  index: z.number().int().min(1),
  product: z.string().min(1, 'Produto é obrigatório'),
})

// ── Transaction ──
export const transactionSchema = z.object({
  id: z.string().uuid().optional(),
  accountId: z.number().int({ message: 'Conta é obrigatória' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)'),
  type: z.enum(['expense', 'income', 'transfer'], { message: 'Tipo é obrigatório' }),
  category: z.string().min(1, 'Categoria é obrigatória'),
  amount_cents: z.number().int(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  paid: z.boolean().default(false),
  installment: installmentSchema.nullable().optional(),
  recurrentId: z.string().uuid().optional(),
})

export type Transaction = z.infer<typeof transactionSchema> & { id: string }

// ── Recurrent ──
export const recurrentSchema = z.object({
  id: z.string().uuid().optional(),
  accountId: z.number().int({ message: 'Conta é obrigatória' }),
  kind: z.enum(['income', 'expense', 'benefit'], { message: 'Tipo é obrigatório' }),
  name: z.string().min(1, 'Nome é obrigatório'),
  amount_cents: z.number().int(),
  frequency: z.literal('monthly'),
  day_of_month: z.number().int().min(1).max(31).optional(),
  due_day: z.number().int().min(1).max(31).optional(),
  description: z.string().optional(),
  active: z.boolean().default(true),
})

export type Recurrent = z.infer<typeof recurrentSchema> & { id: string }

// ── Investment ──
export const investmentTypeSchema = z.enum([
  'fii',
  'cripto',
  'caixinha',
  'cdb',
  'cdi',
  'tesouro',
  'lci',
  'lca',
  'outro',
])

export const investmentIndexerSchema = z.enum(['CDI', 'IPCA', 'PRE', 'SELIC', 'OUTRO'])
export const investmentLiquiditySchema = z.enum(['D0', 'D1', 'NO_VENCIMENTO', 'OUTRA'])

const investmentDetailsSchema = z.object({
  quantity: z.number().positive('Quantidade deve ser maior que zero').optional(),
  avg_unit_price_cents: z.number().int().nonnegative().optional(),
  current_unit_price_cents: z.number().int().nonnegative().optional(),
  issuer: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  indexer: investmentIndexerSchema.optional(),
  rate_percent: z.number().nonnegative().optional(),
  maturity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)').optional(),
  liquidity: investmentLiquiditySchema.optional(),
})

export const investmentSchema = z.object({
  id: z.string().uuid().optional(),
  accountId: z.number().int({ message: 'Conta é obrigatória' }),
  investment_type: investmentTypeSchema.default('outro'),
  asset_tag: z.string().min(1, 'Ativo é obrigatório'),
  applied_cents: z.number().int(),
  current_cents: z.number().int().optional(),
  description: z.string().optional(),
  details: investmentDetailsSchema.default({}),
}).superRefine((val, ctx) => {
  const quotaTypes = new Set(['fii', 'cripto'])
  const fixedIncomeTypes = new Set(['caixinha', 'cdb', 'cdi', 'lci', 'lca'])

  if (quotaTypes.has(val.investment_type) && !val.details.quantity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['details', 'quantity'],
      message: 'Quantidade é obrigatória para este tipo',
    })
  }

  if (fixedIncomeTypes.has(val.investment_type)) {
    if (!val.details.indexer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['details', 'indexer'],
        message: 'Indexador é obrigatório para este tipo',
      })
    }
    if (val.details.rate_percent == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['details', 'rate_percent'],
        message: 'Taxa é obrigatória para este tipo',
      })
    }
  }

  if (val.investment_type === 'tesouro') {
    if (!val.details.title?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['details', 'title'],
        message: 'Título é obrigatório para Tesouro',
      })
    }
    if (!val.details.maturity_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['details', 'maturity_date'],
        message: 'Vencimento é obrigatório para Tesouro',
      })
    }
  }
})

export type Investment = z.infer<typeof investmentSchema> & { id: string }

// ── Tag ──
export const tagSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nome é obrigatório'),
})

export type Tag = z.infer<typeof tagSchema> & { id: string }

// ── History ──
export const historySchema = z.object({
  id: z.string().uuid().optional(),
  accountId: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  balance_cents: z.number().int(),
  note: z.string().optional(),
})

export type HistoryItem = z.infer<typeof historySchema> & { id: string }
