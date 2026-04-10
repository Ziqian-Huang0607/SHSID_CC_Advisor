# SHSID Interactive Course Catalog

An interactive course selection tool for SHSID students, built by SHSID students at the Indexademics and Data Science teams, designed to enable students to build their 4-year plan.

<img width="1054" height="679" alt="image" src="https://github.com/user-attachments/assets/6577cc8f-7d93-4ccc-86dd-151ccf0754a5" />

### Intuition
Navigating the SHSID course catalog can be complex, with a web of prerequisites, tracks (AP, IB, A-Level), and course dependencies. We built this tool to transform the static hard-cover catalog into a dynamic, visual map that gives more accessibility to students across campus. 

We also noticed that students often don't realize which courses are for who. Even though the course catalog offers introductions, sometimes a direct rating and comment from students are what's needed to really tell courses apart. 

- **Backend (by [Will Chen](https://github.com/WillUHD))**: uses a graph theory optimization approach to check course configuration rules, to make sure selection roadmaps remain accurate. Remote profile fetched [here](https://github.com/WillUHD/CourseResources).
- **Frontend (by [Ziqian Huang](https://github.com/Ziqian-Huang0607))**: a modern looking wrapper that renders the state faithfully according to the backend, ensuring the UI is a perfect reflection of the underlying logic.

### Use the interactive features
- Start by selecting any course and build your 4-year roadmap from there! 
- You can plan move-ups, get real course rule checking, and more to build the comprehensive profile that suits you best.
- The courses relate cross-grade, cross-subject, and cross-level, which checks all configurations along with you
- Uses a modern, clean, and minimal interface with familiar human design principles that visually update in real-time based on backend logic
- Click on any info panel to open a detailed view with crowdsourced student notes/ratings, and enter the search bar for the exact course you like. 
  
### Tech stack & usage
- **Frontend**: [Vue 3](https://vuejs.org/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/), [GSAP](https://gsap.com/)
- **Backend**: Full TypeScript
- **Run locally**: [Node.js](https://nodejs.org/) (v18+), `brew install node`
    ```sh
    git clone https://github.com/Ziqian-Huang0607/SHSID_CC_Advisor.git
    cd SHSID_CC_Advisor
    npm install
    npm run dev
    ```
    Then just open [http://localhost:5173](http://localhost:5173) in your browser.

### Support
- **Maintenance**: Indexademics team
- **Contact**: `mlfusion@outlook.com` / `willuhd` on WeChat for course catalog issues
- **⚠️ Disclaimer**: This is an unofficial tool that is not affiliated with SHSID. All course information is based on the SHSID Course Catalog and is for reference purposes only. Course availability and policies are subject to change by the school administration.
