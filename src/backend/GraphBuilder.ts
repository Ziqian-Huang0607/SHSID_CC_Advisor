// GraphBuilder.ts
// - Builds a deterministic, pan-friendly Course Journey Map from the catalog.
// - Produces node positions, department lanes, grade columns, and prerequisite /
//   continuation / move-up edges so the map view can render SVG edges and HTML
//   nodes without doing layout math itself.

import type { CourseModel, CourseNode } from './CourseModel';

export interface GraphNode {
    id: string;
    dept: string;
    grade: string;
    name: string;
    track: string;
    level?: string;
    description: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string; // light-mode fill
    darkColor: string; // dark-mode fill
    stripeColor: string; // accent stripe
}

export interface GraphEdge {
    id: string;
    sourceId: string;
    targetId: string;
    kind: 'prerequisite' | 'continuation' | 'moveUp';
}

export interface DepartmentLane {
    dept: string;
    y: number;
    height: number;
    color: string;
    darkColor: string;
}

export interface GradeColumn {
    grade: string;
    x: number;
    width: number;
}

export interface GraphLayout {
    nodes: GraphNode[];
    edges: GraphEdge[];
    lanes: DepartmentLane[];
    columns: GradeColumn[];
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

// 8pt-based grid, Apple HIG friendly.
const COLUMN_WIDTH = 208;
const NODE_WIDTH = 176;
const NODE_HEIGHT = 80;
const NODE_VERTICAL_GAP = 16;
const LANE_HORIZONTAL_PADDING = 16;
const LANE_VERTICAL_GAP = 24;
const LANE_HEADER_HEIGHT = 28;
const GRADE_HEADER_HEIGHT = 40;

interface InternalCourse {
    id: string;
    dept: string;
    grade: string;
    course: CourseNode;
}

/**
 * Builds the full graph layout for the catalog.
 *
 * The layout is deterministic: grades are columns left-to-right, departments are
 * horizontal lanes stacked top-to-bottom. This keeps the map readable even when
 * zoomed out, and avoids the jitter of a force-directed layout on every render.
 */
export function buildGraphLayout(catalog: CourseModel): GraphLayout {
    const grades = catalog.grades.length > 0 ? catalog.grades : ['9', '10', '11', '12'];
    const courses = flattenCourses(catalog);
    const deptOrder = deriveDepartmentOrder(courses, catalog);

    const gradeIndex = new Map<string, number>();
    grades.forEach((g, i) => gradeIndex.set(g, i));

    const colorMap = buildDepartmentColorMap(deptOrder);

    // Group courses by (dept, grade) so we can stack them vertically.
    const bucketMap = new Map<string, InternalCourse[]>();
    for (const c of courses) {
        const key = `${c.dept}::${c.grade}`;
        const bucket = bucketMap.get(key) ?? [];
        bucket.push(c);
        bucketMap.set(key, bucket);
    }

    // Compute lane height for each department = header + tallest grade stack.
    const laneHeights = new Map<string, number>();
    for (const dept of deptOrder) {
        let maxStack = 0;
        for (const grade of grades) {
            const bucket = bucketMap.get(`${dept}::${grade}`) ?? [];
            maxStack = Math.max(maxStack, bucket.length);
        }
        const stackHeight = maxStack === 0
            ? 0
            : maxStack * NODE_HEIGHT + (maxStack - 1) * NODE_VERTICAL_GAP;
        laneHeights.set(dept, LANE_HEADER_HEIGHT + stackHeight + LANE_HORIZONTAL_PADDING);
    }

    // Build lanes with cumulative Y offsets.
    const lanes: DepartmentLane[] = [];
    let currentY = GRADE_HEADER_HEIGHT;
    for (const dept of deptOrder) {
        const height = laneHeights.get(dept) ?? LANE_HEADER_HEIGHT;
        const colors = colorMap.get(dept)!;
        lanes.push({ dept, y: currentY, height, color: colors.light, darkColor: colors.dark });
        currentY += height + LANE_VERTICAL_GAP;
    }

    // Build columns with X offsets.
    const columns: GradeColumn[] = grades.map((grade, i) => ({
        grade,
        x: i * COLUMN_WIDTH + LANE_HORIZONTAL_PADDING,
        width: COLUMN_WIDTH
    }));

    // Build nodes.
    const nodeMap = new Map<string, GraphNode>();
    const nodes: GraphNode[] = [];
    for (const lane of lanes) {
        for (const column of columns) {
            const bucket = bucketMap.get(`${lane.dept}::${column.grade}`) ?? [];
            const stackHeight = bucket.length * NODE_HEIGHT + (bucket.length - 1) * NODE_VERTICAL_GAP;
            const startY = lane.y + LANE_HEADER_HEIGHT + (lane.height - LANE_HEADER_HEIGHT - stackHeight) / 2;
            for (let i = 0; i < bucket.length; i++) {
                const c = bucket[i]!;
                const x = column.x + (COLUMN_WIDTH - NODE_WIDTH) / 2;
                const y = startY + i * (NODE_HEIGHT + NODE_VERTICAL_GAP);
                const colors = colorMap.get(c.dept)!;
                const node: GraphNode = {
                    id: c.id,
                    dept: c.dept,
                    grade: c.grade,
                    name: c.course.name || c.id,
                    track: c.course.track || '',
                    level: c.course.level,
                    description: c.course.description || '',
                    x,
                    y,
                    width: NODE_WIDTH,
                    height: NODE_HEIGHT,
                    color: colors.light,
                    darkColor: colors.dark,
                    stripeColor: colors.stripe
                };
                nodes.push(node);
                nodeMap.set(c.id, node);
            }
        }
    }

    // Build edges.
    const edges: GraphEdge[] = [];
    const edgeIdSet = new Set<string>();
    const addEdge = (sourceId: string, targetId: string, kind: GraphEdge['kind']) => {
        if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) return;
        if (sourceId === targetId) return;
        const id = `${kind}:${sourceId}->${targetId}`;
        if (edgeIdSet.has(id)) return;
        edgeIdSet.add(id);
        edges.push({ id, sourceId, targetId, kind });
    };

    for (const c of courses) {
        // Prerequisite edges: one edge per option in each OR group.
        c.course.rules?.pre?.forEach(group => {
            group.forEach(prereqId => addEdge(prereqId, c.id, 'prerequisite'));
        });

        // Concurrent edges are not rendered as arrows (they are same-grade), skip.

        // Continuation edges.
        c.course.rules?.next?.forEach(group => {
            group.forEach(nextId => addEdge(c.id, nextId, 'continuation'));
        });

        // Move-up edges.
        if (c.course.moveUpTargetId) {
            addEdge(c.id, c.course.moveUpTargetId, 'moveUp');
        }
    }

    const maxX = columns.length * COLUMN_WIDTH + LANE_HORIZONTAL_PADDING * 2;
    const maxY = currentY;

    return {
        nodes,
        edges,
        lanes,
        columns,
        bounds: { minX: 0, minY: 0, maxX, maxY }
    };
}

function flattenCourses(catalog: CourseModel): InternalCourse[] {
    const list: InternalCourse[] = [];
    const depts = catalog.departments || {};
    for (const [dept, deptData] of Object.entries(depts)) {
        if (dept === 'residuals' && Array.isArray(deptData)) {
            for (const course of deptData) {
                if (course?.id) list.push({ id: course.id, dept, grade: 'Residual', course });
            }
            continue;
        }
        if (!deptData || typeof deptData !== 'object' || Array.isArray(deptData)) continue;
        for (const [grade, courses] of Object.entries(deptData as Record<string, CourseNode[]>)) {
            if (!Array.isArray(courses)) continue;
            for (const course of courses) {
                if (course?.id) list.push({ id: course.id, dept, grade, course });
            }
        }
    }
    return list;
}

function deriveDepartmentOrder(courses: InternalCourse[], catalog: CourseModel): string[] {
    const seen = new Set<string>();
    const catalogOrder = Object.keys(catalog.departments || {});
    const ordered: string[] = [];

    // Follow catalog order first, then any departments not explicitly listed.
    for (const dept of catalogOrder) {
        if (!seen.has(dept) && courses.some(c => c.dept === dept)) {
            seen.add(dept);
            ordered.push(dept);
        }
    }
    for (const c of courses) {
        if (!seen.has(c.dept)) {
            seen.add(c.dept);
            ordered.push(c.dept);
        }
    }
    return ordered;
}

interface DeptColors {
    light: string;
    dark: string;
    stripe: string;
}

function buildDepartmentColorMap(depts: string[]): Map<string, DeptColors> {
    const map = new Map<string, DeptColors>();
    const goldenAngle = 137.508;
    for (let i = 0; i < depts.length; i++) {
        const hue = (i * goldenAngle) % 360;
        map.set(depts[i]!, {
            light: `hsl(${hue} 70% 92%)`,
            dark: `hsl(${hue} 45% 22%)`,
            stripe: `hsl(${hue} 75% 55%)`
        });
    }
    return map;
}

/** Returns the column X center for a given grade, or null if the grade is unknown. */
export function gradeCenterX(layout: GraphLayout, grade: string): number | null {
    const col = layout.columns.find(c => c.grade === grade);
    return col ? col.x + col.width / 2 : null;
}
