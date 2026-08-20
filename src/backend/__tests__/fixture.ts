// A hand-built catalog, small enough to reason about in a test and shaped like the
// real one: a prerequisite chain, an either/or requirement, a cross-department
// concurrent rule, a move-up chain and a `next` track lock.

import type { CourseModel } from '../CourseModel';

export function makeCatalog(): CourseModel {
    return {
        catalogName: 'Test Catalog',
        version: 'v0-test',
        lastUpdated: '2026-01-01',
        credit: 'tests',
        footnote: '',
        grades: ['9', '10', '11'],
        tracks: ['school', 'AP'],
        departments: {
            Math: {
                '9': [
                    course('MATH9', 'Math 9', { next: [['MATH10', 'MATH10AP']] }),
                    course('MATH9H', 'Math 9 Honors', { next: [['MATH10', 'MATH10AP']] })
                ],
                '10': [
                    course('MATH10', 'Math 10', { pre: [['MATH9', 'MATH9H']] }),
                    course('MATH10AP', 'AP Math 10', { pre: [['MATH9H']] }, { track: 'AP' })
                ],
                '11': [
                    // Needs a grade-10 maths course and a science running alongside it.
                    course('MATH11', 'Math 11', { pre: [['MATH10', 'MATH10AP']], current: [['SCI11']] })
                ]
            },
            Science: {
                '11': [course('SCI11', 'Science 11', {})]
            },
            residuals: [course('EXTRA', 'Extra Credit', {})]
        }
    } as unknown as CourseModel;
}

/** Same catalog, with MATH9 declaring MATH9H as its move-up target. */
export function makeCatalogWithMoveUp(): CourseModel {
    const catalog = makeCatalog();
    const math9 = (catalog.departments as any).Math['9'][0];
    math9.moveUp = 'Move up to Honors';
    math9.moveUpTargetId = 'MATH9H';
    return catalog;
}

function course(id: string, name: string, rules: Record<string, string[][]>, extra: Record<string, unknown> = {}) {
    return {
        id,
        name,
        track: 'school',
        level: 'S',
        description: `${name} description`,
        crowdRating: 0,
        crowdReview: '',
        rules,
        ...extra
    };
}
