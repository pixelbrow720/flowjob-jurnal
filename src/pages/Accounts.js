import React, { useState, useEffect } from 'react';
import './Accounts.css';
import ConfirmDialog from '../components/ConfirmDialog';
import Icon from '../components/Icon';

const { ipcRenderer } = window.require('electron');

function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    initialBalance: 25000,
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const data = await ipcRenderer.invoke('get-accounts');
    setAccounts(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await ipcRenderer.invoke('create-account', {
      name: formData.name,
      type: 'custom',
      initialBalance: parseFloat(formData.initialBalance) || 25000,
      description: formData.description
    });
    loadAccounts();
    closeModal();
  };

  const handleDelete = (account) => {
    if (account.type === 'forward' || account.type === 'backtest') {
      alert('Cannot delete default accounts.');
      return;
    }
    setConfirmDelete(account);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    await ipcRenderer.invoke('delete-account', confirmDelete.id);
    setConfirmDelete(null);
    loadAccounts();
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({ name: '', description: '', initialBalance: 25000 });
  };

  const getAccountBadgeClass = (type) => {
    if (type === 'forward') return 'badge-success';
    if (type === 'backtest') return 'badge-blue';
    return 'badge-warning';
  };

  const getAccountTypeLabel = (type) => {
    if (type === 'forward') return 'Forward Test';
    if (type === 'backtest') return 'Backtest';
    return 'Custom';
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Trading Accounts</h1>
        <p className="page-subtitle">Manage and track your trading accounts</p>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New Account
          </button>
        </div>
      </div>

      <div className="accounts-grid">
        {accounts.map(account => {
          const pnl = (account.current_balance || account.initial_balance) - account.initial_balance;
          const pnlPct = ((pnl / account.initial_balance) * 100);
          const progressPct = Math.min(Math.abs(pnlPct), 100);

          return (
            <div key={account.id} className={`account-card account-${account.type}`}>
              <div className="account-header">
                <div>
                  <span className={`badge ${getAccountBadgeClass(account.type)}`}>
                    {getAccountTypeLabel(account.type)}
                  </span>
                  <h3 className="account-name">{account.name}</h3>
                  {account.description && (
                    <p className="account-description">{account.description}</p>
                  )}
                </div>
                {account.type === 'custom' && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '8px' }}
                    onClick={() => handleDelete(account)}
                  >
                    <Icon name="delete" size={16} color="loss" />
                  </button>
                )}
              </div>

              <div className="account-balance">
                <div className="balance-current">
                  ${(account.current_balance != null ? account.current_balance : account.initial_balance)
                    .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="balance-label">Current Balance</div>
              </div>

              <div className="account-stats">
                <div className="account-stat">
                  <span className="account-stat-label">Initial</span>
                  <span className="account-stat-value">
                    ${account.initial_balance.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="account-stat">
                  <span className="account-stat-label">P&L</span>
                  <span className={`account-stat-value ${pnl >= 0 ? 'profit' : 'loss'}`}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                  </span>
                </div>
                <div className="account-stat">
                  <span className="account-stat-label">Return</span>
                  <span className={`account-stat-value ${pnlPct >= 0 ? 'profit' : 'loss'}`}>
                    {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="account-progress">
                <div className="progress-label">
                  <span>Initial: ${account.initial_balance.toLocaleString()}</span>
                  <span className={pnl >= 0 ? 'profit' : 'loss'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <img src={`${process.env.PUBLIC_URL}/${pnl >= 0 ? 'rise.png' : 'trend.png'}`} alt=""
                      style={{ width: 12, height: 12, filter: pnl >= 0 ? 'invert(58%) sepia(60%) saturate(500%) hue-rotate(210deg)' : 'invert(30%) sepia(100%) saturate(1000%) hue-rotate(300deg)' }} />
                    {Math.abs(pnlPct).toFixed(2)}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${pnl >= 0 ? 'positive' : 'negative'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Account Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal account-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Trading Account</h2>
              <button className="btn btn-ghost" onClick={closeModal} style={{padding:'6px'}}>
                <Icon name="delete" size={14} color="muted" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label>Account Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Live Account, Prop Firm"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Initial Balance ($)</label>
                <input
                  type="number"
                  value={formData.initialBalance}
                  onChange={e => setFormData({ ...formData, initialBalance: e.target.value })}
                  min="0"
                  step="500"
                />
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Notes about this account..."
                  rows={3}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Account"
        message={`Delete "${confirmDelete?.name}"? All associated trades will remain but be unlinked. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

export default Accounts;