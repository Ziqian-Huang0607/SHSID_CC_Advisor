// api/departments.ts — departments with grade breakdown and course counts.
import type { VercelRequest, VercelResponse } from './_lib/types';
import { getCatalog, ok, fail, handleOptions } from './_lib/catalog';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (handleOptions(req, res)) return;
    try {
        const catalog = await getCatalog();
        const depts = catalog.departments || {};
        const summary = Object.entries(depts).map(([name, data]: [string, any]) => {
            if (name === 'residuals' && Array.isArray(data)) {
                return { name, grades: ['Residual'], courseCount: data.length };
            }
            const grades = Object.keys(data || {});
            const courseCount = grades.reduce((n, g) => n + (Array.isArray(data[g]) ? data[g].length : 0), 0);
            return { name, grades, courseCount };
        });
        return ok(res, summary);
    } catch (e: any) {
        return fail(res, 502, e?.message ?? 'Unknown error');
    }
}
