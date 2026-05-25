# Repository Guidelines

OZC-cal calculates building heat demand from floor-plan drawings. Tech stack: @README.md. Product scope: @context/foundation/prd.md.

## Agent-Specific Instructions

- Never commit secrets. Server-only vars are `SUPABASE_URL` and `SUPABASE_KEY` (see @.env.example); Cloudflare local dev uses `.dev.vars`.
- Copy @.env.example to `.env` for Node and `.dev.vars` for Wrangler local dev; full setup in @README.md. Deploy with `npx wrangler deploy`; set Cloudflare secrets via dashboard or `npx wrangler secret put`.
- SSR only: all pages and API routes must export `const prerender = false`; see @astro.config.mjs (`output: "server"`).
- Add protected paths to `PROTECTED_ROUTES` in @src/middleware.ts — do not bypass auth in page code.
- Supabase migrations: `supabase/migrations/YYYYMMDDHHmmss_short_description.sql`; enable RLS on every new table.
- Do not edit `context/` unless the user explicitly asks — planning and bootstrap artifacts live there.
- Merge Tailwind classes with `cn()` from `@/lib/utils`; do not concatenate class strings manually.

## Architecture & Layout

**Auth flow**

- @src/lib/supabase.ts — Supabase SSR client via `@supabase/ssr` with cookie-based sessions; secrets from `astro:env/server` (`SUPABASE_URL`, `SUPABASE_KEY` in @astro.config.mjs `env.schema`).
- @src/middleware.ts — resolves user on every request, attaches to `context.locals.user`; redirects unauthenticated users from `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: @src/pages/dashboard.astro

**Layout**

- Astro for static content/layout; React only when interactivity is needed.
- `src/pages/` — Astro routes; API handlers under `src/pages/api/`.
- `src/components/` — Astro layouts and React islands; shadcn/ui in `src/components/ui/`.
- `src/lib/` — Supabase client, helpers, services (`src/lib/services/` for extracted logic); shared types in `src/types.ts`.
- `supabase/` — local Supabase config and SQL migrations.
- Path alias `@/*` → `./src/*` per @tsconfig.json.

## Build, Test, and Development Commands

Use Node version from @.nvmrc (`nvm use`). Husky pre-commit runs lint-staged on staged files per @package.json.

- `npm run dev` — local dev server (Cloudflare workerd runtime)
- `npm run build` — production SSR build
- `npm run lint` — ESLint with type-checked rules; see @package.json for `lint:fix`, `format`, and other scripts

No test runner is configured; do not add a test stack unless the user requests it.

## Coding Style & Naming Conventions

Follow @.prettierrc.json and @eslint.config.js. React hooks in `src/components/hooks/`; no `"use client"`. API routes: uppercase `GET`/`POST`, Zod validation. shadcn: `npx shadcn@latest add <name>` (@components.json).

## Commit & Pull Request Guidelines

Recent commits use short type prefixes (`ai:`, `build:`, `chore:`). Keep messages imperative and one concern per commit. PRs target `master`; CI runs `npm run lint` and `npm run build` (@.github/workflows/ci.yml). Configure `SUPABASE_URL` and `SUPABASE_KEY` as GitHub repository secrets for CI.
