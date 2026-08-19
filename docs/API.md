# SHSID CC Advisor — Public API

A free, open, CORS-enabled JSON API that exposes the same course catalog and
prerequisite solver the website uses. No API key required. Any website, server,
or script can pull from it.

**Base URL:** `https://cc.indexademics.com/api`

> Pushing this repo to GitHub auto-deploys the API to the domain above via Vercel —
> no extra configuration needed.

Every response is JSON and wrapped in a consistent envelope:

```json
// success
{ "ok": true, "data": ... }

// error
{ "ok": false, "error": "message" }
```

`GET` responses are cached at the CDN edge (~5 min). `POST` responses
(`/api/validate`, `/api/availability`) depend entirely on the request body and are
sent with `Cache-Control: no-store`. Course data updates when the upstream catalog
updates; the `version` and `lastUpdated` fields tell you which catalog version you got.

---

## Quick start

```bash
# health check
curl https://cc.indexademics.com/api/status

# every course as a flat list
curl https://cc.indexademics.com/api/courses

# only G10 CC-track courses
curl "https://cc.indexademics.com/api/courses?grade=10&track=IB"

# validate a plan
curl -X POST https://cc.indexademics.com/api/validate \
  -H "Content-Type: application/json" \
  -d '{ "selected": ["S1MATH01", "S1ENG01"] }'
```

JavaScript (browser or Node):

```js
const base = 'https://cc.indexademics.com/api';

const { data } = await fetch(`${base}/courses?grade=G10`).then(r => r.json());
// data.courses -> [{ id, name, track, department, grade, description, ... }]

const res = await fetch(`${base}/validate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ selected: ['S1MATH01'], moveUps: {} }),
}).then(r => r.json());
// res.data.valid -> true | false
```

Python:

```python
import requests
courses = requests.get(f"{BASE}/courses").json()["data"]["courses"]
```

---

## Endpoints

### `GET /api`
Service info and this endpoint directory.

### `GET /api/status`
Health check.

```json
{ "ok": true, "data": { "status": "up", "catalogVersion": "...", "lastUpdated": "...", "time": "..." } }
```

### `GET /api/meta`
Catalog metadata: name, version, lastUpdated, credit, grades, tracks, department
names, and total course count. Add `?refresh=true` to bypass the in-memory cache.

### `GET /api/catalog`
The full raw catalog, nested exactly as the source file:
`departments.<dept>.<grade> -> [courses]`, plus top-level `grades`, `tracks`,
`version`, etc. Use this if you want everything in one pull.
Supports `?refresh=true`.

### `GET /api/courses`
Flat list of every course, each tagged with its `department` and `grade`.

| Query param | Effect |
|---|---|
| `grade` | Filter by grade, e.g. `?grade=10` (grades are `9`/`10`/`11`/`12`) |
| `track` | Filter by track, e.g. `?track=IB` (tracks are `school`/`AP`/`IB`/`ASA2`) |
| `department` | Filter by department, e.g. `?department=math` |
| `q` | Case-insensitive search over id, name, description |
| `available` | `?available=true` keeps only courses selectable with an empty plan (computed with the real prerequisite solver) |

Response shape:

```json
{
  "ok": true,
  "data": {
    "count": 1,
    "courses": [
      {
        "id": "S1MATH01",
        "name": "...",
        "track": "CC",
        "department": "math",
        "grade": "G10",
        "description": "...",
        "crowdRating": 4.2,
        "crowdReview": "...",
        "level": "...",
        "rules": { "pre": [["..."]], "current": [["..."]], "next": [["..."]] },
        "moveUpTargetId": "..."
      }
    ]
  }
}
```

`rules.pre` / `rules.current` are arrays of option groups: each inner array is an
OR-list of acceptable course ids; every group must be satisfied.

### `GET /api/courses/:id`
One course by id (case-insensitive), plus its `availability` under an empty plan:

```json
{
  "ok": true,
  "data": {
    "id": "S1MATH01",
    "...": "...",
    "availability": {
      "isAvailable": false,
      "missingPre": [["S0MATH01"]],
      "missingCurrent": []
    }
  }
}
```

404 if the id doesn't exist.

### `GET /api/grades`
```json
{ "ok": true, "data": ["9", "10", "11", "12"] }
```

### `GET /api/tracks`
```json
{ "ok": true, "data": ["school", "AP", "IB", "ASA2"] }
```

### `GET /api/departments`
```json
{
  "ok": true,
  "data": [
    { "name": "math", "grades": ["G10", "G11"], "courseCount": 12 }
  ]
}
```

### `POST /api/validate`
Validate a course plan with the same solver the site uses.

**Body:**
```json
{
  "selected": ["S1MATH01", "S1ENG01"],
  "moveUps": { "S1MATH01": "S2MATH01" }
}
```
`moveUps` maps a base course id to the higher-level target the student moves up into. Both fields optional.

**Response:**
```json
{
  "ok": true,
  "data": {
    "valid": false,
    "reason": "Missing prerequisite",
    "failure": {
      "type": "missing_reference",
      "sourceCourseId": "...",
      "targetCourseId": "..."
    },
    "selectedCount": 2,
    "impliedCourses": ["S1MATH00"],
    "resolvedPlan": ["S1MATH00", "S1MATH01", "S1ENG01"]
  }
}
```
`failure` is a recursive tree — nested `causes` explain chains like dead ends,
group conflicts, cycles, and track locks.

**Important — `valid: true` does not mean `selected` is complete.** The solver
resolves a plan by pulling in whatever prerequisites the chosen courses need, so a
plan listing only a Grade 10 course validates even though its Grade 9 prerequisite
is missing from `selected`.

- `impliedCourses` — courses the plan requires but `selected` did not list.
- `resolvedPlan` — the full set of courses the plan entails (`selected` plus
  `impliedCourses`, with move-up targets substituted for their sources).

If you are building a schedule rather than just checking one, use `resolvedPlan`.
Both fields are empty when `valid` is `false`. The website itself adds
`impliedCourses` to the student's selection as soon as they pick a course.

### `POST /api/availability`
Availability of **every** course given a partial plan — perfect for building your
own interactive picker on top of our data. Same body as `/api/validate`
(send `{}` for an empty plan).

**Response:** a map from course id to
```json
{
  "isAvailable": true,
  "missingPre": [],
  "missingCurrent": [],
  "conflictReason": "..."   // only when blocked by a same-slot conflict
}
```

### `GET /api/ratings`
Crowd rating tallies for every course that has received at least one student vote.

```json
{
  "ok": true,
  "data": {
    "persistent": true,
    "scale": { "min": 1, "max": 10 },
    "ratings": [
      { "courseId": "BIO109E010", "sum": 16, "count": 2, "average": 8 }
    ]
  }
}
```

`persistent` is `false` when the deployment has no KV credentials configured; in
that mode tallies live in the function's memory and are lost on a cold start.

### `GET /api/ratings/:id`
Tallies for one course. Add `?voterId=` to also get that voter's own ballot back
(`yourVote` is `null` if they haven't voted).

```json
{
  "ok": true,
  "data": {
    "courseId": "BIO109E010",
    "baseline": 8.5,
    "aggregate": { "courseId": "BIO109E010", "sum": 16, "count": 2, "average": 8 },
    "yourVote": 9
  }
}
```

`baseline` is the catalog's own `crowdRating`. The website blends it with the
live votes as a prior worth 5 votes, so a course with two ballots doesn't swing
wildly:

```
displayed = (baseline * 5 + sum) / (5 + count)
```

### `POST /api/ratings`
Cast **one** vote. Each `voterId` may vote once per course — a repeat vote is
rejected rather than replacing or double-counting the first one.

**Body**
```json
{ "courseId": "BIO109E010", "value": 9, "voterId": "anon-token" }
```

- `value` — integer, 1 to 10.
- `voterId` — any stable, caller-generated token (the website uses an anonymous
  random id kept in `localStorage`). It is stored as a ballot key only.

**Response `200`** — the vote was recorded:
```json
{
  "ok": true,
  "data": {
    "accepted": true,
    "yourVote": 9,
    "aggregate": { "courseId": "BIO109E010", "sum": 16, "count": 2, "average": 8 },
    "baseline": 8.5
  }
}
```

**Response `409`** — this voter already rated the course. Nothing changed; the
body reports the vote that stands:
```json
{
  "ok": false,
  "error": "You have already rated this course",
  "data": { "accepted": false, "yourVote": 9, "aggregate": { "...": "..." } }
}
```

---

## CORS, rate limits, fair use

- **CORS:** all endpoints send `Access-Control-Allow-Origin: *`, so browsers can call them directly from any origin. Preflight (`OPTIONS`) responses advertise `GET, POST, OPTIONS`, so the `POST` endpoints work from the browser too.
- **Request bodies:** the `POST` endpoints accept a JSON object body. Sending `Content-Type: application/json` is recommended; a raw JSON string body is also parsed. A body that isn't a JSON object returns `400` rather than being treated as an empty plan.
- **Auth:** none. Please don't hammer it — Vercel's standard limits apply. Cache responses on your side where you can.
- **Freshness:** catalog data is mirrored from the upstream source and cached ~5 minutes; check `version`/`lastUpdated` in `/api/meta`.

## Errors

| Status | Meaning |
|---|---|
| 400 | Bad request (missing/invalid params or body) |
| 404 | Resource not found (e.g. unknown course id) |
| 405 | Wrong HTTP method |
| 409 | Duplicate vote — this `voterId` already rated this course |
| 502 | Upstream catalog fetch failed — retry shortly |

All errors use the `{ "ok": false, "error": "..." }` envelope.
