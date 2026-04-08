// Solver.ts
// rewritten to use an explicit dependency/conflict graph

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
}

interface ResolutionContext {
    closure: Set<string>;
    occupancy: Map<string, string>;
    resolved: Set<string>;
}

interface ResolutionFailure {
    type: "group_conflict" | "missing_reference" | "cycle" | "dead_end";
    sourceCourseId: string;
    requirement?: RequirementNode;
    targetCourseId?: string;
    blockerCourseId?: string;
    path?: string[];
    causes?: ResolutionFailure[];
}

interface ResolutionResult {
    ok: boolean;
    context: ResolutionContext;
    failure?: ResolutionFailure;
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
    moveUpInfo?: string;
    conflictReason?: string;
}

export class CatalogSolver {
    private catalog: CourseModel;
    public courseMap: Map<string, GraphCourseNode> = new Map();
    private conflictGroups: Map<string, Set<string>> = new Map();

    private selectedCourses: Set<string> = new Set();
    private moveUpOverrides: Set<string> = new Set();
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
                    this.addCourseNode(course, {
                        department: deptName,
                        grade: "Residual"
                    });
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
                    this.addCourseNode(course, {
                        department: deptName,
                        grade,
                        conflictGroupId
                    });
                    group.add(course.id);
                });

                this.conflictGroups.set(conflictGroupId, group);
            }
        }
    }

    private addCourseNode(
        course: CourseNode,
        meta: { department: string; grade: string; conflictGroupId?: string }
    ) {
        const requirements: RequirementNode[] = [];

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

        this.courseMap.set(course.id, {
            ...course,
            ...meta,
            requirements
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

    public setSelected(selected: Set<string>, overrides: Set<string>) {
        this.selectedCourses = new Set(selected);
        this.moveUpOverrides = new Set(overrides);
        this.forceNotify();
    }

    public isCourseAvailable(courseId: string): boolean {
        return this.evaluateCourseAvailability(courseId).isAvailable;
    }

    public canBypassCourse(courseId: string): boolean {
        const { overrides } = this.projectSelectionForCourse(courseId, this.moveUpOverrides);
        overrides.add(courseId);
        return this.evaluateCourseAvailability(courseId, overrides).isAvailable;
    }

    public evaluateGraph(): Record<string, CourseAvailabilityState> {
        const state: Record<string, CourseAvailabilityState> = {};

        this.courseMap.forEach((_, id) => {
            state[id] = this.evaluateCourseAvailability(id);
        });

        return state;
    }

    private evaluateCourseAvailability(
        courseId: string,
        overrides: Set<string> = this.moveUpOverrides
    ): CourseAvailabilityState {
        const cacheKey = this.makeCacheKey(courseId, overrides);
        const cached = this.evaluationCache.get(cacheKey);
        if (cached) return cached;

        const course = this.courseMap.get(courseId);
        if (!course) {
            const missingState: CourseAvailabilityState = {
                isAvailable: false,
                missingPre: [],
                missingCurrent: [],
                conflictReason: `Course ${courseId} is missing from the catalog graph.`
            };

            this.evaluationCache.set(cacheKey, missingState);
            return missingState;
        }

        const { selection: targetSelection, overrides: projectedOverrides } = this.projectSelectionForCourse(courseId, overrides);

        const resolution = this.resolveSelection(targetSelection, projectedOverrides);
        const result: CourseAvailabilityState = {
            isAvailable: resolution.ok,
            missingPre: this.getMissingRequirements(course.rules?.pre, this.selectedCourses),
            missingCurrent: this.getMissingRequirements(course.rules?.current, this.selectedCourses),
            moveUpInfo: course.moveUp,
            conflictReason: resolution.ok ? undefined : this.describeFailure(resolution.failure, courseId)
        };

        this.evaluationCache.set(cacheKey, result);
        return result;
    }

    private resolveSelection(targetSelection: Set<string>, overrides: Set<string>): PlanResolution {
        const baseContext = this.createBaseContext(targetSelection);
        if (!baseContext.ok) {
            return {
                ok: false,
                closure: new Set(targetSelection),
                failure: baseContext.failure
            };
        }

        let context = baseContext.context;
        for (const courseId of targetSelection) {
            const result = this.resolveCourse(courseId, context, [], overrides);
            if (!result.ok) {
                return {
                    ok: false,
                    closure: result.context.closure,
                    failure: result.failure
                };
            }

            context = result.context;
        }

        return {
            ok: true,
            closure: context.closure
        };
    }

    private createBaseContext(targetSelection: Set<string>): ResolutionResult {
        const context: ResolutionContext = {
            closure: new Set(targetSelection),
            occupancy: new Map<string, string>(),
            resolved: new Set<string>()
        };

        for (const courseId of targetSelection) {
            const course = this.courseMap.get(courseId);
            if (!course) {
                return {
                    ok: false,
                    context,
                    failure: {
                        type: "missing_reference",
                        sourceCourseId: courseId,
                        targetCourseId: courseId
                    }
                };
            }

            if (!course.conflictGroupId) continue;

            const occupiedBy = context.occupancy.get(course.conflictGroupId);
            if (occupiedBy && occupiedBy !== courseId) {
                return {
                    ok: false,
                    context,
                    failure: {
                        type: "group_conflict",
                        sourceCourseId: courseId,
                        targetCourseId: courseId,
                        blockerCourseId: occupiedBy
                    }
                };
            }

            context.occupancy.set(course.conflictGroupId, courseId);
        }

        return {
            ok: true,
            context
        };
    }

    private resolveCourse(
        courseId: string,
        context: ResolutionContext,
        path: string[],
        overrides: Set<string>
    ): ResolutionResult {
        const course = this.courseMap.get(courseId);
        if (!course) {
            return {
                ok: false,
                context,
                failure: {
                    type: "missing_reference",
                    sourceCourseId: path[path.length - 1] || courseId,
                    targetCourseId: courseId,
                    path: [...path, courseId]
                }
            };
        }

        if (context.resolved.has(courseId)) {
            return {
                ok: true,
                context
            };
        }

        if (path.includes(courseId)) {
            return {
                ok: false,
                context,
                failure: {
                    type: "cycle",
                    sourceCourseId: courseId,
                    path: [...path, courseId]
                }
            };
        }

        let workingContext = this.cloneContext(context);
        workingContext.closure.add(courseId);

        if (course.conflictGroupId) {
            const occupiedBy = workingContext.occupancy.get(course.conflictGroupId);
            if (occupiedBy && occupiedBy !== courseId) {
                return {
                    ok: false,
                    context,
                    failure: {
                        type: "group_conflict",
                        sourceCourseId: path[path.length - 1] || courseId,
                        targetCourseId: courseId,
                        blockerCourseId: occupiedBy,
                        path: [...path, courseId]
                    }
                };
            }

            workingContext.occupancy.set(course.conflictGroupId, courseId);
        }

        if (overrides.has(courseId)) {
            workingContext.resolved.add(courseId);
            return {
                ok: true,
                context: workingContext
            };
        }

        const nextPath = [...path, courseId];

        for (const requirement of course.requirements) {
            const requirementResult = this.resolveRequirement(requirement, workingContext, nextPath, overrides);
            if (!requirementResult.ok) {
                return requirementResult;
            }

            workingContext = requirementResult.context;
        }

        workingContext.resolved.add(courseId);
        return {
            ok: true,
            context: workingContext
        };
    }

    private resolveRequirement(
        requirement: RequirementNode,
        context: ResolutionContext,
        path: string[],
        overrides: Set<string>
    ): ResolutionResult {
        const failures: ResolutionFailure[] = [];
        const orderedOptions = this.orderRequirementOptions(requirement.options, context);

        for (const optionId of orderedOptions) {
            if (!this.courseMap.has(optionId)) {
                failures.push({
                    type: "missing_reference",
                    sourceCourseId: requirement.courseId,
                    requirement,
                    targetCourseId: optionId,
                    path: [...path, optionId]
                });
                continue;
            }

            const branchContext = this.cloneContext(context);
            const branchResult = this.resolveCourse(optionId, branchContext, path, overrides);
            if (branchResult.ok) {
                return branchResult;
            }

            if (branchResult.failure) {
                failures.push(branchResult.failure);
            }
        }

        return {
            ok: false,
            context,
            failure: {
                type: "dead_end",
                sourceCourseId: requirement.courseId,
                requirement,
                path,
                causes: failures
            }
        };
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
            case "group_conflict": {
                const targetName = this.getCourseName(failure.targetCourseId || failure.sourceCourseId);
                const blockerName = this.getCourseName(failure.blockerCourseId);
                return `${targetName} conflicts with ${blockerName} in the same department-year slot.`;
            }
            case "missing_reference":
                return `Catalog rule references missing course ${failure.targetCourseId || focusCourseId}.`;
            case "cycle": {
                const cyclePath = failure.path?.map(id => this.getCourseName(id)).join(" -> ");
                return cyclePath
                    ? `Catalog rule loops through ${cyclePath}.`
                    : `Catalog rule contains a dependency cycle around ${this.getCourseName(focusCourseId)}.`;
            }
            case "dead_end": {
                const nestedReason = failure.causes
                    ?.map(cause => this.describeFailure(cause, focusCourseId))
                    .find((message): message is string => Boolean(message));

                if (nestedReason) return nestedReason;

                if (failure.requirement) {
                    const options = failure.requirement.options.map(id => this.getCourseName(id)).join(" or ");
                    const label = failure.requirement.kind === "current" ? "Concurrent path" : "Prerequisite path";
                    return `${label} cannot be satisfied through ${options}.`;
                }

                return `No valid rule path remains for ${this.getCourseName(focusCourseId)}.`;
            }
        }
    }

    private getCourseName(courseId?: string): string {
        if (!courseId) return "another course";
        return this.courseMap.get(courseId)?.name || courseId;
    }

    public getConflictGroupId(courseId: string): string | undefined {
        return this.courseMap.get(courseId)?.conflictGroupId;
    }

    private projectSelectionForCourse(
        courseId: string,
        overrides: Set<string>
    ): { selection: Set<string>; overrides: Set<string> } {
        const selection = new Set(this.selectedCourses);
        const projectedOverrides = new Set(overrides);
        const targetGroupId = this.getConflictGroupId(courseId);

        if (targetGroupId) {
            for (const selectedId of this.selectedCourses) {
                if (selectedId === courseId) continue;
                if (this.getConflictGroupId(selectedId) !== targetGroupId) continue;

                selection.delete(selectedId);
                projectedOverrides.delete(selectedId);
            }
        }

        selection.add(courseId);
        return { selection, overrides: projectedOverrides };
    }

    private makeCacheKey(courseId: string, overrides: Set<string>): string {
        const selected = [...this.selectedCourses].sort().join("|");
        const overrideKey = [...overrides].sort().join("|");
        return `${courseId}::${selected}::${overrideKey}`;
    }

    private cloneContext(context: ResolutionContext): ResolutionContext {
        return {
            closure: new Set(context.closure),
            occupancy: new Map(context.occupancy),
            resolved: new Set(context.resolved)
        };
    }

    private getMissingRequirements(dnf: string[][] | undefined, userState: Set<string>): string[][] {
        if (!dnf) return [];
        return dnf.filter(orBlock => !orBlock.some(id => userState.has(id)));
    }
}
