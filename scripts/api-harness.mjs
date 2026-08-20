// scripts/api-harness.mjs
// Runs the Vercel function over a plain Node http server, so the API can be
// exercised — by the smoke tests, or by hand — without deploying it.
//
//   node scripts/api-harness.mjs [port]
//
// The request/response objects Vercel hands a function are Node's own plus a
// few conveniences (`req.query`, `req.body`, `res.status()`, `res.json()`).
// This shims exactly those, so the handler runs unmodified.

import http from 'node:http';
import { pathToFileURL } from 'node:url';

const HANDLER_SOURCE = new URL('../api/[[...path]].ts', import.meta.url);

/**
 * Load the TypeScript handler. Node strips the types itself (built in since
 * 22.6, on by default from 23.6), so this needs no build step and no extra
 * dependency — but versions that still gate it behind a flag need the flag,
 * hence the hint rather than a bare stack trace.
 */
async function loadHandler() {
  try {
    const module = await import(HANDLER_SOURCE.href);
    return module.default;
  } catch (error) {
    if (String(error?.message ?? '').includes('Unknown file extension')) {
      throw new Error(
        'This Node build cannot load TypeScript directly.\n' +
          'Re-run with type stripping enabled:\n' +
          '  node --experimental-strip-types scripts/api-smoke.mjs\n' +
          'or upgrade to Node 23.6+ where it is on by default.',
      );
    }
    throw error;
  }
}

export async function startHarness(port = 8123) {
  const handler = await loadHandler();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const query = Object.fromEntries(url.searchParams.entries());
    // Vercel passes catch-all segments as req.query.path.
    query.path = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);

    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', async () => {
      req.query = query;
      // Vercel only pre-parses JSON bodies; mirror that.
      if (raw && (req.headers['content-type'] || '').includes('application/json')) {
        try {
          req.body = JSON.parse(raw);
        } catch {
          req.body = raw;
        }
      } else {
        req.body = raw || {};
      }

      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (payload) => {
        if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
        return res;
      };

      try {
        await handler(req, res);
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: String(error), code: 'internal_error' }));
      }
    });
  });

  await new Promise((resolve) => server.listen(port, resolve));
  return { server, baseUrl: `http://localhost:${server.address().port}` };
}

// Run directly (`npm run api`) to get a server you can curl.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const port = Number(process.argv[2]) || 8123;
  const { baseUrl } = await startHarness(port);
  console.log(`API harness listening on ${baseUrl}/api`);
}
