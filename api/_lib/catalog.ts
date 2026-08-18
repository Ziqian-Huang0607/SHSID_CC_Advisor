// api/_lib/catalog.ts
// Shared helpers for the SHSID CC Advisor public API.
// Loads the course catalog through the same Updater the frontend uses,
// with a short in-memory cache so repeated calls stay fast on warm lambdas.

import type { VercelRequest, VercelResponse } from './types';
import type { CourseModel, CourseNode } from './backend/CourseModel';
import { Updater } from './backend/Updater';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedModel: CourseModel | null = null;
let cachedAt = 0;

/** Load the catalog, using an in-memory cache when fresh. */
export async function getCatalog(forceRefresh = false): Promise<CourseModel> {
    if (!forceRefresh && cachedModel && Date.now() - cachedAt < CACHE_TTL_MS) {
        return cachedModel;
    }
    const model = await new Updater().initialize();
    if (!model) {
        throw new Error('Catalog unavailable: upstream fetch failed');
    }
    cachedModel = model;
    cachedAt = Date.now();
    return model;
}

/** Flatten the catalog into a single list of courses with department + grade. */
export interface FlatCourse extends CourseNode {
    department: string;
    grade: string;
}

export function flattenCourses(catalog: CourseModel): FlatCourse[] {
    const out: FlatCourse[] = [];
    const depts = catalog.departments || {};
    for (const [deptName, deptData] of Object.entries(depts)) {
        if (deptName === 'residuals' && Array.isArray(deptData)) {
            deptData.forEach((c) => out.push({ ...c, department: 'residuals', grade: 'Residual' }));
            continue;
        }
        if (typeof deptData !== 'object' || deptData === null || Array.isArray(deptData)) continue;
        for (const [grade, courses] of Object.entries(deptData)) {
            if (!Array.isArray(courses)) continue;
            courses.forEach((c) => out.push({ ...c, department: deptName, grade }));
        }
    }
    return out;
}

/** Apply permissive CORS so any third-party origin can pull the API. */
export function withCors(res: VercelResponse, methods = 'GET, OPTIONS'): VercelResponse {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res;
}

/** Standard JSON response helpers. */
export function ok(res: VercelResponse, data: unknown, cacheSeconds = 300) {
    res.setHeader('Cache-Control', `s-maxage=${cacheSeconds}, stale-while-revalidate`);
    return res.status(200).json({ ok: true, data });
}

export function fail(res: VercelResponse, status: number, message: string) {
    return res.status(status).json({ ok: false, error: message });
}

/** Handle CORS preflight; returns true if the request was fully handled. */
export function handleOptions(req: VercelRequest, res: VercelResponse, methods = 'GET, OPTIONS'): boolean {
    withCors(res, methods);
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return true;
    }
    return false;
}
