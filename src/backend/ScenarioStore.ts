// ScenarioStore.ts
// - Saves named plan scenarios locally so students can compare different 4-year
//   paths (e.g. "Pre-med" vs "Engineering") without posting anything to a server.
// - Stored in localStorage; validation against the current catalog happens on load
//   so an old scenario does not silently reference deleted courses.

import { normalizePlan, type PlanSnapshot } from './PlanCodec';
import type { CourseModel } from './CourseModel';

const SCENARIOS_KEY = 'shsid-cc.scenarios.v1';

export interface Scenario {
    id: string;
    name: string;
    snapshot: PlanSnapshot;
    createdAt: string;
}

export interface ScenarioListItem {
    id: string;
    name: string;
    createdAt: string;
    courseCount: number;
}

function readRaw(): string | null {
    try {
        return window.localStorage.getItem(SCENARIOS_KEY);
    } catch {
        return null;
    }
}

function writeRaw(value: string) {
    try {
        window.localStorage.setItem(SCENARIOS_KEY, value);
    } catch {
        /* private mode / quota */
    }
}

function generateId(): string {
    return `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseScenarios(raw: string | null): Scenario[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((s): s is Scenario =>
            s &&
            typeof s === 'object' &&
            typeof (s as Scenario).id === 'string' &&
            typeof (s as Scenario).name === 'string' &&
            (s as Scenario).snapshot &&
            Array.isArray((s as Scenario).snapshot.selected) &&
            Array.isArray((s as Scenario).snapshot.moveUps) &&
            typeof (s as Scenario).createdAt === 'string'
        );
    } catch {
        return [];
    }
}

/** Returns every saved scenario. */
export function listScenarios(): Scenario[] {
    return parseScenarios(readRaw());
}

/** Summary list useful for UI menus. */
export function listScenarioSummaries(): ScenarioListItem[] {
    return listScenarios().map(s => ({
        id: s.id,
        name: s.name,
        createdAt: s.createdAt,
        courseCount: s.snapshot.selected.length
    }));
}

/** Saves the current plan snapshot as a new scenario. */
export function saveScenario(name: string, snapshot: PlanSnapshot): Scenario {
    const scenarios = listScenarios();
    const scenario: Scenario = {
        id: generateId(),
        name: name.trim() || `Plan ${scenarios.length + 1}`,
        snapshot: normalizePlan(snapshot),
        createdAt: new Date().toISOString()
    };
    scenarios.push(scenario);
    writeRaw(JSON.stringify(scenarios));
    return scenario;
}

/** Renames an existing scenario. */
export function renameScenario(id: string, name: string): boolean {
    const scenarios = listScenarios();
    const index = scenarios.findIndex(s => s.id === id);
    if (index === -1) return false;
    scenarios[index]!.name = name.trim() || scenarios[index]!.name;
    writeRaw(JSON.stringify(scenarios));
    return true;
}

/** Deletes a scenario. */
export function deleteScenario(id: string): boolean {
    const scenarios = listScenarios().filter(s => s.id !== id);
    if (scenarios.length === listScenarios().length) return false;
    writeRaw(JSON.stringify(scenarios));
    return true;
}

/**
 * Returns a validated snapshot for the requested scenario, dropping any course ids
 * that no longer exist in the current catalog.
 */
export function loadScenario(id: string, catalog: CourseModel): { scenario: Scenario | null; dropped: string[] } {
    const s = listScenarios().find(x => x.id === id);
    if (!s) return { scenario: null, dropped: [] };

    const validIds = new Set<string>();
    const depts = catalog.departments || {};
    for (const deptData of Object.values(depts)) {
        if (Array.isArray(deptData)) {
            for (const course of deptData) {
                if (course?.id) validIds.add(course.id);
            }
        } else if (deptData && typeof deptData === 'object') {
            for (const courses of Object.values(deptData as Record<string, Array<{ id?: string }>>)) {
                if (!Array.isArray(courses)) continue;
                for (const course of courses) {
                    if (course?.id) validIds.add(course.id);
                }
            }
        }
    }

    const selected = s.snapshot.selected.filter(id => {
        if (validIds.has(id)) return true;
        return false;
    });
    const droppedSelected = s.snapshot.selected.filter(id => !validIds.has(id));

    const moveUps = s.snapshot.moveUps.filter(([source, target]) => validIds.has(source) && validIds.has(target));
    const droppedMoveUps = s.snapshot.moveUps.filter(([source, target]) => !validIds.has(source) || !validIds.has(target));

    const dropped = [...droppedSelected, ...droppedMoveUps.map(p => p[1])];

    return {
        scenario: {
            ...s,
            snapshot: normalizePlan({ selected, moveUps })
        },
        dropped
    };
}
