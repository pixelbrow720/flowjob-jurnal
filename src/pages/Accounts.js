import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import './Analytics.css';

const { ipcRenderer } = window.require('electron');

const PROFIT = '#8670ff';
const LOSS   = '#ff0095';


const PUB = process.env.PUBLIC_URL;

/* ── Icon helper ────────────────────────────────────────────────────────── */
/* ── Custom Tooltip ─────────────────────────────────────────────────────── */
const MoneyTooltip = ({ active, payload, label, negate }) => {
  if (!active || !payload?.length) return null;
  const raw = payload[0].value ?? 0;
  const val = negate ? -Math.abs(raw) : raw;
  const color = val >= 0 ? PROFIT : LOSS;
  return (
    <div style={{
      background: '#111', border: `1px solid ${color}44`,
      borderRadius: 10, padding: '10px 16px', fontSize: 13,
      boxShadow: `0 8px 32px rgba(0,0,0,0.6)`,
      fontFamily: 'Outfit, sans-serif',
    }}>
      <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, fontSize: 17, color }}>
        {val < 0 ? '-' : '+'}${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
};

const CountTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#111', border: '1px solid #2a2a2a',
      borderRadius: 10, padding: '10px 16px', fontSize: 13,
    }}>
      <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#8670ff', fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', fontSize: 16 }}>
        {payload[0].value} trades
      </div>
    </div>
  );
};

/* ── Gradient defs ──────────────────────────────────────────────────────── */
const GradDefs = () => (
  <defs>
    <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stopColor={PROFIT} stopOpacity={0.3} />
      <stop offset="100%" stopColor={PROFIT} stopOpacity={0}   />
    </linearGradient>
    <linearGradient id="gradLoss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stopColor={LOSS} stopOpacity={0.25} />
      <stop offset="100%" stopColor={LOSS} stopOpacity={0}    />
    </linearGradient>
  </defs>
);

/* ── Shared axis / grid props ───────────────────────────────────────────── */
const ax  = { fill: '#555f6e', fontSize: 11, fontFamily: 'JetBrains Mono,monospace' };
const grd = { strokeDasharray: '3 3', stroke: '#1a1a1a' };

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
function Analytics() {
  const [analytics, setAnalytics]               = useState(null);
  const [modelPerformance, setModelPerformance] = useState([]);
  const [trades, setTrades]                     = useState([]);
  const [accounts, setAccounts]                 = useState([]);
  const [filters, setFilters]                   = useState({ accountId: '', startDate: '', endDate: '' });

  useEffect(() => { loadData(); }, [filters]);

  const loadData = async () => {
    const accs = await ipcRenderer.invoke('get-accounts');
    setAccounts(accs || []);

    const fp = {};
    if (filters.accountId) fp.accountId = parseInt(filters.accountId);
    if (filters.startDate) fp.startDate = filters.startDate;
    if (filters.endDate)   fp.endDate   = filters.endDate;

    const [ana, trd, mp] = await Promise.all([
      ipcRenderer.invoke('get-analytics', fp),
      ipcRenderer.invoke('get-trades', fp),
      ipcRenderer.invoke('get-model-performance', fp),
    ]);
    setAnalytics(ana);
    setTrades(trd || []);
    setModelPerformance(mp || []);
  };

  const selAcc = accounts.find(a => a.id === parseInt(filters.accountId));

  if (!analytics) return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Deep dive into your trading performance</p>
      </div>
      <FilterBar accounts={accounts} filters={filters} setFilters={setFilters} />
      <div className="empty-state">
        <div className="empty-state-icon"><Icon name="analytics" size={48} color="muted" /></div>
        <h3 className="empty-state-title">No data to analyze</h3>
        <p className="empty-state-description">
          {filters.accountId ? `No trades for ${selAcc?.name}.` : 'Start logging trades.'}
        </p>
      </div>
    </div>
  );

  const equity   = calcEquityCurve(trades);
  const dd       = calcDrawdown(trades);
  const rDist    = calcRDist(trades);
  const ls       = calcLongShort(trades);
  const monthly  = calcMonthly(trades);
  const dow      = calcDow(trades);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">
          {selAcc ? `Performance — ${selAcc.name}` : 'All Accounts'}
        </p>
      </div>

      <FilterBar accounts={accounts} filters={filters} setFilters={setFilters} />

      {/* ── Core Metrics ── */}
      <div className="analytics-section">
        <h2 className="section-title">Core Performance</h2>
        <div className="content-grid grid-4">
          <MC label="Win Rate"       value={`${analytics.winRate.toFixed(1)}%`}      pos={analytics.winRate >= 50} />
          <MC label="Profit Factor"  value={analytics.profitFactor.toFixed(2)}        pos={analytics.profitFactor >= 1.5} />
          <MC label="Expectancy"     value={`$${analytics.expectancy.toFixed(2)}`}    pos={analytics.expectancy >= 0} />
          <MC label="Avg R"          value={`${analytics.avgRMultiple.toFixed(2)}R`}  pos={analytics.avgRMultiple >= 0} />
          <MC label="Total Trades"   value={analytics.totalTrades}                    neutral />
          <MC label="Total P/L"      value={`${analytics.totalPL >= 0 ? '+' : ''}$${analytics.totalPL.toFixed(2)}`} pos={analytics.totalPL >= 0} />
          <MC label="Best Trade"     value={`+$${analytics.bestTrade.toFixed(2)}`}   pos={true} />
          <MC label="Worst Trade"    value={`-$${Math.abs(analytics.worstTrade).toFixed(2)}`} pos={false} />
        </div>
      </div>

      {/* ── Risk Metrics ── */}
      <div className="analytics-section">
        <h2 className="section-title">Risk Metrics</h2>
        <div className="content-grid grid-4">
          <MC label="Sharpe Ratio"  value={analytics.sharpeRatio.toFixed(2)}  desc="Risk-adjusted return" neutral />
          <MC label="Sortino Ratio" value={analytics.sortinoRatio.toFixed(2)} desc="Downside risk adj."   neutral />
          <MC label="Std Deviation" value={`$${analytics.stdDev.toFixed(2)}`} desc="Trade volatility"     neutral />
          <MC label="Max Drawdown"  value={`-$${analytics.maxDrawdown.toFixed(2)}`} pos={false} />
        </div>
      </div>

      {/* ── Equity + Drawdown ── */}
      <div className="content-grid grid-2">
        <div className="chart-container">
          <div className="chart-title">
            <Icon name="equity" size={15} color="muted" /> Equity Curve
          </div>
          <ResponsiveContainer width="100%" height={270}>
            <AreaChart data={equity} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <GradDefs />
              <CartesianGrid {...grd} />
              <XAxis dataKey="date" tick={ax} tickLine={false} axisLine={false} />
              <YAxis tick={ax} tickLine={false} axisLine={false}
                tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
              <Tooltip content={<MoneyTooltip />} cursor={{ stroke: '#2a2a2a', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="equity" stroke={PROFIT} strokeWidth={2.5}
                fill="url(#gradProfit)" dot={false}
                activeDot={{ r: 5, fill: PROFIT, stroke: '#000', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">
            <Icon name="drawdown" size={15} color="muted" /> Drawdown
          </div>
          <ResponsiveContainer width="100%" height={270}>
            <AreaChart data={dd} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <GradDefs />
              <CartesianGrid {...grd} />
              <XAxis dataKey="date" tick={ax} tickLine={false} axisLine={false} />
              <YAxis tick={ax} tickLine={false} axisLine={false}
                tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(Math.abs(v)/1000).toFixed(1)}k` : Math.abs(v)}`} />
              <Tooltip content={<MoneyTooltip negate />} cursor={{ stroke: '#2a2a2a', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="drawdown" stroke={LOSS} strokeWidth={2}
                fill="url(#gradLoss)" dot={false}
                activeDot={{ r: 5, fill: LOSS, stroke: '#000', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── R-Distribution + Long vs Short ── */}
      <div className="content-grid grid-2">
        <div className="chart-container">
          <div className="chart-title">
            <Icon name="dashboard" size={15} color="muted" /> R-Multiple Distribution
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={rDist} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="32%">
              <CartesianGrid {...grd} />
              <XAxis dataKey="range" tick={ax} tickLine={false} axisLine={false} />
              <YAxis tick={ax} tickLine={false} axisLine={false} allowDecimals={false}
                tickFormatter={v => v === 0 ? '' : v} />
              <Tooltip content={<CountTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {rDist.map((entry, i) => (
                  <Cell key={i}
                    fill={entry.isPositive ? PROFIT : LOSS}
                    fillOpacity={entry.count === 0 ? 0.15 : 0.9}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">
            <Icon name="risk" size={15} color="muted" /> Long vs Short P&L
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250, gap: 32 }}>
            <ResponsiveContainer width="55%" height={220}>
              <PieChart>
                <GradDefs />
                <Pie data={ls} cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  paddingAngle={5} dataKey="value" stroke="none">
                  <Cell fill={PROFIT} fillOpacity={0.9} />
                  <Cell fill={LOSS}   fillOpacity={0.9} />
                </Pie>
                <Tooltip formatter={v => [`$${v.toFixed(2)}`, '']}
                  contentStyle={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, fontSize: 13 }}
                  itemStyle={{ color: '#e8edf3' }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {ls.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? PROFIT : LOSS, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, color: '#555f6e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{e.name}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', color: i === 0 ? PROFIT : LOSS }}>
                      ${e.value.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Model Performance ── */}
      {modelPerformance.length > 0 && (
        <div className="analytics-section">
          <h2 className="section-title">Model Performance Comparison</h2>
          
          {/* Visual Comparison Charts */}
          <div className="content-grid grid-3" style={{ marginBottom: 24 }}>
            {/* Win Rate Comparison */}
            <div className="chart-container">
              <div className="chart-title" style={{ fontSize: 14 }}>Win Rate by Model</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={modelPerformance} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid {...grd} />
                  <XAxis dataKey="name" tick={ax} tickLine={false} axisLine={false} />
                  <YAxis tick={ax} tickLine={false} axisLine={false} domain={[0, 100]}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const v = payload[0].value;
                    return (
                      <div style={{
                        background: '#111', border: `1px solid ${v >= 50 ? '#8670ff44' : '#ff009544'}`,
                        borderRadius: 10, padding: '10px 16px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                      }}>
                        <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>{payload[0].payload.name}</div>
                        <div style={{
                          fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, fontSize: 16,
                          color: v >= 50 ? PROFIT : LOSS
                        }}>
                          {v.toFixed(1)}%
                        </div>
                      </div>
                    );
                  }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="winRate" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {modelPerformance.map((m, i) => (
                      <Cell key={i} fill={m.winRate >= 50 ? PROFIT : LOSS} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Profit Factor Comparison */}
            <div className="chart-container">
              <div className="chart-title" style={{ fontSize: 14 }}>Profit Factor by Model</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={modelPerformance} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid {...grd} />
                  <XAxis dataKey="name" tick={ax} tickLine={false} axisLine={false} />
                  <YAxis tick={ax} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const v = payload[0].value;
                    return (
                      <div style={{
                        background: '#111', border: `1px solid ${v >= 1.5 ? '#8670ff44' : '#ff009544'}`,
                        borderRadius: 10, padding: '10px 16px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                      }}>
                        <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>{payload[0].payload.name}</div>
                        <div style={{
                          fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, fontSize: 16,
                          color: v >= 1.5 ? PROFIT : LOSS
                        }}>
                          {v.toFixed(2)}
                        </div>
                      </div>
                    );
                  }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="profitFactor" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {modelPerformance.map((m, i) => (
                      <Cell key={i} fill={m.profitFactor >= 1.5 ? PROFIT : LOSS} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Avg R-Multiple Comparison */}
            <div className="chart-container">
              <div className="chart-title" style={{ fontSize: 14 }}>Avg R-Multiple by Model</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={modelPerformance} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid {...grd} />
                  <XAxis dataKey="name" tick={ax} tickLine={false} axisLine={false} />
                  <YAxis tick={ax} tickLine={false} axisLine={false}
                    tickFormatter={v => `${v}R`} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const v = payload[0].value;
                    return (
                      <div style={{
                        background: '#111', border: `1px solid ${v >= 0 ? '#8670ff44' : '#ff009544'}`,
                        borderRadius: 10, padding: '10px 16px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                      }}>
                        <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>{payload[0].payload.name}</div>
                        <div style={{
                          fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, fontSize: 16,
                          color: v >= 0 ? PROFIT : LOSS
                        }}>
                          {v != null ? `${v.toFixed(2)}R` : '—'}
                        </div>
                      </div>
                    );
                  }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="avg_r" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {modelPerformance.map((m, i) => (
                      <Cell key={i} fill={(m.avg_r || 0) >= 0 ? PROFIT : LOSS} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Model</th><th>Trades</th><th>Win Rate</th>
                  <th>Avg R</th><th>Profit Factor</th><th>Total P/L</th>
                </tr>
              </thead>
              <tbody>
                {modelPerformance.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                    <td className="mono">{m.total_trades}</td>
                    <td className={`mono ${m.winRate >= 50 ? 'profit' : 'loss'}`}>{m.winRate.toFixed(1)}%</td>
                    <td className="mono">{m.avg_r != null ? `${parseFloat(m.avg_r).toFixed(2)}R` : '—'}</td>
                    <td className="mono">{m.profitFactor.toFixed(2)}</td>
                    <td className={`mono ${m.total_pl >= 0 ? 'profit' : 'loss'}`}>
                      {m.total_pl >= 0 ? '+' : ''}${m.total_pl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Monthly + Day of Week ── */}
      <div className="content-grid grid-2">
        <div className="chart-container">
          <div className="chart-title">
            <Icon name="calendar" size={15} color="muted" /> Monthly Performance
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="35%">
              <CartesianGrid {...grd} />
              <XAxis dataKey="month" tick={ax} tickLine={false} axisLine={false} />
              <YAxis tick={ax} tickLine={false} axisLine={false}
                tickFormatter={v => `${v < 0 ? '-' : ''}$${Math.abs(v) >= 1000 ? `${(Math.abs(v)/1000).toFixed(1)}k` : Math.abs(v)}`} />
              <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="pl" radius={[6, 6, 0, 0]} maxBarSize={52}>
                {monthly.map((e, i) => (
                  <Cell key={i} fill={e.pl >= 0 ? PROFIT : LOSS} fillOpacity={0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <div className="chart-title">
            <Icon name="calendar" size={15} color="muted" /> Day of Week (Avg P&L)
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dow} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="35%">
              <CartesianGrid {...grd} />
              <XAxis dataKey="day" tick={ax} tickLine={false} axisLine={false} />
              <YAxis tick={ax} tickLine={false} axisLine={false}
                tickFormatter={v => `${v < 0 ? '-' : ''}$${Math.abs(v)}`} />
              <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="pl" radius={[6, 6, 0, 0]} maxBarSize={52}>
                {dow.map((e, i) => (
                  <Cell key={i} fill={e.pl >= 0 ? PROFIT : LOSS} fillOpacity={0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */
function FilterBar({ accounts, filters, setFilters }) {
  return (
    <div className="filter-bar">
      <div className="form-group" style={{ margin: 0 }}>
        <label>Account</label>
        <select value={filters.accountId}
          onChange={e => setFilters({ ...filters, accountId: e.target.value })}
          style={{ minWidth: 180 }}>
          <option value="">All Accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label>Start Date</label>
        <input type="date" value={filters.startDate}
          onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label>End Date</label>
        <input type="date" value={filters.endDate}
          onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
      </div>
      <button className="btn btn-secondary"
        onClick={() => setFilters({ accountId: '', startDate: '', endDate: '' })}>
        Clear
      </button>
    </div>
  );
}

function MC({ label, value, pos, neutral, desc }) {
  const cls = neutral ? '' : pos ? 'profit' : 'loss';
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${cls}`}>{value}</div>
      {desc && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{desc}</div>}
    </div>
  );
}

/* ── Data helpers ───────────────────────────────────────────────────────── */
function calcEquityCurve(trades) {
  let c = 0;
  return [...trades].sort((a, b) => new Date(a.date) - new Date(b.date)).map(t => {
    c += t.net_pl;
    return { date: fmt(t.date), equity: parseFloat(c.toFixed(2)) };
  });
}

function calcDrawdown(trades) {
  let c = 0, peak = 0;
  return [...trades].sort((a, b) => new Date(a.date) - new Date(b.date)).map(t => {
    c += t.net_pl;
    if (c > peak) peak = c;
    return { date: fmt(t.date), drawdown: parseFloat((-(peak - c)).toFixed(2)) };
  });
}

function calcRDist(trades) {
  const buckets = [
    { range: '< -2R',     min: -Infinity, max: -2,       isPositive: false, count: 0 },
    { range: '-2 to -1R', min: -2,        max: -1,       isPositive: false, count: 0 },
    { range: '-1 to 0R',  min: -1,        max: 0,        isPositive: false, count: 0 },
    { range: '0 to 1R',   min: 0,         max: 1,        isPositive: true,  count: 0 },
    { range: '1 to 2R',   min: 1,         max: 2,        isPositive: true,  count: 0 },
    { range: '> 2R',      min: 2,         max: Infinity, isPositive: true,  count: 0 },
  ];
  trades.forEach(t => {
    const r = t.r_multiple ?? 0;
    buckets.forEach(b => { if (r > b.min && r <= b.max) b.count++; });
  });
  return buckets;
}

function calcLongShort(trades) {
  const lg = trades.filter(t => t.direction === 'Long').reduce((s, t) => s + t.net_pl, 0);
  const sh = trades.filter(t => t.direction === 'Short').reduce((s, t) => s + t.net_pl, 0);
  return [
    { name: 'Long',  value: parseFloat(Math.abs(lg).toFixed(2)) },
    { name: 'Short', value: parseFloat(Math.abs(sh).toFixed(2)) },
  ];
}

function calcMonthly(trades) {
  const m = {};
  trades.forEach(t => {
    const k = new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    m[k] = (m[k] || 0) + t.net_pl;
  });
  return Object.entries(m).map(([month, pl]) => ({ month, pl: parseFloat(pl.toFixed(2)) }));
}

function calcDow(trades) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const data = days.map(d => ({ day: d, pl: 0, count: 0 }));
  trades.forEach(t => {
    const i = new Date(t.date + 'T00:00:00').getDay();
    data[i].pl += t.net_pl; data[i].count++;
  });
  return data.map(d => ({ day: d.day, pl: d.count > 0 ? parseFloat((d.pl / d.count).toFixed(2)) : 0 }));
}

function fmt(date) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default Analytics;