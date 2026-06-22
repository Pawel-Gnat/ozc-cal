import { test, expect } from "@playwright/test";

const foreignProjectId = "00000000-0000-4000-8000-000000000001";

test.describe("Risk #5 — unauthenticated user", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("cannot access dashboard without signing in", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/auth\/signin/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});

test.describe("Risk #5 — authenticated owner isolation", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("cannot open another users project by id", async ({ page }) => {
    await page.goto(`/projects/${foreignProjectId}`);
    await page.waitForURL(/\/dashboard\?error=Project%20not%20found/);
    await expect(page.getByRole("alert")).toContainText("Project not found");
  });

  test("editor API returns not found for foreign project id", async ({ page, baseURL }) => {
    const response = await page.request.get(`${baseURL}/api/projects/${foreignProjectId}/editor`);
    expect(response.status()).toBe(404);

    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
