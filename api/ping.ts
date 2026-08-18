// api/ping.ts — zero-dependency probe used to isolate FUNCTION_INVOCATION_FAILED.
// If this works but other endpoints fail, the crash is in the shared import chain.
export default function handler(_req: any, res: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ ok: true, data: 'pong' });
}
