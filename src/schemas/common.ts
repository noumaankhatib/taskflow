import { z } from "zod";

export const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;
export const Currency = z.enum(CURRENCIES);
export type Currency = z.infer<typeof Currency>;

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const Priority = z.enum(PRIORITIES);
export type Priority = z.infer<typeof Priority>;

export const PAYMENT_METHODS = ["CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"] as const;
export const PaymentMethod = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

/** yyyy-mm-dd (optionally with time) that actually parses to a date. */
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, "Must be a valid date (YYYY-MM-DD)")
  .refine((s) => !Number.isNaN(Date.parse(s)), "Must be a valid date");

export const timestamp = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Must be a valid timestamp");

export const idOf = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}-\\d{3,}$`), `Must be a valid ${prefix} id`);

export const amount = z.number({ error: "Amount must be a number" }).finite().min(0, "Amount cannot be negative");
export const positiveAmount = z
  .number({ error: "Amount must be a number" })
  .finite()
  .gt(0, "Amount must be greater than zero");

export const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

/** Fields every persisted entity has. */
export const baseFields = {
  createdAt: timestamp,
  updatedAt: timestamp,
};

/** Soft-delete fields; defaults let old rows validate. */
export const softDeleteFields = {
  isDeleted: z.boolean().default(false),
  deletedAt: timestamp.nullable().default(null),
  deletedBy: z.string().nullable().default(null),
};

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}
export interface SoftDeletable {
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
}
