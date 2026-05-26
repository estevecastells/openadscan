import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import type { Bindings } from "@/env";
import * as schema from "./schema";

export type DB = DrizzleD1Database<typeof schema>;

export function db(env: Bindings): DB {
  return drizzle(env.DB, { schema });
}

export { schema };
