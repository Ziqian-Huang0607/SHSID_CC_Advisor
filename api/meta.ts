// api/meta.ts — catalog metadata.
import type { VercelRequest, VercelResponse } from './_lib/types';
import { getCatalog, flattenCourses, ok, fail, handleOptions } from './_lib/catalog';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (handleOptions(req, res)) return;
    try {
        const catalog = await getCatalog(req.query.refresh === 'true');
        return ok(res, {
            catalogName: catalog.catalogName,
            version: catalog.version,
            lastUpdated: catalog.lastUpdated,
            credit: catalog.credit,
            footnote: catalog.footnote,
            grades: catalog.grades,
            tracks: catalog.tracks,
            courseCount: flattenCourses(catalog).length,
            departments: Object.keys(catalog.departments || {}),
        });
    } catch (e: any) {
        return fail(res, 502, e?.message ?? 'Unknown error');
    }
}
