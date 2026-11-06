# Tasks — order and dependencies

Do them **in this order**. A task may start only when every task in its `Depends on` is merged into `main`.
Each task = one branch `task/T-XXX-short-name` = one Pull Request = one GitHub Issue (D-082).

| Task | Title | Main docs | Depends on |
|---|---|---|---|
| T-001 | Project setup | 02, 10 | — |
| T-002 | UI kit and layouts | 02 §9 | T-001 |
| T-003 | Accounts and auth | 02 §8, 03 §3, 09 | T-002 |
| T-004 | Categories and themes (reference feature) | 03 §4–5, 05 §3 | T-003 |
| T-005 | Activity log | 03 §15, 05 §5 `/admin/activity` | T-004 |
| T-006 | Storage module and theme images | 07 §1–3, §9–10 | T-005 |
| T-007 | Notifications core (models, texts, job creation) | 03 §12–13, 09 §4, §5.3 (`lockedUntil`) | T-005 |
| T-008 | Theme versions (zip upload, changelog) | 07 §4–5, 05 §5 versions pages | T-006, T-007 |
| T-009 | Ownerships and downloads | 03 §8, §17, 07 §7, 05 §4 `/account/themes` + AccountShell | T-008 |
| T-010 | Payment provider, Polar sync, publish/unpublish | 06 §1–3, §8, 03 §5 status rules | T-009 |
| T-011 | Coupons | 03 §9, 06 §4, 05 §5 coupons | T-010 |
| T-012 | Card checkout, webhook, orders | 03 §7, 06 §5–6, 09 #3, 05 `/account/orders` | T-011 |
| T-013 | Settings and Egyptian wallet payments | 03 §10, §18, 06 §7, 09 #4–#6, 05 | T-012 |
| T-014 | Notification processing, cron, notification center | 09 §1–5, 05 `/account/notifications` | T-013 |
| T-015 | Favorites and follows | 03 §11, 05 | T-014 |
| T-016 | Feedback | 03 §14, 09 #11, 05 | T-014 |
| T-017 | Admin customers and announcements | 00 §4.3, §4.7, 05 §5 | T-016 |
| T-018 | Admin orders, refunds and dashboard | 00 §4.1, §4.4, 06 §7.6, 05 §5 | T-017 |
| T-019 | Account overview and settings, info pages, demo preview, SEO | 05 §3–4 | T-018 |
| T-020 | Production readiness: Docker, Caddy, deploy/backup scripts, health route, ensureDatabase | 11 | T-019 |

The order is strictly linear after T-004 on purpose: the implementing agent works on one task at a time, and each
task can copy patterns from the ones before it.
