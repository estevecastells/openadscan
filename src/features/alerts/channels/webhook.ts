import type { Bindings } from "@/env";
import { hmacSign } from "@/lib/crypto";
import { fetchWithRetry } from "@/lib/http";

export type WebhookPayload = {
  type: string;
  brandId: string;
  firedAt: string;
  data: unknown;
};

export async function sendWebhook(env: Bindings, target: string, payload: WebhookPayload): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = await hmacSign(body, env.SESSION_SECRET); // reuse session secret as webhook signing key
  const res = await fetchWithRetry(target, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-openadscan-signature": signature,
      "x-openadscan-event": payload.type,
    },
    body,
  });
  if (!res.ok) throw new Error(`webhook ${target} -> ${res.status} ${await res.text()}`);
}
