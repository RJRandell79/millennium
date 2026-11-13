// Research pacing: how soon the tree completes, how key unlocks move, and what it does to winning.
// Run with: EXPERIMENT=1 npx vitest run tests/research.experiment.test.ts
declare const process: { env: Record<string, string | undefined> };
import { newGame, advanceDay, RESEARCH, RESEARCH_TUNING, type GameState } from '../src/engine';
import { botTurn } from './bot';

type Tuning = typeof RESEARCH_TUNING;
const VARIANTS: [string, Tuning][] = [
  ['current', { perLab: 1, crewExponent: 1, costMult: 1, depthScale: 0, depthFrom: 0 }],
  ['labs +0.5', { perLab: 0.5, crewExponent: 1, costMult: 1, depthScale: 0, depthFrom: 0 }],
  ['crew sqrt', { perLab: 1, crewExponent: 0.5, costMult: 1, depthScale: 0, depthFrom: 0 }],
  ['both', { perLab: 0.5, crewExponent: 0.5, costMult: 1, depthScale: 0, depthFrom: 0 }],
  ['both, cost x1.5', { perLab: 0.5, crewExponent: 0.5, costMult: 1.5, depthScale: 0, depthFrom: 0 }],
  ['both, cost x2', { perLab: 0.5, crewExponent: 0.5, costMult: 2, depthScale: 0, depthFrom: 0 }],
  ['cost x2 only', { perLab: 1, crewExponent: 1, costMult: 2, depthScale: 0, depthFrom: 0 }],
  ['cost x3 only', { perLab: 1, crewExponent: 1, costMult: 3, depthScale: 0, depthFrom: 0 }],
  ['depth +0.5', { perLab: 1, crewExponent: 1, costMult: 1, depthScale: 0.5, depthFrom: 0 }],
  ['depth +1', { perLab: 1, crewExponent: 1, costMult: 1, depthScale: 1, depthFrom: 0 }],
  ['depth +1.5', { perLab: 1, crewExponent: 1, costMult: 1, depthScale: 1.5, depthFrom: 0 }],
  ['depth +2', { perLab: 1, crewExponent: 1, costMult: 1, depthScale: 2, depthFrom: 0 }],
  ['depth>1 +1', { perLab: 1, crewExponent: 1, costMult: 1, depthScale: 1, depthFrom: 1 }],
  ['depth>1 +1.5', { perLab: 1, crewExponent: 1, costMult: 1, depthScale: 1.5, depthFrom: 1 }],
  ['depth>1 +2', { perLab: 1, crewExponent: 1, costMult: 1, depthScale: 2, depthFrom: 1 }],
  ['depth>1 +3', { perLab: 1, crewExponent: 1, costMult: 1, depthScale: 3, depthFrom: 1 }],
];
const ONLY = process.env.VARIANTS?.split('|');
const SEEDS = Array.from({ length: Number(process.env.SEEDS ?? 24) }, (_, i) => 11 + i * 1013);
const DIFF = (process.env.DIFF ?? 'standard') as 'standard' | 'hard';

function run(seed: number, labs: number) {
  let s: GameState = newGame(seed, { difficulty: DIFF });
  const log = { milestones: {} as Record<string, number>, events: [] as string[] };
  const when: Record<string, number> = {};
  for (let i = 0; i < 2500 && !s.outcome; i++) {
    s = botTurn(s, log, { labs });
    s = advanceDay(s).state;
    for (const id of s.research.done) if (when[id] === undefined) when[id] = s.day;
    if (when.tree === undefined && s.research.done.length === RESEARCH.length) when.tree = s.day;
    if (when.colony === undefined && Object.keys(s.installations).length > 1) when.colony = s.day;
  }
  return { win: s.outcome?.result === 'won' ? s.day : null, when, end: s.day };
}

const median = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : NaN; };

it('research pacing', () => {
  const saved = { ...RESEARCH_TUNING };
  console.log(`\n== ${DIFF}, ${SEEDS.length} seeds; medians in days ==`);
  console.log('variant          | labs | tree done | colony pods | first colony | fission | cryo | fusion power | terraforming | wins  | mean win day');
  for (const [name, tuning] of VARIANTS) {
    if (ONLY && !ONLY.includes(name)) continue;
    Object.assign(RESEARCH_TUNING, tuning);
    for (const labs of [2, 4]) {
      const rs = SEEDS.map((sd) => run(sd, labs));
      const m = (k: string) => median(rs.map((r) => r.when[k] ?? r.end));
      const wins = rs.filter((r) => r.win).map((r) => r.win!);
      const notDone = rs.filter((r) => r.when.tree === undefined).length;
      console.log(`${name.padEnd(16)} | ${labs}    | ${String(m('tree')).padStart(4)}${notDone ? ` (${notDone} never)` : ''} | ${m('colonyPods')} | ${m('colony')} | ${m('fission')} | ${m('cryoHabitats')} | ${m('fusionPower')} | ${m('terraforming')} | ${wins.length}/${rs.length} | ${wins.length ? Math.round(wins.reduce((a, b) => a + b, 0) / wins.length) : '-'}`);
    }
  }
  Object.assign(RESEARCH_TUNING, saved);
}, 3_600_000);
