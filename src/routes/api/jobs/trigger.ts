import { createRoute } from "honox/factory";
import type { IngestMessage } from "@/env";
import { enqueue } from "@/lib/queue";

export const POST = createRoute(async (c) => {
  const form = await c.req.parseBody();
  const kind = String(form.kind ?? "");
  const brandId = String(form.brandId ?? "");
  let msg: IngestMessage | null = null;
  if (kind === "evaluate-nklg" && brandId) msg = { kind: "evaluate-nklg", brandId };
  else if (kind === "evaluate-cannibalization" && brandId) msg = { kind: "evaluate-cannibalization", brandId };
  else if (kind === "evaluate-incrementality" && brandId) msg = { kind: "evaluate-incrementality", brandId };
  else if (kind === "evaluate-alerts") msg = { kind: "evaluate-alerts" };
  if (!msg) return c.text("unknown job kind", 400);
  await enqueue(c.env, msg);
  const ref = c.req.header("referer") ?? "/";
  return c.redirect(ref);
});
