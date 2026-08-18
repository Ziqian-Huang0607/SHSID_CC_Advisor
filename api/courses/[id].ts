// api/courses/[id].ts — one course by id, plus its availability under an empty plan.
import type { VercelRequest, VercelResponse } from '../_lib/types';
import { CatalogSolver } from '../_lib/backend/Solver';
import { getCatalog, flattenCourses, ok, fail, handleOptions } from '../_lib/catalog';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (handleOptions(req, res)) return;
    try {
        const id = req.query.id;
        if (typeof id !== 'string' || !id) {
            return fail(res, 400, 'Missing course id');
        }
        const catalog = await getCatalog();
        const course = flattenCourses(catalog).find(
            (c) => c.id.toLowerCase() === id.toLowerCase(),
        );
        if (!course) {
            return fail(res, 404, `Course not found: ${id}`);
        }

        const solver = new CatalogSolver(catalog);
        const state = solver.evaluateGraph();
        const availability = state[course.id] ?? null;

        return ok(res, { ...course, availability });
    } catch (e: any) {
        return fail(res, 502, e?.message ?? 'Unknown error');
    }
}
