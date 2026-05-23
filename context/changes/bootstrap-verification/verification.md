---
bootstrapped_at: 2026-05-23T07:01:30Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: ozc-cal
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: ozc-cal
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

## Why this stack

A solo developer shipping OZC-cal in three after-hours weeks needs auth, project persistence, and a TypeScript-first web stack without wiring infrastructure from scratch. The 10x Astro Starter is the recommended default for `(web, js)`: Supabase covers email/password auth and PostgreSQL project storage, React islands suit the PDF-backed 2D editor, and Cloudflare Pages matches the starter's default deploy path. It clears all four agent-friendly gates with first-class bootstrapper confidence. Payments, realtime, AI, and background jobs are out of scope per the PRD; CI runs on GitHub Actions with auto-deploy on merge to main.

## Pre-scaffold verification

| Signal             | Value                                                      | Severity | Notes                                      |
| ------------------ | ---------------------------------------------------------- | -------- | ------------------------------------------ |
| npm package        | not run                                                    | —        | cmd_template uses git clone; npm step skipped |
| GitHub repo        | przeprogramowani/10x-astro-starter last pushed 2026-05-17 | fresh    | from card.docs_url via GitHub API          |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`

**Strategy**: git-clone

**Exit code**: 0

**Files moved**: 50

**Conflicts (.scaffold siblings)**: none

**.gitignore handling**: moved silently

**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: npm audit --json

**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW

**Direct vs transitive**: 0/0/2/0 direct of total 0/1/9/0

#### CRITICAL findings

None.

#### HIGH findings

- **devalue** (transitive) — GHSA-77vg-94rm-hx3p: Svelte devalue: DoS via sparse array deserialization (CVSS 7.5). Range: 5.6.3–5.8.0. Fix available.

#### MODERATE findings

- **@astrojs/check** (direct) — via @astrojs/language-server. Fix available via downgrade to 0.9.2 (semver major).
- **wrangler** (direct) — via miniflare. Fix available.
- **@astrojs/language-server** (transitive) — via volar-service-yaml.
- **@cloudflare/vite-plugin** (transitive) — via miniflare, wrangler, ws.
- **miniflare** (transitive) — via ws.
- **volar-service-yaml** (transitive) — via yaml-language-server.
- **ws** (transitive) — GHSA-58qx-3vcg-4xpx: Uninitialized memory disclosure (CVSS 4.4). Fix available.
- **yaml** (transitive) — GHSA-48c2-rrv3-qjmp: Stack overflow via deeply nested YAML collections (CVSS 4.3).
- **yaml-language-server** (transitive) — via yaml.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                       | Value                              |
| -------------------------- | ---------------------------------- |
| bootstrapper_confidence    | first-class                        |
| quality_override           | false                              |
| path_taken                 | standard                           |
| self_check_answers         | null                               |
| team_size                  | solo                               |
| deployment_target          | cloudflare-pages                   |
| ci_provider                | github-actions                     |
| ci_default_flow            | auto-deploy-on-merge               |
| has_auth                   | true                               |
| has_payments               | false                              |
| has_realtime               | false                              |
| has_ai                     | false                              |
| has_background_jobs        | false                              |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
