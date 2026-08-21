import { describe, expect, it } from 'vitest';
import { decodePlan, encodePlan, isEmptyPlan, normalizePlan, plansEqual, type PlanSnapshot } from '../PlanCodec';

const plan: PlanSnapshot = { selected: ['MATH9', 'SCI11'], moveUps: [['MATH9', 'MATH9H']] };

describe('PlanCodec', () => {
    it('round-trips a plan through the share encoding', () => {
        expect(decodePlan(encodePlan(plan))).toEqual(normalizePlan(plan));
    });

    it('produces a URL-safe string', () => {
        expect(encodePlan(plan)).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('sorts and de-duplicates so equal plans encode identically', () => {
        const shuffled: PlanSnapshot = { selected: ['SCI11', 'MATH9', 'MATH9'], moveUps: [['MATH9', 'MATH9H']] };
        expect(encodePlan(shuffled)).toBe(encodePlan(plan));
        expect(plansEqual(shuffled, plan)).toBe(true);
    });

    it('drops move-ups that point a course at itself', () => {
        expect(normalizePlan({ selected: ['A'], moveUps: [['A', 'A']] }).moveUps).toEqual([]);
    });

    it('keeps only the first move-up declared for a source', () => {
        const normalized = normalizePlan({ selected: ['A'], moveUps: [['A', 'B'], ['A', 'C']] });
        expect(normalized.moveUps).toEqual([['A', 'B']]);
    });

    it('rejects ids that could not have come from a catalog', () => {
        expect(normalizePlan({ selected: ['ok', 'not ok', '<script>'], moveUps: [] }).selected).toEqual(['ok']);
    });

    it('returns null for a link that is not a plan rather than throwing', () => {
        expect(decodePlan('not-base64-$$$')).toBeNull();
        expect(decodePlan(btoa('v9:A|').replace(/=+$/, ''))).toBeNull();
        expect(decodePlan('')).toBeNull();
    });

    it('treats a plan with nothing in it as empty', () => {
        expect(isEmptyPlan({ selected: [], moveUps: [] })).toBe(true);
        expect(isEmptyPlan(plan)).toBe(false);
    });
});
