# 10x Astro Starter

![](./public/template.png)

A modern, opinionated starter template for building fast, accessible web applications.

## Tech Stack

- [Astro](https://astro.build/) v6 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication, PostgreSQL, and Row Level Security
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier

### Astro 6 + Cloudflare dev (React islands)

`astro dev` runs SSR in Cloudflare `workerd`. If you see **Invalid hook call** / `useState` on first page load, clear stale Vite cache and restart:

```bash
rm -rf node_modules/.vite && npm run dev
```

The repo pre-bundles React for workerd via `vite/optimize-server-deps.mjs` and `resolve.dedupe` / `react-dom/server.edge` alias in `astro.config.mjs` (added during F-02 UI work).

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication and PostgreSQL project storage. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

Application schema lives in `supabase/migrations/`. The `projects` table (name, owner, climate fields, timestamps) is protected by Row Level Security — each authenticated user can only read and write their own rows. S-02 (`20260602120000_climate_and_assemblies.sql`) adds `assemblies` and `assembly_layers` for project-scoped building assemblies.

**Floor-plan PDF storage (F-02)** — migrations `20260603140000_floor_plan_storage.sql` (and any follow-up fixes) add:

- A private Storage bucket `floor-plans` (PDF only, **50 MiB** max per file)
- Nullable metadata on `projects`: `floor_plan_storage_path`, `floor_plan_filename`, `floor_plan_size_bytes`, `floor_plan_uploaded_at`
- RLS on `storage.objects` so only the project owner can read/write `{project_id}/floor-plan.pdf`

One PDF per project. Upload and delete go through the app API (cookie session + Storage RLS); read uses a short-lived signed URL (GET redirects to Supabase Storage). Apply locally with `npx supabase db reset --no-seed`. For cloud, run `npx supabase db push` and confirm the `floor-plans` bucket and policies exist in the dashboard (migrations do not always create buckets on hosted projects — verify after push).

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM. The repo already includes `supabase/config.toml` — do **not** run `supabase init`.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

3. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

4. Apply migrations to the local database:

```bash
npx supabase db reset --no-seed
```

Use `--no-seed` because `seed.sql` is not checked in yet. After pulling new migrations from git, run the same command to recreate the local schema.

5. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://127.0.0.1:54323`. Open **Table Editor → public** to inspect `projects`, `assemblies`, and `assembly_layers`. Use **Storage** to confirm the `floor-plans` bucket and uploaded objects.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

Apply migrations to the remote project with the Supabase CLI (`npx supabase link` then `npx supabase db push`) or by running the SQL from `supabase/migrations/` in the dashboard SQL editor. CI does not apply migrations automatically.

> **Follow-up after F-01:** When this change is archived, refresh stale baseline notes in `context/foundation/roadmap.md` and `context/deployment/deploy-plan.md` if they still describe an auth-only database.

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth and protected routes

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form (success redirects to `/dashboard`)         |
| `/auth/signup`        | Email/password sign-up form (success redirects to `/auth/confirm-email`) |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/dashboard`          | Project hub — list and create projects                                  |
| `/projects/[id]`      | Project detail — climate, assemblies, floor-plan PDF upload             |
| `/projects/[id]/editor` | PDF-backed floor plan editor (requires climate, assembly, PDF)        |
| `POST /api/projects`  | Create project by name (form POST from dashboard modal)                 |
| `POST /api/projects/[id]/climate` | Save climate zone and external design temperature          |
| `POST /api/projects/[id]/assemblies` | Create assembly with layers (requires saved climate)    |
| `POST /api/projects/[id]/assemblies/[assemblyId]` | Update or delete assembly (`_action=delete`) |
| `POST /api/projects/[id]/floor-plan` | Upload PDF (`floor_plan_file`) or delete (`_action=delete`) |
| `GET /api/projects/[id]/floor-plan` | Redirect to signed Storage URL (requires attached floor plan) |

### Floor plan editor (S-03)

Migration `20260608120000_floor_plan_editor.sql` adds geometry tables (`plan_nodes`, `plan_segments`, `plan_rooms`, `plan_room_segments`) and scale calibration columns on `projects`. The editor is a client-only React island at `/projects/[id]/editor`.

**Prerequisites:** saved climate, at least one assembly, and an uploaded floor-plan PDF. The project detail page shows an **Open floor plan editor** link when all three are met; otherwise a hint explains what is missing.

| Route / API | Description |
| ----------- | ----------- |
| `GET /api/projects/[id]/editor` | JSON read of full editor state (nodes, segments, rooms, scale) |
| `PUT /api/projects/[id]/editor` | Full document replace — auto-save sends complete `nodes`, `segments`, and `rooms` arrays |
| `GET /api/projects/[id]/floor-plan/data` | Same-origin PDF bytes for pdf.js (authenticated proxy; do not fetch Supabase signed URLs from the browser) |

Unauthenticated requests under `/api/projects/` return `401` JSON (not a redirect) so `fetch()` in the editor can detect session expiry. HTML routes still redirect to sign-in via middleware.

**Local dev:** pdf.js runs client-side only (`pdfjs-dist` + Vite worker). If the editor fails to load the PDF worker after dependency changes, run `npm run build` once to verify the worker asset bundles, or clear Vite cache (`rm -rf node_modules/.vite && npm run dev`).

Route protection is handled in `src/middleware.ts`. The `PROTECTED_ROUTES` array covers `/dashboard`, `/projects`, and `/api/projects` — unauthenticated requests to those paths redirect to `/auth/signin`. Add new protected paths there as needed.

### OZC calculation engine (F-03)

Pure TypeScript engine in `src/lib/thermal/` — WT 2021 transmission losses and simplified gravity ventilation. No calculation API or results UI in F-03; **S-04** will add the run button and on-screen results.

| Module | Role |
| --- | --- |
| `calculate-ozc.ts` | Pure entry point `calculateOzc(input)` |
| `calc-validate.ts` | Input validation → `OzcValidationError` |
| `wt2021-u.ts`, `wt2021-transmission.ts`, `wt2021-ventilation.ts` | Domain formulas |
| `src/lib/services/ozc-calculation.ts` | `loadOzcCalcInput` / `calculateProjectOzc` (Supabase loader) |

Manual engineering verification checklist: `context/changes/wt2021-calculation-core/manual-verification.md`.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/).

1. Build the project:

```bash
npm run build
```

2. Deploy with Wrangler:

```bash
npx wrangler deploy
```

Set `SUPABASE_URL` and `SUPABASE_KEY` as secrets in your Cloudflare dashboard or via `npx wrangler secret put`.

## CI

GitHub Actions runs lint + build on every push and PR to `master`. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets in GitHub for the build step.

## License

MIT
