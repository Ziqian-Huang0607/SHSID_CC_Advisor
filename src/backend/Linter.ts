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

        // 1. Build Global Map (DYNAMIC FIX)
        try {
            const depts = catalog.departments || {};
            for (const [deptName, deptData] of Object.entries(depts)) {
                if (deptName === 'residuals') {
                    if (Array.isArray(deptData)) {
                        deptData.forEach(c => courseMap.set(c.id, c));
                    }
                } else if (typeof deptData === 'object' && !Array.isArray(deptData)) {
                    // It's a standard department
                    for (const grade of Object.keys(deptData as object)) {
                        const courses = (deptData as any)[grade];
                        if (Array.isArray(courses)) {
                            courses.forEach(c => courseMap.set(c.id, c));
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

        // 3. Cyclic Dependency Detection (DFS)
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
