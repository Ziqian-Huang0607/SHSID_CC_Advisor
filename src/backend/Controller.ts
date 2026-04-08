// Controller.ts
// written by willuhd on Apr 8
// - The public API controller used by the frontend
// - This is the way the UI can access the underlying logic APIs
// Please use this instead of the backend.

import { CatalogSolver, type CourseAvailabilityState } from "./Solver";
import type { CourseModel, CourseNode } from "./CourseModel";

// Make sure this is exported so your UI files can import it!
export interface CourseViewModel {
    id: string;
    name: string;
    grade: string;
    level: string;
    status: 'locked' | 'available' | 'selected' | 'bypassed'; 
    lockReason?: string;       
    moveUpNote?: string;       
}

export class CourseSelectionController {
    private solver: CatalogSolver;
    private catalogMap: Map<string, CourseNode> = new Map();
    
    private selectedIds: Set<string> = new Set();
    private moveUpOverrides: Set<string> = new Set();

    private onUpdate: (viewModels: Record<string, CourseViewModel>) => void = () => {};

    constructor(catalog: CourseModel) {
        this.solver = new CatalogSolver(catalog);
        this.buildFlattenedMap(catalog);
        
        this.solver.subscribe((internalState: Record<string, CourseAvailabilityState>) => {
            const uiState: Record<string, CourseViewModel> = {};

            this.catalogMap.forEach((course, id) => {
                const solverState = internalState[id];
                
                // TS Strict Mode Fix: Ensure solverState exists before reading it
                if (!solverState) return; 

                const isSelected = this.selectedIds.has(id);
                const isBypassed = this.moveUpOverrides.has(id);

                let status: CourseViewModel['status'] = 'locked';
                if (isSelected && isBypassed) status = 'bypassed';
                else if (isSelected) status = 'selected';
                else if (solverState.isAvailable) status = 'available';

                let lockReason = undefined;
                if (status === 'locked' && solverState.missingPre.length > 0) {
                    const missingNames = solverState.missingPre.map(orBlock => 
                        orBlock.map(reqId => this.catalogMap.get(reqId)?.name || reqId).join(" or ")
                    ).join(" AND ");
                    lockReason = `Requires: ${missingNames}`;
                }

                uiState[id] = {
                    id: course.id,
                    name: course.name || course.id,
                    grade: course.grade || "N/A",
                    level: course.level || "Standard",
                    status,
                    lockReason,
                    moveUpNote: course.moveUp
                };
            });

            this.onUpdate(uiState);
        });
    }

    private buildFlattenedMap(catalog: CourseModel) {
        Object.values(catalog.departments.biology || {}).forEach(gradeArr => 
            gradeArr.forEach(c => this.catalogMap.set(c.id, c))
        );
        (catalog.departments.residuals || []).forEach(c => this.catalogMap.set(c.id, c));
    }

    public connectView(callback: (viewModels: Record<string, CourseViewModel>) => void) {
        this.onUpdate = callback;
        // Trigger initial push
        this.solver.addCompleted(""); 
    }

    public handleTap(courseId: string) {
        if (this.selectedIds.has(courseId)) {
            this.selectedIds.delete(courseId);
            this.moveUpOverrides.delete(courseId);
            this.solver.removeCompleted(courseId);
        } else {
            // This will now work perfectly since we added getAvailability to Solver!
            if (this.solver.getAvailability(courseId)) {
                this.selectedIds.add(courseId);
                this.solver.addCompleted(courseId);
            }
        }
    }

    public handleMoveUpTap(courseId: string) {
        const course = this.catalogMap.get(courseId);
        if (course && course.moveUp) {
            this.moveUpOverrides.add(courseId);
            this.selectedIds.add(courseId);
            this.solver.addCompleted(courseId);
        }
    }
}
