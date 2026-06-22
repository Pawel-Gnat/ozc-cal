import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Loads root `.env` into `process.env` (does not override existing vars). */
export function loadEnvFile(): void {
  const envPath = resolve(import.meta.dirname, "..", ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const raw = trimmed.slice(separator + 1).trim();
    const value = raw.replace(/^(['"])(.*)\1$/, "$2");

    process.env[key] ??= value;
  }
}

export function requireE2eCredentials(): { email: string; password: string } {
  loadEnvFile();

  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error("E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set in .env (see .env.example)");
  }

  return { email, password };
}
