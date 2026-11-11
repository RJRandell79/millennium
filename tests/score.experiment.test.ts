// Experiment: how does the score reward different ways of winning? Run with `npm run experiment:score`.
// Compares fast and slow victories, and measures what a day of delay is worth near the end.
declare const process: { env: Record<string, string | undefined> };
import { newGame, advanceDay, score, totalPopulation, type GameState } from '../src/engine';
import { botTurn, type BotOpts } from './bot';

const SEEDS = Array.from({ length: Number(process.env.SEEDS ?? 24) }, (_, i) => 11 + i * 1013);
const STYLES: Record<string, BotOpts> = {
  'Accord, 4 engines (fast)': {},
  'Accord, 2 engines': { engines: 2 },
  'Accord, 1 engine (Rob)': { engines: 1 },
  'Conquest, 4 engines': { conquest: true },
  'Conquest, 1 engine': { conquest: true, engines: 1 },
};

function parts(s: GameState) {
  const colonies = Object.keys(s.installations).length - 1;
  return {
    population: Math.floor(totalPopulation(s)) * 10,
    colonies: colonies * 500,
    research: s.research.done.length * 100,
    raids: s.stats.raidsRepelled * 150,
    earth: Math.floor(s.earth.progress) * 50,
  };
}

function run(seed: number, opts: BotOpts) {
  let s: GameState = newGame(seed);
  const log = { milestones: {} as Record<string, number>, events: [] as string[] };
  // Population, colonies and raids: the parts of the score that keep growing if a player delays the win.
  const growing: number[] = [];
  for (let i = 0; i < 2500 && !s.outcome; i++) {
    s = botTurn(s, log, opts); s = advanceDay(s).state;
    const p = parts(s); growing[s.day] = p.population + p.colonies + p.raids;
  }
  const won = s.outcome?.result === 'won';
  const d0 = Math.max(1, s.day - 100);
  return { won, day: s.day, total: score(s), p: parts(s), winBonus: won ? Math.max(0, 20000 - s.day * 8) : 0,
    perDay: (growing[s.day] - growing[d0]) / (s.day - d0) };
}

it('compares scores across play styles', () => {
  const rows: string[] = [];
  for (const [name, opts] of Object.entries(STYLES)) {
    const rs = SEEDS.map((seed) => run(seed, opts)).filter((r) => r.won);
    const mean = (f: (r: (typeof rs)[number]) => number) => Math.round(rs.reduce((a, r) => a + f(r), 0) / Math.max(1, rs.length));
    const total = mean((r) => r.total);
    const pct = (v: number) => `${Math.round((100 * v) / total)}%`;
    const pop = mean((r) => r.p.population), col = mean((r) => r.p.colonies), res = mean((r) => r.p.research), raid = mean((r) => r.p.raids), earth = mean((r) => r.p.earth), bonus = mean((r) => r.winBonus);
    rows.push(`${name.padEnd(26)} wins ${String(rs.length).padStart(2)}/${SEEDS.length} | day ${mean((r) => r.day)} | score ${total} | pop ${pop} (${pct(pop)}) · colonies ${col} · research ${res} · raids ${raid} · Earth ${earth} (${pct(earth)}) · win bonus ${bonus} (${pct(bonus)}) | last 100 days: +${mean((r) => r.perDay * 10) / 10}/day vs -8`);
  }
  console.log('\n' + rows.join('\n'));
}, 3600000);
