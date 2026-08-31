CREATE TABLE IF NOT EXISTS "consumed_trade_proposals" (
  "nonce" text PRIMARY KEY NOT NULL,
  "owner_key" text NOT NULL,
  "proposal_id" text NOT NULL,
  "consumed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "risk_acknowledgements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_key" text NOT NULL,
  "version" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "risk_acknowledgements_owner_version_idx"
  ON "risk_acknowledgements" ("owner_key", "version");