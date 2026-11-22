import { defineConfig } from "@playwright/test";
import { config } from "dotenv";
config({ path: ".env.test.local" });
export default defineConfig({
  testDir: "./tests",
  timeout: 90000,
  expect:{timeout:10000},
  use: {
    baseURL: process.env.APP_URL || "http://localhost:3002",
    headless: true,
  },
  workers: 1,
  reporter: "list",
});
