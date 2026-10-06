# BC Lottery Simulator

A browser-based simulator for five Canadian lottery games: Lotto Max, Lotto 6/49, BC/49, Daily Grand, and Keno. It is an independent local project for virtual play and historical-data exploration.

> This project is not affiliated with or endorsed by PlayNow or BCLC. It does not sell tickets, connect to real accounts or payment services, or award redeemable prizes. All balances, purchases, and winnings are virtual.

## Features

- English and Canadian French interface; English is the default. Language preference is saved in this browser.
- Local wallet with virtual Cash, deposit controls, ticket history, and browser autosave.
- Lottery purchase flow with manual picks, Quick Pick, configurable plays, supported add-ons, and draw settlement.
- Lottery-specific rules and prize tiers presented within the app.
- Historical winning-number statistics with selectable date ranges, number-frequency rankings, co-occurrence analysis, and searchable draw records.
- Local JSON backup and restore, with IndexedDB persistence and schema migration.
- Responsive layout and accessibility support.

Lottery rules and add-on availability are based on the versioned configurations in `src/data/definitions/`. Lotto Max uses the rule baseline effective April 10, 2026. Simulated sales and prize-pool inputs are illustrative and are not represented as live PlayNow data.

## Requirements

- Node.js `>=22.13.0`
- npm

## Run locally

```powershell
npm install
npm run dev
```

Useful project commands:

```powershell
npm run check          # lint, typecheck, and tests
npm run format:check   # formatting check
npm run build         # production build
npm run preview       # serve the production build locally
npm run check:release # release quality gate
```

## Historical results

The app uses a normalized, bundled historical-results snapshot for statistics; the statistics view does not scrape the website at runtime. The snapshot currently covers September 27, 2021 through September 27, 2026 for the four scheduled draw games. Keno is handled separately because it draws every few minutes.

To refresh the snapshot, use the project sync command with an end date and an optional start date:

```powershell
npm run sync:draws -- 2026-09-27 2021-09-27
```

The synchronizer uses publicly accessible PlayNow results data. Review the generated data changes and run the release checks before shipping an update. For current official results, use [PlayNow Winning Numbers](https://www.playnow.com/lottery/winning-numbers/).

Historical frequency and co-occurrence describe past draws only. They do not change the probability of a future independent draw or provide a reliable prediction.

## Documentation

Start with the [documentation index](docs/README.md). The project charter, product decisions, rules baseline, sprint records, and release/rollback instructions are maintained in `docs/`.

## Project layout

```text
docs/                    Project planning, rules baseline, and sprint notes
public/                  Lottery logos, banners, and other visual assets
src/app/                 Application assembly and pages
src/components/           Shared interface components
src/data/definitions/     Versioned rules for the five games
src/data/history/         Bundled results and statistics models
src/i18n/                 English/French dictionaries and language state
src/domain/lottery/       Picks, draws, settlement, and lottery state
src/domain/economy/       Virtual wallet and ledger
src/storage/              Local persistence and data migration
tests/                    Automated rule and application tests
```
