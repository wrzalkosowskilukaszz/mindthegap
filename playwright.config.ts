/**
 * End-to-end smoke tests against a running app (local `pnpm start` or a deployment).
 *   E2E_BASE_URL=http://localhost:3000 E2E_PASSWORD=… pnpm e2e
 * They only read: no contact is changed and nothing is sent.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
});
