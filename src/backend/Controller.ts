// Controller.ts

import { CatalogSolver, type CourseAvailabilityState } from "./Solver";
import type { CourseModel } from "./CourseModel";
import type { CourseStatus, CourseViewModel } from "./ViewModel";

export class CourseSelectionController {
    private solver: CatalogSolver;
    private selectedIds: Set<string> = new Set();
    private moveUpOverrides: Set<string> = new Set();
    private onUpdate: (viewModels: Record<string, CourseViewModel>) => void = () => { };

    constructor(catalog: CourseModel) {
        this.solver = new CatalogSolver(catalog);

        this.solver.subscribe((internalState: Record<string, CourseAvailabilityState>) => {
            const uiState: Record<string, CourseViewModel> = {};

            this.solver.courseMap.forEach((course, id) => {
                const solverState = internalState[id];
                if (!solverState) return;

                const isSelected = this.selectedIds.has(id);
                const isBypassed = this.moveUpOverrides.has(id);

                let status: CourseStatus = 'locked';
                if (isSelected && isBypassed) status = 'bypassed';
                else if (isSelected) status = 'selected';
                else if (solverState.isAvailable) status = 'available';

                let lockReason = undefined;
                if (status === 'locked') {
                    if (solverState.conflictReason) {
                        // Triggers when a course is impossible due to backwards resolution
                        lockReason = solverState.conflictReason; 
                    } else {
                        // Display forward missing items
                        let reasons = [];
                        if (solverState.missingPre.length > 0) {
                            reasons.push(`Requires: ${solverState.missingPre.map(b => b.map(reqId => this.solver.courseMap.get(reqId)?.name || reqId).join(" or ")).join(" AND ")}`);
                        }
                        if (solverState.missingCurrent.length > 0) {
                            reasons.push(`Concurrent: ${solverState.missingCurrent.map(b => b.map(reqId => this.solver.courseMap.get(reqId)?.name || reqId).join(" or ")).join(" AND ")}`);
                        }
                        if (reasons.length > 0) lockReason = reasons.join(" | ");
                    }
                }

                uiState[id] = {
                    id: course.id,
                    name: course.name || course.id,
                    grade: course.grade || "N/A",
                    status,
                    lockReason,
                    moveUpNote: course.moveUp
                };
            });

            this.onUpdate(uiState);
        });
    }

    public connectView(callback: (viewModels: Record<string, CourseViewModel>) => void) {
        this.onUpdate = callback;
        this.solver.forceNotify(); 
    }

    public handleTap(courseId: string) {
        if (this.selectedIds.has(courseId)) {
            // Deselecting no longer invalidates or pulls down the logic chain
            this.selectedIds.delete(courseId);
            this.moveUpOverrides.delete(courseId);
        } else {
            // We only allow selection if the SAT solver determines it doesn't break the global state
            if (this.solver.isCourseAvailable(courseId)) {
                this.clearConflictingSelection(courseId);
                this.selectedIds.add(courseId);
            }
        }
        
        // Push the raw updated set to the solver, let the solver figure out the UI constraints
        this.solver.setSelected(this.selectedIds, this.moveUpOverrides);
    }

    public handleMoveUpTap(courseId: string) {
        if (this.solver.courseMap.get(courseId)?.moveUp && this.solver.canBypassCourse(courseId)) {
            this.clearConflictingSelection(courseId);
            this.moveUpOverrides.add(courseId);
            this.selectedIds.add(courseId);
            this.solver.setSelected(this.selectedIds, this.moveUpOverrides);
        }
    }

    private clearConflictingSelection(courseId: string) {
        const targetGroupId = this.solver.getConflictGroupId(courseId);
        if (!targetGroupId) return;

        for (const selectedId of [...this.selectedIds]) {
            if (selectedId === courseId) continue;
            if (this.solver.getConflictGroupId(selectedId) !== targetGroupId) continue;

            this.selectedIds.delete(selectedId);
            this.moveUpOverrides.delete(selectedId);
        }
    }
}
