/**
 * Model Export/Import - CommonJS version for Electron main process
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
    if (model.screenshot_path && fs.existsSync(model.screenshot_path)) {
      try {
        exportData.screenshotBase64 = fs.readFileSync(model.screenshot_path).toString('base64');
      } catch (e) {
        console.warn('Could not read model screenshot:', e.message);
      }
    }

    // Embed playbook step images as base64
    if (Array.isArray(exportData.playbookSteps)) {
      exportData.playbookSteps = exportData.playbookSteps.map(step => {
        if (!step.imagePath || !fs.existsSync(step.imagePath)) return step;
        try {
          return {
            ...step,
            imageBase64: fs.readFileSync(step.imagePath).toString('base64'),
            imagePath: null,
          };
        } catch (e) {
          console.warn('Could not read step image:', e.message);
          return step;
        }
      });
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
      } catch (e) {
        console.warn('Could not restore model screenshot:', e.message);
      }
      delete modelData.screenshotBase64;
    }

    // Restore playbook step images
    if (Array.isArray(modelData.playbookSteps)) {
      modelData.playbookSteps = modelData.playbookSteps.map((step, i) => {
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
    }

    // Remove any leftover id/timestamps so DB creates a fresh record
    delete modelData.id;
    delete modelData.created_at;
    delete modelData.updated_at;

    // ── Provide safe defaults for NOT NULL columns ──────────────────────────
    // These are required by the DB schema and must never be null on insert.
    const MARKET_TYPE_VALUES = ['forex', 'futures', 'stocks', 'crypto', 'options', 'indices'];
    if (!modelData.market_type || !MARKET_TYPE_VALUES.includes(modelData.market_type)) {
      modelData.market_type = modelData.market_type || 'futures';
    }
    if (!modelData.name) {
      modelData.name = `Imported Model ${new Date().toLocaleDateString()}`;
    }
    if (!modelData.description) {
      modelData.description = '';
    }
    // Ensure JSON fields are strings, not objects (SQLite stores as TEXT)
    const jsonFields = ['playbookSteps', 'rules', 'tags', 'timeframes', 'criteria'];
    jsonFields.forEach(field => {
      if (modelData[field] !== undefined && typeof modelData[field] !== 'string') {
        modelData[field] = JSON.stringify(modelData[field]);
      }
    });

    return this.db.createModel(modelData);
  }
}

module.exports = ModelExportImport;