import { createRoute } from "honox/factory";
import { buildAuthUrl, GOOGLE_ADS_SCOPES } from "@/connectors/google-ads/oauth";
import { randomId } from "@/lib/crypto";
import { kvPut } from "@/lib/kv";

export const GET = createRoute(async (c) => {
  const state = randomId(16);
  await kvPut(c.env, `oauth:state:${state}`, { type: "google_ads" }, { ttlSec: 600 });
  const url = buildAuthUrl({
    env: c.env,
    redirectUri: `${c.env.PUBLIC_BASE_URL}/api/connectors/google-ads/oauth-callback`,
    state,
    scopes: GOOGLE_ADS_SCOPES,
  });
  return c.redirect(url);
});
