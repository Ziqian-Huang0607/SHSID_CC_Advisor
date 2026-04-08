# SHSID Course Catalog & Pathway Advisor

An interactive, modern course selection tool for SHSID students, designed to demystify course pathways and empower students to build their 4-year academic schedule with confidence.


---

## About The Project

Navigating the SHSID course catalog can be complex, with a web of prerequisites, tracks (AP, IB, A-Level), and course dependencies. This tool transforms the static PDF catalog into a dynamic, visual, and intelligent map.

It's built with a strict separation of concerns:
*   **The Backend**, developed by [Will Chen](https://github.com/WillUHD), is a powerful state machine that handles all course logic, rule validation, and state management. It fetches the latest course data from a remote `.catalog` file.
*   **The Frontend**, developed by [Ziqian Huang](https://github.com/Ziqian-Huang0607), is a "dumb" but beautiful presentation layer that renders the state provided by the backend, ensuring the UI is always a perfect reflection of the underlying logic.

## ✨ Key Features

*   **Apple-Inspired GUI:** A clean, minimal interface inspired by macOS and iPadOS, featuring heavy glassmorphism, soft shadows, and a signature blue accent.
*   **Dynamic State Rendering:** Course cards visually update in real-time based on backend logic, displaying one of four states: `Selected`, `Bypassed`, `Available`, or `Locked`.
*   **Interactive Side Panel:** Click any course to open a detailed view with official descriptions, crowdsourced student notes, and dynamic action buttons (`Add`, `Remove`, `Force Bypass`).
*   **Advanced GUI Effects:**
    *   **Glowing Cursor:** A subtle cyan spotlight follows the mouse, illuminating the frosted glass panels from behind for a stunning sense of depth.
    *   **GSAP Animations:** Numeric values and progress bars in the side panel animate with smooth, satisfying tweens.
*   **Real-time Search:** A floating search bar instantly filters the entire course matrix by name or ID.
*   **Collapsible Departments:** Keep the UI clean by collapsing department rows you're not currently exploring.
*   **Dark/Light Mode:** Seamlessly switch between themes.

## 🛠️ Built With

*   **Frontend:** [Vue 3](https://vuejs.org/) (Composition API), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/), [GSAP](https://gsap.com/)
*   **Backend (Logic Layer):** Pure TypeScript

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18+)
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

## 🤝 Credits

*   **Frontend Developer:** [Ziqian Huang](https://github.com/Ziqian-Huang0607)
*   **Backend Developer:** [Will Chen](https://github.com/WillUHD)
*   **Maintenance:** Indexademics IT Team

## 📞 Contact & Support

To report bugs, give suggestions, or contribute, please contact:
*   **Email:** `mlfusion@outlook.com`
*   **WeChat:** `IDX`

## ⚠️ Disclaimer

This is an **unofficial tool** and is not affiliated with, or endorsed by, Shanghai High School International Division (SHSID). All course information is based on the official SHSID Course Catalog and is for reference purposes only. Course availability and policies are subject to change by the school administration.