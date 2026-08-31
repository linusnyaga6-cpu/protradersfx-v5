ALTER TABLE "bot_runs"
  ADD COLUMN IF NOT EXISTS "account_id" text,
  ADD COLUMN IF NOT EXISTS "account_type" text,
  ADD COLUMN IF NOT EXISTS "stake" numeric(14, 2),
  ADD COLUMN IF NOT EXISTS "run_count" integer,
  ADD COLUMN IF NOT EXISTS "risk_cap" numeric(14, 2),
  ADD COLUMN IF NOT EXISTS "accepted_runs" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "settled_loss" numeric(14, 2) DEFAULT 0 NOT NULL;

UPDATE "bot_runs"
SET
  "accepted_runs" = COALESCE("accepted_runs", 0),
  "settled_loss" = COALESCE("settled_loss", 0)
WHERE "accepted_runs" IS NULL OR "settled_loss" IS NULL;

CREATE INDEX IF NOT EXISTS "bot_runs_execution_plan_idx"
  ON "bot_runs" ("owner_key", "bot_id", "account_id", "status")
  WHERE "mode" = 'execution_plan';