// Controller.ts
// written by willuhd on Apr 6
// - the intended public API the frontend calls in order to delegate view events
// - this updates the view data so the UI can be updated

import { CatalogSolver, type CourseAvailabilityState, type ResolutionFailure } from "./Solver";
import type { CourseModel } from "./CourseModel";
import type { CourseStatus, CourseViewModel } from "./ViewModel";
import { normalizePlan, type PlanSnapshot } from "./PlanCodec";

export class CourseSelectionController {
    private solver: CatalogSolver;

    // What the student actually chose. This — not the derived plan below — is what the
    // solver evaluates against, so availability stays exactly as flexible as it was
    // before implied courses were surfaced: a prerequisite the solver picked on the
    // student's behalf must never constrain what they can pick next.
    private selectedIds: Set<string> = new Set();

    // The full plan the UI renders: the chosen courses plus every prerequisite and
    // concurrent course they entail. Derived from `selectedIds` after every change.
    private planIds: Set<string> = new Set();
    
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

                const isSelected = this.planIds.has(id);
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
                        // The course may be in the plan only because something else implied
                        // it; moving it up is an explicit choice about it, so simulate
                        // against a selection that owns it.
                        const testSelected = new Set(this.selectedIds).add(id);
                        // getMoveUpChain is cycle-safe; walking `moveUpTargetId` inline would
                        // hang the UI on a catalog whose chain loops back on itself.
                        for (const currentTarget of this.getMoveUpChain(id)) {
                            if (!sourceGroup || this.solver.getConflictGroupId(currentTarget) !== sourceGroup) {
                                invalidMoveUpTargets[currentTarget] = "This move-up target is not in the same department and grade";
                                continue;
                            }
                            const testMoveUps = new Map(this.moveUps);
                            testMoveUps.set(id, currentTarget);
                            const validRes = this.solver.simulatePlanValidity(testSelected, testMoveUps, currentTarget);
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
        this.commit();
    }

    /**
     * The student's explicit choices, in a form that survives a reload or a share
     * link. Only the choices are recorded — the implied prerequisites are derived
     * again on restore, so a snapshot stays valid even after the catalog changes.
     */
    public getPlanSnapshot(): PlanSnapshot {
        return normalizePlan({
            selected: [...this.selectedIds],
            moveUps: [...this.moveUps.entries()]
        });
    }

    /**
     * Replays a snapshot onto this controller.
     *
     * A snapshot can be stale (a shared link from an older catalog, or a plan saved
     * before a course was renamed), so every id is checked against the catalog and
     * every move-up is re-validated the same way `setExplicitMoveUp` would. Whatever
     * survives is applied and then pruned, which means a partially-valid plan
     * restores as much as it legitimately can instead of failing outright.
     *
     * Returns the ids that were dropped, so the UI can say so rather than silently
     * handing back a smaller plan than the student shared.
     */
    public restorePlan(snapshot: PlanSnapshot): { dropped: string[] } {
        const normalized = normalizePlan(snapshot);
        const dropped: string[] = [];

        const selected = new Set<string>();
        for (const id of normalized.selected) {
            if (this.solver.courseMap.has(id)) selected.add(id);
            else dropped.push(id);
        }

        const moveUps = new Map<string, string>();
        for (const [source, target] of normalized.moveUps) {
            if (!selected.has(source) || !this.solver.courseMap.has(target)) {
                dropped.push(target);
                continue;
            }
            const sourceGroup = this.solver.getConflictGroupId(source);
            const reachable = this.getMoveUpChain(source).includes(target);
            if (!reachable || !sourceGroup || this.solver.getConflictGroupId(target) !== sourceGroup) {
                dropped.push(target);
                continue;
            }
            moveUps.set(source, target);
        }

        this.selectedIds = selected;
        this.moveUps = moveUps;

        // A restored plan can violate rules the catalog has since tightened; prune
        // rather than leaving the student with a plan the solver calls invalid.
        const before = new Set(this.selectedIds);
        this.pruneBrokenSelections();
        for (const id of before) {
            if (!this.selectedIds.has(id)) dropped.push(id);
        }

        this.commit();
        return { dropped: [...new Set(dropped)] };
    }

    /** Empties the plan. */
    public clearPlan() {
        this.selectedIds = new Set();
        this.moveUps = new Map();
        this.commit();
    }

    /** The courses the student explicitly picked (no implied prerequisites). */
    public getSelectedIds(): string[] {
        return [...this.selectedIds].sort();
    }

    /** Every course in the plan, implied prerequisites included. */
    public getPlanIds(): string[] {
        return [...this.planIds].sort();
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

        if (this.planIds.has(courseId)) {
            this.removeFromPlan(courseId);
        } else if (this.solver.isCourseAvailable(courseId)) {
            this.clearConflictingSelection(courseId);
            this.selectedIds.add(courseId);
        }

        this.commit();
    }

    /**
     * Recomputes the derived plan and republishes state to the view.
     *
     * `planIds` is the requirement closure of the student's choices: the courses they
     * picked plus every prerequisite and concurrent course those entail. The solver
     * resolves a course by inventing the prerequisites it needs and calling the plan
     * valid, so selecting "Biology 10 Honors" alone produced a plan whose grade 9 slot
     * was empty — and that empty slot is what got exported as the student's 4-year
     * plan. Surfacing the closure makes the plan the student sees the whole set of
     * courses they would actually take.
     *
     * The closure is deliberately *derived* rather than folded back into `selectedIds`:
     * the solver keeps evaluating against the explicit choices only, so a prerequisite
     * it picked never narrows what the student can choose next.
     */
    private commit() {
        this.planIds = this.derivePlan();
        this.solver.setSelected(this.selectedIds, this.moveUps);
    }

    private derivePlan(): Set<string> {
        const resolution = this.solver.resolveSelection(this.selectedIds, this.moveUps);
        if (!resolution.ok) return new Set(this.selectedIds);

        const plan = new Set<string>();
        for (const courseId of resolution.closure) {
            // A move-up target stands in for its source in the resolved plan; the UI
            // renders the source as selected and flags the target separately.
            plan.add(resolution.sourceByTarget.get(courseId) ?? courseId);
        }
        return plan;
    }

    /**
     * Removes a course from the plan, along with anything that only existed to serve it.
     *
     * Two directions have to be handled. Downstream: a choice whose prerequisite just
     * left is no longer supported and has to go. Upstream: a course the student never
     * picked, which the solver pulled in purely as support, should disappear once the
     * course that needed it is gone — otherwise unclicking one card strands
     * prerequisites in other departments that the student then has to hunt down.
     *
     * The upstream half falls out of deriving the plan from the explicit choices: drop
     * the choices that depend on what was removed, and the support they carried is
     * simply not derived again.
     */
    private removeFromPlan(courseId: string) {
        this.forget(courseId);

        // A choice that still needs a removed course would pull it straight back into
        // the derived plan, so it goes too.
        const removed = new Set<string>([courseId]);
        for (let iterations = 0; iterations < 50; iterations++) {
            const dependents = [...this.selectedIds].filter(id => {
                const closure = this.solver.resolveSelection(new Set([id]), this.moveUps).closure;
                return [...removed].some(goneId => closure.has(goneId));
            });
            if (dependents.length === 0) break;

            dependents.forEach(id => {
                removed.add(id);
                this.forget(id);
            });
        }

        this.pruneBrokenSelections();
    }

    /** Drops a course from the student's choices, move-up included. */
    private forget(courseId: string) {
        this.selectedIds.delete(courseId);
        this.moveUps.delete(courseId);
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
        if (!this.planIds.has(sourceId)) return false;
        if (sourceId === targetId) return false;
        if (!this.solver.courseMap.has(targetId)) return false;

        // The target must be reachable along the declared move-up chain...
        if (!this.getMoveUpChain(sourceId).includes(targetId)) return false;

        // ...and must stay inside the source's own department-year slot, otherwise a
        // move-up silently relocates a course into a different grade or department.
        const sourceGroup = this.solver.getConflictGroupId(sourceId);
        if (!sourceGroup || this.solver.getConflictGroupId(targetId) !== sourceGroup) return false;

        // Moving a course up is an explicit choice about it, even if it entered the plan
        // as an implied prerequisite — otherwise the move-up would resolve away.
        const candidateSelected = new Set(this.selectedIds).add(sourceId);

        // Finally, the resulting plan has to actually resolve.
        const candidate = new Map(this.moveUps);
        candidate.set(sourceId, targetId);
        if (!this.solver.simulatePlanValidity(candidateSelected, candidate, targetId).ok) return false;

        this.selectedIds = candidateSelected;
        this.moveUps = candidate;
        // The target carries the source's requirements, so the implied set changes with it.
        this.commit();
        return true;
    }

    public removeExplicitMoveUp(sourceId: string) {
        if (!this.moveUps.delete(sourceId)) return;
        // The source's own requirements apply again, so the implied set changes with it.
        this.pruneBrokenSelections(); // Reverting a moveup might cascade and break downstream courses 
        this.commit();
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
                    this.forget(culprit);
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
                this.forget(s);
            }
        }
    }
}
