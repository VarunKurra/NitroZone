import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    acceptDownloads: true,
    trace: "retain-on-failure",
    // full Chromium (not the headless shell) so MapLibre gets WebGL via SwiftShader
    channel: "chromium",
    launchOptions: { args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chromium", viewport: { width: 1440, height: 900 } }, grepInvert: /@ipad/ },
    { name: "ipad", use: { viewport: { width: 1024, height: 1366 }, hasTouch: true, channel: "chromium" }, grep: /@ipad/ },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
