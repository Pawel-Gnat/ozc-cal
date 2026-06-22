import { test, expect } from "./fixtures";

test("created project persists after page reload", async ({ page, projectName }) => {
  await page.reload();
  await expect(page.getByRole("heading", { name: projectName, level: 1 })).toBeVisible();
});
