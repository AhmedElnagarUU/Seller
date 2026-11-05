# T-002: UI kit and layouts (the only place with visual styling)

- Depends on: T-001
- Read first: `AGENTS.md`, `docs/02-architecture.md` section 9 (all of it), `src/styles/tokens.css`

## Goal

The small set of components every page uses. After this task, feature code only combines these components with
layout classes. No business logic, no data fetching, no feature imports in any file of this task.

## Rules for every component

- Named export, one component per file, PascalCase file name.
- Props typed with a `type <Name>Props = {...}`. **No `className` prop.** No `style` prop.
- Variants are string-union props. Map variant → classes with a `const` object, e.g.
  `const VARIANT_CLASSES: Record<ButtonVariant, string> = { primary: "bg-primary text-primary-foreground ...", ... }`, combined with `clsx`.
- Only token-based colors: `bg-primary`, `text-text-muted`, `border-border`, `rounded-md`, `shadow-sm`, `font-heading`…
  Never Tailwind palette colors (`bg-indigo-600`), never hex values.
- Focus visible on every interactive element: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`.
- Server components by default. Add `"use client"` only where written below.
- Every form control has a visible `<label>` connected with `htmlFor`/`id` (use React `useId()` when no `id` is given).

## Files

### `src/shared/ui/`

| File | Props | Notes |
|---|---|---|
| `Button.tsx` | `variant: "primary" \| "secondary" \| "ghost" \| "danger"` (default primary), `size: "sm" \| "md"` (default md), `type: "button" \| "submit"` (default "button"), `fullWidth?: boolean`, `disabled?`, `onClick?`, `children`, `name?`, `value?` | |
| `SubmitButton.tsx` | `children`, `pendingText: string`, `variant?`, `size?`, `fullWidth?` | `"use client"`. Uses `useFormStatus()`; while pending: disabled + shows `pendingText`. Renders `Button type="submit"`. |
| `ButtonLink.tsx` | `href`, `variant?`, `size?`, `fullWidth?`, `children` | Next.js `<Link>` that looks like `Button`. Share the class maps with `Button` through `buttonClasses.ts`. |
| `ButtonAnchor.tsx` | `href`, `variant?`, `size?`, `fullWidth?`, `children`, `rel?` | Plain `<a>` that looks like `Button` (for downloads, `07` section 7.3). |
| `buttonClasses.ts` | `buttonClasses({ variant, size, fullWidth }): string` | Used by the 3 button files. |
| `TextLink.tsx` | `href`, `children`, `tone?: "primary" \| "muted"` | Next.js `<Link>`, underline on hover. |
| `Heading.tsx` | `level: 1 \| 2 \| 3`, `children` | Renders `h1`/`h2`/`h3`; sizes: 1 = `text-3xl`, 2 = `text-2xl`, 3 = `text-lg`; `font-heading font-bold`. |
| `Text.tsx` | `as?: "p" \| "span"` (default p), `size?: "sm" \| "md" \| "lg"`, `tone?: "default" \| "muted" \| "danger" \| "success"`, `weight?: "normal" \| "bold"`, `children` | |
| `Card.tsx` | `children`, `padding?: "md" \| "lg"` | `bg-background border border-border rounded-lg shadow-sm`. |
| `Alert.tsx` | `tone: "info" \| "success" \| "warning" \| "danger"`, `title?: string`, `children` | `role="alert"` for danger and warning, `role="status"` otherwise. |
| `Badge.tsx` | `tone?: "neutral" \| "primary" \| "success" \| "warning" \| "danger"`, `children` | Small rounded label. |
| `TextField.tsx` | `label`, `name`, `type?: "text" \| "email" \| "password" \| "url" \| "number" \| "tel"`, `defaultValue?`, `placeholder?`, `required?`, `autoComplete?`, `hint?`, `errors?: string[]`, `id?` | Shows `hint` under the input (muted). Shows each of `errors` in danger text; sets `aria-invalid` and `aria-describedby`. |
| `TextAreaField.tsx` | same as TextField without `type`, plus `rows?` (default 4) | |
| `SelectField.tsx` | `label`, `name`, `options: { value: string; label: string }[]`, `defaultValue?`, `required?`, `hint?`, `errors?`, `id?`, `placeholder?` (adds a first empty option) | |
| `CheckboxField.tsx` | `label`, `name`, `defaultChecked?`, `value?` (default "on"), `hint?`, `errors?`, `id?` | |
| `FormError.tsx` | `message: string \| null \| undefined` | Renders `Alert tone="danger"` when message is set, nothing otherwise. |
| `Divider.tsx` | `label?: string` | Horizontal line; with label shows it in the middle ("or"). |

### `src/shared/layout/`

| File | Props | Notes |
|---|---|---|
| `PageContainer.tsx` | `width?: "narrow" \| "normal" \| "wide"` (max-w-md / max-w-5xl / max-w-7xl), `children` | `mx-auto w-full px-4 py-8`. |
| `Stack.tsx` | `gap?: "xs" \| "sm" \| "md" \| "lg" \| "xl"` (gap-1/2/4/6/10), `align?: "start" \| "center" \| "stretch"`, `children` | Vertical flex. |
| `Inline.tsx` | `gap?` (same), `align?: "start" \| "center" \| "end"`, `justify?: "start" \| "between" \| "end" \| "center"`, `wrap?: boolean`, `children` | Horizontal flex. |
| `Grid.tsx` | `columns: 2 \| 3 \| 4`, `gap?` (same as Stack), `children` | 1 column on mobile, `sm:grid-cols-2`, then `lg:grid-cols-<columns>`. |
| `StoreHeader.tsx` | `accountSlot: React.ReactNode` | Store name "Theme Store" (TextLink to `/`), nav link "Themes" (`/themes`), `accountSlot` on the right. Border bottom. |
| `StoreFooter.tsx` | none | Links: About `/about`, Contact `/contact`, Terms `/terms`, Privacy `/privacy`, Refund policy `/refund-policy`, License `/license`. Text "© <current year> Theme Store". |

### Changes to existing files

- `src/app/layout.tsx`: body uses `bg-background text-text font-sans antialiased min-h-screen flex flex-col`.
  `app/layout.tsx` is allowed visual classes **only on `<body>`** (09.7 font setup). Update `scripts/check-styles.mjs`
  to skip the `<body` line of `src/app/layout.tsx` only.
  Render `<StoreHeader accountSlot={null} />`, `<main className="flex-1">{children}</main>`, `<StoreFooter />`.
  (T-003 replaces `null` with the real account menu.)
- `src/app/page.tsx`: `PageContainer` + `Stack` + `<Heading level={1}>Theme Store</Heading>` +
  `<Text tone="muted">Premium WordPress themes.</Text>`.
- `src/app/dev/ui/page.tsx` (**new**): a page that shows every component and every variant, for visual review.
  It must return `notFound()` unless `env.ENABLE_DEV_PAGES` is `true` (new env flag, default `false`; `true` in `.env.example` and CI).

## Required tests

- [ ] e2e `e2e/ui-kit.spec.ts` › ui kit page renders every component → opens `/dev/ui`; finds by role:
      buttons "Primary", "Secondary", "Ghost", "Danger"; textbox with label "Email"; combobox with label "Country";
      checkbox with label "Remember me"; alert containing "Something went wrong".
- [ ] e2e `e2e/ui-kit.spec.ts` › primary button uses the primary token color → computed `background-color` of
      button "Primary" equals `rgb(79, 70, 229)` (#4f46e5). (This proves `tokens.css` + `@theme inline` work; if it
      fails, fix tokens.css so the raw values and the Tailwind names do not reference each other in a loop, e.g.
      rename raw values to `--ts-color-*` and map `--color-*: var(--ts-color-*)`; write what you did in the report.)
- [ ] e2e `e2e/ui-kit.spec.ts` › text field shows its error → the textbox "Email" has `aria-invalid="true"` and the
      text "Enter a valid email." is visible (the dev page renders one field with that error).
- [ ] e2e `e2e/home.spec.ts` still passes.

No unit tests (no logic in this task). `pnpm check:styles` must pass, which proves the pages use only layout classes.

## Do NOT

- No new packages. No `className` prop on any UI kit component. No raw colors outside `tokens.css`.
- No feature folders, no data fetching, no server actions.

## Verify

```
pnpm lint && pnpm typecheck && pnpm check:styles && pnpm check:focused && pnpm test && pnpm build && pnpm e2e
```

Commit: `T-002: UI kit and layouts`
