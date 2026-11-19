# Loonie Finance

Open-source, local-first Coast FIRE calculator for Canada. Imports Wealthsimple and TD holdings CSVs.

## Tech Stack
- **Vite + React 19 + TypeScript** (SPA, no server)
- **Dexie.js** for IndexedDB persistence (database `loonie-fire`; all data stays in browser)
- **Recharts** for the projection chart
- **decimal.js** for financial math precision
- **Tailwind CSS v4** with custom theme variables
- **Vitest** for testing

## Project Structure
```
src/
  engine/             # Pure TypeScript calculation engine (zero React deps)
    constants/        # Tax brackets, CPP/OAS rates (2026)
    tax/              # Federal + provincial tax calculations
    retirement/       # CPP, OAS benefit estimates
    fire/             # FIRE + Coast FIRE engine (coast-fire.ts)
    import/           # CSV parser + Wealthsimple/TD/generic holdings importer
  db/                 # Dexie database, hooks, account writes
  components/         # PlanForm, Results, ProjectionChart, AccountsPage, ImportPanel, DataPage
    ui/               # Card, Button, Input, Select, Field/Toggle
  lib/                # Utilities; plan-inputs.ts maps the saved plan + accounts to engine inputs
  types/              # Account, Plan, Province types
```

## Key Patterns
- All monetary values stored as strings, computed with `decimal.js`
- Engine works in today's dollars with the real return; tax brackets are treated as indexed
- Engine modules are pure functions with no React/Dexie imports
- `@` path alias maps to `./src`
- Tests colocated in `__tests__` dirs; import fixtures in `src/engine/import/__tests__/fixtures`
- Tabs use the URL hash (`#plan`, `#accounts`, `#data`); no router

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm test` — run all tests (vitest)
- `npm run test:watch` — watch mode

## Canadian Financial Constants (2026)
- Federal tax: 5 brackets (15% to 33%), BPA $16,129
- All 13 provinces/territories with tax brackets
- CPP: Max $1,364.60/mo at 65; −0.6%/mo before 65, +0.7%/mo after 65
- OAS: Max $742.31/mo (65-74), $816.54 (75+), +0.6%/mo deferral to 70, 40 years residence for full
