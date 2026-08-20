// Persistence.ts
// - Everything the app remembers between visits: the student's plan and their
//   interface preferences.
// - Storage is best-effort by design. Private-browsing mode and a full quota both
//   throw on write, and neither is a reason to lose the session in progress, so
//   every helper here fails quietly and the app keeps working from memory.

import { decodePlan, encodePlan, normalizePlan, type PlanSnapshot } from './PlanCodec';

const PLAN_KEY = 'shsid-cc.plan.v1';
const PREFS_KEY = 'shsid-cc.prefs.v1';

export interface Preferences {
    /** null = follow the operating system. */
    darkMode: boolean | null;
    leftPanelWidth: number;
    rightPanelWidth: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
    darkMode: null,
    leftPanelWidth: 280,
    rightPanelWidth: 280
};

function readRaw(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeRaw(key: string, value: string) {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        /* private mode / quota — in-memory state still drives this session */
    }
}

function removeRaw(key: string) {
    try {
        window.localStorage.removeItem(key);
    } catch {
        /* nothing to do */
    }
}

// ------------------------------------------------------------------ plan ----

/** Stores the plan in the same encoding the share link uses. */
export function savePlan(snapshot: PlanSnapshot) {
    const normalized = normalizePlan(snapshot);
    if (normalized.selected.length === 0) {
        removeRaw(PLAN_KEY);
        return;
    }
    writeRaw(PLAN_KEY, encodePlan(normalized));
}

export function loadPlan(): PlanSnapshot | null {
    const raw = readRaw(PLAN_KEY);
    return raw ? decodePlan(raw) : null;
}

export function clearSavedPlan() {
    removeRaw(PLAN_KEY);
}

// ----------------------------------------------------------- preferences ----

export function loadPreferences(): Preferences {
    const raw = readRaw(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };

    try {
        const parsed = JSON.parse(raw) as Partial<Preferences>;
        return {
            darkMode: typeof parsed.darkMode === 'boolean' ? parsed.darkMode : null,
            leftPanelWidth: clampWidth(parsed.leftPanelWidth, DEFAULT_PREFERENCES.leftPanelWidth, 180, 400),
            rightPanelWidth: clampWidth(parsed.rightPanelWidth, DEFAULT_PREFERENCES.rightPanelWidth, 220, 450)
        };
    } catch {
        return { ...DEFAULT_PREFERENCES };
    }
}

export function savePreferences(preferences: Preferences) {
    writeRaw(PREFS_KEY, JSON.stringify(preferences));
}

// A stored width outside the resizer's own bounds would render a panel the student
// cannot drag back into view, so it is clamped on the way in rather than trusted.
function clampWidth(value: unknown, fallback: number, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, Math.round(value)));
}
