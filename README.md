# Flowjob Journal

<div align="center">

**A desktop trading journal and performance analytics platform built on Electron and React.**

*Build Your System. Trade With Discipline.*

[![License: MIT](https://img.shields.io/badge/License-MIT-8670ff.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite)](https://github.com/WiseLibs/better-sqlite3)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)]()

</div>

---

## Overview

Flowjob Journal is an offline-first, privacy-preserving trading journal designed for systematic retail traders—particularly those operating in futures markets. Unlike cloud-based journaling solutions, all data is stored locally on the user's machine via an embedded SQLite database, ensuring full data ownership and zero dependency on external servers.

The application is built around a core philosophy: **disciplined execution begins with rigorous self-documentation**. By enforcing structured trade logging, rule-based constraint systems, and statistical performance analysis, Flowjob Journal helps traders identify behavioral patterns and quantify the edge (or lack thereof) embedded in their trading systems.

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Installation](#installation)
- [Building from Source](#building-from-source)
- [Module Documentation](#module-documentation)
- [Analytics Engine](#analytics-engine)
- [Database Schema](#database-schema)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Core Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | Real-time performance overview with equity curve, model performance comparison, and account-filtered statistics |
| **Trade Journal** | Structured trade logging with entry time, instrument, direction, SL/TP in points, position size, outcome, screenshots, and qualitative metadata |
| **Daily Journal** | Pre-market planning and post-session reflection with discipline scoring (1–10), image attachments, and historical entry calendar |
| **Trading Models** | Playbook builder for documenting trading systems — includes confluence checklists, entry logic, ideal/invalid conditions, timeframe configurations, and step-by-step playbooks with images |
| **Analytics** | Deep statistical analysis of trade history across 12 analytical sections |
| **Calendar P&L** | Monthly calendar heat-map view of daily P&L with per-day trade drill-down |
| **Trading Rules** | Per-account rule enforcement engine with live status indicator |
| **Accounts** | Multi-account management with balance tracking and per-account performance isolation |

### Analytics Engine

Flowjob Journal computes a comprehensive suite of performance metrics:

**Return Metrics**
- Net P&L, Win Rate, Profit Factor, Expectancy
- Average Win / Loss, Best / Worst Trade
- R-Multiple distribution and scatter analysis

**Risk-Adjusted Metrics**
- Sharpe Ratio `(AvgReturn / StdDev) × √252`
- Sortino Ratio (downside deviation adjusted)
- Calmar Ratio `Net P&L / Max Drawdown`
- Maximum Drawdown (peak-to-trough cumulative P&L)

**Consistency Metrics**
- 10-trade rolling win rate
- 10-trade rolling expectancy
- Win/loss streak analysis (best, worst, current, average)
- Standard deviation of returns

**Behavioral / Timing Analytics**
- Performance by day of week
- Performance by instrument (pair)
- Long vs. Short directional breakdown
- **Day × Hour heatmap** — visualizes P&L by weekday and entry hour (requires `entry_time` field)
- Trade quality grade distribution (A+/A/B/C/F) vs. P&L correlation

**Model-Level Analytics**
- Per-model win rate, profit factor, expectancy, and net P&L
- Model comparison bar charts

**Performance Score**
A composite 0–100 score across six dimensions: Win Rate, Profit Factor, Expectancy, Sharpe Ratio, Consistency, and Payoff Ratio — visualized as a radar chart.

### Trading Rules Engine

Per-account rule configuration with live enforcement:

- **Allowed Trading Days** — whitelist specific weekdays
- **Trading Hours Window** — restrict entry to defined time range (local time)
- **Max Trades Per Day** — auto-flag violation when limit is exceeded
- **Max Loss Per Trade** — flag trades exceeding single-trade loss threshold
- **Net Max Loss Per Day** — halt indicator when daily cumulative loss hits limit
- **Manual Rules** — free-text custom rules for qualitative accountability

The live status banner polls current time and today's trade count in real-time, displaying a green/red indicator with specific violation reasons.

### Export Capabilities

- **CSV Export** — all trades with full metadata
- **PDF Report** — branded report generation for daily, weekly, monthly, or custom date ranges, rendered entirely client-side using jsPDF + jspdf-autotable
- **Model Export/Import** — `.fjmodel` format (JSON with base64-embedded images) for sharing trading systems between instances

---

## Architecture

```
flowjob-journal/
├── public/                    # Static assets (icons, PNG icon set)
├── src/
│   ├── main/                  # Electron main process (Node.js context)
│   │   ├── main.js            # Window creation, IPC handler registration
│   │   ├── database.js        # DatabaseManager — SQLite via better-sqlite3
│   │   ├── PDFExporter.js     # PDF generation (jsPDF)
│   │   └── ModelImportExport.js  # .fjmodel file handling
│   ├── components/            # Shared React components
│   │   ├── TitleBar.js        # Custom frameless window title bar
│   │   ├── Sidebar.js         # Navigation + live stats footer
│   │   ├── ErrorBoundary.js   # React error boundary
│   │   ├── Icon.js            # PNG-based icon abstraction with CSS filters
│   │   ├── ConfirmDialog.js   # Reusable confirmation modal
│   │   ├── PDFExportModal.js  # PDF export UI with date range tabs
│   │   └── SLTPInput.js       # SL/TP input with futures decimal validation
│   ├── pages/                 # Route-level page components
│   │   ├── Dashboard.js
│   │   ├── Journal.js
│   │   ├── DailyJournal.js
│   │   ├── Models.js
│   │   ├── Analytics.js
│   │   ├── CalendarPnL.js
│   │   ├── TradingRules.js
│   │   └── Accounts.js
│   ├── App.js                 # Router configuration
│   ├── App.css                # Layout and shared component styles
│   └── index.css              # Design system (CSS custom properties + global styles)
└── package.json
```

### Process Model

Flowjob Journal follows the standard Electron two-process architecture:

- **Main Process** (`src/main/`) — manages the BrowserWindow lifecycle, SQLite database access, file system operations (screenshots, exports), and native dialog invocation. All database reads and writes are performed exclusively in this process.
- **Renderer Process** (`src/`) — React application responsible for UI rendering and user interaction. Communicates with the main process exclusively via `ipcRenderer.invoke()` (asynchronous request-response) and `ipcRenderer.send()` (fire-and-forget for window controls).

### Data Flow

```
User Interaction (Renderer)
        │
        ▼
ipcRenderer.invoke('channel', payload)
        │
        ▼
ipcMain.handle('channel', handler)   ← Main Process
        │
        ▼
DatabaseManager.method(args)         ← better-sqlite3 (synchronous)
        │
        ▼
SQLite file (~/.config/Flowjob Journal/flowjob.db on Linux)
```

### Design System

All visual tokens are defined as CSS custom properties in `src/index.css`:

```css
--bg-primary, --bg-secondary, --bg-tertiary, --bg-elevated
--accent-primary   /* #8670ff — purple, used for profit/positive */
--accent-secondary /* #ff0095 — pink, used for loss/negative */
--accent-warning   /* #ffaa00 */
--font-display     /* 'Outfit' — UI text */
--font-mono        /* 'JetBrains Mono' — numeric data */
```

Typography is loaded from Google Fonts: `Outfit` (display) and `JetBrains Mono` (monospace data).

---

## Installation

### Prerequisites

| Dependency | Version |
|-----------|---------|
| Node.js | ≥ 18.x |
| npm | ≥ 9.x |

> **Note:** `better-sqlite3` includes a native addon. On Windows, Visual Studio Build Tools (C++ workload) may be required. On macOS, Xcode Command Line Tools are required.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-username/flowjob-journal.git
cd flowjob-journal

# Install dependencies (triggers electron-builder install-app-deps for native modules)
npm install

# Start in development mode (React dev server + Electron)
npm start
```

The `start` script runs two processes concurrently:
1. `react-scripts start` — webpack dev server on `http://localhost:3000`
2. `wait-on http://localhost:3000 && electron .` — launches Electron after the dev server is ready

---

## Building from Source

### Windows

```bash
npm run dist:win
```

Produces an NSIS installer (`.exe`) in `dist/`. The installer supports:
- Custom installation directory
- Desktop shortcut creation
- Start Menu shortcut creation

### macOS

```bash
npm run dist
```

Produces a `.dmg` in `dist/`. Application category is set to `public.app-category.finance`.

### Linux

```bash
npm run dist
```

Produces an `.AppImage` in `dist/`.

### Build Configuration

The `electron-builder` configuration in `package.json` uses `asar: true` with selective unpacking for native modules:

```json
"asarUnpack": [
  "node_modules/better-sqlite3/**/*",
  "node_modules/bindings/**/*",
  "node_modules/file-uri-to-path/**/*"
]
```

This is required because `better-sqlite3`'s native `.node` addon cannot be loaded from within an ASAR archive.

---

## Module Documentation

### DatabaseManager (`src/main/database.js`)

Singleton class managing all SQLite operations. Instantiated once in the main process and shared across all IPC handlers.

**Key design decisions:**
- Uses `WAL` (Write-Ahead Logging) journal mode for better concurrent read performance: `db.pragma('journal_mode = WAL')`
- All database queries are **synchronous** (better-sqlite3 API) — appropriate here since all DB access is in the main process and never blocks the renderer
- Schema migrations use a non-destructive `ALTER TABLE ADD COLUMN IF NOT EXISTS` pattern, making the app safe to upgrade from any prior version

**Trading Rules persistence:** Rules are stored in the `settings` table as JSON blobs under the key `trading_rules_{accountId}`, enabling per-account rule isolation without a dedicated table.

### SLTPInput (`src/components/SLTPInput.js`)

A specialized input component for futures Stop Loss / Take Profit values. Supports two modes:

- **Points mode** — distance in ticks/points from entry
- **Price mode** — absolute price level with snap-to-valid-decimal enforcement

Futures prices must conform to quarter-point increments (`.00`, `.25`, `.50`, `.75`). The component enforces this via `snapToValidDecimal()` on blur and `isValidPriceDecimal()` for real-time validation feedback.

The exported `priceToPoints()` utility converts price-mode values to point distances before database persistence.

### PDFExporter (`src/main/PDFExporter.js`)

Generates branded PDF reports entirely within the main process using jsPDF. All colors are hardcoded to match the application's design system:

```javascript
const C = {
  accent:   [134, 112, 255],  // #8670ff
  loss:     [255,   0, 149],  // #ff0095
  bg:       [ 13,  13,  13],  // #0d0d0d
}
```

Reports include: performance stat cards, Performance Breakdown (two-column), and a full Trade Log table with conditional color formatting via `autoTable.didParseCell`.

### ModelExportImport (`src/main/ModelImportExport.js`)

Handles `.fjmodel` file serialization. Images (model screenshot and per-playbook-step images) are embedded as Base64 strings within the JSON export, making model files fully self-contained and portable. On import, images are extracted and written to the `userData/screenshots/` directory.

A critical field-mapping layer translates `snake_case` database fields to the `camelCase` format expected by `createModel()`, enabling robust round-trip fidelity.

---

## Analytics Engine

The analytics calculation pipeline (`calcStats` in `Analytics.js`) operates on the full trade array fetched from SQLite. All computations are performed client-side in the renderer process.

### Statistical Formulas

**Sharpe Ratio** (annualized, using trade count as proxy for trading days):
```
Sharpe = (AvgReturn / StdDev) × √252
```

**Sortino Ratio** (penalizes only downside volatility):
```
DownsideDev = √(mean(negativeReturns²))
Sortino = (AvgReturn / DownsideDev) × √252
```

**Calmar Ratio:**
```
Calmar = NetPL / MaxDrawdown
```

**Expectancy:**
```
Expectancy = (WinRate × AvgWin) − (LossRate × AvgLoss)
```

**Profit Factor:**
```
ProfitFactor = GrossWins / GrossLosses
```

**Max Drawdown** is computed by iterating chronologically sorted trades, tracking the running equity peak, and recording the largest peak-to-trough decline.

**Performance Score** normalizes each metric to a 0–100 scale using min-max normalization with domain-specific bounds (e.g., win rate: 20–85%, profit factor: 0.5–3×).

### Instrument Point Values

`Journal.js` maintains a hardcoded `POINT_VALUES` map covering 40+ futures instruments across index, micro index, FX, metals, energy, grains, fixed income, crypto, and soft commodities. This enables automatic net P&L calculation from `SL points × point value × contracts`.

---

## Database Schema

```sql
accounts (
  id, name, type, initial_balance, current_balance,
  currency, description, created_at
)

models (
  id, name, market_type, timeframes, session,
  entry_logic, narrative, ideal_condition, invalid_condition,
  risk_model, screenshot_path, tags,
  confluence_checklist, playbook_steps,
  created_at, updated_at
)

trades (
  id, date, entry_time, account_id, model_id,
  pair, direction, entry_price,
  stop_loss, take_profit,          -- legacy price fields
  sl_points, tp_points,            -- normalized point distances
  position_size, account_size, risk_percent,
  r_multiple, net_pl, outcome,
  screenshot_before, screenshot_after,
  notes, emotional_state, mistake_tag,
  rule_violation, setup_quality_score,
  discipline_score, trade_grade,
  created_at
)

daily_journals (
  id, date UNIQUE, market_bias, planned_setups,
  risk_plan, emotional_state_pre, pre_market_image,
  execution_notes, what_worked, what_didnt_work,
  lessons_learned, emotional_state_post,
  post_session_image, discipline_score,
  created_at, updated_at
)

settings (
  key TEXT PRIMARY KEY, value TEXT
)
-- Stores: trading_rules_{accountId} (JSON blob)
```

JSON columns (`timeframes`, `tags`, `confluence_checklist`, `playbook_steps`) are stored as serialized strings and parsed at read time via `_parseModel()`.

---

## Known Limitations

- **Electron Security** — `nodeIntegration: true` and `contextIsolation: false` are currently enabled for simplicity. A production-hardened version should migrate to a preload script with a restricted `contextBridge` API.
- **Single-Machine Data** — There is no sync mechanism. Data lives exclusively in the local SQLite file (`userData/flowjob.db`). Manual backup of this file is recommended.
- **No Test Coverage** — The codebase currently has no automated tests (unit or integration).
- **Local Time Dependency** — All date/time computations use the system's local timezone. The application is not designed for traders who operate across timezone boundaries.
- **PDFExportModal Date Helpers** — The `today()`, `weekStart()`, `weekEnd()`, and `monthStart()` helper functions in `PDFExportModal.js` use `toISOString()` which returns UTC dates. This may cause off-by-one date errors for users in UTC+ timezones during early morning hours.

---

## Contributing

Contributions, issues, and feature requests are welcome. For major changes, please open an issue first to discuss the proposed modification.

```bash
# Fork and clone
git clone https://github.com/your-username/flowjob-journal.git

# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes, then
git commit -m "feat: describe your change"
git push origin feature/your-feature-name

# Open a Pull Request
```

---

## License

```
MIT License

Copyright (c) 2025 Flowjob-OllamaPixel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<div align="center">

Built with ❤️ for traders who take their process seriously.

*"The journal is the edge."*

</div>