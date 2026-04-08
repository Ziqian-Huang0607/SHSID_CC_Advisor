# SHSID Interactive Course Catalog

An interactive course selection tool for SHSID students, designed to clarify course pathways and enable students to quickly build their 4-year academic schedule.

---

## About The Project

Navigating the SHSID course catalog can be complex, with a web of prerequisites, tracks (AP, IB, A-Level), and course dependencies. We built this tool to transform the static hard-cover catalog into a dynamic, visual map that gives more accessibility to students across campus. 

The project comes with several distinctions:
*   **The Backend**, developed by [Will Chen](https://github.com/WillUHD), is a state machine that uses a graph theory optimization approach to handles all course logic, rule validation, and state management. The latest edition of the course catalog is fetched remotely [here](https://github.com/WillUHD/CourseResources).
*   **The Frontend**, developed by [Ziqian Huang](https://github.com/Ziqian-Huang0607), is a modern wrapper that renders the state provided by the backend, ensuring the UI is always a perfect reflection of the underlying logic.

## Key Features

*   **Modern UI:** A clean, minimal interface that wraps the backend with familiar human UI design principles. 
*   **Dynamic state rendering:** Course cards visually update in real-time based on backend logic.
*   **Interactive side panel:** Click any course to open a detailed view with official descriptions and crowdsourced student notes/ratings.
*   **Real-time search:** A floating search bar instantly filters the entire course matrix by name.

## Tech stack

*   **Frontend:** [Vue 3](https://vuejs.org/) (Composition API), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/), [GSAP](https://gsap.com/)
*   **Backend (Logic Layer):** Pure TypeScript

## Run locally

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18+), `brew install node`
*   npm (comes with Node.js)

### Installation

1.  Clone the repo:
    ```sh
    git clone https://github.com/Ziqian-Huang0607/SHSID_CC_Advisor.git
    ```
2.  Navigate to the project directory:
    ```sh
    cd SHSID_CC_Advisor
    ```
3.  Install NPM packages:
    ```sh
    npm install
    ```
4.  Run the development server:
    ```sh
    npm run dev
    ```
5.  Open [http://localhost:5173](http://localhost:5173) in your browser.

## Credits

*   **Frontend:** [Ziqian Huang](https://github.com/Ziqian-Huang0607)
*   **Backend:** [Will Chen](https://github.com/WillUHD)
*   **Maintenance:** Indexademics IT Team

## Support

To report bugs, give suggestions, or contribute, please contact:
*   **Email:** `mlfusion@outlook.com`
*   **WeChat:** `IDX`

## ⚠️ Disclaimer

This is an **unofficial tool** and is not affiliated with SHSID. All course information is based on the SHSID Course Catalog and is for reference purposes only. Course availability and policies are subject to change by the school administration.

