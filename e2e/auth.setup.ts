import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { test as setup, expect, type Locator } from "@playwright/test";
import { requireE2eCredentials } from "./env";

const authFile = "playwright/.auth/user.json";

async function fillControlledInput(locator: Locator, value: string) {
  await locator.waitFor({ state: "visible" });
  await locator.click();
  await locator.fill(value);
  await expect(locator).toHaveValue(value);
}

setup("authenticate", async ({ page }) => {
  const { email, password } = requireE2eCredentials();

  await page.goto("/auth/signin", { waitUntil: "networkidle" });

  const emailInput = page.getByLabel("Email", { exact: true });
  const passwordInput = page.getByLabel("Password", { exact: true });
  const signInButton = page.getByRole("button", { name: "Sign in" });

  await expect(signInButton).toBeVisible();
  await fillControlledInput(emailInput, email);
  await fillControlledInput(passwordInput, password);

  await Promise.all([page.waitForURL(/\/dashboard\/?$/), signInButton.click()]);

  if (page.url().includes("/auth/signin")) {
    const alert = page.getByRole("alert");
    const message = (await alert.textContent()) ?? "unknown sign-in error";
    throw new Error(`Sign-in failed: ${message.trim()}`);
  }

  await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();

  mkdirSync(dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
