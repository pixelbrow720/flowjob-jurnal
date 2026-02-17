import React from 'react';
import Icon from './Icon';

function ConfirmDialog({ isOpen, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={onCancel}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: `1px solid ${danger ? 'rgba(255,0,149,0.3)' : 'var(--border-bright)'}`,
          borderRadius: 14, padding: '28px 32px', width: 400, maxWidth: '90vw',
          boxShadow: `0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px ${danger ? 'rgba(255,0,149,0.1)' : 'transparent'}`,
          animation: 'slideDown 0.2s ease',
        }}
      >
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: danger ? 'rgba(255,0,149,0.12)' : 'rgba(134,112,255,0.12)',
          border: `1px solid ${danger ? 'rgba(255,0,149,0.3)' : 'rgba(134,112,255,0.3)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
        }}>
          <Icon name={danger ? 'delete' : 'help'} size={22} color={danger ? 'loss' : 'profit'} />
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', color: 'var(--text-primary)', marginBottom: 10 }}>
          {title}
        </h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: 28 }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 8,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--border-bright)'; e.target.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.color = 'var(--text-secondary)'; }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 8,
              background: danger ? 'var(--loss-color)' : 'var(--accent-primary)',
              border: 'none', color: danger ? '#fff' : '#000',
              fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s',
              boxShadow: danger ? '0 4px 20px rgba(255,0,149,0.3)' : '0 4px 20px rgba(134,112,255,0.3)',
            }}
            onMouseEnter={e => { e.target.style.filter = 'brightness(1.15)'; }}
            onMouseLeave={e => { e.target.style.filter = 'brightness(1)'; }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;