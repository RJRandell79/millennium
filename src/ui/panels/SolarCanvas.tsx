import { useEffect, useRef } from 'react';
import { type GameState, PRIMARY_BODIES, BODY_BY_ID, position } from '../../engine';
import { useGame } from '../../store/useGame';

const INNER_AU = 3.4;
const OUTER_AU = 42;

const SHIP_COLORS: Record<string, string> = {
  probe: '#9fd3ff', surveyor: '#7fe3ff', colonyShip: '#8dff7a', freighter: '#ffcf7a', miner: '#e3955a',
  gasScoop: '#ff9ce6', battlecruiser: '#ffffff', troopship: '#c9d1dc', hospitalShip: '#8dff7a',
};

export function SolarCanvas({ game }: { game: GameState }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const view = useGame((s) => s.mapView);
  const selected = useGame((s) => s.selectedBody);
  const select = useGame((s) => s.selectBody);
  const hits = useRef<{ id: string; x: number; y: number }[]>([]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      hits.current = render(ctx, w, h, game, view, selected);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [game, view, selected]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best: string | null = null, bd = 26;
    for (const h of hits.current) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bd) { bd = d; best = h.id; }
    }
    select(best);
  };

  return <canvas ref={ref} className="solarmap" onClick={onClick} aria-label="Solar system map. Tap a world to select it." />;
}

function render(ctx: CanvasRenderingContext2D, w: number, h: number, g: GameState, view: 'inner' | 'outer', selected: string | null) {
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) / 2 - 16;
  const toR = (au: number) => (view === 'inner' ? (au / INNER_AU) * R : Math.sqrt(au / OUTER_AU) * R);
  const toXY = (p: { x: number; y: number }) => {
    const au = Math.hypot(p.x, p.y);
    if (au === 0) return { x: cx, y: cy };
    const r = toR(au);
    return { x: cx + (p.x / au) * r, y: cy - (p.y / au) * r };
  };
  const maxAU = view === 'inner' ? INNER_AU : OUTER_AU;

  // background
  ctx.fillStyle = '#03050c';
  ctx.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.5})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1, 1);
  }

  // asteroid belt band
  if (view === 'inner') {
    ctx.strokeStyle = 'rgba(160,150,130,0.12)';
    ctx.lineWidth = toR(3.3) - toR(2.1);
    ctx.beginPath();
    ctx.arc(cx, cy, (toR(2.1) + toR(3.3)) / 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(160,150,130,0.18)';
    ctx.lineWidth = Math.max(2, toR(3.3) - toR(2.1));
    ctx.beginPath();
    ctx.arc(cx, cy, (toR(2.1) + toR(3.3)) / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // orbits
  ctx.lineWidth = 1;
  for (const b of PRIMARY_BODIES) {
    if (b.a > maxAU) continue;
    if (b.kind === 'asteroid') continue;
    ctx.strokeStyle = b.id === 'earth' ? 'rgba(95,190,255,0.35)' : b.id === 'mars' ? 'rgba(255,90,60,0.28)' : 'rgba(120,140,180,0.18)';
    ctx.beginPath();
    ctx.arc(cx, cy, toR(b.a), 0, Math.PI * 2);
    ctx.stroke();
  }

  // sun
  const sunGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, view === 'inner' ? 22 : 14);
  sunGlow.addColorStop(0, '#fff6c8');
  sunGlow.addColorStop(0.35, '#ffd36b');
  sunGlow.addColorStop(1, 'rgba(255,170,40,0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, view === 'inner' ? 22 : 14, 0, Math.PI * 2);
  ctx.fill();

  // transit lines
  for (const sh of Object.values(g.ships)) {
    if (sh.status !== 'transit' || !sh.transit) continue;
    const t = sh.transit;
    const a = toXY(position(t.from, t.departDay));
    const b = toXY(position(t.to, t.arriveDay));
    const f = Math.min(1, (g.day - t.departDay) / Math.max(1, t.arriveDay - t.departDay));
    ctx.strokeStyle = 'rgba(255,207,122,0.22)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
    const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
    drawShip(ctx, x, y, Math.atan2(b.y - a.y, b.x - a.x), SHIP_COLORS[sh.type] ?? '#fff', 4);
  }
  for (const r of g.threat.raids) {
    const a = toXY(position('mars', r.launchDay));
    const b = toXY(position(r.targetBodyId, r.arriveDay));
    const f = Math.min(1, (g.day - r.launchDay) / Math.max(1, r.arriveDay - r.launchDay));
    ctx.strokeStyle = 'rgba(255,60,60,0.45)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
    drawShip(ctx, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, Math.atan2(b.y - a.y, b.x - a.x), '#ff4040', 6);
  }

  // bodies
  const hits: { id: string; x: number; y: number }[] = [];
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  for (const b of PRIMARY_BODIES) {
    if (b.a > maxAU + 0.2) continue;
    if (view === 'outer' && b.kind === 'asteroid' && b.id !== 'ceres') continue;
    const p = toXY(position(b.id, g.day));
    const st = g.bodies[b.id];
    const known = st.knowledge > 0;
    const r = b.kind === 'gasgiant' ? 6 : b.kind === 'planet' ? 4.5 : b.kind === 'dwarf' ? 3.5 : 2.6;
    const hasColony = !!st.installationId || Object.values(g.installations).some((i) => BODY_BY_ID[i.bodyId].parent === b.id);
    const grad = ctx.createRadialGradient(p.x - r / 3, p.y - r / 3, 0, p.x, p.y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, known ? b.color : '#55606e');
    grad.addColorStop(1, '#000');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    if (b.id === 'saturn') {
      ctx.strokeStyle = 'rgba(227,207,152,0.7)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r + 4, r / 2.2, -0.3, 0, Math.PI * 2); ctx.stroke();
    }
    if (b.id === 'earth') {
      // Moon & Moonbase
      ctx.fillStyle = '#ddd';
      ctx.beginPath(); ctx.arc(p.x + 7, p.y - 5, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3fe0ff';
      ctx.beginPath(); ctx.arc(p.x + 7, p.y - 5, 5, 0, Math.PI * 2); ctx.stroke();
      hits.push({ id: 'moon', x: p.x + 7, y: p.y - 5 });
    }
    if (hasColony) {
      ctx.strokeStyle = '#8dff7a';
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2); ctx.stroke();
    }
    if (b.id === 'mars' && g.threat.status === 'hostile') {
      ctx.strokeStyle = 'rgba(255,60,60,0.8)';
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2); ctx.stroke();
    }
    const sel = selected === b.id || BODY_BY_ID[selected ?? '']?.parent === b.id;
    if (sel) {
      ctx.strokeStyle = '#ffb000';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 8, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;
    }
    const showLabel = view === 'outer' ? (b.a > 4 || b.id === 'earth' || b.id === 'ceres' || sel) : true;
    if (showLabel) {
      ctx.fillStyle = known ? (b.id === 'mars' ? '#ff8a6a' : '#b9c7dd') : '#5b6676';
      ctx.fillText(known ? b.name.toUpperCase() : '?', p.x, p.y + r + 12);
    }
    // working ships at this body
    const working = Object.values(g.ships).filter((sh) => sh.status === 'working' && (sh.at === b.id || BODY_BY_ID[sh.at]?.parent === b.id));
    working.forEach((sh, i) => {
      ctx.fillStyle = SHIP_COLORS[sh.type] ?? '#fff';
      ctx.fillRect(p.x + r + 3 + i * 4, p.y - r - 4, 2.5, 2.5);
    });
    hits.push({ id: b.id, x: p.x, y: p.y });
  }
  // scale hint
  ctx.textAlign = 'left';
  ctx.fillStyle = '#5b6676';
  ctx.fillText(view === 'inner' ? 'INNER SYSTEM · 1 ring = 1 planet orbit' : 'OUTER SYSTEM · √ scale', 8, h - 8);
  return hits;
}

function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, color: string, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.7, size * 0.6);
  ctx.lineTo(-size * 0.7, -size * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
