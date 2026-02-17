# Flowjob Journal

**Build Your System. Trade With Discipline.**

A professional desktop trading journal application for discretionary traders to build trading systems, log trades, and analyze performance with deep analytics.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🎯 Features

### Trading System Builder
- **Create Custom Models**: Define your trading systems with detailed parameters
- **Model Components**:
  - Market type, timeframe, and session specification
  - Entry logic and narrative descriptions
  - Ideal and invalid market conditions
  - Risk management models (Fixed R, % Risk, ATR Based)
  - Confluence checklist system
  - Step-by-step playbook

### Trade Journal
- **Comprehensive Trade Logging**:
  - All essential trade data (entry, stop, target, position size)
  - Model association
  - Automatic R-multiple calculation
  - Screenshot uploads (before/after)
  - Emotional state tracking
  - Mistake tagging
  - Rule violation tracking
  - Setup quality and discipline scoring
  - Trade grading system (A+, A, B, C, F)

### Advanced Analytics Engine
- **Core Metrics**:
  - Win Rate, Profit Factor, Expectancy
  - Average R-Multiple
  - Best/Worst Trades
  
- **Risk Metrics**:
  - Sharpe Ratio
  - Sortino Ratio
  - Standard Deviation
  - Maximum Drawdown
  
- **Visual Analytics**:
  - Equity Curve
  - Drawdown Analysis
  - R-Multiple Distribution
  - Long vs Short Performance
  - Model Performance Comparison
  - Monthly Performance
  - Day of Week Analysis
  - Session Performance

### Professional UI
- Dark theme optimized for trading
- Modern, clean interface
- Smooth animations and transitions
- Responsive design
- Custom typography (Outfit + JetBrains Mono)

## 🛠 Tech Stack

- **Frontend**: React 18
- **Desktop Framework**: Electron
- **Database**: SQLite (better-sqlite3)
- **Charts**: Recharts
- **Styling**: Custom CSS with CSS Variables
- **Build**: electron-builder

## 📋 Prerequisites

- Node.js 16 or higher
- npm or yarn
- Windows, macOS, or Linux

## 🚀 Installation & Setup

### 1. Clone or Download

```bash
cd flowjob-journal
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Development Mode

Run in development mode with hot reload:

```bash
npm start
```

This will:
1. Start the React development server on http://localhost:3000
2. Launch the Electron app automatically

### 4. Build for Production

#### Build React App
```bash
npm run build
```

#### Package as Electron App
```bash
npm run dist
```

This creates distribution files in the `dist/` directory.

#### Platform-Specific Builds

**Windows (.exe)**:
```bash
npm run dist -- --win
```

**macOS (.dmg)**:
```bash
npm run dist -- --mac
```

**Linux (.AppImage)**:
```bash
npm run dist -- --linux
```

## 📁 Project Structure

```
flowjob-journal/
├── public/
│   └── index.html              # HTML template
├── src/
│   ├── main/
│   │   ├── main.js             # Electron main process
│   │   └── database.js         # SQLite database manager
│   ├── components/
│   │   ├── TitleBar.js         # Custom window controls
│   │   ├── TitleBar.css
│   │   ├── Sidebar.js          # Navigation sidebar
│   │   └── Sidebar.css
│   ├── pages/
│   │   ├── Dashboard.js        # Overview page
│   │   ├── Models.js           # Trading system builder
│   │   ├── Models.css
│   │   ├── Journal.js          # Trade logging
│   │   ├── Journal.css
│   │   ├── Analytics.js        # Performance analytics
│   │   └── Analytics.css
│   ├── App.js                  # Main App component
│   ├── App.css                 # App styles
│   ├── index.js                # React entry point
│   └── index.css               # Global styles
├── package.json
└── README.md
```

## 💾 Database Schema

### Models Table
- Model configuration and playbook
- Market type, timeframe, session
- Entry logic and conditions
- Confluence checklist
- Playbook steps

### Trades Table
- Complete trade data
- Model association
- Risk management metrics
- Performance tracking
- Emotional and mistake logging

### Settings Table
- User preferences
- Application configuration

## 🎨 Customization

### Theme Colors

Edit `src/index.css` to customize the color scheme:

```css
:root {
  --bg-primary: #0a0e14;
  --bg-secondary: #121720;
  --accent-primary: #00ff88;
  --accent-secondary: #00d4ff;
  /* ... */
}
```

### Typography

The app uses:
- **Display**: Outfit (headings, UI)
- **Monospace**: JetBrains Mono (numbers, code)

## 📊 Key Formulas

### Sharpe Ratio
```
Sharpe = (Mean Return - Risk Free Rate) / Standard Deviation
```

### Expectancy
```
Expectancy = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
```

### Profit Factor
```
Profit Factor = Gross Profit / Gross Loss
```

### R-Multiple
```
R = (Exit - Entry) / (Entry - Stop)
```

## 🔄 Data Export

- **CSV Export**: Export all trades to CSV format
- **Backup**: Full database JSON backup
- **PDF Reports**: Model playbooks (future feature)

## 🚧 Future Features (Roadmap)

- [ ] Cloud sync capability
- [ ] Multi-user mode
- [ ] Trader leaderboards
- [ ] AI feedback engine
- [ ] Bias detection
- [ ] Rule violation detection
- [ ] Monte Carlo simulation
- [ ] Risk of Ruin calculator
- [ ] Advanced backtesting
- [ ] Trade replay system

## 🐛 Troubleshooting

### Database Issues
If you encounter database errors, delete the database file:
- **Windows**: `%APPDATA%/flowjob-journal/flowjob.db`
- **macOS**: `~/Library/Application Support/flowjob-journal/flowjob.db`
- **Linux**: `~/.config/flowjob-journal/flowjob.db`

### Build Issues
1. Clear node_modules: `rm -rf node_modules package-lock.json`
2. Reinstall: `npm install`
3. Rebuild: `npm run build && npm run dist`

### Electron Not Starting
- Ensure React dev server is running first
- Check port 3000 is available
- Try: `npm run start:renderer` then `npm run start:electron`

## 📝 Sample Data

To test with dummy data:

1. Create a few trading models
2. Log sample trades with different outcomes
3. Explore the analytics dashboard

## 🔒 Security & Privacy

- All data stored locally (SQLite)
- No external connections required
- Full data ownership
- Export/backup control

## 🤝 Contributing

This is a proprietary trading journal application. For feature requests or bug reports, please create an issue.

## 📄 License

MIT License - See LICENSE file for details

## 💡 Tips for Best Use

1. **Define Models First**: Create your trading systems before logging trades
2. **Be Consistent**: Log trades immediately after closing
3. **Track Everything**: Use all fields for maximum insights
4. **Review Regularly**: Check analytics weekly/monthly
5. **Grade Honestly**: Accurate grading improves discipline tracking
6. **Tag Mistakes**: Learn from violations and mistakes
7. **Export Backups**: Regular backups protect your data

## 🎯 Philosophy

**"The goal is not just to track trades, but to build and refine your trading system through disciplined execution and continuous improvement."**

---

Built with ⚡ for serious traders who trade with discipline.
