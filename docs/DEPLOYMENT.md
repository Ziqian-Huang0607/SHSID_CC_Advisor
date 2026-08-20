# Deployment and operations

The site is a static Vite build plus one Vercel serverless function
(`api/[[...path]].ts`) that serves the whole JSON API. `vercel.json` holds the
build, routing, caching, and security-header configuration.

Everything below is optional in the sense that the app boots without it. What
you lose by skipping a step is stated each time, because the failure modes are
quiet: votes that vanish, summaries that never generate.

---

## 1. First deploy

1. Import the repository at [vercel.com/new](https://vercel.com/new). The
   framework preset, build command, and output directory are read from
   `vercel.json`; leave them alone.
2. Deploy. You now have a working site with an in-memory rating store.
3. Set up persistence before telling anyone to use it — see the next section.

Local development stays the same:

```bash
npm ci
npm run dev        # http://localhost:5173
```

`vite dev` serves the front end only. To exercise the API locally, either run
`vercel dev` (needs the Vercel CLI) or use the built-in harness:

```bash
npm run api        # http://localhost:8123/api
npm run test:api   # the smoke suite, against an in-process harness
```

## 2. Rating storage (required for real use)

Without a KV store, votes are held in a `Map` inside one serverless instance.
They are not shared between instances and they are erased on every cold start —
which on a low-traffic project means minutes. Students will cast votes that
silently disappear.

1. Vercel dashboard → **Storage** → **Create Database** → **Upstash Redis**.
2. Connect it to the project. Vercel injects `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` for you.
3. **Redeploy.** Environment variables are read at cold start; an already-running
   deployment will not pick them up.
4. Verify:

```bash
curl -s https://<your-deployment>/api/status | jq '.data.checks.ratingStore'
```

`{"ok": true, "configured": true, "durable": true}` means votes are persisted.
`durable: false` means they are not, whatever the site appears to do.

The free tier is far more than a school needs: one vote is two Redis commands,
and reads are served from tallies rather than recomputed.

### What lives in the store

| Key | Purpose |
| --- | --- |
| `ratevote:<course>:<voter>` | One voter's ballot for one course. |
| `ratetally:<course>` | `sum` and `count` for a course. |
| `ratecourses` | Set of course ids that have any votes. |
| `ratedesc:v1:<course>` | Cached third-party summary, 7-day TTL. |
| `ratelimit:<bucket>:<window>:<subject>` | Rate-limit counters, self-expiring. |

Nothing here identifies a student. A voter token is a random id tied to a
browser profile, never to a name, an email, or an IP.

## 3. Course descriptions (optional)

`GET /api/description/:courseId` calls a third-party summariser you supply.
Set `DESCRIPTION_API_URL` (plus `DESCRIPTION_API_KEY` if it needs one) and
redeploy. The full request/response contract is in
[`input.md`](./input.md).

Unconfigured, the endpoint still answers `200` with the catalog's own text and
`fallback: true`, so wiring it up later changes nothing structurally.

## 4. Cross-origin access (optional)

The API is deliberately open: any site may read it anonymously. Sending the
*voter cookie* cross-origin is different, and is restricted to an allowlist —
otherwise any page on the web could read a student's ballots using their own
cookie.

Set `ALLOWED_ORIGINS` to a comma-separated list of origins that should be able
to make credentialed calls:

```
ALLOWED_ORIGINS=https://courses.example.edu,https://www.courses.example.edu
```

The project's own Vercel URL is always trusted, so a same-origin front end
needs nothing here. `localhost` is trusted outside production.

## 5. Environment variables

Copy `.env.example` to `.env.local` for local work, or paste the values into
Vercel → Settings → Environment Variables. All are optional.

| Variable | Default | Effect if unset |
| --- | --- | --- |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | — | Votes live in memory and are lost on cold start. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | — | Alternative names for the same thing. |
| `DESCRIPTION_API_URL` | — | `/api/description/:id` serves catalog text. |
| `DESCRIPTION_API_KEY` | — | No credential is sent. |
| `DESCRIPTION_API_AUTH_HEADER` | `Authorization` | Key is sent as `Bearer <key>`. |
| `DESCRIPTION_API_TIMEOUT_MS` | `8000` | Provider deadline. |
| `DESCRIPTION_CACHE_TTL_S` | `604800` | Summaries are cached 7 days. |
| `ALLOWED_ORIGINS` | — | Only the project's own origin may send the cookie. |
| `RATE_LIMIT_VOTES` | `60` | 60 rating writes per voter per 10 minutes. |
| `RATE_LIMIT_DESCRIPTIONS` | `60` | 60 uncached summary requests per 10 minutes. |
| `MAX_BODY_BYTES` | `16384` | Larger request bodies are rejected with `413`. |

Rate limits are counted in KV so they hold across instances. Without KV they
are per-instance and will not stop a determined script.

## 6. Monitoring

**Health.** `/api/ping` answers if the function is running at all. `/api/status`
is the readiness probe: it checks the upstream catalog and the rating store and
returns `503` when either is down, so it can be pointed at an uptime monitor
directly.

```bash
curl -s https://<your-deployment>/api/status | jq '.data.status, .data.checks'
```

**Logs.** Every request emits one JSON line to the function log — request id,
method, route, status, duration, and whether KV was live. Filter on
`"level":"error"` for failures. Request bodies and voter tokens are never
logged: a log that records who voted what would defeat anonymous ballots.

Every response carries `X-Request-Id`. When someone reports a problem, that id
is the fastest way to the exact invocation.

**Rate limits.** Metered responses carry `RateLimit-Limit`,
`RateLimit-Remaining`, and `RateLimit-Reset`; a `429` adds `Retry-After`.

## 7. Verifying a deployment

Run the smoke suite against the real thing:

```bash
npm run test:api -- https://<your-deployment>
```

It casts a vote from a throwaway browser token, changes it, checks the count
does not move, confirms a forged token cannot mint a second ballot, and reports
whether the store is durable. It moves one course's tally by one student, which
is the smallest honest end-to-end test; run it against a preview deployment if
you would rather not touch production tallies.

## 8. Rolling back

Vercel keeps every deployment. Dashboard → Deployments → the last good one →
**Promote to Production**. The API is stateless, so a rollback is instant and
safe; nothing in KV is versioned against the code.

The one exception is the summary cache. If a bad provider response got cached,
clear it per course with `?refresh=1`, or delete the `ratedesc:v1:*` keys.
