import React, { useState, useEffect } from 'react';
import './Models.css';
import ConfirmDialog from '../components/ConfirmDialog';
import Icon from '../components/Icon';

const { ipcRenderer } = window.require('electron');
const PUB = process.env.PUBLIC_URL;

const Ico = ({ src, size = 14, style = {} }) => (
  <img src={src} alt="" style={{
    width: size, height: size, objectFit: 'contain',
    filter: 'invert(1) brightness(0.85)',
    flexShrink: 0, ...style
  }} />
);

function Models() {
  const [models, setModels]             = useState([]);
  const [showModal, setShowModal]       = useState(false);
  const [previewModel, setPreviewModel] = useState(null);
  const [zoomImage, setZoomImage]       = useState(null);
  const [editingModel, setEditingModel] = useState(null);
  const [formData, setFormData]         = useState(defaultForm());
  const [confirmDelete, setConfirmDelete] = useState(null); // holds model to delete

  useEffect(() => { loadModels(); }, []);

  const loadModels = async () => {
    const data = await ipcRenderer.invoke('get-models');
    setModels(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingModel) {
      await ipcRenderer.invoke('update-model', editingModel.id, formData);
    } else {
      await ipcRenderer.invoke('create-model', formData);
    }
    loadModels();
    closeModal();
  };

  const handleDelete = (model) => setConfirmDelete(model);

  const doDelete = async () => {
    if (!confirmDelete) return;
    await ipcRenderer.invoke('delete-model', confirmDelete.id);
    setConfirmDelete(null);
    loadModels();
  };

  const handleImportModel = async () => {
    const result = await ipcRenderer.invoke('import-model');
    if (result.success) {
      loadModels();
      alert('Model imported successfully!');
    } else if (!result.canceled) {
      alert(`Import failed: ${result.error}`);
    }
  };

  const handleExportModel = async (modelId, modelName) => {
    const result = await ipcRenderer.invoke('export-model', modelId);
    if (result.success) {
      alert(`Model "${modelName}" exported successfully!`);
    } else if (!result.canceled) {
      alert(`Export failed: ${result.error}`);
    }
  };

  const handleSelectImage = async () => {
    const filePath = await ipcRenderer.invoke('select-file');
    if (filePath) {
      const savedPath = await ipcRenderer.invoke('save-screenshot', filePath);
      setFormData(f => ({ ...f, screenshotPath: savedPath }));
    }
  };

  const openModal = (model = null) => {
    if (model) {
      setEditingModel(model);
      setFormData({
        name:             model.name,
        marketType:       model.marketType  || model.market_type  || 'Futures',  
        timeframes:       model.timeframes  || [],
        session:          model.session     || 'RTH',
        entryLogic:       model.entryLogic  || '',                               
        narrative:        model.narrative   || '',
        idealCondition:   model.idealCondition   || model.ideal_condition   || '', 
        invalidCondition: model.invalidCondition || model.invalid_condition || '', 
        riskModel:        model.riskModel   || model.risk_model   || 'Fixed R',   
        screenshotPath:   model.screenshotPath   || model.screenshot_path   || '', 
        tags:             model.tags        || [],
        confluenceChecklist: model.confluenceChecklist || [],
        playbookSteps:    model.playbookSteps    || [],
      });
    } else {
      setEditingModel(null);
      setFormData(defaultForm());
    }
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingModel(null); };

  // ── Timeframes ──────────────────────────────────────────────────────────
  const addTimeframe = () => {
    if (formData.timeframes.length >= 3) return;
    setFormData(f => ({ ...f, timeframes: [...f.timeframes, { type: 'Timeframe', value: '' }] }));
  };
  const updateTf = (i, field, val) => {
    const arr = [...formData.timeframes];
    arr[i][field] = val;
    setFormData(f => ({ ...f, timeframes: arr }));
  };
  const removeTf = (i) => setFormData(f => ({ ...f, timeframes: f.timeframes.filter((_, x) => x !== i) }));

  // ── Checklist ───────────────────────────────────────────────────────────
  const addCL   = ()      => setFormData(f => ({ ...f, confluenceChecklist: [...f.confluenceChecklist, ''] }));
  const updateCL = (i, v) => { const a = [...formData.confluenceChecklist]; a[i] = v; setFormData(f => ({ ...f, confluenceChecklist: a })); };
  const removeCL = (i)    => setFormData(f => ({ ...f, confluenceChecklist: f.confluenceChecklist.filter((_, x) => x !== i) }));

  // ── Playbook ────────────────────────────────────────────────────────────
  const addStep    = ()          => setFormData(f => ({ ...f, playbookSteps: [...f.playbookSteps, { title: '', description: '' }] }));
  const updateStep = (i, k, v)   => { const a = [...formData.playbookSteps]; a[i][k] = v; setFormData(f => ({ ...f, playbookSteps: a })); };
  const removeStep = (i)         => setFormData(f => ({ ...f, playbookSteps: f.playbookSteps.filter((_, x) => x !== i) }));

  // ── Tags ────────────────────────────────────────────────────────────────
  const [tagInput, setTagInput] = useState('');
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !formData.tags.includes(t)) setFormData(f => ({ ...f, tags: [...f.tags, t] }));
    setTagInput('');
  };
  const removeTag = (t) => setFormData(f => ({ ...f, tags: f.tags.filter(x => x !== t) }));

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Trading Models</h1>
        <p className="page-subtitle">Build and manage your trading systems</p>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleImportModel}>
            <Icon name="analytics" size={14} style={{ marginRight: 6 }} /> Import Model
          </button>
          <button className="btn btn-primary" onClick={() => openModal()}>
            <Icon name="target" size={14} style={{ marginRight: 6 }} /> Create New Model
          </button>
        </div>
      </div>

      {models.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="models" size={48} color="muted" /></div>
          <h3 className="empty-state-title">No trading models yet</h3>
          <p className="empty-state-description">Create your first trading model to start journaling with discipline</p>
          <button className="btn btn-primary" onClick={() => openModal()}>Create First Model</button>
        </div>
      ) : (
        <div className="models-grid">
          {models.map(model => (
            <ModelCard
              key={model.id}
              model={model}
              onPreview={() => setPreviewModel(model)}
              onEdit={() => openModal(model)}
              onExport={() => handleExportModel(model.id, model.name)}
              onDelete={() => handleDelete(model)}
            />
          ))}
        </div>
      )}

      {/* ── Preview Modal ── */}
      {previewModel && (
        <div className="modal-overlay" onClick={() => setPreviewModel(null)}>
          <div className="modal preview-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{previewModel.name}</h2>
              <button className="btn btn-ghost" onClick={() => setPreviewModel(null)} style={{padding:'6px'}}><Icon name="delete" size={14} color="muted" /></button>
            </div>
            <div className="modal-body">
              {/* Image */}
              {previewModel.screenshot_path && (
                <div className="preview-image-wrap" onClick={() => setZoomImage(previewModel.screenshot_path)}>
                  <img src={`file://${previewModel.screenshot_path}`} alt="Model chart"
                    className="preview-image" />
                  <div className="preview-image-overlay">
                    <Ico src={`${PUB}/eye.png`} size={20} style={{ filter: 'invert(1) brightness(1)' }} />
                    <span>Click to zoom</span>
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="preview-tags" style={{ marginBottom: 20 }}>
                <span className="badge badge-neutral">{previewModel.market_type}</span>
                {previewModel.session && <span className="badge badge-blue">{previewModel.session}</span>}
                {previewModel.risk_model && <span className="badge badge-neutral">{previewModel.risk_model}</span>}
                {/* Timeframes */}
                {(previewModel.timeframes || []).map((tf, i) => (
                  <span key={i} className="badge badge-tf">
                    <span className="tf-val">{tf.value}</span>
                    <span className="tf-type">{tf.type}</span>
                  </span>
                ))}
                {(previewModel.tags || []).map((t, i) => (
                  <span key={i} className="badge badge-neutral">{t}</span>
                ))}
              </div>

              {/* Sections */}
              {previewModel.narrative && <PreviewSection title="Narrative" text={previewModel.narrative} />}
              {previewModel.entryLogic && (
                <PreviewSection title="Entry Logic" text={previewModel.entryLogic} />
              )}
              {previewModel.ideal_condition && <PreviewSection title="Ideal Condition" text={previewModel.ideal_condition} />}
              {previewModel.invalid_condition && <PreviewSection title="Invalid Condition" text={previewModel.invalid_condition} />}

              {/* Checklist */}
              {previewModel.confluenceChecklist?.length > 0 && (
                <div className="preview-section">
                  <div className="preview-section-title">Confluence Checklist</div>
                  {previewModel.confluenceChecklist.map((item, i) => (
                    <div key={i} className="checklist-preview-item">
                      <img src={`${process.env.PUBLIC_URL}/eye.png`} alt="" style={{width:13,height:13,filter:'invert(1) brightness(0.4)',marginRight:2}} /> {item}
                    </div>
                  ))}
                </div>
              )}

              {/* Playbook */}
              {previewModel.playbookSteps?.length > 0 && (
                <div className="preview-section">
                  <div className="preview-section-title">Playbook</div>
                  {previewModel.playbookSteps.map((step, i) => (
                    <div key={i} className="playbook-preview-step">
                      <span className="step-num">Step {i + 1}</span>
                      <strong>{step.title}</strong>
                      {step.description && <p>{step.description}</p>}
                      {step.imagePath && (
                        <img src={`file://${step.imagePath}`} alt="step"
                          onClick={() => setZoomImage(step.imagePath)}
                          style={{ marginTop: 8, width: '100%', maxHeight: 180, objectFit: 'cover',
                            borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'zoom-in' }} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Zoom Image ── */}
      {zoomImage && (
        <div className="zoom-overlay" onClick={() => setZoomImage(null)}>
          <img src={`file://${zoomImage}`} alt="zoom" className="zoom-image" />
          <div className="zoom-hint">Click anywhere to close</div>
        </div>
      )}

      {/* ── Custom Confirm Delete ── */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Model"
        message={`"${confirmDelete?.name}" will be permanently deleted along with all references. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ width: 760 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingModel ? 'Edit Model' : 'Create New Model'}</h2>
              <button className="btn btn-ghost" onClick={closeModal} style={{padding:'6px'}}><Icon name="delete" size={14} color="muted" /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">

              <div className="form-group">
                <label>Model Name *</label>
                <input type="text" value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  required placeholder="e.g., London Open Sweep" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Market Type *</label>
                  <select value={formData.marketType}
                    onChange={e => setFormData(f => ({ ...f, marketType: e.target.value }))}>
                    <option>Futures</option>
                    <option>Forex</option>
                    <option>Crypto</option>
                    <option>Stocks</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Session</label>
                  <select value={formData.session}
                    onChange={e => setFormData(f => ({ ...f, session: e.target.value }))}>
                    <option>RTH</option>
                    <option>ETH</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Risk Model</label>
                  <select value={formData.riskModel}
                    onChange={e => setFormData(f => ({ ...f, riskModel: e.target.value }))}>
                    <option>Fixed R</option>
                    <option>% Risk</option>
                  </select>
                </div>
              </div>

              {/* Chart Configs */}
              <div className="form-group">
                <label>Chart Configurations (max 3)</label>
                {formData.timeframes.map((tf, i) => (
                  <div key={i} className="tf-row">
                    <input type="text" value={tf.value} placeholder="Value e.g. 5, 2500"
                      onChange={e => updateTf(i, 'value', e.target.value)} style={{ flex: 1 }} />
                    <select value={tf.type} onChange={e => updateTf(i, 'type', e.target.value)} style={{ flex: 1 }}>
                      <option>Timeframe</option>
                      <option>Range Bar</option>
                      <option>Tick</option>
                      <option>Volume</option>
                    </select>
                    <button type="button" className="btn btn-danger btn-sm" style={{padding:'4px 8px'}} onClick={() => removeTf(i)}><Icon name="delete" size={12} color="loss" /></button>
                  </div>
                ))}
                {formData.timeframes.length < 3 && (
                  <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={addTimeframe}>
                    + Add Chart Config
                  </button>
                )}
              </div>

              <div className="form-group">
                <label>Entry Logic</label>
                <textarea value={formData.entryLogic}
                  onChange={e => setFormData(f => ({ ...f, entryLogic: e.target.value }))}
                  placeholder="Describe your entry criteria..." rows={3} />
              </div>

              <div className="form-group">
                <label>Narrative</label>
                <textarea value={formData.narrative}
                  onChange={e => setFormData(f => ({ ...f, narrative: e.target.value }))}
                  placeholder="The story behind this model..." rows={2} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ideal Condition</label>
                  <textarea value={formData.idealCondition}
                    onChange={e => setFormData(f => ({ ...f, idealCondition: e.target.value }))}
                    placeholder="When does this work best?" rows={2} />
                </div>
                <div className="form-group">
                  <label>Invalid Condition</label>
                  <textarea value={formData.invalidCondition}
                    onChange={e => setFormData(f => ({ ...f, invalidCondition: e.target.value }))}
                    placeholder="When to avoid?" rows={2} />
                </div>
              </div>

              {/* Chart Image */}
              <div className="form-group">
                <label>Chart Image</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button type="button" className="btn btn-secondary" onClick={handleSelectImage}>
                    <><Icon name="preview" size={14} style={{marginRight:6}} /> Select Image</>
                  </button>
                  {formData.screenshotPath && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                      <Icon name="equity" size={13} style={{marginRight:5}} /> {formData.screenshotPath.split(/[\\/]/).pop()}
                    </span>
                  )}
                </div>
                {formData.screenshotPath && (
                  <img src={`file://${formData.screenshotPath}`} alt="preview"
                    style={{ marginTop: 10, maxHeight: 140, borderRadius: 8, border: '1px solid var(--border-color)', objectFit: 'contain' }} />
                )}
              </div>

              {/* Tags */}
              <div className="form-group">
                <label>Tags</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  {formData.tags.map((t, i) => (
                    <span key={i} className="tag-chip">
                      {t} <button type="button" style={{background:'none',border:'none',cursor:'pointer',padding:'0 2px',display:'inline-flex'}} onClick={() => removeTag(t)}><Icon name="delete" size={11} color="loss" /></button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Type tag and press Enter..." style={{ flex: 1 }} />
                  <button type="button" className="btn btn-secondary" onClick={addTag}>Add</button>
                </div>
              </div>

              {/* Checklist */}
              <div className="form-group">
                <label>Confluence Checklist</label>
                {formData.confluenceChecklist.map((item, i) => (
                  <div key={i} className="tf-row">
                    <input type="text" value={item} style={{ flex: 1 }}
                      onChange={e => updateCL(i, e.target.value)} placeholder="Confluence item..." />
                    <button type="button" className="btn btn-danger btn-sm" style={{padding:'4px 8px'}} onClick={() => removeCL(i)}><Icon name="delete" size={12} color="loss" /></button>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={addCL}>
                  + Add Item
                </button>
              </div>

              {/* Playbook */}
              <div className="form-group">
                <label>Playbook Steps</label>
                {formData.playbookSteps.map((step, i) => (
                  <div key={i} className="playbook-step">
                    <div className="step-number">Step {i + 1}</div>
                    <input type="text" value={step.title} placeholder="Step title..."
                      onChange={e => updateStep(i, 'title', e.target.value)} />
                    <textarea value={step.description} placeholder="Description..." rows={2}
                      onChange={e => updateStep(i, 'description', e.target.value)} />
                    {/* Per-step image */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                      <button type="button" className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          const fp = await ipcRenderer.invoke('select-file');
                          if (fp) {
                            const saved = await ipcRenderer.invoke('save-screenshot', fp);
                            updateStep(i, 'imagePath', saved);
                          }
                        }}>
                        <><Icon name="preview" size={14} style={{marginRight:6}} /> Add Image</>
                      </button>
                      {step.imagePath && (
                        <>
                          <span style={{ fontSize: 12, color: 'var(--profit-color)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Icon name="equity" size={12} color="profit" /> Image attached
                          </span>
                          <button type="button" className="btn btn-ghost btn-sm"
                            style={{ fontSize: 12, color: 'var(--loss-color)' }}
                            onClick={() => updateStep(i, 'imagePath', '')}>
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                    {step.imagePath && (
                      <img src={`file://${step.imagePath}`} alt="step"
                        style={{ marginTop: 8, width: '100%', maxHeight: 150, objectFit: 'cover',
                          borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'zoom-in' }}
                        onClick={() => setZoomImage(step.imagePath)} />
                    )}
                    <button type="button" className="btn btn-danger btn-sm"
                      style={{ marginTop: 8 }}
                      onClick={() => removeStep(i)}>Remove Step</button>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary" onClick={addStep}>+ Add Step</button>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingModel ? 'Update Model' : 'Create Model'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Model Card ─────────────────────────────────────────────────────────── */
function ModelCard({ model, onPreview, onEdit, onExport, onDelete }) {
  return (
    <div className="model-card">
      {model.screenshot_path && (
        <div className="model-card-thumb">
          <img src={`file://${model.screenshot_path}`} alt="chart" />
        </div>
      )}
      <div className="model-header">
        <h3 className="model-name">{model.name}</h3>
        <div className="model-meta">
          <span className="badge badge-neutral">{model.market_type}</span>
          {model.session && <span className="badge badge-blue">{model.session}</span>}
          {model.risk_model && <span className="badge badge-neutral">{model.risk_model}</span>}
          {(model.timeframes || []).map((tf, i) => (
            <span key={i} className="badge badge-tf">
              <span className="tf-val">{tf.value}</span>
              <span className="tf-type">{tf.type}</span>
            </span>
          ))}
          {(model.tags || []).map((t, i) => (
            <span key={i} className="badge badge-neutral">{t}</span>
          ))}
        </div>
      </div>

      {model.narrative && (
        <p className="model-description" style={{ whiteSpace: 'pre-wrap' }}>
          {model.narrative.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'")}
        </p>
      )}

      <div className="model-actions">
        <button className="btn btn-action btn-preview" onClick={onPreview}>
          <img src={`${process.env.PUBLIC_URL}/eye.png`} alt="" className="btn-icon" />
          Preview
        </button>
        <button className="btn btn-action btn-edit" onClick={onEdit}>
          <img src={`${process.env.PUBLIC_URL}/pencil.png`} alt="" className="btn-icon" />
          Edit
        </button>
        <button className="btn btn-action btn-preview" onClick={onExport}>
          <img src={`${process.env.PUBLIC_URL}/rise.png`} alt="" className="btn-icon" />
          Export
        </button>
        <button className="btn btn-action btn-delete" onClick={onDelete}>
          <img src={`${process.env.PUBLIC_URL}/trash-can.png`} alt="" className="btn-icon" />
          Delete
        </button>
      </div>
    </div>
  );
}

function PreviewSection({ title, text }) {
  // Convert literal \n to actual line breaks and remove escaped quotes
  const formatted = text
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");
  
  return (
    <div className="preview-section">
      <div className="preview-section-title">{title}</div>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
        {formatted}
      </p>
    </div>
  );
}

function defaultForm() {
  return {
    name: '', marketType: 'Futures', timeframes: [], session: 'RTH',
    entryLogic: '', narrative: '', idealCondition: '', invalidCondition: '',
    riskModel: 'Fixed R', screenshotPath: '', tags: [],
    confluenceChecklist: [], playbookSteps: [],
  };
}

export default Models;