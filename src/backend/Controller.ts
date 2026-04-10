// Controller.ts

import { CatalogSolver, type CourseAvailabilityState } from "./Solver";
import type { CourseModel } from "./CourseModel";
import type { CourseStatus, CourseViewModel } from "./ViewModel";

export class CourseSelectionController {
    private solver: CatalogSolver;
    private selectedIds: Set<string> = new Set();
    
    // Maps a base source course to its explicitly selected move-up target
    private moveUps: Map<string, string> = new Map();
    
    private onUpdate: (viewModels: Record<string, CourseViewModel>) => void = () => { };

    constructor(catalog: CourseModel) {
        this.solver = new CatalogSolver(catalog);

        this.solver.subscribe((internalState: Record<string, CourseAvailabilityState>) => {
            const uiState: Record<string, CourseViewModel> = {};

            this.solver.courseMap.forEach((course, id) => {
                const solverState = internalState[id];
                if (!solverState) return;

                const isSelected = this.selectedIds.has(id);
                const isMoveUpSource = this.moveUps.has(id);
                const explicitTargetId = this.moveUps.get(id);

                let isMoveUpTarget = false;
                let moveUpSourceId: string | undefined;
                
                for (const [source, target] of this.moveUps.entries()) {
                    if (target === id) {
                        isMoveUpTarget = true;
                        moveUpSourceId = source;
                        break;
                    }
                }

                const moveUpAvailable = Boolean(course.moveUpTargetId);

                let status: CourseStatus = "locked";
                if (isMoveUpTarget) status = "moveUpTarget";
                else if (isSelected) status = "selected";
                else if (solverState.isAvailable) status = "available";

                let lockReason = undefined;
                if (status === "locked") {
                    if (solverState.conflictReason) {
                        lockReason = solverState.conflictReason;
                    } else {
                        const reasons = [];
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
                    isSelected,
                    isInvalidSelection: false,
                    isMoveUpSource,
                    isMoveUpTarget,
                    moveUpSourceId,
                    moveUpTargetId: explicitTargetId, 
                    moveUpAvailable,
                    lockReason,
                    moveUpNote: course.moveUp,
                    crowdRating: Math.round(course.crowdRating || 0),
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
        // Find if this course is part of a move-up
        let isTarget = false;
        for (const target of this.moveUps.values()) {
            if (target === courseId) {
                isTarget = true;
                break;
            }
        }
        
        // Cannot directly toggle targets off natively, they belong strictly to the source selection.
        if (isTarget) return;

        if (this.selectedIds.has(courseId)) {
            this.selectedIds.delete(courseId);
            this.moveUps.delete(courseId);
            this.pruneBrokenSelections();
        } else if (this.solver.isCourseAvailable(courseId)) {
            this.clearConflictingSelection(courseId);
            this.selectedIds.add(courseId);
        }

        this.solver.setSelected(this.selectedIds, this.moveUps);
    }

    public getValidMoveUpTargets(sourceId: string): string[] {
        const targets: string[] = [];
        let currentId = this.solver.courseMap.get(sourceId)?.moveUpTargetId;
        while (currentId) {
            targets.push(currentId);
            currentId = this.solver.courseMap.get(currentId)?.moveUpTargetId;
        }
        return targets;
    }

    public setExplicitMoveUp(sourceId: string, targetId: string) {
        if (!this.selectedIds.has(sourceId)) return;
        this.moveUps.set(sourceId, targetId);
        this.solver.setSelected(this.selectedIds, this.moveUps);
    }

    public removeExplicitMoveUp(sourceId: string) {
        this.moveUps.delete(sourceId);
        this.solver.setSelected(this.selectedIds, this.moveUps);
    }

    private pruneBrokenSelections() {
        let changed = false;

        do {
            changed = false;
            for (const selectedId of [...this.selectedIds]) {
                if (this.solver.isCourseAvailable(selectedId)) continue;

                this.selectedIds.delete(selectedId);
                this.moveUps.delete(selectedId);
                changed = true;
            }
        } while (changed);

        for (const sourceId of [...this.moveUps.keys()]) {
            if (!this.selectedIds.has(sourceId)) {
                this.moveUps.delete(sourceId);
            }
        }
    }

    private clearConflictingSelection(courseId: string) {
        const courseGroup = this.solver.getConflictGroupId(courseId);
        if (!courseGroup) return;

        for (const s of [...this.selectedIds]) {
            if (s === courseId) continue;
            const t = this.moveUps.get(s) || s;
            
            // Overlapping occupancy forces wipe of BOTH the native entry AND the overriding target
            if (this.solver.getConflictGroupId(t) === courseGroup || this.solver.getConflictGroupId(s) === courseGroup) {
                this.selectedIds.delete(s);
                this.moveUps.delete(s);
            }
        }
    }
}
