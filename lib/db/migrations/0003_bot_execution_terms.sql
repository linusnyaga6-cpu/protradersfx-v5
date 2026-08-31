ALTER TABLE "bot_runs"
  ADD COLUMN IF NOT EXISTS "contract_type" text,
  ADD COLUMN IF NOT EXISTS "duration" integer,
  ADD COLUMN IF NOT EXISTS "barrier" text,
  ADD COLUMN IF NOT EXISTS "stop_loss" numeric(14, 2);