import { describe, expect, it } from "vitest";
import { enqueue, enqueueBatch } from "../../src/lib/queue";
import type { Bindings, IngestMessage } from "../../src/env";

function makeQueueEnv() {
  const sent: Array<{ body: IngestMessage; delaySeconds?: number }> = [];
  const env = {
    INGEST_QUEUE: {
      send: async (body: IngestMessage, opts?: { delaySeconds?: number }) => {
        sent.push({ body, delaySeconds: opts?.delaySeconds });
      },
      sendBatch: async (msgs: Array<{ body: IngestMessage }>) => {
        for (const m of msgs) sent.push({ body: m.body });
      },
    } as unknown as Queue<IngestMessage>,
  } as unknown as Bindings;
  return { env, sent };
}

describe("enqueue / enqueueBatch", () => {
  it("enqueue forwards the body and omits delay when zero", async () => {
    const { env, sent } = makeQueueEnv();
    await enqueue(env, { kind: "evaluate-alerts" });
    expect(sent).toEqual([{ body: { kind: "evaluate-alerts" }, delaySeconds: undefined }]);
  });

  it("enqueue passes delaySeconds when positive", async () => {
    const { env, sent } = makeQueueEnv();
    await enqueue(env, { kind: "evaluate-alerts" }, 10);
    expect(sent[0]!.delaySeconds).toBe(10);
  });

  it("enqueueBatch handles empty input as no-op", async () => {
    const { env, sent } = makeQueueEnv();
    await enqueueBatch(env, []);
    expect(sent).toEqual([]);
  });

  it("enqueueBatch chunks at 100 messages", async () => {
    const { env, sent } = makeQueueEnv();
    const msgs: IngestMessage[] = Array.from({ length: 250 }, () => ({ kind: "evaluate-alerts" }));
    await enqueueBatch(env, msgs);
    expect(sent.length).toBe(250);
  });
});
