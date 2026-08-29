CREATE TABLE IF NOT EXISTS "activity_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_type" text NOT NULL,
  "visitor_key_hash" text,
  "owner_key" text,
  "path" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "activity_events_type_time_idx"
  ON "activity_events" ("event_type", "occurred_at");

CREATE INDEX IF NOT EXISTS "activity_events_visitor_time_idx"
  ON "activity_events" ("visitor_key_hash", "occurred_at");

CREATE INDEX IF NOT EXISTS "activity_events_owner_time_idx"
  ON "activity_events" ("owner_key", "occurred_at");

CREATE INDEX IF NOT EXISTS "activity_events_occurred_at_idx"
  ON "activity_events" ("occurred_at");