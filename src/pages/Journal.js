import React, { useState, useEffect, useCallback } from 'react';
import './Journal.css';
import ConfirmDialog from '../components/ConfirmDialog';
import { PDFExportButton } from '../components/PDFExportModal';
import Icon from '../components/Icon';

const { ipcRenderer } = window.require('electron');
const PUB = process.env.PUBLIC_URL;

// ── Instruments ────────────────────────────────────────────────────────────────
const INSTRUMENTS = {
  'E-mini Index': ['ES', 'NQ', 'YM', 'RTY'],
  'Micro E-mini': ['MES', 'MNQ', 'MYM', 'M2K'],
  'FX Futures': ['6E', '6B', '6J', '6A', '6C', '6S', '6N'],
  'Metals': ['GC', 'SI', 'HG', 'PL', 'PA'],
  'Micro Metals': ['MGC', 'MSI'],
  'Energy': ['CL', 'NG', 'QM', 'RB'],
  'Micro Energy': ['MCL'],
  'Grains': ['ZC', 'ZS', 'ZW'],
  'Fixed Income': ['ZB', 'ZN', 'ZF', 'ZT'],
  'Crypto Futures': ['BTC', 'ETH', 'MBT'],
  'Soft Commodities': ['KC', 'SB', 'CC', 'CT'],
};

// Dollar value per 1-point move, per 1 contract
const POINT_VALUES = {
  // Index
  'ES': 50,  'NQ': 20,  'YM': 5,    'RTY': 50,
  // Micro Index
  'MES': 5,  'MNQ': 2,  'MYM': 0.5, 'M2K': 5,
  // FX Futures
  '6E': 12.5, '6B': 6.25, '6J': 12.5, '6A': 10, '6C': 10, '6S': 12.5, '6N': 10,
  // Metals
  'GC': 100, 'SI': 50, 'HG': 25, 'PL': 50, 'PA': 100,
  // Micro Metals
  'MGC': 10, 'MSI': 5,
  // Energy
  'CL': 1000, 'NG': 1000, 'QM': 500, 'RB': 420,
  // Micro Energy
  'MCL': 100,
  // Grains
  'ZC': 50, 'ZS': 50, 'ZW': 50,
  // Fixed Income
  'ZB': 1000, 'ZN': 1000, 'ZF': 1000, 'ZT': 2000,
  // Crypto
  'BTC': 25, 'ETH': 25, 'MBT': 2.5,
  // Soft
  'KC': 375, 'SB': 1120, 'CC': 10, 'CT': 500,
};

const ALL_INSTRUMENTS = Object.values(INSTRUMENTS).flat();

function calcNetPL(pair, slPoints, tpPoints, positionSize, outcome) {
  const pv = POINT_VALUES[pair] || 1;
  const size = parseInt(positionSize) || 1;
  if (outcome === 'win') {
    return parseFloat(((parseFloat(tpPoints) || 0) * pv * size).toFixed(2));
  } else {
    return parseFloat((-(parseFloat(slPoints) || 0) * pv * size).toFixed(2));
  }
}

function calcRMultiple(slPoints, tpPoints, outcome) {
  const sl = parseFloat(slPoints) || 0;
  const tp = parseFloat(tpPoints) || 0;
  if (sl === 0) return null;
  if (outcome === 'win') {
    return parseFloat((tp / sl).toFixed(2));
  }
  return -1;
}

const defaultForm = () => ({
  date: new Date().toISOString().split('T')[0],
  accountId: '',
  modelId: '',
  pair: 'ES',
  direction: 'Long',
  entryPrice: '',
  slPoints: '',
  tpPoints: '',
  positionSize: 1,
  outcome: 'win',
  netPL: '',
  rMultiple: '',
  notes: '',
  emotionalState: '',
  mistakeTag: '',
  ruleViolation: false,
  setupQualityScore: 5,
  disciplineScore: 5,
  tradeGrade: 'B',
  screenshotBefore: '',
  screenshotAfter: '',
});

function Journal() {
  const [trades, setTrades]           = useState([]);
  const [models, setModels]           = useState([]);
  const [accounts, setAccounts]       = useState([]);
  const [showModal, setShowModal]     = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [filters, setFilters]         = useState({ modelId: '', accountId: '', startDate: '', endDate: '' });
  const [formData, setFormData]       = useState(defaultForm());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [previewTrade, setPreviewTrade]   = useState(null);
  const [zoomImage, setZoomImage]         = useState(null);

  useEffect(() => { loadData(); }, [filters]);

  const loadData = async () => {
    const [modelsList, accountsList] = await Promise.all([
      ipcRenderer.invoke('get-models'),
      ipcRenderer.invoke('get-accounts')
    ]);
    setModels(modelsList || []);
    setAccounts(accountsList || []);

    const filterParams = {};
    if (filters.modelId)   filterParams.modelId   = parseInt(filters.modelId);
    if (filters.accountId) filterParams.accountId = parseInt(filters.accountId);
    if (filters.startDate) filterParams.startDate = filters.startDate;
    if (filters.endDate)   filterParams.endDate   = filters.endDate;

    const tradesList = await ipcRenderer.invoke('get-trades', filterParams);
    setTrades(tradesList || []);
  };

  // Auto-recalculate P&L when relevant fields change
  const recalculate = useCallback((data) => {
    if (data.pair && data.slPoints && data.positionSize) {
      const netPL = calcNetPL(data.pair, data.slPoints, data.tpPoints, data.positionSize, data.outcome);
      const rMultiple = calcRMultiple(data.slPoints, data.tpPoints, data.outcome);
      return { ...data, netPL, rMultiple: rMultiple !== null ? rMultiple : '' };
    }
    return data;
  }, []);

  const updateForm = (updates) => {
    const next = { ...formData, ...updates };
    setFormData(recalculate(next));
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.pair) { alert('Please select an instrument.'); return; }
    if (!formData.entryPrice || isNaN(parseFloat(formData.entryPrice))) { alert('Please enter a valid entry price.'); return; }
    if (!formData.slPoints || isNaN(parseFloat(formData.slPoints)) || parseFloat(formData.slPoints) <= 0) { alert('Please enter a valid stop loss (in points).'); return; }

    // Recalculate final P&L to make sure it's set
    const slPts = parseFloat(formData.slPoints) || 0;
    const tpPts = formData.tpPoints ? parseFloat(formData.tpPoints) : 0;
    const size  = parseInt(formData.positionSize) || 1;
    const finalNetPL = formData.netPL !== '' && !isNaN(parseFloat(formData.netPL))
      ? parseFloat(formData.netPL)
      : calcNetPL(formData.pair, slPts, tpPts, size, formData.outcome);
    const finalR = calcRMultiple(slPts, tpPts, formData.outcome);

    const tradeData = {
      date:             formData.date,
      accountId:        formData.accountId  ? parseInt(formData.accountId)  : null,
      modelId:          formData.modelId    ? parseInt(formData.modelId)    : null,
      pair:             formData.pair,
      direction:        formData.direction,
      entryPrice:       parseFloat(formData.entryPrice) || 0,
      slPoints:         slPts,
      tpPoints:         tpPts || null,
      positionSize:     size,
      outcome:          formData.outcome,
      netPL:            finalNetPL,
      rMultiple:        finalR,
      notes:            formData.notes || null,
      emotionalState:   formData.emotionalState || null,
      mistakeTag:       formData.mistakeTag || null,
      ruleViolation:    formData.ruleViolation ? 1 : 0,
      setupQualityScore: parseInt(formData.setupQualityScore) || null,
      disciplineScore:  parseInt(formData.disciplineScore) || null,
      tradeGrade:       formData.tradeGrade || null,
      screenshotBefore: formData.screenshotBefore || null,
      screenshotAfter:  formData.screenshotAfter  || null,
    };

    try {
      if (editingTrade) {
        await ipcRenderer.invoke('update-trade', editingTrade.id, tradeData);
      } else {
        await ipcRenderer.invoke('create-trade', tradeData);
      }
      loadData();
      closeModal();
    } catch (err) {
      console.error('Save trade error:', err);
      alert('Error saving trade: ' + (err.message || 'Unknown error. Check console.'));
    }
  };

  const handleDelete = (trade) => setConfirmDelete(trade);

  const doDelete = async () => {
    if (!confirmDelete) return;
    await ipcRenderer.invoke('delete-trade', confirmDelete.id);
    setConfirmDelete(null);
    loadData();
  };

  const openModal = (trade = null) => {
    if (trade) {
      setEditingTrade(trade);
      const fd = {
        date:               trade.date,
        accountId:          trade.account_id || '',
        modelId:            trade.model_id || '',
        pair:               trade.pair,
        direction:          trade.direction,
        entryPrice:         trade.entry_price,
        slPoints:           trade.sl_points,
        tpPoints:           trade.tp_points || '',
        positionSize:       trade.position_size || 1,
        outcome:            trade.outcome || (trade.net_pl >= 0 ? 'win' : 'loss'),
        netPL:              trade.net_pl,
        rMultiple:          trade.r_multiple || '',
        notes:              trade.notes || '',
        emotionalState:     trade.emotional_state || '',
        mistakeTag:         trade.mistake_tag || '',
        ruleViolation:      trade.rule_violation === 1,
        setupQualityScore:  trade.setup_quality_score || 5,
        disciplineScore:    trade.discipline_score || 5,
        tradeGrade:         trade.trade_grade || 'B',
        screenshotBefore:   trade.screenshot_before || '',
        screenshotAfter:    trade.screenshot_after  || '',
      };
      setFormData(fd);
    } else {
      setEditingTrade(null);
      const fd = defaultForm();
      // Pre-fill first account if available
      if (accounts.length > 0) fd.accountId = accounts[0].id;
      setFormData(fd);
    }
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingTrade(null); };

  const handleSelectScreenshot = async (field) => {
    const filePath = await ipcRenderer.invoke('select-file');
    if (filePath) {
      const saved = await ipcRenderer.invoke('save-screenshot', filePath);
      setFormData(f => ({ ...f, [field]: saved }));
    }
  };

  const pointValue = POINT_VALUES[formData.pair] || 1;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Trade Journal</h1>
        <p className="page-subtitle">Log and review your trades</p>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => openModal()}>+ New Trade</button>
          <button className="btn btn-secondary" onClick={() => ipcRenderer.invoke('export-csv')}>
            <Icon name="analytics" size={14} style={{ marginRight: 6 }} /> Export CSV
          </button>
          <PDFExportButton label="Export PDF" />
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="form-group">
          <label>Account</label>
          <select value={filters.accountId} onChange={e => setFilters({ ...filters, accountId: e.target.value })}>
            <option value="">All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Model</label>
          <select value={filters.modelId} onChange={e => setFilters({ ...filters, modelId: e.target.value })}>
            <option value="">All Models</option>
            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Start Date</label>
          <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
        </div>
        <div className="form-group">
          <label>End Date</label>
          <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
        </div>
        <button className="btn btn-secondary" onClick={() => setFilters({ modelId: '', accountId: '', startDate: '', endDate: '' })}>
          Clear
        </button>
      </div>

      {/* Table */}
      {trades.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="journal" size={48} color="muted" /></div>
          <h3 className="empty-state-title">No trades recorded</h3>
          <p className="empty-state-description">Start journaling your trades to track your progress</p>
          <button className="btn btn-primary" onClick={() => openModal()}>Log First Trade</button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Model</th>
                <th>Instrument</th>
                <th>Dir</th>
                <th>Entry</th>
                <th>SL (pts)</th>
                <th>TP (pts)</th>
                <th>Size</th>
                <th>R</th>
                <th>P/L</th>
                <th>Grade</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trades.map(trade => (
                <tr key={trade.id} style={trade.rule_violation ? {
                  background: 'rgba(255,0,149,0.06)',
                  boxShadow: 'inset 0 0 0 1px rgba(255,0,149,0.2)',
                } : {}}>
                  <td>{new Date(trade.date + 'T00:00:00').toLocaleDateString()}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {trade.account_name || '—'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {trade.model_name || '—'}
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>{trade.pair}</td>
                  <td>
                    <span className={`badge badge-${trade.direction === 'Long' ? 'success' : 'danger'}`}>
                      <Icon name={trade.direction === 'Long' ? 'up' : 'down'} size={12} color={trade.direction === 'Long' ? 'profit' : 'loss'} style={{marginRight:4}} />{trade.direction === 'Long' ? 'L' : 'S'}
                    </span>
                  </td>
                  <td className="mono">{trade.entry_price}</td>
                  <td className="mono loss">{trade.sl_points}</td>
                  <td className="mono">{trade.tp_points || '—'}</td>
                  <td className="mono">{trade.position_size}</td>
                  <td className={`mono ${(trade.r_multiple || 0) >= 0 ? 'profit' : 'loss'}`}>
                    {trade.r_multiple != null ? `${trade.r_multiple > 0 ? '+' : ''}${parseFloat(trade.r_multiple).toFixed(2)}R` : '—'}
                  </td>
                  <td className={`mono ${trade.net_pl >= 0 ? 'profit' : 'loss'}`}>
                    {trade.net_pl >= 0 ? '+' : ''}${parseFloat(trade.net_pl).toFixed(2)}
                  </td>
                  <td>
                    <span className={`badge badge-${getGradeColor(trade.trade_grade)}`}>
                      {trade.trade_grade || '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-action-sm btn-preview-sm" onClick={() => setPreviewTrade(trade)} title="Preview">
                        <img src={`${PUB}/eye.png`} alt="preview" className="btn-icon-sm" />
                      </button>
                      <button className="btn btn-action-sm btn-edit-sm" onClick={() => openModal(trade)} title="Edit">
                        <img src={`${PUB}/pencil.png`} alt="edit" className="btn-icon-sm" />
                      </button>
                      <button className="btn btn-action-sm btn-delete-sm" onClick={() => handleDelete(trade)} title="Delete">
                        <img src={`${PUB}/trash-can.png`} alt="delete" className="btn-icon-sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal journal-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTrade ? 'Edit Trade' : 'New Trade'}</h2>
              <button className="btn btn-ghost" onClick={closeModal} style={{padding:'6px'}}><Icon name="delete" size={14} color="muted" /></button>
            </div>

            <div className="modal-body">
              {/* Row 1: Date, Account, Model */}
              <div className="form-row-3">
                <div className="form-group">
                  <label>Date *</label>
                  <input type="date" value={formData.date} onChange={e => updateForm({ date: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Trading Account</label>
                  <select value={formData.accountId} onChange={e => updateForm({ accountId: e.target.value })}>
                    <option value="">No Account</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Trading Model</label>
                  <select value={formData.modelId} onChange={e => updateForm({ modelId: e.target.value })}>
                    <option value="">No Model</option>
                    {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2: Instrument, Direction */}
              <div className="form-row">
                <div className="form-group">
                  <label>Instrument *</label>
                  <select value={formData.pair} onChange={e => updateForm({ pair: e.target.value })} required>
                    {Object.entries(INSTRUMENTS).map(([group, items]) => (
                      <optgroup key={group} label={group}>
                        {items.map(inst => (
                          <option key={inst} value={inst}>{inst}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Direction *</label>
                  <select value={formData.direction} onChange={e => updateForm({ direction: e.target.value })}>
                    <option>Long</option>
                    <option>Short</option>
                  </select>
                </div>
              </div>

              {/* Point value info */}
              <div className="point-value-info">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="target" size={13} color="muted" /> {formData.pair}
                </span>
                <span>Point Value: <strong className="profit">${pointValue}/pt</strong> per contract</span>
              </div>

              {/* Row 3: Entry, SL (pts), TP (pts) */}
              <div className="form-row-3">
                <div className="form-group">
                  <label>Entry Price *</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.entryPrice}
                    onChange={e => updateForm({ entryPrice: e.target.value })}
                    required
                    placeholder="e.g. 5500"
                  />
                </div>
                <div className="form-group">
                  <label>Stop Loss (points) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.slPoints}
                    onChange={e => updateForm({ slPoints: e.target.value })}
                    required
                    placeholder="e.g. 5"
                  />
                </div>
                <div className="form-group">
                  <label>Take Profit (points)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.tpPoints}
                    onChange={e => updateForm({ tpPoints: e.target.value })}
                    placeholder="e.g. 15"
                  />
                </div>
              </div>

              {/* Row 4: Position Size, Outcome */}
              <div className="form-row">
                <div className="form-group">
                  <label>Position Size (contracts) *</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.positionSize}
                    onChange={e => updateForm({ positionSize: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Outcome *</label>
                  <div className="outcome-toggle">
                    <button
                      type="button"
                      className={`outcome-btn win ${formData.outcome === 'win' ? 'active' : ''}`}
                      onClick={() => updateForm({ outcome: 'win' })}
                    >
                      <Icon name="equity" size={14} style={{ marginRight: 5 }} /> WIN
                    </button>
                    <button
                      type="button"
                      className={`outcome-btn loss ${formData.outcome === 'loss' ? 'active' : ''}`}
                      onClick={() => updateForm({ outcome: 'loss' })}
                    >
                      <Icon name="drawdown" size={14} style={{ marginRight: 5 }} /> LOSS
                    </button>
                  </div>
                </div>
              </div>

              {/* Auto-calculated P&L display */}
              <div className="pnl-display-row">
                <div className="pnl-display-item">
                  <span className="pnl-display-label">R-Multiple</span>
                  <span className={`pnl-display-value ${parseFloat(formData.rMultiple) >= 0 ? 'profit' : 'loss'}`}>
                    {formData.rMultiple !== '' ? `${parseFloat(formData.rMultiple) > 0 ? '+' : ''}${formData.rMultiple}R` : '—'}
                  </span>
                </div>
                <div className="pnl-display-item pnl-main">
                  <span className="pnl-display-label">Net P&L (Auto)</span>
                  <span className={`pnl-display-value ${parseFloat(formData.netPL) >= 0 ? 'profit' : 'loss'}`}>
                    {formData.netPL !== '' ? `${parseFloat(formData.netPL) >= 0 ? '+' : ''}$${Math.abs(parseFloat(formData.netPL) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                  </span>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '11px' }}>Override P&L</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.netPL}
                    onChange={e => setFormData({ ...formData, netPL: e.target.value })}
                    placeholder="Manual override"
                    style={{ fontSize: '13px', padding: '10px 12px' }}
                  />
                </div>
              </div>

              {/* Notes & Psychology */}
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => updateForm({ notes: e.target.value })}
                  placeholder="What happened? What did you learn?"
                  rows={4}
                />
              </div>

              {/* Screenshots */}
              <div className="form-row">
                <div className="form-group">
                  <label>Screenshot Before Entry</label>
                  <button type="button" className="btn btn-secondary" style={{ width: '100%', marginBottom: 8 }}
                    onClick={() => handleSelectScreenshot('screenshotBefore')}>
                    <Icon name="preview" size={14} style={{marginRight:6}} /> Select Image
                  </button>
                  {formData.screenshotBefore && (
                    <img src={`file://${formData.screenshotBefore}`} alt="before"
                      onClick={() => setZoomImage(formData.screenshotBefore)}
                      style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8,
                        border: '1px solid var(--border-color)', cursor: 'zoom-in' }} />
                  )}
                </div>
                <div className="form-group">
                  <label>Screenshot After Exit</label>
                  <button type="button" className="btn btn-secondary" style={{ width: '100%', marginBottom: 8 }}
                    onClick={() => handleSelectScreenshot('screenshotAfter')}>
                    <Icon name="preview" size={14} style={{marginRight:6}} /> Select Image
                  </button>
                  {formData.screenshotAfter && (
                    <img src={`file://${formData.screenshotAfter}`} alt="after"
                      onClick={() => setZoomImage(formData.screenshotAfter)}
                      style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8,
                        border: '1px solid var(--border-color)', cursor: 'zoom-in' }} />
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Emotional State</label>
                  <input
                    type="text"
                    value={formData.emotionalState}
                    onChange={e => updateForm({ emotionalState: e.target.value })}
                    placeholder="e.g. Calm, Anxious, Confident"
                  />
                </div>
                <div className="form-group">
                  <label>Mistake Tag</label>
                  <input
                    type="text"
                    value={formData.mistakeTag}
                    onChange={e => updateForm({ mistakeTag: e.target.value })}
                    placeholder="e.g. FOMO, Revenge Trading"
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label>Setup Quality (1–10)</label>
                  <input
                    type="number"
                    min="1" max="10"
                    value={formData.setupQualityScore}
                    onChange={e => updateForm({ setupQualityScore: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Discipline Score (1–10)</label>
                  <input
                    type="number"
                    min="1" max="10"
                    value={formData.disciplineScore}
                    onChange={e => updateForm({ disciplineScore: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Trade Grade</label>
                  <select value={formData.tradeGrade} onChange={e => updateForm({ tradeGrade: e.target.value })}>
                    <option>A+</option><option>A</option><option>B</option><option>C</option><option>F</option>
                  </select>
                </div>
              </div>

              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="ruleViolation"
                  checked={formData.ruleViolation}
                  onChange={e => updateForm({ ruleViolation: e.target.checked })}
                />
                <label htmlFor="ruleViolation">Rule Violation</label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                  {editingTrade ? 'Update Trade' : 'Save Trade'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Trade Modal ── */}
      {previewTrade && (
        <div className="modal-overlay" onClick={() => setPreviewTrade(null)}>
          <div className="modal" style={{ width: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <span className={`badge ${previewTrade.direction === 'Long' ? 'badge-success' : 'badge-danger'}`} style={{ marginRight: 10 }}>
                  {previewTrade.direction}
                </span>
                {previewTrade.pair}
              </h2>
              <button className="btn btn-ghost" onClick={() => setPreviewTrade(null)} style={{padding:'6px'}}><Icon name="delete" size={14} color="muted" /></button>
            </div>
            <div className="modal-body">
              {/* Screenshots */}
              {(previewTrade.screenshot_before || previewTrade.screenshot_after) && (
                <div className="form-row" style={{ marginBottom: 20 }}>
                  {previewTrade.screenshot_before && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Before Entry</div>
                      <img src={`file://${previewTrade.screenshot_before}`} alt="before"
                        onClick={() => setZoomImage(previewTrade.screenshot_before)}
                        style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'zoom-in', maxHeight: 180, objectFit: 'cover' }} />
                    </div>
                  )}
                  {previewTrade.screenshot_after && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>After Exit</div>
                      <img src={`file://${previewTrade.screenshot_after}`} alt="after"
                        onClick={() => setZoomImage(previewTrade.screenshot_after)}
                        style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'zoom-in', maxHeight: 180, objectFit: 'cover' }} />
                    </div>
                  )}
                </div>
              )}

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'Date',      value: new Date(previewTrade.date + 'T00:00:00').toLocaleDateString() },
                  { label: 'Entry',     value: previewTrade.entry_price },
                  { label: 'SL (pts)',  value: previewTrade.sl_points || previewTrade.stop_loss },
                  { label: 'TP (pts)',  value: previewTrade.tp_points || previewTrade.take_profit || '—' },
                  { label: 'Contracts',value: previewTrade.position_size },
                  { label: 'R-Multiple', value: `${previewTrade.r_multiple?.toFixed(2) || '—'}R` },
                  { label: 'Net P/L',  value: `${previewTrade.net_pl >= 0 ? '+' : ''}$${previewTrade.net_pl?.toFixed(2)}`, colored: true },
                  { label: 'Grade',    value: previewTrade.trade_grade || '—' },
                  { label: 'Emotion',  value: previewTrade.emotional_state || '—' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace',
                      color: s.colored ? (previewTrade.net_pl >= 0 ? 'var(--profit-color)' : 'var(--loss-color)') : 'var(--text-primary)' }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {previewTrade.notes && (
                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Notes</div>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{previewTrade.notes}</p>
                </div>
              )}

              {previewTrade.mistake_tag && (
                <div style={{ marginTop: 12 }}>
                  <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Icon name="delete" size={11} color="loss" /> {previewTrade.mistake_tag}
                  </span>
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

      {/* ── Confirm Delete ── */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Trade"
        message={`Delete ${confirmDelete?.direction} ${confirmDelete?.pair} on ${confirmDelete?.date}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function getGradeColor(grade) {
  if (!grade) return 'neutral';
  if (grade.startsWith('A')) return 'success';
  if (grade === 'B') return 'neutral';
  if (grade === 'C') return 'warning';
  return 'danger';
}

export default Journal;