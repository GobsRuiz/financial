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
export const investmentSchema = z.object({
  id: z.string().uuid().optional(),
  accountId: z.number().int({ message: 'Conta é obrigatória' }),
  asset_tag: z.string().min(1, 'Ativo é obrigatório'),
  applied_cents: z.number().int(),
  current_cents: z.number().int().optional(),
  description: z.string().optional(),
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
