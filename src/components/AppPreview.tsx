import { useId, useState } from 'react';
import { ArrowUpRight, Monitor, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AppPreviewProps {
  route?: string;
}

export function AppPreview({ route = '/discover?demo=1' }: AppPreviewProps) {
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');
  const frameId = useId();
  const url = new URL(route, window.location.origin);
  url.searchParams.set('preview', '1');
  const frameRoute = `${url.pathname}${url.search}${url.hash}`;

  return (
    <section className="preview-section" id="preview" aria-labelledby={`${frameId}-heading`}>
      <div className="shell">
        <div className="preview-heading">
          <div>
            <h2 id={`${frameId}-heading`}>Try Roomie</h2>
            <Link className="text-link" to={route}>Explore demo matches <ArrowUpRight aria-hidden="true" size={16} /></Link>
          </div>
          <div className="view-toggle" role="group" aria-label="Preview layout">
            <button type="button" aria-controls={frameId} aria-pressed={mode === 'desktop'} onClick={() => setMode('desktop')}>
              <Monitor size={17} aria-hidden="true" /> Desktop
            </button>
            <button type="button" aria-controls={frameId} aria-pressed={mode === 'mobile'} onClick={() => setMode('mobile')}>
              <Smartphone size={17} aria-hidden="true" /> Mobile
            </button>
          </div>
        </div>
        <div className="preview-stage">
          <div className={`preview-frame preview-frame-${mode}`}>
            <iframe id={frameId} src={frameRoute} title="Roomie roommate discovery preview" loading="lazy" />
          </div>
        </div>
      </div>
    </section>
  );
}
