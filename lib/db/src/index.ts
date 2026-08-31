import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const databaseCa = process.env.DATABASE_CA_CERTIFICATE?.replace(/\\n/g, "\n");

function connectionStringForPool(value: string, ca: string | undefined) {
  if (!value || !ca) return value;

  try {
    const url = new URL(value);
    const sslmode = url.searchParams.get("sslmode")?.toLowerCase();
    if (sslmode && ["prefer", "require", "verify-ca"].includes(sslmode)) {
      // Keep the explicit CA/rejectUnauthorized configuration authoritative.
      // pg-connection-string replaces an explicit ssl object when sslmode is
      // present in the URL, and emits a legacy-mode warning for these values.
      url.searchParams.delete("sslmode");
      return url.toString();
    }
  } catch {
    // Let pg validate malformed connection strings when it creates a client.
  }

  return value;
}

const poolConnectionString = connectionStringForPool(databaseUrl, databaseCa);

export const databaseConfigured = Boolean(databaseUrl);
export const pool = new Pool({
  ...(poolConnectionString ? { connectionString: poolConnectionString } : {}),
  ...(databaseCa
    ? {
        ssl: {
          ca: databaseCa,
          rejectUnauthorized: true,
        },
      }
    : {}),
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 10_000,
  allowExitOnIdle: true,
  max: process.env.VERCEL ? 1 : 10,
});
pool.on("error", (error) => {
  process.emitWarning(`PostgreSQL idle connection error: ${error.message}`);
});
export const db = drizzle(pool, { schema });

export * from "./schema";
