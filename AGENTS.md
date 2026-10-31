# AGENTS.md — Rules for every coding agent

Read this whole file before you do anything. These rules are not optional.

## What this project is

An online store where **one seller** sells **premium WordPress themes**.
Customers pay once per theme and get lifetime updates (by download).

- Product details: `docs/00-product.md`
- Every locked decision: `docs/01-decisions.md`
- Index of all planning docs: `docs/README.md`

## The most important rule: you do not make decisions

All product and technical decisions are already written in `docs/`.
Your job is to **implement exactly what the task file says**.

If the task or the docs do not tell you something you need:

1. **Stop.** Do not guess. Do not pick "a reasonable default".
2. Add an entry to `docs/QUESTIONS.md` (format is inside that file).
3. Finish only the parts of the task that are not blocked.
4. Mention the question in your Pull Request description.

Examples of things you must NOT decide yourself:

- Adding, removing or upgrading any npm package.
- Adding a field to a database model, or renaming one.
- Creating a new page, route, API endpoint or environment variable that the task does not list.
- Changing text the customer sees (labels, error messages, emails) from what the spec says.
- Changing folder structure or naming conventions.

## How to work on a task

1. Tasks live in `tasks/T-XXX-name.md`. Do **one task at a time**.
2. Check the task's `Depends on` list. If a dependency is not merged into `main`, stop.
3. Create a branch from the latest `main`: `task/T-XXX-short-name`
   (example: `task/T-005-theme-model`).
4. Touch **only** the files listed in the task's `Files` section.
   If you believe another file must change, write it in `docs/QUESTIONS.md` instead.
5. Follow the task's `Do NOT` list exactly.
6. Run every command in the task's `Verify` section. All must pass.
7. Commit with the message format: `T-XXX: short description`
   (example: `T-005: add Theme mongoose model`).
8. Open a Pull Request:
   - Title: `T-XXX: <task title>`
   - Body: what you did, the `Verify` output, any questions, and `Closes #<issue number>`.

## When something fails

- If a `Verify` command fails, fix your code. Never delete, skip or weaken a test to make it pass.
- Never disable lint rules or TypeScript checks (`// @ts-ignore`, `eslint-disable`, `any`) to make errors go away.
- If you cannot fix it after a real attempt, stop and explain the failure in the PR description.

## Copy existing patterns

The first tasks build working example code (one complete feature from database to page).
When you write something new, **find the closest existing example in the codebase and copy its structure**:
same file layout, same naming, same error handling, same validation style.
Do not invent a new pattern when one already exists.

## Coding conventions

The full rules are in `docs/02-architecture.md`. Read it before your first task. The short version:

- **Feature folders.** Code for a feature lives in `src/features/<feature>/`
  (`theme.model.ts`, `theme.repository.ts`, `theme.service.ts`, `theme.actions.ts`, `components/`...).
  Shared code lives in `src/shared/`. `src/app/` only has thin pages and route handlers.
- **Layers, always in this order, never skipped:** page/action → service → repository → model.
- **Services and repositories never import from `next/*`.**
- **Features use each other only through services.** Never import another feature's repository or model.
- **Components never fetch data.** Pages fetch through services and pass props.
- **KISS:** functions ~40 lines max, files ~250 lines max, max 2 levels of nesting, early returns,
  clear names without abbreviations, no clever code, no new abstraction until needed 3 times.
- No `index.ts` barrel files. Imports use `@/`. Named exports only (except where Next.js requires default).
- TypeScript strict. No `any`, `@ts-ignore` or `eslint-disable`.
- Validate every outside input with `zod`.
- Money is always an **integer number of cents** (`1900` = $19.00).
- Never put secrets in code. Only `src/shared/config/env.ts` reads environment variables.
- Never log passwords, tokens, API keys or webhook bodies.

## Styling rules (short version — full rules in `docs/02-architecture.md` section 9)

- All colors, fonts, radius and shadows live in `src/styles/tokens.css`. Never write a raw color or font anywhere else.
- Visual Tailwind classes (colors, text size, font, rounded, shadow, hover…) are allowed **only** in
  `src/shared/ui/` and `src/shared/layout/`. Feature components and pages use **only layout classes**
  (flex, grid, gap, padding, margin, width…). `pnpm check:styles` enforces this.
- Need a different look in a feature? Use a UI kit variant (`<Text tone="muted">`) or add one to the UI kit.

## Testing rules (short version — full rules in `docs/10-testing.md`)

- Write **every** test in the task's `Required tests` list, with the same names.
- Service tests use the real in-memory MongoDB. **Never mock our own code** (repositories, models, services).
  Only Polar, S3 and email are replaced, by the fakes in `src/shared/test/fakes/`.
- Every assertion checks a real value (and the database). Errors are checked by code **and** exact message.
- Never change or delete an existing test to make your code pass. No `.skip` / `.only` / `.todo`.
- **Break check:** for at least 3 required tests, temporarily break the code they protect, confirm they fail,
  restore the code, and list this in the PR description.
- Before every commit: `pnpm lint && pnpm typecheck && pnpm check:styles && pnpm test`.
