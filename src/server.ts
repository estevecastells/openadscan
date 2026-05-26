import { createApp } from "honox/server";
import { showRoutes } from "hono/dev";
import { requireAuth } from "@/lib/auth";
import { handleMessage } from "@/jobs/consumer";
import { runScheduled } from "@/jobs/scheduler";
import type { Bindings, IngestMessage } from "@/env";

const app = createApp({
  init: (a) => {
    a.use("*", requireAuth);
  },
});

if (import.meta.env?.DEV) showRoutes(app);

// HonoX exports the Hono app as default fetch handler. We layer cron + queue
// handlers on top so the Worker file is a single entry point.
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) {
    await runScheduled(env, event.cron);
  },
  async queue(batch: MessageBatch<IngestMessage>, env: Bindings, _ctx: ExecutionContext) {
    for (const msg of batch.messages) {
      const result = await handleMessage(env, msg.body);
      if (result.ok) msg.ack();
      else msg.retry();
    }
  },
};
