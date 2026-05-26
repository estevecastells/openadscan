import { createRoute } from "honox/factory";

export const GET = createRoute((c) => c.json({ ok: true, ts: Date.now() }));
