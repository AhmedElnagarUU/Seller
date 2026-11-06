# Planning docs — index

These documents are the single source of truth for the project.
Code must follow them. If code and docs disagree, the docs win (or the docs get fixed first).

| File | What it contains | Status |
|---|---|---|
| `00-product.md` | What we sell, to whom, MVP features, what is NOT in the MVP | Draft — updated with new features |
| `01-decisions.md` | Numbered log of every locked decision | Draft — new decisions to review |
| `02-architecture.md` | Stack versions, folder layout, coding conventions, env vars | Draft — under review |
| `03-data-model.md` | Every Mongoose model, field by field, with indexes | Draft — updated with new collections |
| `04-api.md` | Dropped: inputs and errors of each action are in the task files and feature docs | — |
| `05-pages.md` | Every page (store, account, admin): URL, guard, data, content, empty states | Draft — under review |
| `06-payments.md` | Card (Polar) + Egyptian wallet payments, coupons, webhooks, refunds | Draft — under review |
| `07-delivery-updates.md` | File storage (Cloudflare R2), uploads, versions, downloads, R2 + MinIO setup | Draft — under review |
| `08-admin.md` | Merged into `05-pages.md` section 5 | — |
| `09-emails.md` | Every email and notification job: trigger, subject, content, batching | Draft — under review |
| `10-testing.md` | Testing rules, fakes, required tests, E2E flows, CI | Draft — under review |
| `11-deployment.md` | VPS setup, deploys, cron, backups, monitoring, launch checklist | Draft — under review |
| `QUESTIONS.md` | Questions raised by agents while implementing | Living file |

Task files live in `/tasks`. They are written after the docs above are approved.

## Order of work

1. Owner + planner agree on `00` and `01`.
2. Planner writes `02` → `09`, owner reviews each.
3. Planner writes task files `T-001 …` and creates one GitHub Issue per task.
4. Planner (strong model) writes T-001 → T-004 (reference code), built by a cheaper model and reviewed by the planner.
5. Implementing agent (OpenCode + DeepSeek) takes the remaining tasks one by one.
