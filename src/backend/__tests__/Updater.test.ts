import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Updater } from '../Updater';
import { makeCatalog } from './fixture';

const CATALOG_TEXT = () => `// a comment line the parser has to strip\n${JSON.stringify(makeCatalog(), null, 2).replace('}\n}', '},\n}')}`;

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

describe('Updater', () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
        installStorage();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('parses a catalog that has comments and trailing commas', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => CATALOG_TEXT() })));
        const result = await new Updater().load();
        expect(result?.source).toBe('network');
        expect(result?.catalog.catalogName).toBe('Test Catalog');
    });

    it('retries once before giving up on the network', async () => {
        const fetchMock = vi.fn(async () => { throw new Error('connection reset'); });
        vi.stubGlobal('fetch', fetchMock);
        await new Updater().load();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('serves the last good catalog when the network is down', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => CATALOG_TEXT() })));
        await new Updater().load();

        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
        const result = await new Updater().load();
        expect(result?.source).toBe('cache');
        expect(result?.catalog.catalogName).toBe('Test Catalog');
        expect(result?.cachedAt).toBeTruthy();
    });

    it('returns nothing when there is neither a network nor a cached copy', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, text: async () => '' })));
        expect(await new Updater().load()).toBeNull();
    });

    it('refuses to cache valid JSON that is not a catalog', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '{"error":"proxy blocked"}' })));
        expect(await new Updater().load()).toBeNull();
    });

    it('does not retry a response it could not parse', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => 'not json at all {' }));
        vi.stubGlobal('fetch', fetchMock);
        expect(await new Updater().load()).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
