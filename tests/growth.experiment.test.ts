// Experiment: does any population policy dominate? Run with `npm run experiment:growth`.
// The bot can only rule things out; whether choosing feels meaningful is for human playtests.
import { newGame, moonbase, advanceDay, totalPopulation, type GameState } from '../src/engine';
import { botTurn, type BotGrowth } from './bot';

const POLICIES: BotGrowth[] = ['grow', 'steady', 'hold', 'adaptive'];
const SEEDS = [11, 202, 3003, 4040, 5150, 6262, 7373, 8484, 9595, 10606, 11717, 12828];

function run(seed: number, growth: BotGrowth, difficulty: 'standard' | 'hard') {
  let s: GameState = newGame(seed, { difficulty });
  const log = { milestones: {} as Record<string, number>, events: [] as string[] };
  let raidDeaths = 0, shortageDays = 0, pop365 = 0, col365 = 0, firstColony = -1;
  for (let i = 0; i < 2500 && !s.outcome; i++) {
    s = botTurn(s, log, { growth });
    const r = advanceDay(s); s = r.state;
    if (s.threat.lastBattle?.day === s.day) raidDeaths += s.threat.lastBattle.casualties;
    for (const inst of Object.values(s.installations)) if (inst.shortageDays > 0) shortageDays++;
    if (s.day === 365) { pop365 = Math.floor(totalPopulation(s)); col365 = Object.keys(s.installations).length - 1; }
    if (firstColony < 0 && Object.keys(s.installations).length > 1) firstColony = s.day;
  }
  return {
    win: s.outcome?.result === 'won' ? s.day : null,
    raidDeaths, shortageDays, pop365, col365, firstColony,
    popEnd: Math.floor(totalPopulation(s)), mbEnd: Math.floor(moonbase(s).population),
  };
}

it('compares population policies', () => {
  for (const diff of ['standard', 'hard'] as const) {
    console.log(`\n== ${diff} ==\npolicy    | wins  | mean win day | range     | first colony | colonies@365 | pop@365 | pop at end | raid deaths | shortage days`);
    for (const g of POLICIES) {
      const rs = SEEDS.map((sd) => run(sd, g, diff));
      const wins = rs.filter((r) => r.win).map((r) => r.win!);
      const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : NaN);
      console.log(`${g.padEnd(9)} | ${String(wins.length).padStart(2)}/${rs.length} | ${avg(wins)} | ${Math.min(...wins)}-${Math.max(...wins)} | ${avg(rs.map((r) => r.firstColony))} | ${avg(rs.map((r) => r.col365))} | ${avg(rs.map((r) => r.pop365))} | ${avg(rs.map((r) => r.popEnd))} | ${avg(rs.map((r) => r.raidDeaths))} | ${avg(rs.map((r) => r.shortageDays))}`);
    }
  }
}, 3600000);
