import { createRoute } from "honox/factory";
import { buildAuthUrl, GSC_SCOPES } from "@/connectors/search-console/oauth";
import { randomId } from "@/lib/crypto";
import { kvPut } from "@/lib/kv";

export const GET = createRoute(async (c) => {
  const state = randomId(16);
  await kvPut(c.env, `oauth:state:${state}`, { type: "search_console" }, { ttlSec: 600 });
  const url = buildAuthUrl({
    env: c.env,
    redirectUri: `${c.env.PUBLIC_BASE_URL}/api/connectors/search-console/oauth-callback`,
    state,
    scopes: GSC_SCOPES,
  });
  return c.redirect(url);
});
