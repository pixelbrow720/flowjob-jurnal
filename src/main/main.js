const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const DatabaseManager = require('./database');

let mainWindow;
let db;

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

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../../build/index.html')}`;
  mainWindow.loadURL(startUrl);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  db = new DatabaseManager();
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

ipcMain.handle('create-trade', async (event, trade) => {
  return db.createTrade(trade);
});

ipcMain.handle('get-trades', async (event, filters) => {
  return db.getTrades(filters || {});
});

ipcMain.handle('get-trade', async (event, id) => {
  return db.getTrade(id);
});

ipcMain.handle('update-trade', async (event, id, trade) => {
  return db.updateTrade(id, trade);
});

ipcMain.handle('delete-trade', async (event, id) => {
  return db.deleteTrade(id);
});

// ─── Analytics ────────────────────────────────────────────────────────────────

ipcMain.handle('get-analytics', async (event, filters) => {
  return db.getAnalytics(filters || {});
});

ipcMain.handle('get-model-performance', async (event, filters) => {
  return db.getModelPerformance(filters || {});
});

// ─── File Operations ──────────────────────────────────────────────────────────

ipcMain.handle('select-file', async (event, opts = {}) => {
  const filters = opts.images
    ? [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
    : [{ name: 'All Files', extensions: ['*'] }];

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters
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
  
  const fileName = `screenshot-${Date.now()}${path.extname(sourcePath)}`;
  const destPath = path.join(screenshotsDir, fileName);
  
  fs.copyFileSync(sourcePath, destPath);
  return destPath;
});

// ─── Export Operations ────────────────────────────────────────────────────────

ipcMain.handle('export-csv', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'CSV', extensions: ['csv'] }],
    defaultPath: `trades-${new Date().toISOString().split('T')[0]}.csv`
  });
  
  if (!result.canceled) {
    const trades = db.getTrades();
    const csv = convertToCSV(trades);
    fs.writeFileSync(result.filePath, csv);
    return result.filePath;
  }
  return null;
});

ipcMain.handle('export-backup', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'JSON', extensions: ['json'] }],
    defaultPath: `backup-${new Date().toISOString().split('T')[0]}.json`
  });
  
  if (!result.canceled) {
    const data = db.exportToJSON();
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
    return result.filePath;
  }
  return null;
});

function convertToCSV(trades) {
  const headers = [
    'Date', 'Account', 'Model', 'Pair', 'Direction', 'Entry', 'SL (pts)', 'TP (pts)',
    'Size', 'R-Multiple', 'Net P/L', 'Outcome',
    'Notes', 'Emotional State', 'Rule Violation'
  ];
  
  const rows = trades.map(t => [
    t.date,
    t.account_name || '',
    t.model_name || '',
    t.pair,
    t.direction,
    t.entry_price,
    t.sl_points,
    t.tp_points || '',
    t.position_size,
    t.r_multiple || '',
    t.net_pl,
    t.outcome || '',
    (t.notes || '').replace(/,/g, ';'),
    t.emotional_state || '',
    t.rule_violation ? 'Yes' : 'No'
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// Settings key-value store
ipcMain.handle('get-setting', async (event, key) => {
  return db.getSetting(key);
});
ipcMain.handle('set-setting', async (event, key, value) => {
  return db.setSetting(key, value);
});