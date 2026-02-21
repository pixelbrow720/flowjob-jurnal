import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import ConfirmDialog from '../components/ConfirmDialog'; // A1 FIX
import './Accounts.css';

const { ipcRenderer } = window.require('electron');
const PROFIT = '#8670ff';
const LOSS   = '#ff0095';

function Accounts() {
  const [accounts, setAccounts]         = useState([]);
  const [trades, setTrades]             = useState([]);
  const [showModal, setShowModal]       = useState(false);
  const [editingAcc, setEditingAcc]     = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // A1 FIX
  const [form, setForm]                 = useState({
    name: '', type: 'custom', initialBalance: 25000, currency: 'USD', description: ''
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [accs, trd] = await Promise.all([
      ipcRenderer.invoke('get-accounts'),
      ipcRenderer.invoke('get-trades', {}),
    ]);
    setAccounts(accs || []);
    setTrades(trd || []);
  };

  const openModal = (acc = null) => {
    if (acc) {
      setEditingAcc(acc);
      setForm({
        name:           acc.name,
        type:           acc.type,
        initialBalance: acc.initial_balance,
        currency:       acc.currency || 'USD',
        description:    acc.description || '',
      });
    } else {
      setEditingAcc(null);
      setForm({ name: '', type: 'custom', initialBalance: 25000, currency: 'USD', description: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { alert('Account name is required.'); return; }
    if (editingAcc) {
      await ipcRenderer.invoke('update-account', editingAcc.id, form);
    } else {
      await ipcRenderer.invoke('create-account', form);
    }
    loadData();
    setShowModal(false);
  };

  // A1 FIX — pakai ConfirmDialog, bukan window.confirm
  const handleDelete = (acc) => setConfirmDelete(acc);

  const doDelete = async () => {
    if (!confirmDelete) return;
    const result = await ipcRenderer.invoke('delete-account', confirmDelete.id);
    setConfirmDelete(null);
    if (result?.error) {
      alert(result.error);
    } else {
      loadData();
    }
  };

  // Per-account stats dihitung dari trades
  const statsFor = (accId) => {
    const t = trades.filter(x => x.account_id === accId);
    if (!t.length) return null;
    const wins = t.filter(x => x.net_pl > 0);
    const pl   = t.reduce((s, x) => s + x.net_pl, 0);
    return {
      trades:  t.length,
      winRate: wins.length / t.length * 100,
      pl,
    };
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Accounts</h1>
        <p className="page-subtitle">Manage your trading accounts</p>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => openModal()}>
            + New Account
          </button>
        </div>
      </div>

      {/* Account Cards */}
      <div className="accounts-grid">
        {accounts.map(acc => {
          const stats    = statsFor(acc.id);
          const pl       = stats?.pl ?? 0;
          const initial  = acc.initial_balance ?? 0;

          // A2 FIX — recompute current balance dari initial + sum trades
          // supaya tidak drift dari current_balance di DB
          const current   = initial + pl;
          const growthPct = initial > 0 ? ((current - initial) / initial) * 100 : 0;
          const fillPct   = initial > 0 ? Math.min(Math.abs(growthPct) / 20 * 100, 100) : 0;

          return (
            <div key={acc.id} className={`account-card account-${acc.type}`}>
              {/* Header */}
              <div className="account-header">
                <div>
                  <span className={`badge badge-${acc.type === 'forward' ? 'success' : acc.type === 'backtest' ? 'blue' : 'neutral'}`}>
                    {acc.type}
                  </span>
                  <h3 className="account-name">{acc.name}</h3>
                </div>
                {acc.type === 'custom' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => openModal(acc)}>
                      <Icon name="edit" size={14} color="muted" />
                    </button>
                    <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => handleDelete(acc)}>
                      <Icon name="delete" size={14} color="loss" />
                    </button>
                  </div>
                )}
              </div>

              {/* Balance */}
              <div className="account-balance">
                <div className={`balance-current ${pl >= 0 ? 'profit' : 'loss'}`}>
                  ${current.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="balance-label">Current Balance · {acc.currency || 'USD'}</div>
              </div>

              {/* Stats */}
              <div className="account-stats">
                <div className="account-stat">
                  <span className="account-stat-label">Starting</span>
                  <span className="account-stat-value">${initial.toLocaleString()}</span>
                </div>
                <div className="account-stat">
                  <span className="account-stat-label">Trades</span>
                  <span className="account-stat-value">{stats?.trades ?? 0}</span>
                </div>
                <div className="account-stat">
                  <span className="account-stat-label">Win Rate</span>
                  <span className="account-stat-value" style={{ color: (stats?.winRate ?? 0) >= 50 ? PROFIT : LOSS }}>
                    {stats ? `${stats.winRate.toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>

              {/* P&L row */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0', borderTop: '1px solid var(--border-color)', marginTop: 4,
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total P&L</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 18, color: pl >= 0 ? PROFIT : LOSS }}>
                  {pl >= 0 ? '+' : ''}${pl.toFixed(2)}
                </span>
              </div>

              {/* Growth progress bar */}
              <div className="account-progress">
                <div className="progress-label">
                  <span>Growth</span>
                  <span style={{ color: growthPct >= 0 ? PROFIT : LOSS }}>
                    {growthPct >= 0 ? '+' : ''}{growthPct.toFixed(2)}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${growthPct >= 0 ? 'positive' : 'negative'}`}
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              </div>

              {acc.description && (
                <p className="account-description">{acc.description}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal account-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingAcc ? 'Edit Account' : 'New Account'}</h2>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ padding: '6px' }}>
                <Icon name="delete" size={14} color="muted" />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-group">
                <label>Account Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Apex Funded Account"
                />
              </div>

              {!editingAcc && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Account Type</label>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                      <option value="custom">Custom</option>
                      <option value="forward">Forward Test</option>
                      <option value="backtest">Backtest</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Currency</label>
                    <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                      <option>USD</option>
                      <option>EUR</option>
                      <option>GBP</option>
                    </select>
                  </div>
                </div>
              )}

              {!editingAcc && (
                <div className="form-group">
                  <label>Starting Balance</label>
                  <input
                    type="number"
                    value={form.initialBalance}
                    onChange={e => setForm(f => ({ ...f, initialBalance: parseFloat(e.target.value) || 0 }))}
                  />
                  <div className="balance-display" style={{ marginTop: 10 }}>
                    ${parseFloat(form.initialBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional notes about this account..."
                  rows={3}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSubmit}>
                  {editingAcc ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* A1 FIX — ConfirmDialog menggantikan window.confirm */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Account"
        message={`"${confirmDelete?.name}" akan dihapus permanen. Semua trade di akun ini tetap tersimpan tapi tidak terasosiasi ke akun manapun. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

export default Accounts;