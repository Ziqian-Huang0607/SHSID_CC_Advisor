// api/[[...path]].ts
// SHSID CC Advisor — public JSON API, single-file edition.
// Everything (types, catalog loader, solver, router) is inlined here so the
// Vercel function has zero relative imports and nothing can be lost in bundling.
//
// Routes (base: /api):
//   GET  /api                     service info + endpoint directory
//   GET  /api/ping                liveness probe
//   GET  /api/status              health check
//   GET  /api/meta                catalog metadata
//   GET  /api/catalog             full raw catalog
//   GET  /api/courses             flat course list (?grade=&track=&department=&q=&available=)
//   GET  /api/courses/:id         one course + availability
//   GET  /api/grades              grades list
//   GET  /api/tracks              tracks list
//   GET  /api/departments         departments + counts
//   POST /api/validate            validate a plan { selected, moveUps }
//   POST /api/availability        availability map for a plan { selected, moveUps }
//   GET  /api/ratings             crowd rating tallies (?voterId= also returns your own ballots)
//   GET  /api/ratings/:id         tallies for one course (?voterId= to see your vote)
//   POST /api/ratings             cast or change your vote { courseId, value, voterId }
//   GET  /api/description/:id     third-party course summary (?refresh=1 to bypass the cache)

// ---------------------------------------------------------------- types ----

interface CourseRules {
    pre?: string[][];
    current?: string[][];
    next?: string[][];
    [key: string]: any;
}

interface CourseNode {
    id: string;
    name?: string;
    track: string;
    description: string;
    crowdRating: number;
    crowdReview: string;
    level?: string;
    rules?: CourseRules;
    moveUp?: string;
    moveUpTargetId?: string;
    [key: string]: any;
}

interface CourseModel {
    catalogName: string;
    version: string;
    lastUpdated: string;
    credit: string;
    footnote: string;
    grades: string[];
    tracks: string[];
    departments: Record<string, any>;
    [key: string]: any;
}

interface FlatCourse extends CourseNode {
    department: string;
    grade: string;
}

// ----------------------------------------------------- catalog loading ----

const CATALOG_URL =
    "https://edgeone.gh-proxy.org/https://raw.githubusercontent.com/WillUHD/CourseResources/refs/heads/main/Courses.catalog";
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedModel: CourseModel | null = null;
let cachedAt = 0;

async function getCatalog(forceRefresh = false): Promise<CourseModel> {
    if (!forceRefresh && cachedModel && Date.now() - cachedAt < CACHE_TTL_MS) {
        return cachedModel;
    }
    const response = await fetch(CATALOG_URL, { cache: "no-store" as RequestCache });
    if (!response.ok) {
        throw new Error(`Upstream catalog fetch failed with status ${response.status}`);
    }
    const raw = await response.text();
    const stripped = raw
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/,\s*([}\]])/g, "$1");
    const model = JSON.parse(stripped) as CourseModel;
    cachedModel = model;
    cachedAt = Date.now();
    return model;
}

function flattenCourses(catalog: CourseModel): FlatCourse[] {
    const out: FlatCourse[] = [];
    const depts = catalog.departments || {};
    for (const [deptName, deptData] of Object.entries(depts)) {
        if (deptName === "residuals" && Array.isArray(deptData)) {
            (deptData as CourseNode[]).forEach((c) =>
                out.push({ ...c, department: "residuals", grade: "Residual" }),
            );
            continue;
        }
        if (typeof deptData !== "object" || deptData === null || Array.isArray(deptData)) continue;
        for (const [grade, courses] of Object.entries(deptData)) {
            if (!Array.isArray(courses)) continue;
            (courses as CourseNode[]).forEach((c) => out.push({ ...c, department: deptName, grade }));
        }
    }
    return out;
}

// ---------------------------------------------------------- solver --------

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

interface CourseAvailabilityState {
    isAvailable: boolean;
    missingPre: string[][];
    missingCurrent: string[][];
    conflictReason?: string;
}

class CatalogSolver {
    private catalog: CourseModel;
    public courseMap: Map<string, GraphCourseNode> = new Map();
    private conflictGroups: Map<string, Set<string>> = new Map();

    private selectedCourses: Set<string> = new Set();
    private moveUps: Map<string, string> = new Map();
    private evaluationCache: Map<string, CourseAvailabilityState> = new Map();

    constructor(catalog: CourseModel) {
        this.catalog = catalog;
        this.buildGraph();
    }

    private buildGraph() {
        const depts = this.catalog.departments || {};

        for (const [deptName, deptData] of Object.entries(depts)) {
            if (deptName === "residuals" && Array.isArray(deptData)) {
                deptData.forEach((course: CourseNode) => {
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

                courses.forEach((course: CourseNode) => {
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

        (["pre", "current"] as const).forEach((kind) => {
            course.rules?.[kind]?.forEach((options, index) => {
                const sanitizedOptions = options.filter(Boolean);
                if (sanitizedOptions.length === 0) return;

                requirements.push({
                    id: `${course.id}:${kind}:${index}`,
                    courseId: course.id,
                    kind,
                    options: sanitizedOptions,
                });
            });
        });

        course.rules?.next?.forEach((options) => {
            options.filter(Boolean).forEach((targetId) => continuationTargets.add(targetId));
        });

        this.courseMap.set(course.id, {
            ...course,
            ...meta,
            requirements,
            continuationTargets: [...continuationTargets],
        });
    }

    public setSelected(selected: Set<string>, moveUps: Map<string, string>) {
        this.selectedCourses = new Set(selected);
        this.moveUps = new Map(moveUps);
        this.evaluationCache.clear();
    }

    public evaluateGraph(): Record<string, CourseAvailabilityState> {
        const state: Record<string, CourseAvailabilityState> = {};
        this.courseMap.forEach((_, id) => {
            state[id] = this.evaluateCourseAvailability(id);
        });
        return state;
    }

    public simulatePlanValidity(selected: Set<string>, moveUps: Map<string, string>, focusTargetId?: string): { ok: boolean; reason?: string; failure?: ResolutionFailure } {
        const plan = this.buildEffectivePlan(selected, moveUps);
        const resolution = this.resolvePlan(plan);
        return {
            ok: resolution.ok,
            reason: resolution.ok ? undefined : this.describeFailure(resolution.failure, focusTargetId || "course"),
            failure: resolution.failure,
        };
    }

    /**
     * Resolves a plan and reports its transitive requirement closure: the courses
     * chosen plus every prerequisite/concurrent course they entail. `resolvePlan` is
     * lenient — it invents the prerequisites a course needs and calls the plan valid —
     * so a caller that treats `selected` as the literal plan needs the closure to see
     * the courses that are actually implied by it.
     */
    public resolveSelection(selected: Set<string>, moveUps: Map<string, string>): {
        ok: boolean;
        closure: Set<string>;
        explicitTargets: Set<string>;
        sourceByTarget: Map<string, string>;
        failure?: ResolutionFailure;
    } {
        const plan = this.buildEffectivePlan(selected, moveUps);
        const resolution = this.resolvePlan(plan);
        return {
            ok: resolution.ok,
            closure: resolution.closure,
            explicitTargets: plan.explicitTargets,
            sourceByTarget: plan.sourceByTarget,
            failure: resolution.failure,
        };
    }

    private evaluateCourseAvailability(courseId: string): CourseAvailabilityState {
        const cacheKey = this.makeCacheKey(courseId);
        const cached = this.evaluationCache.get(cacheKey);
        if (cached) return cached;

        const course = this.courseMap.get(courseId);
        if (!course) {
            const missingState: CourseAvailabilityState = {
                isAvailable: false, missingPre: [], missingCurrent: [], conflictReason: `Course ${courseId} missing.`,
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
                explicitTargets.add(t);
                sourceByTarget.set(t, s);
                const sNode = this.courseMap.get(s);
                if (sNode) {
                    reqOverrides.set(t, sNode.requirements);
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
            resolved: new Set(),
        };

        const sortedTargets = [...plan.explicitTargets].sort();

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

        for (const target of sortedTargets) {
            const result = this.resolveCourse(target, context, [], plan);
            if (!result.ok) {
                return { ok: false, closure: result.context.closure, failure: result.failure };
            }
            context = result.context;
        }

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
        plan: EffectivePlan,
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

                const originalIdentity = plan.sourceByTarget.get(targetCourseId) || targetCourseId;

                if (allowedTargets.has(targetCourseId) || allowedTargets.has(originalIdentity)) {
                    continue;
                }

                return {
                    type: "track_lock",
                    sourceCourseId,
                    targetCourseId,
                    blockerCourseId: sourceCourseId,
                    continuationTargets: [...allowedTargets],
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
                const nestedReason = failure.causes?.map((cause) => this.describeFailure(cause, focusCourseId)).find(Boolean);
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
        return dnf.filter((orBlock) => !orBlock.some((id) => targets.has(id)));
    }
}

// ------------------------------------------------------ rating store ------
//
// One ballot per voter per course, and that ballot is editable: a voter who
// comes back can move their 7 to a 9. Changing a ballot shifts the tally sum by
// the delta and leaves the count alone — it is still one student's opinion, so
// the course must not gain a second "student vote" for it.
//
// Voter identity is a durable anonymous token (see resolveVoter below). The
// ballot key is `ratevote:<course>:<voter>`; first write claims it with SET NX
// so a genuinely new vote can never be double counted by a read-then-write
// race, and later edits swap it with GETSET so the delta is read atomically.
//
// Persistence uses the Upstash / Vercel KV REST API when the environment
// provides credentials. Without them the process falls back to an in-memory
// tally, which is per-instance and does NOT survive a cold start — fine for
// local dev, not for production. GET /api/ratings reports which one is live.

const RATING_MIN = 1;
const RATING_MAX = 10;

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const KV_ENABLED = !!(KV_URL && KV_TOKEN);

const BALLOT_KEY = (courseId: string, voterId: string) => `ratevote:${courseId}:${voterId}`;
const TALLY_KEY = (courseId: string) => `ratetally:${courseId}`;
const INDEX_KEY = "ratecourses";

interface RatingAggregate {
    courseId: string;
    sum: number;
    count: number;
    average: number;
}

// In-memory fallback.
const memBallots = new Map<string, number>();
const memTallies = new Map<string, { sum: number; count: number }>();

async function kv(commands: (string | number)[][]): Promise<any[]> {
    const response = await fetch(`${KV_URL.replace(/\/$/, "")}/pipeline`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${KV_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(commands),
    });
    if (!response.ok) {
        throw new Error(`Rating store unavailable (${response.status})`);
    }
    const rows = (await response.json()) as any[];
    const failed = rows.find((r) => r && r.error);
    if (failed) throw new Error(`Rating store error: ${failed.error}`);
    return rows.map((r) => (r ? r.result : null));
}

function makeAggregate(courseId: string, sum: number, count: number): RatingAggregate {
    return { courseId, sum, count, average: count > 0 ? sum / count : 0 };
}

async function readTally(courseId: string): Promise<RatingAggregate> {
    if (!KV_ENABLED) {
        const t = memTallies.get(courseId);
        return makeAggregate(courseId, t?.sum ?? 0, t?.count ?? 0);
    }
    const [raw] = await kv([["HMGET", TALLY_KEY(courseId), "sum", "count"]]);
    const sum = Number(Array.isArray(raw) ? raw[0] : 0) || 0;
    const count = Number(Array.isArray(raw) ? raw[1] : 0) || 0;
    return makeAggregate(courseId, sum, count);
}

async function readVoterBallot(courseId: string, voterId: string): Promise<number | null> {
    if (!KV_ENABLED) {
        const v = memBallots.get(BALLOT_KEY(courseId, voterId));
        return typeof v === "number" ? v : null;
    }
    const [raw] = await kv([["GET", BALLOT_KEY(courseId, voterId)]]);
    const value = Number(raw);
    return Number.isFinite(value) && raw !== null ? value : null;
}

async function listTallies(): Promise<RatingAggregate[]> {
    if (!KV_ENABLED) {
        return Array.from(memTallies.entries()).map(([courseId, t]) =>
            makeAggregate(courseId, t.sum, t.count),
        );
    }
    const [ids] = await kv([["SMEMBERS", INDEX_KEY]]);
    const courseIds: string[] = Array.isArray(ids) ? ids : [];
    if (courseIds.length === 0) return [];
    const rows = await kv(courseIds.map((id) => ["HMGET", TALLY_KEY(id), "sum", "count"]));
    return courseIds.map((id, i) => {
        const raw = rows[i];
        const sum = Number(Array.isArray(raw) ? raw[0] : 0) || 0;
        const count = Number(Array.isArray(raw) ? raw[1] : 0) || 0;
        return makeAggregate(id, sum, count);
    });
}

export type BallotOutcome = "created" | "changed" | "unchanged";

/**
 * Record a vote, or move an existing one. A voter always owns exactly one
 * ballot per course: the first write creates it and bumps `count`, every later
 * write only shifts `sum` by the delta. That is what keeps "3 student votes"
 * honest when one of those three students changes their mind twice.
 */
async function castVote(
    courseId: string,
    voterId: string,
    value: number,
): Promise<{ outcome: BallotOutcome; yourVote: number; previousVote: number | null; aggregate: RatingAggregate }> {
    if (!KV_ENABLED) {
        const key = BALLOT_KEY(courseId, voterId);
        const existing = memBallots.get(key);
        const tally = memTallies.get(courseId) ?? { sum: 0, count: 0 };

        if (typeof existing === "number") {
            if (existing === value) {
                return { outcome: "unchanged", yourVote: value, previousVote: existing, aggregate: await readTally(courseId) };
            }
            memBallots.set(key, value);
            tally.sum += value - existing;
            memTallies.set(courseId, tally);
            return {
                outcome: "changed",
                yourVote: value,
                previousVote: existing,
                aggregate: makeAggregate(courseId, tally.sum, tally.count),
            };
        }

        memBallots.set(key, value);
        tally.sum += value;
        tally.count += 1;
        memTallies.set(courseId, tally);
        return {
            outcome: "created",
            yourVote: value,
            previousVote: null,
            aggregate: makeAggregate(courseId, tally.sum, tally.count),
        };
    }

    // SET NX decides "is this a new ballot?" atomically, so two simultaneous
    // first votes from one voter can never both bump the count.
    const [claimed] = await kv([["SET", BALLOT_KEY(courseId, voterId), value, "NX"]]);
    if (claimed === "OK") {
        const results = await kv([
            ["SADD", INDEX_KEY, courseId],
            ["HINCRBY", TALLY_KEY(courseId), "sum", value],
            ["HINCRBY", TALLY_KEY(courseId), "count", 1],
        ]);
        return {
            outcome: "created",
            yourVote: value,
            previousVote: null,
            aggregate: makeAggregate(courseId, Number(results[1]) || 0, Number(results[2]) || 0),
        };
    }

    // The ballot exists. GETSET swaps in the new value and hands back the old
    // one in a single command, so the delta can't be computed from a stale read.
    const [rawPrevious] = await kv([["GETSET", BALLOT_KEY(courseId, voterId), value]]);
    const previous = Number(rawPrevious);
    if (!Number.isFinite(previous) || rawPrevious === null) {
        // The ballot expired between the two commands; treat it as a fresh one.
        const results = await kv([
            ["SADD", INDEX_KEY, courseId],
            ["HINCRBY", TALLY_KEY(courseId), "sum", value],
            ["HINCRBY", TALLY_KEY(courseId), "count", 1],
        ]);
        return {
            outcome: "created",
            yourVote: value,
            previousVote: null,
            aggregate: makeAggregate(courseId, Number(results[1]) || 0, Number(results[2]) || 0),
        };
    }

    if (previous === value) {
        return { outcome: "unchanged", yourVote: value, previousVote: previous, aggregate: await readTally(courseId) };
    }

    // Only the sum moves. The count already includes this voter.
    const results = await kv([
        ["HINCRBY", TALLY_KEY(courseId), "sum", value - previous],
        ["HMGET", TALLY_KEY(courseId), "sum", "count"],
    ]);
    const row = results[1];
    const count = Number(Array.isArray(row) ? row[1] : 0) || 0;
    return {
        outcome: "changed",
        yourVote: value,
        previousVote: previous,
        aggregate: makeAggregate(courseId, Number(results[0]) || 0, count),
    };
}

/** Every ballot this voter has on file, so a returning device restores its votes. */
async function readVoterBallots(voterId: string, courseIds: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    if (!voterId || courseIds.length === 0) return out;

    if (!KV_ENABLED) {
        courseIds.forEach((id) => {
            const v = memBallots.get(BALLOT_KEY(id, voterId));
            if (typeof v === "number") out[id] = v;
        });
        return out;
    }

    const [values] = await kv([["MGET", ...courseIds.map((id) => BALLOT_KEY(id, voterId))]]);
    const list: any[] = Array.isArray(values) ? values : [];
    courseIds.forEach((id, i) => {
        const v = Number(list[i]);
        if (list[i] !== null && list[i] !== undefined && Number.isFinite(v)) out[id] = v;
    });
    return out;
}

// -------------------------------------------------- course summaries ------
//
// GET /api/description/:courseId returns a human-readable summary of a course.
// The text itself comes from a third-party service you point the API at — this
// file only defines the contract, calls it, caches it, and normalises whatever
// comes back. See docs/input.md for the wiring instructions.
//
//   DESCRIPTION_API_URL          the service endpoint (absent = feature off)
//   DESCRIPTION_API_KEY          optional credential
//   DESCRIPTION_API_AUTH_HEADER  header to send it in (default Authorization)
//   DESCRIPTION_API_TIMEOUT_MS   per-request deadline (default 8000)
//   DESCRIPTION_CACHE_TTL_S      how long a summary is reused (default 7 days)
//
// With no URL configured the endpoint still answers 200, falling back to the
// catalog's own description — a page that renders summaries never goes blank
// just because the provider isn't wired up yet.

const DESCRIPTION_URL = process.env.DESCRIPTION_API_URL || "";
const DESCRIPTION_KEY = process.env.DESCRIPTION_API_KEY || "";
const DESCRIPTION_AUTH_HEADER = process.env.DESCRIPTION_API_AUTH_HEADER || "Authorization";
const DESCRIPTION_TIMEOUT_MS = Number(process.env.DESCRIPTION_API_TIMEOUT_MS) || 8000;
const DESCRIPTION_TTL_S = Number(process.env.DESCRIPTION_CACHE_TTL_S) || 60 * 60 * 24 * 7;
const DESCRIPTION_ENABLED = !!DESCRIPTION_URL;

const DESCRIPTION_KEY_OF = (courseId: string) => `ratedesc:v1:${courseId}`;

interface CourseSummary {
    courseId: string;
    name: string;
    summary: string;
    highlights: string[];
    workload: string;
    bestFor: string;
    difficulty: string;
    provider: string;
    model: string;
    generatedAt: string;
    /** True when this is the catalog's own text, not a generated summary. */
    fallback: boolean;
}

const memSummaries = new Map<string, { value: CourseSummary; expiresAt: number }>();

function asText(value: unknown): string {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
}

function asTextList(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(asText).filter(Boolean).slice(0, 8);
    const single = asText(value);
    return single ? [single] : [];
}

/**
 * Pull our shape out of whatever the provider returned. Providers wrap their
 * payloads differently (`{...}`, `{ data: {...} }`, `{ result: {...} }`, or a
 * bare string), so unwrap before reading rather than demanding one envelope.
 */
function normaliseSummary(course: FlatCourse, raw: any, provider: string): CourseSummary | null {
    let payload = raw;
    if (typeof payload === "string") payload = { summary: payload };
    if (payload && typeof payload === "object") {
        if (payload.data && typeof payload.data === "object") payload = payload.data;
        else if (payload.result && typeof payload.result === "object") payload = payload.result;
    }
    if (!payload || typeof payload !== "object") return null;

    const summary = asText(payload.summary) || asText(payload.text) || asText(payload.content) || asText(payload.description);
    if (!summary) return null;

    return {
        courseId: course.id,
        name: asText(course.name) || course.id,
        summary,
        highlights: asTextList(payload.highlights ?? payload.bullets ?? payload.points),
        workload: asText(payload.workload),
        bestFor: asText(payload.bestFor ?? payload.best_for ?? payload.audience),
        difficulty: asText(payload.difficulty),
        provider,
        model: asText(payload.model),
        generatedAt: new Date().toISOString(),
        fallback: false,
    };
}

/** The catalog's own words, used when no provider is configured or it fails. */
function catalogSummary(course: FlatCourse): CourseSummary {
    const review = asText(course.crowdReview);
    return {
        courseId: course.id,
        name: asText(course.name) || course.id,
        summary: asText(course.description) || "No description on file for this course yet.",
        highlights: review ? [review] : [],
        workload: "",
        bestFor: "",
        difficulty: asText(course.level),
        provider: "catalog",
        model: "",
        generatedAt: new Date().toISOString(),
        fallback: true,
    };
}

async function readCachedSummary(courseId: string): Promise<CourseSummary | null> {
    if (!KV_ENABLED) {
        const hit = memSummaries.get(courseId);
        if (hit && hit.expiresAt > Date.now()) return hit.value;
        if (hit) memSummaries.delete(courseId);
        return null;
    }
    try {
        const [raw] = await kv([["GET", DESCRIPTION_KEY_OF(courseId)]]);
        if (typeof raw !== "string" || !raw) return null;
        return JSON.parse(raw) as CourseSummary;
    } catch {
        return null; // a broken cache entry must not break the endpoint
    }
}

async function writeCachedSummary(summary: CourseSummary): Promise<void> {
    if (!KV_ENABLED) {
        memSummaries.set(summary.courseId, {
            value: summary,
            expiresAt: Date.now() + DESCRIPTION_TTL_S * 1000,
        });
        return;
    }
    try {
        await kv([["SET", DESCRIPTION_KEY_OF(summary.courseId), JSON.stringify(summary), "EX", DESCRIPTION_TTL_S]]);
    } catch {
        /* the summary is still returned; it just isn't reused */
    }
}

/** The request body every provider receives. Documented in docs/input.md. */
function describeRequest(course: FlatCourse, catalog: CourseModel, locale: string) {
    return {
        version: 1,
        courseId: course.id,
        name: asText(course.name) || course.id,
        department: course.department,
        grade: course.grade,
        track: course.track,
        level: asText(course.level),
        catalogDescription: asText(course.description),
        catalogReview: asText(course.crowdReview),
        catalogRating: Number(course.crowdRating) || 0,
        prerequisites: course.rules?.pre ?? [],
        corequisites: course.rules?.current ?? [],
        catalogVersion: catalog.version,
        locale,
    };
}

async function fetchSummary(course: FlatCourse, catalog: CourseModel, locale: string): Promise<CourseSummary> {
    if (!DESCRIPTION_ENABLED) return catalogSummary(course);

    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
    if (DESCRIPTION_KEY) {
        headers[DESCRIPTION_AUTH_HEADER] =
            DESCRIPTION_AUTH_HEADER.toLowerCase() === "authorization" ? `Bearer ${DESCRIPTION_KEY}` : DESCRIPTION_KEY;
    }

    // Without a deadline a hung provider holds the function open until the
    // platform kills it, and the caller sees a timeout instead of a summary.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), DESCRIPTION_TIMEOUT_MS);
    try {
        const response = await fetch(DESCRIPTION_URL, {
            method: "POST",
            headers,
            body: JSON.stringify(describeRequest(course, catalog, locale)),
            signal: abort.signal,
        });
        if (!response.ok) throw new Error(`Description provider returned ${response.status}`);

        const text = await response.text();
        let parsed: any = text;
        try {
            parsed = JSON.parse(text);
        } catch {
            /* a plain-text summary is acceptable */
        }

        const host = (() => {
            try {
                return new URL(DESCRIPTION_URL).host;
            } catch {
                return "provider";
            }
        })();

        const summary = normaliseSummary(course, parsed, host);
        if (!summary) throw new Error("Description provider returned no summary field");
        return summary;
    } finally {
        clearTimeout(timer);
    }
}

// --------------------------------------------------- voter identity ------
//
// The voter token is what stops one person's vote being counted twice, so it
// has to outlive a page reload, a closed tab, and a new browser session. It
// lives in two places at once:
//
//   1. an `ccvoter` cookie the server sets for a year — survives localStorage
//      being cleared, and is sent automatically on every request;
//   2. localStorage on the client — survives the cookie being cleared, and is
//      echoed back in the request so the server can re-issue the same token.
//
// Whichever one survives restores the other, and the resolved id always comes
// back in the response body so the client can store the authoritative value.
// This is deliberately not a fingerprint: it identifies a browser profile, not
// a person, and a determined re-voter can still clear both. That trade is the
// point — the alternative is tracking students.

const VOTER_COOKIE = "ccvoter";
const VOTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year
const VOTER_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function readCookie(req: any, name: string): string {
    const header = req.headers?.cookie;
    if (typeof header !== "string" || !header) return "";
    for (const part of header.split(";")) {
        const eq = part.indexOf("=");
        if (eq === -1) continue;
        if (part.slice(0, eq).trim() !== name) continue;
        try {
            return decodeURIComponent(part.slice(eq + 1).trim());
        } catch {
            return part.slice(eq + 1).trim();
        }
    }
    return "";
}

function newVoterId(): string {
    try {
        if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `v1-${crypto.randomUUID()}`;
    } catch {
        /* fall through to the arithmetic id */
    }
    return `v1-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * Settle on one voter id for this request and make sure both stores hold it.
 * The cookie wins when both are present and disagree: it is the one the client
 * cannot silently rewrite, so it keeps a tampered localStorage value from
 * minting a second ballot.
 */
function resolveVoter(req: any, res: any, claimed: unknown): string {
    const fromCookie = readCookie(req, VOTER_COOKIE);
    const fromClient = typeof claimed === "string" ? claimed.trim() : "";

    const cookieOk = VOTER_ID_PATTERN.test(fromCookie);
    const clientOk = VOTER_ID_PATTERN.test(fromClient);

    const voterId = cookieOk ? fromCookie : clientOk ? fromClient : newVoterId();

    // Re-set on every request so the year-long window slides forward for
    // anyone who keeps using the site, instead of expiring mid-semester.
    const cookie = [
        `${VOTER_COOKIE}=${encodeURIComponent(voterId)}`,
        "Path=/",
        `Max-Age=${VOTER_COOKIE_MAX_AGE}`,
        "SameSite=Lax",
        "Secure",
        "HttpOnly",
    ].join("; ");
    const existing = res.getHeader ? res.getHeader("Set-Cookie") : undefined;
    const merged = Array.isArray(existing) ? [...existing, cookie] : existing ? [existing as string, cookie] : [cookie];
    res.setHeader("Set-Cookie", merged);

    return voterId;
}

// ------------------------------------------------- observability ----------
//
// One structured line per request, on stdout, where Vercel's log drain picks it
// up. JSON rather than prose so it can be queried: filter by status, group by
// route, chart p95 duration. No request bodies and no voter tokens are logged —
// a log that identifies who voted what defeats the point of anonymous ballots.

const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES) || 16 * 1024;

/** Ids already written, so the finally-block doesn't log a request twice. */
const loggedRequests = new Set<string>();

function readRequestId(req: any): string {
    const header = req.headers?.["x-request-id"] ?? req.headers?.["x-vercel-id"];
    if (typeof header === "string" && header && header.length <= 200) return header;
    try {
        if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    } catch {
        /* fall through */
    }
    return `req-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** Reject oversized bodies before parsing rather than after. */
function isBodyWithinLimit(req: any): boolean {
    const declared = Number(req.headers?.["content-length"]);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return false;
    const body = req.body;
    if (typeof body === "string" && body.length > MAX_BODY_BYTES) return false;
    return true;
}

function logRequest(
    req: any,
    res: any,
    info: { requestId: string; route: string; status: number; startedAt: number; error?: string },
): void {
    loggedRequests.add(info.requestId);
    const line = {
        level: info.status >= 500 ? "error" : info.status >= 400 ? "warn" : "info",
        msg: "request",
        requestId: info.requestId,
        method: req.method,
        route: `/api/${info.route}`,
        status: info.status,
        durationMs: Date.now() - info.startedAt,
        kv: KV_ENABLED,
        ...(info.error ? { error: info.error } : {}),
    };
    // console.log is the supported transport on Vercel functions.
    console.log(JSON.stringify(line));
}

// -------------------------------------------------------- rate limits -----
//
// A fixed window per client per bucket, counted in KV so the limit holds across
// serverless instances instead of per-lambda. Reads are cheap and mostly served
// from the CDN, so only the endpoints that cost us something are metered:
// writes, and calls that hit the third-party summariser.
//
// Without KV the counters are per-instance — enough to blunt a runaway script
// in local dev, not a real limit. Deployments that need one need KV.

interface RateLimitRule {
    /** Requests allowed per window. */
    limit: number;
    /** Window length in seconds. */
    windowS: number;
}

const RATE_LIMITS: Record<string, RateLimitRule> = {
    // Roughly "rate a course every few seconds, all day" — generous for a
    // student browsing the catalog, useless for a script stuffing the ballot.
    vote: { limit: Number(process.env.RATE_LIMIT_VOTES) || 60, windowS: 60 * 10 },
    // Each miss costs a provider call, so this one protects our bill.
    description: { limit: Number(process.env.RATE_LIMIT_DESCRIPTIONS) || 60, windowS: 60 * 10 },
};

interface RateVerdict {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetS: number;
}

const memRate = new Map<string, { count: number; expiresAt: number }>();

/** The identity a limit is counted against: the voter token, else the caller IP. */
function rateSubject(req: any, voterId: string): string {
    if (voterId) return `v:${voterId}`;
    const forwarded = req.headers?.["x-forwarded-for"];
    const ip = typeof forwarded === "string" ? forwarded.split(",")[0]!.trim() : "";
    return `ip:${ip || req.socket?.remoteAddress || "unknown"}`;
}

async function checkRateLimit(bucket: keyof typeof RATE_LIMITS, subject: string): Promise<RateVerdict> {
    const rule = RATE_LIMITS[bucket]!;
    const window = Math.floor(Date.now() / 1000 / rule.windowS);
    const key = `ratelimit:${bucket}:${window}:${subject}`;

    let count: number;
    if (!KV_ENABLED) {
        const hit = memRate.get(key);
        const now = Date.now();
        if (hit && hit.expiresAt > now) {
            hit.count += 1;
            count = hit.count;
        } else {
            memRate.set(key, { count: 1, expiresAt: now + rule.windowS * 1000 });
            count = 1;
        }
        // Bound the map so a long-lived instance can't grow it without limit.
        if (memRate.size > 10_000) {
            for (const [k, v] of memRate) if (v.expiresAt <= now) memRate.delete(k);
        }
    } else {
        try {
            // INCR then EXPIRE: the first request in a window creates the key
            // and sets its TTL, so counters clean themselves up.
            const [incremented] = await kv([["INCR", key]]);
            count = Number(incremented) || 1;
            if (count === 1) await kv([["EXPIRE", key, rule.windowS]]);
        } catch {
            // A limiter outage must not take the endpoint down with it.
            return { allowed: true, limit: rule.limit, remaining: rule.limit, resetS: rule.windowS };
        }
    }

    const resetS = (window + 1) * rule.windowS - Math.floor(Date.now() / 1000);
    return {
        allowed: count <= rule.limit,
        limit: rule.limit,
        remaining: Math.max(0, rule.limit - count),
        resetS: Math.max(1, resetS),
    };
}

function applyRateHeaders(res: any, verdict: RateVerdict): void {
    res.setHeader("RateLimit-Limit", String(verdict.limit));
    res.setHeader("RateLimit-Remaining", String(verdict.remaining));
    res.setHeader("RateLimit-Reset", String(verdict.resetS));
}

// ------------------------------------------------------ http helpers ------

// Origins allowed to make *credentialed* calls — ones that carry the voter
// cookie. Anything else still gets the open, anonymous API. Echoing back an
// arbitrary Origin with Allow-Credentials would let any site on the web read a
// student's ballots using their own cookie, so the allowlist is the boundary.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);

function isAllowedOrigin(origin: string): boolean {
    if (!origin) return false;
    const normalised = origin.replace(/\/$/, "");
    if (ALLOWED_ORIGINS.includes(normalised)) return true;
    // Vercel gives every deployment its own hostname; the project's own preview
    // and production URLs are the same app and are trusted alongside it.
    const self = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
    if (self && normalised === self) return true;
    if (process.env.NODE_ENV !== "production" && /^http:\/\/localhost(:\d+)?$/.test(normalised)) return true;
    return false;
}

function withCors(res: any, methods = "GET, POST, OPTIONS", origin = "") {
    // The voter cookie only rides along cross-origin when the exact origin is
    // echoed back; "*" is incompatible with credentials. Unlisted origins keep
    // the open anonymous API, just without the cookie.
    if (isAllowedOrigin(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
        res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", methods);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Expose-Headers", "RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, X-Request-Id");
    res.setHeader("Access-Control-Max-Age", "86400");
}

/** Headers every API response carries, cheap insurance against content sniffing. */
function withSecurityHeaders(res: any): void {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
}

function ok(res: any, data: unknown, cacheSeconds = 300) {
    res.setHeader("Cache-Control", `s-maxage=${cacheSeconds}, stale-while-revalidate`);
    return res.status(200).json({ ok: true, data });
}

// POST results depend entirely on the request body, which shared caches key nothing on.
function okUncached(res: any, data: unknown) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, data });
}

/**
 * Machine-readable failure codes. Clients should branch on `code`, not on the
 * message text, which is written for humans and may be reworded.
 */
type ErrorCode =
    | "bad_request"
    | "not_found"
    | "method_not_allowed"
    | "payload_too_large"
    | "rate_limited"
    | "upstream_unavailable"
    | "internal_error";

function fail(res: any, status: number, message: string, allow = "POST, OPTIONS", code?: ErrorCode) {
    if (status === 405) res.setHeader("Allow", allow);
    res.setHeader("Cache-Control", "no-store");
    const resolved: ErrorCode =
        code ??
        (status === 404
            ? "not_found"
            : status === 405
              ? "method_not_allowed"
              : status === 413
                ? "payload_too_large"
                : status === 429
                  ? "rate_limited"
                  : status === 502
                    ? "upstream_unavailable"
                    : status >= 500
                      ? "internal_error"
                      : "bad_request");
    return res.status(status).json({ ok: false, error: message, code: resolved });
}

function parsePlanBody(body: any): { selected: Set<string>; moveUps: Map<string, string> } {
    // Vercel only pre-parses the body when Content-Type is application/json. Without this,
    // a client that omits the header gets an empty plan back reported as "valid".
    if (typeof body === "string") {
        const trimmed = body.trim();
        if (!trimmed) throw new Error("Request body is empty; expected JSON { selected, moveUps }");
        try {
            body = JSON.parse(trimmed);
        } catch {
            throw new Error("Request body is not valid JSON");
        }
    }
    if (body === null || body === undefined) {
        throw new Error("Request body is empty; expected JSON { selected, moveUps }");
    }
    if (typeof body !== "object" || Array.isArray(body)) {
        throw new Error("Request body must be a JSON object { selected, moveUps }");
    }
    if (body.selected !== undefined && !Array.isArray(body.selected)) {
        throw new Error("`selected` must be an array of course ids");
    }
    if (body.moveUps !== undefined && (typeof body.moveUps !== "object" || body.moveUps === null || Array.isArray(body.moveUps))) {
        throw new Error("`moveUps` must be an object mapping source id -> target id");
    }

    const selected = new Set<string>(
        Array.isArray(body?.selected) ? body.selected.filter((x: any) => typeof x === "string") : [],
    );
    const moveUps = new Map<string, string>(
        Object.entries(body?.moveUps ?? {}).filter(
            ([k, v]) => typeof k === "string" && typeof v === "string",
        ) as [string, string][],
    );
    return { selected, moveUps };
}

// ------------------------------------------------------------ router ------

export default async function handler(req: any, res: any) {
    const startedAt = Date.now();
    const origin = typeof req.headers?.origin === "string" ? req.headers.origin : "";
    withCors(res, "GET, POST, OPTIONS", origin);
    withSecurityHeaders(res);

    // One id per request, echoed to the caller and stamped on every log line,
    // so a user reporting "it failed at 3pm" can be traced to one invocation.
    const requestId = readRequestId(req);
    res.setHeader("X-Request-Id", requestId);

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    // Resolve the path segments. Vercel passes catch-all segments in req.query.path;
    // fall back to parsing req.url just in case.
    let segments: string[] = [];
    const qp = req.query?.path;
    if (Array.isArray(qp)) segments = qp.filter(Boolean);
    else if (typeof qp === "string" && qp) segments = [qp];
    if (segments.length === 0 && typeof req.url === "string") {
        const pathname = req.url.split("?")[0];
        segments = pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
    }

    const route = segments.join("/").toLowerCase();
    const q = req.query ?? {};

    try {
        if (!isBodyWithinLimit(req)) {
            logRequest(req, res, { requestId, route, status: 413, startedAt });
            return fail(res, 413, "Request body is too large", "POST, OPTIONS", "payload_too_large");
        }

        // ---- liveness / info (no catalog needed) ----
        if (route === "ping") {
            return ok(res, "pong");
        }

        if (route === "") {
            const catalog = await getCatalog();
            return ok(res, {
                service: "SHSID CC Advisor API",
                version: catalog.version,
                lastUpdated: catalog.lastUpdated,
                docs: "https://github.com/Ziqian-Huang0607/SHSID_CC_Advisor/blob/main/docs/API.md",
                endpoints: [
                    "GET  /api              — this directory",
                    "GET  /api/ping         — liveness probe",
                    "GET  /api/status       — health check",
                    "GET  /api/meta         — catalog metadata (name, version, counts)",
                    "GET  /api/catalog      — full raw catalog (nested by department/grade)",
                    "GET  /api/courses      — flat list of all courses; filters: ?grade=&track=&department=&q=&available=",
                    "GET  /api/courses/:id  — one course by id",
                    "GET  /api/grades       — list of grades",
                    "GET  /api/tracks       — list of tracks",
                    "GET  /api/departments  — departments with course counts",
                    "POST /api/validate     — validate a course plan; body: { \"selected\": [...ids], \"moveUps\": { \"srcId\": \"targetId\" } }",
                    "POST /api/availability — availability state for every course given a plan; same body as /api/validate",
                    "GET  /api/ratings      — crowd rating tallies; also returns your own ballots",
                    "GET  /api/ratings/:id  — tallies for one course, plus your own vote",
                    "POST /api/ratings      — cast or change your vote; body: { \"courseId\": \"...\", \"value\": 1-10 }",
                    "GET  /api/description/:id — third-party course summary; ?refresh=1 bypasses the cache",
                ],
            });
        }

        if (route === "status") {
            // A readiness probe, not a liveness one: it reports whether the
            // things this service depends on actually answer. Use /api/ping for
            // "is the function running at all".
            const [catalogCheck, storeCheck] = await Promise.all([
                (async () => {
                    const started = Date.now();
                    try {
                        const catalog = await getCatalog();
                        return { ok: true, latencyMs: Date.now() - started, version: catalog.version, lastUpdated: catalog.lastUpdated };
                    } catch (e: any) {
                        return { ok: false, latencyMs: Date.now() - started, error: e?.message ?? "catalog unavailable" };
                    }
                })(),
                (async () => {
                    if (!KV_ENABLED) {
                        return {
                            ok: false,
                            configured: false,
                            durable: false,
                            note: "No KV credentials. Ratings live in function memory and are lost on a cold start.",
                        };
                    }
                    const started = Date.now();
                    try {
                        await kv([["PING"]]);
                        return { ok: true, configured: true, durable: true, latencyMs: Date.now() - started };
                    } catch (e: any) {
                        return { ok: false, configured: true, durable: false, error: e?.message ?? "store unreachable" };
                    }
                })(),
            ]);

            const healthy = catalogCheck.ok && storeCheck.ok;
            res.setHeader("Cache-Control", "no-store");
            return res.status(healthy ? 200 : 503).json({
                ok: healthy,
                data: {
                    status: healthy ? "ok" : "degraded",
                    time: new Date().toISOString(),
                    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
                    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
                    checks: {
                        catalog: catalogCheck,
                        ratingStore: storeCheck,
                        descriptionProvider: { configured: DESCRIPTION_ENABLED },
                    },
                    catalogVersion: (catalogCheck as any).version ?? null,
                    lastUpdated: (catalogCheck as any).lastUpdated ?? null,
                },
            });
        }

        if (route === "meta") {
            const catalog = await getCatalog(q.refresh === "true");
            return ok(res, {
                catalogName: catalog.catalogName,
                version: catalog.version,
                lastUpdated: catalog.lastUpdated,
                credit: catalog.credit,
                footnote: catalog.footnote,
                grades: catalog.grades,
                tracks: catalog.tracks,
                courseCount: flattenCourses(catalog).length,
                departments: Object.keys(catalog.departments || {}),
            });
        }

        if (route === "catalog") {
            return ok(res, await getCatalog(q.refresh === "true"));
        }

        if (route === "grades") {
            return ok(res, (await getCatalog()).grades);
        }

        if (route === "tracks") {
            return ok(res, (await getCatalog()).tracks);
        }

        if (route === "departments") {
            const catalog = await getCatalog();
            const summary = Object.entries(catalog.departments || {}).map(([name, data]: [string, any]) => {
                if (name === "residuals" && Array.isArray(data)) {
                    return { name, grades: ["Residual"], courseCount: data.length };
                }
                const grades = Object.keys(data || {});
                const courseCount = grades.reduce((n, g) => n + (Array.isArray(data[g]) ? data[g].length : 0), 0);
                return { name, grades, courseCount };
            });
            return ok(res, summary);
        }

        if (route === "courses") {
            const catalog = await getCatalog();
            let courses = flattenCourses(catalog);

            if (typeof q.grade === "string") {
                courses = courses.filter((c) => c.grade.toLowerCase() === (q.grade as string).toLowerCase());
            }
            if (typeof q.track === "string") {
                courses = courses.filter((c) => c.track.toLowerCase() === (q.track as string).toLowerCase());
            }
            if (typeof q.department === "string") {
                courses = courses.filter((c) => c.department.toLowerCase() === (q.department as string).toLowerCase());
            }
            if (typeof q.q === "string" && q.q.trim()) {
                const needle = (q.q as string).trim().toLowerCase();
                courses = courses.filter((c) =>
                    c.id.toLowerCase().includes(needle) ||
                    (c.name ?? "").toLowerCase().includes(needle) ||
                    (c.description ?? "").toLowerCase().includes(needle),
                );
            }
            if (q.available === "true") {
                const solver = new CatalogSolver(catalog);
                const state = solver.evaluateGraph();
                courses = courses.filter((c) => state[c.id]?.isAvailable);
            }

            return ok(res, { count: courses.length, courses });
        }

        if (route.startsWith("courses/")) {
            if (segments.length > 2) {
                return fail(res, 404, `Unknown endpoint: /api/${route}. Use GET /api/courses/:id.`);
            }
            const id = decodeURIComponent(segments[1] ?? "");
            if (!id) return fail(res, 400, "Missing course id");
            const catalog = await getCatalog();
            const course = flattenCourses(catalog).find(
                (c) => c.id.toLowerCase() === id.toLowerCase(),
            );
            if (!course) return fail(res, 404, `Course not found: ${id}`);
            const solver = new CatalogSolver(catalog);
            const state = solver.evaluateGraph();
            return ok(res, { ...course, availability: state[course.id] ?? null });
        }

        if (route === "validate") {
            if (req.method !== "POST") {
                return fail(res, 405, "Use POST with a JSON body: { \"selected\": [...], \"moveUps\": { ... } }");
            }
            const catalog = await getCatalog();
            let plan;
            try {
                plan = parsePlanBody(req.body);
            } catch (e: any) {
                return fail(res, 400, e?.message ?? "Invalid request body");
            }
            const { selected, moveUps } = plan;
            const solver = new CatalogSolver(catalog);
            const result = solver.simulatePlanValidity(selected, moveUps);
            const resolution = solver.resolveSelection(selected, moveUps);

            // Courses the plan entails but did not list. The solver treats a plan as
            // valid when it can invent these, so a caller building a real schedule
            // needs them spelled out rather than assumed.
            const implied = result.ok
                ? [...resolution.closure].filter(
                      (id) => !resolution.explicitTargets.has(id) && !resolution.sourceByTarget.has(id),
                  )
                : [];

            return okUncached(res, {
                valid: result.ok,
                reason: result.reason ?? null,
                failure: result.failure ?? null,
                selectedCount: selected.size,
                impliedCourses: implied,
                resolvedPlan: result.ok ? [...resolution.closure] : [],
            });
        }

        if (route === "availability") {
            if (req.method !== "POST") {
                return fail(res, 405, "Use POST with a JSON body: { \"selected\": [...], \"moveUps\": { ... } }");
            }
            const catalog = await getCatalog();
            let plan;
            try {
                plan = parsePlanBody(req.body);
            } catch (e: any) {
                return fail(res, 400, e?.message ?? "Invalid request body");
            }
            const solver = new CatalogSolver(catalog);
            solver.setSelected(plan.selected, plan.moveUps);
            return okUncached(res, solver.evaluateGraph());
        }

        if (route === "ratings" || route.startsWith("ratings/")) {
            const courseIdFromPath = segments[1] ? decodeURIComponent(segments[1]) : "";

            if (req.method === "POST") {
                const body = req.body ?? {};
                const courseId = typeof body.courseId === "string" ? body.courseId.trim() : courseIdFromPath;
                const value = Math.round(Number(body.value));

                if (!courseId) return fail(res, 400, "Missing courseId");
                if (!Number.isFinite(value) || value < RATING_MIN || value > RATING_MAX) {
                    return fail(res, 400, `value must be an integer between ${RATING_MIN} and ${RATING_MAX}`);
                }

                const catalog = await getCatalog();
                const course = flattenCourses(catalog).find(
                    (c) => c.id.toLowerCase() === courseId.toLowerCase(),
                );
                if (!course) return fail(res, 404, `Course not found: ${courseId}`);

                // The cookie, not the body, is the source of truth for who this
                // is — so a cleared localStorage can't buy a second ballot.
                const voterId = resolveVoter(req, res, body.voterId);

                const verdict = await checkRateLimit("vote", rateSubject(req, voterId));
                applyRateHeaders(res, verdict);
                if (!verdict.allowed) {
                    res.setHeader("Retry-After", String(verdict.resetS));
                    return fail(res, 429, "Too many rating requests. Try again shortly.", "POST, OPTIONS", "rate_limited");
                }

                const result = await castVote(course.id, voterId, value);
                res.setHeader("Cache-Control", "no-store");
                return res.status(200).json({
                    ok: true,
                    data: {
                        accepted: true,
                        outcome: result.outcome, // created | changed | unchanged
                        voterId,
                        yourVote: result.yourVote,
                        previousVote: result.previousVote,
                        aggregate: result.aggregate,
                        baseline: Number(course.crowdRating) || 0,
                    },
                });
            }

            if (req.method !== "GET") {
                return fail(res, 405, "Use GET to read ratings or POST to cast a vote", "GET, POST, OPTIONS");
            }

            res.setHeader("Cache-Control", "no-store");
            if (courseIdFromPath) {
                const catalog = await getCatalog();
                const course = flattenCourses(catalog).find(
                    (c) => c.id.toLowerCase() === courseIdFromPath.toLowerCase(),
                );
                if (!course) return fail(res, 404, `Course not found: ${courseIdFromPath}`);
                const voterId = resolveVoter(req, res, q.voterId);
                return res.status(200).json({
                    ok: true,
                    data: {
                        courseId: course.id,
                        voterId,
                        baseline: Number(course.crowdRating) || 0,
                        aggregate: await readTally(course.id),
                        yourVote: await readVoterBallot(course.id, voterId),
                    },
                });
            }

            const voterId = resolveVoter(req, res, q.voterId);
            const ratings = await listTallies();
            return res.status(200).json({
                ok: true,
                data: {
                    persistent: KV_ENABLED,
                    scale: { min: RATING_MIN, max: RATING_MAX },
                    editable: true,
                    voterId,
                    ratings,
                    // Lets a returning browser rebuild "you rated this" for every
                    // course without one request per course.
                    yourVotes: await readVoterBallots(voterId, ratings.map((r) => r.courseId)),
                },
            });
        }

        if (route === "description" || route.startsWith("description/")) {
            if (req.method !== "GET") {
                return fail(res, 405, "Use GET to read a course description", "GET, OPTIONS");
            }

            const courseIdFromPath = segments[1] ? decodeURIComponent(segments[1]) : "";
            const courseId = courseIdFromPath || (typeof q.courseId === "string" ? q.courseId : "");
            if (!courseId) {
                return fail(res, 400, "Missing course id. Use /api/description/:courseId", "GET, OPTIONS");
            }

            const catalog = await getCatalog();
            const course = flattenCourses(catalog).find((c) => c.id.toLowerCase() === courseId.toLowerCase());
            if (!course) return fail(res, 404, `Course not found: ${courseId}`);

            const locale = typeof q.locale === "string" && q.locale ? q.locale : "en";
            const refresh = q.refresh === "1" || q.refresh === "true";

            if (!refresh) {
                const cached = await readCachedSummary(course.id);
                if (cached) {
                    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate");
                    return res.status(200).json({ ok: true, data: { ...cached, cached: true, provider_configured: DESCRIPTION_ENABLED } });
                }
            }

            // Metered only past the cache, so a hot course costs a caller nothing.
            const verdict = await checkRateLimit("description", rateSubject(req, readCookie(req, VOTER_COOKIE)));
            applyRateHeaders(res, verdict);
            if (!verdict.allowed) {
                res.setHeader("Retry-After", String(verdict.resetS));
                return fail(res, 429, "Too many description requests. Try again shortly.", "GET, OPTIONS", "rate_limited");
            }

            try {
                const summary = await fetchSummary(course, catalog, locale);
                if (!summary.fallback) await writeCachedSummary(summary);
                res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate");
                return res.status(200).json({ ok: true, data: { ...summary, cached: false, provider_configured: DESCRIPTION_ENABLED } });
            } catch (e: any) {
                // A provider outage degrades to the catalog text rather than
                // failing the request — the panel still has something to show.
                res.setHeader("Cache-Control", "no-store");
                return res.status(200).json({
                    ok: true,
                    data: {
                        ...catalogSummary(course),
                        cached: false,
                        provider_configured: DESCRIPTION_ENABLED,
                        providerError: e?.message ?? "Description provider failed",
                    },
                });
            }
        }

        logRequest(req, res, { requestId, route, status: 404, startedAt });
        return fail(res, 404, `Unknown endpoint: /api/${route}. GET /api lists all endpoints.`);
    } catch (e: any) {
        const message = e?.message ?? "Unknown error";
        logRequest(req, res, { requestId, route, status: 502, startedAt, error: message });
        return fail(res, 502, message, "POST, OPTIONS", "upstream_unavailable");
    } finally {
        // Successful paths return straight from their branch; log them here so
        // every invocation produces exactly one line whatever route it took.
        if (!loggedRequests.has(requestId)) {
            logRequest(req, res, { requestId, route, status: res.statusCode ?? 200, startedAt });
        }
        loggedRequests.delete(requestId);
    }
}
