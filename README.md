# OZC-cal

Web app for calculating building heat demand (OZC) from a floor-plan PDF. A HVAC designer or energy auditor defines climate parameters, building assemblies, gravity ventilation, and room geometry on an imported PDF drawing — then runs WT 2021-based heat-loss and ventilation calculations and reads the result on screen.

**MVP scope:** single user per account, one storey per project, PDF floor plans only, gravity ventilation per room, on-screen results (no formal PDF report).

Product requirements and roadmap live in `context/foundation/` (`prd.md`, `roadmap.md`).

## What you can do

1. Sign up / sign in (email + password)
2. Create a project by name
3. Set climate zone, external design temperature, and storey height
4. Define building assemblies (layer stacks with materials)
5. Upload a floor-plan PDF
6. Draw orthogonal walls on the PDF, calibrate scale, create closed rooms with internal temperature and ventilation
7. Run OZC calculation and review heat losses and ventilation totals

## Tech stack

- [Astro](https://astro.build/) v6 — SSR on Cloudflare Workers
- [React](https://react.dev/) v19 — interactive islands (floor-plan editor, calculation panel)
- [TypeScript](https://www.typescriptlang.org/) v5
- [Tailwind CSS](https://tailwindcss.com/) v4 + [shadcn/ui](https://ui.shadcn.com/)
- [Supabase](https://supabase.com/) — auth, PostgreSQL, Storage, Row Level Security
- [Cloudflare Workers](https://workers.cloudflare.com/) — production runtime

## Prerequisites

- Node.js v22.14.0 (see `.nvmrc`)
- npm
- [Docker](https://www.docker.com/) (~7 GB RAM) for local Supabase

## Getting started

1. Clone and install:

```bash
git clone <repository-url>
cd ozc-cal
npm install
```

2. Copy environment files:

```bash
cp .env.example .env
cp .env.example .dev.vars
```

3. Start local Supabase and apply migrations — see [Supabase setup](#supabase-setup) below.

4. Run the dev server:

```bash
npm run dev
```

Open `http://localhost:4321`, sign up, and create a project from the dashboard.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server (Cloudflare `workerd` runtime) |
| `npm run build` | Production SSR build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint with type-checked rules |
| `npm run lint:fix` | Auto-fix ESLint issues |
| `npm run format` | Prettier |
| `npm test` | Vitest unit + integration tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright E2E tests (requires running app + seeded data) |

### Astro 6 + Cloudflare dev (React islands)

`astro dev` runs SSR in Cloudflare `workerd`. If you see **Invalid hook call** / `useState` on first page load, clear stale Vite cache and restart:

```bash
rm -rf node_modules/.vite && npm run dev
```

## Project structure

```
.
├── src/
│   ├── pages/              # Astro routes + API handlers (src/pages/api/)
│   ├── components/         # Astro layouts, React islands, shadcn/ui
│   ├── lib/
│   │   ├── thermal/        # WT 2021 calculation engine
│   │   ├── services/       # Supabase data access
│   │   ├── editor/         # Room detection, geometry helpers
│   │   └── validation/     # Zod schemas
│   └── middleware.ts       # Auth + protected routes
├── supabase/migrations/    # PostgreSQL schema + RLS
├── e2e/                      # Playwright tests
├── context/foundation/       # PRD, roadmap, test plan
└── wrangler.jsonc            # Cloudflare Workers config
```

## Supabase setup

Server-only secrets: `SUPABASE_URL` and `SUPABASE_KEY` (declared in `astro.config.mjs`, loaded from `.env` / `.dev.vars`). They are never exposed to the client.

Schema is versioned in `supabase/migrations/`. Each authenticated user owns their projects; RLS enforces `owner_id = auth.uid()` on `projects` and related tables.

### Local stack

The repo already includes `supabase/config.toml` — do **not** run `supabase init`.

```bash
npx supabase start
```

Copy the URL and anon key from the CLI output into `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

Apply migrations:

```bash
npx supabase db reset --no-seed
```

Use `--no-seed` because `seed.sql` is not checked in. After pulling new migrations, run the same command to recreate the local schema.

Local Studio: `http://127.0.0.1:54323`.

Stop the stack:

```bash
npx supabase stop
```

### Cloud Supabase project

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | Project URL (Settings → API) |
| `SUPABASE_KEY` | `anon` public key (Settings → API) |

Apply migrations with `npx supabase link` + `npx supabase db push`, or run SQL from `supabase/migrations/` in the dashboard. CI does not apply migrations automatically.

After `db push`, confirm the private `floor-plans` Storage bucket exists in the dashboard (migrations may not create buckets on hosted projects).

### Email confirmation (local dev)

To sign in immediately after sign-up, disable **Authentication → Email → Confirm email** in the Supabase dashboard (MVP assumes no email verification).

## Routes

| Route | Description |
| --- | --- |
| `/auth/signin`, `/auth/signup` | Email/password auth |
| `/dashboard` | List and create projects |
| `/projects/[id]` | Climate, assemblies, PDF upload, calculation panel |
| `/projects/[id]/editor` | PDF floor-plan editor |

Protected paths are listed in `PROTECTED_ROUTES` in `src/middleware.ts` (`/dashboard`, `/projects`, `/api/projects`). Unauthenticated API calls under `/api/projects/` return `401` JSON; HTML routes redirect to sign-in.

### Main API endpoints

| Method / path | Description |
| --- | --- |
| `POST /api/projects` | Create project by name |
| `POST /api/projects/[id]/climate` | Save climate zone, external temp, storey height |
| `POST /api/projects/[id]/assemblies` | Create assembly with layers |
| `POST /api/projects/[id]/assemblies/[assemblyId]` | Update assembly, or delete with `_action=delete` |
| `POST /api/projects/[id]/floor-plan` | Upload PDF or delete with `_action=delete` |
| `GET /api/projects/[id]/floor-plan` | Redirect to signed Storage URL |
| `GET /api/projects/[id]/floor-plan/data` | Same-origin PDF bytes for pdf.js |
| `GET /api/projects/[id]/editor` | Read editor state (JSON) |
| `PUT /api/projects/[id]/editor` | Replace editor state (auto-save) |
| `POST /api/projects/[id]/calc` | Run OZC calculation |

## Floor-plan editor

React island at `/projects/[id]/editor`. Requires saved climate, at least one assembly, and an uploaded PDF.

- Orthogonal segment drawing on the PDF overlay
- Scale calibration from two known points
- Closed room zones with internal temperature and gravity ventilation
- Debounced auto-save via `PUT /api/projects/[id]/editor`

Geometry is stored in `plan_nodes`, `plan_segments`, `plan_rooms`, and `plan_room_segments` (migration `20260608120000_floor_plan_editor.sql`).

**PDF storage:** private bucket `floor-plans`, one PDF per project (`{project_id}/floor-plan.pdf`, max 50 MiB). Upload/delete via app API; read via signed URL or authenticated proxy for the editor.

## OZC calculation engine

Pure TypeScript in `src/lib/thermal/` — WT 2021 transmission losses and simplified per-room gravity ventilation.

| Module | Role |
| --- | --- |
| `calculate-ozc.ts` | Entry point `calculateOzc(input)` |
| `calc-validate.ts` | Input validation |
| `wt2021-u.ts`, `wt2021-transmission.ts`, `wt2021-ventilation.ts` | Domain formulas |
| `src/lib/services/ozc-calculation.ts` | Load project data from Supabase, run calc, format for UI |

Engineering reference cases: `context/archive/2026-06-09-wt2021-calculation-core/manual-verification.md`.

Manual regression check:

```bash
npx tsx scripts/ozc-manual-check.mts
```

## Testing

Test strategy: `context/foundation/test-plan.md`.

- **Unit / integration:** Vitest (`npm test`) — calculation engine, API ownership, editor validation
- **E2E:** Playwright (`npm run test:e2e`) — protected routes, editor persistence

## Deployment

Build and deploy to Cloudflare Workers:

```bash
npm run build
npx wrangler deploy
```

Set `SUPABASE_URL` and `SUPABASE_KEY` as Wrangler secrets (`npx wrangler secret put` or Cloudflare dashboard). See `context/deployment/deploy-plan.md` for a full checklist.

## CI

GitHub Actions runs `npm run lint` and `npm run build` on push/PR to `master`. Repository secrets `SUPABASE_URL` and `SUPABASE_KEY` are required for the build step.

## License

MIT
