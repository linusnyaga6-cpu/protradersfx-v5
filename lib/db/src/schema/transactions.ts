import { createInsertSchema } from "drizzle-zod";
import { index, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerKey: text("owner_key").notNull(),
  source: text("source").notNull().default("manual"),
  accountType: text("account_type").notNull().default("demo"),
  loginid: text("loginid"),
  symbol: text("symbol").notNull(),
  contractType: text("contract_type").notNull(),
  stake: numeric("stake", { precision: 14, scale: 2 }).notNull(),
  payout: numeric("payout", { precision: 14, scale: 2 }),
  netProfit: numeric("net_profit", { precision: 14, scale: 2 }),
  currency: text("currency"),
  duration: numeric("duration", { precision: 10, scale: 0 }),
  contractId: text("contract_id"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("transactions_owner_created_idx").on(table.ownerKey, table.createdAt),
  index("transactions_owner_status_idx").on(table.ownerKey, table.status),
]);

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;