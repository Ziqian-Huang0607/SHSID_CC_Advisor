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

    it('records a vote', async () => {
        const store = new RatingStore();
        const first = await store.vote('A', 9);
        expect(first).toMatchObject({ ok: true, changed: false });
        expect(store.hasVoted('A')).toBe(true);
        expect(store.getAggregate('A')).toMatchObject({ count: 1, sum: 9 });
    });

    it('replaces a vote rather than counting the student twice', async () => {
        const store = new RatingStore();
        await store.vote('A', 9);
        const second = await store.vote('A', 2);

        expect(second).toMatchObject({ ok: true, changed: true });
        // The count means "this many students", so it stays at one.
        expect(store.getAggregate('A')).toMatchObject({ count: 1, sum: 2 });
        expect(store.getMyVote('A')?.value).toBe(2);
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

    it('leaves a vote the server rejected marked unsynced, to be retried', async () => {
        mockFetch(() => ({ status: 500, body: { error: 'rating store unavailable' } }));
        const store = new RatingStore();
        await store.vote('A', 5);
        expect(store.getMyVote('A')).toMatchObject({ value: 5, synced: false });
    });

    it('takes the tally the server reports over its own optimistic guess', async () => {
        mockFetch(() => ({ status: 200, body: { data: { yourVote: 5, aggregate: { courseId: 'A', sum: 23, count: 4, average: 5.75 } } } }));
        const store = new RatingStore();
        await store.vote('A', 5);
        expect(store.getAggregate('A')).toMatchObject({ count: 4, sum: 23 });
        expect(store.getMyVote('A')?.synced).toBe(true);
    });

    it('shows the student average once anyone has voted, not the catalog number', async () => {
        const store = new RatingStore();
        await store.vote('A', 10);
        const rating = store.getEffectiveRating('A', 5);
        expect(rating.value).toBe(10);
        expect(rating.voteCount).toBe(1);
        expect(rating.baseline).toBe(5);
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
