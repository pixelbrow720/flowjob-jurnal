const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const DatabaseManager = require('./database');
const ModelExportImport = require('./ModelImportExport');
const PDFExporter = require('./PDFExporter');

let mainWindow;
let db;
let modelExportImport;
let pdfExporter;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0a0e14',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    titleBarStyle: 'hidden',
    frame: false
  });

  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
  const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
  const prodUrl = `file://${path.join(__dirname, '../../build/index.html')}`;

  const startUrl = isDev ? devUrl : prodUrl;
  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  db = new DatabaseManager();
  modelExportImport = new ModelExportImport(db);
  pdfExporter = new PDFExporter(db);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ─── Window Controls ──────────────────────────────────────────────────────────

ipcMain.on('window-minimize', () => mainWindow.minimize());

ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

ipcMain.on('window-close', () => mainWindow.close());

// ─── Account Operations ───────────────────────────────────────────────────────

ipcMain.handle('get-accounts', async () => {
  return db.getAccounts();
});

ipcMain.handle('get-account', async (event, id) => {
  return db.getAccount(id);
});

ipcMain.handle('create-account', async (event, account) => {
  return db.createAccount(account);
});

ipcMain.handle('update-account', async (event, id, account) => {
  return db.updateAccount(id, account);
});

ipcMain.handle('delete-account', async (event, id) => {
  try {
    return db.deleteAccount(id);
  } catch (err) {
    return { error: err.message };
  }
});

// ─── Model Operations ─────────────────────────────────────────────────────────

ipcMain.handle('create-model', async (event, model) => {
  return db.createModel(model);
});

ipcMain.handle('get-models', async () => {
  return db.getModels();
});

ipcMain.handle('get-model', async (event, id) => {
  return db.getModel(id);
});

ipcMain.handle('update-model', async (event, id, model) => {
  return db.updateModel(id, model);
});

ipcMain.handle('delete-model', async (event, id) => {
  return db.deleteModel(id);
});

// ─── Trade Operations ─────────────────────────────────────────────────────────

ipcMain.handle('get-trades', async (event, filters) => {
  return db.getTrades(filters);
});

ipcMain.handle('get-trade', async (event, id) => {
  return db.getTrade(id);
});

ipcMain.handle('create-trade', async (event, trade) => {
  return db.createTrade(trade);
});

ipcMain.handle('update-trade', async (event, id, trade) => {
  return db.updateTrade(id, trade);
});

ipcMain.handle('delete-trade', async (event, id) => {
  return db.deleteTrade(id);
});

// ─── Analytics & Performance ──────────────────────────────────────────────────

ipcMain.handle('get-analytics', async (event, filters) => {
  return db.getAnalytics(filters || {});
});

ipcMain.handle('get-model-performance', async (event, filters) => {
  return db.getModelPerformance(filters || {});
});

// ─── Screenshot Handling ──────────────────────────────────────────────────────

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('save-screenshot', async (event, sourcePath) => {
  const userDataPath = app.getPath('userData');
  const screenshotsDir = path.join(userDataPath, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  const ext = path.extname(sourcePath);
  const destPath = path.join(screenshotsDir, `screenshot-${Date.now()}${ext}`);
  fs.copyFileSync(sourcePath, destPath);
  return destPath;
});

// ─── CSV Export ───────────────────────────────────────────────────────────────

ipcMain.handle('export-csv', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'CSV', extensions: ['csv'] }],
    defaultPath: `trades-${new Date().toISOString().split('T')[0]}.csv`
  });

  if (!result.canceled) {
    try {
      const trades = db.getTrades({});
      const csv = tradesToCSV(trades);
      fs.writeFileSync(result.filePath, csv, 'utf-8');
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

function tradesToCSV(trades) {
  const headers = ['Date', 'Entry Time', 'Account', 'Model', 'Pair', 'Direction',
    'Entry Price', 'SL Points', 'TP Points', 'Position Size', 'R Multiple', 'Net P/L',
    'Outcome', 'Grade', 'Emotional State', 'Mistake Tag', 'Rule Violation', 'Notes'];

  const escapeCSV = val => {
    const str = val == null ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = trades.map(t => [
    t.date,
    t.entry_time || '',
    escapeCSV(t.account_name),
    escapeCSV(t.model_name),
    escapeCSV(t.pair),
    t.direction,
    t.entry_price,
    t.sl_points || '',
    t.tp_points || '',
    t.position_size,
    t.r_multiple || '',
    t.net_pl,
    escapeCSV(t.outcome),
    escapeCSV(t.trade_grade),
    escapeCSV(t.emotional_state),
    escapeCSV(t.mistake_tag),
    t.rule_violation ? 'Yes' : 'No',
    escapeCSV(t.notes),
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// ─── Settings ─────────────────────────────────────────────────────────────────

ipcMain.handle('get-setting', async (event, key) => {
  return db.getSetting(key);
});

ipcMain.handle('set-setting', async (event, key, value) => {
  return db.setSetting(key, value);
});

// ─── Daily Journal ────────────────────────────────────────────────────────────

ipcMain.handle('get-daily-journals', async () => {
  return db.getDailyJournals();
});

ipcMain.handle('get-daily-journal', async (event, date) => {
  return db.getDailyJournal(date);
});

ipcMain.handle('save-daily-journal', async (event, journal) => {
  return db.saveDailyJournal(journal);
});

ipcMain.handle('delete-daily-journal', async (event, date) => {
  return db.deleteDailyJournal(date);
});

ipcMain.handle('get-trading-rules', async (event, accountId) => {
  return db.getTradingRules(accountId);
});

ipcMain.handle('save-trading-rules', async (event, accountId, rules) => {
  return db.saveTradingRules(accountId, rules);
});

// ─── Model Export / Import ────────────────────────────────────────────────────

ipcMain.handle('export-model', async (event, modelId) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'Flowjob Model', extensions: ['fjmodel'] }],
    defaultPath: `model-${Date.now()}.fjmodel`
  });

  if (!result.canceled) {
    try {
      await modelExportImport.exportModel(modelId, result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

ipcMain.handle('import-model', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Flowjob Model', extensions: ['fjmodel', 'json'] }],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const userDataPath = app.getPath('userData');
      const modelId = await modelExportImport.importModel(result.filePaths[0], userDataPath);
      return { success: true, modelId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

// ─── PDF Reports ──────────────────────────────────────────────────────────────

ipcMain.handle('export-pdf-daily', async (event, date) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    defaultPath: `daily-report-${date}.pdf`
  });

  if (!result.canceled) {
    try {
      pdfExporter.generateDailyReport(date, result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

ipcMain.handle('export-pdf-weekly', async (event, startDate, endDate) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    defaultPath: `weekly-report-${startDate}-to-${endDate}.pdf`
  });

  if (!result.canceled) {
    try {
      pdfExporter.generateWeeklyReport(startDate, endDate, result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

ipcMain.handle('export-pdf-monthly', async (event, year, month) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    defaultPath: `monthly-report-${year}-${String(month).padStart(2, '0')}.pdf`
  });

  if (!result.canceled) {
    try {
      pdfExporter.generateMonthlyReport(year, month, result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

ipcMain.handle('export-pdf-custom', async (event, startDate, endDate) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    defaultPath: `custom-report-${startDate}-to-${endDate}.pdf`
  });

  if (!result.canceled) {
    try {
      pdfExporter.generateCustomReport(startDate, endDate, result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

// ─── Education ────────────────────────────────────────────────────────────────
// BUG FIX: Handlers were previously nested inside export-pdf-custom callback,
// so they were never registered on app start → "No handler registered" error.

ipcMain.handle('get-education-weeks', async () => {
  return db.getEducationWeeks();
});

ipcMain.handle('get-education-slides', async (event, weekNumber) => {
  return db.getEducationSlides(weekNumber);
});

ipcMain.handle('upsert-education-slide', async (event, slide) => {
  return db.upsertEducationSlide(slide);
});

ipcMain.handle('delete-education-slide', async (event, id) => {
  return db.deleteEducationSlide(id);
});

ipcMain.handle('reorder-education-slides', async (event, weekNumber, orderedIds) => {
  return db.reorderEducationSlides(weekNumber, orderedIds);
});