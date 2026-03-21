# Loonie Finance

Open-source, local-first Canadian personal finance web app focused on wealth prediction and net worth forecasting.

## Tech Stack
- **Vite 6 + React 19 + TypeScript** (SPA, no server)
- **Dexie.js** for IndexedDB persistence (all data stays in browser)
- **Zustand** for UI state (sidebar, theme)
- **Recharts** for charts (area, bar, pie)
- **decimal.js** for financial math precision
- **Tailwind CSS v4** with custom theme variables
- **Vitest** for testing

## Project Structure
```
src/
  engine/             # Pure TypeScript calculation engine (zero React deps)
    constants/        # Tax brackets, TFSA/RRSP/FHSA limits, CPP/OAS rates
    tax/              # Federal + provincial tax calculations
    retirement/       # FIRE, CPP, OAS calculators
    projection/       # Net worth projection, Monte Carlo simulation
    accounts/         # TFSA/RRSP/FHSA contribution room tracking
  db/                 # Dexie database + reactive hooks
  stores/             # Zustand stores (UI state only)
  components/
    ui/               # Reusable UI components (Card, Button, Input, Select, Dialog)
    layout/           # Layout + Sidebar
  pages/              # Route pages
  lib/                # Utilities (cn, formatCurrency, etc.)
  types/              # TypeScript type definitions
```

## Key Patterns
- All monetary values stored as strings, computed with `decimal.js`
- Engine modules are pure functions with no React/Dexie imports
- `@` path alias maps to `./src`
- Tests colocated in `__tests__` dirs next to source files

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm test` — run all tests (vitest)
- `npm run test:watch` — watch mode

## Canadian Financial Constants (2026)
- Federal tax: 5 brackets (15% to 33%), BPA $16,129
- All 13 provinces/territories with tax brackets
- TFSA: $7,000/year, $109,000 cumulative max (since 2009)
- RRSP: 18% of income, max $33,810
- FHSA: $8,000/year, $40,000 lifetime
- CPP: Max $1,364.60/mo at 65, early/late adjustments
- OAS: Max $742.31/mo (65-74), clawback at ~$91K income
