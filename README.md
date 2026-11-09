# Millennium 2.2 — Remake

A modern, browser-based remake of Ian Bird's 1989 strategy game *Millennium 2.2* (Atari ST / Amiga / DOS).
TypeScript + React + Zustand, mobile-first, playable on a phone.

> 30 January 2200. An asteroid has made Earth uninhabitable. Moonbase is the last outpost of humanity —
> apart from the Ares Collective on Mars, who want Earth for themselves.

## Run it

```bash
npm install
npm run dev            # local dev server
npm test               # engine tests incl. full scripted playthroughs
npm run experiment     # opening-strategy balance report (slow, prints a table)
npm run build          # static build in dist/
npm run build:single   # one self-contained index.html in dist-single/
```

## The game

* **Turn-based, one day at a time** — Next day, or run/fast-forward; the clock stops itself for raids, story beats, idle labs or an empty factory.
* **Moonbase** has seven departments (Life Support, Energy, Research, Refinery, Production, Flight Deck, Defence); **colonies** have five (no Research or Production). Moonbase grows from 100 to 600 people with Habitation Modules; colonies cap at 100.
* **The core loop:** probe → survey → colonise → mine → haul home. Travel takes days to months, computed from real orbital positions. Faster drives come from research.
* **Real solar system, 2026 knowledge:** 31 bodies with real orbits and resource profiles informed by MESSENGER, Dawn, Juno, Cassini and New Horizons (Ceres brines, Enceladus plumes, Titan methane, Psyche metal, Ganymede's magnetosphere…).
* **16 materials** — the original 15 plus Helium-3. As in the original, copper isn't on the Moon, and silver, chromium and uranium aren't on the Moon or in the belt.
* **Power balancing:** solar falls off with distance² from the Sun; departments draw power in priority order and can be switched off.
* **The Ares Collective** launch escalating raids you can see coming on the map. Lasers fire first, fighters next, shields soak damage.
* **Two ways to end the war:** conquest (battlecruisers + troopship) or the Accord (study salvage, develop a cure, send a hospital ship).
* **Win** by probing Earth, researching terraforming and keeping Terraforming Engines fed until Earth is restored.
* **The Archive:** documents recovered as research brings old designs back into use. They file quietly (a badge, never a pause) and piece together what happened before the impact. The Menu shows how the archive has been used, for playtests.

### Modern fixes to the original's complaints

* **Automation:** freighters loop between Moonbase and their colony on their own (life support out, ore back, crated equipment delivered); miners and gas scoops loop too; repeatable production.
* **Replayability:** seeded, varied resource distributions; random events; three difficulty levels; score.
* **No hungover mini-game:** battles resolve from your defences, with a readable damage report. (A proper combat view is a planned module.)
* Objectives checklist, autosave, three save slots, export/import.

## Architecture

```
src/engine/   pure TypeScript game engine — no React, deterministic, JSON state
  data/       bodies, materials, research tree, blueprints, story text (lore.ts re-themes the adversary)
  tick.ts     advanceDay(): installations → fleet → Earth → threat → events → win/lose
  actions.ts  player commands: (state, args) → new state | error
src/store/    Zustand store: wraps engine, run loop, saves
src/ui/       React panels: Base, System map (canvas), Fleet, Research, Build, Log, Archive
tests/        Vitest: orbits, determinism, save round-trip, and a scripted bot that plays full games
.github/      CI: typecheck, tests, build; uploads the single-file playable for every push and PR
```

The engine is seeded (Mulberry32) and every tick is a pure function, so a save reloads and replays identically.
