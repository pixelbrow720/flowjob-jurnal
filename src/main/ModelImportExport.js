/**
 * Model Export/Import with embedded images (base64)
 */

const fs = window.require('fs');
const path = window.require('path');
const { ipcRenderer } = window.require('electron');

export async function exportModel(model) {
  // Read screenshot if exists and convert to base64
  let imageBase64 = null;
  if (model.screenshot_path) {
    try {
      const buffer = fs.readFileSync(model.screenshot_path);
      imageBase64 = buffer.toString('base64');
    } catch (e) {
      console.warn('Could not read model screenshot:', e);
    }
  }

  // Read playbook step images
  const playbookSteps = model.playbookSteps?.map(step => {
    if (!step.imagePath) return step;
    try {
      const buffer = fs.readFileSync(step.imagePath);
      return {
        ...step,
        imageBase64: buffer.toString('base64'),
        imagePath: null, // Remove local path
      };
    } catch (e) {
      console.warn('Could not read step image:', e);
      return step;
    }
  }) || [];

  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    model: {
      name: model.name,
      market_type: model.market_type,
      timeframes: model.timeframes,
      session: model.session,
      entry_logic: model.entry_logic,
      narrative: model.narrative,
      ideal_condition: model.ideal_condition,
      invalid_condition: model.invalid_condition,
      risk_model: model.risk_model,
      tags: model.tags,
      confluenceChecklist: model.confluenceChecklist,
      playbookSteps,
    },
    screenshot: imageBase64,
  };

  // Prompt user for save location
  const { dialog } = window.require('electron').remote || window.require('@electron/remote');
  const result = await dialog.showSaveDialog({
    title: 'Export Model',
    defaultPath: `${model.name.replace(/[^a-z0-9]/gi, '_')}_model.json`,
    filters: [{ name: 'Flowjob Model', extensions: ['json'] }],
  });

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2));
    return result.filePath;
  }
  return null;
}

export async function importModel() {
  const { dialog } = window.require('electron').remote || window.require('@electron/remote');
  const result = await dialog.showOpenDialog({
    title: 'Import Model',
    filters: [{ name: 'Flowjob Model', extensions: ['json'] }],
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths.length) return null;

  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);

  if (!data.model || data.version !== '1.0') {
    throw new Error('Invalid model file format');
  }

  // Decode and save screenshot
  let screenshotPath = null;
  if (data.screenshot) {
    const buffer = Buffer.from(data.screenshot, 'base64');
    screenshotPath = await ipcRenderer.invoke('save-screenshot-from-buffer', buffer);
  }

  // Decode and save playbook step images
  const playbookSteps = await Promise.all(
    (data.model.playbookSteps || []).map(async (step) => {
      if (!step.imageBase64) return step;
      const buffer = Buffer.from(step.imageBase64, 'base64');
      const imagePath = await ipcRenderer.invoke('save-screenshot-from-buffer', buffer);
      return { ...step, imagePath, imageBase64: undefined };
    })
  );

  // Create model
  const modelData = {
    ...data.model,
    screenshotPath,
    playbookSteps,
  };

  const modelId = await ipcRenderer.invoke('create-model', modelData);
  return modelId;
}