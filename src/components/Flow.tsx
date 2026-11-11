import { useEffect, useMemo, useRef, useState } from 'react';
import { parseFlow, type FlowNode } from '../flow-spec';
import { useReducedMotion } from '../hooks';

// Grid geometry: a node at (col, row) sits in a CELL_W x CELL_H cell.
const CELL_W = 180;
const CELL_H = 96;
const NODE_W = 144;
const NODE_H = 54;
const GROUP_PAD = 14;
const GROUP_LABEL = 22;
const MARGIN = 20;
const HOP_MS = 900; // the dot takes this long to travel one arrow
const REST_MS = 800; // pause before the dot starts over

const STATE_LEGEND: Record<string, string> = {
  idle: 'free',
  busy: 'working',
  wait: 'waiting',
  held: 'occupied but doing nothing',
  error: 'error',
  done: 'finished',
};

type Box = { x: number; y: number; w: number; h: number };

const nodeBox = (node: FlowNode): Box => ({
  x: node.col * CELL_W,
  y: node.row * CELL_H,
  w: NODE_W + (node.w - 1) * CELL_W,
  h: NODE_H,
});

/** Point where the line from the box centre towards (tx, ty) leaves the box. */
function exitPoint(box: Box, tx: number, ty: number, gap = 4) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const scale = 1 / Math.max(Math.abs(dx) / (box.w / 2 + gap), Math.abs(dy) / (box.h / 2 + gap));
  return { x: cx + dx * scale, y: cy + dy * scale };
}

function segment(a: Box, b: Box) {
  const start = exitPoint(a, b.x + b.w / 2, b.y + b.h / 2);
  const end = exitPoint(b, a.x + a.w / 2, a.y + a.h / 2);
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}

const pairKey = (from: string, to: string) => `${from}->${to}`;

export function Flow({ source }: { source: string }) {
  const parsed = useMemo(() => parseFlow(source), [source]);
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Elapsed time is tagged with its step, so a stale value from the previous step is never used.
  const [clock, setClock] = useState({ index: 0, ms: 0 });
  const markerId = useRef(`flow-${Math.random().toString(36).slice(2, 8)}`).current;

  const frames = parsed.frames;
  const frame = frames[Math.min(index, frames.length - 1)];
  const step = frame?.step ?? null;
  const hops = step?.flow ?? [];

  useEffect(() => {
    if (reduced || hops.length === 0) return;
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      // rAF timestamps can be slightly earlier than `started`; never let time go negative.
      setClock({ index, ms: Math.max(0, now - started) });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, reduced, hops.length]);

  useEffect(() => {
    if (!playing) return;
    if (index >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setIndex(i => i + 1), Math.max(3000, hops.length * HOP_MS + 1800));
    return () => clearTimeout(timer);
  }, [playing, index, frames.length, hops.length]);

  if (!parsed.spec || parsed.errors.length > 0) {
    return (
      <div className="block-error">
        <strong>Flow error</strong>
        <ul>{parsed.errors.map(error => <li key={error}>{error}</li>)}</ul>
      </div>
    );
  }

  const { spec } = parsed;
  const boxes = new Map(spec.nodes.map(node => [node.id, nodeBox(node)]));
  const visible = (id: string) => !frame.hidden.has(id);

  const groupBoxes = spec.groups.map(group => {
    const members = group.nodes.filter(visible).map(id => boxes.get(id)!);
    if (members.length === 0) return null;
    const x = Math.min(...members.map(b => b.x)) - GROUP_PAD;
    const y = Math.min(...members.map(b => b.y)) - GROUP_PAD - GROUP_LABEL;
    const right = Math.max(...members.map(b => b.x + b.w)) + GROUP_PAD;
    const bottom = Math.max(...members.map(b => b.y + b.h)) + GROUP_PAD;
    return { label: group.label, box: { x, y, w: right - x, h: bottom - y } };
  });

  // The viewBox covers every node (even hidden ones) so the layout never jumps between steps.
  const all = [...boxes.values(), ...groupBoxes.flatMap(g => (g ? [g.box] : []))];
  const minX = Math.min(...all.map(b => b.x)) - MARGIN;
  const minY = Math.min(...all.map(b => b.y)) - MARGIN;
  const width = Math.max(...all.map(b => b.x + b.w)) + MARGIN - minX;
  const height = Math.max(...all.map(b => b.y + b.h)) + MARGIN - minY;

  const defined = new Set(spec.edges.map(e => pairKey(e.from, e.to)));
  const hot = new Set(hops.flatMap(([a, b]) => [pairKey(a, b), pairKey(b, a)]));
  const extraHops = hops.filter(([a, b]) => !defined.has(pairKey(a, b)) && !defined.has(pairKey(b, a)));
  const active = new Set([...(step?.active ?? []), ...hops.flat()]);

  // One dot travels the step's arrows in order, then pauses and starts over.
  let dot: { x: number; y: number } | null = null;
  if (hops.length > 0) {
    const ms = reduced ? (hops.length - 0.5) * HOP_MS : (clock.index === index ? clock.ms : 0) % (hops.length * HOP_MS + REST_MS);
    const hop = hops[Math.floor(ms / HOP_MS)];
    if (hop) {
      const s = segment(boxes.get(hop[0])!, boxes.get(hop[1])!);
      const p = reduced ? 0.5 : (ms % HOP_MS) / HOP_MS;
      dot = { x: s.x1 + (s.x2 - s.x1) * p, y: s.y1 + (s.y2 - s.y1) * p };
    }
  }

  const usedStates = Object.keys(STATE_LEGEND).filter(state => frames.some(f => Object.values(f.state).includes(state)));
  const go = (next: number) => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(frames.length - 1, next)));
  };
  const togglePlay = () => {
    if (!playing && index >= frames.length - 1) setIndex(0);
    setPlaying(p => !p);
  };

  return (
    <figure className="block flow">
      {spec.title && <figcaption>{spec.title}</figcaption>}

      {frames.length > 1 && (
        <div className="flow-step">
          <div className="flow-nav">
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0}>← Back</button>
            <span className="flow-count">Step {index + 1} of {frames.length}</span>
            <button type="button" onClick={() => go(index + 1)} disabled={index >= frames.length - 1}>Next →</button>
            <button type="button" className="flow-play" onClick={togglePlay}>
              {playing ? 'Pause' : 'Play all'}
            </button>
          </div>
          <div aria-live={playing ? 'off' : 'polite'}>
            {step?.title && <h4>{step.title}</h4>}
            {step?.text && <p>{step.text}</p>}
          </div>
        </div>
      )}

      <div className="flow-canvas">
        <svg viewBox={`${minX} ${minY} ${width} ${height}`} style={{ maxWidth: width }} role="img" aria-label={spec.title ?? 'Diagram'}>
          <defs>
            {['edge', 'hot'].map(kind => (
              <marker key={kind} id={`${markerId}-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" className={`arrow-${kind}`} />
              </marker>
            ))}
          </defs>

          {groupBoxes.map((group, i) => group && (
            <g key={i} className="fgroup">
              <rect x={group.box.x} y={group.box.y} width={group.box.w} height={group.box.h} rx={8} />
              <text x={group.box.x + 10} y={group.box.y + 16}>{group.label}</text>
            </g>
          ))}

          {spec.edges.filter(e => visible(e.from) && visible(e.to)).map(edge => {
            const s = segment(boxes.get(edge.from)!, boxes.get(edge.to)!);
            const isHot = hot.has(pairKey(edge.from, edge.to));
            return (
              <g key={pairKey(edge.from, edge.to)} className={`fedge${isHot ? ' hot' : ''}${edge.dashed ? ' dashed' : ''}`}>
                <line {...s} markerEnd={`url(#${markerId}-${isHot ? 'hot' : 'edge'})`} />
                {edge.label && <text x={(s.x1 + s.x2) / 2} y={(s.y1 + s.y2) / 2 - 6}>{edge.label}</text>}
              </g>
            );
          })}
          {extraHops.map(([from, to]) => (
            <g key={`extra-${from}-${to}`} className="fedge hot dashed">
              <line {...segment(boxes.get(from)!, boxes.get(to)!)} markerEnd={`url(#${markerId}-hot)`} />
            </g>
          ))}

          {spec.nodes.filter(node => visible(node.id)).map(node => {
            const box = boxes.get(node.id)!;
            const sub = frame.labels[node.id] ?? node.sub;
            const classes = ['fnode', `state-${frame.state[node.id] ?? 'normal'}`];
            if (node.kind === 'note') classes.push('note');
            if (active.has(node.id)) classes.push('active');
            return (
              <g key={node.id} className={classes.join(' ')} transform={`translate(${box.x} ${box.y})`}>
                <rect width={box.w} height={box.h} rx={6} />
                <text className="label" x={box.w / 2} y={sub ? 23 : box.h / 2 + 5}>{node.label}</text>
                {sub && <text className="sub" x={box.w / 2} y={41}>{sub}</text>}
              </g>
            );
          })}

          {dot && <circle className="dot" cx={dot.x} cy={dot.y} r={6} />}
        </svg>
      </div>

      {usedStates.length > 0 && (
        <div className="legend">
          {usedStates.map(state => (
            <span key={state}><i className={`swatch state-${state}`} />{STATE_LEGEND[state]}</span>
          ))}
          <span><i className="swatch swatch-dot" />the request moving</span>
        </div>
      )}
    </figure>
  );
}
