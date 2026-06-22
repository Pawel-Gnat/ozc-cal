import { expect, type APIRequestContext, type Page } from "@playwright/test";
import path from "node:path";

const floorPlanFixture = path.join(import.meta.dirname, "../fixtures/minimal-floor-plan.pdf");

export async function createProjectViaDashboard(page: Page, projectName: string): Promise<string> {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();

  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByRole("textbox", { name: "Project name" }).fill(projectName);
  await page.getByRole("button", { name: "Create project" }).click();

  await page.waitForURL(/\/projects\/[^/]+$/);
  await expect(page.getByRole("heading", { name: projectName, level: 1 })).toBeVisible();

  const match = /\/projects\/([^/]+)$/.exec(page.url());
  if (!match?.[1]) {
    throw new Error(`Could not parse project id from ${page.url()}`);
  }

  return match[1];
}

export async function saveDefaultClimate(page: Page) {
  await page.getByRole("button", { name: "Save climate settings" }).click();
  await expect(page.getByRole("status")).toContainText("Climate settings saved");
}

export async function createAssemblyViaApi(
  request: APIRequestContext,
  baseURL: string,
  projectId: string,
  assemblyName: string,
) {
  const response = await request.post(`${baseURL}/api/projects/${projectId}/assemblies`, {
    headers: { Origin: baseURL },
    form: {
      name: assemblyName,
      category: "external_wall",
      "layers[0][material_name]": "Test brick",
      "layers[0][lambda_w_mk]": "0.77",
      "layers[0][thickness_mm]": "240",
    },
  });
  expect(response.ok(), `assembly create failed: ${response.status()} ${await response.text()}`).toBeTruthy();
}

export async function uploadFloorPlan(page: Page) {
  await page.locator("#floor_plan_file").setInputFiles(floorPlanFixture);
  await page.getByRole("button", { name: "Upload floor plan" }).click();
  await expect(page.getByRole("link", { name: "Open floor plan editor" })).toBeVisible();
}

export async function putEditorScale(
  request: APIRequestContext,
  baseURL: string,
  projectId: string,
  knownLengthM: number,
) {
  const response = await request.put(`${baseURL}/api/projects/${projectId}/editor`, {
    headers: {
      "Content-Type": "application/json",
      Origin: baseURL,
    },
    data: {
      scale: {
        point_a_x: 100,
        point_a_y: 100,
        point_b_x: 200,
        point_b_y: 100,
        known_length_m: knownLengthM,
        meters_per_unit: 0.025,
      },
      nodes: [],
      segments: [],
      rooms: [],
    },
  });
  expect(response.ok()).toBeTruthy();
}

export interface EditorProjectContext {
  projectId: string;
  projectName: string;
  knownLengthM: number;
}

export async function prepareEditorProject(page: Page, baseURL: string, suffix: number): Promise<EditorProjectContext> {
  const projectName = `E2E Editor ${suffix}`;
  const knownLengthM = 4.25;

  const projectId = await createProjectViaDashboard(page, projectName);
  await saveDefaultClimate(page);
  await createAssemblyViaApi(page.request, baseURL, projectId, `Wall ${suffix}`);
  await uploadFloorPlan(page);
  await putEditorScale(page.request, baseURL, projectId, knownLengthM);

  return { projectId, projectName, knownLengthM };
}
