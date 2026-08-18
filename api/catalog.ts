// api/catalog.ts — full raw catalog, nested by department and grade.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCatalog, ok, fail, handleOptions } from './_lib/catalog';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (handleOptions(req, res)) return;
    try {
        const catalog = await getCatalog(req.query.refresh === 'true');
        return ok(res, catalog);
    } catch (e: any) {
        return fail(res, 502, e?.message ?? 'Unknown error');
    }
}
