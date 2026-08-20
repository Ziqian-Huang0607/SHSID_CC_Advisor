# SHSID Interactive Course Catalog

An interactive course selection tool for SHSID students, built by SHSID students at the Indexademics and Data Science teams, designed to enable students to build their 4-year plan.

<img width="1054" height="679" alt="image" src="https://github.com/user-attachments/assets/6577cc8f-7d93-4ccc-86dd-151ccf0754a5" />

### Intuition
Navigating the SHSID course catalog can be complex, with a web of prerequisites, tracks (AP, IB, A-Level), and course dependencies. We built this tool to transform the static hard-cover catalog into a dynamic, visual map that gives more accessibility to students across campus. 

We also noticed that students often don't realize which courses are for who. Even though the course catalog offers introductions, sometimes a direct rating and comment from students are what's needed to really tell courses apart. 

- **Backend, designs, UI (by [Will Chen](https://github.com/WillUHD))**: uses a graph theory optimized / topological sorting approach for checking course configuration rules, to make sure selection roadmaps remain accurate. Remote profile fetched [here](https://github.com/WillUHD/CourseResources).
- **Frontend concepts, prototypes, maintaining (by [Ziqian Huang](https://github.com/Ziqian-Huang0607))**: a modern looking wrapper that renders the state faithfully according to the backend, ensuring the UI is a perfect reflection of the underlying logic.

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
- `GET /api/ratings` · `GET /api/ratings/:id` — crowd rating tallies
- `POST /api/ratings` — cast a student rating (1–10); one vote per voter per course

No API key, `Access-Control-Allow-Origin: *`. Full reference with examples: **[docs/API.md](./docs/API.md)**

### Tech stack & usage
- **Frontend**: [Vue 3](https://vuejs.org/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/), [GSAP](https://gsap.com/)
- **Backend**: Full TypeScript
- **Run locally**: [Node.js](https://nodejs.org/) (v20.19+ or v22.12+)
    ```sh
    git clone https://github.com/Ziqian-Huang0607/SHSID_CC_Advisor.git
    cd SHSID_CC_Advisor
    npm install
    npm run dev
    ```
    Then just open [http://localhost:5173](http://localhost:5173) in your browser.
- **Checks**: `npm test` runs the backend unit tests (solver, controller, catalog linter, plan codec, storage, ratings); `npm run verify` runs the type-check, the tests and a production build — the same three things CI gates a merge on.

### Support
- **Maintenance**: Indexademics team
- **Contact**: `mlfusion@outlook.com` / `willcxd` on WeChat for course catalog issues
- **⚠️ Disclaimer**: This is an unofficial tool that is not affiliated with SHSID. All course information is based on the SHSID Course Catalog and is for reference purposes only. Course availability and policies are subject to change by the school administration.
