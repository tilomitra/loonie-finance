# Loonie

Open-source, local-first **Coast FIRE calculator for Canada**. Import your Wealthsimple and TD holdings, and see when you can stop investing and let your portfolio grow to retirement. All data stays in your browser.

## Features

- **Coast FIRE** — coast number today, the age you can stop investing, and the pre-tax income you need while you coast
- **Full FIRE** — FIRE number at your retirement age and the earliest age you can retire fully
- **Canadian rules** — CPP (early/late claim adjustments), OAS (residence years, deferral, 75+ increase), optional DB pension, and 2026 federal + provincial income tax for all 13 provinces and territories
- **Bridge years** — if you retire before CPP/OAS start, the FIRE number includes the extra money you need until they do
- **Import** — Wealthsimple holdings report CSV, TD WebBroker holdings CSV, or any CSV with an account column and a value or balance column. USD holdings are converted to CAD
- **Projection chart** — "keep investing" against "stop investing today", through to your plan age
- **Return sensitivity** — coast number and coast age at ±1% and ±2% returns
- **Backup** — JSON export and restore

## How the math works

All amounts are in today's dollars. Growth uses the real return: `(1 + return) / (1 + inflation) − 1`.

1. **Withdrawal needed at each age** = spending − (CPP + OAS + pension), grossed up for tax. Tax applies to benefits and to the RRSP/RRIF/LIRA share of each withdrawal. TFSA and non-registered withdrawals are treated as tax-free.
2. **FIRE number** = long-term withdrawal ÷ withdrawal rate + present value of the extra withdrawals in the bridge years before benefits start.
3. **Coast number** = FIRE number ÷ (1 + real return)^(years to retirement).
4. **Coast age** = the first age at which the balance (with contributions until then) grows to the FIRE number by retirement with no more contributions.

Limits: no OAS clawback, no capital gains tax on non-registered accounts, no CPP/EI payroll deductions in the coasting income. Estimates only, not financial advice.

## Import formats

| Source | What to download | Notes |
| --- | --- | --- |
| Wealthsimple | Holdings report (CSV) | One file covers all accounts. Grouped by account number. |
| TD Direct Investing | WebBroker → Holdings → Export (CSV) | One file per account. The account type is read from the line above the table. |
| Anything else | A CSV with `Account` and `Market Value` / `Value` / `Balance` columns | Account type is guessed from the name (TFSA, RRSP, FHSA, LIRA, RRIF, RESP, …). |

You can check and change each account type before you import. A later import of the same account updates its balance.

## Privacy

All data is stored locally in your browser (IndexedDB). CSV files are read in the browser. Nothing is sent to a server.

## Development

```
npm install
npm run dev       # start dev server
npm run build     # production build
npm test          # run tests
```

## License

MIT
