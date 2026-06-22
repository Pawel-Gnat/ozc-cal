import { test as base, expect } from "@playwright/test";

import { createProjectViaDashboard, prepareEditorProject, type EditorProjectContext } from "./helpers/project-setup";

export const test = base.extend<{
  projectName: string;
  editorProject: EditorProjectContext;
}>({
  projectName: async ({ page }, use) => {
    const name = `E2E Seed ${Date.now()}`;

    await createProjectViaDashboard(page, name);
    await use(name);

    await page.getByRole("link", { name: /Back to projects/ }).click();
    await expect(page.getByRole("link", { name: name })).toBeVisible();
  },

  editorProject: async ({ page, baseURL }, use) => {
    if (!baseURL) {
      throw new Error("Playwright baseURL is required for editorProject fixture");
    }
    const context = await prepareEditorProject(page, baseURL, Date.now());
    await use(context);
  },
});

export { expect };
