/**
 * Model Export/Import - CommonJS version for Electron main process
 * FIX: Map snake_case DB export fields → camelCase expected by createModel()
 */

const fs   = require('fs');
const path = require('path');

class ModelExportImport {
  constructor(db) {
    this.db = db;
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  async exportModel(modelId, filePath) {
    const model = this.db.getModel(modelId);
    if (!model) throw new Error('Model not found');

    // Strip internal DB fields
    const { id, created_at, updated_at, ...exportData } = model;

    // Embed main screenshot as base64
    const screenshotSrc = exportData.screenshotPath || exportData.screenshot_path;
    if (screenshotSrc && fs.existsSync(screenshotSrc)) {
      try {
        exportData.screenshotBase64 = fs.readFileSync(screenshotSrc).toString('base64');
      } catch (e) {
        console.warn('Could not read model screenshot:', e.message);
      }
    }

    // Embed playbook step images as base64
    const steps = exportData.playbookSteps || exportData.playbook_steps;
    if (Array.isArray(steps)) {
      const processedSteps = steps.map(step => {
        const imgSrc = step.imagePath || step.image_path;
        if (!imgSrc || !fs.existsSync(imgSrc)) return step;
        try {
          return {
            ...step,
            imageBase64: fs.readFileSync(imgSrc).toString('base64'),
            imagePath: null,
            image_path: null,
          };
        } catch (e) {
          console.warn('Could not read step image:', e.message);
          return step;
        }
      });
      exportData.playbookSteps = processedSteps;
    }

    // Add metadata
    const output = {
      version:    '1.0',
      exportDate: new Date().toISOString(),
      model:      exportData,
    };

    fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf-8');
    return filePath;
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  async importModel(filePath, userDataPath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data    = JSON.parse(content);

    // Support both wrapped ({ version, model }) and flat formats
    const modelData = data.model || data;

    const screenshotsDir = path.join(userDataPath, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Restore main screenshot
    if (modelData.screenshotBase64) {
      try {
        const imgPath = path.join(screenshotsDir, `screenshot-${Date.now()}.png`);
        fs.writeFileSync(imgPath, Buffer.from(modelData.screenshotBase64, 'base64'));
        modelData.screenshotPath = imgPath;
        modelData.screenshot_path = imgPath;
      } catch (e) {
        console.warn('Could not restore model screenshot:', e.message);
      }
      delete modelData.screenshotBase64;
    }

    // Restore playbook step images
    const rawSteps = modelData.playbookSteps || modelData.playbook_steps;
    if (Array.isArray(rawSteps)) {
      const restoredSteps = rawSteps.map((step, i) => {
        if (!step.imageBase64) return step;
        try {
          const imgPath = path.join(screenshotsDir, `step-${Date.now()}-${i}.png`);
          fs.writeFileSync(imgPath, Buffer.from(step.imageBase64, 'base64'));
          const { imageBase64, ...rest } = step;
          return { ...rest, imagePath: imgPath };
        } catch (e) {
          console.warn(`Could not restore step ${i} image:`, e.message);
          const { imageBase64, ...rest } = step;
          return rest;
        }
      });
      modelData.playbookSteps = restoredSteps;
    }

    // Remove any leftover id/timestamps so DB creates a fresh record
    delete modelData.id;
    delete modelData.created_at;
    delete modelData.updated_at;

    // ── FIX: Map snake_case (from DB export) → camelCase (expected by createModel) ──
    // The DB stores and returns snake_case, but createModel() reads camelCase.
    // We must translate ALL fields before calling createModel().

    const MARKET_TYPE_VALUES = ['Forex', 'Futures', 'Stocks', 'Crypto', 'Options', 'Indices',
                                 'forex', 'futures', 'stocks', 'crypto', 'options', 'indices'];

    // market_type → marketType
    const rawMarketType = modelData.marketType || modelData.market_type;
    modelData.marketType = MARKET_TYPE_VALUES.includes(rawMarketType)
      ? rawMarketType
      : 'Futures';

    // name
    if (!modelData.name) {
      modelData.name = `Imported Model ${new Date().toLocaleDateString()}`;
    }

    // entry_logic → entryLogic (parse if string)
    const rawEntryLogic = modelData.entryLogic || modelData.entry_logic;
    if (typeof rawEntryLogic === 'string') {
      try { modelData.entryLogic = JSON.parse(rawEntryLogic); }
      catch(e) { modelData.entryLogic = { dailyNarrative: rawEntryLogic }; }
    } else {
      modelData.entryLogic = rawEntryLogic || {};
    }

    // ideal_condition → idealCondition
    modelData.idealCondition   = modelData.idealCondition   || modelData.ideal_condition   || '';
    // invalid_condition → invalidCondition
    modelData.invalidCondition = modelData.invalidCondition || modelData.invalid_condition || '';
    // risk_model → riskModel
    modelData.riskModel        = modelData.riskModel        || modelData.risk_model         || 'Fixed R';
    // screenshot_path → screenshotPath (already set above if restored)
    modelData.screenshotPath   = modelData.screenshotPath   || modelData.screenshot_path    || null;
    // narrative
    modelData.narrative        = modelData.narrative        || '';
    // session
    modelData.session          = modelData.session          || 'RTH';

    // confluence_checklist → confluenceChecklist (parse if string)
    const rawChecklist = modelData.confluenceChecklist || modelData.confluence_checklist;
    if (typeof rawChecklist === 'string') {
      try { modelData.confluenceChecklist = JSON.parse(rawChecklist); }
      catch(e) { modelData.confluenceChecklist = []; }
    } else {
      modelData.confluenceChecklist = Array.isArray(rawChecklist) ? rawChecklist : [];
    }

    // playbook_steps → playbookSteps (already set above, ensure array)
    const rawPbSteps = modelData.playbookSteps || modelData.playbook_steps;
    if (typeof rawPbSteps === 'string') {
      try { modelData.playbookSteps = JSON.parse(rawPbSteps); }
      catch(e) { modelData.playbookSteps = []; }
    } else {
      modelData.playbookSteps = Array.isArray(rawPbSteps) ? rawPbSteps : [];
    }

    // tags (parse if string)
    const rawTags = modelData.tags;
    if (typeof rawTags === 'string') {
      try { modelData.tags = JSON.parse(rawTags); }
      catch(e) { modelData.tags = []; }
    } else {
      modelData.tags = Array.isArray(rawTags) ? rawTags : [];
    }

    // timeframes (parse if string)
    const rawTimeframes = modelData.timeframes;
    if (typeof rawTimeframes === 'string') {
      try { modelData.timeframes = JSON.parse(rawTimeframes); }
      catch(e) { modelData.timeframes = []; }
    } else {
      modelData.timeframes = Array.isArray(rawTimeframes) ? rawTimeframes : [];
    }

    return this.db.createModel(modelData);
  }
}

module.exports = ModelExportImport;