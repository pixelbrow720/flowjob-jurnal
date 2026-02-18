import React, { useState } from 'react';
import ReactDOM from 'react-dom';

const { ipcRenderer } = window.require('electron');

/* ── helpers ─────────────────────────────────────────────── */
function today() {
  return new Date().toISOString().split('T')[0];
}
function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().split('T')[0];
}
function weekEnd() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 7);
  return d.toISOString().split('T')[0];
}
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// No emojis — use simple text labels
const TABS = [
  { id: 'daily',   label: 'Daily' },
  { id: 'weekly',  label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'custom',  label: 'Custom' },
];

/* ════════════════════════════════════════════════════════════
   PDF EXPORT MODAL
════════════════════════════════════════════════════════════ */
export default function PDFExportModal({ isOpen, onClose }) {
  const [tab,      setTab]      = useState('daily');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);

  const [dailyDate, setDailyDate] = useState(today());
  const [wStart, setWStart] = useState(weekStart());
  const [wEnd,   setWEnd]   = useState(weekEnd());
  const [mYear,  setMYear]  = useState(new Date().getFullYear());
  const [mMonth, setMMonth] = useState(new Date().getMonth() + 1);
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

  const labelStyle = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: 'var(--text-muted)',
    marginBottom: 6,
  };

  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const selectStyle = { ...inputStyle };

  // FIX: Use createPortal to render outside any overflow/stacking context
  // This ensures the overlay always covers the full viewport correctly
  return ReactDOM.createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          zIndex: 9000, // Higher than everything
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9001,
        width: 480, maxWidth: '90vw',
        background: '#0f1117',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        boxShadow: '0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(134,112,255,0.2)',
        overflow: 'hidden',
        animation: 'slideDown 0.18s ease',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(134,112,255,0.15)',
                border: '1px solid rgba(134,112,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {/* Simple SVG document icon instead of emoji */}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="1" width="9" height="12" rx="1.5" stroke="#8670ff" strokeWidth="1.5"/>
                  <path d="M5 5h5M5 7.5h5M5 10h3" stroke="#8670ff" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M11 1v3.5a.5.5 0 00.5.5H14" stroke="#8670ff" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
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
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >×</button>
        </div>

        {/* Tab bar — no emojis */}
        <div style={{
          display: 'flex', gap: 2, padding: '10px 24px 0',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setResult(null); }}
              style={{
                padding: '8px 18px', border: 'none', cursor: 'pointer',
                borderRadius: '8px 8px 0 0',
                background: tab === t.id ? 'rgba(134,112,255,0.15)' : 'transparent',
                color:      tab === t.id ? '#8670ff' : 'var(--text-muted)',
                fontWeight: tab === t.id ? 700 : 500,
                fontSize: 13,
                fontFamily: 'var(--font-display)',
                borderBottom: tab === t.id ? '2px solid #8670ff' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px' }}>

          {tab === 'daily' && (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                Export a report for a single trading day.
              </p>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={dailyDate}
                  onChange={e => setDailyDate(e.target.value)}
                  style={inputStyle} />
              </div>
            </div>
          )}

          {tab === 'weekly' && (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                Export a full weekly performance report.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Week Start</label>
                  <input type="date" value={wStart}
                    onChange={e => setWStart(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Week End</label>
                  <input type="date" value={wEnd}
                    onChange={e => setWEnd(e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          {tab === 'monthly' && (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                Export a monthly summary report.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Year</label>
                  <input type="number" value={mYear} min="2020" max="2030"
                    onChange={e => setMYear(parseInt(e.target.value))} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Month</label>
                  <select value={mMonth} onChange={e => setMMonth(parseInt(e.target.value))} style={selectStyle}>
                    {['January','February','March','April','May','June',
                      'July','August','September','October','November','December'].map((m, i) => (
                      <option key={i+1} value={i+1}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {tab === 'custom' && (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                Export a report for any custom date range.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Start Date</label>
                  <input type="date" value={cStart}
                    onChange={e => setCStart(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>End Date</label>
                  <input type="date" value={cEnd}
                    onChange={e => setCEnd(e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          {/* Result feedback */}
          {result && (
            <div style={{
              marginTop: 16, padding: '12px 16px', borderRadius: 10,
              background: result.success
                ? 'rgba(0,229,160,0.08)'
                : result.canceled
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(255,0,149,0.08)',
              border: `1px solid ${result.success
                ? 'rgba(0,229,160,0.25)'
                : result.canceled
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(255,0,149,0.25)'}`,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                background: result.success ? 'rgba(0,229,160,0.2)' : result.canceled ? 'rgba(255,255,255,0.1)' : 'rgba(255,0,149,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: result.success ? '#00e5a0' : result.canceled ? '#888' : '#ff0095',
                fontWeight: 800,
              }}>
                {result.success ? '✓' : result.canceled ? '↩' : '✕'}
              </div>
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
              // No emoji in button — clean text
              'Export PDF'
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -52%); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </>,
    document.body  // Portal: render at body level, outside any stacking context
  );
}


/* ════════════════════════════════════════════════════════════
   PDF EXPORT BUTTON
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
        {/* Small inline SVG doc icon instead of emoji */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <rect x="2" y="1" width="9" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M5 5h5M5 7.5h5M5 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M11 1v3.5a.5.5 0 00.5.5H14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        {label}
      </button>
      <PDFExportModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}