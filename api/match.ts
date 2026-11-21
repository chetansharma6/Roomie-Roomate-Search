import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runMatch } from './_lib/matchService.js';

/** POST /api/match — all logic lives in _lib/matchService.ts so it can be tested without HTTP. */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const forwarded = req.headers['x-forwarded-for'];
  const out = await runMatch({
    method: req.method ?? 'GET',
    body: req.body,
    authorization: typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
    clientKey: (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim(),
    env: process.env,
  });
  res.status(out.status).json(out.json);
}
