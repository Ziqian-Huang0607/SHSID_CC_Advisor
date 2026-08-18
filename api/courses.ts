// api/courses.ts — flat list of all courses.
// Query params (all optional, combinable):
//   ?grade=G10            filter by grade
//   ?track=CC             filter by track
//   ?department=math      filter by department
//   ?q=calculus           case-insensitive search on id/name/description
//   ?available=true       only courses selectable with an empty plan (uses the real Solver)
import type { VercelRequest, VercelResponse } from './_lib/types';
import { CatalogSolver } from '../src/backend/Solver';
import { getCatalog, flattenCourses, ok, fail, handleOptions, type FlatCourse } from './_lib/catalog';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (handleOptions(req, res)) return;
    try {
        const catalog = await getCatalog();
        let courses: FlatCourse[] = flattenCourses(catalog);

        const { grade, track, department, q, available } = req.query;

        if (typeof grade === 'string') {
            courses = courses.filter((c) => c.grade.toLowerCase() === grade.toLowerCase());
        }
        if (typeof track === 'string') {
            courses = courses.filter((c) => c.track.toLowerCase() === track.toLowerCase());
        }
        if (typeof department === 'string') {
            courses = courses.filter((c) => c.department.toLowerCase() === department.toLowerCase());
        }
        if (typeof q === 'string' && q.trim()) {
            const needle = q.trim().toLowerCase();
            courses = courses.filter((c) =>
                c.id.toLowerCase().includes(needle) ||
                (c.name ?? '').toLowerCase().includes(needle) ||
                (c.description ?? '').toLowerCase().includes(needle),
            );
        }
        if (available === 'true') {
            const solver = new CatalogSolver(catalog);
            const state = solver.evaluateGraph();
            courses = courses.filter((c) => state[c.id]?.isAvailable);
        }

        return ok(res, { count: courses.length, courses });
    } catch (e: any) {
        return fail(res, 502, e?.message ?? 'Unknown error');
    }
}
