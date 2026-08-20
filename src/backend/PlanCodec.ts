// PlanCodec.ts
// - Serializes a course plan to a compact, URL-safe string and back.
// - Used for the share link and for the saved-plan record in local storage, so
//   both speak the same format and a link pasted into the address bar restores
//   exactly what the student had.
//
// Wire format (before base64url): `v1:<selected ids, comma separated>|<src>tgt move-ups, comma separated>`
// It stays human-readable on purpose: a malformed link degrades to "drop what I
// can't understand" rather than throwing the whole plan away.

export interface PlanSnapshot {
    selected: string[];
    moveUps: Array<[string, string]>;
}

const VERSION = 'v1';

export const EMPTY_PLAN: PlanSnapshot = { selected: [], moveUps: [] };

/** A course id we are willing to round-trip. Keeps junk out of the URL parser. */
const ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

export function isEmptyPlan(snapshot: PlanSnapshot | null | undefined): boolean {
    return !snapshot || (snapshot.selected.length === 0 && snapshot.moveUps.length === 0);
}

export function normalizePlan(snapshot: PlanSnapshot): PlanSnapshot {
    const selected = [...new Set(snapshot.selected.filter(id => ID_PATTERN.test(id)))].sort();
    const seenSources = new Set<string>();
    const moveUps: Array<[string, string]> = [];

    for (const [source, target] of snapshot.moveUps) {
        if (!ID_PATTERN.test(source) || !ID_PATTERN.test(target)) continue;
        if (source === target || seenSources.has(source)) continue;
        seenSources.add(source);
        moveUps.push([source, target]);
    }
    moveUps.sort((a, b) => a[0].localeCompare(b[0]));

    return { selected, moveUps };
}

export function plansEqual(a: PlanSnapshot, b: PlanSnapshot): boolean {
    return encodePlainPlan(normalizePlan(a)) === encodePlainPlan(normalizePlan(b));
}

function encodePlainPlan(snapshot: PlanSnapshot): string {
    const selected = snapshot.selected.join(',');
    const moveUps = snapshot.moveUps.map(([source, target]) => `${source}>${target}`).join(',');
    return `${VERSION}:${selected}|${moveUps}`;
}

function decodePlainPlan(plain: string): PlanSnapshot | null {
    const separator = plain.indexOf(':');
    if (separator === -1) return null;
    if (plain.slice(0, separator) !== VERSION) return null;

    const [selectedPart = '', moveUpPart = ''] = plain.slice(separator + 1).split('|');
    const selected = selectedPart.split(',').filter(Boolean);
    const moveUps = moveUpPart
        .split(',')
        .filter(Boolean)
        .map(pair => pair.split('>') as [string, string])
        .filter(pair => pair.length === 2 && !!pair[0] && !!pair[1]);

    return normalizePlan({ selected, moveUps });
}

// base64url so the string survives a URL hash, a chat message and a copy-paste
// without percent-encoding noise.
function toBase64Url(input: string): string {
    const bytes = new TextEncoder().encode(input);
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export function encodePlan(snapshot: PlanSnapshot): string {
    return toBase64Url(encodePlainPlan(normalizePlan(snapshot)));
}

/** Returns null for anything we can't read, so a bad link never breaks the app. */
export function decodePlan(encoded: string): PlanSnapshot | null {
    if (!encoded) return null;
    try {
        return decodePlainPlan(fromBase64Url(encoded.trim()));
    } catch {
        return null;
    }
}
