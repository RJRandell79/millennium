import { useMemo } from 'react';
import { BODY_BY_ID, type Installation } from '../../engine';
import { shade } from './common';

/** A small procedural 2D render of an installation — a nod to the original's static base screens. */
export function BaseScene({ inst }: { inst: Installation }) {
  const body = BODY_BY_ID[inst.bodyId];
  const e = inst.equipment;
  const damage = Object.values(inst.depts).reduce((a, d) => a + (d?.damage ?? 0), 0) / Object.keys(inst.depts).length;
  const seed = inst.bodyId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const stars = useMemo(() => {
    let x = seed * 9301;
    const r = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: 40 }, () => ({ x: r() * 360, y: r() * 70, s: r() * 1.2 + 0.3 }));
  }, [seed]);
  const ground = body.color;
  const domes = inst.isMoonBase ? Math.max(1, e.habitat) : 1 + (inst.population > 60 ? 1 : 0);
  const panels = Math.min(14, e.solar);
  const sky = inst.bodyId === 'titan' ? '#3a2a10' : inst.bodyId === 'venus' ? '#4a3a18' : inst.bodyId === 'mars' ? '#2a1410' : '#02030a';
  const parent = body.parent && body.parent !== 'earth' ? BODY_BY_ID[body.parent] : null;

  return (
    <svg className="basescene" viewBox="0 0 360 120" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${inst.name} exterior`}>
      <defs>
        <linearGradient id={`g-${inst.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(ground, -0.1)} />
          <stop offset="1" stopColor={shade(ground, -0.7)} />
        </linearGradient>
        <radialGradient id={`d-${inst.id}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#e9f2ff" />
          <stop offset="0.6" stopColor="#8ea2bd" />
          <stop offset="1" stopColor="#3a4658" />
        </radialGradient>
      </defs>
      <rect width="360" height="120" fill={sky} />
      {stars.map((st, i) => <circle key={i} cx={st.x} cy={st.y} r={st.s * 0.6} fill="#fff" opacity={0.4 + st.s / 3} />)}
      {inst.isMoonBase && (
        <g>
          <circle cx="300" cy="28" r="16" fill="#3b4a5c" />
          <circle cx="300" cy="28" r="16" fill="none" stroke="#7f8fa3" strokeWidth="0.6" />
          <path d="M288 22 q8 -6 18 2 q-6 8 -14 6z" fill="#6b5a4a" opacity="0.6" />
        </g>
      )}
      {parent && <circle cx="290" cy="34" r="22" fill={parent.color} opacity="0.85" />}
      <path d="M0 78 Q60 70 120 76 T240 74 T360 78 V120 H0Z" fill={`url(#g-${inst.id})`} />
      {[30, 95, 160, 250, 330].map((x, i) => <ellipse key={i} cx={(x + seed) % 360} cy={96 + (i % 3) * 7} rx={10 + (i % 2) * 6} ry={2.5} fill={shade(ground, -0.6)} opacity="0.7" />)}
      {/* solar arrays */}
      {Array.from({ length: panels }, (_, i) => (
        <g key={i} transform={`translate(${12 + i * 11} ${70 + (i % 2) * 3})`}>
          <line x1="4" y1="6" x2="4" y2="12" stroke="#777" strokeWidth="1" />
          <rect width="9" height="6" fill="#1c3f8a" stroke="#6fa0ff" strokeWidth="0.5" />
        </g>
      ))}
      {/* domes */}
      {Array.from({ length: domes }, (_, i) => {
        const cx = 190 + (i % 3) * 30 + Math.floor(i / 3) * 14;
        const cy = 84 + Math.floor(i / 3) * 8;
        return (
          <g key={i}>
            <ellipse cx={cx} cy={cy} rx="15" ry="13" fill={`url(#d-${inst.id})`} />
            <rect x={cx - 15} y={cy} width="30" height="4" fill="#2a3240" />
            <circle cx={cx - 4} cy={cy - 4} r="1.2" fill="#ffd36b" />
            <circle cx={cx + 5} cy={cy - 2} r="1.2" fill="#ffd36b" />
          </g>
        );
      })}
      {/* lasers */}
      {Array.from({ length: Math.min(6, e.lasers) }, (_, i) => (
        <g key={i} transform={`translate(${300 + i * 9} 70)`}>
          <rect x="0" y="4" width="3" height="14" fill="#555c66" />
          <rect x="-1" y="2" width="5" height="3" fill="#c33" />
        </g>
      ))}
      {/* reactors */}
      {Array.from({ length: Math.min(3, e.reactor + e.fusion) }, (_, i) => (
        <g key={i} transform={`translate(${160 - i * 14} 74)`}>
          <rect width="10" height="14" rx="2" fill="#4c535e" />
          <circle cx="5" cy="5" r="2.4" fill={i < e.fusion ? '#ff9ce6' : '#8dff7a'} />
        </g>
      ))}
      {damage > 15 && Array.from({ length: Math.ceil(damage / 15) }, (_, i) => (
        <circle key={i} className="smoke" cx={180 + i * 23} cy={70} r={6 + i} fill="#555" opacity="0.5" />
      ))}
      {inst.equipment.shields > 0 && <ellipse cx="220" cy="84" rx="70" ry="34" fill="none" stroke="#7fe3ff" strokeOpacity="0.35" strokeWidth="1.5" />}
    </svg>
  );
}
