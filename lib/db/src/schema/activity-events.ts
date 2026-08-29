import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const activityEvents = pgTable("activity_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventType: text("event_type").notNull(),
  visitorKeyHash: text("visitor_key_hash"),
  ownerKey: text("owner_key"),
  path: text("path"),
  metadata: jsonb("metadata").notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("activity_events_type_time_idx").on(table.eventType, table.occurredAt),
  index("activity_events_visitor_time_idx").on(table.visitorKeyHash, table.occurredAt),
  index("activity_events_owner_time_idx").on(table.ownerKey, table.occurredAt),
  index("activity_events_occurred_at_idx").on(table.occurredAt),
]);

export type ActivityEvent = typeof activityEvents.$inferSelect;
export type InsertActivityEvent = typeof activityEvents.$inferInsert;