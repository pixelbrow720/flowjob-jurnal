import React, { useState } from 'react';

const { ipcRenderer } = window.require('electron');

/* ── helpers ─────────────────────────────────────────────── */
function today() {
  return new Date().toISOString().split('T')[0];
}
function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1); // Mon
  return d.toISOString().split('T')[0];
}
function weekEnd() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 7); // Sun
  return d.toISOString().split('T')[0];
}
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function monthEnd() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
}

const TABS = [
  { id: 'daily',   label: 'Daily',   icon: '📅' },
  { id: 'weekly',  label: 'Weekly',  icon: '📆' },
  { id: 'monthly', label: 'Monthly', icon: '🗓️' },
  { id: 'custom',  label: 'Custom',  icon: '✏️' },
];

/* ════════════════════════════════════════════════════════════
   PDF EXPORT MODAL
   Usage:
     import PDFExportModal from '../components/PDFExportModal';
     <PDFExportModal isOpen={showPDF} onClose={() => setShowPDF(false)} />
════════════════════════════════════════════════════════════ */
export default function PDFExportModal({ isOpen, onClose }) {
  const [tab,      setTab]      = useState('daily');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null); // {success, path, error}

  /* daily */
  const [dailyDate, setDailyDate] = useState(today());

  /* weekly */
  const [wStart, setWStart] = useState(weekStart());
  const [wEnd,   setWEnd]   = useState(weekEnd());

  /* monthly */
  const [mYear,  setMYear]  = useState(new Date().getFullYear());
  const [mMonth, setMMonth] = useState(new Date().getMonth() + 1);

  /* custom */
  const [cStart, setCStart] = useState(monthStart());
  const [cEnd,   setCEnd]   = useState(today());

  if (!isOpen) return null;

  const handleExport = async () => {
    setLoading(true);
    setResult(null);
    let res;
    try {
      if (tab === 'daily') {
        res = await ipcRenderer.invoke('export-pdf-daily', dailyDate);
      } else if (tab === 'weekly') {
        res = await ipcRenderer.invoke('export-pdf-weekly', wStart, wEnd);
      } else if (tab === 'monthly') {
        res = await ipcRenderer.invoke('export-pdf-monthly', mYear, mMonth);
      } else {
        res = await ipcRenderer.invoke('export-pdf-custom', cStart, cEnd);
      }
      setResult(res || { success: false, error: 'No response from main process' });
    } catch (e) {
      setResult({ success: false, error: e.message });
    }
    setLoading(false);
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 901,
        width: 480, maxWidth: '90vw',
        background: 'var(--bg-card)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(134,112,255,0.15)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(134,112,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16,
              }}>📄</div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                Export PDF Report
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 42px', fontSize: 12, color: 'var(--text-muted)' }}>
              Generate a performance report for any time period
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'rgba(255,255,255,0.05)', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 4, padding: '12px 24px 0',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setResult(null); }}
              style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer',
                borderRadius: '8px 8px 0 0',
                background:  tab === t.id ? 'rgba(134,112,255,0.15)' : 'transparent',
                color:       tab === t.id ? '#8670ff' : 'var(--text-muted)',
                fontWeight:  tab === t.id ? 700 : 500,
                fontSize: 13,
                borderBottom: tab === t.id ? '2px solid #8670ff' : '2px solid transparent',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px' }}>

          {/* ─── Daily ─── */}
          {tab === 'daily' && (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                Export a report for a single trading day.
              </p>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={dailyDate}
                  onChange={e => setDailyDate(e.target.value)}
                  max={today()}
                />
              </div>
            </div>
          )}

          {/* ─── Weekly ─── */}
          {tab === 'weekly' && (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                Export a report for a specific week range.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" value={wStart} onChange={e => setWStart(e.target.value)} max={today()} />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input type="date" value={wEnd} onChange={e => setWEnd(e.target.value)} min={wStart} max={today()} />
                </div>
              </div>
            </div>
          )}

          {/* ─── Monthly ─── */}
          {tab === 'monthly' && (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                Export a full month report.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Year</label>
                  <input
                    type="number"
                    value={mYear}
                    min={2000}
                    max={new Date().getFullYear()}
                    onChange={e => setMYear(parseInt(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>Month</label>
                  <select value={mMonth} onChange={e => setMMonth(parseInt(e.target.value))}>
                    {['January','February','March','April','May','June',
                      'July','August','September','October','November','December']
                      .map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(134,112,255,0.08)', border: '1px solid rgba(134,112,255,0.15)',
                fontSize: 12, color: '#8670ff',
              }}>
                📋 Will include all trades from {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mMonth-1]} {mYear}
              </div>
            </div>
          )}

          {/* ─── Custom ─── */}
          {tab === 'custom' && (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                Choose any custom date range.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" value={cStart} onChange={e => setCStart(e.target.value)} max={today()} />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input type="date" value={cEnd} onChange={e => setCEnd(e.target.value)} min={cStart} max={today()} />
                </div>
              </div>
            </div>
          )}

          {/* ─── Result banner ─── */}
          {result && (
            <div style={{
              marginTop: 16, padding: '12px 16px', borderRadius: 10,
              background: result.success
                ? 'rgba(0,229,160,0.08)'
                : 'rgba(255,0,149,0.08)',
              border: `1px solid ${result.success ? 'rgba(0,229,160,0.25)' : 'rgba(255,0,149,0.25)'}`,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>
                {result.success ? '✅' : result.canceled ? '↩️' : '❌'}
              </span>
              <div>
                {result.success ? (
                  <>
                    <div style={{ fontWeight: 700, color: '#00e5a0', fontSize: 13, marginBottom: 3 }}>
                      PDF exported successfully!
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                      Saved to: {result.path}
                    </div>
                  </>
                ) : result.canceled ? (
                  <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 13 }}>
                    Export canceled
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: 700, color: '#ff0095', fontSize: 13, marginBottom: 3 }}>
                      Export failed
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {result.error}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0 24px 20px',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button className="btn btn-ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={loading}
            style={{ minWidth: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite', display: 'inline-block',
                }} />
                Generating...
              </>
            ) : (
              <>📄 Export PDF</>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}


/* ════════════════════════════════════════════════════════════
   PDF EXPORT BUTTON — drop this anywhere you want a trigger

   Usage (e.g. inside DailyJournal, Analytics, Settings):
     import PDFExportButton from '../components/PDFExportModal';
     <PDFExportButton />
════════════════════════════════════════════════════════════ */
export function PDFExportButton({ label = 'Export PDF', style = {} }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="btn btn-secondary"
        onClick={() => setOpen(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }}
      >
        📄 {label}
      </button>
      <PDFExportModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}