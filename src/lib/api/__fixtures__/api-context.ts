import type { APIContext } from "astro";
import type { AstroCookies } from "astro";
import type { User } from "@supabase/supabase-js";

import type { Project } from "@/types";

/** Matches private NOT_FOUND in project-route-helpers.ts */
export const NOT_FOUND_REDIRECT = "/dashboard?error=Project%20not%20found";

export const userA: User = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  aud: "authenticated",
  role: "authenticated",
  email: "user-a@e2e.test",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

export const userB: User = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  aud: "authenticated",
  role: "authenticated",
  email: "user-b@e2e.test",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

const defaultTimestamp = "2026-06-22T12:00:00.000Z";

export function createProjectFor(owner: User, overrides: Partial<Project> = {}): Project {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "Test project",
    owner_id: owner.id,
    climate_zone: "III",
    external_design_temp_c: -20,
    floor_plan_storage_path: "cccccccc-cccc-4ccc-8ccc-cccccccccccc/floor-plan.pdf",
    floor_plan_filename: "floor-plan.pdf",
    floor_plan_size_bytes: 1024,
    floor_plan_uploaded_at: defaultTimestamp,
    plan_scale_point_a_x: null,
    plan_scale_point_a_y: null,
    plan_scale_point_b_x: null,
    plan_scale_point_b_y: null,
    plan_scale_known_length_m: null,
    plan_scale_meters_per_unit: null,
    storey_height_m: 2.6,
    created_at: defaultTimestamp,
    updated_at: defaultTimestamp,
    ...overrides,
  };
}

const stubCookies = {
  get: () => undefined,
  set: () => {
    /* AstroCookies stub — not used in resolver tests */
  },
  delete: () => {
    /* AstroCookies stub — not used in resolver tests */
  },
  has: () => false,
  headers: () => new Headers(),
} as AstroCookies;

export interface CreateApiContextOptions {
  user: User | null;
  projectId?: string;
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export function createApiContext({
  user,
  projectId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  method = "GET",
  url = `http://localhost:4321/api/projects/${projectId}/editor`,
  body,
  headers = {},
}: CreateApiContextOptions): APIContext {
  const requestInit: RequestInit = {
    method,
    headers: new Headers(headers),
  };

  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
    const requestHeaders = new Headers(headers);
    requestHeaders.set("Content-Type", "application/json");
    requestInit.headers = requestHeaders;
  }

  return {
    locals: { user },
    params: { id: projectId },
    request: new Request(url, requestInit),
    cookies: stubCookies,
  } as APIContext;
}
