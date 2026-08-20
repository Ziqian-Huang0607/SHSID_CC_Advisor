import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES, clearSavedPlan, loadPlan, loadPreferences, savePlan, savePreferences } from '../Persistence';

function installStorage(impl?: Partial<Storage>) {
    const data = new Map<string, string>();
    const storage: Storage = {
        get length() { return data.size; },
        clear: () => data.clear(),
        key: index => [...data.keys()][index] ?? null,
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => { data.set(key, value); },
        removeItem: key => { data.delete(key); },
        ...impl
    } as Storage;
    vi.stubGlobal('window', { localStorage: storage });
    return storage;
}

describe('Persistence', () => {
    beforeEach(() => { vi.unstubAllGlobals(); installStorage(); });

    it('round-trips a plan', () => {
        savePlan({ selected: ['A', 'B'], moveUps: [['A', 'C']] });
        expect(loadPlan()).toEqual({ selected: ['A', 'B'], moveUps: [['A', 'C']] });
    });

    it('forgets an emptied plan rather than storing an empty one', () => {
        savePlan({ selected: ['A'], moveUps: [] });
        savePlan({ selected: [], moveUps: [] });
        expect(loadPlan()).toBeNull();
    });

    it('clears the saved plan on request', () => {
        savePlan({ selected: ['A'], moveUps: [] });
        clearSavedPlan();
        expect(loadPlan()).toBeNull();
    });

    it('falls back to defaults when nothing is stored', () => {
        expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    });

    it('round-trips preferences', () => {
        savePreferences({ darkMode: true, leftPanelWidth: 320, rightPanelWidth: 300 });
        expect(loadPreferences()).toEqual({ darkMode: true, leftPanelWidth: 320, rightPanelWidth: 300 });
    });

    it('clamps a stored panel width back into what the resizer allows', () => {
        savePreferences({ darkMode: false, leftPanelWidth: 5000, rightPanelWidth: -20 });
        const prefs = loadPreferences();
        expect(prefs.leftPanelWidth).toBe(400);
        expect(prefs.rightPanelWidth).toBe(220);
    });

    it('recovers from corrupted stored data', () => {
        window.localStorage.setItem('shsid-cc.prefs.v1', '{not json');
        window.localStorage.setItem('shsid-cc.plan.v1', '@@@');
        expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
        expect(loadPlan()).toBeNull();
    });

    it('keeps working when storage refuses to write', () => {
        installStorage({ setItem: () => { throw new Error('QuotaExceededError'); } });
        expect(() => savePlan({ selected: ['A'], moveUps: [] })).not.toThrow();
        expect(() => savePreferences(DEFAULT_PREFERENCES)).not.toThrow();
    });
});
