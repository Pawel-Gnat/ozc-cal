---
project: ozc-cal
researched_at: 2026-05-26
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 + React 19 islands
  runtime: Cloudflare Workers (workerd via @astrojs/cloudflare ^13.5, wrangler ^4.90)
---

## Recommendation

**Deploy on Cloudflare Workers.**

OZC-cal is already scaffolded for this stack: `output: "server"`, `@astrojs/cloudflare` v13, `wrangler.jsonc` with the Astro 6 unified entrypoint, and Supabase as an external database. At MVP scale (10k–100k requests/month, single region, no WebSockets or background workers), usage stays within the Workers **free** tier (100,000 function requests per day; static assets do not count). That matches your **minimize cost** priority better than Railway ($5/month minimum), Netlify’s 300-credit/month cliff, or migrating to another adapter. You have Vercel/Netlify experience, but switching would add adapter and CI work without improving cost. Cloudflare also scores highest on agent-friendly criteria (CLI-first `wrangler`, `llms.txt` docs, stable deploy API, official MCP servers).

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
| --- | --- | --- | --- | --- | --- | --- |
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | 5 Pass |
| **Vercel** | Pass | Pass | Pass | Pass | Partial (public beta) | 4 Pass, 1 Partial |
| **Netlify** | Pass | Pass | Partial | Pass | Pass | 4 Pass, 1 Partial |
| **Fly.io** | Pass | Pass | Pass | Pass | Partial | 4 Pass, 1 Partial |
| **Railway** | Pass | Pass | Partial | Pass | Partial | 3 Pass, 2 Partial |
| **Render** | Partial | Pass | Partial | Partial | Fail | 2 Pass, 2 Partial, 1 Fail |

**Hard filters applied:** No persistent connections required (Q1 = No) — no platform dropped. Astro 6 SSR on Workers is a **native** path for Cloudflare; Vercel/Netlify/Fly/Railway/Render would require `@astrojs/vercel`, `@astrojs/netlify`, Node adapter, or container packaging — compatible but not zero-migration.

**Interview weights:** Cost-first favors Cloudflare and Vercel Hobby (~$0 at low traffic); penalizes Railway and Netlify credit pauses. Single region (Q4) reduces edge/CDN as a tie-breaker. External Supabase (Q5) fits all shortlist options. Vercel/Netlify familiarity (Q3) noted; Cloudflare wins on stack alignment and cost.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Best fit because the repo already targets Workers, Astro 6 `astro dev` runs on **workerd** (production parity), and MVP traffic fits the free tier with predictable $5/month paid cliff if needed. Wrangler ^4.90 supports deploy, rollback, secrets, and tail logs; official MCP at `https://mcp.cloudflare.com/mcp` plus observability/bindings servers. Unlimited bandwidth for static assets on all tiers.

#### 2. Vercel

Strong Hobby free tier (~1M function invocations/month) and familiar DX. Would require swapping `@astrojs/cloudflare` for `@astrojs/vercel` and re-validating Supabase cookie SSR. Vercel MCP is useful but **public beta** (OAuth, client allowlist). Second choice when team policy blocks Cloudflare or Workers runtime limits bite.

#### 3. Netlify

Familiar JAMstack workflow and official Netlify MCP Server. Credit-based free plan (300 credits/month) makes SSR + frequent production deploys (15 credits each) risky — sites can **pause** when credits exhaust. Would need `@astrojs/netlify` and careful credit budgeting. Third despite familiarity because cost predictability is worse than Cloudflare/Vercel at this scale.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **CPU time limits** — Free tier allows 10 ms CPU per invocation; SSR auth routes plus a canvas-heavy editor can fail before request quotas do.
2. **Per-environment builds (Astro 6)** — `wrangler deploy --env` does not substitute for `CLOUDFLARE_ENV=<env> npm run build`; wrong env bindings can ship to staging or production.
3. **Workers ≠ Node** — `nodejs_compat` helps but some npm packages fail only in production Workers.
4. **Manual production path today** — CI runs lint/build only; deploy discipline depends on humans or a workflow not yet in repo.
5. **Config drift** — `wrangler.jsonc` `name` still reflects starter template (`10x-astro-starter`) until renamed for ozc-cal.

### Pre-Mortem — How This Could Fail

The team shipped on Cloudflare because the starter defaulted there and the free tier looked unbeatable. For three weeks it worked. Then the floor-plan editor grew: Konva/canvas work in React islands pushed SSR routes over **10 ms CPU** on cold paths. Errors were opaque (`Script exceeded CPU time`). They assumed `astro dev` matched prod, but a dependency used Node APIs that worked in dev and failed only on Workers. Staging broke for a week because someone ran `wrangler deploy --env staging` without `CLOUDFLARE_ENV=staging npm run build`, leaking production bindings. Supabase session cookies misbehaved until `Secure`/`SameSite` settings were fixed — time lost that Vercel would have masked with Node SSR. With no deploy job in CI, releases became “whoever remembered `wrangler deploy`,” and a bad deploy wasn’t reverted for hours. Six months in, the host was still cheap, but the solo dev spent more time on platform edge cases than on OZC calculations.

### Unknown Unknowns

- **Free tier is per day** — 100,000 Worker/Pages Function requests per day (shared), not per month; static asset requests are free ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)).
- **No separate `wrangler dev` for daily work** — Astro 6 + `@astrojs/cloudflare` v13 uses the Cloudflare Vite plugin; use `npm run dev` (workerd), not a legacy Pages-only flow ([Astro Cloudflare guide](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)).
- **Deploy command** — `npm run build` then `npx wrangler deploy` (Wrangler is a project devDependency ^4.90).
- **PR previews** — Git-connected Workers get branch preview URLs on PRs (GA, July 2025 changelog); `wrangler preview` CLI family is **private beta** as of April 2026 — do not depend on it without beta access.
- **Paid cliff** — Exceeding free limits moves you to Workers Paid **$5/month** with 10M requests included — predictable, not unbounded surprise billing.

## Operational Story

- **Preview deploys**: Connect the GitHub repo in the Cloudflare dashboard (Workers → Settings → Builds) so each PR gets branch and commit preview URLs on `*.workers.dev` ([changelog](https://developers.cloudflare.com/changelog/post/2025-07-23-workers-preview-urls/)). Fork PR previews follow Cloudflare/GitHub permissions. Protect previews with [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/) if auth routes must not be public. Optional: `wrangler versions upload` with `--preview-alias` (Wrangler 4.21+). Do not rely on `wrangler preview` (private beta) without enrollment.
- **Secrets**: Store `SUPABASE_URL` and `SUPABASE_KEY` as Worker secrets: `npx wrangler secret put SUPABASE_URL` / `SUPABASE_KEY` (production). Local dev uses `.dev.vars` (from `.env.example`). Dashboard: Workers → Settings → Variables. Rotation: put new secret, redeploy; revoke old Supabase keys in Supabase dashboard. GitHub Actions CI uses repository secrets for **build-time** `astro:env` validation only — not a substitute for Worker runtime secrets.
- **Rollback**: `npx wrangler deployments list` → `npx wrangler rollback` (previous stable) or `npx wrangler rollback <version-id>`. Rollback swaps Worker code immediately; **Supabase migrations do not roll back** with the Worker — plan DB changes separately.
- **Approval**: Human should approve production `wrangler deploy`, primary secret rotation, and Supabase service-role changes. Agents may run `npm run build`, `wrangler deployments list`, `wrangler tail` (read-only logs), and draft CI YAML — not rotate production secrets or drop databases unattended.
- **Logs**: Runtime: `npx wrangler tail` (live); dashboard Observability (enabled in `wrangler.jsonc`). MCP: `https://observability.mcp.cloudflare.com/mcp` (requires API token). CI: GitHub Actions logs on `master` PR/push ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)).

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| SSR/editor routes exceed 10 ms CPU on free tier | Devil's advocate | M | H | Profile hot routes; move heavy canvas work client-side; upgrade to Workers Paid ($5) if needed; watch CPU metrics in Observability |
| Wrong env deployed (`--env` without `CLOUDFLARE_ENV` build) | Unknown unknowns / Pre-mortem | M | H | Document staging flow: `CLOUDFLARE_ENV=staging npm run build && npx wrangler deploy`; never rely on deploy-time env alone |
| npm package incompatible with Workers runtime | Devil's advocate | M | M | Test with `npm run build` + preview/deploy early; keep `nodejs_compat`; check package against Workers docs before adding deps |
| No automated deploy → human error / slow rollback | Devil's advocate | M | M | Add GitHub Actions deploy job or Cloudflare Builds on merge; keep `wrangler rollback` runbook in README |
| Supabase auth cookies break behind Workers | Pre-mortem | L | M | Verify cookie options with Supabase SSR guide; test sign-in on preview URL before prod |
| Free tier misunderstood (daily vs monthly quota) | Unknown unknowns | L | L | Monitor Workers analytics; alert before 100k requests/day |
| `wrangler.jsonc` worker name mismatch | Devil's advocate | L | L | Rename `name` to `ozc-cal` before first production deploy |
| PR preview exposes unauthenticated MVP routes | Research finding | M | M | Cloudflare Access on preview hostnames or disable previews until auth story is clear |

## Getting Started

1. **Local secrets** — `cp .env.example .dev.vars`; fill `SUPABASE_URL` and `SUPABASE_KEY` for local workerd dev.
2. **Develop** — `npm run dev` (Astro 6 + Cloudflare Vite plugin; no separate `wrangler dev` required for routine work).
3. **Production secrets** — After `npx wrangler login`, run `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`.
4. **First deploy** — Update `wrangler.jsonc` `name` to `ozc-cal`, then `npm run build` and `npx wrangler deploy`.
5. **CI/CD (next)** — Connect GitHub in Cloudflare Builds for PR previews + deploy on merge to `master`, or extend `.github/workflows/ci.yml` with a deploy step using `CLOUDFLARE_API_TOKEN` — aligns with `ci_default_flow: auto-deploy-on-merge` in tech-stack hints.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline implementation (documented as next step only)
- Production-scale architecture (multi-region HA, DR, enterprise SLAs)
