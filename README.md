# Loonie

Open-source, local-first Canadian personal finance app. Track your net worth, project wealth growth, plan for retirement, and estimate taxes — all without your data ever leaving your browser.

## Features

- **Net Worth Tracking** — Add accounts (TFSA, RRSP, FHSA, non-registered, property, crypto, debts) and track balances over time
- **Wealth Projections** — Model net worth growth with configurable assumptions for returns, inflation, and savings rate
- **FIRE Calculator** — Lean, regular, fat, coast, and barista FIRE targets with progress tracking
- **Tax Estimator** — 2026 federal and provincial tax brackets for all 13 provinces and territories
- **CPP & OAS Estimates** — Projected government benefits by claim age with clawback calculations
- **Import / Export** — Full JSON backup and restore of all data

## Privacy

All data is stored locally in your browser using IndexedDB. Nothing is sent to any server. Ever.

## Tech Stack

React 19, TypeScript, Vite 6, Tailwind CSS v4, Dexie.js, Zustand, Recharts, decimal.js

## Development

```
npm install
npm run dev       # start dev server
npm run build     # production build
npm test          # run tests
```

## License

MIT
