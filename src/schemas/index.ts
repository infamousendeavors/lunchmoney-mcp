import { z } from "zod";

// Lunch Money calendar-date fields are always YYYY-MM-DD. Constrain them once
// and reuse, so malformed input fails fast here instead of as a confusing
// upstream API error. (balance_as_of is intentionally NOT this -- LM accepts a
// full ISO 8601 datetime there.)
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

// Transaction filter schema
export const transactionFilterSchema = z.object({
  start_date: dateString.optional(),
  end_date: dateString.optional(),
  category_id: z.number().optional(),
  tag_id: z.number().optional(),
  account_id: z.number().optional(),
  debit_as_negative: z.boolean().optional(),
  pending: z.boolean().optional(),
  status: z.enum(["cleared", "uncleared", "recurring", "recurring_suggested"]).optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
});

// Category schemas
export const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  is_income: z.boolean().optional(),
  exclude_budget: z.boolean().optional(),
  exclude_from_totals: z.boolean().optional(),
  category_group_id: z.number().optional(),
  parent_category_id: z.number().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  is_income: z.boolean().optional(),
  exclude_budget: z.boolean().optional(),
  exclude_from_totals: z.boolean().optional(),
  archived: z.boolean().optional(),
  category_group_id: z.number().optional(),
  parent_category_id: z.number().optional(),
});

// Tag schemas
export const createTagSchema = z.object({
  name: z.string().min(1),
});

export const updateTagSchema = z.object({
  name: z.string().min(1),
});

// Transaction schemas
export const createTransactionSchema = z.object({
  date: dateString,
  amount: z.string(),
  payee: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  category_id: z.number().optional(),
  account_id: z.number(),
  tags: z.array(z.number()).optional(),
  status: z.enum(["cleared", "uncleared"]).optional(),
  external_id: z.string().optional(),
  original_name: z.string().optional(),
  type: z.enum(["expense", "income", "transfer"]).optional(),
});

export const updateTransactionSchema = z.object({
  date: dateString.optional(),
  amount: z.string().optional(),
  payee: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  category_id: z.number().nullable().optional(),
  account_id: z.number().optional(),
  tags: z.array(z.number()).optional(),
  status: z.enum(["cleared", "uncleared"]).optional(),
  external_id: z.string().optional(),
  original_name: z.string().optional(),
  type: z.enum(["expense", "income", "transfer"]).optional(),
});

export const bulkUpdateTransactionsSchema = z.object({
  transaction_ids: z.array(z.number()).min(1),
  category_id: z.number().nullable().optional(),
  tags: z.array(z.number()).optional(),
  notes: z.string().optional(),
  status: z.enum(["cleared", "uncleared"]).optional(),
});

// Recurring item schemas
export const createRecurringItemSchema = z.object({
  payee: z.string().optional(),
  amount: z.string(),
  currency: z.string().optional(),
  category_id: z.number().optional(),
  notes: z.string().optional(),
  account_id: z.number().optional(),
  tag_id: z.number().optional(),
  frequency: z.string().optional(),
  flow: z.enum(["inflow", "outflow"]).optional(),
  start_date: dateString.optional(),
  end_date: dateString.optional(),
});

export const updateRecurringItemSchema = z.object({
  payee: z.string().optional(),
  amount: z.string().optional(),
  currency: z.string().optional(),
  category_id: z.number().nullable().optional(),
  notes: z.string().optional(),
  account_id: z.number().optional(),
  tag_id: z.number().nullable().optional(),
  frequency: z.string().optional(),
  flow: z.enum(["inflow", "outflow"]).optional(),
  start_date: dateString.optional(),
  end_date: dateString.optional(),
});

// Budget schemas
export const createBudgetSchema = z.object({
  category_id: z.number().optional(),
  amount: z.string(),
  currency: z.string().optional(),
  start_date: dateString,
  end_date: dateString,
});

export const updateBudgetSchema = z.object({
  category_id: z.number().nullable().optional(),
  amount: z.string().optional(),
  currency: z.string().optional(),
  start_date: dateString.optional(),
  end_date: dateString.optional(),
});

// Asset schemas
export const createAssetSchema = z.object({
  type_name: z.string().min(1),
  type_name_override: z.string().optional(),
  name: z.string().min(1),
  balance: z.string(),
  balance_as_of: z.string().optional(),
  currency: z.string().optional(),
  institution_name: z.string().optional(),
});

export const updateAssetSchema = z.object({
  type_name: z.string().optional(),
  type_name_override: z.string().optional(),
  name: z.string().optional(),
  balance: z.string().optional(),
  balance_as_of: z.string().optional(),
  currency: z.string().optional(),
  institution_name: z.string().optional(),
});

// Transaction group schemas
export const createTransactionGroupSchema = z.object({
  date: dateString,
  payee: z.string(),
  transactions: z.array(z.number()).min(2),
  category_id: z.number().optional(),
  notes: z.string().optional(),
  tags: z.array(z.number()).optional(),
});

export const unsplitTransactionsSchema = z.object({
  parent_ids: z.array(z.number()).min(1),
  remove_parents: z.boolean().optional(),
});

// Category group schemas
export const createCategoryGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  is_income: z.boolean().optional(),
  exclude_from_budget: z.boolean().optional(),
  exclude_from_totals: z.boolean().optional(),
  category_ids: z.array(z.number()).optional(),
  new_categories: z.array(z.string()).optional(),
});

export const addToGroupSchema = z.object({
  group_id: z.number().int().positive(),
  category_ids: z.array(z.number()).optional(),
  new_categories: z.array(z.string()).optional(),
});

// ID parameter schemas
export const idSchema = z.object({
  id: z.number().int().positive(),
});
