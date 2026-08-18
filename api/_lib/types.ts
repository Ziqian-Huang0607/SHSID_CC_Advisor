// api/_lib/types.ts
// Minimal structural types for Vercel serverless function handlers.
// This avoids adding @vercel/node as a dependency — Vercel compiles functions
// in api/ with its own toolchain at deploy time; we only need the shapes here.

export interface VercelRequest {
    method?: string;
    query: Record<string, string | string[] | undefined>;
    body?: any;
    headers: Record<string, string | string[] | undefined>;
    [key: string]: any;
}

export interface VercelResponse {
    status(code: number): VercelResponse;
    json(body: any): VercelResponse;
    send(body: any): VercelResponse;
    end(body?: string): VercelResponse;
    setHeader(name: string, value: string): VercelResponse;
    [key: string]: any;
}
