import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RatingStore } from '../RatingStore';

function installStorage() {
    const data = new Map<string, string>();
    vi.stubGlobal('window', {
        localStorage: {
            getItem: (key: string) => data.get(key) ?? null,
            setItem: (key: string, value: string) => { data.set(key, value); },
            removeItem: (key: string) => { data.delete(key); }
        }
    });
    return data;
}

function mockFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
        const { status, body } = handler(String(url), init);
        return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
    }));
}

describe('RatingStore', () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
        installStorage();
        mockFetch(() => ({ status: 200, body: { data: { aggregate: null } } }));
    });

    it('shows the catalog baseline until someone votes', () => {
        const store = new RatingStore();
        expect(store.getEffectiveRating('A', 7).value).toBe(7);
        expect(store.getEffectiveRating('A', 7).voteCount).toBe(0);
    });

    it('records a vote and locks the course against a second one', async () => {
        const store = new RatingStore();
        const first = await store.vote('A', 9);
        expect(first.ok).toBe(true);
        expect(store.hasVoted('A')).toBe(true);

        const second = await store.vote('A', 2);
        expect(second).toMatchObject({ ok: false, reason: 'already-voted' });
        expect(store.getAggregate('A').count).toBe(1);
    });

    it('rejects a rating outside the 1-10 scale', async () => {
        const store = new RatingStore();
        expect(await store.vote('A', 0)).toMatchObject({ ok: false, reason: 'out-of-range' });
        expect(await store.vote('A', 11)).toMatchObject({ ok: false, reason: 'out-of-range' });
        expect(store.hasVoted('A')).toBe(false);
    });

    it('keeps an offline vote and flushes it once the network is back', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
        const store = new RatingStore();
        await store.vote('A', 8);
        expect(store.getMyVote('A')).toMatchObject({ value: 8, synced: false });

        mockFetch(() => ({ status: 200, body: { data: { aggregate: { courseId: 'A', sum: 8, count: 1, average: 8 } } } }));
        await store.flushPending();
        expect(store.getMyVote('A')?.synced).toBe(true);
    });

    it('holds the vote as cast when the server says it already has one', async () => {
        mockFetch(() => ({ status: 409, body: { data: { yourVote: 5, aggregate: { courseId: 'A', sum: 5, count: 1, average: 5 } } } }));
        const store = new RatingStore();
        await store.vote('A', 5);
        expect(store.getMyVote('A')).toMatchObject({ value: 5, synced: true });
    });

    it('blends votes with the catalog baseline instead of swinging to the last vote', async () => {
        const store = new RatingStore();
        await store.vote('A', 10);
        const rating = store.getEffectiveRating('A', 5);
        // One vote against a five-vote-weight prior: closer to the baseline than to 10.
        expect(rating.value).toBeGreaterThan(5);
        expect(rating.value).toBeLessThan(7);
        expect(rating.myVote).toBe(10);
    });

    it('notifies subscribers when a vote lands, and stops after unsubscribing', async () => {
        const store = new RatingStore();
        const seen = vi.fn();
        const off = store.onChange(seen);
        await store.vote('A', 6);
        expect(seen).toHaveBeenCalled();

        off();
        seen.mockClear();
        await store.vote('B', 6);
        expect(seen).not.toHaveBeenCalled();
    });
});
