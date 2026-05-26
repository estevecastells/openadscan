import { createRoute } from "honox/factory";
import { endSession } from "@/lib/auth";

export const POST = createRoute(async (c) => {
  await endSession(c);
  return c.redirect("/login");
});
