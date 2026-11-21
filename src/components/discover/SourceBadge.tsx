import type { MatchSource } from '../../types/profile.js';

/** Shown as "Gemini-powered" only when Gemini actually produced the result. */
export function SourceBadge({ source, model }: { source: MatchSource; model?: string }) {
  return source === 'gemini' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-medium text-white" title={model}>
      ✦ Gemini-powered analysis
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      Baseline match · not AI
    </span>
  );
}
