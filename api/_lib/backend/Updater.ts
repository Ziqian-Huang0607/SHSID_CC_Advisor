// Updater.ts
// written by willuhd on Apr 6, 2026
// - Updates the course model remotely from GitHub mirror. 
// - Parses the Common Course DSL and loads JSON, using CourseModel. 

import type { CourseModel } from './CourseModel'; // Added 'type'
import { CatalogLinter } from './Linter';

export class Updater { 
    private static readonly fileName = "Courses";
    private static readonly fileExt = "catalog";
    private static readonly baseURL = "https://edgeone.gh-proxy.org/https://raw.githubusercontent.com/WillUHD/CourseResources/refs/heads/main/";

    public async initialize(): Promise<CourseModel | null> {
        const remoteUrl = `${Updater.baseURL}${Updater.fileName}.${Updater.fileExt}`;
        let lastError: unknown = null;

        try {
            // Always fetch the remote catalog directly; no local fallback or caching layer.
            const response = await fetch(remoteUrl, { cache: 'no-store' });

            if (!response.ok) {
                throw new Error(`Network response was ${response.status}`);
            }

            const remoteRaw = await response.text();
            const parsedRemote = this.parseRawData(remoteRaw);

            if (parsedRemote) {
                const lintIssues = CatalogLinter.run(parsedRemote);
                if (lintIssues.length > 0) {
                    console.warn("Updater: Catalog linter found issues:", lintIssues);
                }
                console.log("Updater: Successfully loaded version ", parsedRemote.version);
                return parsedRemote;
            }
        } catch (error) {
            lastError = error;
        }

        if (lastError) {
            console.error("Updater: Failed to fetch data:", lastError);
        }

        return null;
    }

    private parseRawData(raw: string): CourseModel | null {
        try {
            const commentRegex = /^\s*\/\/.*$/gm;
            const trailingCommaRegex = /,\s*([}\]])/g;
            const stripped = raw.replace(commentRegex, "").replace(trailingCommaRegex, "$1");

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
