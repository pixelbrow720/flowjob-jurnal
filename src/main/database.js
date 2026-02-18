const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

class DatabaseManager {
  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'flowjob.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  initialize() {
    // Create Accounts Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'custom',
        initial_balance REAL DEFAULT 25000,
        current_balance REAL DEFAULT 25000,
        currency TEXT DEFAULT 'USD',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default accounts if they don't exist
    const forwardExists = this.db.prepare("SELECT id FROM accounts WHERE type = 'forward'").get();
    if (!forwardExists) {
      this.db.prepare(
        "INSERT INTO accounts (name, type, initial_balance, current_balance, description) VALUES (?, ?, ?, ?, ?)"
      ).run('Forward Test', 'forward', 25000, 25000, 'Live forward testing account');
    }

    const backtestExists = this.db.prepare("SELECT id FROM accounts WHERE type = 'backtest'").get();
    if (!backtestExists) {
      this.db.prepare(
        "INSERT INTO accounts (name, type, initial_balance, current_balance, description) VALUES (?, ?, ?, ?, ?)"
      ).run('Backtest Account', 'backtest', 25000, 25000, 'Historical backtesting account');
    }

    // Create Models Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        market_type TEXT NOT NULL,
        timeframes TEXT,
        session TEXT,
        entry_logic TEXT,
        narrative TEXT,
        ideal_condition TEXT,
        invalid_condition TEXT,
        risk_model TEXT,
        screenshot_path TEXT,
        tags TEXT,
        confluence_checklist TEXT,
        playbook_steps TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Trades Table — all optional fields allow NULL
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL,
        account_id INTEGER,
        model_id INTEGER,
        pair TEXT NOT NULL,
        direction TEXT NOT NULL,
        entry_price REAL NOT NULL,
        stop_loss REAL DEFAULT 0,
        take_profit REAL,
        sl_points REAL DEFAULT 0,
        tp_points REAL,
        position_size INTEGER DEFAULT 1,
        account_size REAL DEFAULT 25000,
        risk_percent REAL DEFAULT 1,
        r_multiple REAL,
        net_pl REAL DEFAULT 0,
        outcome TEXT DEFAULT 'loss',
        screenshot_before TEXT,
        screenshot_after TEXT,
        notes TEXT,
        emotional_state TEXT,
        mistake_tag TEXT,
        rule_violation BOOLEAN DEFAULT 0,
        setup_quality_score INTEGER,
        discipline_score INTEGER,
        trade_grade TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (model_id) REFERENCES models(id),
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );
    `);

    // Create Settings Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // ── Daily Journals Table ───────────────────────────────────────────────────
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS daily_journals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL UNIQUE,
        market_bias TEXT,
        planned_setups TEXT,
        risk_plan TEXT,
        emotional_state_pre TEXT,
        pre_market_image TEXT,
        execution_notes TEXT,
        what_worked TEXT,
        what_didnt_work TEXT,
        lessons_learned TEXT,
        emotional_state_post TEXT,
        post_session_image TEXT,
        discipline_score INTEGER DEFAULT 5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Migrate trades table ──────────────────────────────────────────────────
    const tradeColumns = this.db.prepare("PRAGMA table_info(trades)").all().map(c => c.name);

    const addColIfMissing = (col, definition) => {
      if (!tradeColumns.includes(col)) {
        try { this.db.exec(`ALTER TABLE trades ADD COLUMN ${col} ${definition}`); } catch(e) {}
      }
    };

    addColIfMissing('account_id',         'INTEGER');
    addColIfMissing('sl_points',          'REAL DEFAULT 0');
    addColIfMissing('tp_points',          'REAL');
    addColIfMissing('outcome',            "TEXT DEFAULT 'loss'");
    addColIfMissing('stop_loss',          'REAL DEFAULT 0');
    addColIfMissing('take_profit',        'REAL');
    addColIfMissing('account_size',       'REAL DEFAULT 25000');
    addColIfMissing('risk_percent',       'REAL DEFAULT 1');
    addColIfMissing('position_size',      'INTEGER DEFAULT 1');
    addColIfMissing('screenshot_before',  'TEXT');
    addColIfMissing('screenshot_after',   'TEXT');
    addColIfMissing('entry_time', "TEXT DEFAULT NULL");

    // Sync sl_points from stop_loss if sl_points is empty (migration of old data)
    try {
      this.db.exec(`
        UPDATE trades SET sl_points = stop_loss WHERE sl_points IS NULL OR sl_points = 0 AND stop_loss > 0
      `);
    } catch(e) {}

    // ── Migrate models table ──────────────────────────────────────────────────
    const modelColumns = this.db.prepare("PRAGMA table_info(models)").all().map(c => c.name);
    if (!modelColumns.includes('timeframes')) {
      try { this.db.exec("ALTER TABLE models ADD COLUMN timeframes TEXT"); } catch(e) {}
    }

    console.log('Database initialized successfully');
  }

  // ─── Account Methods ──────────────────────────────────────────────────────

  createAccount(account) {
    const stmt = this.db.prepare(`
      INSERT INTO accounts (name, type, initial_balance, current_balance, currency, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      account.name,
      account.type || 'custom',
      account.initialBalance || 25000,
      account.initialBalance || 25000,
      account.currency || 'USD',
      account.description || ''
    );
    return result.lastInsertRowid;
  }

  getAccounts() {
    return this.db.prepare('SELECT * FROM accounts ORDER BY created_at ASC').all();
  }

  getAccount(id) {
    return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  }

  updateAccount(id, account) {
    return this.db.prepare(`
      UPDATE accounts SET name = ?, description = ? WHERE id = ?
    `).run(account.name, account.description || '', id);
  }

  deleteAccount(id) {
    // Don't allow deleting default accounts
    const account = this.getAccount(id);
    if (account && (account.type === 'forward' || account.type === 'backtest')) {
      throw new Error('Cannot delete default accounts');
    }
    return this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  }

  updateAccountBalance(accountId, delta) {
    if (!accountId) return;
    this.db.prepare('UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?').run(delta, accountId);
  }

  // ─── Model Methods ────────────────────────────────────────────────────────

  createModel(model) {
    const stmt = this.db.prepare(`
      INSERT INTO models (name, market_type, timeframes, session, entry_logic, 
        narrative, ideal_condition, invalid_condition, risk_model, screenshot_path, 
        tags, confluence_checklist, playbook_steps)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // FIX: store entryLogic as plain string, not JSON.stringify(object)
    const entryLogicStr = typeof model.entryLogic === 'object' && model.entryLogic !== null
      ? (model.entryLogic.dailyNarrative || '')
      : (model.entryLogic || '');

    const result = stmt.run(
      model.name,
      model.marketType,
      JSON.stringify(model.timeframes || []),
      model.session,
      entryLogicStr,                             // ← plain string, bukan JSON.stringify
      model.narrative,
      model.idealCondition,
      model.invalidCondition,
      model.riskModel,
      model.screenshotPath || null,
      JSON.stringify(model.tags || []),
      JSON.stringify(model.confluenceChecklist || []),
      JSON.stringify(model.playbookSteps || [])
    );

    return result.lastInsertRowid;
  }

  getModels() {
    const models = this.db.prepare('SELECT * FROM models ORDER BY created_at DESC').all();
    return models.map(m => this._parseModel(m));
  }

  getModel(id) {
    const model = this.db.prepare('SELECT * FROM models WHERE id = ?').get(id);
    return model ? this._parseModel(model) : null;
  }

  _parseModel(m) {
    let timeframes = [];
    try { timeframes = JSON.parse(m.timeframes || m.timeframe || '[]'); } catch(e) {
      if (m.timeframe) timeframes = [{ type: 'Timeframe', value: m.timeframe }];
    }
    if (!Array.isArray(timeframes)) timeframes = [];

    // FIX: always return entryLogic as plain string.
    // Handles legacy data stored as {"dailyNarrative":"..."} and new plain string.
    let entryLogic = '';
    try {
      const raw = m.entry_logic || '';
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          // Legacy format: extract text from object
          entryLogic = parsed.dailyNarrative || parsed.keyLevel || '';
        } else {
          entryLogic = String(parsed);
        }
      }
    } catch (e) {
      // Not JSON — it's already a plain string (new format)
      entryLogic = m.entry_logic || '';
    }

    return {
      ...m,
      timeframes,
      entryLogic,                                // ← always a plain string now
      tags: this._parseJSON(m.tags, []),
      confluenceChecklist: this._parseJSON(m.confluence_checklist, []),
      playbookSteps: this._parseJSON(m.playbook_steps, [])
    };
  }

  _parseJSON(val, fallback) {
    try { return JSON.parse(val || JSON.stringify(fallback)); } catch(e) { return fallback; }
  }

  updateModel(id, model) {
    const stmt = this.db.prepare(`
      UPDATE models SET 
        name = ?, market_type = ?, timeframes = ?, session = ?, entry_logic = ?,
        narrative = ?, ideal_condition = ?, invalid_condition = ?, risk_model = ?,
        screenshot_path = ?, tags = ?, confluence_checklist = ?, playbook_steps = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    // FIX: store entryLogic as plain string, not JSON.stringify(object)
    const entryLogicStr = typeof model.entryLogic === 'object' && model.entryLogic !== null
      ? (model.entryLogic.dailyNarrative || '')
      : (model.entryLogic || '');

    return stmt.run(
      model.name,
      model.marketType,
      JSON.stringify(model.timeframes || []),
      model.session,
      entryLogicStr,                             // ← plain string, bukan JSON.stringify
      model.narrative,
      model.idealCondition,
      model.invalidCondition,
      model.riskModel,
      model.screenshotPath || null,
      JSON.stringify(model.tags || []),
      JSON.stringify(model.confluenceChecklist || []),
      JSON.stringify(model.playbookSteps || []),
      id
    );
  }

  deleteModel(id) {
    return this.db.prepare('DELETE FROM models WHERE id = ?').run(id);
  }

  // ─── Trade Methods ────────────────────────────────────────────────────────

  createTrade(trade) {
    const cols = this.db.prepare("PRAGMA table_info(trades)").all().map(c => c.name);

    const fields = ['date', 'model_id', 'pair', 'direction', 'entry_price',
      'position_size', 'r_multiple', 'net_pl',
      'notes', 'emotional_state', 'mistake_tag',
      'rule_violation', 'setup_quality_score', 'discipline_score', 'trade_grade'];

    const values = [
      trade.date,
      trade.modelId || null,
      trade.pair,
      trade.direction,
      trade.entryPrice || 0,
      trade.positionSize || 1,
      trade.rMultiple || null,
      trade.netPL || 0,
      trade.notes || null,
      trade.emotionalState || null,
      trade.mistakeTag || null,
      trade.ruleViolation ? 1 : 0,
      trade.setupQualityScore || null,
      trade.disciplineScore || null,
      trade.tradeGrade || null,
    ];

    // Always fill old NOT NULL columns with safe defaults
    const oldColDefaults = {
      'stop_loss':    trade.slPoints || 0,
      'take_profit':  trade.tpPoints || null,
      'account_size': 25000,
      'risk_percent': 1,
      'screenshot_before': trade.screenshotBefore || null,
      'screenshot_after':  trade.screenshotAfter  || null,
    };
    Object.entries(oldColDefaults).forEach(([col, val]) => {
      if (cols.includes(col)) { fields.push(col); values.push(val); }
    });

    // New columns
    const newCols = {
      'sl_points':  trade.slPoints || 0,
      'tp_points':  trade.tpPoints || null,
      'account_id': trade.accountId || null,
      'outcome':    trade.outcome || (trade.netPL >= 0 ? 'win' : 'loss'),
    };
    Object.entries(newCols).forEach(([col, val]) => {
      if (cols.includes(col)) { fields.push(col); values.push(val); }
    });

    const placeholders = fields.map(() => '?').join(', ');
    const result = this.db.prepare(
      `INSERT INTO trades (${fields.join(', ')}) VALUES (${placeholders})`
    ).run(...values);

    if (trade.accountId) this.updateAccountBalance(trade.accountId, trade.netPL);
    return result.lastInsertRowid;
  }

  getTrades(filters = {}) {
    let query = `
      SELECT t.*, m.name as model_name, a.name as account_name
      FROM trades t
      LEFT JOIN models m ON t.model_id = m.id
      LEFT JOIN accounts a ON t.account_id = a.id
    `;
    const conditions = [];
    const params = [];

    if (filters.accountId) {
      conditions.push('t.account_id = ?');
      params.push(parseInt(filters.accountId));
    }
    if (filters.modelId) {
      conditions.push('t.model_id = ?');
      params.push(filters.modelId);
    }
    if (filters.startDate) {
      conditions.push('t.date >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push('t.date <= ?');
      params.push(filters.endDate);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY t.date DESC, t.created_at DESC';

    return this.db.prepare(query).all(...params);
  }

  getTrade(id) {
    return this.db.prepare(`
      SELECT t.*, m.name as model_name, a.name as account_name
      FROM trades t
      LEFT JOIN models m ON t.model_id = m.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.id = ?
    `).get(id);
  }

  updateTrade(id, trade) {
    const oldTrade = this.getTrade(id);
    if (oldTrade && oldTrade.account_id) {
      this.updateAccountBalance(oldTrade.account_id, -oldTrade.net_pl);
    }

    const cols = this.db.prepare("PRAGMA table_info(trades)").all().map(c => c.name);

    const sets = [
      'date = ?', 'model_id = ?', 'pair = ?', 'direction = ?', 'entry_price = ?',
      'position_size = ?', 'r_multiple = ?', 'net_pl = ?',
      'notes = ?', 'emotional_state = ?', 'mistake_tag = ?',
      'rule_violation = ?', 'setup_quality_score = ?', 'discipline_score = ?', 'trade_grade = ?'
    ];
    const values = [
      trade.date,
      trade.modelId || null,
      trade.pair,
      trade.direction,
      trade.entryPrice || 0,
      trade.positionSize || 1,
      trade.rMultiple || null,
      trade.netPL || 0,
      trade.notes || null,
      trade.emotionalState || null,
      trade.mistakeTag || null,
      trade.ruleViolation ? 1 : 0,
      trade.setupQualityScore || null,
      trade.disciplineScore || null,
      trade.tradeGrade || null,
    ];

    const oldColDefaults = {
      'stop_loss':    trade.slPoints || 0,
      'take_profit':  trade.tpPoints || null,
      'account_size': 25000,
      'risk_percent': 1,
      'screenshot_before': trade.screenshotBefore || null,
      'screenshot_after':  trade.screenshotAfter  || null,
    };
    Object.entries(oldColDefaults).forEach(([col, val]) => {
      if (cols.includes(col)) { sets.push(`${col} = ?`); values.push(val); }
    });

    const newCols = {
      'sl_points':  trade.slPoints || 0,
      'tp_points':  trade.tpPoints || null,
      'account_id': trade.accountId || null,
      'outcome':    trade.outcome || (trade.netPL >= 0 ? 'win' : 'loss'),
    };
    Object.entries(newCols).forEach(([col, val]) => {
      if (cols.includes(col)) { sets.push(`${col} = ?`); values.push(val); }
    });

    values.push(id);
    const result = this.db.prepare(
      `UPDATE trades SET ${sets.join(', ')} WHERE id = ?`
    ).run(...values);

    if (trade.accountId) this.updateAccountBalance(trade.accountId, trade.netPL);
    return result;
  }

  deleteTrade(id) {
    const trade = this.getTrade(id);
    const result = this.db.prepare('DELETE FROM trades WHERE id = ?').run(id);
    
    // Reverse balance effect
    if (trade && trade.account_id) {
      this.updateAccountBalance(trade.account_id, -trade.net_pl);
    }
    return result;
  }

  // ─── Analytics Methods ────────────────────────────────────────────────────

  getAnalytics(filters = {}) {
    const trades = this.getTrades(filters);
    
    if (trades.length === 0) return null;

    const wins = trades.filter(t => t.net_pl > 0);
    const losses = trades.filter(t => t.net_pl < 0);
    
    const totalWins = wins.reduce((sum, t) => sum + t.net_pl, 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.net_pl, 0));
    
    const winRate = (wins.length / trades.length) * 100;
    const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
    
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins;
    const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;
    
    const returns = trades.map(t => t.net_pl);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
    
    const negativeReturns = returns.filter(r => r < 0);
    const downDev = negativeReturns.length > 0 
      ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length)
      : stdDev;
    const sortinoRatio = downDev > 0 ? (avgReturn / downDev) * Math.sqrt(252) : 0;
    
    let cumPL = 0;
    let maxEquity = 0;
    let maxDrawdown = 0;
    
    [...trades].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
      cumPL += t.net_pl;
      if (cumPL > maxEquity) maxEquity = cumPL;
      const drawdown = maxEquity - cumPL;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    return {
      totalTrades: trades.length,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      expectancy,
      sharpeRatio,
      sortinoRatio,
      stdDev,
      totalPL: trades.reduce((sum, t) => sum + t.net_pl, 0),
      maxDrawdown,
      avgRMultiple: trades.filter(t => t.r_multiple != null).reduce((sum, t) => sum + t.r_multiple, 0) / (trades.filter(t => t.r_multiple != null).length || 1),
      bestTrade: Math.max(...trades.map(t => t.net_pl)),
      worstTrade: Math.min(...trades.map(t => t.net_pl))
    };
  }

  getModelPerformance(filters = {}) {
    const params = [];
    const conditions = ['t.id IS NOT NULL'];

    if (filters.accountId) {
      conditions.push('t.account_id = ?');
      params.push(parseInt(filters.accountId));
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const stmt = this.db.prepare(`
      SELECT 
        m.id, m.name,
        COUNT(t.id) as total_trades,
        SUM(CASE WHEN t.net_pl > 0 THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN t.net_pl > 0 THEN t.net_pl ELSE 0 END) as total_wins,
        SUM(CASE WHEN t.net_pl < 0 THEN ABS(t.net_pl) ELSE 0 END) as total_losses,
        AVG(t.r_multiple) as avg_r,
        SUM(t.net_pl) as total_pl
      FROM models m
      LEFT JOIN trades t ON m.id = t.model_id
      ${where}
      GROUP BY m.id, m.name
      ORDER BY total_pl DESC
    `);
    
    const results = stmt.all(...params);
    return results.map(r => ({
      ...r,
      winRate: r.total_trades > 0 ? (r.wins / r.total_trades) * 100 : 0,
      profitFactor: r.total_losses > 0 ? r.total_wins / r.total_losses : r.total_wins
    }));
  }

  getSetting(key) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  setSetting(key, value) {
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    return true;
  }

  // ─── Daily Journal Methods ────────────────────────────────────────────────

  getDailyJournals() {
    return this.db.prepare('SELECT * FROM daily_journals ORDER BY date DESC').all();
  }

  getDailyJournal(date) {
    return this.db.prepare('SELECT * FROM daily_journals WHERE date = ?').get(date);
  }

  saveDailyJournal(journal) {
    const existing = this.getDailyJournal(journal.date);
    if (existing) {
      return this.db.prepare(`
        UPDATE daily_journals SET
          market_bias = ?, planned_setups = ?, risk_plan = ?, emotional_state_pre = ?, pre_market_image = ?,
          execution_notes = ?, what_worked = ?, what_didnt_work = ?, lessons_learned = ?,
          emotional_state_post = ?, post_session_image = ?, discipline_score = ?, updated_at = CURRENT_TIMESTAMP
        WHERE date = ?
      `).run(
        journal.market_bias, journal.planned_setups, journal.risk_plan, journal.emotional_state_pre, journal.pre_market_image,
        journal.execution_notes, journal.what_worked, journal.what_didnt_work, journal.lessons_learned,
        journal.emotional_state_post, journal.post_session_image, journal.discipline_score, journal.date
      );
    } else {
      return this.db.prepare(`
        INSERT INTO daily_journals (date, market_bias, planned_setups, risk_plan, emotional_state_pre, pre_market_image,
          execution_notes, what_worked, what_didnt_work, lessons_learned, emotional_state_post, post_session_image, discipline_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        journal.date, journal.market_bias, journal.planned_setups, journal.risk_plan, journal.emotional_state_pre, journal.pre_market_image,
        journal.execution_notes, journal.what_worked, journal.what_didnt_work, journal.lessons_learned,
        journal.emotional_state_post, journal.post_session_image, journal.discipline_score
      );
    }
  }

  deleteDailyJournal(date) {
    return this.db.prepare('DELETE FROM daily_journals WHERE date = ?').run(date);
  }

  getTradingRules(accountId) {
    const key = `trading_rules_${accountId}`;
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row) return this._defaultTradingRules();
    try {
      return { ...this._defaultTradingRules(), ...JSON.parse(row.value) };
    } catch (e) {
      return this._defaultTradingRules();
    }
  }

  saveTradingRules(accountId, rules) {
    const key = `trading_rules_${accountId}`;
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run(key, JSON.stringify(rules));
    return true;
  }

  _defaultTradingRules() {
    return {
      tradingDays:    ['Mon','Tue','Wed','Thu','Fri'],
      hoursEnabled:   true,
      hoursFrom:      '09:00',
      hoursTo:        '16:00',
      maxTradesPerDay: 0,      // 0 = unlimited
      maxLossPerTrade: 0,      // 0 = disabled
      maxLossPerDay:   0,      // 0 = disabled
      manualRules:    [],
    };
  }

  exportToJSON() {
    return {
      accounts: this.getAccounts(),
      models: this.getModels(),
      trades: this.getTrades(),
      exportDate: new Date().toISOString()
    };
  }

  close() {
    this.db.close();
  }
}

module.exports = DatabaseManager;