// api/availability.ts — availability state for every course, given a plan.
// POST body: { "selected": [...ids], "moveUps": { "src": "target" } }  (both optional)
// Returns: { "COURSE_ID": { isAvailable, missingPre, missingCurrent, conflictReason? }, ... }
import type { VercelRequest, VercelResponse } from './_lib/types';
import { CatalogSolver } from './_lib/backend/Solver';
import { getCatalog, ok, fail, handleOptions } from './_lib/catalog';
import { parsePlanBody } from './validate';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (handleOptions(req, res, 'POST, OPTIONS')) return;
    if (req.method !== 'POST') {
        return fail(res, 405, 'Use POST with a JSON body: { "selected": [...], "moveUps": { ... } }');
    }
    try {
        const catalog = await getCatalog();
        const { selected, moveUps } = parsePlanBody(req.body);
        const solver = new CatalogSolver(catalog);
        solver.setSelected(selected, moveUps);
        const state = solver.evaluateGraph();
        return ok(res, state);
    } catch (e: any) {
        return fail(res, 502, e?.message ?? 'Unknown error');
    }
}
