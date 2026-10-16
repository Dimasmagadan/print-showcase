import { defineConfig } from "astro/config";

// GitHub Pages: SITE — https://<user>.github.io, BASE — "/<repo>" (пусто для <user>.github.io).
// Значения подставляет workflow деплоя; локально работают дефолты.
export default defineConfig({
  site: process.env.SITE ?? "https://dimasmagadan.github.io",
  base: process.env.BASE ?? "/",
  trailingSlash: "always",
});
