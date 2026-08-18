// api/index.ts — API root: service info + endpoint directory.
import type { VercelRequest, VercelResponse } from './_lib/types';
import { getCatalog, ok, fail, handleOptions } from './_lib/catalog';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (handleOptions(req, res)) return;
    try {
        const catalog = await getCatalog();
        return ok(res, {
            service: 'SHSID CC Advisor API',
            version: catalog.version,
            lastUpdated: catalog.lastUpdated,
            docs: 'https://github.com/Ziqian-Huang0607/SHSID_CC_Advisor/blob/main/docs/API.md',
            endpoints: [
                'GET  /api              — this directory',
                'GET  /api/meta         — catalog metadata (name, version, counts)',
                'GET  /api/catalog      — full raw catalog (nested by department/grade)',
                'GET  /api/courses      — flat list of all courses; filters: ?grade=&track=&department=&q=&available=',
                'GET  /api/courses/:id  — one course by id',
                'GET  /api/grades       — list of grades',
                'GET  /api/tracks       — list of tracks',
                'GET  /api/departments  — departments with course counts',
                'GET  /api/status       — health check',
                'POST /api/validate     — validate a course plan; body: { "selected": [...ids], "moveUps": { "srcId": "targetId" } }',
                'POST /api/availability — availability state for every course given a plan; same body as /api/validate',
            ],
        });
    } catch (e: any) {
        return fail(res, 502, e?.message ?? 'Unknown error');
    }
}
