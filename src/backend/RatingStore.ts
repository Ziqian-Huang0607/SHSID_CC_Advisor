// RatingStore.ts
// - Crowd rating / voting engine for the course catalog.
// - One ballot per person per course, and it is editable: coming back and
//   moving your 7 to a 9 replaces your vote instead of adding another one, so
//   the vote count still means "this many students", not "this many clicks".
// - Identity is durable. The server issues a year-long `ccvoter` cookie and the
//   id is mirrored in localStorage, so a reload, a new tab, or a new browser
//   session is still the same voter — and either store can restore the other.
// - The displayed rating is the plain average of student votes. Before anyone
//   votes it is the catalog's own number.

export const RATING_MIN = 1;
export const RATING_MAX = 10;

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
    /** The student average on the 0-10 scale, or the baseline before any votes. */
    value: number;
    /** Number of students who have rated the course. */
    voteCount: number;
    /** The catalog's own rating, shown until the first student votes. */
    baseline: number;
    /** This voter's own score, if they have rated the course. */
    myVote: number | null;
}

export type VoteResult =
    | { ok: true; aggregate: RatingAggregate; myVote: MyVote; changed: boolean }
    | { ok: false; reason: 'out-of-range' | 'unknown-course'; myVote: MyVote | null };

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

    /** True when this voter already rated the course; the UI shows their score. */
    public hasVoted(courseId: string): boolean {
        return !!this.ledger[courseId];
    }

    public getMyVote(courseId: string): MyVote | null {
        return this.ledger[courseId] ?? null;
    }

    /**
     * Cast a vote, or move one already cast. The ledger is written before the
     * request goes out, so a slow or failed call can never leave the UI showing
     * a value the device doesn't own. Re-rating replaces the previous ballot:
     * the local aggregate moves by the delta and the vote count stays put.
     */
    public async vote(courseId: string, value: number): Promise<VoteResult> {
        const existing = this.getMyVote(courseId);

        const rounded = Math.round(value);
        if (!Number.isFinite(rounded) || rounded < RATING_MIN || rounded > RATING_MAX) {
            return { ok: false, reason: 'out-of-range', myVote: existing };
        }

        const record: MyVote = { value: rounded, votedAt: new Date().toISOString(), synced: false };
        this.ledger[courseId] = record;
        writeJSON(LEDGER_KEY, this.ledger);

        // Optimistic local aggregate so the number moves immediately.
        this.applyLocalVote(courseId, rounded, existing?.value ?? null);
        this.notify();

        try {
            const response = await fetch(`${RatingStore.apiBase}/ratings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin', // carries the durable voter cookie
                body: JSON.stringify({ courseId, value: rounded, voterId: this.voterId }),
            });
            const payload = await response.json();

            this.adoptVoterId(payload?.data?.voterId);
            if (payload?.data?.aggregate) {
                this.aggregates.set(courseId, payload.data.aggregate as RatingAggregate);
            }
            if (response.ok) {
                record.synced = true;
                if (typeof payload?.data?.yourVote === 'number') record.value = payload.data.yourVote;
                this.ledger[courseId] = record;
                writeJSON(LEDGER_KEY, this.ledger);
            }
        } catch {
            // Offline: the vote is kept locally and flushed on the next sync.
        }

        this.notify();
        return {
            ok: true,
            aggregate: this.getAggregate(courseId),
            myVote: record,
            changed: existing !== null,
        };
    }

    /**
     * The server is the authority on who this voter is — it may hand back the
     * id from its cookie rather than the one we sent. Storing that keeps the
     * two identity stores converged instead of drifting apart.
     */
    private adoptVoterId(serverId: unknown): void {
        if (typeof serverId !== 'string' || !serverId || serverId === this.voterId) return;
        this.voterId = serverId;
        writeJSON(VOTER_KEY, serverId);
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
                    credentials: 'same-origin',
                    body: JSON.stringify({ courseId, value: record.value, voterId: this.voterId }),
                });
                if (response.ok) {
                    record.synced = true;
                    const payload = await response.json();
                    this.adoptVoterId(payload?.data?.voterId);
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
            const response = await fetch(`${RatingStore.apiBase}/ratings?voterId=${encodeURIComponent(this.voterId)}`, {
                cache: 'no-store',
                credentials: 'same-origin',
            });
            if (!response.ok) return;
            const payload = await response.json();

            this.adoptVoterId(payload?.data?.voterId);

            const rows: RatingAggregate[] = payload?.data?.ratings ?? [];
            rows.forEach((row) => {
                if (row && typeof row.courseId === 'string') this.aggregates.set(row.courseId, row);
            });

            // Ballots the server holds for this voter. This is what makes a
            // cleared localStorage (but surviving cookie) still show "you rated
            // this" instead of inviting a second vote.
            const serverVotes: Record<string, number> = payload?.data?.yourVotes ?? {};
            Object.entries(serverVotes).forEach(([courseId, value]) => {
                if (typeof value !== 'number') return;
                const local = this.ledger[courseId];
                if (local && !local.synced) return; // an unsent local edit is newer
                this.ledger[courseId] = { value, votedAt: local?.votedAt ?? new Date().toISOString(), synced: true };
            });
            writeJSON(LEDGER_KEY, this.ledger);

            // Local votes that the server hasn't confirmed are still ours to show.
            Object.entries(this.ledger).forEach(([courseId, record]) => {
                if (!record.synced) this.applyLocalVote(courseId, record.value, null);
            });
            this.notify();
        } catch {
            /* offline — baseline ratings still render */
        }
    }

    /**
     * Fold this device's vote into the local tally. `previous` non-null means
     * the voter is editing: only the sum moves, because the count already
     * includes them.
     */
    private applyLocalVote(courseId: string, value: number, previous: number | null): void {
        const current = this.aggregates.get(courseId) ?? { courseId, sum: 0, count: 0, average: 0 };
        const sum = current.sum + value - (previous ?? 0);
        const count = previous === null ? current.count + 1 : current.count;
        this.aggregates.set(courseId, { courseId, sum, count, average: count > 0 ? sum / count : 0 });
    }

    public getAggregate(courseId: string): RatingAggregate {
        return this.aggregates.get(courseId) ?? { courseId, sum: 0, count: 0, average: 0 };
    }

    /**
     * Student votes decide the number outright: one student rating a course 10
     * shows 10.00, not a figure dragged toward the catalog's own score. The
     * catalog baseline is only what the course shows before anyone has voted.
     */
    public getEffectiveRating(courseId: string, baseline: number): EffectiveRating {
        const base = Number.isFinite(baseline) ? Math.max(0, Math.min(RATING_MAX, baseline)) : 0;
        const agg = this.getAggregate(courseId);
        const value = agg.count === 0 ? base : agg.sum / agg.count;

        return {
            value: Math.max(0, Math.min(RATING_MAX, value)),
            voteCount: agg.count,
            baseline: base,
            myVote: this.getMyVote(courseId)?.value ?? null,
        };
    }
}
