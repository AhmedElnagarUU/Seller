# 11 — Deployment, operations, launch checklist

How the store runs on the owner's DigitalOcean VPS (D-048), how it is updated, backed up and watched,
and the one-time setup of every outside service. Code for this is built in **T-020**.

Decisions: D-140 – D-147 (section 9).

---

## 1. Overview

```
Visitor ──HTTPS──▶ Cloudflare (DNS + proxy, adds cf-ipcountry) ──HTTPS──▶ VPS
                                                                          │
   VPS (Docker)                                                           ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │ caddy  (ports 80/443, Cloudflare Origin Certificate) ──▶ app-production :3000 │
   │                                                      └─▶ app-staging    :3001 │
   │ host crontab: notification cron (every minute, both apps), nightly backup     │
   └───────────────────────────────────────────────────────────────────────────────┘
          │                    │                       │                  │
   MongoDB Atlas         Cloudflare R2            Polar API          Resend API
   (2 databases)      (bucket pairs, 07 §9)      (webhooks in)       (emails out)
```

| Environment | URL | `APP_ENV` | Database | Polar | R2 buckets | Emails |
|---|---|---|---|---|---|---|
| production | `https://<domain>` | `production` | Atlas db `themestore` | `POLAR_SERVER=production` | `store-files`, `store-images` | Resend |
| staging | `https://staging.<domain>` | `staging` | Atlas db `themestore-staging` | `sandbox` | `staging-store-files`, `staging-store-images` | Resend (real; use your own test accounts) |
| local | `http://localhost:3000` | `local` | Docker Mongo | `fake` or sandbox | MinIO | console |

Both apps run on the **same VPS**. Staging is protected from search engines (`robots` disallow all when
`APP_ENV=staging`, built in T-020) and is for the owner only.

---

## 2. Files added by T-020

```
Dockerfile                      multi-stage: deps → build (pnpm build, .env from a BuildKit secret) → runner (Next standalone, node 22-slim, non-root user)
deploy/docker-compose.yml       services: caddy, app-production, app-staging; restart: unless-stopped; app healthcheck on /api/health
deploy/Caddyfile                two sites (domain, staging.domain) → reverse_proxy to the apps; tls with the origin certificate files
deploy/deploy.sh                ./deploy.sh <staging|production> <git tag or branch>  (section 4)
deploy/backup.sh                nightly mongodump → R2 backup bucket (section 6)
deploy/crontab.txt              the crontab lines of section 5, to copy into `crontab -e`
src/app/api/health/route.ts     GET → 200 {"ok":true} when MongoDB answers a ping within 2 s, else 503 {"ok":false}. No auth, no details. (D-144: 5th route handler)
src/instrumentation.ts          register(): on server start, ensureDatabase() (section 7)
src/shared/db/ensure-database.ts creates missing collections and syncs indexes for every Mongoose model + Better Auth's 4 collections
```

`next.config.ts` keeps reading `env.PUBLIC_IMAGES_BASE_URL`. Because Next.js bakes image settings into the build,
**each environment builds its own image on the VPS with its own `.env`** (D-141). There is no shared image registry.

---

## 3. One-time VPS setup (owner, ~30 minutes)

Ubuntu 24.04 droplet, **at least 2 GB RAM** (the Next.js build needs it; 2 vCPU recommended).

1. SSH in as root once, create a user `deploy` with sudo, copy your SSH key, then in `/etc/ssh/sshd_config` set
   `PasswordAuthentication no` and `PermitRootLogin no`; `systemctl restart ssh`.
2. Firewall: `ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable`.
3. Automatic security updates: `apt install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades`.
4. Swap (helps the build): `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`
   and add `/swapfile none swap sw 0 0` to `/etc/fstab`.
5. Docker: install Docker Engine + compose plugin from Docker's official apt repository; `usermod -aG docker deploy`.
6. Code: as `deploy`, create a **read-only deploy key** (`ssh-keygen -t ed25519`), add the public key in GitHub →
   repo → Settings → Deploy keys. `git clone git@github.com:<owner>/<repo>.git /srv/themestore/src`.
7. Env files: `/srv/themestore/production.env` and `/srv/themestore/staging.env`, each with **every** variable of
   `02-architecture.md` §10 for that environment. `chmod 600`. Never commit them.
8. Origin certificate: Cloudflare → SSL/TLS → Origin Server → Create certificate (hostnames `<domain>`,
   `*.<domain>`, 15 years). Save as `/srv/themestore/certs/origin.pem` and `origin.key` (`chmod 600`).
9. Cloudflare DNS: `A <domain> → VPS IP` and `A staging → VPS IP`, both **Proxied** (orange cloud).
   SSL/TLS mode **Full (strict)**. (Proxied is required: the `cf-ipcountry` header used at registration, D-102.)
10. Start: `cd /srv/themestore/src && ./deploy/deploy.sh staging main`, check staging, then production (section 4).
11. Crontab (section 5) and backups (section 6).

---

## 4. Deploying an update

The owner merges tested PRs into `main` (CI green, D-132), then:

```
ssh deploy@<vps>
cd /srv/themestore/src
./deploy/deploy.sh staging main            # 1. staging gets the newest main
#   → test on https://staging.<domain> (06 §9 checklist when payments changed)
git tag v1.4.0 && git push origin v1.4.0   # 2. (on your computer) tag what you tested
./deploy/deploy.sh production v1.4.0       # 3. production gets exactly that tag
```

`deploy.sh <env> <ref>` does, and stops at the first error:
1. `git fetch --tags origin && git checkout --detach <ref>`.
2. `docker compose -f deploy/docker-compose.yml build app-<env>` with the env file passed as a BuildKit secret.
3. `docker compose ... up -d --no-deps app-<env>`.
4. Waits up to 60 s for `/api/health` of that app to answer 200; prints `Deployed <ref> to <env>` or
   `Health check failed` (and exits 1).

**Rollback:** `./deploy/deploy.sh production v1.3.0` (the previous tag). Database changes are always backward
compatible (only new fields with defaults, new collections), so an older version keeps working.

Downtime during deploy is a few seconds (container restart). Accepted for the MVP (D-142).

---

## 5. Cron jobs (host crontab of `deploy`)

```
* * * * *  curl -fsS -m 55 -X POST -H "Authorization: Bearer <production CRON_SECRET>" https://<domain>/api/cron/process-notifications > /dev/null
* * * * *  curl -fsS -m 55 -X POST -H "Authorization: Bearer <staging CRON_SECRET>" https://staging.<domain>/api/cron/process-notifications > /dev/null
30 2 * * * /srv/themestore/src/deploy/backup.sh production >> /srv/themestore/backup.log 2>&1
```

---

## 6. Backups (D-143)

- **MongoDB:** nightly `backup.sh production`:
  `mongodump --uri=<MONGODB_URI> --archive --gzip` (run in the `mongo:8.0.4` image) → uploaded to the private R2
  bucket **`store-backups`** as `mongo/<YYYY-MM-DD>.archive.gz` (run with the `amazon/aws-cli` image and a separate
  R2 token limited to that bucket, env file `/srv/themestore/backup.env`).
  R2 lifecycle rule on `store-backups`: delete objects after **30 days**.
- **Restore test:** once after launch and then every 3 months: download a backup and `mongorestore` it into a
  scratch Atlas database; check that themes, orders and users are there.
- **Files:** theme zips and images live in R2 (11 nines of durability). Zips are never deleted or replaced (D-015),
  so no extra file backup in the MVP. **Keep every original zip on your own computer as well.**
- **Atlas tier:** start on **M0 (free)** or **Flex**. M0 has no Atlas backups — the nightly dump above covers it.
  Move to a paid tier when the database passes ~400 MB or traffic grows.

---

## 7. Database setup on start (fixes Q-007)

`src/instrumentation.ts` → `register()` runs once when the Node server starts (only when
`process.env.NEXT_RUNTIME === "nodejs"`). It calls `ensureDatabase()`:
1. For each of `user`, `session`, `account`, `verification`: create the collection if it does not exist.
2. For each Mongoose model: `await Model.createCollection()` then `await Model.syncIndexes()`.
3. Logs `database ready` once. Any error is logged with `console.error` and **rethrown**, so the container fails
   its health check and the deploy stops instead of running against a broken database.

Because collections exist before the first request, Better Auth never creates one inside a transaction, and the
duplicate first verification email (Q-007) cannot happen.

---

## 8. Watching the site (D-145)

| What | How | Cost |
|---|---|---|
| Is it up? | **UptimeRobot** (free): HTTPS monitor on `https://<domain>/api/health` every 5 minutes, email alert to the owner | $0 |
| Errors | `docker compose -f deploy/docker-compose.yml logs --since 24h app-production \| grep -i error`. Every unexpected error is already logged with `console.error` and a function name (02 §6.2). Docker log rotation: `max-size 20m`, `max-file 5`. | $0 |
| Failed notification jobs | Admin → Notifications shows `failed` jobs with Retry (09 §5.5) | — |
| Payments | Polar dashboard → Webhooks shows failed deliveries; our `webhookEvents` has `failed` rows | — |
| Storage / email usage | Cloudflare and Resend dashboards; set billing alerts (07 §9 step 9) | — |

An error-tracking service (Sentry or similar) is **not in the MVP** — it would add a package (02 §1). Revisit after launch.

---

## 9. Decisions added by this doc

| ID | Decision | Status |
|---|---|---|
| D-140 | Production and staging both run on the owner's VPS with Docker Compose and Caddy as reverse proxy. MongoDB is not on the VPS (Atlas, D-050). | DEFAULT |
| D-141 | Each environment builds its own Docker image **on the VPS** from a git ref, with its env file as a BuildKit secret. No image registry. | DEFAULT |
| D-142 | Deploy = `deploy.sh`, run by the owner over SSH. Staging gets `main`; production gets a tested git tag. A few seconds of downtime per deploy is accepted. | DEFAULT |
| D-143 | Backups: nightly `mongodump` to a private R2 bucket, kept 30 days; restore tested every 3 months. | DEFAULT |
| D-144 | A 5th route handler `GET /api/health` (MongoDB ping; no auth, no details) for Docker and uptime checks. | DEFAULT |
| D-145 | Monitoring in the MVP = UptimeRobot on `/api/health` + Docker logs. No error-tracking service yet. | DEFAULT |
| D-146 | Cloudflare proxies the site (orange cloud) with an Origin Certificate and SSL mode Full (strict). | DEFAULT |
| D-147 | On server start the app creates missing collections and syncs indexes (`ensureDatabase`, section 7). | DEFAULT |

---

## 10. Launch checklist (owner)

**Accounts and keys** (each value goes into `production.env`; staging uses the sandbox/test equivalents)
- [ ] Domain bought on Cloudflare (O-003); DNS + origin certificate (section 3).
- [ ] **Cloudflare R2:** buckets, custom image domain, CORS, API token (07 §9). Backup bucket + its own token (section 6).
- [ ] **MongoDB Atlas:** project, cluster, 2 databases, a database user per environment, Network Access = the VPS IP only.
- [ ] **Polar:** production organization; access token; webhook endpoint `https://<domain>/api/webhooks/polar`
      with the events in 06 §6; webhook secret. Sandbox organization for staging. Payout account and tax details done in Polar.
- [ ] **Resend:** add and verify `<domain>` (SPF, DKIM, DMARC records in Cloudflare DNS). Paid plan before the
      customer list passes ~100 (09 §6). `EMAIL_FROM` uses the verified domain.
- [ ] **Google login:** Google Cloud → OAuth consent screen (app name, support email, privacy policy URL) → OAuth client
      "Web application", redirect URIs `https://<domain>/api/auth/callback/google` and the staging one.
- [ ] `BETTER_AUTH_SECRET`, `CRON_SECRET`: 32+ random characters each (`openssl rand -base64 48`), different per environment.
- [ ] `ADMIN_EMAILS` = your email(s).

**Content**
- [ ] Legal pages filled in: Terms, Privacy, Refund policy, License (`src/content/*.md`). Polar checks they exist.
- [ ] About and Contact texts; `SUPPORT_EMAIL` is a mailbox you read.
- [ ] At least one theme: category, images, version zip, demo site, published (and synced to Polar).
- [ ] Wallet settings (if used): accounts, exchange rate, switched on.

**Final checks on staging, then once on production**
- [ ] 06 §9 payment checklist (card purchase, refund, wallet approve/reject).
- [ ] Register with email → verification email arrives (not in spam) → buy → download works.
- [ ] Google login works.
- [ ] Upload a version with "notify" → notification and email arrive within ~2 minutes.
- [ ] `/api/health` is green in UptimeRobot; first nightly backup is in `store-backups`.
- [ ] `https://staging.<domain>/robots.txt` disallows everything; production's allows the store.
