// RatingStore.ts
// - Crowd rating / voting engine for the course catalog.
// - One vote per person per course: a vote is written to a local ledger the
//   moment it is cast, so the UI can lock the control and no one can re-vote,
//   even if the network call fails or the page is reloaded.
// - The catalog's own `crowdRating` stays as a prior, so a course with two
//   student votes doesn't swing to a wild number.

export const RATING_MIN = 1;
export const RATING_MAX = 10;

// How many "virtual votes" the catalog baseline is worth. Higher = live votes
// move the displayed number more slowly.
const BASELINE_WEIGHT = 5;

const VOTER_KEY = 'shsid-cc.voterId';
const LEDGER_KEY = 'shsid-cc.ratingLedger.v1';

export interface RatingAggregate {
    courseId: string;
    sum: number;
    count: number;
    average: number;
}

export interface MyVote {
    value: number;
    votedAt: string;
    synced: boolean;
}

export interface EffectiveRating {
    /** Blended baseline + crowd votes, on the 0-10 scale. */
    value: number;
    /** Number of student votes counted (excludes the baseline prior). */
    voteCount: number;
    /** The catalog's own rating, unblended. */
    baseline: number;
    /** This device's vote, if any. */
    myVote: number | null;
}

export type VoteResult =
    | { ok: true; aggregate: RatingAggregate; myVote: MyVote }
    | { ok: false; reason: 'already-voted' | 'out-of-range' | 'unknown-course'; myVote: MyVote | null };

type Ledger = Record<string, MyVote>;

function hasStorage(): boolean {
    try {
        return typeof window !== 'undefined' && !!window.localStorage;
    } catch {
        return false;
    }
}

function readJSON<T>(key: string, fallback: T): T {
    if (!hasStorage()) return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function writeJSON(key: string, value: unknown): void {
    if (!hasStorage()) return;
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* quota / private mode — the in-memory copy still guards this session */
    }
}

function randomId(): string {
    try {
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    } catch {
        /* fall through */
    }
    return `v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export class RatingStore {
    private static readonly apiBase = '/api';

    private voterId: string;
    private ledger: Ledger;
    private aggregates = new Map<string, RatingAggregate>();
    private listeners = new Set<() => void>();

    constructor() {
        this.voterId = readJSON<string>(VOTER_KEY, '') || randomId();
        writeJSON(VOTER_KEY, this.voterId);
        this.ledger = readJSON<Ledger>(LEDGER_KEY, {});
    }

    public onChange(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        this.listeners.forEach((l) => l());
    }

    // ------------------------------------------------------------ voting ----

    /** True when this device has already rated the course; the UI locks on this. */
    public hasVoted(courseId: string): boolean {
        return !!this.ledger[courseId];
    }

    public getMyVote(courseId: string): MyVote | null {
        return this.ledger[courseId] ?? null;
    }

    /**
     * Cast a vote. Refuses silently (ok: false) if this device already voted for
     * the course — that is the whole point of the ledger. The local ledger is
     * written first so a failed/slow request can never open a second vote.
     */
    public async vote(courseId: string, value: number): Promise<VoteResult> {
        const existing = this.getMyVote(courseId);
        if (existing) return { ok: false, reason: 'already-voted', myVote: existing };

        const rounded = Math.round(value);
        if (!Number.isFinite(rounded) || rounded < RATING_MIN || rounded > RATING_MAX) {
            return { ok: false, reason: 'out-of-range', myVote: null };
        }

        const record: MyVote = { value: rounded, votedAt: new Date().toISOString(), synced: false };
        this.ledger[courseId] = record;
        writeJSON(LEDGER_KEY, this.ledger);

        // Optimistic local aggregate so the number moves immediately.
        this.applyLocalVote(courseId, rounded);
        this.notify();

        try {
            const response = await fetch(`${RatingStore.apiBase}/ratings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseId, value: rounded, voterId: this.voterId }),
            });
            const payload = await response.json();

            // 409 = the server already has a vote from this voter. Still a
            // success from the user's point of view: their vote stands, once.
            if (payload?.data?.aggregate) {
                this.aggregates.set(courseId, payload.data.aggregate as RatingAggregate);
            }
            if (response.ok || response.status === 409) {
                record.synced = true;
                if (typeof payload?.data?.yourVote === 'number') record.value = payload.data.yourVote;
                this.ledger[courseId] = record;
                writeJSON(LEDGER_KEY, this.ledger);
            }
        } catch {
            // Offline: the vote is kept locally and flushed on the next sync.
        }

        this.notify();
        return { ok: true, aggregate: this.getAggregate(courseId), myVote: record };
    }

    /** Re-send any vote that never reached the server (offline when cast). */
    public async flushPending(): Promise<void> {
        const pending = Object.entries(this.ledger).filter(([, v]) => !v.synced);
        if (pending.length === 0) return;

        for (const [courseId, record] of pending) {
            try {
                const response = await fetch(`${RatingStore.apiBase}/ratings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ courseId, value: record.value, voterId: this.voterId }),
                });
                if (response.ok || response.status === 409) {
                    record.synced = true;
                    const payload = await response.json();
                    if (payload?.data?.aggregate) {
                        this.aggregates.set(courseId, payload.data.aggregate as RatingAggregate);
                    }
                }
            } catch {
                break; // still offline; try again next load
            }
        }
        writeJSON(LEDGER_KEY, this.ledger);
        this.notify();
    }

    // ------------------------------------------------------- aggregates ----

    /** Pull the live tallies for every course. Failure is non-fatal. */
    public async loadAggregates(): Promise<void> {
        try {
            const response = await fetch(`${RatingStore.apiBase}/ratings`, { cache: 'no-store' });
            if (!response.ok) return;
            const payload = await response.json();
            const rows: RatingAggregate[] = payload?.data?.ratings ?? [];
            rows.forEach((row) => {
                if (row && typeof row.courseId === 'string') this.aggregates.set(row.courseId, row);
            });
            // Local votes that the server hasn't confirmed are still ours to show.
            Object.entries(this.ledger).forEach(([courseId, record]) => {
                if (!record.synced) this.applyLocalVote(courseId, record.value);
            });
            this.notify();
        } catch {
            /* offline — baseline ratings still render */
        }
    }

    private applyLocalVote(courseId: string, value: number): void {
        const current = this.aggregates.get(courseId) ?? { courseId, sum: 0, count: 0, average: 0 };
        const sum = current.sum + value;
        const count = current.count + 1;
        this.aggregates.set(courseId, { courseId, sum, count, average: sum / count });
    }

    public getAggregate(courseId: string): RatingAggregate {
        return this.aggregates.get(courseId) ?? { courseId, sum: 0, count: 0, average: 0 };
    }

    /**
     * Blend the catalog baseline with student votes. With no votes this is
     * exactly the catalog number, so nothing regresses before voting starts.
     */
    public getEffectiveRating(courseId: string, baseline: number): EffectiveRating {
        const base = Number.isFinite(baseline) ? Math.max(0, Math.min(RATING_MAX, baseline)) : 0;
        const agg = this.getAggregate(courseId);
        const value = agg.count === 0
            ? base
            : (base * BASELINE_WEIGHT + agg.sum) / (BASELINE_WEIGHT + agg.count);

        return {
            value: Math.max(0, Math.min(RATING_MAX, value)),
            voteCount: agg.count,
            baseline: base,
            myVote: this.getMyVote(courseId)?.value ?? null,
        };
    }
}
