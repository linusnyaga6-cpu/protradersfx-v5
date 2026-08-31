import { createInsertSchema } from "drizzle-zod";
import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

const owned = {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerKey: text("owner_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const botTemplates = pgTable("bot_templates", {
  ...owned,
  name: text("name").notNull(),
  description: text("description").notNull(),
  strategy: jsonb("strategy").notNull(),
  builtIn: boolean("built_in").default(false).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
}, (table) => [index("bot_templates_owner_idx").on(table.ownerKey)]);

export const bots = pgTable("bots", {
  ...owned,
  templateId: uuid("template_id").references(() => botTemplates.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  config: jsonb("config").notNull(),
  status: text("status").notNull().default("draft"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
}, (table) => [index("bots_owner_idx").on(table.ownerKey)]);

export const botRuns = pgTable("bot_runs", {
  ...owned,
  botId: uuid("bot_id").notNull().references(() => bots.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  contractType: text("contract_type"),
  duration: integer("duration"),
  barrier: text("barrier"),
  stopLoss: numeric("stop_loss", { precision: 14, scale: 2 }),
  accountId: text("account_id"),
  accountType: text("account_type"),
  stake: numeric("stake", { precision: 14, scale: 2 }),
  runCount: integer("run_count"),
  riskCap: numeric("risk_cap", { precision: 14, scale: 2 }),
  acceptedRuns: integer("accepted_runs").default(0).notNull(),
  settledLoss: numeric("settled_loss", { precision: 14, scale: 2 }).default("0").notNull(),
  result: jsonb("result"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [index("bot_runs_owner_bot_idx").on(table.ownerKey, table.botId)]);

export const botEvents = pgTable("bot_events", {
  ...owned,
  botId: uuid("bot_id").notNull().references(() => bots.id, { onDelete: "cascade" }),
  runId: uuid("run_id").references(() => botRuns.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
}, (table) => [index("bot_events_owner_bot_idx").on(table.ownerKey, table.botId)]);

export const snapshots = pgTable("snapshots", {
  ...owned,
  label: text("label").notNull(),
  data: jsonb("data").notNull(),
}, (table) => [index("snapshots_owner_idx").on(table.ownerKey)]);

export const analyses = pgTable("analyses", {
  ...owned,
  incidentId: uuid("incident_id"),
  kind: text("kind").notNull(),
  input: jsonb("input").notNull(),
  output: jsonb("output").notNull(),
}, (table) => [index("analyses_owner_idx").on(table.ownerKey)]);

export const riskAcknowledgements = pgTable("risk_acknowledgements", {
  ...owned,
  version: text("version").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("risk_acknowledgements_owner_version_idx").on(table.ownerKey, table.version)]);

export const recoveryIncidents = pgTable("recovery_incidents", {
  ...owned,
  botId: uuid("bot_id").references(() => bots.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("open"),
  facts: jsonb("facts").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("recovery_incidents_owner_idx").on(table.ownerKey)]);

export const insertBotTemplateSchema = createInsertSchema(botTemplates).omit({ id: true, ownerKey: true, createdAt: true, updatedAt: true });
export type BotTemplate = typeof botTemplates.$inferSelect;
export type Bot = typeof bots.$inferSelect;
export type Snapshot = typeof snapshots.$inferSelect;
export const botStatusSchema = z.enum(["draft", "observing", "paused", "stopped", "archived"]);