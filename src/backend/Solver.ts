// Solver.ts
// written by willuhd on Apr 8
// 
// Solves the internal rule state configuration for cross-grade
// selections. Not intended to use in the frontend!
// PLEASE CALL CONTROLLER.ts instead of this

import type { CourseModel, CourseNode } from "./CourseModel";

export interface CourseAvailabilityState {
    isAvailable: boolean;
    missingPre: string[][];      // UI can use this to say "You are missing [X or Y]"
    missingCurrent: string[][];
    moveUpInfo?: string;         // Passed directly to UI for the bypass banner
}

export class CatalogSolver {
    private catalog: CourseModel;
    private courseMap: Map<string, CourseNode> = new Map();
    
    // User Memory State
    private completedCourses: Set<string> = new Set();
    private concurrentCourses: Set<string> = new Set();
    
    // UI Observers
    private subscribers: Array<(state: Record<string, CourseAvailabilityState>) => void> = [];

    constructor(catalog: CourseModel) {
        this.catalog = catalog;
        this.buildFlattenedMap();
    }

    private buildFlattenedMap() {
        // Flatten biology
        for (const grade of Object.keys(this.catalog.departments.biology || {})) {
            for (const course of this.catalog.departments.biology[grade]) {
                this.courseMap.set(course.id, course);
            }
        }
        // Flatten residuals
        for (const course of this.catalog.departments.residuals || []) {
            this.courseMap.set(course.id, course);
        }
    }

    /** UI subscribes here to listen to instant graph changes */
    public subscribe(callback: (state: Record<string, CourseAvailabilityState>) => void): () => void {
        this.subscribers.push(callback);
        callback(this.evaluateGraph()); // Emit initial state immediately
        
        // Return an unsubscribe function to prevent UI memory leaks
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    private notify() {
        const state = this.evaluateGraph();
        this.subscribers.forEach(cb => cb(state));
    }

    // --- State Mutations ---

    public addCompleted(courseId: string) {
        this.completedCourses.add(courseId);
        this.notify();
    }

    public removeCompleted(courseId: string) {
        this.completedCourses.delete(courseId);
        this.notify();
    }

    public toggleConcurrent(courseId: string) {
        if (this.concurrentCourses.has(courseId)) {
            this.concurrentCourses.delete(courseId);
        } else {
            this.concurrentCourses.add(courseId);
        }
        this.notify();
    }

    // --- Graph Evaluation Logic ---

    private evaluateGraph(): Record<string, CourseAvailabilityState> {
        const state: Record<string, CourseAvailabilityState> = {};

        this.courseMap.forEach((course, id) => {
            const missingPre = this.getMissingRequirements(course.rules?.pre, this.completedCourses);
            
            // Current requirements can be fulfilled by either taking it NOW, or having taken it ALREADY
            const missingCurrent = this.getMissingRequirements(course.rules?.current, new Set([...this.completedCourses, ...this.concurrentCourses]));

            const isAvailable = missingPre.length === 0 && missingCurrent.length === 0;

            state[id] = {
                isAvailable,
                missingPre,
                missingCurrent,
                moveUpInfo: course.moveUp // UI handles bypassing natively if this string exists
            };
        });

        return state;
    }

    /** 
     * Parses the Disjunctive Normal Form (DNF). 
     * Returns an array of the unsatisfied blocks. If empty, all rules are met.
     */
    private getMissingRequirements(dnf: string[][] | undefined, userState: Set<string>): string[][] {
        if (!dnf || dnf.length === 0) return [];
        
        const missing: string[][] = [];
        for (const orBlock of dnf) {
            // If the user has none of the required OR options, this block fails
            const isMet = orBlock.some(id => userState.has(id));
            if (!isMet) {
                missing.push(orBlock);
            }
        }
        return missing;
    }

    // --- Add this missing method ---
    public getAvailability(courseId: string): boolean {
        const course = this.courseMap.get(courseId);
        if (!course) return true; // If it's a residual course with no rules, it's available by default

        const missingPre = this.getMissingRequirements(course.rules?.pre, this.completedCourses);
        const missingCurrent = this.getMissingRequirements(course.rules?.current, new Set([...this.completedCourses, ...this.concurrentCourses]));

        return missingPre.length === 0 && missingCurrent.length === 0;
    }
}
