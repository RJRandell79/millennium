import { newGame, moonbase, advanceDay, type GameState } from '../src/engine';
import { botTurn, type Opening } from './bot';

const OPENINGS: Opening[] = ['balanced', 'defence', 'asteroid', 'research', 'ceres'];
const SEEDS = [11, 202, 3003, 4040, 5150, 6262];

function run(seed: number, opening: Opening, difficulty: 'standard' | 'hard') {
  let s: GameState = newGame(seed, { difficulty });
  const log = { milestones: {} as Record<string, number>, events: [] as string[] };
  let bad = 0, casualties = 0, pop365 = 0, col365 = 0, firstColony = -1;
  for (let i = 0; i < 2500 && !s.outcome; i++) {
    s = botTurn(s, log, { opening });
    const r = advanceDay(s); s = r.state;
    for (const m of r.newMessages) if (m.title.startsWith('Raid on') && !m.title.endsWith('repelled') && s.day <= 365) bad++;
    if (s.threat.lastBattle?.day === s.day && s.day <= 365) casualties += s.threat.lastBattle.casualties;
    if (s.day === 365) { pop365 = Math.floor(moonbase(s).population); col365 = Object.keys(s.installations).length - 1; }
    if (firstColony < 0 && Object.keys(s.installations).length > 1) firstColony = s.day;
  }
  return { win: s.outcome?.result === 'won' ? s.day : null, bad, casualties, pop365, col365, firstColony };
}

it('compares openings', () => {
  for (const diff of ['standard', 'hard'] as const) {
    console.log(`\n== ${diff} ==\nopening   | wins | mean win day | range     | first colony | colonies@365 | pop@365 | raids not repelled by d365 | casualties by d365`);
    for (const o of OPENINGS) {
      const rs = SEEDS.map((sd) => run(sd, o, diff));
      const wins = rs.filter((r) => r.win).map((r) => r.win!);
      const avg = (a: number[]) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : NaN;
      console.log(`${o.padEnd(9)} | ${wins.length}/${rs.length}  | ${avg(wins)} | ${Math.min(...wins)}-${Math.max(...wins)} | ${avg(rs.map((r) => r.firstColony))} | ${avg(rs.map((r) => r.col365))} | ${avg(rs.map((r) => r.pop365))} | ${avg(rs.map((r) => r.bad))} | ${avg(rs.map((r) => r.casualties))}`);
    }
  }
}, 600000);
