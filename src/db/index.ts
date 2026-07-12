import { createRequire } from "module";
import type { Pool } from "pg";

type Database = unknown;

const require = createRequire(import.meta.url);

let pool: Pool | null = null;
let database: Database | null = null;

const dbTarget = {};

export const db = new Proxy(dbTarget, {
  get(_target, property) {
    const currentDatabase = getDb();
    if (!currentDatabase) {
      throw new Error("DATABASE_URL is not configured");
    }

    const value = (currentDatabase as Record<PropertyKey, unknown>)[property];
    return typeof value === "function" ? value.bind(currentDatabase) : value;
  },
}) as Database;

export function getDb(): Database | null {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;

  if (!pool) {
    const { Pool } = require("pg") as typeof import("pg");
    pool = new Pool({ connectionString: databaseUrl });
  }

  if (!database) {
    const { drizzle } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
    database = drizzle(pool);
  }

  return database;
}
