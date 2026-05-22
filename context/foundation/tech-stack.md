---
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
---

## Why this stack

A solo developer shipping OZC-cal in three after-hours weeks needs auth, project persistence, and a TypeScript-first web stack without wiring infrastructure from scratch. The 10x Astro Starter is the recommended default for `(web, js)`: Supabase covers email/password auth and PostgreSQL project storage, React islands suit the PDF-backed 2D editor, and Cloudflare Pages matches the starter's default deploy path. It clears all four agent-friendly gates with first-class bootstrapper confidence. Payments, realtime, AI, and background jobs are out of scope per the PRD; CI runs on GitHub Actions with auto-deploy on merge to main.
