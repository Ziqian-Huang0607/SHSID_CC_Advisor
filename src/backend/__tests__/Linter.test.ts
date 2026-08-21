import { describe, expect, it } from 'vitest';
import { CatalogLinter } from '../Linter';
import type { CourseModel } from '../CourseModel';
import { makeCatalog, makeCatalogWithMoveUp } from './fixture';

describe('CatalogLinter', () => {
    it('passes a well-formed catalog', () => {
        expect(CatalogLinter.run(makeCatalog())).toEqual([]);
        expect(CatalogLinter.run(makeCatalogWithMoveUp())).toEqual([]);
    });

    it('flags a rule pointing at a course that does not exist', () => {
        const catalog = makeCatalog();
        (catalog.departments as any).Math['10'][0].rules.pre = [['NOPE']];
        expect(CatalogLinter.run(catalog).join(' ')).toContain('NOPE');
    });

    it('flags a duplicate course id', () => {
        const catalog = makeCatalog();
        (catalog.departments as any).Science['11'].push({ ...(catalog.departments as any).Math['9'][0] });
        expect(CatalogLinter.run(catalog).join(' ')).toContain('Duplicate Course ID');
    });

    it('flags a move-up chain that loops', () => {
        const catalog = makeCatalogWithMoveUp();
        (catalog.departments as any).Math['9'][1].moveUpTargetId = 'MATH9';
        expect(CatalogLinter.run(catalog).join(' ')).toContain('Cyclic Move-Up Chain');
    });

    it('flags a prerequisite cycle', () => {
        const catalog = makeCatalog();
        (catalog.departments as any).Math['9'][0].rules.pre = [['MATH10']];
        expect(CatalogLinter.run(catalog).join(' ')).toContain('Cyclic Dependency');
    });

    it('reports a structural problem instead of throwing', () => {
        expect(CatalogLinter.run({ } as CourseModel)).toEqual([]);
        expect(CatalogLinter.run({ departments: { Math: 5 } } as unknown as CourseModel)).toEqual([]);
    });
});
