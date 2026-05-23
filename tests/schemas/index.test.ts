import { describe, it, expect } from "vitest";
import {
  transactionFilterSchema,
  createTransactionSchema,
  createBudgetSchema,
} from "../../src/schemas/index.js";

describe("date field validation", () => {
  describe("transactionFilterSchema", () => {
    it("accepts a well-formed YYYY-MM-DD start_date", () => {
      const result = transactionFilterSchema.safeParse({ start_date: "2026-01-31" });
      expect(result.success).toBe(true);
    });

    it("rejects a wrong-format start_date", () => {
      const result = transactionFilterSchema.safeParse({ start_date: "2026/01/31" });
      expect(result.success).toBe(false);
    });
  });

  describe("createTransactionSchema", () => {
    const base = { amount: "10.00", account_id: 1 };

    it("accepts a well-formed YYYY-MM-DD date", () => {
      const result = createTransactionSchema.safeParse({ ...base, date: "2026-01-31" });
      expect(result.success).toBe(true);
    });

    it("rejects a free-text date", () => {
      const result = createTransactionSchema.safeParse({ ...base, date: "Jan 1 2026" });
      expect(result.success).toBe(false);
    });
  });

  describe("createBudgetSchema", () => {
    const base = { amount: "100.00" };

    it("rejects a non-zero-padded start_date", () => {
      const result = createBudgetSchema.safeParse({
        ...base,
        start_date: "2026-1-1",
        end_date: "2026-01-31",
      });
      expect(result.success).toBe(false);
    });

    it("accepts zero-padded start_date and end_date", () => {
      const result = createBudgetSchema.safeParse({
        ...base,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      });
      expect(result.success).toBe(true);
    });
  });
});
