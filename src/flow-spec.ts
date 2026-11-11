// Parser + validator for ```flow blocks. Shared by the app and `npm run check`
// (Node runs this file directly, so keep it to erasable TypeScript only).
import { parse } from 'yaml';

export const NODE_STATES = ['normal', 'idle', 'busy', 'wait', 'held', 'done', 'error', 'off'] as const;
export const NODE_KINDS = ['box', 'client', 'server', 'process', 'thread', 'socket', 'lb', 'db', 'cache', 'queue', 'layer', 'note'] as const;

export type FlowNode = { id: string; label: string; sub?: string; kind: string; col: number; row: number; w: number };
export type FlowGroup = { label: string; nodes: string[] };
export type FlowEdge = { from: string; to: string; label?: string; dashed: boolean };
export type FlowStep = {
  title?: string;
  text?: string;
  active: string[];
  flow: [string, string][];
  state: Record<string, string | null>;
  labels: Record<string, string | null>;
  show: string[];
  hide: string[];
};
export type FlowSpec = { title?: string; nodes: FlowNode[]; groups: FlowGroup[]; edges: FlowEdge[]; steps: FlowStep[]; hidden: string[] };

/** What the diagram looks like at one step. state/labels/hidden carry over from earlier steps. */
export type Frame = {
  step: FlowStep | null;
  state: Record<string, string>;
  labels: Record<string, string>;
  hidden: Set<string>;
};

export type ParsedFlow = { spec?: FlowSpec; frames: Frame[]; errors: string[] };

const ARROW = /^\s*([\w.-]+)\s*-+>\s*([\w.-]+)\s*$/;

/* eslint-disable @typescript-eslint/no-explicit-any -- validating untyped YAML */
const list = (value: any): any[] => (value == null ? [] : Array.isArray(value) ? value : [value]);
const record = (value: any): Record<string, any> => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

export function parseFlow(source: string): ParsedFlow {
  let raw: any;
  try {
    raw = parse(source);
  } catch (error) {
    return { frames: [], errors: [`YAML: ${error instanceof Error ? error.message : String(error)}`] };
  }
  if (!raw || !Array.isArray(raw.nodes) || raw.nodes.length === 0) {
    return { frames: [], errors: ['`nodes` must be a non-empty list'] };
  }

  const errors: string[] = [];
  const ids = new Set<string>();
  const nodes: FlowNode[] = [];
  raw.nodes.forEach((node: any, index: number) => {
    if (!node || typeof node.id !== 'string') {
      errors.push(`nodes[${index}]: needs a string \`id\``);
      return;
    }
    if (ids.has(node.id)) errors.push(`duplicate node id "${node.id}"`);
    if (typeof node.col !== 'number' || typeof node.row !== 'number') errors.push(`node "${node.id}": \`col\` and \`row\` must be numbers`);
    if (node.kind != null && !(NODE_KINDS as readonly string[]).includes(node.kind)) {
      errors.push(`node "${node.id}": unknown kind "${node.kind}" (use ${NODE_KINDS.join(', ')})`);
    }
    ids.add(node.id);
    nodes.push({
      id: node.id,
      label: String(node.label ?? node.id),
      sub: node.sub == null ? undefined : String(node.sub),
      kind: typeof node.kind === 'string' ? node.kind : 'box',
      col: Number(node.col) || 0,
      row: Number(node.row) || 0,
      w: typeof node.w === 'number' && node.w > 0 ? node.w : 1,
    });
  });

  const known = (where: string, id: unknown) => {
    if (typeof id !== 'string' || !ids.has(id)) errors.push(`${where}: unknown node "${String(id)}"`);
    return typeof id === 'string' && ids.has(id);
  };
  const pair = (where: string, value: unknown): [string, string] | null => {
    const match = typeof value === 'string' ? value.match(ARROW) : null;
    if (!match) {
      errors.push(`${where}: "${String(value)}" should look like "a -> b"`);
      return null;
    }
    return known(where, match[1]) && known(where, match[2]) ? [match[1], match[2]] : null;
  };

  const groups: FlowGroup[] = list(raw.groups).map((group: any, index: number) => ({
    label: String(group?.label ?? ''),
    nodes: list(group?.nodes).filter((id: unknown) => known(`groups[${index}]`, id)),
  }));

  const edges: FlowEdge[] = [];
  list(raw.edges).forEach((edge: any, index: number) => {
    const where = `edges[${index}]`;
    const ends = typeof edge === 'string' ? pair(where, edge) : known(where, edge?.from) && known(where, edge?.to) ? [edge.from, edge.to] : null;
    if (ends) edges.push({ from: ends[0], to: ends[1], label: edge?.label == null ? undefined : String(edge.label), dashed: !!edge?.dashed });
  });

  const steps: FlowStep[] = list(raw.steps).map((step: any, index: number) => {
    const where = `steps[${index}]`;
    const state = record(step?.state);
    for (const [id, value] of Object.entries(state)) {
      known(`${where}.state`, id);
      if (value != null && !(NODE_STATES as readonly string[]).includes(String(value))) {
        errors.push(`${where}.state: "${id}: ${value}" is not one of ${NODE_STATES.join(', ')}`);
      }
    }
    const labels = record(step?.labels);
    Object.keys(labels).forEach(id => known(`${where}.labels`, id));
    const ref = (key: string) => list(step?.[key]).filter((id: unknown) => known(`${where}.${key}`, id)) as string[];
    return {
      title: step?.title == null ? undefined : String(step.title),
      text: step?.text == null ? undefined : String(step.text).trim(),
      active: ref('active'),
      flow: list(step?.flow).map((item: unknown) => pair(`${where}.flow`, item)).filter((p): p is [string, string] => p !== null),
      state,
      labels,
      show: ref('show'),
      hide: ref('hide'),
    };
  });

  const hidden = list(raw.hidden).filter((id: unknown) => known('hidden', id)) as string[];
  const spec: FlowSpec = { title: raw.title == null ? undefined : String(raw.title), nodes, groups, edges, steps, hidden };

  const frames: Frame[] = [];
  let state: Record<string, string> = {};
  let labels: Record<string, string> = {};
  const hiddenNow = new Set(hidden);
  for (const step of steps.length ? steps : [null]) {
    if (step) {
      state = { ...state };
      labels = { ...labels };
      for (const [id, value] of Object.entries(step.state)) {
        if (value == null || value === 'normal') delete state[id];
        else state[id] = String(value);
      }
      for (const [id, value] of Object.entries(step.labels)) {
        if (value == null) delete labels[id];
        else labels[id] = String(value);
      }
      step.show.forEach(id => hiddenNow.delete(id));
      step.hide.forEach(id => hiddenNow.add(id));
    }
    frames.push({ step, state, labels, hidden: new Set(hiddenNow) });
  }
  return { spec, frames, errors };
}
