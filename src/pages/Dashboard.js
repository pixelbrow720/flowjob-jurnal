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
  const [stats, setStats]             = useState(null);
  const [recentTrades, setRecentTrades] = useState([]);
  const [equityCurve, setEquityCurve]   = useState([]);
  const [modelPerf, setModelPerf]       = useState([]);
  const [accounts, setAccounts]         = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [analyticsData, trades, mp, accs] = await Promise.all([
        ipcRenderer.invoke('get-analytics', {}),
        ipcRenderer.invoke('get-trades', {}),
        ipcRenderer.invoke('get-model-performance', {}),
        ipcRenderer.invoke('get-accounts'),
      ]);

      setStats(analyticsData);
      setRecentTrades((trades || []).slice(0, 6));
      setModelPerf(mp || []);
      setAccounts(accs || []);

      let cum = 0;
      const curve = [...(trades || [])]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map(t => {
          cum += t.net_pl;
          return {
            date: new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            equity: parseFloat(cum.toFixed(2))
          };
        });
      setEquityCurve(curve);
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  };

  if (!stats) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome to Flowjob Journal</p>
        </div>
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>
            <img src={`${process.env.PUBLIC_URL}/graph-bar.png`} alt=""
              style={{ width: 56, filter: 'invert(1) brightness(0.4)' }} />
          </div>
          <h3 className="empty-state-title">No trading data yet</h3>
          <p className="empty-state-description">Create models and log trades to see your dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Your trading performance at a glance</p>
      </div>

      {/* Stats Grid */}
      <div className="content-grid grid-4" style={{ marginBottom: 28 }}>
        {[
          { label: 'Total Trades',  value: stats.totalTrades,               color: 'var(--text-primary)' },
          { label: 'Win Rate',      value: `${stats.winRate.toFixed(1)}%`,   color: stats.winRate >= 50 ? PROFIT : LOSS },
          { label: 'Total P/L',     value: `${stats.totalPL >= 0 ? '+' : ''}$${stats.totalPL.toFixed(2)}`, color: stats.totalPL >= 0 ? PROFIT : LOSS },
          { label: 'Profit Factor', value: stats.profitFactor.toFixed(2),    color: stats.profitFactor >= 1.5 ? PROFIT : LOSS },
          { label: 'Avg R',         value: `${stats.avgRMultiple.toFixed(2)}R`, color: stats.avgRMultiple >= 0 ? PROFIT : LOSS },
          { label: 'Sharpe Ratio',  value: stats.sharpeRatio.toFixed(2),     color: 'var(--text-primary)' },
          { label: 'Max Drawdown',  value: `-$${stats.maxDrawdown.toFixed(2)}`, color: LOSS },
          { label: 'Expectancy',    value: `$${stats.expectancy.toFixed(2)}`, color: stats.expectancy >= 0 ? PROFIT : LOSS },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color, fontSize: 26 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Accounts Row */}
      {accounts.length > 0 && (
        <div className="content-grid" style={{
          gridTemplateColumns: `repeat(${Math.min(accounts.length, 4)}, 1fr)`,
          marginBottom: 28
        }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{
              background: 'linear-gradient(135deg, rgba(134,112,255,0.08), rgba(255,0,149,0.04))',
              border: '1px solid rgba(134,112,255,0.2)',
              borderRadius: 12, padding: '16px 20px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
                letterSpacing: '0.5px', marginBottom: 6 }}>
                {acc.name} · {acc.type}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800,
                fontFamily: 'JetBrains Mono,monospace',
                color: (acc.current_balance || acc.starting_balance || 0) >= (acc.starting_balance || 0) ? PROFIT : LOSS }}>
                ${(acc.current_balance || acc.starting_balance || 0).toFixed(2)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Start: ${(acc.starting_balance || 0).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="content-grid grid-2" style={{ marginBottom: 28 }}>
        {/* Equity Curve */}
        <div className="chart-container">
          <div className="chart-title">Equity Curve</div>
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
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No trades yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentTrades.map(trade => (
              <div key={trade.id} style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr auto',
                gap: 16, alignItems: 'center',
                background: trade.rule_violation
                  ? 'rgba(255,0,149,0.07)'
                  : 'var(--bg-tertiary)',
                border: `1px solid ${trade.rule_violation
                  ? 'rgba(255,0,149,0.25)'
                  : trade.net_pl >= 0
                    ? 'rgba(134,112,255,0.15)'
                    : 'rgba(255,0,149,0.15)'}`,
                borderRadius: 10, padding: '12px 16px',
                transition: 'all 0.15s',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 13,
                  background: trade.direction === 'Long'
                    ? 'rgba(134,112,255,0.15)' : 'rgba(255,0,149,0.12)',
                  color: trade.direction === 'Long' ? PROFIT : LOSS,
                  border: `1px solid ${trade.direction === 'Long'
                    ? 'rgba(134,112,255,0.3)' : 'rgba(255,0,149,0.3)'}`,
                }}>
                  {trade.direction === 'Long' ? '↑' : '↓'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{trade.pair}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(trade.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' · '}{trade.model_name || 'No Model'}
                    {trade.rule_violation ? <span style={{ color: LOSS, marginLeft: 8, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="delete" size={11} color="loss" /> Rule Violation</span> : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 18, fontWeight: 800,
                    fontFamily: 'JetBrains Mono,monospace',
                    color: trade.net_pl >= 0 ? PROFIT : LOSS,
                  }}>
                    {trade.net_pl >= 0 ? '+' : ''}${trade.net_pl.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)',
                    fontFamily: 'JetBrains Mono,monospace' }}>
                    {trade.r_multiple != null ? `${trade.r_multiple.toFixed(2)}R` : '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;