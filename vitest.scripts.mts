// Runs asset generators that need the TypeScript analysis engine (npm run gen:hero).
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["scripts/**/*.gen.ts"], testTimeout: 600_000 },
});
