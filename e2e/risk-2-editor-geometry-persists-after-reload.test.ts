import { test, expect } from "./fixtures";

test("editor scale persists after page reload", async ({ page, editorProject }) => {
  const { projectId, knownLengthM } = editorProject;

  const segmentTool = page.getByRole("button", { name: "Segment", exact: true });

  await page.goto(`/projects/${projectId}/editor`);
  await expect(segmentTool).toBeEnabled({ timeout: 30_000 });

  await page.reload();
  await expect(segmentTool).toBeEnabled({ timeout: 30_000 });

  const response = await page.request.get(`/api/projects/${projectId}/editor`);
  expect(response.ok()).toBeTruthy();

  const body = (await response.json()) as {
    data: { scale: { known_length_m: number } | null };
  };
  expect(body.data.scale?.known_length_m).toBe(knownLengthM);
});
