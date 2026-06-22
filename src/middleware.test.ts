import type { AstroCookies } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

import { onRequest } from "@/middleware";

const stubCookies = {
  get: () => undefined,
  set: () => {
    /* AstroCookies stub */
  },
  delete: () => {
    /* AstroCookies stub */
  },
  has: () => false,
  headers: () => new Headers(),
} as AstroCookies;

const foreignProjectId = "00000000-0000-4000-8000-000000000001";

describe("middleware protected project API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  it("returns 401 JSON for unauthenticated nested project API path", async () => {
    const url = `http://localhost:4321/api/projects/${foreignProjectId}/editor`;
    const next = vi.fn();
    const redirect = vi.fn();

    const response = await onRequest(
      {
        url: new URL(url),
        request: new Request(url),
        cookies: stubCookies,
        locals: { user: null },
        redirect,
      } as Parameters<typeof onRequest>[0],
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(response).toBeInstanceOf(Response);

    const httpResponse = response as Response;
    expect(httpResponse.status).toBe(401);

    const body = (await httpResponse.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Unauthorized");
  });
});
