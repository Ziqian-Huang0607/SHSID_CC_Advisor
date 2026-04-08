// Updater.ts
// written by willuhd on Apr 6, 2026
// - Updates the course model remotely from GitHub mirror. 
// - Parses the Common Course DSL and loads JSON, using CourseModel. 

import type { CourseModel } from './CourseModel'; // Added 'type'

export class Updater { // <--- ADDED 'export' HERE
    private static readonly fileName = "Courses";
    private static readonly fileExt = "catalog";
    private static readonly baseURL = "https://edgeone.gh-proxy.org/https://raw.githubusercontent.com/WillUHD/CourseResources/refs/heads/main/";

    public async initialize(): Promise<CourseModel | null> {
        const fullUrl = `${Updater.baseURL}${Updater.fileName}.${Updater.fileExt}`;

        try {
            // not storing because client is connected to the internet anyway. 
            // proper excuse is conflicts with local build pipeline. will impact startup by a bit.
            const response = await fetch(fullUrl, { cache: 'no-store' });

            if (!response.ok) {
                throw new Error(`Network response was ${response.status}`);
            }

            const remoteRaw = await response.text();
            const parsedRemote = this.parseRawData(remoteRaw);

            if (parsedRemote) {
                console.log("Updater: Successfully loaded version ", parsedRemote.version);
                return parsedRemote;
            }
        } catch (error) {
            console.error("Updater: Failed to fetch data:", error);
        }

        return null;
    }

    private parseRawData(raw: string): CourseModel | null {
        try {
            const commentRegex = /^\s*\/\/.*$/gm;
            const stripped = raw.replace(commentRegex, "");

            return JSON.parse(stripped) as CourseModel;
        } catch (e) {
            console.error("Updater: Error parsing data", e);
            return null;
        }
    }
}

// API test on Updater
// for backend development only
// 
// async function test() {
//     const updater = new Updater();
//     const catalog = await updater.initialize();
//
//     if (!catalog) {
//         console.error("No catalog available.");
//         return;
//     }
//
//     console.log("DEBUGGG: The " + catalog.catalogName + ", which is on version " + catalog.version + ", was last updated on " + catalog.lastUpdated + ". Kudos " + catalog.credit + "! ");
//     console.log(catalog)
// }
//
// test();
