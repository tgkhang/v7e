import { useEffect, useRef, useState } from 'react';
import { useDarkMode } from '../hooks';

type MermaidApi = (typeof import('mermaid'))['default'];
let loader: Promise<MermaidApi> | null = null;
const loadMermaid = () => (loader ??= import('mermaid').then(module => module.default));
let counter = 0;

export function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const dark = useDarkMode();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${++counter}`;
    loadMermaid().then(async mermaid => {
      mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral', securityLevel: 'strict' });
      try {
        const { svg } = await mermaid.render(id, code);
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = svg;
        setError(null);
      } catch (err) {
        document.getElementById(`d${id}`)?.remove();
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code, dark]);

  return (
    <figure className="block mermaid">
      {error ? (
        <div className="block-error">
          <strong>Mermaid error</strong>
          <pre>{error}</pre>
          <pre>{code}</pre>
        </div>
      ) : (
        <div ref={ref} className="mermaid-svg" />
      )}
    </figure>
  );
}
