# Running the live event on Vercel

GitHub Pages runs the **demo** (everything stays in one browser). For the real event every
player must share one scoreboard, so deploy the same repo to **Vercel** with a small Redis
database. This takes about 10 minutes and fits in the free plans.

## 1. Import the repo into Vercel

1. Go to <https://vercel.com/new> and sign in with GitHub.
2. Find the repository and click **Import**.
3. Leave **Framework Preset** as detected (Vite or Other). The repo's `vercel.json` already sets:
   - Build Command: `npm run build:vercel` (bundles the API, then builds with `VITE_BACKEND=remote BASE_PATH=/`)
   - Output Directory: `dist`
4. Don't deploy yet if it offers. If it already deployed, that's fine: the first deploy will show
   "Server not configured" until the next steps are done.

## 2. Add the database: Storage → Upstash for Redis

1. Open the project in Vercel → **Storage** tab → **Create Database** (or **Browse Marketplace**).
2. Choose **Upstash for Redis** → **Continue**.
3. Plan: **Free**. Primary region: **Washington, D.C., USA (iad1)**, the same region as the
   functions (`vercel.json` pins them to `iad1`).
4. Name it (e.g. `doomsday-cypher`) → **Create**.
5. On the next screen, connect it to this project for **Production** and **Preview** → **Connect**.

Vercel adds the credentials as environment variables. Their names vary (`KV_REST_API_URL`,
`UPSTASH_REDIS_REST_URL`, `REDIS_URL`, …). The server accepts any of them: anything ending in
`REST_API_URL` / `REST_API_TOKEN`, an `https://…upstash.io` URL with a matching `_TOKEN`, or a
`rediss://default:<token>@<host>` URL. Read-only tokens are ignored.

## 3. Add your secrets

Project → **Settings** → **Environment Variables**. Add each for **Production** (and Preview if you use it):

| Name | Value |
|---|---|
| `SESSION_SECRET` | A long random string, at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Changing it logs everyone out. |
| `ADMIN_PASSWORD` | The first Command password (log in as `admin`). You must change it on first login. |
| `SEED` | *Optional.* `demo` to start with the demo event instead of an empty one. Leave it unset for the real event. |

The database is created on the **first request** after deploy. `ADMIN_PASSWORD` only matters
then; changing it later does nothing (use Command → Settings or a backup instead).

## 4. Redeploy

1. **Deployments** tab → the latest deployment → **⋯** → **Redeploy** (environment variables
   only apply to new deployments).
2. Open the site, go to **Log in → Command**, sign in as `admin` with `ADMIN_PASSWORD`, and set
   your own password.

**Always share the main `*.vercel.app` domain** (or your custom domain), shown under
**Settings → Domains**. Each deployment also has its own URL
(`doomsday-cypher-abc123-team.vercel.app`) which keeps the settings it was built with forever:
players on an old deployment URL won't get fixes.

## Troubleshooting

- **"No Upstash Redis credentials found … variables seen: …"**: the database isn't connected to
  this project/environment. Connect it (step 2.5) and redeploy. The message lists the
  database-looking variable names the server did see.
- **"Server not configured: set SESSION_SECRET"** or **"… set ADMIN_PASSWORD"**: add the
  variable (step 3) and redeploy.
- **Start over**: Command → Settings → **Start fresh** (shows a new admin password once), or
  delete the `doomsday:db` and `doomsday:meta` keys in the Upstash console.
- **Usage**: each open tab polls every 3 s (15 s when hidden). The server answers `204` from a
  tiny meta key when nothing changed, so 60 players for 3 hours stays well inside free limits.
