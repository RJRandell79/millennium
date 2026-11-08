import type { MaterialId, Stock, Cost } from '../types';

export interface MaterialDef { id: MaterialId; name: string; symbol: string; color: string; group: 'volatile' | 'metal' | 'rare' }

// The original's fifteen materials, in its display order, plus Helium-3 (a modern addition for fusion).
export const MATERIALS: MaterialDef[] = [
  { id: 'hydrogen', name: 'Hydrogen', symbol: 'H', color: '#9fd3ff', group: 'volatile' },
  { id: 'oxygen', name: 'Oxygen', symbol: 'O₂', color: '#7fe3ff', group: 'volatile' },
  { id: 'water', name: 'Water', symbol: 'H₂O', color: '#4fa8ff', group: 'volatile' },
  { id: 'nitrogen', name: 'Nitrogen', symbol: 'N₂', color: '#a7b8ff', group: 'volatile' },
  { id: 'methane', name: 'Methane', symbol: 'CH₄', color: '#ffcf7a', group: 'volatile' },
  { id: 'sulphur', name: 'Sulphur', symbol: 'S', color: '#f2e45c', group: 'volatile' },
  { id: 'titanium', name: 'Titanium', symbol: 'Ti', color: '#c9d1dc', group: 'metal' },
  { id: 'aluminium', name: 'Aluminium', symbol: 'Al', color: '#dfe6ee', group: 'metal' },
  { id: 'copper', name: 'Copper', symbol: 'Cu', color: '#e3955a', group: 'metal' },
  { id: 'silica', name: 'Silica', symbol: 'Si', color: '#d8c7a6', group: 'metal' },
  { id: 'iron', name: 'Iron', symbol: 'Fe', color: '#c27a5f', group: 'metal' },
  { id: 'silver', name: 'Silver', symbol: 'Ag', color: '#e9eef5', group: 'rare' },
  { id: 'chromium', name: 'Chromium', symbol: 'Cr', color: '#9ce0c4', group: 'rare' },
  { id: 'platinum', name: 'Platinum', symbol: 'Pt', color: '#cfd8ff', group: 'rare' },
  { id: 'uranium', name: 'Uranium', symbol: 'U', color: '#8dff7a', group: 'rare' },
  { id: 'helium3', name: 'Helium-3', symbol: '³He', color: '#ff9ce6', group: 'rare' },
];

export const MATERIAL_IDS = MATERIALS.map((m) => m.id);
export const MATERIAL_BY_ID = Object.fromEntries(MATERIALS.map((m) => [m.id, m])) as Record<MaterialId, MaterialDef>;

/** Life-support consumables. */
export const LS_MATS: MaterialId[] = ['oxygen', 'water', 'nitrogen'];
/** kg per person per day (after recycling losses). */
export const LS_PER_PERSON: Record<'oxygen' | 'water' | 'nitrogen', number> = { oxygen: 1.2, water: 4, nitrogen: 0.3 };

/** Freighter loading priority: scarce first. */
export const HAUL_PRIORITY: MaterialId[] = [
  'uranium', 'chromium', 'silver', 'helium3', 'platinum', 'copper', 'nitrogen', 'water', 'methane',
  'sulphur', 'oxygen', 'hydrogen', 'titanium', 'aluminium', 'iron', 'silica',
];

export function emptyStock(): Stock {
  return Object.fromEntries(MATERIAL_IDS.map((id) => [id, 0])) as Stock;
}

export function stockFrom(c: Cost): Stock {
  const s = emptyStock();
  for (const [k, v] of Object.entries(c)) s[k as MaterialId] = v ?? 0;
  return s;
}

export function canAfford(stock: Stock, cost: Cost): boolean {
  return Object.entries(cost).every(([k, v]) => stock[k as MaterialId] >= (v ?? 0));
}

export function missing(stock: Stock, cost: Cost): Cost {
  const out: Cost = {};
  for (const [k, v] of Object.entries(cost)) {
    const need = (v ?? 0) - stock[k as MaterialId];
    if (need > 0) out[k as MaterialId] = need;
  }
  return out;
}

export function pay(stock: Stock, cost: Cost): void {
  for (const [k, v] of Object.entries(cost)) stock[k as MaterialId] -= v ?? 0;
}

export function stockTotal(s: Stock): number {
  let t = 0;
  for (const id of MATERIAL_IDS) t += s[id];
  return t;
}

export function abundanceLabel(v: number | undefined): string {
  if (!v || v <= 0) return '—';
  if (v < 1) return 'Trace';
  if (v < 3) return 'Low';
  if (v < 6) return 'Moderate';
  if (v < 9) return 'Rich';
  return 'Abundant';
}
