CREATE TABLE IF NOT EXISTS "transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_key" text NOT NULL,
  "source" text DEFAULT 'manual' NOT NULL,
  "account_type" text DEFAULT 'demo' NOT NULL,
  "loginid" text,
  "symbol" text NOT NULL,
  "contract_type" text NOT NULL,
  "stake" numeric(14, 2) NOT NULL,
  "payout" numeric(14, 2),
  "net_profit" numeric(14, 2),
  "currency" text,
  "duration" numeric(10, 0),
  "contract_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "error_message" text,
  "metadata" jsonb,
  "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
  "settled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "transactions_owner_created_idx"
  ON "transactions" ("owner_key", "created_at");

CREATE INDEX IF NOT EXISTS "transactions_owner_status_idx"
  ON "transactions" ("owner_key", "status");
