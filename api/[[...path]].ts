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

// ------------------------------------------------------ http helpers ------

function withCors(res: any, methods = "GET, OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", methods);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "86400");
}

function ok(res: any, data: unknown, cacheSeconds = 300) {
    res.setHeader("Cache-Control", `s-maxage=${cacheSeconds}, stale-while-revalidate`);
    return res.status(200).json({ ok: true, data });
}

function fail(res: any, status: number, message: string) {
    return res.status(status).json({ ok: false, error: message });
}

function parsePlanBody(body: any): { selected: Set<string>; moveUps: Map<string, string> } {
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
    withCors(res);
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
                ],
            });
        }

        if (route === "status") {
            const catalog = await getCatalog();
            return ok(res, {
                status: "up",
                catalogVersion: catalog.version,
                lastUpdated: catalog.lastUpdated,
                time: new Date().toISOString(),
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
            const { selected, moveUps } = parsePlanBody(req.body);
            const solver = new CatalogSolver(catalog);
            const result = solver.simulatePlanValidity(selected, moveUps);
            return ok(res, {
                valid: result.ok,
                reason: result.reason ?? null,
                failure: result.failure ?? null,
                selectedCount: selected.size,
            });
        }

        if (route === "availability") {
            if (req.method !== "POST") {
                return fail(res, 405, "Use POST with a JSON body: { \"selected\": [...], \"moveUps\": { ... } }");
            }
            const catalog = await getCatalog();
            const { selected, moveUps } = parsePlanBody(req.body);
            const solver = new CatalogSolver(catalog);
            solver.setSelected(selected, moveUps);
            return ok(res, solver.evaluateGraph());
        }

        return fail(res, 404, `Unknown endpoint: /api/${route}. GET /api lists all endpoints.`);
    } catch (e: any) {
        return fail(res, 502, e?.message ?? "Unknown error");
    }
}
