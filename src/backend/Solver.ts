// Solver.ts
// rewritten to use a Declarative Constraint (SAT) engine

import type { CourseModel, CourseNode } from "./CourseModel";

export interface CourseAvailabilityState {
    isAvailable: boolean;
    missingPre: string[][];
    missingCurrent: string[][];
    moveUpInfo?: string;
    conflictReason?: string;
}

export class CatalogSolver {
    private catalog: CourseModel;
    public courseMap: Map<string, CourseNode> = new Map();
    private megs: Set<string>[] = []; 

    private selectedCourses: Set<string> = new Set();
    private moveUpOverrides: Set<string> = new Set();

    private subscribers: Array<(state: Record<string, CourseAvailabilityState>) => void> = [];

    constructor(catalog: CourseModel) {
        this.catalog = catalog;
        this.buildGraph();
    }

    private buildGraph() {
        const depts = this.catalog.departments || {};
        for (const [deptName, deptData] of Object.entries(depts)) {
            if (deptName === 'residuals' || Array.isArray(deptData)) {
                const group = new Set<string>();
                const residuals = (deptData || []) as CourseNode[];
                residuals.forEach(c => {
                    this.courseMap.set(c.id, { ...c, grade: "Residual" });
                    group.add(c.id);
                });
                if (group.size > 0) this.megs.push(group);
            } else if (typeof deptData === 'object' && deptData !== null) {
                const gradeMap = deptData as Record<string, CourseNode[]>;
                for (const grade of Object.keys(gradeMap)) {
                    const courses = gradeMap[grade];
                    if (Array.isArray(courses)) {
                        const group = new Set<string>();
                        courses.forEach(c => {
                            this.courseMap.set(c.id, { ...c, grade }); 
                            group.add(c.id);
                        });
                        if (group.size > 0) this.megs.push(group);
                    }
                }
            }
        }
    }

    public subscribe(callback: (state: Record<string, CourseAvailabilityState>) => void): () => void {
        this.subscribers.push(callback);
        callback(this.evaluateGraph());
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    public forceNotify() {
        const state = this.evaluateGraph();
        this.subscribers.forEach(cb => cb(state));
    }

    public setSelected(selected: Set<string>, overrides: Set<string>) {
        this.selectedCourses = new Set(selected);
        this.moveUpOverrides = new Set(overrides);
        this.forceNotify();
    }

    public isCourseAvailable(courseId: string): boolean {
        const testSet = new Set(this.selectedCourses);
        testSet.add(courseId);
        return this.isSatisfiable(testSet);
    }

    private isSatisfiable(currentSet: Set<string>): boolean {
        for (const group of this.megs) {
            let count = 0;
            for (const id of group) {
                if (currentSet.has(id)) count++;
            }
            if (count > 1) return false;
        }

        let missingClause: string[] | null = null;
        for (const id of currentSet) {
            if (this.moveUpOverrides.has(id)) continue;

            const node = this.courseMap.get(id);
            if (!node || !node.rules) continue;

            const checkRules = (rules?: string[][]) => {
                if (!rules) return false;
                for (const clause of rules) {
                    if (!clause.some(req => currentSet.has(req))) {
                        missingClause = clause;
                        return true;
                    }
                }
                return false;
            };

            if (checkRules(node.rules.pre)) break;
            if (checkRules(node.rules.current)) break;
        }

        if (!missingClause) return true;

        // FIXED: Explicitly tell TS missingClause is string[] to avoid 'never' error
        const targetClause: string[] = missingClause;
        for (const reqId of targetClause) {
            if (!this.courseMap.has(reqId)) continue;
            currentSet.add(reqId);
            if (this.isSatisfiable(currentSet)) {
                currentSet.delete(reqId);
                return true;
            }
            currentSet.delete(reqId);
        }

        return false;
    }

    public evaluateGraph(): Record<string, CourseAvailabilityState> {
        const state: Record<string, CourseAvailabilityState> = {};

        this.courseMap.forEach((course, id) => {
            const missingPre = this.getMissingRequirements(course.rules?.pre, this.selectedCourses);
            const missingCurrent = this.getMissingRequirements(course.rules?.current, this.selectedCourses);
            const isAvailable = this.isCourseAvailable(id);

            state[id] = {
                isAvailable,
                missingPre,
                missingCurrent,
                moveUpInfo: course.moveUp,
                conflictReason: isAvailable ? undefined : "Conflicts with a required path for your selections"
            };
        });

        return state;
    }

    private getMissingRequirements(dnf: string[][] | undefined, userState: Set<string>): string[][] {
        if (!dnf) return [] as string[][];
        return dnf.filter(orBlock => !orBlock.some(id => userState.has(id)));
    }
}