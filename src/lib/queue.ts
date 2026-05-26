import type { Bindings, IngestMessage } from "@/env";

export async function enqueue(env: Bindings, msg: IngestMessage, delaySeconds = 0): Promise<void> {
  await env.INGEST_QUEUE.send(msg, delaySeconds > 0 ? { delaySeconds } : undefined);
}

export async function enqueueBatch(env: Bindings, msgs: IngestMessage[]): Promise<void> {
  if (msgs.length === 0) return;
  // CF queues caps at 100 messages per sendBatch; chunk defensively.
  for (let i = 0; i < msgs.length; i += 100) {
    const chunk = msgs.slice(i, i + 100).map((body) => ({ body }));
    await env.INGEST_QUEUE.sendBatch(chunk);
  }
}
