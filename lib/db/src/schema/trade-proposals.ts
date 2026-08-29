import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const consumedTradeProposals = pgTable("consumed_trade_proposals", {
  nonce: text("nonce").primaryKey(),
  ownerKey: text("owner_key").notNull(),
  proposalId: text("proposal_id").notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }).defaultNow().notNull(),
});