import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({})),
}));

vi.mock("@/lib/services/projects", () => ({
  getProjectById: vi.fn(),
}));

vi.mock("@/lib/services/project-editor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/project-editor")>();
  return {
    ...actual,
    countProjectAssemblies: vi.fn(),
    getEditorState: vi.fn(),
    replaceEditorState: vi.fn(),
  };
});

import { getProjectById } from "@/lib/services/projects";
import { countProjectAssemblies, replaceEditorState } from "@/lib/services/project-editor";

import { createApiContext, createProjectFor, userA } from "@/lib/api/__fixtures__/api-context";
import type { ApiErrorBody } from "@/lib/api/json-response";
import type { EditorStateInput } from "@/lib/validation/editor";
import { GET, PUT } from "./editor";

const mockedGetProjectById = vi.mocked(getProjectById);
const mockedCountProjectAssemblies = vi.mocked(countProjectAssemblies);
const mockedReplaceEditorState = vi.mocked(replaceEditorState);

const foreignProjectId = "00000000-0000-4000-8000-000000000001";
const baseOrigin = "http://localhost:4321";

const nodeA = "11111111-1111-4111-8111-111111111101";
const nodeB = "11111111-1111-4111-8111-111111111102";
const nodeC = "11111111-1111-4111-8111-111111111103";
const nodeD = "11111111-1111-4111-8111-111111111104";
const assemblyId = "33333333-3333-4333-8333-333333333301";
const seg1 = "22222222-2222-4222-8222-222222222201";
const seg2 = "22222222-2222-4222-8222-222222222202";
const seg3 = "22222222-2222-4222-8222-222222222203";
const seg4 = "22222222-2222-4222-8222-222222222204";

function validEditorState(): EditorStateInput {
  return {
    scale: null,
    nodes: [
      { id: nodeA, x: 0, y: 0 },
      { id: nodeB, x: 10, y: 0 },
      { id: nodeC, x: 10, y: 10 },
      { id: nodeD, x: 0, y: 10 },
    ],
    segments: [
      { id: seg1, start_node_id: nodeA, end_node_id: nodeB, assembly_id: assemblyId },
      { id: seg2, start_node_id: nodeB, end_node_id: nodeC, assembly_id: assemblyId },
      { id: seg3, start_node_id: nodeC, end_node_id: nodeD, assembly_id: assemblyId },
      { id: seg4, start_node_id: nodeD, end_node_id: nodeA, assembly_id: assemblyId },
    ],
    rooms: [],
  };
}

function setupOwnedProject() {
  const project = createProjectFor(userA);
  mockedGetProjectById.mockResolvedValue(project);
  mockedCountProjectAssemblies.mockResolvedValue(1);
  return project;
}

function createPutContext(
  projectId: string,
  options: { body?: unknown; rawBody?: string; origin?: string | null } = {},
): APIContext {
  const url = `${baseOrigin}/api/projects/${projectId}/editor`;
  const headers = new Headers({ "Content-Type": "application/json" });
  if (options.origin !== null) {
    headers.set("Origin", options.origin ?? baseOrigin);
  }

  const request = new Request(url, {
    method: "PUT",
    headers,
    body: options.rawBody ?? JSON.stringify(options.body ?? {}),
  });

  return {
    ...createApiContext({ user: userA, projectId, method: "PUT", url }),
    request,
  } as APIContext;
}

async function readError(response: Response): Promise<ApiErrorBody["error"]> {
  const body = (await response.json()) as ApiErrorBody;
  return body.error;
}

describe("GET /api/projects/[id]/editor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for a project not visible to the user", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const context = createApiContext({ user: userA, projectId: foreignProjectId });
    const response = await GET(context);

    expect(response.status).toBe(404);
    const error = await readError(response);
    expect(error.code).toBe("NOT_FOUND");
  });
});

describe("PUT /api/projects/[id]/editor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for a project not visible to the user", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const context = createPutContext(foreignProjectId, { body: validEditorState() });
    const response = await PUT(context);

    expect(response.status).toBe(404);
    const error = await readError(response);
    expect(error.code).toBe("NOT_FOUND");
  });

  it("returns 400 without issues when request body is not valid JSON", async () => {
    setupOwnedProject();

    const context = createPutContext(createProjectFor(userA).id, { rawBody: "{not-json" });
    const response = await PUT(context);

    expect(response.status).toBe(400);
    const error = await readError(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.issues).toBeUndefined();
  });

  it("returns 400 with Zod issues for invalid editor state", async () => {
    const project = setupOwnedProject();

    const context = createPutContext(project.id, {
      body: {
        scale: null,
        nodes: [{ id: "bad-id", x: 0, y: 0 }],
        segments: [],
        rooms: [],
      },
    });
    const response = await PUT(context);

    expect(response.status).toBe(400);
    const error = await readError(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.issues?.length).toBeGreaterThan(0);
  });

  it("returns 400 without issues when foreign assembly_id does not belong to project", async () => {
    const project = setupOwnedProject();
    mockedReplaceEditorState.mockRejectedValue(new Error("One or more assemblies do not belong to this project"));

    const context = createPutContext(project.id, { body: validEditorState() });
    const response = await PUT(context);

    expect(response.status).toBe(400);
    const error = await readError(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toContain("assemblies do not belong");
    expect(error.issues).toBeUndefined();
  });

  it("returns 403 for cross-origin PUT requests", async () => {
    const project = setupOwnedProject();

    const context = createPutContext(project.id, {
      body: validEditorState(),
      origin: "http://evil.example",
    });
    const response = await PUT(context);

    expect(response.status).toBe(403);
    const error = await readError(response);
    expect(error.code).toBe("FORBIDDEN");
  });

  it("returns 500 INTERNAL_ERROR when geometry-wipe guard fails (pins 500 until follow-up fix)", async () => {
    const project = setupOwnedProject();
    mockedReplaceEditorState.mockRejectedValue(new Error("Cannot replace editor state with empty geometry"));

    const context = createPutContext(project.id, { body: validEditorState() });
    const response = await PUT(context);

    expect(response.status).toBe(500);
    const error = await readError(response);
    expect(error.code).toBe("INTERNAL_ERROR");
  });
});
