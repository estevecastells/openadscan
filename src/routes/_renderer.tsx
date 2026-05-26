import { jsxRenderer } from "hono/jsx-renderer";
import { Script, Link } from "honox/server";

export default jsxRenderer(({ children, title }: { children?: unknown; title?: string }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title ? `${title} · openadscan` : "openadscan"}</title>
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%234f46e5'/%3E%3Cpath d='M9 22 L23 10' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3Ccircle cx='11' cy='20' r='3' fill='white'/%3E%3Ccircle cx='21' cy='12' r='3' fill='white'/%3E%3C/svg%3E" />
        <Link href="/src/styles/tailwind.css" rel="stylesheet" />
        <Script src="/src/client.ts" async />
      </head>
      <body class="min-h-screen">{children}</body>
    </html>
  );
});
