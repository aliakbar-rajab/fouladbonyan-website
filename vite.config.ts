import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const allowViteDevelopmentStyles = (): Plugin => ({
  name: "allow-vite-development-styles",
  transformIndexHtml(html) {
    // Vite injects CSS through a <style> element in development. Keep the
    // production CSP intact, but omit the meta CSP only for the dev server.
    return html.replace(
      /\s*<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/,
      "",
    );
  },
});

export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === "serve" ? [allowViteDevelopmentStyles()] : [])],
  build: {
    // The prerender reads the manifest to preload each lazily loaded page's
    // chunk in that page's HTML, then deletes it (it is not for publishing).
    manifest: true,
  },
}));
