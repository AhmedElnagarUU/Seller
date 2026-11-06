# Legal drafts

These are first drafts of the four legal pages. They are **not legal advice**. The payment provider (Polar) requires these pages, so they must be reviewed with a lawyer for your country, filled in, and published before launch.

## Files

| File | What it is |
|---|---|
| `terms.md` | Terms of Service: accounts, buying, downloads, updates, liability |
| `privacy.md` | Privacy Policy: data we store, processors, cookies, retention, your rights |
| `refund-policy.md` | Refund Policy: window, conditions, how card and wallet refunds work, effect on access |
| `license.md` | License: one standard license, unlimited own/client sites, no resale |

## Where the final texts go

Copy the final, approved texts to `src/content/<page>.md` (built in task T-019):

| Draft | Final file |
|---|---|
| `terms.md` | `src/content/terms.md` |
| `privacy.md` | `src/content/privacy.md` |
| `refund-policy.md` | `src/content/refund-policy.md` |
| `license.md` | `src/content/license.md` |

Before copying: replace every placeholder, remove every `[OWNER: ...]` note, delete the DRAFT line and remove the first "Effective date" line only if you do not want it shown. The pages render the file's first heading as the page title.

## Placeholders

Fill in all of these. Search each file for `[`.

| Placeholder | Meaning |
|---|---|
| `[STORE NAME]` | Public name of the store |
| `[OWNER LEGAL NAME]` | Your legal name or company name |
| `[COUNTRY]` | Country where you are based / whose law applies |
| `[SUPPORT EMAIL]` | Support email (same as on the Contact page) |
| `[DOMAIN]` | Website domain |
| `[EFFECTIVE DATE]` | Date the text goes live |
| `[OWNER: refund window, e.g. 14 days]` | Refund window (refund-policy.md) |
| `[OWNER: conditions, ...]` and other `[OWNER: ...]` notes | Owner decisions, see the report / list below |
| `[OWNER / LAWYER: ...]` | Points a lawyer must check |

## Owner decisions needed

1. Refund window and conditions (refund-policy.md).
2. Meaning of "lifetime" if the store closes (terms.md section 4).
3. What happens to purchased downloads when an account is deleted (terms.md section 11).
4. Retention of download records and wallet screenshots (privacy.md section 5). The docs set no expiry for them.
5. Legal record-keeping period for orders (privacy.md section 5).
6. Governing law and courts; liability cap; minimum age.
7. Support scope and reply time.
8. Third-party licenses inside themes (GPL) (license.md section 3).
9. If you sell to the EU/UK: international transfer wording and consumer withdrawal rules.

## Facts used (from docs/)

D-004, D-005, D-006 (lifetime updates by download, one license), D-011, D-014 (refund and access), D-016, D-100, D-104, D-105 (wallet), D-120, D-123 (activity log 1 year), 00-product section 6 (deletion by email), webhook events 90 days, backups 30 days. If these decisions change, update the drafts.
