// Updater.ts
// written by willuhd on Apr 6, 2026
// - Updates the course model remotely from GitHub mirror.
// - Parses the Common Course DSL and loads JSON, using CourseModel.
// - Keeps the last good catalog in local storage so a proxy outage degrades to
//   "yesterday's catalog, clearly labelled" instead of a dead screen.

import type { CourseModel } from './CourseModel'; // Added 'type'
import { CatalogLinter } from './Linter';

export type CatalogSource = 'network' | 'cache';

export interface CatalogLoadResult {
    catalog: CourseModel;
    source: CatalogSource;
    /** When the cached copy was written. Only set for `source: 'cache'`. */
    cachedAt?: string;
    /** Why the network copy could not be used, when we fell back to the cache. */
    fallbackReason?: string;
}

interface CachedCatalog {
    savedAt: string;
    catalog: CourseModel;
}

const CACHE_KEY = 'shsid-cc.catalogCache.v1';

export class Updater {
    private static readonly fileName = "Courses";
    private static readonly fileExt = "catalog";
    private static readonly baseURL = "https://edgeone.gh-proxy.org/https://raw.githubusercontent.com/WillUHD/CourseResources/refs/heads/main/";
    private static readonly timeoutMs = 15000;
    private static readonly attempts = 2;

    /**
     * Fetches the catalog, preferring the network and falling back to the last
     * good copy on disk. Returns null only when neither is available.
     */
    public async load(): Promise<CatalogLoadResult | null> {
        const remoteUrl = `${Updater.baseURL}${Updater.fileName}.${Updater.fileExt}`;
        let lastError: unknown = null;

        // A flaky proxy usually fails once and succeeds on the retry, which is far
        // cheaper for the student than a full error screen.
        for (let attempt = 1; attempt <= Updater.attempts; attempt++) {
            // Without a deadline a stalled proxy leaves the UI on a permanently blank screen,
            // because the caller never gets a resolution either way.
            const abort = new AbortController();
            const timer = setTimeout(() => abort.abort(), Updater.timeoutMs);

            try {
                const response = await fetch(remoteUrl, { cache: 'no-store', signal: abort.signal });

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
                    this.writeCache(parsedRemote);
                    return { catalog: parsedRemote, source: 'network' };
                }

                // A parse failure is deterministic; retrying the same bytes cannot help.
                lastError = new Error('The catalog file could not be parsed.');
                break;
            } catch (error) {
                lastError = error;
            } finally {
                clearTimeout(timer);
            }
        }

        if (lastError) {
            console.error("Updater: Failed to fetch data:", lastError);
        }

        const cached = this.readCache();
        if (cached) {
            console.warn("Updater: Serving the cached catalog from", cached.savedAt);
            return {
                catalog: cached.catalog,
                source: 'cache',
                cachedAt: cached.savedAt,
                fallbackReason: lastError instanceof Error ? lastError.message : 'The catalog could not be reached.'
            };
        }

        return null;
    }

    /** Back-compat wrapper for callers that only want the model. */
    public async initialize(): Promise<CourseModel | null> {
        return (await this.load())?.catalog ?? null;
    }

    private parseRawData(raw: string): CourseModel | null {
        try {
            const commentRegex = /^\s*\/\/.*$/gm;
            const trailingCommaRegex = /,\s*([}\]])/g;
            const stripped = raw.replace(commentRegex, "").replace(trailingCommaRegex, "$1");

            const parsed = JSON.parse(stripped) as CourseModel;
            // A 200 from a proxy is not proof it served a catalog; an error page that
            // happens to be valid JSON would otherwise be cached as the catalog.
            if (!parsed || typeof parsed !== 'object' || !parsed.departments || !Array.isArray(parsed.grades)) {
                console.error("Updater: Parsed data is not a course catalog.");
                return null;
            }
            return parsed;
        } catch (e) {
            console.error("Updater: Error parsing data", e);
            return null;
        }
    }

    private writeCache(catalog: CourseModel) {
        try {
            const record: CachedCatalog = { savedAt: new Date().toISOString(), catalog };
            window.localStorage.setItem(CACHE_KEY, JSON.stringify(record));
        } catch {
            /* private mode or quota — the network copy is still what we returned */
        }
    }

    private readCache(): CachedCatalog | null {
        try {
            const raw = window.localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const record = JSON.parse(raw) as CachedCatalog;
            if (!record?.catalog?.departments) return null;
            return record;
        } catch {
            return null;
        }
    }
}
