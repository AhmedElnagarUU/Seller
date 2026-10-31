# 10 — Testing

Most of the code is written by an AI agent. **Tests are our safety net**: they must catch a broken rule
**before** the code is merged or deployed.

A test is only useful if it **fails when the logic it protects is broken**. A test that always passes is worse than
no test, because it gives false confidence. Every rule below exists to prevent such "fake" tests.

---

## 1. Kinds of tests

| Kind | What it tests | Tool | Where |
|---|---|---|---|
| **Unit** | Pure functions: `shared/lib/*`, `*.schemas.ts`, `*.mapper.ts` | Vitest | next to the file: `money.test.ts` |
| **Integration** | Service functions with a **real** MongoDB (in memory): rules, DB writes, transactions | Vitest + `mongodb-memory-server` (replica set) | `theme.service.test.ts` |
| **Handler** | Route handlers: webhook with a real signature, cron auth, download redirect | Vitest (call the exported `POST`/`GET` with a `Request`) | `payment.webhook.test.ts` |
| **E2E** | Main user flows in a real browser against the running app | Playwright | `e2e/*.spec.ts` |

Most tests are **integration** tests. They give the most protection for the least effort, because they test the
real chain service → repository → model → database.

---

## 2. The rules for real tests

1. **Test through the public function.** Call the service function the action calls, then check:
   - the returned value, **and**
   - what is now in the database (read it back with the model in the test).
2. **Never mock our own code.** Do not mock repositories, models, services, mappers or schemas.
   Only the **external boundary** is replaced (section 4).
3. **Every assertion checks a specific value.**
   - Good: `expect(order.totalAmount).toBe(2320)`, `expect(await OwnershipModel.countDocuments()).toBe(1)`.
   - Forbidden as the only check: `toBeDefined()`, `toBeTruthy()`, `not.toBeNull()`, "a mock was called".
   - Forbidden always: snapshot tests, tests with no `expect`, `expect(true).toBe(true)`.
4. **Errors are checked exactly:** the `AppError` code **and** the exact message from the spec.
   ```ts
   await expect(startWalletPayment(input)).rejects.toMatchObject({
     code: "FORBIDDEN",
     message: "Wallet payment is only available for customers in Egypt.",
   });
   ```
5. **Also check what did NOT happen.** When something is refused, assert that nothing was written
   (e.g. still 0 orders, ownership still revoked).
6. **Every rule in the docs has a test** that fails if the rule is removed. Status rules, limits, "only once",
   "only the owner can see it" — each one.
7. **Never change or delete an existing test to make your code pass.** If a test fails, your code is wrong — unless the
   task explicitly says that behaviour changed, and then the task lists which tests to update.
8. **No `.skip`, `.only`, `.todo`** in committed code. CI fails if it finds them.
9. **Tests are independent.** The database is cleared before each test. A test never depends on another test's data or order.
10. **No real network, no sleeping.** No calls to Polar, S3, Resend or any URL. No `setTimeout` waits.
11. **Time is controlled.** Code that needs "now" calls `now()` from `shared/lib/clock.ts`. Tests call
    `setTestNow(new Date("2026-11-01T10:00:00Z"))` (exported from the same file, only works when `NODE_ENV=test`).

---

## 3. Test setup

- `vitest.config.ts` uses a setup file `src/shared/test/setup.ts` that:
  - starts one `MongoMemoryReplSet` for the whole run (transactions need a replica set) and connects Mongoose;
  - clears **all** collections before each test;
  - replaces external modules with the fakes (section 4) using `vi.mock`;
  - resets the fakes and the test clock before each test.
- **Factories** in `src/shared/test/factories.ts` create valid test data with good defaults; each accepts overrides:
  `createUser({ country: "EG" })`, `createAdmin()`, `createCategory()`, `createTheme({ status: "published", priceCents: 2900 })`,
  `createVersion(themeId)`, `createOwnership(userId, themeId)`, `createCoupon({ percentOff: 20 })`,
  `createOrder(...)`, `createWalletPayment(...)`, `setSettings({ walletEnabled: true })`.
- `createUser` writes directly to the `user` collection. This is allowed **only** in test factories.

---

## 4. Fakes for external services

Real classes in `src/shared/test/fakes/` that behave like the real thing, with no network. They are used only in tests.

| Fake | Replaces | Behaviour | What tests can read |
|---|---|---|---|
| `FakePaymentProvider` | `getPaymentProvider()` | Same as the fake provider in `06-payments.md` section 8; can be told to fail the next call | `calls` (every call with its input) |
| `FakeStorage` | `shared/storage/s3.ts` | Keeps objects in a `Map`; presigned URLs are fake strings; `headObject` returns stored metadata | `objects` |
| `FakeEmailSender` | `features/emails/email.sender.ts` | Stores every email instead of sending | `sent` (to, subject, template name, data) |

Checking a fake's recorded calls is allowed **in addition** to checking the database, never instead of it.

---

## 5. Required tests in every task

Each task file has a `## Required tests` section written by the planner. Example:

```
## Required tests
- [ ] startWalletPayment › refuses customers outside Egypt
      → AppError FORBIDDEN "Wallet payment is only available for customers in Egypt."; 0 walletPayments in DB
- [ ] startWalletPayment › returns the existing open request instead of creating a second one
      → same _id returned; 1 walletPayments in DB
- [ ] approveWalletPayment › approving twice creates only one order
      → second call: AppError CONFLICT "This payment was already reviewed."; 1 order; salesCount = 1
```

The implementing agent:
1. Writes **every** listed test, with the same `describe` / `it` names. More tests are welcome; fewer are not allowed.
2. **Break check:** for at least **3** of the required tests, temporarily breaks the code line the test protects
   (e.g. removes the country check), runs the test, sees it **fail**, then restores the code.
   The PR description lists which tests were break-checked and what was broken.

The reviewer repeats the break check on 1–2 random rules. If a broken rule does not make any test fail, the PR is sent back.

---

## 6. Naming

```ts
describe("startWalletPayment", () => {
  it("refuses customers outside Egypt", async () => { ... });
  it("returns the existing open request instead of creating a second one", async () => { ... });
});
```

- `describe` = the function name. `it` = the rule, in plain English, starting with a verb.
- Arrange → act → assert, separated by a blank line. One behaviour per `it`.

---

## 7. Coverage

- `pnpm test:coverage` uses `@vitest/coverage-v8`.
- Minimum **80 % of lines and branches** for `src/features/**/*.service.ts`, `*.mapper.ts`, `*.schemas.ts` and
  `src/shared/lib/**` (D-134). Below that, CI fails.
- Coverage shows what was **run**, not what was **checked**. It never replaces the rules in section 2 or the break check.

---

## 8. E2E tests (Playwright)

- Run against the built app (`pnpm build && pnpm start`) with `PAYMENT_PROVIDER=fake`, the local MongoDB replica set
  and MinIO from `docker-compose.yml`. The email sender writes to the console in this mode.
- Test users are **seeded directly** in the database (already verified) by `e2e/seed.ts`. Then the test logs in
  through the real login page.
- Elements are found by role, label or text — never by CSS class (`02-architecture.md` 9.6).

**E2E flows (the MVP "done" list, `00-product.md` section 7):**

| # | Flow |
|---|---|
| 1 | Visitor searches, filters by category, opens a theme, opens the demo preview |
| 2 | Customer buys a theme with a coupon through the fake checkout → success page → downloads the zip |
| 3 | Egyptian customer pays by wallet: uploads proof → admin approves → customer downloads |
| 4 | Admin uploads a new version with "notify" → cron route is called → the owner sees the notification |
| 5 | Admin disables a customer → that customer cannot log in |
| 6 | Customer favorites a theme and follows a category → new theme published → customer is notified |
| 7 | Admin sends an announcement to theme owners → only owners receive it |

---

## 9. CI — GitHub Actions (D-132)

File `.github/workflows/ci.yml`, runs on every Pull Request and on pushes to `main`:

```
1. Install          pnpm install --frozen-lockfile
2. Lint             pnpm lint
3. Types            pnpm typecheck
4. Styles           pnpm check:styles
5. No focused/skipped tests   (fails on .only / .skip / .todo in test files)
6. Tests            pnpm test:coverage
7. Build            pnpm build
8. E2E              start MongoDB + MinIO, pnpm e2e
```

- The owner turns on **branch protection** for `main` in GitHub: "Require status checks to pass before merging".
  Then a red PR **cannot** be merged by anyone, including agents.
- A PR is reviewed only after CI is green.

---

## 10. Before deploying

1. CI is green on `main`.
2. Deploy to **staging** (same VPS, separate database and Polar sandbox).
3. Run the manual checklist in `06-payments.md` section 9 once for every release that touches payments.
4. Deploy to production.
