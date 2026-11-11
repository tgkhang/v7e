import { parse as parseYaml } from 'yaml';

export type Topic = {
  /** Folder under content/, e.g. "system-design/apache-mpm". Also the route. */
  dir: string;
  category: string;
  title: string;
  summary?: string;
  tags: string[];
  created?: string;
  /** Raw notes file in the same folder, linked from the page header. */
  source?: string;
  order: number;
  body: string;
};

const files = import.meta.glob('/content/**/index.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseTopic(file: string, raw: string): Topic {
  const dir = file.replace(/^\/content\//, '').replace(/\/index\.md$/, '');
  const match = raw.match(FRONTMATTER);
  let meta: Record<string, unknown> = {};
  if (match) {
    try {
      meta = (parseYaml(match[1]) as Record<string, unknown>) ?? {};
    } catch (error) {
      console.error(`Bad frontmatter in ${file}`, error);
    }
  }
  return {
    dir,
    category: dir.split('/')[0],
    title: typeof meta.title === 'string' ? meta.title : dir.split('/').pop()!,
    summary: typeof meta.summary === 'string' ? meta.summary : undefined,
    tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
    created: meta.created == null ? undefined : String(meta.created),
    source: typeof meta.source === 'string' ? meta.source : undefined,
    order: typeof meta.order === 'number' ? meta.order : 100,
    body: match ? raw.slice(match[0].length) : raw,
  };
}

export const topics: Topic[] = Object.entries(files)
  .map(([file, raw]) => parseTopic(file, raw))
  .sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order || a.title.localeCompare(b.title));

export function categoryLabel(category: string): string {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Public URL of a file that lives next to a topic's index.md. */
export function assetUrl(dir: string, file: string): string {
  return `${import.meta.env.BASE_URL}content/${dir}/${file.replace(/^\.\//, '')}`;
}
