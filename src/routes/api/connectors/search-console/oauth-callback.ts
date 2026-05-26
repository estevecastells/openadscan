import { createRoute } from "honox/factory";
import { exchangeCode } from "@/connectors/search-console/oauth";
import { encryptString, randomId } from "@/lib/crypto";
import { db, schema } from "@/lib/db/client";
import { kvDelete, kvGet } from "@/lib/kv";

export const GET = createRoute(async (c) => {
  const url = new URL(c.req.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!(await kvGet<{ type: string }>(c.env, `oauth:state:${state}`))) return c.text("invalid oauth state", 400);
  await kvDelete(c.env, `oauth:state:${state}`);

  const redirectUri = `${c.env.PUBLIC_BASE_URL}/api/connectors/search-console/oauth-callback`;
  const tokens = await exchangeCode({ env: c.env, code, redirectUri });
  await db(c.env).insert(schema.connections).values({
    id: randomId(),
    type: "search_console",
    displayName: `Search Console (${new Date().toISOString().slice(0, 10)})`,
    configJson: JSON.stringify({}),
    oauthAccessTokenEnc: await encryptString(tokens.access_token, c.env.ENCRYPTION_KEY),
    oauthRefreshTokenEnc: await encryptString(tokens.refresh_token, c.env.ENCRYPTION_KEY),
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    status: "active",
  });
  return c.redirect("/settings/connections");
});
