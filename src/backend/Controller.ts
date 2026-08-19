// Controller.ts
// written by willuhd on Apr 6
// - the intended public API the frontend calls in order to delegate view events
// - this updates the view data so the UI can be updated

import { CatalogSolver, type CourseAvailabilityState, type ResolutionFailure } from "./Solver";
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

                // Discover if this source is structurally locked from being cancelled due to downstream dependency
                let isLockedMoveUpSource = false;
                if (isMoveUpSource) {
                    const testMoveUps = new Map(this.moveUps);
                    testMoveUps.delete(id); 
                    const res = this.solver.simulatePlanValidity(this.selectedIds, testMoveUps);
                    if (!res.ok) {
                        isLockedMoveUpSource = true;
                    }
                }

                let validMoveUpTargets: string[] = [];
                let invalidMoveUpTargets: Record<string, string> = {};
                let moveUpAvailable = false;

                if (course.moveUpTargetId) {
                    moveUpAvailable = true;
                    if (isSelected && !isMoveUpSource) {
                        const sourceGroup = this.solver.getConflictGroupId(id);
                        // getMoveUpChain is cycle-safe; walking `moveUpTargetId` inline would
                        // hang the UI on a catalog whose chain loops back on itself.
                        for (const currentTarget of this.getMoveUpChain(id)) {
                            if (!sourceGroup || this.solver.getConflictGroupId(currentTarget) !== sourceGroup) {
                                invalidMoveUpTargets[currentTarget] = "This move-up target is not in the same department and grade";
                                continue;
                            }
                            const testMoveUps = new Map(this.moveUps);
                            testMoveUps.set(id, currentTarget);
                            const validRes = this.solver.simulatePlanValidity(this.selectedIds, testMoveUps, currentTarget);
                            if (validRes.ok) {
                                validMoveUpTargets.push(currentTarget);
                            } else {
                                invalidMoveUpTargets[currentTarget] = validRes.reason || "Current configuration does not allow move-up to this course";
                            }
                        }
                    }
                }

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
                    isLockedMoveUpSource,
                    moveUpSourceId,
                    moveUpTargetId: explicitTargetId, 
                    moveUpAvailable,
                    validMoveUpTargets,
                    invalidMoveUpTargets,
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
        let isTarget = false;
        for (const target of this.moveUps.values()) {
            if (target === courseId) {
                isTarget = true;
                break;
            }
        }
        
        // Target cancellations are now handled via dedicated path in Frontend bridging to removeExplicitMoveUp
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

    /**
     * Returns the ordered move-up chain reachable from `sourceId`
     * (sourceId -> moveUpTargetId -> its own moveUpTargetId -> ...).
     * Guards against a catalog authoring mistake that loops the chain back on itself.
     */
    public getMoveUpChain(sourceId: string): string[] {
        const chain: string[] = [];
        const seen = new Set<string>([sourceId]);
        let current = this.solver.courseMap.get(sourceId)?.moveUpTargetId;

        while (current && !seen.has(current)) {
            chain.push(current);
            seen.add(current);
            current = this.solver.courseMap.get(current)?.moveUpTargetId;
        }
        return chain;
    }

    /**
     * Applies a move-up. Returns false (and changes nothing) when the request is not
     * a legitimate move-up: the caller is a public API, so the target has to be checked
     * here rather than relying on the UI only ever offering reachable targets.
     */
    public setExplicitMoveUp(sourceId: string, targetId: string): boolean {
        if (!this.selectedIds.has(sourceId)) return false;
        if (sourceId === targetId) return false;
        if (!this.solver.courseMap.has(targetId)) return false;

        // The target must be reachable along the declared move-up chain...
        if (!this.getMoveUpChain(sourceId).includes(targetId)) return false;

        // ...and must stay inside the source's own department-year slot, otherwise a
        // move-up silently relocates a course into a different grade or department.
        const sourceGroup = this.solver.getConflictGroupId(sourceId);
        if (!sourceGroup || this.solver.getConflictGroupId(targetId) !== sourceGroup) return false;

        // Finally, the resulting plan has to actually resolve.
        const candidate = new Map(this.moveUps);
        candidate.set(sourceId, targetId);
        if (!this.solver.simulatePlanValidity(this.selectedIds, candidate, targetId).ok) return false;

        this.moveUps = candidate;
        this.solver.setSelected(this.selectedIds, this.moveUps);
        return true;
    }

    public removeExplicitMoveUp(sourceId: string) {
        if (!this.moveUps.delete(sourceId)) return;
        this.pruneBrokenSelections(); // Reverting a moveup might cascade and break downstream courses 
        this.solver.setSelected(this.selectedIds, this.moveUps);
    }

    private pruneBrokenSelections() {
        let changed = false;
        let iterations = 0;

        do {
            changed = false;
            iterations++;
            
            // Re-simulate the current projected plan in order to find broken branches iteratively
            const res = this.solver.simulatePlanValidity(this.selectedIds, this.moveUps);
            
            if (!res.ok && res.failure) {
                const culprit = this.resolvePruneCandidate(res.failure);

                if (culprit) {
                    this.selectedIds.delete(culprit);
                    this.moveUps.delete(culprit);
                    changed = true;
                } else {
                    break; // Nothing left that we own; avoid spinning forever
                }
            }
        } while (changed && iterations < 50);
    }

    /**
     * Maps a solver failure back onto a selection we are actually allowed to drop.
     *
     * `failure.sourceCourseId` is often an intermediate dependency rather than
     * something the user picked (e.g. a `dead_end` names the requirement's owner).
     * Walking the failure path — and finally any remaining selection — keeps the plan
     * from being left in a permanently invalid state.
     */
    private resolvePruneCandidate(failure: ResolutionFailure): string | undefined {
        const candidates: string[] = [];
        if (failure.sourceCourseId) candidates.push(failure.sourceCourseId);
        if (failure.targetCourseId) candidates.push(failure.targetCourseId);
        if (failure.blockerCourseId) candidates.push(failure.blockerCourseId);
        // The head of the path is the explicit target the resolver started from.
        if (failure.path?.length) candidates.push(failure.path[0]!, ...failure.path);

        for (const candidate of candidates) {
            if (this.selectedIds.has(candidate)) return candidate;
            // The failure may be phrased in terms of a move-up target identity.
            for (const [src, tgt] of this.moveUps.entries()) {
                if (tgt === candidate || src === candidate) return src;
            }
        }

        // Last resort: the plan is broken but the solver blamed something we don't own.
        // Drop an arbitrary (stable) selection so the loop keeps making progress.
        return [...this.selectedIds].sort().pop();
    }

    private clearConflictingSelection(courseId: string) {
        const courseGroup = this.solver.getConflictGroupId(courseId);
        if (!courseGroup) return;

        for (const s of [...this.selectedIds]) {
            if (s === courseId) continue;
            const t = this.moveUps.get(s) || s;
            
            if (this.solver.getConflictGroupId(t) === courseGroup || this.solver.getConflictGroupId(s) === courseGroup) {
                this.selectedIds.delete(s);
                this.moveUps.delete(s);
            }
        }
    }
}
