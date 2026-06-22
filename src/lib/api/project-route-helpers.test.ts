/**
 * Integration tests mock @/lib/supabase (avoids astro:env/server) and
 * @/lib/services/projects at the service boundary — see api-context fixtures.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({})),
}));

vi.mock("@/lib/services/projects", () => ({
  getProjectById: vi.fn(),
}));

import { getProjectById } from "@/lib/services/projects";

import {
  createApiContext,
  createProjectFor,
  NOT_FOUND_REDIRECT,
  userA,
  userB,
} from "@/lib/api/__fixtures__/api-context";
import {
  isProjectApiRouteOk,
  isProjectRouteOk,
  resolveProjectApiContext,
  resolveProjectRouteContext,
} from "@/lib/api/project-route-helpers";

const mockedGetProjectById = vi.mocked(getProjectById);

const foreignProjectId = "00000000-0000-4000-8000-000000000001";

describe("resolveProjectApiContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const context = createApiContext({ user: null, projectId: foreignProjectId });
    const result = await resolveProjectApiContext(context, foreignProjectId);

    expect(isProjectApiRouteOk(result)).toBe(false);
    if (!isProjectApiRouteOk(result)) {
      expect(result.status).toBe(401);
      expect(result.body.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("returns 404 when project id is not a valid UUID", async () => {
    const context = createApiContext({ user: userA, projectId: "not-a-uuid" });
    const result = await resolveProjectApiContext(context, "not-a-uuid");

    expect(isProjectApiRouteOk(result)).toBe(false);
    if (!isProjectApiRouteOk(result)) {
      expect(result.status).toBe(404);
      expect(result.body.error.code).toBe("NOT_FOUND");
    }
    expect(mockedGetProjectById).not.toHaveBeenCalled();
  });

  it("returns 404 when project is not visible to the user", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const context = createApiContext({ user: userA, projectId: foreignProjectId });
    const result = await resolveProjectApiContext(context, foreignProjectId);

    expect(isProjectApiRouteOk(result)).toBe(false);
    if (!isProjectApiRouteOk(result)) {
      expect(result.status).toBe(404);
      expect(result.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns owned project context for authenticated user", async () => {
    const project = createProjectFor(userA);
    mockedGetProjectById.mockResolvedValue(project);

    const context = createApiContext({ user: userA, projectId: project.id });
    const result = await resolveProjectApiContext(context, project.id);

    expect(isProjectApiRouteOk(result)).toBe(true);
    if (isProjectApiRouteOk(result)) {
      expect(result.projectId).toBe(project.id);
      expect(result.project.owner_id).toBe(userA.id);
    }
  });
});

describe("resolveProjectRouteContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to sign-in when user is not authenticated", async () => {
    const context = createApiContext({ user: null, projectId: foreignProjectId });
    const result = await resolveProjectRouteContext(context, foreignProjectId);

    expect(isProjectRouteOk(result)).toBe(false);
    if (!isProjectRouteOk(result)) {
      expect(result.redirect).toBe("/auth/signin");
    }
  });

  it("redirects to dashboard when project id is not a valid UUID", async () => {
    const context = createApiContext({ user: userA, projectId: "not-a-uuid" });
    const result = await resolveProjectRouteContext(context, "not-a-uuid");

    expect(isProjectRouteOk(result)).toBe(false);
    if (!isProjectRouteOk(result)) {
      expect(result.redirect).toBe(NOT_FOUND_REDIRECT);
    }
    expect(mockedGetProjectById).not.toHaveBeenCalled();
  });

  it("redirects to dashboard when project is not visible to the user", async () => {
    mockedGetProjectById.mockResolvedValue(null);

    const projectOwnedByB = createProjectFor(userB, { id: foreignProjectId });
    const context = createApiContext({ user: userA, projectId: projectOwnedByB.id });
    const result = await resolveProjectRouteContext(context, projectOwnedByB.id);

    expect(isProjectRouteOk(result)).toBe(false);
    if (!isProjectRouteOk(result)) {
      expect(result.redirect).toBe(NOT_FOUND_REDIRECT);
    }
  });

  it("returns owned project context for authenticated user", async () => {
    const project = createProjectFor(userA);
    mockedGetProjectById.mockResolvedValue(project);

    const context = createApiContext({ user: userA, projectId: project.id });
    const result = await resolveProjectRouteContext(context, project.id);

    expect(isProjectRouteOk(result)).toBe(true);
    if (isProjectRouteOk(result)) {
      expect(result.projectId).toBe(project.id);
      expect(result.project.owner_id).toBe(userA.id);
    }
  });
});
