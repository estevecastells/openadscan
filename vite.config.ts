import build from "@hono/vite-build/cloudflare-workers";
import devServer from "@hono/vite-dev-server";
import adapter from "@hono/vite-dev-server/cloudflare";
import honox from "honox/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  if (mode === "client") {
    return {
      build: {
        rollupOptions: {
          input: ["./src/client.ts", "./src/styles/tailwind.css"],
          output: {
            dir: "./dist/static",
            entryFileNames: "client.js",
            chunkFileNames: "chunks/[name]-[hash].js",
            assetFileNames: "[name].[ext]",
          },
        },
        emptyOutDir: false,
        copyPublicDir: false,
        manifest: true,
      },
    };
  }

  return {
    plugins: [
      honox({ devServer: { adapter } }),
      build({ entry: "./src/server.ts", outputDir: "./dist" }),
    ],
    server: {
      port: 5173,
    },
  };
});
