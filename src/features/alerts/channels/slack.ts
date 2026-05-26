import type { Bindings } from "@/env";
import { fetchWithRetry } from "@/lib/http";

export async function sendSlack(env: Bindings, target: string | undefined, text: string): Promise<void> {
  const url = target || env.SLACK_WEBHOOK_URL;
  if (!url) throw new Error("No Slack webhook URL configured");
  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Slack webhook -> ${res.status} ${await res.text()}`);
}
