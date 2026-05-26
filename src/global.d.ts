import "hono";
import type { Bindings, Variables } from "./env";

declare module "hono" {
  interface ContextVariableMap extends Variables {}
  interface Env {
    Bindings: Bindings;
    Variables: Variables;
  }
  interface ContextRenderer {
    (content: unknown, props?: { title?: string }): Response | Promise<Response>;
  }
}

declare module "honox/server" {
  interface Env {
    Bindings: Bindings;
    Variables: Variables;
  }
}
