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
    // BUG FIX #3: Default outcome pakai NULL dulu, nanti di-backfill dari net_pl
    // supaya trade lama yang profit tidak salah jadi 'loss'
    addColIfMissing('outcome',            "TEXT DEFAULT NULL");
    addColIfMissing('entry_time',         'TEXT');
    addColIfMissing('screenshot_before',  'TEXT');
    addColIfMissing('screenshot_after',   'TEXT');

    // Backfill outcome for old trades that have NULL outcome
    this.db.prepare(`
      UPDATE trades SET outcome = CASE
        WHEN net_pl > 0 THEN 'win'
        WHEN net_pl < 0 THEN 'loss'
        ELSE 'breakeven'
      END
      WHERE outcome IS NULL
    `).run();

    // ── Education Tables ──────────────────────────────────────────────────────
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS education_weeks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_number INTEGER NOT NULL UNIQUE,
        title TEXT NOT NULL,
        phase TEXT NOT NULL
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS education_slides (
        id TEXT PRIMARY KEY,
        week_number INTEGER NOT NULL,
        slide_order INTEGER NOT NULL DEFAULT 0,
        type TEXT NOT NULL DEFAULT 'text',
        title TEXT NOT NULL,
        body TEXT DEFAULT '',
        image TEXT,
        image_placeholder TEXT,
        FOREIGN KEY (week_number) REFERENCES education_weeks(week_number)
      );
    `);

    const weekCount = this.db.prepare("SELECT COUNT(*) as cnt FROM education_weeks").get();
    if (weekCount.cnt === 0) {
      const insertWeek = this.db.prepare(
        "INSERT OR IGNORE INTO education_weeks (week_number, title, phase) VALUES (?, ?, ?)"
      );

      const weekData = [
        [1,'Foundation — Auction Logic & Market Structure','Intensive Learning'],
        [2,'Liquidity Mapping & Level Building','Intensive Learning'],
        [3,'Footprint Reading & Delta Divergence','Intensive Learning'],
        [4,'Imbalance & Fair Value Gap (FVG)','Intensive Learning'],
        [5,'Pattern Library & Context Filtering','Intensive Learning'],
        [6,'Finalisasi 3 Setup Kandidat','Intensive Learning'],
        [7,'Backtest Setup A & B','Backtest & Validation'],
        [8,'Backtest Setup C & Evaluasi','Backtest & Validation'],
        [9,'Forward Test Setup Terpilih','Forward Test'],
        [10,'Lanjutan Forward Test & Evaluasi Data','Forward Test'],
        [11,'Forward Test dengan Parameter Adjustment','Refinement & Adjustment'],
        [12,'Finalisasi Sistem & Dry Run','Refinement & Adjustment'],
      ];

      weekData.forEach(([n,t,p]) => insertWeek.run(n,t,p));
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

  // BUG FIX #4: updateAccount sekarang juga menyimpan currency
  updateAccount(id, account) {
    return this.db.prepare(`
      UPDATE accounts SET name = ?, description = ?, currency = ? WHERE id = ?
    `).run(account.name, account.description || '', account.currency || 'USD', id);
  }

  // BUG FIX #2: deleteAccount sekarang null-kan account_id di semua trade terkait
  // supaya trade tidak jadi "yatim piatu" (dangling reference)
  deleteAccount(id) {
    // Don't allow deleting default accounts
    const account = this.getAccount(id);
    if (account && (account.type === 'forward' || account.type === 'backtest')) {
      throw new Error('Cannot delete default accounts');
    }
    // Putuskan relasi trade ke account ini sebelum hapus
    this.db.prepare('UPDATE trades SET account_id = NULL WHERE account_id = ?').run(id);
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
      entryLogicStr,
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
          entryLogic = parsed.dailyNarrative || parsed.keyLevel || '';
        } else {
          entryLogic = String(parsed);
        }
      }
    } catch (e) {
      entryLogic = m.entry_logic || '';
    }

    return {
      ...m,
      timeframes,
      entryLogic,
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

    const entryLogicStr = typeof model.entryLogic === 'object' && model.entryLogic !== null
      ? (model.entryLogic.dailyNarrative || '')
      : (model.entryLogic || '');

    return stmt.run(
      model.name,
      model.marketType,
      JSON.stringify(model.timeframes || []),
      model.session,
      entryLogicStr,
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
    // Null-kan referensi di trades dulu sebelum hapus
    this.db.prepare('UPDATE trades SET model_id = NULL WHERE model_id = ?').run(id);
    return this.db.prepare('DELETE FROM models WHERE id = ?').run(id);
  }

  // ─── Trade Methods ────────────────────────────────────────────────────────

  // ── HELPER: normalize trade payload ──────────────────────────────────────
  // Journal.js mengirim snake_case (entry_time, account_id, net_pl, dll.)
  // tapi kode lama database.js membaca camelCase (entryTime, accountId, netPL, dll.)
  // Helper ini mendukung KEDUANYA agar tidak ada field yang hilang saat save.
  _normalizeTrade(trade) {
    return {
      date:               trade.date,
      entryTime:          trade.entry_time          ?? trade.entryTime          ?? null,
      accountId:          trade.account_id          ?? trade.accountId          ?? null,
      modelId:            trade.model_id            ?? trade.modelId            ?? null,
      pair:               trade.pair,
      direction:          trade.direction,
      entryPrice:         trade.entry_price         ?? trade.entryPrice         ?? 0,
      slPoints:           trade.sl_points           ?? trade.slPoints           ?? 0,
      tpPoints:           trade.tp_points           ?? trade.tpPoints           ?? null,
      positionSize:       trade.position_size       ?? trade.positionSize       ?? 1,
      outcome:            trade.outcome             ?? null,
      netPL:              trade.net_pl              ?? trade.netPL              ?? 0,
      rMultiple:          trade.r_multiple          ?? trade.rMultiple          ?? null,
      notes:              trade.notes               ?? null,
      emotionalState:     trade.emotional_state     ?? trade.emotionalState     ?? null,
      mistakeTag:         trade.mistake_tag         ?? trade.mistakeTag         ?? null,
      ruleViolation:      trade.rule_violation      ?? trade.ruleViolation      ?? 0,
      setupQualityScore:  trade.setup_quality_score ?? trade.setupQualityScore  ?? null,
      disciplineScore:    trade.discipline_score    ?? trade.disciplineScore    ?? null,
      tradeGrade:         trade.trade_grade         ?? trade.tradeGrade         ?? null,
      screenshotBefore:   trade.screenshot_before   ?? trade.screenshotBefore   ?? null,
      screenshotAfter:    trade.screenshot_after    ?? trade.screenshotAfter    ?? null,
    };
  }

  createTrade(trade) {
    // BUG FIX UTAMA: Normalize dulu supaya snake_case dari Journal.js terbaca benar
    const t = this._normalizeTrade(trade);

    const cols = this.db.prepare("PRAGMA table_info(trades)").all().map(c => c.name);

    const fields = [
      'date', 'model_id', 'pair', 'direction', 'entry_price',
      'position_size', 'r_multiple', 'net_pl',
      'notes', 'emotional_state', 'mistake_tag',
      'rule_violation', 'setup_quality_score', 'discipline_score', 'trade_grade',
    ];

    const values = [
      t.date,
      t.modelId || null,
      t.pair,
      t.direction,
      t.entryPrice || 0,
      t.positionSize || 1,
      t.rMultiple || null,
      t.netPL || 0,
      t.notes || null,
      t.emotionalState || null,
      t.mistakeTag || null,
      t.ruleViolation ? 1 : 0,
      t.setupQualityScore || null,
      t.disciplineScore || null,
      t.tradeGrade || null,
    ];

    // Always fill old NOT NULL columns with safe defaults
    const oldColDefaults = {
      'stop_loss':         t.slPoints || 0,
      'take_profit':       t.tpPoints || null,
      'account_size':      25000,
      'risk_percent':      1,
      'screenshot_before': t.screenshotBefore || null,
      'screenshot_after':  t.screenshotAfter  || null,
    };
    Object.entries(oldColDefaults).forEach(([col, val]) => {
      if (cols.includes(col)) { fields.push(col); values.push(val); }
    });

    // New columns
    const newCols = {
      'sl_points':  t.slPoints || 0,
      'tp_points':  t.tpPoints || null,
      'account_id': t.accountId || null,
      'outcome':    t.outcome || (t.netPL > 0 ? 'win' : t.netPL < 0 ? 'loss' : 'breakeven'),
    };
    Object.entries(newCols).forEach(([col, val]) => {
      if (cols.includes(col)) { fields.push(col); values.push(val); }
    });

    // BUG FIX #1: Simpan entry_time ke database
    if (cols.includes('entry_time')) {
      fields.push('entry_time');
      values.push(t.entryTime || null);
    }

    const placeholders = fields.map(() => '?').join(', ');
    const result = this.db.prepare(
      `INSERT INTO trades (${fields.join(', ')}) VALUES (${placeholders})`
    ).run(...values);

    if (t.accountId) this.updateAccountBalance(t.accountId, t.netPL);
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
    // BUG FIX UTAMA: Normalize dulu supaya snake_case dari Journal.js terbaca benar
    const t = this._normalizeTrade(trade);

    const oldTrade = this.getTrade(id);
    if (oldTrade && oldTrade.account_id) {
      this.updateAccountBalance(oldTrade.account_id, -oldTrade.net_pl);
    }

    const cols = this.db.prepare("PRAGMA table_info(trades)").all().map(c => c.name);

    const sets = [
      'date = ?', 'model_id = ?', 'pair = ?', 'direction = ?', 'entry_price = ?',
      'position_size = ?', 'r_multiple = ?', 'net_pl = ?',
      'notes = ?', 'emotional_state = ?', 'mistake_tag = ?',
      'rule_violation = ?', 'setup_quality_score = ?', 'discipline_score = ?', 'trade_grade = ?',
    ];
    const values = [
      t.date,
      t.modelId || null,
      t.pair,
      t.direction,
      t.entryPrice || 0,
      t.positionSize || 1,
      t.rMultiple || null,
      t.netPL || 0,
      t.notes || null,
      t.emotionalState || null,
      t.mistakeTag || null,
      t.ruleViolation ? 1 : 0,
      t.setupQualityScore || null,
      t.disciplineScore || null,
      t.tradeGrade || null,
    ];

    const oldColDefaults = {
      'stop_loss':         t.slPoints || 0,
      'take_profit':       t.tpPoints || null,
      'account_size':      25000,
      'risk_percent':      1,
      'screenshot_before': t.screenshotBefore || null,
      'screenshot_after':  t.screenshotAfter  || null,
    };
    Object.entries(oldColDefaults).forEach(([col, val]) => {
      if (cols.includes(col)) { sets.push(`${col} = ?`); values.push(val); }
    });

    const newCols = {
      'sl_points':  t.slPoints || 0,
      'tp_points':  t.tpPoints || null,
      'account_id': t.accountId || null,
      'outcome':    t.outcome || (t.netPL > 0 ? 'win' : t.netPL < 0 ? 'loss' : 'breakeven'),
    };
    Object.entries(newCols).forEach(([col, val]) => {
      if (cols.includes(col)) { sets.push(`${col} = ?`); values.push(val); }
    });

    // BUG FIX #1: Update entry_time juga saat edit trade
    if (cols.includes('entry_time')) {
      sets.push('entry_time = ?');
      values.push(t.entryTime || null);
    }

    values.push(id);
    const result = this.db.prepare(
      `UPDATE trades SET ${sets.join(', ')} WHERE id = ?`
    ).run(...values);

    if (t.accountId) this.updateAccountBalance(t.accountId, t.netPL);
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

    const wins   = trades.filter(t => t.net_pl > 0);
    const losses = trades.filter(t => t.net_pl < 0);

    const totalWins   = wins.reduce((sum, t) => sum + t.net_pl, 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.net_pl, 0));

    const winRate     = (wins.length / trades.length) * 100;
    const avgWin      = wins.length   > 0 ? totalWins   / wins.length   : 0;
    const avgLoss     = losses.length > 0 ? totalLosses / losses.length : 0;

    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins;
    const expectancy   = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

    const returns    = trades.map(t => t.net_pl);
    const avgReturn  = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev     = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );

    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    const negativeReturns = returns.filter(r => r < 0);
    const downDev = negativeReturns.length > 0
      ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length)
      : stdDev;
    const sortinoRatio = downDev > 0 ? (avgReturn / downDev) * Math.sqrt(252) : 0;

    let cumPL      = 0;
    let maxEquity  = 0;
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
      avgRMultiple: trades.filter(t => t.r_multiple != null).reduce((sum, t) => sum + t.r_multiple, 0)
        / (trades.filter(t => t.r_multiple != null).length || 1),
      bestTrade:  Math.max(...trades.map(t => t.net_pl)),
      worstTrade: Math.min(...trades.map(t => t.net_pl)),
    };
  }

  getModelPerformance(filters = {}) {
    // BUG FIX: Filter dipindah dari WHERE ke kondisi JOIN supaya LEFT JOIN
    // tetap berfungsi benar — model tanpa trades tetap muncul dengan count = 0.
    const joinConditions = ['m.id = t.model_id'];
    const params = [];

    if (filters.accountId) {
      joinConditions.push('t.account_id = ?');
      params.push(parseInt(filters.accountId));
    }
    if (filters.startDate) {
      joinConditions.push('t.date >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      joinConditions.push('t.date <= ?');
      params.push(filters.endDate);
    }

    const joinOn = joinConditions.join(' AND ');

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
      LEFT JOIN trades t ON ${joinOn}
      GROUP BY m.id, m.name
      ORDER BY total_pl DESC
    `);

    const results = stmt.all(...params);
    return results.map(r => ({
      ...r,
      winRate:      r.total_trades > 0 ? (r.wins / r.total_trades) * 100 : 0,
      profitFactor: r.total_losses > 0 ? r.total_wins / r.total_losses : r.total_wins,
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

  getEducationWeeks() {
    return this.db.prepare(
      'SELECT * FROM education_weeks ORDER BY week_number ASC'
    ).all();
  }

  getEducationSlides(weekNumber) {
    return this.db.prepare(
      'SELECT * FROM education_slides WHERE week_number = ? ORDER BY slide_order ASC'
    ).all(weekNumber);
  }

  upsertEducationSlide(slide) {
    return this.db.prepare(`
      INSERT INTO education_slides
        (id, week_number, slide_order, type, title, body, image, image_placeholder)
      VALUES (@id, @weekNumber, @slideOrder, @type, @title, @body, @image, @imagePlaceholder)
      ON CONFLICT(id) DO UPDATE SET
        slide_order       = excluded.slide_order,
        type              = excluded.type,
        title             = excluded.title,
        body              = excluded.body,
        image             = excluded.image,
        image_placeholder = excluded.image_placeholder
    `).run({
      id: slide.id,
      weekNumber: slide.weekNumber,
      slideOrder: slide.slideOrder,
      type: slide.type,
      title: slide.title,
      body: slide.body || '',
      image: slide.image || null,
      imagePlaceholder: slide.imagePlaceholder || null,
    });
  }

  deleteEducationSlide(id) {
    return this.db.prepare(
      'DELETE FROM education_slides WHERE id = ?'
    ).run(id);
  }

  reorderEducationSlides(weekNumber, orderedIds) {
    const stmt = this.db.prepare(
      'UPDATE education_slides SET slide_order = ? WHERE id = ? AND week_number = ?'
    );

    const reorder = this.db.transaction((ids) => {
      ids.forEach((id, index) => stmt.run(index, id, weekNumber));
    });

    reorder(orderedIds);
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
      tradingDays:     ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      hoursEnabled:    true,
      hoursFrom:       '09:00',
      hoursTo:         '16:00',
      maxTradesPerDay: 0, // 0 = unlimited
      maxLossPerTrade: 0, // 0 = disabled
      maxLossPerDay:   0, // 0 = disabled
      manualRules:     [],
    };
  }

  exportToJSON() {
    return {
      accounts:   this.getAccounts(),
      models:     this.getModels(),
      trades:     this.getTrades(),
      exportDate: new Date().toISOString(),
    };
  }

  close() {
    this.db.close();
  }
}

module.exports = DatabaseManager;