# Planning docs — index

These documents are the single source of truth for the project.
Code must follow them. If code and docs disagree, the docs win (or the docs get fixed first).

| File | What it contains | Status |
|---|---|---|
| `00-product.md` | What we sell, to whom, MVP features, what is NOT in the MVP | Draft — under review |
| `01-decisions.md` | Numbered log of every locked decision | Draft — under review |
| `02-architecture.md` | Stack versions, folder layout, coding conventions, env vars | Not written |
| `03-data-model.md` | Every Mongoose model, field by field, with indexes | Not written |
| `04-api.md` | Every route handler / server action: input, output, auth, errors | Not written |
| `05-pages.md` | Every page: URL, data, components, empty/loading/error states | Not written |
| `06-payments.md` | Polar checkout, webhooks, idempotency, provider interface | Not written |
| `07-delivery-updates.md` | File storage, downloads, versions, update emails | Not written |
| `08-admin.md` | Admin panel spec | Not written |
| `09-emails.md` | Every email: trigger, subject, content | Not written |
| `QUESTIONS.md` | Questions raised by agents while implementing | Living file |

Task files live in `/tasks`. They are written after the docs above are approved.

## Order of work

1. Owner + planner agree on `00` and `01`.
2. Planner writes `02` → `09`, owner reviews each.
3. Planner writes task files `T-001 …` and creates one GitHub Issue per task.
4. Planner (strong model) implements T-001 → T-003 as the reference code.
5. Implementing agent (OpenCode + DeepSeek) takes the remaining tasks one by one.
