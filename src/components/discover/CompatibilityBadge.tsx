import { Sparkles } from 'lucide-react';
import { compatibilityBadgeText, scoreColor, type CompatibilityBadgeModel } from '../../lib/compatibilityBadge';

/** Score circle with a label pill, anchored to the lower-right of its positioned parent. */
export function CompatibilityBadge({ model }: { model: CompatibilityBadgeModel }) {
  const text = compatibilityBadgeText(model);
  if (model.state === 'loading') {
    return (
      <div className="compat-badge" data-state="loading" role="status" aria-label={text}>
        <span className="compat-badge-score" aria-hidden="true">…</span>
        <span className="compat-badge-label" aria-hidden="true">Matching</span>
      </div>
    );
  }
  if (model.state === 'unrated') {
    return (
      <div className="compat-badge" data-state="unrated">
        <span className="compat-badge-label">Not rated</span>
      </div>
    );
  }
  return (
    <div className="compat-badge" data-state="ready" data-kind={model.kind} aria-label={text}>
      <span className="compat-badge-score" aria-hidden="true" style={scoreColor(model.score)}>{model.score}</span>
      <span className="compat-badge-label" aria-hidden="true">
        {model.kind === 'ai' && <Sparkles size={12} />}{model.label}
      </span>
    </div>
  );
}
