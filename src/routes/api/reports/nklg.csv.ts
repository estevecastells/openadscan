import { createRoute } from "honox/factory";
import { db, schema } from "@/lib/db/client";
import { exportNegativeKeywordList } from "@/features/nklg/exporter";

export const GET = createRoute(async (c) => {
  const [brand] = await db(c.env).select().from(schema.brands).limit(1);
  if (!brand) return c.text("No brand configured", 400);
  const csv = await exportNegativeKeywordList(c.env, brand.id);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="openadscan-nklg-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
