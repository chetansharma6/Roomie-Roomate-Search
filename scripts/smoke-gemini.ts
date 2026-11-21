/**
 * DEV-ONLY manual smoke test: makes ONE real Gemini request with demo data.
 *   1. Put GEMINI_API_KEY in .env.local (never commit it)
 *   2. npm run smoke:gemini
 * Never prints the key. Automated tests do not call this.
 */
import { analyzeWithGemini, DEFAULT_GEMINI_MODEL } from '../api/_lib/gemini.js';
import { DEMO_PROFILES, DEMO_STUDENT } from '../src/data/demoProfiles.js';
import { filterCandidates } from '../src/lib/filters.js';
import { rankBaseline } from '../src/lib/scoring.js';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY is not set. Add it to .env.local (see .env.example).');
  process.exit(1);
}
const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
const eligible = filterCandidates(DEMO_PROFILES, {}, DEMO_STUDENT);
const baseline = new Map(rankBaseline(DEMO_STUDENT, eligible).map((m) => [m.profileId, m.compatibilityScore]));

console.log(`Calling ${model} with ${Math.min(eligible.length, 10)} fictional candidates…`);
try {
  const matches = await analyzeWithGemini(DEMO_STUDENT, eligible, { apiKey, model });
  for (const m of matches) {
    console.log(`\n${m.profileId}: Gemini ${m.compatibilityScore} (baseline ${baseline.get(m.profileId)})\n  ${m.summary}`);
    console.log(`  + ${m.strengths.join(' | ')}\n  ! ${m.potentialConflicts.join(' | ') || 'none'}`);
  }
  console.log('\nOK: Gemini returned valid, schema-conformant matches.');
} catch (e) {
  console.error(`FAILED: ${e instanceof Error ? `${e.name}: ${e.message}` : 'unknown error'}`);
  process.exit(1);
}
