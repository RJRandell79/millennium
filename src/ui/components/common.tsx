import type { ReactNode } from 'react';
import { type Cost, type MaterialId, type Stock, MATERIAL_BY_ID, BODY_BY_ID, fmtKg, formatDate } from '../../engine';

export function Bar({ value, max = 1, tone = 'cyan', label }: { value: number; max?: number; tone?: 'cyan' | 'amber' | 'red' | 'green'; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className={`bar bar-${tone}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="bar-fill" style={{ width: `${pct}%` }} />
      {label && <span className="bar-label">{label}</span>}
    </div>
  );
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button className={`toggle ${on ? 'on' : 'off'}`} onClick={onChange} disabled={disabled} aria-pressed={on} aria-label={label}>
      <span className="toggle-led" />
      {on ? 'ON' : 'OFF'}
    </button>
  );
}

export function Section({ title, right, children, className = '' }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        <h2>{title}</h2>
        {right && <div className="panel-right">{right}</div>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function CostChips({ cost, stock }: { cost: Cost; stock?: Stock }) {
  return (
    <div className="chips">
      {Object.entries(cost).map(([k, v]) => {
        const m = MATERIAL_BY_ID[k as MaterialId];
        const short = stock ? stock[k as MaterialId] < (v ?? 0) : false;
        return (
          <span key={k} className={`chip ${short ? 'chip-short' : ''}`} title={m.name}>
            <i style={{ background: m.color }} />
            {m.symbol} {fmtKg(v ?? 0)}
          </span>
        );
      })}
    </div>
  );
}

export function Globe({ bodyId, size = 44 }: { bodyId: string; size?: number }) {
  const b = BODY_BY_ID[bodyId];
  const ringed = bodyId === 'saturn';
  return (
    <span className="globe" style={{ width: size, height: size }}>
      <span
        className="globe-ball"
        style={{
          background: `radial-gradient(circle at 32% 30%, #fff8 0%, ${b.color} 28%, ${shade(b.color, -0.55)} 78%, #000 100%)`,
          boxShadow: bodyId === 'sun' ? `0 0 ${size / 2}px ${b.color}` : undefined,
        }}
      />
      {ringed && <span className="globe-ring" />}
    </span>
  );
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function DateText({ day }: { day: number }) {
  return <span className="mono">{formatDate(day)}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function mw(n: number) {
  return `${n.toFixed(n < 10 ? 1 : 0)} MW`;
}

export function days(n: number) {
  return `${n} day${n === 1 ? '' : 's'}`;
}
