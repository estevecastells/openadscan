import { createRoute } from "honox/factory";
import { eq } from "drizzle-orm";
import { exchangeCode } from "@/connectors/google-ads/oauth";
import { encryptString, randomId } from "@/lib/crypto";
import { db, schema } from "@/lib/db/client";
import { kvDelete, kvGet } from "@/lib/kv";

export const GET = createRoute(async (c) => {
  const url = new URL(c.req.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const stateRecord = await kvGet<{ type: string }>(c.env, `oauth:state:${state}`);
  if (!stateRecord) return c.text("invalid oauth state", 400);
  await kvDelete(c.env, `oauth:state:${state}`);

  const redirectUri = `${c.env.PUBLIC_BASE_URL}/api/connectors/google-ads/oauth-callback`;
  const tokens = await exchangeCode({ env: c.env, code, redirectUri });
  const id = randomId();
  await db(c.env).insert(schema.connections).values({
    id,
    type: "google_ads",
    displayName: `Google Ads (${new Date().toISOString().slice(0, 10)})`,
    configJson: JSON.stringify({ customerId: "" }),
    oauthAccessTokenEnc: await encryptString(tokens.access_token, c.env.ENCRYPTION_KEY),
    oauthRefreshTokenEnc: await encryptString(tokens.refresh_token, c.env.ENCRYPTION_KEY),
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    status: "active",
  });
  return c.redirect(`/settings/connections?welcome=0`);
});
