import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { assetUrl } from '../content';
import { Mermaid } from './Mermaid';
import { Flow } from './Flow';
import { Embed } from './Embed';

/* eslint-disable @typescript-eslint/no-explicit-any -- hast nodes, kept loose on purpose */

const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i;
const ALERT_TITLE: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
};
const isRelative = (url: string) => !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url);

/** Turns GitHub-style `> [!NOTE]` quotes into callouts and points relative links at the topic folder. */
function rehypeTopic(dir: string) {
  const markCallout = (quote: any) => {
    const para = quote.children.find((child: any) => child.type === 'element');
    const text = para?.tagName === 'p' ? para.children[0] : null;
    const match = text?.type === 'text' ? text.value.match(ALERT) : null;
    if (!match) return;
    const kind = match[1].toLowerCase();
    text.value = text.value.slice(match[0].length);
    quote.properties.className = ['callout', `callout-${kind}`];
    quote.children.unshift({
      type: 'element',
      tagName: 'div',
      properties: { className: ['callout-title'] },
      children: [{ type: 'text', value: ALERT_TITLE[kind] }],
    });
  };
  const walk = (node: any) => {
    if (node.type === 'element') {
      if (node.tagName === 'blockquote') markCallout(node);
      for (const attr of ['src', 'href']) {
        const value = node.properties?.[attr];
        if (typeof value === 'string' && isRelative(value)) node.properties[attr] = assetUrl(dir, value);
      }
      if (node.tagName === 'a' && /^https?:/.test(String(node.properties?.href))) {
        node.properties.target = '_blank';
        node.properties.rel = 'noreferrer';
      }
    }
    node.children?.forEach(walk);
  };
  return () => (tree: any) => walk(tree);
}

const textOf = (node: any): string =>
  node.type === 'text' ? node.value : (node.children ?? []).map(textOf).join('');

export function Markdown({ source, dir }: { source: string; dir: string }) {
  const components: Components = {
    pre({ node, children, ...rest }) {
      const code: any = node?.children?.[0];
      if (code?.type === 'element' && code.tagName === 'code') {
        const classes: string[] = code.properties?.className ?? [];
        const lang = classes.find(c => c.startsWith('language-'))?.slice('language-'.length);
        const text = textOf(code).replace(/\n$/, '');
        if (lang === 'mermaid') return <Mermaid code={text} />;
        if (lang === 'flow') return <Flow source={text} />;
        if (lang === 'embed') return <Embed source={text} dir={dir} />;
      }
      return <pre {...rest}>{children}</pre>;
    },
    table({ node, ...rest }) {
      return (
        <div className="table-wrap">
          <table {...rest} />
        </div>
      );
    },
  };

  return (
    <div className="prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeTopic(dir)]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
