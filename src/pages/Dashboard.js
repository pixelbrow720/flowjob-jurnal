import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const { ipcRenderer } = window.require('electron');

const PROFIT = '#8670ff';
const LOSS   = '#ff0095';
const ax     = { fill: '#555f6e', fontSize: 11, fontFamily: 'JetBrains Mono,monospace' };
const grd    = { strokeDasharray: '3 3', stroke: '#1a1a1a' };

const PnLTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div style={{
      background: '#111', border: `1px solid ${val >= 0 ? '#8670ff44' : '#ff009544'}`,
      borderRadius: 10, padding: '10px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      fontFamily: 'Outfit,sans-serif',
    }}>
      <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{
        fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, fontSize: 16,
        color: val >= 0 ? PROFIT : LOSS
      }}>
        {val >= 0 ? '+' : ''}${val.toFixed(2)}
      </div>
    </div>
  );
};

function Dashboard() {
  const [stats, setStats]               = useState(null);
  const [recentTrades, setRecentTrades] = useState([]);
  const [equityCurve, setEquityCurve]   = useState([]);
  const [modelPerf, setModelPerf]       = useState([]);
  const [accounts, setAccounts]         = useState([]);
  const [selectedAccId, setSelectedAccId] = useState(''); // '' = all accounts

  useEffect(() => { loadData(); }, [selectedAccId]);

  const loadData = async () => {
    try {
      const accs = await ipcRenderer.invoke('get-accounts');
      setAccounts(accs || []);

      const filters = {};
      if (selectedAccId) filters.accountId = parseInt(selectedAccId);

      const [analyticsData, trades, mp] = await Promise.all([
        ipcRenderer.invoke('get-analytics', filters),
        ipcRenderer.invoke('get-trades', filters),
        ipcRenderer.invoke('get-model-performance', filters),
      ]);

      setStats(analyticsData);
      setRecentTrades((trades || []).slice(0, 6));
      setModelPerf(mp || []);

      // FIX: Equity curve starts from initial_balance, not $0
      const selectedAcc = selectedAccId
        ? (accs || []).find(a => a.id === parseInt(selectedAccId))
        : null;

      // Starting balance: if single account selected use its initial_balance,
      // otherwise sum all accounts' initial_balances
      const startingBalance = selectedAcc
        ? (selectedAcc.initial_balance || 25000)
        : (accs || []).reduce((sum, a) => sum + (a.initial_balance || 25000), 0);

      let cum = startingBalance;
      const sortedTrades = [...(trades || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

      // Group per hari dulu — satu titik per tanggal
      const byDay = {};
      sortedTrades.forEach(t => {
        if (!byDay[t.date]) byDay[t.date] = 0;
        byDay[t.date] += t.net_pl;
      });

      const curve = Object.entries(byDay).map(([date, dayPL]) => {
        cum += dayPL;
        return {
          date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          equity: parseFloat(cum.toFixed(2)),
        };
      });

      if (curve.length > 0) {
        curve.unshift({ date: 'Start', equity: startingBalance });
      }

      setEquityCurve(curve);
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  };

  const selectedAcc = accounts.find(a => a.id === parseInt(selectedAccId));

  if (!stats) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome to Flowjob Journal</p>

          {/* Account selector tetap muncul walau no data */}
          {accounts.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Viewing:</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSelectedAccId('')}
                  style={{
                    padding: '6px 16px', borderRadius: 8, fontFamily: 'var(--font-display)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: selectedAccId === '' ? '#8670ff' : 'var(--bg-tertiary)',
                    border: `1px solid ${selectedAccId === '' ? '#8670ff' : 'var(--border-color)'}`,
                    color: selectedAccId === '' ? '#000' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  All Accounts
                </button>
                {accounts.map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => setSelectedAccId(String(acc.id))}
                    style={{
                      padding: '6px 16px', borderRadius: 8, fontFamily: 'var(--font-display)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      background: selectedAccId === String(acc.id) ? '#8670ff' : 'var(--bg-tertiary)',
                      border: `1px solid ${selectedAccId === String(acc.id) ? '#8670ff' : 'var(--border-color)'}`,
                      color: selectedAccId === String(acc.id) ? '#000' : 'var(--text-secondary)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {acc.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>
            <img src={`${process.env.PUBLIC_URL}/graph-bar.png`} alt=""
              style={{ width: 56, filter: 'invert(1) brightness(0.4)' }} />
          </div>
          <h3 className="empty-state-title">No trading data yet</h3>
          <p className="empty-state-description">
            {selectedAccId
              ? 'No trades logged for this account yet.'
              : 'Create models and log trades to see your dashboard'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Your trading performance at a glance</p>

        {/* Account Filter Dropdown — NEW */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Viewing:</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setSelectedAccId('')}
              style={{
                padding: '6px 16px', borderRadius: 8, fontFamily: 'var(--font-display)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: selectedAccId === '' ? '#8670ff' : 'var(--bg-tertiary)',
                border: `1px solid ${selectedAccId === '' ? '#8670ff' : 'var(--border-color)'}`,
                color: selectedAccId === '' ? '#000' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              All Accounts
            </button>
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => setSelectedAccId(String(acc.id))}
                style={{
                  padding: '6px 16px', borderRadius: 8, fontFamily: 'var(--font-display)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: selectedAccId === String(acc.id) ? '#8670ff' : 'var(--bg-tertiary)',
                  border: `1px solid ${selectedAccId === String(acc.id) ? '#8670ff' : 'var(--border-color)'}`,
                  color: selectedAccId === String(acc.id) ? '#000' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                {acc.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="content-grid grid-4" style={{ marginBottom: 28 }}>
        {[
          { label: 'Total Trades',  value: stats.totalTrades,               color: 'var(--text-primary)' },
          { label: 'Win Rate',      value: `${stats.winRate.toFixed(1)}%`,   color: stats.winRate >= 50 ? PROFIT : LOSS },
          { label: 'Net P/L',       value: `${stats.totalPL >= 0 ? '+' : ''}$${stats.totalPL.toFixed(2)}`, color: stats.totalPL >= 0 ? PROFIT : LOSS },
          { label: 'Expectancy',    value: `${stats.expectancy >= 0 ? '+' : ''}$${stats.expectancy.toFixed(2)}`, color: stats.expectancy >= 0 ? PROFIT : LOSS },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Account Balances */}
      {accounts.length > 0 && (
        <div className="chart-container" style={{ marginBottom: 28 }}>
          <div className="chart-title">Account Balances</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {(selectedAcc ? [selectedAcc] : accounts).map(acc => {
              const pnl = acc.current_balance - acc.initial_balance;
              return (
                <div key={acc.id} style={{
                  flex: '1 1 160px',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                  borderRadius: 10, padding: '14px 18px',
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{acc.name}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: pnl >= 0 ? PROFIT : LOSS }}>
                    ${(acc.current_balance || acc.initial_balance || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 12, color: pnl >= 0 ? PROFIT : LOSS, marginTop: 4 }}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} from ${acc.initial_balance?.toLocaleString() || 25000}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="content-grid grid-2" style={{ marginBottom: 28 }}>
        {/* Equity Curve — starts from initial_balance */}
        <div className="chart-container">
          <div className="chart-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Equity Curve</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Start: ${(selectedAcc?.initial_balance || accounts.reduce((s,a) => s+(a.initial_balance||25000),0)).toLocaleString()}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={equityCurve} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PROFIT} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={PROFIT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...grd} />
              <XAxis dataKey="date" tick={ax} tickLine={false} axisLine={false} />
              <YAxis tick={ax} tickLine={false} axisLine={false}
                tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
              <Tooltip content={<PnLTooltip />} cursor={{ stroke: '#2a2a2a', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="equity" stroke={PROFIT} strokeWidth={2.5}
                fill="url(#eqGrad)" dot={false}
                activeDot={{ r: 5, fill: PROFIT, stroke: '#000', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Model Performance */}
        <div className="chart-container">
          <div className="chart-title">Model Performance</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={modelPerf} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="32%">
              <CartesianGrid {...grd} />
              <XAxis dataKey="name" tick={ax} tickLine={false} axisLine={false} />
              <YAxis tick={ax} tickLine={false} axisLine={false}
                tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
              <Tooltip content={<PnLTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="total_pl" radius={[6, 6, 0, 0]} maxBarSize={52}>
                {modelPerf.map((m, i) => (
                  <Cell key={i} fill={m.total_pl >= 0 ? PROFIT : LOSS} fillOpacity={0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Trades */}
      <div className="chart-container">
        <div className="chart-title">Recent Trades</div>
        {recentTrades.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, padding: '12px 0' }}>No trades yet.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Account</th><th>Model</th><th>Pair</th>
                  <th>Dir</th><th>R</th><th>P/L</th><th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map(trade => (
                  <tr key={trade.id}>
                    <td>{new Date(trade.date + 'T00:00:00').toLocaleDateString()}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{trade.account_name || '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{trade.model_name || '—'}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{trade.pair}</td>
                    <td><span className={`badge badge-${trade.direction === 'Long' ? 'success' : 'danger'}`}>{trade.direction}</span></td>
                    <td className="mono" style={{ color: (trade.r_multiple || 0) >= 0 ? PROFIT : LOSS }}>
                      {trade.r_multiple != null ? `${trade.r_multiple > 0 ? '+' : ''}${trade.r_multiple.toFixed(2)}R` : '—'}
                    </td>
                    <td className="mono" style={{ color: trade.net_pl >= 0 ? PROFIT : LOSS, fontWeight: 700 }}>
                      {trade.net_pl >= 0 ? '+' : ''}${trade.net_pl.toFixed(2)}
                    </td>
                    <td><span className="badge badge-neutral">{trade.trade_grade || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;