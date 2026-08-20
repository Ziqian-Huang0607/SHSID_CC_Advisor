import { beforeEach, describe, expect, it } from 'vitest';
import { CourseSelectionController } from '../Controller';
import type { CourseViewModel } from '../ViewModel';
import { makeCatalog, makeCatalogWithMoveUp } from './fixture';

function connect(controller: CourseSelectionController) {
    const state: { current: Record<string, CourseViewModel> } = { current: {} };
    controller.connectView(view => { state.current = view; });
    return state;
}

describe('CourseSelectionController', () => {
    let controller: CourseSelectionController;
    let state: { current: Record<string, CourseViewModel> };

    beforeEach(() => {
        controller = new CourseSelectionController(makeCatalog());
        state = connect(controller);
    });

    it('pulls the prerequisites a choice implies into the plan', () => {
        controller.handleTap('MATH11');
        // MATH11 needs a grade-10 maths course and SCI11 running alongside it.
        expect(controller.getPlanIds()).toContain('SCI11');
        expect(controller.getPlanIds()).toContain('MATH11');
        expect(controller.getPlanIds().some(id => id === 'MATH10' || id === 'MATH10AP')).toBe(true);
        // ...but only MATH11 was actually chosen.
        expect(controller.getSelectedIds()).toEqual(['MATH11']);
    });

    it('drops the support a course carried when that course leaves', () => {
        controller.handleTap('MATH11');
        controller.handleTap('MATH11');
        expect(controller.getPlanIds()).toEqual([]);
    });

    it('lets only one course occupy a department-year slot', () => {
        controller.handleTap('MATH9');
        controller.handleTap('MATH9H');
        expect(controller.getSelectedIds()).toEqual(['MATH9H']);
    });

    it('reports a reason for a course the plan cannot reach', () => {
        expect(state.current['MATH11']?.status).toBe('available');
        controller.handleTap('MATH9');
        // MATH9 forbids AP Math 10, and AP Math 10 needs MATH9H.
        expect(state.current['MATH10AP']?.status).toBe('locked');
        expect(state.current['MATH10AP']?.lockReason).toBeTruthy();
    });

    describe('snapshots', () => {
        it('round-trips a plan', () => {
            controller.handleTap('MATH11');
            const snapshot = controller.getPlanSnapshot();

            const restored = new CourseSelectionController(makeCatalog());
            connect(restored);
            expect(restored.restorePlan(snapshot).dropped).toEqual([]);
            expect(restored.getPlanIds()).toEqual(controller.getPlanIds());
        });

        it('records only the explicit choices, not the implied ones', () => {
            controller.handleTap('MATH11');
            expect(controller.getPlanSnapshot().selected).toEqual(['MATH11']);
        });

        it('drops courses a shared plan names that this catalog does not have', () => {
            const { dropped } = controller.restorePlan({ selected: ['MATH9', 'GONE'], moveUps: [] });
            expect(dropped).toEqual(['GONE']);
            expect(controller.getSelectedIds()).toEqual(['MATH9']);
        });

        it('refuses a move-up the catalog never declared', () => {
            const { dropped } = controller.restorePlan({ selected: ['MATH9'], moveUps: [['MATH9', 'MATH9H']] });
            expect(dropped).toEqual(['MATH9H']);
            expect(controller.getPlanSnapshot().moveUps).toEqual([]);
        });

        it('empties the plan on request', () => {
            controller.handleTap('MATH11');
            controller.clearPlan();
            expect(controller.getPlanIds()).toEqual([]);
            expect(controller.getPlanSnapshot()).toEqual({ selected: [], moveUps: [] });
        });
    });

    describe('move-ups', () => {
        beforeEach(() => {
            controller = new CourseSelectionController(makeCatalogWithMoveUp());
            state = connect(controller);
        });

        it('applies a declared move-up and restores it from a snapshot', () => {
            controller.handleTap('MATH9');
            expect(controller.setExplicitMoveUp('MATH9', 'MATH9H')).toBe(true);
            expect(state.current['MATH9H']?.isMoveUpTarget).toBe(true);

            const snapshot = controller.getPlanSnapshot();
            expect(snapshot.moveUps).toEqual([['MATH9', 'MATH9H']]);

            const restored = new CourseSelectionController(makeCatalogWithMoveUp());
            connect(restored);
            expect(restored.restorePlan(snapshot).dropped).toEqual([]);
            expect(restored.getPlanSnapshot().moveUps).toEqual([['MATH9', 'MATH9H']]);
        });

        it('refuses a target that is not on the declared chain', () => {
            controller.handleTap('MATH9');
            expect(controller.setExplicitMoveUp('MATH9', 'MATH10')).toBe(false);
            expect(controller.setExplicitMoveUp('MATH9', 'MATH9')).toBe(false);
            expect(controller.getPlanSnapshot().moveUps).toEqual([]);
        });

        it('refuses a move-up from a course that is not in the plan', () => {
            expect(controller.setExplicitMoveUp('MATH9', 'MATH9H')).toBe(false);
        });

        it('cancels a move-up back to the source course', () => {
            controller.handleTap('MATH9');
            controller.setExplicitMoveUp('MATH9', 'MATH9H');
            controller.removeExplicitMoveUp('MATH9');
            expect(controller.getPlanSnapshot().moveUps).toEqual([]);
            expect(controller.getPlanIds()).toContain('MATH9');
        });
    });
});
