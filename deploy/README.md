# deploy/

Files to run the store on the VPS. The full guide is `docs/11-deployment.md`.

| File | What it is |
|---|---|
| `docker-compose.yml` | Services `caddy`, `app-production`, `app-staging`. Only Caddy publishes ports (80, 443). |
| `Caddyfile` | The two sites (`DOMAIN` and `staging.DOMAIN`) and their reverse proxy. Uses the Cloudflare origin certificate in `/srv/themestore/certs/`. |
| `deploy.sh` | `./deploy/deploy.sh <staging\|production> <git tag or branch>`: checks out the ref, builds the image, restarts the app, waits for `/api/health`. |
| `backup.sh` | `./deploy/backup.sh production`: nightly `mongodump` uploaded to the R2 backup bucket. |
| `crontab.txt` | The cron lines to copy into `crontab -e` (fill in the placeholders). |

Files that live on the server, outside the repository (never commit them):

- `/srv/themestore/production.env` and `/srv/themestore/staging.env`: the app variables (`docs/02-architecture.md` section 10).
- `/srv/themestore/deploy.env`: one line, `DOMAIN=example.com` (your real domain). Read by Caddy.
- `/srv/themestore/backup.env`: the backup bucket credentials, used only by `backup.sh`. They are not app variables:
  `R2_BACKUP_ENDPOINT`, `R2_BACKUP_ACCESS_KEY_ID`, `R2_BACKUP_SECRET_ACCESS_KEY`, `R2_BACKUP_BUCKET`.
- `/srv/themestore/certs/origin.pem` and `origin.key`: the Cloudflare origin certificate.

See `docs/11-deployment.md`.
