// api/validate.ts — validate a course plan against the real Solver.
// POST body: { "selected": ["MATH101", ...], "moveUps": { "SRC_ID": "TARGET_ID" } }
// Returns whether the plan is valid, a human-readable reason, and the structured failure tree.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CatalogSolver } from '../src/backend/Solver';
import { getCatalog, ok, fail, handleOptions } from './_lib/catalog';

export function parsePlanBody(body: any): { selected: Set<string>; moveUps: Map<string, string> } {
    const selected = new Set<string>(
        Array.isArray(body?.selected) ? body.selected.filter((x: any) => typeof x === 'string') : [],
    );
    const moveUps = new Map<string, string>(
        Object.entries(body?.moveUps ?? {}).filter(
            ([k, v]) => typeof k === 'string' && typeof v === 'string',
        ) as [string, string][],
    );
    return { selected, moveUps };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (handleOptions(req, res, 'POST, OPTIONS')) return;
    if (req.method !== 'POST') {
        return fail(res, 405, 'Use POST with a JSON body: { "selected": [...], "moveUps": { ... } }');
    }
    try {
        const catalog = await getCatalog();
        const { selected, moveUps } = parsePlanBody(req.body);
        const solver = new CatalogSolver(catalog);
        const result = solver.simulatePlanValidity(selected, moveUps);
        return ok(res, {
            valid: result.ok,
            reason: result.reason ?? null,
            failure: result.failure ?? null,
            selectedCount: selected.size,
        });
    } catch (e: any) {
        return fail(res, 502, e?.message ?? 'Unknown error');
    }
}
