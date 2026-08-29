import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

export const databaseConfigured = Boolean(databaseUrl);
export const pool = new Pool({
  ...(databaseUrl ? { connectionString: databaseUrl } : {}),
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
