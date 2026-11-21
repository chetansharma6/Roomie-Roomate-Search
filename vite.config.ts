import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Serves api/match.ts under the plain Vite dev server so `npm run dev` works
 * without `vercel dev` (which requires a Vercel login). Production uses the
 * real Vercel Function at the same path.
 */
function localApi(): Plugin {
  return {
    name: 'roomie-local-api',
    configureServer(server) {
      server.middlewares.use('/api/match', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const raw = Buffer.concat(chunks).toString('utf8');
          let body: unknown = undefined;
          try {
            body = raw ? JSON.parse(raw) : undefined;
          } catch {
            body = raw;
          }
          const mod = await server.ssrLoadModule('/api/match.ts');
          const shimRes = Object.assign(res, {
            status(code: number) {
              res.statusCode = code;
              return shimRes;
            },
            json(payload: unknown) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(payload));
            },
          });
          await (mod.default as (a: unknown, b: unknown) => Promise<void>)(
            Object.assign(req, { body }),
            shimRes,
          );
        } catch (err) {
          console.error('[local-api] handler crashed:', err instanceof Error ? err.message : 'unknown');
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'internal_error' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make non-VITE_ variables (GEMINI_API_KEY etc.) visible to the server handler only.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    if (!k.startsWith('VITE_') && process.env[k] === undefined) process.env[k] = v;
  }
  return {
    plugins: [react(), tailwindcss(), localApi()],
    test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  };
});
