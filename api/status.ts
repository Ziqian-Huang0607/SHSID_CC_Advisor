// api/status.ts — health check.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCatalog, ok, fail, handleOptions } from './_lib/catalog';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (handleOptions(req, res)) return;
    try {
        const catalog = await getCatalog();
        return ok(res, {
            status: 'up',
            catalogVersion: catalog.version,
            lastUpdated: catalog.lastUpdated,
            time: new Date().toISOString(),
        });
    } catch (e: any) {
        return fail(res, 502, e?.message ?? 'Unknown error');
    }
}
