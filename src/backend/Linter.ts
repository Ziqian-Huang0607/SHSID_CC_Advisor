// Linter.ts
// written by willuhd on Apr 8
//
// A basic type check system that checks for obvious logical
// inconsistencies if the author of the catalog file (me) was
// randomly dumb
// Inconsistencies include: recursion, type fails, etc

import type { CourseModel, CourseNode } from "./CourseModel"; 

export class CatalogLinter {
    
    public static run(catalog: CourseModel): string[] {
        const errors: string[] = [];
        const courseMap = new Map<string, CourseNode>();
        const conflictGroupMap = new Map<string, string>();

        const registerCourse = (course: CourseNode, conflictGroupId?: string) => {
            if (courseMap.has(course.id)) {
                errors.push(`Duplicate Course ID detected: [${course.id}]`);
                return;
            }

            courseMap.set(course.id, course);
            if (conflictGroupId) {
                conflictGroupMap.set(course.id, conflictGroupId);
            }
        };

        // 1. Build Global Map
        try {
            const depts = catalog.departments || {};
            for (const [deptName, deptData] of Object.entries(depts)) {
                if (deptName === 'residuals') {
                    if (Array.isArray(deptData)) {
                        deptData.forEach(c => registerCourse(c));
                    }
                } else if (typeof deptData === 'object' && !Array.isArray(deptData)) {
                    for (const grade of Object.keys(deptData as object)) {
                        const courses = (deptData as any)[grade];
                        if (Array.isArray(courses)) {
                            const conflictGroupId = `${deptName}::${grade}`;
                            courses.forEach(c => registerCourse(c, conflictGroupId));
                        }
                    }
                }
            }
        } catch (e) {
            return ["Critical: Invalid catalog structure. Failed to map departments."];
        }

        // 2. Reference Checking 
        courseMap.forEach((course, id) => {
            const allRuleIds = [
                ...(course.rules?.pre?.flat() || []),
                ...(course.rules?.current?.flat() || [])
            ];

            allRuleIds.forEach(ruleId => {
                if (!courseMap.has(ruleId)) {
                    errors.push(`Reference Error in [${id}]: Requires missing course ID [${ruleId}]`);
                }
            });
        });

        // 3. Static impossibility checks for same-slot requirements
        courseMap.forEach((course, id) => {
            const sourceGroup = conflictGroupMap.get(id);
            if (!sourceGroup) return;

            (["pre", "current"] as const).forEach(kind => {
                const clauses = course.rules?.[kind] || [];

                clauses.forEach(clause => {
                    const knownOptions = clause.filter(optionId => courseMap.has(optionId));
                    if (knownOptions.length === 0) return;

                    const allInSameSlot = knownOptions.every(optionId => {
                        const optionGroup = conflictGroupMap.get(optionId);
                        return optionGroup === sourceGroup && optionId !== id;
                    });

                    if (allInSameSlot) {
                        errors.push(
                            `Constraint Conflict in [${id}]: ${kind} rule only points to courses in the same department-year slot.`
                        );
                    }
                });
            });
        });

        // 4. Cyclic Dependency Detection (DFS)
        const visitState = new Map<string, 0 | 1 | 2>();
        courseMap.forEach((_, id) => visitState.set(id, 0));

        const detectCycle = (nodeId: string, path: string[]) => {
            visitState.set(nodeId, 1);
            
            const node = courseMap.get(nodeId);
            if (node) {
                const edges = [
                    ...(node.rules?.pre?.flat() || []),
                    ...(node.rules?.current?.flat() || [])
                ];

                for (const edgeId of edges) {
                    if (visitState.get(edgeId) === 1) {
                        errors.push(`Cyclic Dependency Detected: ${path.join(' -> ')} -> ${nodeId} -> ${edgeId}`);
                    } else if (visitState.get(edgeId) === 0) {
                        detectCycle(edgeId, [...path, nodeId]);
                    }
                }
            }
            visitState.set(nodeId, 2);
        };

        courseMap.forEach((_, id) => {
            if (visitState.get(id) === 0) detectCycle(id, []);
        });

        return errors;
    }
}
