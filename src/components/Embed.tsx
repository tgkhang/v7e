import { parse } from 'yaml';
import { assetUrl } from '../content';

type EmbedSpec = { src: string; height?: number; title?: string };

/** ```embed block: shows a standalone HTML file from the topic folder in an iframe. */
export function Embed({ source, dir }: { source: string; dir: string }) {
  let spec: EmbedSpec;
  try {
    const value = parse(source);
    spec = typeof value === 'string' ? { src: value } : value;
    if (!spec?.src) throw new Error('`src` is required');
  } catch (err) {
    return (
      <div className="block-error">
        <strong>Embed error</strong>
        <pre>{err instanceof Error ? err.message : String(err)}</pre>
      </div>
    );
  }
  const url = /^https?:/.test(spec.src) ? spec.src : assetUrl(dir, spec.src);
  return (
    <figure className="block embed">
      <div className="block-bar">
        <span>{spec.title ?? spec.src}</span>
        <a href={url} target="_blank" rel="noreferrer">Open full page ↗</a>
      </div>
      <iframe src={url} title={spec.title ?? spec.src} style={{ height: spec.height ?? 640 }} loading="lazy" />
    </figure>
  );
}
