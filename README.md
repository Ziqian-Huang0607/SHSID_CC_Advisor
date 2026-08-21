# SHSID Interactive Course Catalog

An interactive course selection tool for SHSID students, built by SHSID students at the Indexademics and Data Science teams, designed to enable students to build their 4-year plan.

<img width="1054" height="679" alt="image" src="https://github.com/user-attachments/assets/6577cc8f-7d93-4ccc-86dd-151ccf0754a5" />

### Intuition
Navigating the SHSID course catalog can be complex, with a web of prerequisites, tracks (AP, IB, A-Level), and course dependencies. We built this tool to transform the static hard-cover catalog into a dynamic, visual map that gives more accessibility to students across campus. 

We also noticed that students often don't realize which courses are for who. Even though the course catalog offers introductions, sometimes a direct rating and comment from students are what's needed to really tell courses apart. 

- **Backend, designs, UI (by [Will Chen](https://github.com/WillUHD))**: Remote profile fetched [here](https://github.com/WillUHD/CourseResources).
- **Frontend concepts, prototypes, maintaining, Third Party API Support (by [Ziqian Huang](https://github.com/Ziqian-Huang0607))**
- **Mobile Support, UI Enhancements (by [Ziheng Yu](https://github.com/Panther114))**
- **API for StandardCAS and Enhancements (by [Celsia](https://github.com/triadastra))**

### Use the interactive features
- Start by selecting any course and build your 4-year roadmap from there! 
- You can plan move-ups, get real course rule checking, and more to build the comprehensive profile that suits you best.
- The courses relate cross-grade, cross-subject, and cross-level, which checks all configurations along with you
- Uses a modern, clean, and minimal interface with familiar human design principles that visually update in real-time based on backend logic
- Click on any info panel to open a detailed view with crowdsourced student notes/ratings, and enter the search bar for the exact course you like. 

### Your plan sticks around
- **Saved automatically.** Your plan lives in this browser, so closing the tab or reloading doesn't cost you anything.
- **Shareable as a link.** *Export → Copy share link* (or the button in **My plan**) puts your whole plan in a URL. Anyone who opens it sees exactly what you built, prerequisites and move-ups included. Only your explicit choices travel, so an old link still works after the catalog changes — anything that no longer fits is dropped and you're told how much.
- **Undo and redo.** `Ctrl`/`Cmd`+`Z` and `Ctrl`/`Cmd`+`Shift`+`Z`, or the arrows in the header.
- **My plan panel.** Every grade at a glance, with what each course implies, jump-to-course, and one-click removal.
- **Four export formats.** PNG and PDF for a printable roadmap; CSV for a spreadsheet; JSON that carries the plan in the same shape `POST /api/validate` accepts.
- **Works offline.** The last catalog you loaded is kept on device, so a flaky connection shows yesterday's catalog with a clear warning instead of an error screen.

### Getting around
- **Filters.** Narrow the catalog by track (school / AP / IB / A-Level), or to just the courses already in your plan.
- **Search** matches course names, codes, tracks, departments and descriptions. Press `/` to jump into it, `Esc` to clear it.
- **Keyboard and screen readers.** Every course is a real focusable control that announces its name, department, grade and whether it's in your plan or blocked — and says *why* it's blocked. `Esc` backs out of whatever is open.
- **Phones.** Below `md` the department list becomes a drawer and the grade grid scrolls sideways at a readable column width, instead of squeezing four grades into a phone's width.
  
### Public API (for third-party developers)

This repo ships a free, open, CORS-enabled JSON API (Vercel serverless functions in [`api/`](./api)) that exposes the same catalog and prerequisite solver the website uses. If you're building a website, server, or script on top of our data, start here:

- `GET /api/courses` — flat JSON list of all courses (filter by `grade`, `track`, `department`, `q`, `available`)
- `GET /api/courses/:id` — one course + availability
- `GET /api/catalog` / `GET /api/meta` — full nested catalog / metadata
- `GET /api/grades` · `GET /api/tracks` · `GET /api/departments` · `GET /api/status`
- `POST /api/validate` — validate a course plan with the real solver
- `POST /api/availability` — per-course availability for any plan
- `GET /api/ratings` · `GET /api/ratings/:id` — crowd rating tallies, plus your own ballots
- `POST /api/ratings` — cast a student rating (1–10); one ballot per voter per course, changeable any time
- `GET /api/description/:id` — third-party course summary ([provider setup](docs/input.md))

No API key, `Access-Control-Allow-Origin: *`. Full reference with examples: **[docs/API.md](./docs/API.md)**

### Tech stack & usage
- **Frontend**: [Vue 3](https://vuejs.org/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/), [GSAP](https://gsap.com/)
- **Backend**: Full TypeScript, one Vercel serverless function, [Upstash Redis](https://upstash.com/) for crowd ratings
- **Run locally**: [Node.js](https://nodejs.org/) (v20.19+ or v22.12+)
    ```sh
    git clone https://github.com/Ziqian-Huang0607/SHSID_CC_Advisor.git
    cd SHSID_CC_Advisor
    npm install
    npm run dev
    ```
    Then just open [http://localhost:5173](http://localhost:5173) in your browser.
- **Checks**: `npm test` runs the backend unit tests (solver, controller, catalog linter, plan codec, storage, ratings); `npm run verify` runs the type-check, the tests and a production build — the same three things CI gates a merge on.

    `vite dev` serves the front end only. For the API, `npm run api` starts it on
    [http://localhost:8123/api](http://localhost:8123/api), and `npm run test:api`
    runs the smoke suite against an in-process copy.

## Deploying

The app deploys to [Vercel](https://vercel.com) as-is: `vercel.json` carries the
build, routing, cache, and security-header configuration, and `api/` becomes a
single serverless function. Import the repo at
[vercel.com/new](https://vercel.com/new) and deploy — no settings to fill in.

**One step matters before students use it.** Out of the box, crowd ratings are
kept in the function's memory: they are not shared between instances and they
are wiped on every cold start. Votes will appear to save and then disappear.

To make them durable:

1. Vercel dashboard → **Storage** → create an **Upstash Redis** database and
   connect it to the project. `KV_REST_API_URL` and `KV_REST_API_TOKEN` are
   injected automatically.
2. **Redeploy** — env vars are only read at cold start.
3. Confirm it took effect:

   ```sh
   curl -s https://<your-deployment>/api/status | jq '.data.checks.ratingStore'
   ```

   `"durable": true` means votes are persisted. `false` means they are not,
   whatever the UI appears to do.

Optional environment variables — the description provider, cross-origin
allowlist, and rate limits — are listed in [`.env.example`](./.env.example).

Health checks, log format, rate-limit headers, verification, and rollback are
documented in **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)**. The course
description provider contract is in **[docs/input.md](./docs/input.md)**.

### Support
- **Maintenance**: Indexademics team
- **Contact**: `mlfusion@outlook.com` / `willcxd` on WeChat for course catalog issues
- **⚠️ Disclaimer**: This is an unofficial tool that is not affiliated with SHSID. All course information is based on the SHSID Course Catalog and is for reference purposes only. Course availability and policies are subject to change by the school administration.
