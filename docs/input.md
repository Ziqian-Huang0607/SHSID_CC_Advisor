# Wiring up the course description provider

`GET /api/description/:courseId` returns a readable summary of a course. This
repo does not write that summary — it calls a service you point it at, caches
what comes back, and normalises the shape so the front end only ever sees one
format.

This document is the contract. Anything that speaks it can be the provider: an
LLM wrapper, an internal summariser, a Google Apps Script, a static lookup
table behind a function.

---

## 1. Configure

Set these on the deployment (Vercel → Settings → Environment Variables):

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `DESCRIPTION_API_URL` | yes | — | The endpoint we POST to. Absent = feature off, the API falls back to the catalog's own text. |
| `DESCRIPTION_API_KEY` | no | — | Credential. Sent as `Authorization: Bearer <key>`. |
| `DESCRIPTION_API_AUTH_HEADER` | no | `Authorization` | Send the key in a different header instead. Any name other than `Authorization` gets the raw key with no `Bearer ` prefix. |
| `DESCRIPTION_API_TIMEOUT_MS` | no | `8000` | Per-request deadline. A provider slower than this is treated as down. |
| `DESCRIPTION_CACHE_TTL_S` | no | `604800` (7 days) | How long a generated summary is reused before we call you again. |

Caching uses the same KV store as the ratings (`KV_REST_API_URL` /
`KV_REST_API_TOKEN`). Without KV the cache is per-instance and in-memory, so a
cold start re-asks the provider.

## 2. What we send you

One `POST`, `Content-Type: application/json`, one course per request:

```json
{
  "version": 1,
  "courseId": "BIO109E010",
  "name": "Biology 9 Standard",
  "department": "Biology",
  "grade": "9",
  "track": "school",
  "level": "S",
  "catalogDescription": "The catalog's own blurb, may be empty.",
  "catalogReview": "The catalog's crowd review line, may be empty.",
  "catalogRating": 7.5,
  "prerequisites": [["BIO108E010"], ["CHE108E010", "CHE108AP010"]],
  "corequisites": [],
  "catalogVersion": "v0.3-experimental (revision 14 - last prerelease)",
  "locale": "en"
}
```

Notes:

- `prerequisites` and `corequisites` are **DNF**: the outer array is AND, each
  inner array is OR. The example above means "BIO108E010, **and** either
  CHE108E010 or CHE108AP010".
- `version` is the contract version. It stays `1` until this document changes
  in a way that would break an existing provider.
- `locale` comes from `?locale=` on the request, defaulting to `en`.
- Fields can be empty strings. `catalogDescription` in particular is a
  placeholder for a good number of courses right now.

## 3. What you send back

`200` with JSON. Only `summary` is required:

```json
{
  "summary": "A first-year lab science that assumes no prior biology...",
  "highlights": ["Weekly lab writeups", "No prerequisites"],
  "workload": "4-6 hrs/week",
  "bestFor": "Students planning to take AP Biology in G11",
  "difficulty": "Moderate",
  "model": "your-model-name"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `summary` | string | **Required.** Empty or missing = we treat the call as failed. |
| `highlights` | string[] | Trimmed to 8 items. |
| `workload` | string | Free text. |
| `bestFor` | string | Free text. |
| `difficulty` | string | Free text; a number is accepted and stringified. |
| `model` | string | Passed through so you can tell later which generation produced a cached entry. |

The reader is deliberately forgiving, so an existing service usually needs no
adapter:

- The payload may be wrapped in `{ "data": ... }` or `{ "result": ... }`.
- `summary` may instead be called `text`, `content`, or `description`.
- `highlights` may instead be called `bullets` or `points`.
- `bestFor` may instead be called `best_for` or `audience`.
- A bare JSON string, or a plain-text (non-JSON) body, is read as the summary.

## 4. What the front end receives

```json
{
  "ok": true,
  "data": {
    "courseId": "BIO109E010",
    "name": "Biology 9 Standard",
    "summary": "...",
    "highlights": ["..."],
    "workload": "...",
    "bestFor": "...",
    "difficulty": "...",
    "provider": "your-host.example.com",
    "model": "your-model-name",
    "generatedAt": "2026-08-20T06:33:34.479Z",
    "fallback": false,
    "cached": false,
    "provider_configured": true
  }
}
```

- `fallback: true` means this is the catalog's own text, not your summary —
  either nothing is configured, or the call failed.
- `providerError` is present only when a configured provider failed; it carries
  the reason. The request still returns `200` with fallback content, because a
  provider outage should not blank the course panel.
- `cached: true` means it was served from KV without calling you.
- `?refresh=1` skips the cache and re-asks you. `?locale=zh` changes the
  `locale` we send.

Errors that are ours, not yours: `400` (no course id), `404` (unknown course
id), `405` (anything other than GET).

## 5. Check it end to end

```bash
curl -s https://<your-deployment>/api/description/BIO109E010 | jq '.data | {provider, fallback, cached, summary}'
```

Expected on a correct wiring: `fallback: false`, `provider` set to your host,
and `cached` flipping to `true` on the second call.

If `provider_configured` is `false`, `DESCRIPTION_API_URL` did not reach the
running function — the usual cause is setting it for Preview but not
Production, or not redeploying after adding it.
