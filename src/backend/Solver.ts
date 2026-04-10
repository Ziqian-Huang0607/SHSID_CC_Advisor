// Solver.ts
// rewritten to explicitly model targeted move-ups with hybrid dependency injection

import type { CourseModel, CourseNode } from "./CourseModel";

type RuleKind = "pre" | "current";

interface RequirementNode {
    id: string;
    courseId: string;
    kind: RuleKind;
    options: string[];
}

interface GraphCourseNode extends CourseNode {
    grade: string;
    department: string;
    conflictGroupId?: string;
    requirements: RequirementNode[];
    continuationTargets: string[];
}

interface ResolutionContext {
    closure: Set<string>;
    occupancy: Map<string, string>;
    resolved: Set<string>;
}

interface ResolutionFailure {
    type: "group_conflict" | "missing_reference" | "cycle" | "dead_end" | "track_lock";
    sourceCourseId: string;
    requirement?: RequirementNode;
    targetCourseId?: string;
    blockerCourseId?: string;
    continuationTargets?: string[];
    path?: string[];
    causes?: ResolutionFailure[];
}

interface ResolutionResult {
    ok: boolean;
    context: ResolutionContext;
    failure?: ResolutionFailure;
}

interface EffectivePlan {
    explicitTargets: Set<string>;
    reqOverrides: Map<string, RequirementNode[]>;
    sourceByTarget: Map<string, string>;
}

interface PlanResolution {
    ok: boolean;
    closure: Set<string>;
    failure?: ResolutionFailure;
}

export interface CourseAvailabilityState {
    isAvailable: boolean;
    missingPre: string[][];
    missingCurrent: string[][];
    conflictReason?: string;
}

export class CatalogSolver {
    private catalog: CourseModel;
    public courseMap: Map<string, GraphCourseNode> = new Map();
    private conflictGroups: Map<string, Set<string>> = new Map();

    private selectedCourses: Set<string> = new Set();
    private moveUps: Map<string, string> = new Map();
    private evaluationCache: Map<string, CourseAvailabilityState> = new Map();

    private subscribers: Array<(state: Record<string, CourseAvailabilityState>) => void> = [];

    constructor(catalog: CourseModel) {
        this.catalog = catalog;
        this.buildGraph();
    }

    private buildGraph() {
        const depts = this.catalog.departments || {};

        for (const [deptName, deptData] of Object.entries(depts)) {
            if (deptName === "residuals" && Array.isArray(deptData)) {
                deptData.forEach(course => {
                    this.addCourseNode(course, { department: deptName, grade: "Residual" });
                });
                continue;
            }

            if (typeof deptData !== "object" || deptData === null || Array.isArray(deptData)) {
                continue;
            }

            for (const [grade, courses] of Object.entries(deptData)) {
                if (!Array.isArray(courses)) continue;

                const conflictGroupId = `${deptName}::${grade}`;
                const group = this.conflictGroups.get(conflictGroupId) ?? new Set<string>();

                courses.forEach(course => {
                    this.addCourseNode(course, { department: deptName, grade, conflictGroupId });
                    group.add(course.id);
                });

                this.conflictGroups.set(conflictGroupId, group);
            }
        }
    }

    private addCourseNode(course: CourseNode, meta: { department: string; grade: string; conflictGroupId?: string }) {
        const requirements: RequirementNode[] = [];
        const continuationTargets = new Set<string>();

        (["pre", "current"] as const).forEach(kind => {
            course.rules?.[kind]?.forEach((options, index) => {
                const sanitizedOptions = options.filter(Boolean);
                if (sanitizedOptions.length === 0) return;

                requirements.push({
                    id: `${course.id}:${kind}:${index}`,
                    courseId: course.id,
                    kind,
                    options: sanitizedOptions
                });
            });
        });

        course.rules?.next?.forEach(options => {
            options.filter(Boolean).forEach(targetId => continuationTargets.add(targetId));
        });

        this.courseMap.set(course.id, {
            ...course,
            ...meta,
            requirements,
            continuationTargets: [...continuationTargets]
        });
    }

    public subscribe(callback: (state: Record<string, CourseAvailabilityState>) => void): () => void {
        this.subscribers.push(callback);
        callback(this.evaluateGraph());
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    public forceNotify() {
        this.evaluationCache.clear();
        const state = this.evaluateGraph();
        this.subscribers.forEach(cb => cb(state));
    }

    public setSelected(selected: Set<string>, moveUps: Map<string, string>) {
        this.selectedCourses = new Set(selected);
        this.moveUps = new Map(moveUps);
        this.forceNotify();
    }

    public isCourseAvailable(courseId: string): boolean {
        return this.evaluateCourseAvailability(courseId).isAvailable;
    }

    public evaluateGraph(): Record<string, CourseAvailabilityState> {
        const state: Record<string, CourseAvailabilityState> = {};
        this.courseMap.forEach((_, id) => {
            state[id] = this.evaluateCourseAvailability(id);
        });
        return state;
    }

    private evaluateCourseAvailability(courseId: string): CourseAvailabilityState {
        const cacheKey = this.makeCacheKey(courseId);
        const cached = this.evaluationCache.get(cacheKey);
        if (cached) return cached;

        const course = this.courseMap.get(courseId);
        if (!course) {
            const missingState: CourseAvailabilityState = {
                isAvailable: false, missingPre: [], missingCurrent: [], conflictReason: `Course ${courseId} missing.`
            };
            this.evaluationCache.set(cacheKey, missingState);
            return missingState;
        }

        const projectedPlan = this.projectSelectionForCourse(courseId);
        const resolution = this.resolvePlan(projectedPlan);
        
        const result: CourseAvailabilityState = {
            isAvailable: resolution.ok,
            missingPre: this.getMissingRequirements(course.rules?.pre, projectedPlan.explicitTargets),
            missingCurrent: this.getMissingRequirements(course.rules?.current, projectedPlan.explicitTargets),
            conflictReason: resolution.ok ? undefined : this.describeFailure(resolution.failure, courseId),
        };

        this.evaluationCache.set(cacheKey, result);
        return result;
    }

    private projectSelectionForCourse(courseId: string): EffectivePlan {
        const selected = new Set(this.selectedCourses);
        const moveUps = new Map(this.moveUps);

        const courseGroup = this.getConflictGroupId(courseId);

        // If simulating this course, dynamically wipe selections overlapping its target space
        if (courseGroup) {
            for (const s of [...selected]) {
                if (s === courseId) continue;
                const t = moveUps.get(s) || s;
                
                if (this.getConflictGroupId(t) === courseGroup || this.getConflictGroupId(s) === courseGroup) {
                    selected.delete(s);
                    moveUps.delete(s);
                }
            }
        }

        selected.add(courseId);
        return this.buildEffectivePlan(selected, moveUps);
    }

    private buildEffectivePlan(selected: Set<string>, moveUps: Map<string, string>): EffectivePlan {
        const explicitTargets = new Set<string>();
        const reqOverrides = new Map<string, RequirementNode[]>();
        const sourceByTarget = new Map<string, string>();

        for (const s of selected) {
            const t = moveUps.get(s);
            if (t) {
                // Course replaced via Move-Up 
                explicitTargets.add(t);
                sourceByTarget.set(t, s);
                const sNode = this.courseMap.get(s);
                if (sNode) {
                    reqOverrides.set(t, sNode.requirements); // For pre-requisites mapping
                }
            } else {
                explicitTargets.add(s);
            }
        }

        return { explicitTargets, reqOverrides, sourceByTarget };
    }

    private resolvePlan(plan: EffectivePlan): PlanResolution {
        let context: ResolutionContext = {
            closure: new Set(),
            occupancy: new Map(),
            resolved: new Set()
        };

        const sortedTargets = [...plan.explicitTargets].sort();

        // 1. Group conflict detection on pure occupancy
        for (const target of sortedTargets) {
            const course = this.courseMap.get(target);
            if (!course) {
                return { ok: false, closure: context.closure, failure: { type: "missing_reference", sourceCourseId: target, targetCourseId: target } };
            }

            if (course.conflictGroupId) {
                const occupiedBy = context.occupancy.get(course.conflictGroupId);
                if (occupiedBy && occupiedBy !== target) {
                    return { ok: false, closure: context.closure, failure: { type: "group_conflict", sourceCourseId: target, targetCourseId: target, blockerCourseId: occupiedBy } };
                }
                context.occupancy.set(course.conflictGroupId, target);
            }
        }

        // 2. DFS for recursive prerequisite validation
        for (const target of sortedTargets) {
            const result = this.resolveCourse(target, context, [], plan);
            if (!result.ok) {
                return { ok: false, closure: result.context.closure, failure: result.failure };
            }
            context = result.context;
        }

        // 3. Upward track continuity check
        const continuationFailure = this.findContinuationConflict(context.closure, plan);
        if (continuationFailure) {
            return { ok: false, closure: context.closure, failure: continuationFailure };
        }

        return { ok: true, closure: context.closure };
    }

    private resolveCourse(
        courseId: string,
        context: ResolutionContext,
        path: string[],
        plan: EffectivePlan
    ): ResolutionResult {
        if (context.resolved.has(courseId)) return { ok: true, context };
        if (path.includes(courseId)) return { ok: false, context, failure: { type: "cycle", sourceCourseId: courseId, path: [...path, courseId] } };

        const course = this.courseMap.get(courseId);
        if (!course) {
            return { ok: false, context, failure: { type: "missing_reference", sourceCourseId: path[path.length - 1] || courseId, targetCourseId: courseId, path: [...path, courseId] } };
        }

        let workingContext = this.cloneContext(context);
        workingContext.closure.add(courseId);

        if (course.conflictGroupId) {
            const occupiedBy = workingContext.occupancy.get(course.conflictGroupId);
            if (occupiedBy && occupiedBy !== courseId) {
                return { ok: false, context, failure: { type: "group_conflict", sourceCourseId: path[path.length - 1] || courseId, targetCourseId: courseId, blockerCourseId: occupiedBy, path: [...path, courseId] } };
            }
            workingContext.occupancy.set(course.conflictGroupId, courseId);
        }

        // Swap checking logic for move-up targets 
        const reqs = plan.reqOverrides.get(courseId) ?? course.requirements;
        const nextPath = [...path, courseId];

        for (const requirement of reqs) {
            const reqResult = this.resolveRequirement(requirement, workingContext, nextPath, plan);
            if (!reqResult.ok) return reqResult;
            workingContext = reqResult.context;
        }

        workingContext.resolved.add(courseId);
        return { ok: true, context: workingContext };
    }

    private resolveRequirement(requirement: RequirementNode, context: ResolutionContext, path: string[], plan: EffectivePlan): ResolutionResult {
        const failures: ResolutionFailure[] = [];
        const orderedOptions = this.orderRequirementOptions(requirement.options, context);

        for (const optionId of orderedOptions) {
            if (!this.courseMap.has(optionId)) {
                failures.push({ type: "missing_reference", sourceCourseId: requirement.courseId, requirement, targetCourseId: optionId, path: [...path, optionId] });
                continue;
            }

            const branchContext = this.cloneContext(context);
            const branchResult = this.resolveCourse(optionId, branchContext, path, plan);
            
            if (branchResult.ok) {
                const continuationFailure = this.findContinuationConflict(branchResult.context.closure, plan);
                if (continuationFailure) {
                    failures.push(continuationFailure);
                    continue;
                }
                return branchResult;
            }
            if (branchResult.failure) failures.push(branchResult.failure);
        }

        return { ok: false, context, failure: { type: "dead_end", sourceCourseId: requirement.courseId, requirement, path, causes: failures } };
    }

    private findContinuationConflict(closure: Set<string>, plan: EffectivePlan): ResolutionFailure | undefined {
        for (const sourceCourseId of closure) {
            const sourceCourse = this.courseMap.get(sourceCourseId);
            if (!sourceCourse || sourceCourse.continuationTargets.length === 0) continue;

            const nextGrade = this.getNextGrade(sourceCourse.grade);
            if (!nextGrade) continue;

            const groupId = `${sourceCourse.department}::${nextGrade}`;
            const nextGradeGroup = this.conflictGroups.get(groupId);
            if (!nextGradeGroup) continue;

            const allowedTargets = new Set(sourceCourse.continuationTargets);
            
            for (const targetCourseId of nextGradeGroup) {
                if (targetCourseId === sourceCourseId) continue;
                if (!closure.has(targetCourseId)) continue;

                // When previous courses check valid continuing paths, a targeted move-up counts as its base root S
                const originalIdentity = plan.sourceByTarget.get(targetCourseId) || targetCourseId;

                if (allowedTargets.has(targetCourseId) || allowedTargets.has(originalIdentity)) {
                    continue;
                }

                return {
                    type: "track_lock",
                    sourceCourseId,
                    targetCourseId,
                    blockerCourseId: sourceCourseId,
                    continuationTargets: [...allowedTargets]
                };
            }
        }
        return undefined;
    }

    private orderRequirementOptions(options: string[], context: ResolutionContext): string[] {
        return [...options].sort((left, right) => {
            const leftPriority = context.closure.has(left) ? 0 : 1;
            const rightPriority = context.closure.has(right) ? 0 : 1;
            if (leftPriority !== rightPriority) return leftPriority - rightPriority;
            return left.localeCompare(right);
        });
    }

    private describeFailure(failure: ResolutionFailure | undefined, focusCourseId: string): string | undefined {
        if (!failure) return undefined;
        switch (failure.type) {
            case "group_conflict": return `This course requires ${this.getCourseName(failure.targetCourseId || failure.sourceCourseId)}, but ${this.getCourseName(failure.blockerCourseId)} is selected`;
            case "missing_reference": return `Catalog rule references missing course ${failure.targetCourseId || focusCourseId}.`;
            case "cycle": return `Catalog rule contains a dependency cycle around ${this.getCourseName(focusCourseId)}.`;
            case "dead_end": {
                const nestedReason = failure.causes?.map(cause => this.describeFailure(cause, focusCourseId)).find(Boolean);
                if (nestedReason) return nestedReason;
                if (failure.requirement) return `${failure.requirement.kind === "current" ? "Concurrent path" : "Prerequisite path"} cannot be satisfied.`;
                return `No valid rule path remains for ${this.getCourseName(focusCourseId)}.`;
            }
            case "track_lock": return `Selecting ${this.getCourseName(failure.sourceCourseId)} locks the next-grade path, preventing ${this.getCourseName(failure.targetCourseId || focusCourseId)}.`;
        }
    }

    private getCourseName(courseId?: string): string {
        if (!courseId) return "another course";
        return this.courseMap.get(courseId)?.name || courseId;
    }

    public getConflictGroupId(courseId: string): string | undefined {
        return this.courseMap.get(courseId)?.conflictGroupId;
    }

    private makeCacheKey(courseId: string): string {
        const moves = Array.from(this.moveUps.entries()).map(([k, v]) => `${k}>${v}`).sort().join("|");
        return `${courseId}::${[...this.selectedCourses].sort().join("|")}::${moves}`;
    }

    private getNextGrade(grade: string): string | undefined {
        const parsedGrade = Number.parseInt(grade, 10);
        return Number.isFinite(parsedGrade) ? String(parsedGrade + 1) : undefined;
    }

    private cloneContext(context: ResolutionContext): ResolutionContext {
        return { closure: new Set(context.closure), occupancy: new Map(context.occupancy), resolved: new Set(context.resolved) };
    }

    private getMissingRequirements(dnf: string[][] | undefined, targets: Set<string>): string[][] {
        if (!dnf) return [];
        return dnf.filter(orBlock => !orBlock.some(id => targets.has(id)));
    }
}
