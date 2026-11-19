# Launch guide (owner)

A short, ordered list of what **you** do to put the store online. The code is finished; every step here needs your
own accounts, money, ID or passwords, so nobody else can do it for you. The full details of each step are in the
documents named in brackets.

**Never paste a password, API key or secret into a chat, an issue or a file in the repository.** Secrets go only into
the env files on your server (step 4).

---

## Step 1 — Make GitHub run the tests (5 minutes)

The tests run on GitHub (CI) for every push to `main` or `claude/wordpress-ecommerce-planning-dipvfa`, and for every
pull request.

1. Open the repository on GitHub → **Actions**. You should see a run called **CI** for the latest push.
2. It must be green. If it is red, open it and send the error text to your developer.
3. The CI run also downloads the MinIO images of `docker-compose.yml`. If that step fails with
   "pull access denied", tell your developer (open question Q-011 / Q-002).

---

## Step 2 — Create the accounts (start today: some need approval)

Write each key you receive into a password manager, then into the env file in step 4.

| # | Service | What to do | Gives you | Details |
|---|---|---|---|---|
| 1 | **Polar** (card payments) | Create a production organization and a **sandbox** organization. Finish payout account and tax details. **Start first: Polar reviews new sellers.** | access token, webhook secret | 06 §1–3, 11 §10 |
| 2 | **Cloudflare** | Buy your domain on Cloudflare. | the domain | 11 §3 |
| 3 | **Cloudflare R2** (files) | 4 buckets: `store-files`, `store-images`, `staging-store-files`, `staging-store-images`, plus `store-backups`. Custom image domain, CORS, API tokens, lifecycle rules. | S3 keys, image URL | 07 §9, 11 §6 |
| 4 | **MongoDB Atlas** (database) | One cluster (free M0 to start), databases `themestore` and `themestore-staging`, one user per environment, Network Access = your server's IP only. | `MONGODB_URI` × 2 | 11 §10 |
| 5 | **Resend** (emails) | Add and verify your domain (SPF, DKIM, DMARC records in Cloudflare DNS). | `RESEND_API_KEY` | 09, 11 §10 |
| 6 | **Google Cloud** ("Sign in with Google") | OAuth consent screen + OAuth client "Web application" with redirect URIs `https://<domain>/api/auth/callback/google` and the staging one. | client id + secret | 11 §10 |
| 7 | **DigitalOcean** (server) | One Ubuntu 24.04 droplet, at least 2 GB RAM. | server IP | 11 §3 |
| 8 | **UptimeRobot** (free) | HTTPS monitor on `https://<domain>/api/health` every 5 minutes. | email alerts | 11 §8 |

Also make, for each of production and staging: `BETTER_AUTH_SECRET` and `CRON_SECRET` (run `openssl rand -base64 48`
on your computer, a different value each time).

---

## Step 3 — Set up the server (about 30 minutes)

Follow `docs/11-deployment.md` section 3, steps 1–9, exactly: secure login, firewall, automatic updates, swap,
Docker, a read-only deploy key for GitHub, clone the code into `/srv/themestore/src`, the Cloudflare origin
certificate in `/srv/themestore/certs/`, and the DNS records (both **Proxied**, SSL mode **Full (strict)**).

Also create `/srv/themestore/deploy.env` with one line: `DOMAIN=<your domain>` (see `deploy/README.md`).

---

## Step 4 — Write the two env files on the server

`/srv/themestore/production.env` and `/srv/themestore/staging.env`, each with **every** variable of
`docs/02-architecture.md` §10 (the list is also in `.env.example`). `chmod 600` both. Important values:

| Variable | production | staging |
|---|---|---|
| `APP_URL`, `BETTER_AUTH_URL` | `https://<domain>` | `https://staging.<domain>` |
| `APP_ENV` | `production` | `staging` |
| `PAYMENT_PROVIDER` / `POLAR_SERVER` | `polar` / `production` | `polar` / `sandbox` |
| `EMAIL_TRANSPORT` | `resend` | `resend` |
| `ENABLE_DEV_PAGES` | leave out | leave out |
| `ADMIN_EMAILS` | your email | your email |
| `S3_*`, `PUBLIC_IMAGES_BASE_URL` | production buckets | staging buckets |

For backups also create `/srv/themestore/backup.env` (see `deploy/README.md`).

---

## Step 5 — Fill in the content

1. Legal pages in `src/content/`: `terms.md`, `privacy.md`, `refund-policy.md`, `license.md`. Replace every
   `[OWNER …]`, `[OWNER LEGAL NAME]`, `[DOMAIN]`, `[STORE NAME]`, `[COUNTRY]`, `[SUPPORT EMAIL]`, `[EFFECTIVE DATE]`.
   These are drafts, **not legal advice**: have a lawyer for your country check them. Polar requires these pages.
2. `src/content/about.md`: your About text (it now says "This page will be written by the owner.").
3. Commit and push these files, or ask your developer to.

---

## Step 6 — Start staging and test everything

On the server: `cd /srv/themestore/src && ./deploy/deploy.sh staging <main branch name>`. It prints
`Deployed … to staging` when the health check is green.

In Polar's **sandbox** dashboard, add the webhook endpoint `https://staging.<domain>/api/webhooks/polar` with the
events of `docs/06-payments.md` §6, and put its secret into `staging.env` (deploy again after changing the file).

Then check on `https://staging.<domain>`, logged in with your admin email:

- [ ] Create a category and a theme; upload images and a version zip; sync with Polar; publish it.
- [ ] Register a second account with email → the verification email arrives (not in spam).
- [ ] Buy with a Polar sandbox card; buy again with a 20% coupon (second account or a second theme).
- [ ] Download the zip from "My themes".
- [ ] In Polar: refund partly, then fully → the customer loses access after the full refund.
- [ ] Redeliver one webhook from the Polar dashboard → still only one order.
- [ ] Wallet (if you use it): set accounts and rate in Admin → Settings; pay as a customer from Egypt; approve one, reject one.
- [ ] Upload a new version with "notify" → the owner gets a notification and an email within about 2 minutes (after step 7).
- [ ] Google login works.
- [ ] `https://staging.<domain>/robots.txt` says `Disallow: /`.

---

## Step 7 — Cron jobs and backups

Copy the three lines of `deploy/crontab.txt` into `crontab -e` (as the `deploy` user), with your domain and the two
`CRON_SECRET` values. The next morning, check that the first backup is in the `store-backups` bucket. Once after
launch, test a restore (`docs/11-deployment.md` §6).

---

## Step 8 — Go live

1. On your computer: `git tag v1.0.0 && git push origin v1.0.0` (the version you tested on staging).
2. On the server: `./deploy/deploy.sh production v1.0.0`.
3. In Polar's **production** dashboard: webhook `https://<domain>/api/webhooks/polar`, secret into `production.env`, deploy again.
4. Repeat the most important checks of step 6 once on production with a real card and a small price, then refund it.
5. UptimeRobot shows `/api/health` green.

Updates later: `docs/11-deployment.md` §4 (staging first, then a tag to production). Rollback: deploy the previous tag.
