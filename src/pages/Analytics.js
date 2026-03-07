import React, { useState, useEffect, useMemo } from 'react';
import Icon from '../components/Icon';
import './Analytics.css';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ComposedChart,
} from 'recharts';

const { ipcRenderer } = window.require('electron');

/* ─────────────────────────────────────────────
   COLORS
───────────────────────────────────────────── */
const C = {
  profit : '#8670ff',
  loss   : '#ff0095',
  warn   : '#ffaa00',
  blue   : '#00c2ff',
  green  : '#00e5a0',
};

/* ─────────────────────────────────────────────
   RECHARTS SHARED PROPS
───────────────────────────────────────────── */
const TICK   = { fill: '#555f6e', fontSize: 10, fontFamily: 'JetBrains Mono,monospace' };
const GRID_P = { strokeDasharray: '3 3', stroke: '#181820', strokeOpacity: 1 };
const MAR    = { top: 8, right: 12, left: 4, bottom: 4 };

/* ─────────────────────────────────────────────
   SVG GRADIENT DEFS
───────────────────────────────────────────── */
const SvgDefs = () => (
  <defs>
    {[['gProfit',C.profit,0.4],['gLoss',C.loss,0.35],['gBlue',C.blue,0.3],['gWarn',C.warn,0.3],['gGreen',C.green,0.3]]
      .map(([id,col,op]) => (
        <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={col} stopOpacity={op} />
          <stop offset="100%" stopColor={col} stopOpacity={0}  />
        </linearGradient>
      ))}
  </defs>
);

/* ─────────────────────────────────────────────
   FORMATTERS
───────────────────────────────────────────── */
const fmtMoney = v => v == null ? '—' : `${v < 0 ? '-' : '+'}$${Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtPct   = v => v == null ? '—' : `${v.toFixed(1)}%`;
const fmtR     = v => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
const fmtK     = v => Math.abs(v) >= 1000 ? `${v<0?'-':''}$${(Math.abs(v)/1000).toFixed(1)}k` : `${v<0?'-':''}$${Math.abs(v).toFixed(0)}`;

/* ─────────────────────────────────────────────
   CUSTOM TOOLTIP
───────────────────────────────────────────── */
const Tip = ({ active, payload, label, fmt = fmtMoney, color }) => {
  if (!active || !payload?.length) return null;
  const v   = payload[0]?.value;
  const col = color || (v >= 0 ? C.profit : C.loss);
  return (
    <div style={{
      background:'#060610', border:`1px solid ${col}40`,
      borderRadius:10, padding:'10px 16px',
      boxShadow:`0 16px 48px rgba(0,0,0,0.9),0 0 0 1px ${col}18`,
    }}>
      <div style={{color:'#4a5568',fontSize:10,letterSpacing:'0.4px',marginBottom:5}}>{label}</div>
      <div style={{fontFamily:'JetBrains Mono,monospace',fontWeight:800,fontSize:16,color:col}}>
        {fmt(v)}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   UI BUILDING BLOCKS
───────────────────────────────────────────── */
const AChart = ({ title, dot, children, h = 250 }) => (
  <div className="a-chart">
    <div className="a-chart-title">
      {dot && <span style={{width:6,height:6,borderRadius:'50%',background:dot,display:'inline-block',flexShrink:0}} />}
      {title}
    </div>
    <div style={{height:h}}>{children}</div>
  </div>
);

const AStat = ({ label, value, col='col-base', sub, subCol, desc, pct, pctCol }) => (
  <div className="a-stat">
    <div className="a-stat-label">{label}</div>
    <div className={`a-stat-value ${col}`}>{value}</div>
    {sub  && <div className={`a-stat-sub ${subCol||col}`}>{sub}</div>}
    {desc && <div className="a-stat-desc">{desc}</div>}
    {pct != null && (
      <div className="a-progress">
        <div className="a-progress-fill" style={{
          width:`${Math.min(Math.max(pct,0),100)}%`,
          background: pctCol || C.profit,
          boxShadow:`0 0 6px ${pctCol||C.profit}66`,
        }} />
      </div>
    )}
  </div>
);

const ASection = ({ title, sub }) => (
  <div className="a-section-head">
    <h3 className="a-section-title">{title}</h3>
    {sub && <p className="a-section-sub">{sub}</p>}
  </div>
);

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function Analytics() {
  const [accounts, setAccounts] = useState([]);
  const [trades,   setTrades]   = useState([]);
  const [models,   setModels]   = useState([]);
  const [filters,  setFilters]  = useState({ accountId:'', startDate:'', endDate:'' });
  const [loading,  setLoading]  = useState(true);

  // ── Monte Carlo state ──
  const [mcConfig,  setMcConfig]  = useState({ numSims: 1000, numTrades: 100 });
  const [mcRunning, setMcRunning] = useState(false);
  const [mcResult,  setMcResult]  = useState(null);

  useEffect(() => { load(); }, [filters]); // eslint-disable-line

  const load = async () => {
    setLoading(true);
    const accs = await ipcRenderer.invoke('get-accounts');
    setAccounts(accs || []);

    const fp = {};
    if (filters.accountId) fp.accountId = parseInt(filters.accountId);
    if (filters.startDate)  fp.startDate  = filters.startDate;
    if (filters.endDate)    fp.endDate    = filters.endDate;

    const [trd, mp] = await Promise.all([
      ipcRenderer.invoke('get-trades', fp),
      ipcRenderer.invoke('get-model-performance', fp).catch(() => []),
    ]);
    setTrades(trd || []);
    setModels(mp  || []);
    setLoading(false);
  };

  /* computed */
  const S = useMemo(() => calcStats(trades), [trades]);

  const startingBalance = useMemo(() => {
    if (!accounts.length) return 0;
    if (filters.accountId) {
      const acc = accounts.find(a => a.id === parseInt(filters.accountId));
      return acc ? (acc.initial_balance || 25000) : 0;
    }
    return accounts.reduce((sum, a) => sum + (a.initial_balance || 25000), 0);
  }, [accounts, filters.accountId]);

  const equity    = useMemo(() => buildEquity(trades, startingBalance),    [trades, startingBalance]);
  const dd        = useMemo(() => buildDrawdown(trades, startingBalance),  [trades, startingBalance]);
  const monthly   = useMemo(() => buildMonthly(trades),     [trades]);
  const dow       = useMemo(() => buildDow(trades),         [trades]);
  const rDist     = useMemo(() => buildRDist(trades),       [trades]);
  const pairs     = useMemo(() => buildPairs(trades),       [trades]);
  const rollingWR = useMemo(() => buildRollingWR(trades,10),[trades]);
  const rollingEx = useMemo(() => buildRollingEx(trades,10),[trades]);
  const heatmap   = useMemo(() => buildHeatmap(trades,90),  [trades]);
  const grades    = useMemo(() => buildGrades(trades),      [trades]);
  const streaks   = useMemo(() => buildStreaks(trades),     [trades]);
  const ls        = useMemo(() => buildLS(trades),          [trades]);
  const mperf     = useMemo(() => enrichModels(models),     [models]);
  const scoreData = useMemo(() => buildScore(S),            [S]);
  const sorted    = useMemo(() => [...trades].sort((a,b) => new Date(a.date)-new Date(b.date)), [trades]);
  const dayHourData = useMemo(() => buildDayHourHeatmap(trades), [trades]);
  const selAcc    = accounts.find(a => a.id === parseInt(filters.accountId));
  const violations = useMemo(() => buildViolations(trades), [trades]);

  // ── Monte Carlo: re-run when trades / config / startingBalance changes ──
  useEffect(() => {
    if (trades.length < 5) { setMcResult(null); return; }
    setMcRunning(true);
    const t = setTimeout(() => {
      try {
        const result = runMonteCarlo(trades, startingBalance, mcConfig.numSims, mcConfig.numTrades);
        setMcResult(result);
      } catch(e) {
        setMcResult(null);
      }
      setMcRunning(false);
    }, 60);
    return () => clearTimeout(t);
  }, [trades, startingBalance, mcConfig]); // eslint-disable-line

  if (!loading && !trades.length) return (
    <div className="fade-in analytics-wrap">
      <Hero selAcc={selAcc} />
      <FilterBar accounts={accounts} filters={filters} setFilters={setFilters} />
      <div className="a-empty">
        <Icon name="analytics" size={52} color="muted" />
        <h3>No trades to analyze</h3>
        <p>{filters.accountId ? `No trades for ${selAcc?.name}.` : 'Start logging trades to unlock deep analytics.'}</p>
      </div>
    </div>
  );

  return (
    <div className="fade-in analytics-wrap">
      <Hero selAcc={selAcc} S={S} />
      <FilterBar accounts={accounts} filters={filters} setFilters={setFilters} />

      {/* ══ 1. PERFORMANCE OVERVIEW ══ */}
      <div className="a-section">
        <ASection title="Performance Overview" sub="Core metrics — the full picture in one row" />
        <div className="a-stat-grid a-stat-grid-4">
          <AStat label="Total Trades"   value={S.n}                                                          col="col-base"   desc={`${S.wins}W · ${S.losses}L · ${S.be} breakeven`} />
          <AStat label="Win Rate"       value={fmtPct(S.wr)}                                                 col={S.wr>=50?'col-profit':'col-loss'} sub={`${S.wins} of ${S.n}`} pct={S.wr} pctCol={S.wr>=50?C.profit:C.loss} />
          <AStat label="Net P/L"        value={fmtMoney(S.pl)}                                               col={S.pl>=0?'col-profit':'col-loss'} desc="Total after all fees" />
          <AStat label="Profit Factor"  value={S.pf>=999?'∞':S.pf.toFixed(2)}                               col={S.pf>=1.5?'col-profit':S.pf>=1?'col-warn':'col-loss'} desc="Gross wins ÷ gross losses" pct={Math.min(S.pf/3*100,100)} />
          <AStat label="Expectancy"     value={fmtMoney(S.exp)}                                              col={S.exp>=0?'col-profit':'col-loss'} desc="(WR×AvgWin) − (LR×AvgLoss)" />
          <AStat label="Avg R-Multiple" value={fmtR(S.avgR)}                                                 col={S.avgR>=0?'col-profit':'col-loss'} desc="Mean risk-reward realized" />
          <AStat label="Avg Win"        value={`+$${S.avgWin.toFixed(2)}`}                                   col="col-profit" sub={`Best: $${S.best.toFixed(2)}`} />
          <AStat label="Avg Loss"       value={`-$${S.avgLoss.toFixed(2)}`}                                  col="col-loss"   sub={`Worst: -$${Math.abs(S.worst).toFixed(2)}`} />
        </div>
      </div>

      {/* ══ 2. RISK METRICS ══ */}
      <div className="a-section">
        <ASection title="Risk & Volatility" sub="Statistical risk metrics — understand your edge consistency" />
        <div className="a-stat-grid a-stat-grid-4">
          <AStat label="Max Drawdown"  value={`-$${S.maxDD.toFixed(2)}`}                                     col="col-loss"   desc="Largest peak-to-trough in equity" />
          <AStat label="Sharpe Ratio"  value={S.sharpe.toFixed(2)}                                            col={S.sharpe>=1?'col-profit':S.sharpe>=0?'col-warn':'col-loss'} desc="(AvgReturn/StdDev)×√252" />
          <AStat label="Sortino Ratio" value={S.sortino.toFixed(2)}                                           col={S.sortino>=1?'col-profit':S.sortino>=0?'col-warn':'col-loss'} desc="Sharpe adjusted for downside vol" />
          <AStat label="Calmar Ratio"  value={S.calmar>=999?'∞':S.calmar.toFixed(2)}                         col={S.calmar>=1?'col-profit':S.calmar>=0?'col-warn':'col-loss'} desc="Net P/L ÷ Max drawdown" />
          <AStat label="Payoff Ratio"  value={S.avgLoss>0?(S.avgWin/S.avgLoss).toFixed(2):'∞'}               col={S.avgWin>=S.avgLoss?'col-profit':'col-warn'} desc="Avg win ÷ avg loss" />
          <AStat label="Std Dev"       value={`$${S.std.toFixed(2)}`}                                         col="col-base"   desc="Trade P/L standard deviation" />
          <AStat label="Best Streak"   value={`${streaks.bestWin}W`}                                          col="col-profit" desc={`Avg win streak: ${streaks.avgWin.toFixed(1)}`} />
          <AStat label="Worst Streak"  value={`${streaks.worstLoss}L`}                                        col="col-loss"   desc={`Avg loss streak: ${streaks.avgLoss.toFixed(1)}`} />
        </div>
      </div>

      {/* ══ 3. PERFORMANCE SCORE ══ */}
      <div className="a-section">
        <ASection title="Performance Score" sub="Your edge, scored 0–100 across 6 dimensions" />
        <div className="a-grid-2">
          <AChart title="Radar Score" dot={C.profit} h={280}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={scoreData} margin={{top:20,right:40,bottom:20,left:40}}>
                <PolarGrid stroke="#1e1e2e" />
                <PolarAngleAxis dataKey="m" tick={{...TICK,fontSize:11,fill:'#6a7a8a'}} />
                <Radar dataKey="s" stroke={C.profit} strokeWidth={2} fill={C.profit} fillOpacity={0.15}
                  dot={{fill:C.profit,strokeWidth:0,r:4}} />
                <Tooltip formatter={v=>[`${v}/100`,'']}
                  contentStyle={{background:'#060610',border:`1px solid ${C.profit}40`,borderRadius:10,fontSize:12}}
                  itemStyle={{color:C.profit}} />
              </RadarChart>
            </ResponsiveContainer>
          </AChart>

          <AChart title="Score Breakdown" dot={C.blue} h={280}>
            <div style={{padding:'16px 0'}}>
              <div className="score-rings">
                {scoreData.map((d,i) => {
                  const col = d.s>=70?C.profit:d.s>=40?C.warn:C.loss;
                  return (
                    <div key={i} className="score-ring-row">
                      <div className="score-ring-label">{d.m}</div>
                      <div className="score-ring-bar">
                        <div className="score-ring-fill" style={{width:`${d.s}%`,background:col,boxShadow:`0 0 8px ${col}66`}} />
                      </div>
                      <div className="score-ring-val" style={{color:col}}>{d.s}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </AChart>
        </div>
      </div>

      {/* ══ 4. EQUITY CURVE ══ */}
      <div className="a-section">
        <ASection title="Equity Curve & Drawdown" />
        <div style={{marginBottom:16}}>
          <AChart title="Cumulative P/L — Equity Curve" dot={C.profit} h={280}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={equity} margin={MAR}>
                <SvgDefs />
                <CartesianGrid {...GRID_P} />
                <XAxis dataKey="l" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={fmtK} />
                <Tooltip content={<Tip fmt={fmtK} />} cursor={{stroke:'#2a2a3a',strokeWidth:1}} />
                <ReferenceLine y={startingBalance > 0 ? startingBalance : 0} stroke="#2a2a3a" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="eq" stroke="none" fill="url(#gProfit)" fillOpacity={1} dot={false} activeDot={false} />
                <Line type="monotone" dataKey="eq" stroke={C.profit} strokeWidth={2.5}
                  dot={false} activeDot={{r:4,fill:C.profit,stroke:'#000',strokeWidth:2}} />
              </ComposedChart>
            </ResponsiveContainer>
          </AChart>
        </div>
        <AChart title="Drawdown" dot={C.loss} h={160}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dd} margin={MAR}>
              <SvgDefs />
              <CartesianGrid {...GRID_P} />
              <XAxis dataKey="l" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={fmtK} />
              <Tooltip content={<Tip fmt={fmtK} color={C.loss} />} cursor={{stroke:'#2a2a3a',strokeWidth:1}} />
              <ReferenceLine y={0} stroke="#2a2a3a" />
              <Area type="monotone" dataKey="dd" stroke="none" fill="url(#gLoss)" fillOpacity={1} dot={false} activeDot={false} />
              <Line type="monotone" dataKey="dd" stroke={C.loss} strokeWidth={2}
                dot={false} activeDot={{r:4,fill:C.loss,stroke:'#000',strokeWidth:2}} />
            </ComposedChart>
          </ResponsiveContainer>
        </AChart>
      </div>

      {/* ══ 5. MONTHLY P/L ══ */}
      <div className="a-section">
        <ASection title="Monthly Performance" sub="Month-by-month breakdown — spot your consistent vs inconsistent months" />
        <div className="a-grid-2">
          <AChart title="Monthly P/L" dot={C.warn} h={240}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={MAR} barCategoryGap="22%">
                <CartesianGrid {...GRID_P} />
                <XAxis dataKey="m" tick={TICK} tickLine={false} axisLine={false} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={fmtK} />
                <Tooltip content={<Tip fmt={fmtMoney} />} cursor={{fill:'rgba(255,255,255,0.02)'}} />
                <ReferenceLine y={0} stroke="#2a2a3a" />
                <Bar dataKey="pl" radius={[6,6,0,0]} maxBarSize={48}>
                  {monthly.map((e,i)=><Cell key={i} fill={e.pl>=0?C.profit:C.loss} fillOpacity={0.88} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </AChart>

          <AChart title="Cumulative P/L by Month" dot={C.green} h={240}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly} margin={MAR}>
                <SvgDefs />
                <CartesianGrid {...GRID_P} />
                <XAxis dataKey="m" tick={TICK} tickLine={false} axisLine={false} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={fmtK} />
                <Tooltip content={<Tip fmt={fmtK} color={C.green} />} cursor={{stroke:'#2a2a3a',strokeWidth:1}} />
                <Area type="monotone" dataKey="cumPL" stroke="none" fill="url(#gGreen)" fillOpacity={1} dot={false} activeDot={false} />
                <Line type="monotone" dataKey="cumPL" stroke={C.green} strokeWidth={2.5}
                  dot={false} activeDot={{r:4,fill:C.green,stroke:'#000',strokeWidth:2}} />
              </ComposedChart>
            </ResponsiveContainer>
          </AChart>
        </div>
      </div>

      {/* ══ 6. R-MULTIPLE ══ */}
      <div className="a-section">
        <ASection title="R-Multiple Analysis" sub="Do your winners actually pay for your losers?" />
        <div className="a-stat-grid a-stat-grid-4" style={{marginBottom:16}}>
          <AStat label="Avg R"        value={fmtR(S.avgR)}   col={S.avgR>=0?'col-profit':'col-loss'} desc="Mean R across all trades" />
          <AStat label="R Std Dev"    value={S.rStd?`${S.rStd.toFixed(2)}R`:'—'} col="col-base" desc="Consistency of outcomes" />
          <AStat label="Best R"       value={S.bestR!=null?fmtR(S.bestR):'—'}  col="col-profit" />
          <AStat label="Worst R"      value={S.worstR!=null?fmtR(S.worstR):'—'} col="col-loss" />
        </div>
        <div className="a-grid-2">
          <AChart title="R-Multiple Distribution" dot={C.profit} h={240}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rDist} margin={MAR} barCategoryGap="22%">
                <CartesianGrid {...GRID_P} />
                <XAxis dataKey="range" tick={TICK} tickLine={false} axisLine={false} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<Tip fmt={v=>`${v} trades`} color={C.profit} />} cursor={{fill:'rgba(255,255,255,0.02)'}} />
                <Bar dataKey="count" radius={[6,6,0,0]} maxBarSize={52}>
                  {rDist.map((e,i)=><Cell key={i} fill={e.pos?C.profit:C.loss} fillOpacity={e.count===0?0.12:0.88} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </AChart>

          <AChart title="R per Trade — Scatter Plot" dot={C.blue} h={240}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={MAR}>
                <CartesianGrid {...GRID_P} />
                <XAxis dataKey="i" type="number" name="Trade" tick={TICK} tickLine={false} axisLine={false}
                  label={{value:'Trade #',fill:'#4a5568',fontSize:9,position:'insideBottom',offset:-2}} />
                <YAxis dataKey="r" type="number" name="R" tick={TICK} tickLine={false} axisLine={false} tickFormatter={v=>`${v}R`} />
                <Tooltip cursor={{strokeDasharray:'3 3',stroke:'#2a2a3a'}}
                  content={({active,payload}) => {
                    if (!active||!payload?.length) return null;
                    const d = payload[0]?.payload;
                    const col = d?.r>=0?C.profit:C.loss;
                    return (
                      <div style={{background:'#060610',border:`1px solid ${col}40`,borderRadius:10,padding:'10px 16px'}}>
                        <div style={{color:'#4a5568',fontSize:10}}>Trade #{d?.i} · {d?.pair||'—'}</div>
                        <div style={{color:col,fontFamily:'JetBrains Mono,monospace',fontWeight:800,fontSize:16}}>{fmtR(d?.r)}</div>
                        <div style={{color:'#4a5568',fontSize:10}}>{fmtMoney(d?.pl)}</div>
                      </div>
                    );
                  }} />
                <ReferenceLine y={0} stroke="#2a2a3a" strokeDasharray="4 4" />
                <Scatter
                  data={sorted.filter(t=>t.r_multiple!=null).map((t,i)=>({i:i+1,r:+parseFloat(t.r_multiple).toFixed(2),pair:t.pair,pl:t.net_pl}))}
                  shape={({cx,cy,payload})=>{
                    const col=payload.r>=0?C.profit:C.loss;
                    return <g><circle cx={cx} cy={cy} r={5} fill={col} fillOpacity={0.78} stroke="none" /><circle cx={cx} cy={cy} r={9} fill={col} fillOpacity={0.07} stroke="none" /></g>;
                  }} />
              </ScatterChart>
            </ResponsiveContainer>
          </AChart>
        </div>
      </div>

      {/* ══ 7. WIN/LOSS SEQUENCE ══ */}
      <div className="a-section">
        <ASection title="Win / Loss Sequence" sub="Last 60 trades — height reflects P&L magnitude" />
        <AChart title="Trade Sequence Visualization" dot={C.warn} h={90}>
          <SeqBar trades={trades} />
        </AChart>
      </div>

      {/* ══ 8. INSTRUMENT ANALYSIS ══ */}
      <div className="a-section">
        <ASection title="Instrument Analysis" sub="Which pairs are making money — and which aren't" />
        <div className="a-grid-3" style={{marginBottom:16}}>
          {[
            {key:'pl',  label:'P/L',          fmt:fmtK,    colFn:(v)=>v>=0?C.profit:C.loss, refX:0},
            {key:'wr',  label:'Win Rate',      fmt:v=>`${v.toFixed(0)}%`, colFn:(v)=>v>=50?C.profit:C.loss, refX:50, dot:C.blue},
            {key:'pf',  label:'Profit Factor', fmt:v=>v.toFixed(2), colFn:(v)=>v>=1.5?C.profit:v>=1?C.warn:C.loss, refX:1, dot:C.warn},
          ].map(({key,label,fmt,colFn,refX,dot=C.profit})=>(
            <AChart key={key} title={`${label} by Instrument`} dot={dot} h={Math.max(pairs.length*38+32,160)}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pairs} layout="vertical" margin={{top:4,right:44,left:14,bottom:4}} barCategoryGap="28%">
                  <CartesianGrid {...GRID_P} horizontal={false} />
                  <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} tickFormatter={fmt} />
                  <YAxis type="category" dataKey="pair" tick={{...TICK,fontSize:11,fontWeight:700}} tickLine={false} axisLine={false} width={36} />
                  <Tooltip content={<Tip fmt={typeof fmt==='function'?fmt:undefined} />} cursor={{fill:'rgba(255,255,255,0.02)'}} />
                  {refX!=null && <ReferenceLine x={refX} stroke="#2a2a3a" strokeDasharray="4 4" strokeWidth={1} />}
                  <Bar dataKey={key} radius={[0,6,6,0]} maxBarSize={22}
                    label={{position:'right',fill:'#555f6e',fontSize:9,formatter:fmt}}>
                    {pairs.map((e,i)=><Cell key={i} fill={colFn(e[key])} fillOpacity={0.88} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AChart>
          ))}
        </div>
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr><th>Instrument</th><th>Trades</th><th>Win Rate</th><th>Avg R</th><th>Profit Factor</th><th>Avg Win</th><th>Avg Loss</th><th>Payoff</th><th>Net P/L</th></tr>
            </thead>
            <tbody>
              {pairs.map((p,i)=>(
                <tr key={i}>
                  <td style={{fontWeight:700,color:'var(--text-primary)'}}>{p.pair}</td>
                  <td className="mono">{p.n}</td>
                  <td className={`mono ${p.wr>=50?'col-profit':'col-loss'}`}>{p.wr.toFixed(1)}%</td>
                  <td className="mono">{p.avgR!=null?fmtR(p.avgR):'—'}</td>
                  <td className={`mono ${p.pf>=1.5?'col-profit':p.pf>=1?'col-warn':'col-loss'}`}>{p.pf>=999?'∞':p.pf.toFixed(2)}</td>
                  <td className="mono col-profit">+${p.avgWin.toFixed(2)}</td>
                  <td className="mono col-loss">-${p.avgLoss.toFixed(2)}</td>
                  <td className={`mono ${p.avgWin>=p.avgLoss?'col-profit':'col-warn'}`}>{p.avgLoss>0?(p.avgWin/p.avgLoss).toFixed(2):'∞'}</td>
                  <td className={`mono ${p.pl>=0?'col-profit':'col-loss'}`}>{fmtMoney(p.pl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ 9. LONG VS SHORT ══ */}
      <div className="a-section">
        <ASection title="Long vs Short" sub="Are you directionally biased?" />
        <div className="a-grid-2">
          {ls.map(d=>(
            <div key={d.dir} style={{
              background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.06)',
              borderRadius:16, padding:'20px 24px',
            }}>
              <div style={{fontSize:13,fontWeight:800,textTransform:'uppercase',letterSpacing:1,color:d.dir==='Long'?C.profit:C.loss,marginBottom:14}}>{d.dir}</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                {[
                  {l:'Trades',v:d.n,col:'col-base'},
                  {l:'Win Rate',v:fmtPct(d.wr),col:d.wr>=50?'col-profit':'col-loss'},
                  {l:'P.Factor',v:d.pf>=999?'∞':d.pf.toFixed(2),col:d.pf>=1.5?'col-profit':d.pf>=1?'col-warn':'col-loss'},
                  {l:'Net P/L',v:fmtMoney(d.pl),col:d.pl>=0?'col-profit':'col-loss'},
                  {l:'Avg P/L',v:fmtMoney(d.avg),col:d.avg>=0?'col-profit':'col-loss'},
                  {l:'Avg Win',v:`+$${d.avgWin.toFixed(2)}`,col:'col-profit'},
                  {l:'Avg Loss',v:`-$${d.avgLoss.toFixed(2)}`,col:'col-loss'},
                  {l:'Payoff',v:d.avgLoss>0?(d.avgWin/d.avgLoss).toFixed(2):'∞',col:d.avgWin>=d.avgLoss?'col-profit':'col-warn'},
                ].map(({l,v,col})=>(
                  <div key={l}>
                    <div style={{fontSize:9,color:'#555f6e',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>{l}</div>
                    <div className={`mono ${col}`} style={{fontSize:14,fontWeight:700}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ 10. DAY OF WEEK ══ */}
      <div className="a-section">
        <ASection title="Day of Week Analysis" sub="When is your edge strongest?" />
        <AChart title="Avg P/L by Day" dot={C.blue} h={220}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dow} margin={MAR} barCategoryGap="28%">
              <CartesianGrid {...GRID_P} />
              <XAxis dataKey="d" tick={TICK} tickLine={false} axisLine={false} />
              <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={fmtK} />
              <Tooltip content={<Tip fmt={fmtMoney} color={C.blue} />} cursor={{fill:'rgba(255,255,255,0.02)'}} />
              <ReferenceLine y={0} stroke="#2a2a3a" />
              <Bar dataKey="avg" radius={[6,6,0,0]} maxBarSize={48}>
                {dow.map((e,i)=><Cell key={i} fill={e.avg>=0?C.profit:C.loss} fillOpacity={0.88} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AChart>
      </div>

      {/* ══ 11. ROLLING METRICS ══ */}
      <div className="a-section">
        <ASection title="Rolling Performance (10-Trade Window)" sub="Are you improving or slipping? This tracks your edge in real-time." />
        <div className="a-grid-2">
          <AChart title="Rolling Win Rate" dot={C.blue} h={220}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rollingWR} margin={MAR}>
                <SvgDefs />
                <CartesianGrid {...GRID_P} />
                <XAxis dataKey="i" tick={TICK} tickLine={false} axisLine={false}
                  label={{value:'Trade #',fill:'#4a5568',fontSize:9,position:'insideBottom',offset:-2}} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} domain={[0,100]} tickFormatter={v=>`${v}%`} />
                <Tooltip content={<Tip fmt={fmtPct} color={C.blue} />} cursor={{stroke:'#2a2a3a',strokeWidth:1}} />
                <ReferenceLine y={50} stroke={C.warn} strokeDasharray="4 4" strokeWidth={1}
                  label={{value:'50%',fill:C.warn,fontSize:9,position:'right'}} />
                <Area type="monotone" dataKey="wr" stroke="none" fill="url(#gBlue)" fillOpacity={1} dot={false} activeDot={false} />
                <Line type="monotone" dataKey="wr" stroke={C.blue} strokeWidth={2.5}
                  dot={false} activeDot={{r:4,fill:C.blue,stroke:'#000',strokeWidth:2}} />
              </ComposedChart>
            </ResponsiveContainer>
          </AChart>

          <AChart title="Rolling Expectancy" dot={C.green} h={220}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rollingEx} margin={MAR}>
                <SvgDefs />
                <CartesianGrid {...GRID_P} />
                <XAxis dataKey="i" tick={TICK} tickLine={false} axisLine={false}
                  label={{value:'Trade #',fill:'#4a5568',fontSize:9,position:'insideBottom',offset:-2}} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={v=>`$${v>=0?'':'-'}${Math.abs(v).toFixed(0)}`} />
                <Tooltip content={<Tip fmt={fmtMoney} />} cursor={{stroke:'#2a2a3a',strokeWidth:1}} />
                <ReferenceLine y={0} stroke="#2a2a3a" strokeDasharray="4 4" />
                <Bar dataKey="ex" maxBarSize={14} radius={[3,3,0,0]}>
                  {rollingEx.map((e,i)=><Cell key={i} fill={e.ex>=0?C.profit:C.loss} fillOpacity={0.75} />)}
                </Bar>
                <Line type="monotone" dataKey="ex" stroke={C.green} strokeWidth={2}
                  dot={false} activeDot={{r:4,fill:C.green,stroke:'#000',strokeWidth:2}} />
              </ComposedChart>
            </ResponsiveContainer>
          </AChart>
        </div>
      </div>

      {/* ══ 12. ACTIVITY HEATMAP ══ */}
      <div className="a-section">
        <ASection title="Activity Heatmap" sub="Last 90 days — colour intensity = P&L magnitude" />
        <ActivityHeatmap data={heatmap} />
      </div>

      {/* ══ 13. MODEL / PLAYBOOK ANALYSIS ══ */}
      {mperf.length > 0 && (
        <div className="a-section">
          <ASection title="Model / Playbook Analysis" sub="Which setups carry your edge — and which need killing" />
          <div className="a-grid-3" style={{marginBottom:16}}>
            {[
              {k:'winRate',   label:'Win Rate',      fmt:fmtPct,  col:v=>v>=50?C.profit:C.loss, ref:50},
              {k:'totalPL',   label:'Net P/L',        fmt:fmtMoney,col:v=>v>=0?C.profit:C.loss,  ref:0},
              {k:'avgR',      label:'Avg R',           fmt:fmtR,    col:v=>(v||0)>=0?C.profit:C.loss, ref:0},
            ].map(({k,label,fmt,col,ref})=>(
              <AChart key={k} title={`${label} by Model`} dot={C.warn} h={220}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mperf} margin={MAR} barCategoryGap="28%">
                    <CartesianGrid {...GRID_P} />
                    <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} />
                    <YAxis tick={TICK} tickLine={false} axisLine={false} />
                    <Tooltip content={<Tip fmt={fmt} />} cursor={{fill:'rgba(255,255,255,0.02)'}} />
                    <ReferenceLine y={ref} stroke="#2a2a3a" strokeDasharray="4 4" />
                    <Bar dataKey={k} radius={[6,6,0,0]} maxBarSize={48}>
                      {mperf.map((m,i)=><Cell key={i} fill={col(m[k]||0)} fillOpacity={0.9} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </AChart>
            ))}
          </div>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>Model</th><th>Trades</th><th>Win Rate</th><th>P.Factor</th><th>Avg R</th><th>Expectancy</th><th>Net P/L</th></tr></thead>
              <tbody>
                {mperf.map(m=>(
                  <tr key={m.id}>
                    <td style={{fontWeight:700,color:'var(--text-primary)'}}>{m.name}</td>
                    <td className="mono">{m.total_trades}</td>
                    <td className={`mono ${m.winRate>=50?'col-profit':'col-loss'}`}>{m.winRate.toFixed(1)}%</td>
                    <td className={`mono ${m.profitFactor>=1.5?'col-profit':m.profitFactor>=1?'col-warn':'col-loss'}`}>{m.profitFactor >= 999 ? '∞' : m.profitFactor.toFixed(2)}</td>
                    <td className="mono">{m.avgR!=null?fmtR(m.avgR):'—'}</td>
                    <td className={`mono ${m.expectancy>=0?'col-profit':'col-loss'}`}>{fmtMoney(m.expectancy)}</td>
                    <td className={`mono ${m.totalPL>=0?'col-profit':'col-loss'}`}>{fmtMoney(m.totalPL)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ 14. TRADE GRADES ══ */}
      <div className="a-section">
        <ASection title="Trade Quality Grades" sub="Execution discipline — your grade distribution tells the real story" />
        <div className="a-grid-2">
          <AChart title="Grade Count" dot={C.green} h={230}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grades.filter(g=>g.count>0)} margin={MAR} barCategoryGap="28%">
                <CartesianGrid {...GRID_P} />
                <XAxis dataKey="grade" tick={TICK} tickLine={false} axisLine={false} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<Tip fmt={v=>`${v} trades`} color={C.green} />} cursor={{fill:'rgba(255,255,255,0.02)'}} />
                <Bar dataKey="count" radius={[8,8,0,0]} maxBarSize={64}>
                  {grades.map((e,i)=><Cell key={i} fill={e.color} fillOpacity={0.9} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </AChart>

          <AChart title="Avg P/L by Grade" dot={C.warn} h={230}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grades.filter(g=>g.count>0)} margin={MAR} barCategoryGap="28%">
                <CartesianGrid {...GRID_P} />
                <XAxis dataKey="grade" tick={TICK} tickLine={false} axisLine={false} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={v=>`${v>=0?'':'-'}$${Math.abs(v).toFixed(0)}`} />
                <Tooltip content={<Tip fmt={fmtMoney} />} cursor={{fill:'rgba(255,255,255,0.02)'}} />
                <ReferenceLine y={0} stroke="#2a2a3a" />
                <Bar dataKey="avgPL" radius={[8,8,0,0]} maxBarSize={64}>
                  {grades.map((e,i)=><Cell key={i} fill={e.avgPL>=0?e.color:C.loss} fillOpacity={0.88} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </AChart>
        </div>
      </div>

      {/* ══ 15. RULE VIOLATION TRACKER ══ */}
      <div className="a-section">
        <ASection
          title="Rule Violation Tracker"
          sub="Trades where you broke your own rules — the real cost of indiscipline"
        />
        <div className="a-stat-grid a-stat-grid-4" style={{ marginBottom: 20 }}>
          <AStat
            label="Violation Rate"
            value={violations.totalCount > 0 ? fmtPct(violations.violationPct) : '—'}
            col={violations.violationPct > 30 ? 'col-loss' : violations.violationPct > 10 ? 'col-warn' : 'col-profit'}
            desc={`${violations.vCount} of ${violations.totalCount} trades`}
          />
          <AStat
            label="Avg P/L — Clean"
            value={violations.avgClean != null ? fmtMoney(violations.avgClean) : '—'}
            col={violations.avgClean >= 0 ? 'col-profit' : 'col-loss'}
            desc="No violation"
          />
          <AStat
            label="Avg P/L — Violated"
            value={violations.avgViol != null ? fmtMoney(violations.avgViol) : '—'}
            col={violations.avgViol >= 0 ? 'col-profit' : 'col-loss'}
            desc="With violation"
          />
          <AStat
            label="Hidden Cost"
            value={violations.hiddenCost != null ? fmtMoney(violations.hiddenCost) : '—'}
            col="col-loss"
            desc="Total P/L lost to violated trades"
          />
        </div>

        {violations.vCount === 0 ? (
          <div style={{
            textAlign:'center', padding:'40px 20px',
            background:'rgba(134,112,255,0.04)', borderRadius:14,
            border:'1px solid rgba(134,112,255,0.12)',
          }}>
            <div style={{color:'#8670ff',fontWeight:700,fontSize:15}}>Zero violations logged</div>
            <div style={{color:'#555f6e',fontSize:12,marginTop:4}}>Keep following your rules. Your edge compounds with your discipline.</div>
          </div>
        ) : (
          <div className="a-grid-2">
            <AChart title="Clean vs. Violated — Avg P/L" dot={C.loss} h={240}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { label: 'Clean', val: violations.avgClean || 0 },
                    { label: 'Violated', val: violations.avgViol || 0 },
                  ]}
                  margin={MAR}
                  barCategoryGap="35%"
                >
                  <CartesianGrid {...GRID_P} />
                  <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} />
                  <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={v=>`${v>=0?'':'-'}$${Math.abs(v).toFixed(0)}`} />
                  <Tooltip content={<Tip fmt={fmtMoney} />} cursor={{fill:'rgba(255,255,255,0.02)'}} />
                  <ReferenceLine y={0} stroke="#2a2a3a" />
                  <Bar dataKey="val" radius={[8,8,0,0]} maxBarSize={80}>
                    <Cell fill={violations.avgClean >= 0 ? C.profit : C.loss} fillOpacity={0.88} />
                    <Cell fill={violations.avgViol  >= 0 ? C.profit : C.loss} fillOpacity={0.88} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AChart>

            <AChart title="Rolling Violation Rate" dot={C.loss} h={240}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={violations.rollingViol} margin={MAR}>
                  <SvgDefs />
                  <CartesianGrid {...GRID_P} />
                  <XAxis dataKey="l" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={TICK} tickLine={false} axisLine={false} domain={[0,100]} tickFormatter={v=>`${v}%`} />
                  <Tooltip content={<Tip fmt={v=>`${v.toFixed(0)}%`} color={C.loss} />} cursor={{fill:'rgba(255,255,255,0.02)'}} />
                  <Area type="monotone" dataKey="vr" stroke={C.loss} strokeWidth={2} fill="url(#gLoss)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </AChart>

            {violations.mistakeTags.length > 0 && (
              <AChart title="Mistake Tags on Violated Trades" dot={C.warn} h={220}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={violations.mistakeTags} margin={{...MAR, bottom: 24}} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid {...GRID_P} />
                    <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis dataKey="tag" type="category" tick={{...TICK, fontSize:9}} tickLine={false} axisLine={false} width={90} />
                    <Tooltip content={<Tip fmt={v=>`${v} trades`} color={C.warn} />} cursor={{fill:'rgba(255,255,255,0.02)'}} />
                    <Bar dataKey="count" radius={[0,6,6,0]} maxBarSize={22} fill={C.warn} fillOpacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </AChart>
            )}
          </div>
        )}

        {violations.vCount > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize:11, color:'#555f6e', fontFamily:'JetBrains Mono,monospace', letterSpacing:'0.5px', marginBottom:10, textTransform:'uppercase' }}>
              Violated Trades Log — {violations.vCount} records
            </div>
            <div style={{ maxHeight: 320, overflowY:'auto', borderRadius:12, border:'1px solid rgba(255,0,149,0.12)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11, fontFamily:'JetBrains Mono,monospace' }}>
                <thead>
                  <tr style={{ background:'rgba(255,0,149,0.08)', position:'sticky', top:0 }}>
                    {['Date','Pair','Dir','Net P/L','R','Mistake Tag','Grade'].map(h => (
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#555f6e', fontWeight:600, letterSpacing:'0.3px', fontSize:10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {violations.violatedTrades.map((t, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding:'7px 12px', color:'#8891a4' }}>{fmtD(t.date)}</td>
                      <td style={{ padding:'7px 12px', color:'#c0cad8', fontWeight:600 }}>{t.pair || '—'}</td>
                      <td style={{ padding:'7px 12px', color: t.direction==='Long'?C.profit:C.loss, fontWeight:700, textTransform:'uppercase', fontSize:10 }}>{t.direction || '—'}</td>
                      <td style={{ padding:'7px 12px', color: t.net_pl>=0?C.profit:C.loss, fontWeight:700 }}>{fmtMoney(t.net_pl)}</td>
                      <td style={{ padding:'7px 12px', color: t.r_multiple>=0?C.profit:C.loss }}>{t.r_multiple!=null?fmtR(t.r_multiple):'—'}</td>
                      <td style={{ padding:'7px 12px', color:'#ffaa00' }}>{t.mistake_tag || <span style={{color:'#3a3a4a'}}>—</span>}</td>
                      <td style={{ padding:'7px 12px' }}>
                        {t.trade_grade
                          ? <span style={{ background: t.trade_grade==='A+'?'rgba(134,112,255,0.2)':t.trade_grade==='A'?'rgba(0,229,160,0.15)':t.trade_grade==='B'?'rgba(255,170,0,0.15)':'rgba(255,0,149,0.15)', color: t.trade_grade==='A+'?C.profit:t.trade_grade==='A'?C.green:t.trade_grade==='B'?C.warn:C.loss, padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700 }}>{t.trade_grade}</span>
                          : <span style={{color:'#3a3a4a'}}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ══ 16. ENTRY TIMING ANALYSIS ══ */}
      <div className="a-section">
        <ASection title="Entry Timing Analysis" sub="When do you trade best? P&L by day of week and hour" />
        <DayHourHeatmap data={dayHourData} />
      </div>

      {/* ══ 17. MONTE CARLO SIMULATION ══ */}
      <div className="a-section">
        <ASection
          title="Monte Carlo Simulation"
          sub="1,000 randomised equity paths based on your historical trade distribution"
        />

        {/* Config bar */}
        <div style={{
          display:'flex', gap:16, alignItems:'flex-end', flexWrap:'wrap',
          background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)',
          borderRadius:12, padding:'14px 18px', marginBottom:20,
        }}>
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            <label style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.7px',color:'#555f6e'}}>
              Simulations
            </label>
            <select
              value={mcConfig.numSims}
              onChange={e => setMcConfig(c => ({ ...c, numSims: +e.target.value }))}
              style={{background:'var(--bg-tertiary)',border:'1px solid var(--border-color)',borderRadius:8,color:'var(--text-primary)',padding:'7px 12px',fontSize:13,minWidth:140}}
            >
              <option value={500}>500 simulations</option>
              <option value={1000}>1,000 simulations</option>
              <option value={5000}>5,000 simulations</option>
            </select>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            <label style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.7px',color:'#555f6e'}}>
              Trades per Simulation
            </label>
            <select
              value={mcConfig.numTrades}
              onChange={e => setMcConfig(c => ({ ...c, numTrades: +e.target.value }))}
              style={{background:'var(--bg-tertiary)',border:'1px solid var(--border-color)',borderRadius:8,color:'var(--text-primary)',padding:'7px 12px',fontSize:13,minWidth:180}}
            >
              <option value={50}>50 trades</option>
              <option value={100}>100 trades</option>
              <option value={200}>200 trades</option>
              <option value={500}>500 trades</option>
            </select>
          </div>

          {mcRunning && (
            <div style={{color:'#555f6e',fontSize:12,fontFamily:'JetBrains Mono,monospace',alignSelf:'center',paddingBottom:2}}>
              ⟳ Running {mcConfig.numSims.toLocaleString()} simulations…
            </div>
          )}
        </div>

        {trades.length < 5 ? (
          <div className="a-empty">
            <h3>Not enough data</h3>
            <p>You need at least 5 trades to run a Monte Carlo simulation.</p>
          </div>
        ) : !mcResult ? (
          <div className="a-empty">
            <p style={{color:'#555f6e',fontFamily:'JetBrains Mono,monospace',fontSize:12}}>⟳ Computing…</p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="a-stat-grid a-stat-grid-4" style={{marginBottom:20}}>
              <div className="a-stat">
                <div className="a-stat-label">Probability of Profit</div>
                <div className={`a-stat-value ${mcResult.probProfit >= 60 ? 'col-profit' : mcResult.probProfit >= 40 ? 'col-warn' : 'col-loss'}`}>
                  {mcResult.probProfit.toFixed(1)}%
                </div>
                <div className="a-stat-desc">% of sims ending above starting balance</div>
                <div className="a-progress">
                  <div className="a-progress-fill" style={{
                    width:`${mcResult.probProfit}%`,
                    background: mcResult.probProfit >= 60 ? C.profit : mcResult.probProfit >= 40 ? C.warn : C.loss,
                    boxShadow:`0 0 6px ${mcResult.probProfit >= 60 ? C.profit : C.warn}66`,
                  }}/>
                </div>
              </div>

              <div className="a-stat">
                <div className="a-stat-label">Probability of Ruin</div>
                <div className={`a-stat-value ${mcResult.probRuin <= 5 ? 'col-profit' : mcResult.probRuin <= 20 ? 'col-warn' : 'col-loss'}`}>
                  {mcResult.probRuin.toFixed(1)}%
                </div>
                <div className="a-stat-desc">% of sims losing &gt;50% of account</div>
              </div>

              <div className="a-stat">
                <div className="a-stat-label">Median Outcome</div>
                <div className={`a-stat-value ${mcResult.medFinal >= mcResult.start ? 'col-profit' : 'col-loss'}`}>
                  {`${mcResult.medFinal >= mcResult.start ? '+' : '-'}$${Math.abs(mcResult.medFinal - mcResult.start).toLocaleString('en-US',{maximumFractionDigits:0})}`}
                </div>
                <div className="a-stat-desc">P&L at median (50th percentile)</div>
              </div>

              <div className="a-stat">
                <div className="a-stat-label">Median Max Drawdown</div>
                <div className="a-stat-value col-loss">{mcResult.medDD.toFixed(1)}%</div>
                <div className="a-stat-desc">95th pct worst case: {mcResult.worstDD.toFixed(1)}%</div>
              </div>
            </div>

            {/* Equity fan + DD histogram */}
            <div className="a-grid-2" style={{marginBottom:20}}>
              <AChart title="Equity Curve Fan — Percentile Bands" dot={C.profit} h={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={mcResult.bandData} margin={{top:8,right:16,left:4,bottom:4}}>
                    <SvgDefs />
                    <CartesianGrid {...GRID_P} />
                    <XAxis
                      dataKey="t"
                      tick={TICK}
                      tickLine={false}
                      axisLine={false}
                      label={{value:'Trade #', fill:'#4a5568', fontSize:9, position:'insideBottom', offset:-2}}
                    />
                    <YAxis
                      tick={TICK}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={v => v >= 0 ? `+$${Math.abs(v) >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0)}` : `-$${Math.abs(v) >= 1000 ? `${(Math.abs(v)/1000).toFixed(0)}k` : Math.abs(v).toFixed(0)}`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const d = mcResult.bandData.find(x => x.t === label);
                        if (!d) return null;
                        const fmt = v => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString('en-US', {maximumFractionDigits:0})}`;
                        return (
                          <div style={{background:'#060610',border:`1px solid ${C.profit}40`,borderRadius:10,padding:'10px 14px',fontSize:11,fontFamily:'JetBrains Mono,monospace'}}>
                            <div style={{color:'#555f6e',marginBottom:6}}>After trade #{label}</div>
                            <div style={{color:C.profit}}>P95 {fmt(d.p95)}</div>
                            <div style={{color:'#6a9f8a'}}>P75 {fmt(d.p75)}</div>
                            <div style={{color:C.warn,fontWeight:800}}>P50 {fmt(d.p50)} ← median</div>
                            <div style={{color:'#7a6a8a'}}>P25 {fmt(d.p25)}</div>
                            <div style={{color:C.loss}}>P5 {fmt(d.p5)}</div>
                          </div>
                        );
                      }}
                      cursor={{stroke:'#2a2a3a',strokeWidth:1}}
                    />
                    <Area type="monotone" dataKey="p95" stroke="none" fill={C.profit} fillOpacity={0.06} dot={false} activeDot={false} legendType="none" />
                    <Area type="monotone" dataKey="p5"  stroke="none" fill="#060610" fillOpacity={1}    dot={false} activeDot={false} legendType="none" />
                    <Area type="monotone" dataKey="p75" stroke="none" fill={C.profit} fillOpacity={0.12} dot={false} activeDot={false} legendType="none" />
                    <Area type="monotone" dataKey="p25" stroke="none" fill="#060610" fillOpacity={1}    dot={false} activeDot={false} legendType="none" />
                    <Line type="monotone" dataKey="p95" stroke={C.profit} strokeWidth={1.5} strokeOpacity={0.5}  dot={false} activeDot={false} />
                    <Line type="monotone" dataKey="p75" stroke={C.profit} strokeWidth={1}   strokeOpacity={0.35} dot={false} activeDot={false} strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="p25" stroke={C.loss}   strokeWidth={1}   strokeOpacity={0.35} dot={false} activeDot={false} strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="p5"  stroke={C.loss}   strokeWidth={1.5} strokeOpacity={0.5}  dot={false} activeDot={false} />
                    <Line type="monotone" dataKey="p50" stroke={C.warn}   strokeWidth={2.5} dot={false} activeDot={{r:4,fill:C.warn,stroke:'#000',strokeWidth:2}} />
                    <ReferenceLine y={0} stroke="#2a2a3a" strokeDasharray="4 4" />
                  </ComposedChart>
                </ResponsiveContainer>
              </AChart>

              <AChart title="Max Drawdown Distribution Across Simulations" dot={C.loss} h={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mcResult.ddHist} margin={{top:8,right:16,left:4,bottom:4}} barCategoryGap="16%">
                    <CartesianGrid {...GRID_P} />
                    <XAxis dataKey="range" tick={{...TICK,fontSize:9}} tickLine={false} axisLine={false} />
                    <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div style={{background:'#060610',border:`1px solid ${C.loss}40`,borderRadius:10,padding:'10px 14px',fontSize:12,fontFamily:'JetBrains Mono,monospace'}}>
                            <div style={{color:'#555f6e',marginBottom:4}}>Drawdown {d.range}</div>
                            <div style={{color:C.loss,fontWeight:800}}>{d.count} simulations</div>
                            <div style={{color:'#555f6e',fontSize:10}}>{((d.count/mcResult.numSims)*100).toFixed(1)}% of total</div>
                          </div>
                        );
                      }}
                      cursor={{fill:'rgba(255,255,255,0.02)'}}
                    />
                    <Bar dataKey="count" radius={[6,6,0,0]} maxBarSize={52}>
                      {mcResult.ddHist.map((e,i) => (
                        <Cell key={i}
                          fill={e.lo < 10 ? C.profit : e.lo < 20 ? C.warn : C.loss}
                          fillOpacity={0.85}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </AChart>
            </div>

            {/* Final balance distribution + scenario breakdown */}
            <div className="a-grid-2">
              <AChart title="Final Balance Distribution" dot={C.blue} h={260}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mcResult.fbHist} margin={{top:8,right:16,left:4,bottom:4}} barCategoryGap="16%">
                    <CartesianGrid {...GRID_P} />
                    <XAxis dataKey="range" tick={{...TICK,fontSize:9}} tickLine={false} axisLine={false} />
                    <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div style={{background:'#060610',border:`1px solid ${C.blue}40`,borderRadius:10,padding:'10px 14px',fontSize:12,fontFamily:'JetBrains Mono,monospace'}}>
                            <div style={{color:'#555f6e',marginBottom:4}}>Final balance ~{d.range}</div>
                            <div style={{color:d.profit?C.profit:C.loss,fontWeight:800}}>{d.count} simulations</div>
                            <div style={{color:'#555f6e',fontSize:10}}>{((d.count/mcResult.numSims)*100).toFixed(1)}% of total</div>
                          </div>
                        );
                      }}
                      cursor={{fill:'rgba(255,255,255,0.02)'}}
                    />
                    <Bar dataKey="count" radius={[6,6,0,0]} maxBarSize={52}>
                      {mcResult.fbHist.map((e,i) => (
                        <Cell key={i} fill={e.profit ? C.profit : C.loss} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </AChart>

              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {[
                  {
                    label: 'BEST CASE (P95)',
                    value: `${mcResult.bestCase >= mcResult.start ? '+' : '-'}$${Math.abs(mcResult.bestCase - mcResult.start).toLocaleString('en-US',{maximumFractionDigits:0})}`,
                    sub:   `Final: $${mcResult.bestCase.toLocaleString('en-US',{maximumFractionDigits:0})}`,
                    col:   C.profit,
                    desc:  'Top 5% of simulation outcomes',
                  },
                  {
                    label: 'MEDIAN CASE (P50)',
                    value: `${mcResult.medFinal >= mcResult.start ? '+' : '-'}$${Math.abs(mcResult.medFinal - mcResult.start).toLocaleString('en-US',{maximumFractionDigits:0})}`,
                    sub:   `Final: $${mcResult.medFinal.toLocaleString('en-US',{maximumFractionDigits:0})}`,
                    col:   C.warn,
                    desc:  'The most likely outcome',
                  },
                  {
                    label: 'WORST CASE (P5)',
                    value: `${mcResult.worstCase >= mcResult.start ? '+' : '-'}$${Math.abs(mcResult.worstCase - mcResult.start).toLocaleString('en-US',{maximumFractionDigits:0})}`,
                    sub:   `Final: $${mcResult.worstCase.toLocaleString('en-US',{maximumFractionDigits:0})}`,
                    col:   C.loss,
                    desc:  'Bottom 5% of simulation outcomes',
                  },
                  {
                    label: 'WORST DRAWDOWN (P95)',
                    value: `-${mcResult.worstDD.toFixed(1)}%`,
                    sub:   `Median DD: ${mcResult.medDD.toFixed(1)}%`,
                    col:   C.loss,
                    desc:  '95th percentile max drawdown across all sims',
                  },
                ].map(({ label, value, sub, col, desc }) => (
                  <div key={label} style={{
                    background:'rgba(255,255,255,0.025)',
                    border:'1px solid rgba(255,255,255,0.06)',
                    borderRadius:12, padding:'14px 18px',
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                  }}>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',color:'#555f6e',marginBottom:3}}>{label}</div>
                      <div style={{fontSize:11,color:'#3a3a4a',marginTop:2}}>{desc}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:20,fontWeight:800,color:col}}>{value}</div>
                      <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,color:'#555f6e',marginTop:2}}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div style={{
              marginTop:16, padding:'10px 16px',
              background:'rgba(255,255,255,0.015)', border:'1px solid rgba(255,255,255,0.05)',
              borderRadius:10, display:'flex', gap:20, flexWrap:'wrap', alignItems:'center',
            }}>
              {[
                { col: C.profit,  label: 'P95 — Best 5%' },
                { col: '#6a9f8a', label: 'P75 — Upper quartile' },
                { col: C.warn,    label: 'P50 — Median' },
                { col: '#7a6a8a', label: 'P25 — Lower quartile' },
                { col: C.loss,    label: 'P5 — Worst 5%' },
              ].map(({ col, label }) => (
                <div key={label} style={{display:'flex',alignItems:'center',gap:7}}>
                  <div style={{width:16,height:2,background:col,borderRadius:1}} />
                  <span style={{fontSize:10,color:'#555f6e',fontFamily:'JetBrains Mono,monospace'}}>{label}</span>
                </div>
              ))}
              <div style={{marginLeft:'auto',fontSize:10,color:'#3a3a4a',fontFamily:'JetBrains Mono,monospace'}}>
                {mcResult.numSims.toLocaleString()} sims × {mcResult.numTrades} trades · bootstrap resampling with replacement
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */

function Hero({ selAcc, S }) {
  return (
    <div className="analytics-hero">
      <h1 className="analytics-hero-title">Analytics</h1>
      <p className="analytics-hero-sub">
        {selAcc ? `Deep Performance Analysis — ${selAcc.name}` : 'Deep Performance Analysis — All Accounts'}
        {S?.n > 0 && ` · ${S.n} trades · ${S.pl>=0?'+':''}$${S.pl.toFixed(2)} net`}
      </p>
    </div>
  );
}

function FilterBar({ accounts, filters, setFilters }) {
  return (
    <div className="analytics-filters">
      <div className="form-group">
        <label>Account</label>
        <select value={filters.accountId} onChange={e=>setFilters({...filters,accountId:e.target.value})} style={{minWidth:180}}>
          <option value="">All Accounts</option>
          {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>Start Date</label>
        <input type="date" value={filters.startDate} onChange={e=>setFilters({...filters,startDate:e.target.value})} />
      </div>
      <div className="form-group">
        <label>End Date</label>
        <input type="date" value={filters.endDate} onChange={e=>setFilters({...filters,endDate:e.target.value})} />
      </div>
      <button className="btn btn-ghost" style={{alignSelf:'flex-end'}} onClick={()=>setFilters({accountId:'',startDate:'',endDate:''})}>
        Clear
      </button>
    </div>
  );
}

function SeqBar({ trades }) {
  const sorted  = [...trades].sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-60);
  const maxA    = Math.max(...sorted.map(t=>Math.abs(t.net_pl)),1);
  return (
    <div style={{display:'flex',gap:3,alignItems:'flex-end',height:64,paddingTop:4}}>
      {sorted.map((t,i)=>{
        const h   = Math.max((Math.abs(t.net_pl)/maxA)*58+6,8);
        const col = t.net_pl>=0?C.profit:C.loss;
        return (
          <div key={i}
            title={`#${i+1} · ${t.pair||''} · ${t.net_pl>=0?'+':''}$${t.net_pl.toFixed(2)}`}
            style={{
              width:8,height:h,borderRadius:'3px 3px 0 0',
              background:col,opacity:0.8,flexShrink:0,
              boxShadow:`0 0 6px ${col}44`,
            }}
          />
        );
      })}
    </div>
  );
}

function ActivityHeatmap({ data }) {
  const PROFIT = '#8670ff';
  const LOSS   = '#ff0095';
  return (
    <div>
      <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
        {data.map((d,i)=>{
          const hasPL = d.pl !== null && d.pl !== undefined;
          let bg = 'rgba(255,255,255,0.025)';
          if (hasPL && d.pl !== 0) {
            const op = Math.min(Math.abs(d.pl)/300, 0.9)*0.85+0.15;
            bg = d.pl > 0 ? `rgba(134,112,255,${op})` : `rgba(255,0,149,${op})`;
          }
          const day = d.date ? new Date(d.date+'T00:00:00') : null;
          return (
            <div key={i}
              title={d.date ? `${d.date}: ${d.pl!==null ? `${d.pl>=0?'+':''}$${d.pl.toFixed(2)}` : 'No trades'}` : ''}
              style={{
                width:32,height:32,borderRadius:5,cursor:'default',
                background:bg,
                border:`1px solid ${hasPL&&d.pl!==0?(d.pl>0?'rgba(134,112,255,0.22)':'rgba(255,0,149,0.22)'):'rgba(255,255,255,0.04)'}`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:9,color:'rgba(255,255,255,0.35)',fontFamily:'JetBrains Mono,monospace',
              }}>
              {day ? day.getDate() : ''}
            </div>
          );
        })}
      </div>
      <div style={{display:'flex',gap:18,marginTop:12}}>
        {[
          {bg:'rgba(134,112,255,0.55)',label:'Profit'},
          {bg:'rgba(255,0,149,0.55)',label:'Loss'},
          {bg:'rgba(255,255,255,0.04)',label:'No trades',border:'1px solid rgba(255,255,255,0.1)'},
        ].map((x,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:6,fontSize:10,color:'#555f6e'}}>
            <div style={{width:10,height:10,borderRadius:3,background:x.bg,border:x.border}} />{x.label}
          </div>
        ))}
        <div style={{marginLeft:'auto',fontSize:10,color:'#555f6e'}}>Darker = larger magnitude</div>
      </div>
    </div>
  );
}

function DayHourHeatmap({ data }) {
  const PROFIT = '#8670ff';
  const LOSS   = '#ff0095';
  const { grid, DAYS, HOURS, minPL, maxPL, bestCell, worstCell } = data;
  const [tooltip, setTooltip] = useState(null);

  const activeHours = HOURS.filter(h => DAYS.some(d => grid[d][h].count > 0));

  function cellColor(pl, count) {
    if (count === 0) return 'rgba(255,255,255,0.03)';
    if (pl > 0) {
      const intensity = maxPL > 0 ? Math.min(pl / maxPL, 1) : 0;
      const alpha = 0.15 + intensity * 0.75;
      return `rgba(134,112,255,${alpha.toFixed(2)})`;
    } else {
      const intensity = minPL < 0 ? Math.min(Math.abs(pl) / Math.abs(minPL), 1) : 0;
      const alpha = 0.15 + intensity * 0.75;
      return `rgba(255,0,149,${alpha.toFixed(2)})`;
    }
  }

  const tradesWithTime = DAYS.reduce((s,d) => s + HOURS.reduce((s2,h) => s2 + grid[d][h].count, 0), 0);

  if (tradesWithTime === 0) {
    return (
      <div className="a-empty" style={{padding:'32px 0'}}>
        <p style={{color:'#555f6e',fontSize:13}}>No trades with entry time recorded yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:`64px repeat(${activeHours.length},1fr)`,gap:3,marginBottom:12,overflowX:'auto'}}>
        {/* Header row */}
        <div />
        {activeHours.map(h=>(
          <div key={h} style={{textAlign:'center',fontSize:9,color:'#555f6e',fontFamily:'JetBrains Mono,monospace',paddingBottom:4}}>
            {String(h).padStart(2,'0')}
          </div>
        ))}
        {/* Data rows */}
        {DAYS.map(day=>(
          <React.Fragment key={day}>
            <div style={{fontSize:10,color:'#555f6e',fontFamily:'JetBrains Mono,monospace',display:'flex',alignItems:'center',paddingRight:6}}>{day}</div>
            {activeHours.map(h=>{
              const cell = grid[day][h];
              const bg   = cellColor(cell.pl, cell.count);
              return (
                <div key={h}
                  onMouseEnter={e => setTooltip({ day, h, cell, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    height:28, borderRadius:4, background:bg, cursor:'default',
                    border:`1px solid ${cell.count>0?(cell.pl>0?'rgba(134,112,255,0.2)':'rgba(255,0,149,0.2)'):'rgba(255,255,255,0.04)'}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:8, fontFamily:'JetBrains Mono,monospace', color:'rgba(255,255,255,0.4)',
                  }}
                >
                  {cell.count > 0 ? cell.count : ''}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {tooltip && (
        <div style={{
          position:'fixed', left:tooltip.x+12, top:tooltip.y-8, zIndex:9999,
          background:'#060610', border:`1px solid ${tooltip.cell.pl>=0?'rgba(134,112,255,0.4)':'rgba(255,0,149,0.4)'}`,
          borderRadius:10, padding:'10px 14px', fontSize:11, fontFamily:'JetBrains Mono,monospace',
          pointerEvents:'none', boxShadow:'0 16px 48px rgba(0,0,0,0.9)',
        }}>
          <div style={{color:'#555f6e',marginBottom:5}}>{tooltip.day} {String(tooltip.h).padStart(2,'0')}:00</div>
          <div style={{color:tooltip.cell.pl>=0?PROFIT:LOSS,fontWeight:800,fontSize:14}}>
            {tooltip.cell.pl>=0?'+':''}{tooltip.cell.pl.toFixed(2)} P/L
          </div>
          <div style={{color:'#555f6e',marginTop:3}}>{tooltip.cell.count} trade{tooltip.cell.count!==1?'s':''}</div>
        </div>
      )}

      <div style={{display:'flex',gap:16,flexWrap:'wrap',marginTop:8}}>
        {[
          {
            label: 'BEST PATCH',
            value: bestCell ? `${bestCell.day} @ ${String(bestCell.hour).padStart(2,'0')}:00` : '—',
            sub:   bestCell ? `+$${bestCell.pl.toFixed(2)}` : '',
            color: PROFIT,
          },
          {
            label: 'TOUGHEST PATCH',
            value: worstCell ? `${worstCell.day} @ ${String(worstCell.hour).padStart(2,'0')}:00` : '—',
            sub:   worstCell ? `-$${Math.abs(worstCell.pl).toFixed(2)}` : '',
            color: LOSS,
          },
          {
            label: 'TRADES ANALYSED',
            value: String(tradesWithTime),
            sub:   'with entry time',
            color: 'var(--text-primary)',
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{
            background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
            borderRadius: 10, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 6 }}>
              {label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color }}>
              {value}
            </div>
            {sub && (
              <div style={{ fontSize: 12, color, marginTop: 2, opacity: 0.8 }}>{sub}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CALCULATION ENGINE
───────────────────────────────────────────── */

function runMonteCarlo(trades, startBal, numSims, numTrades) {
  if (!trades || trades.length < 3) return null;
  const plPool = trades.map(t => t.net_pl);
  const n      = numTrades;
  const start  = startBal > 0 ? startBal : 25000;

  const finalBals = [];
  const maxDDs    = [];
  const allPaths  = [];

  for (let s = 0; s < numSims; s++) {
    let bal   = start;
    let peak  = start;
    let maxDD = 0;
    const path = [start];
    for (let t = 0; t < n; t++) {
      const idx = Math.floor(Math.random() * plPool.length);
      bal      += plPool[idx];
      if (bal > peak) peak = bal;
      const dd = peak > 0 ? ((peak - bal) / peak) * 100 : 0;
      if (dd > maxDD) maxDD = dd;
      path.push(bal);
    }
    finalBals.push(bal);
    maxDDs.push(maxDD);
    allPaths.push(path);
  }

  const pct = (arr, p) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx    = Math.floor((p / 100) * (sorted.length - 1));
    return sorted[idx];
  };

  const step     = Math.max(1, Math.floor(n / 60));
  const bandData = [];
  for (let t = 0; t <= n; t += step) {
    const vals = allPaths.map(p => p[t] ?? p[p.length - 1]);
    bandData.push({
      t,
      p5:  +(pct(vals, 5)  - start).toFixed(2),
      p25: +(pct(vals, 25) - start).toFixed(2),
      p50: +(pct(vals, 50) - start).toFixed(2),
      p75: +(pct(vals, 75) - start).toFixed(2),
      p95: +(pct(vals, 95) - start).toFixed(2),
    });
  }
  if (bandData[bandData.length - 1]?.t !== n) {
    const vals = allPaths.map(p => p[n] ?? p[p.length - 1]);
    bandData.push({
      t:   n,
      p5:  +(pct(vals, 5)  - start).toFixed(2),
      p25: +(pct(vals, 25) - start).toFixed(2),
      p50: +(pct(vals, 50) - start).toFixed(2),
      p75: +(pct(vals, 75) - start).toFixed(2),
      p95: +(pct(vals, 95) - start).toFixed(2),
    });
  }

  const ddMin    = 0;
  const ddMax    = Math.min(Math.ceil(pct(maxDDs, 99)), 100);
  const ddBucket = Math.max((ddMax - ddMin) / 10, 1);
  const ddHist   = Array.from({ length: 10 }, (_, i) => {
    const lo  = ddMin + i * ddBucket;
    const hi  = lo + ddBucket;
    const cnt = maxDDs.filter(d => d >= lo && d < hi).length;
    return { range: `${lo.toFixed(0)}–${hi.toFixed(0)}%`, count: cnt, lo, hi };
  });

  const fbMin    = pct(finalBals, 2);
  const fbMax    = pct(finalBals, 98);
  const fbBucket = Math.max((fbMax - fbMin) / 10, 1);
  const fbHist   = Array.from({ length: 10 }, (_, i) => {
    const lo  = fbMin + i * fbBucket;
    const hi  = lo + fbBucket;
    const cnt = finalBals.filter(b => b >= lo && (i === 9 ? b <= hi : b < hi)).length;
    return {
      range:  `${lo >= 1000 ? `$${(lo/1000).toFixed(0)}k` : `$${lo.toFixed(0)}`}`,
      count:  cnt,
      profit: lo >= start,
    };
  });

  return {
    bandData, ddHist, fbHist,
    probProfit: +((finalBals.filter(b => b > start).length / numSims) * 100).toFixed(1),
    probRuin:   +((finalBals.filter(b => b < start * 0.5).length / numSims) * 100).toFixed(1),
    medFinal:   +pct(finalBals, 50).toFixed(2),
    worstCase:  +pct(finalBals, 5).toFixed(2),
    bestCase:   +pct(finalBals, 95).toFixed(2),
    medDD:      +pct(maxDDs, 50).toFixed(1),
    worstDD:    +pct(maxDDs, 95).toFixed(1),
    start, numSims, numTrades,
  };
}

function calcStats(trades) {
  const zero = {n:0,wins:0,losses:0,be:0,wr:0,pl:0,grossW:0,grossL:0,pf:0,exp:0,avgWin:0,avgLoss:0,avgR:0,rStd:0,bestR:null,worstR:null,best:0,worst:0,sharpe:0,sortino:0,calmar:0,std:0,maxDD:0};
  if (!trades.length) return zero;

  const wins   = trades.filter(t=>t.net_pl>0);
  const losses = trades.filter(t=>t.net_pl<0);
  const be     = trades.filter(t=>t.net_pl===0);
  const grossW = wins.reduce((s,t)=>s+t.net_pl,0);
  const grossL = Math.abs(losses.reduce((s,t)=>s+t.net_pl,0));
  const pl     = trades.reduce((s,t)=>s+t.net_pl,0);
  const wr     = (wins.length/trades.length)*100;
  const avgWin  = wins.length   ? grossW/wins.length   : 0;
  const avgLoss = losses.length ? grossL/losses.length : 0;
  const pf      = grossL>0 ? grossW/grossL : grossW>0 ? 9999 : 0;
  const exp     = (wr/100)*avgWin - ((100-wr)/100)*avgLoss;

  const rVals = trades.filter(t=>t.r_multiple!=null).map(t=>parseFloat(t.r_multiple));
  const avgR  = rVals.length ? rVals.reduce((s,r)=>s+r,0)/rVals.length : 0;
  const bestR  = rVals.length ? Math.max(...rVals) : null;
  const worstR = rVals.length ? Math.min(...rVals) : null;
  const rStd   = rVals.length>1 ? Math.sqrt(rVals.reduce((s,r)=>s+(r-avgR)**2,0)/(rVals.length-1)) : 0;

  const returns = trades.map(t=>t.net_pl);
  const mean    = pl/trades.length;
  const std     = returns.length>1 ? Math.sqrt(returns.reduce((s,r)=>s+(r-mean)**2,0)/(returns.length-1)) : 0;
  const sharpe  = std>0 ? (mean/std)*Math.sqrt(252) : 0;

  const downside = losses.map(t=>t.net_pl);
  const dsStd    = downside.length>1 ? Math.sqrt(downside.reduce((s,r)=>s+r**2,0)/downside.length) : 0;
  const sortino  = dsStd>0 ? (mean/dsStd)*Math.sqrt(252) : 0;

  const sorted = [...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
  let cumPL=0,peak=0,maxDD=0;
  sorted.forEach(t=>{
    cumPL+=t.net_pl;
    if(cumPL>peak)peak=cumPL;
    const dd=peak-cumPL;
    if(dd>maxDD)maxDD=dd;
  });
  const calmar = maxDD>0 ? pl/maxDD : pl>0 ? 9999 : 0;

  return {
    n:trades.length, wins:wins.length, losses:losses.length, be:be.length,
    wr, pl, grossW, grossL, pf, exp,
    avgWin, avgLoss, avgR, rStd, bestR, worstR,
    best:  returns.length ? Math.max(...returns) : 0,
    worst: returns.length ? Math.min(...returns) : 0,
    sharpe, sortino, calmar, std, maxDD,
  };
}

function buildEquity(trades, startingBalance = 0) {
  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  const dateMap = {};
  const dateOrder = [];
  sorted.forEach(t => {
    if (!dateMap[t.date]) { dateMap[t.date] = 0; dateOrder.push(t.date); }
    dateMap[t.date] += t.net_pl;
  });
  let c = startingBalance;
  const result = [{ l: 'Start', eq: +c.toFixed(2) }];
  dateOrder.forEach(date => {
    c += dateMap[date];
    result.push({ l: fmtD(date), eq: +c.toFixed(2) });
  });
  return result;
}

function buildDrawdown(trades, startingBalance = 0) {
  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  const dateMap = {};
  const dateOrder = [];
  sorted.forEach(t => {
    if (!dateMap[t.date]) { dateMap[t.date] = 0; dateOrder.push(t.date); }
    dateMap[t.date] += t.net_pl;
  });
  let c = startingBalance, peak = startingBalance;
  return dateOrder.map(date => {
    c += dateMap[date];
    if (c > peak) peak = c;
    return { l: fmtD(date), dd: +((-(peak - c)).toFixed(2)) };
  });
}

function buildMonthly(trades) {
  const sorted=[...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const keys=[];
  const m={};
  sorted.forEach(t=>{
    const k=new Date(t.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',year:'2-digit'});
    if(!m[k]){m[k]=0;keys.push(k);}
    m[k]+=t.net_pl;
  });
  let cum=0;
  return keys.map(month=>{const pl=m[month];cum+=pl;return{m:month,pl:+pl.toFixed(2),cumPL:+cum.toFixed(2)};});
}

function buildDow(trades) {
  const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const data=DAYS.map(d=>({d,sum:0,n:0}));
  trades.forEach(t=>{const i=new Date(t.date+'T00:00:00').getDay();data[i].sum+=t.net_pl;data[i].n++;});
  return data.map(({d,sum,n})=>({d,avg:n>0?+(sum/n).toFixed(2):0,n}));
}

function buildRDist(trades) {
  const B = [
    { range: '< -2R',  min: -Infinity, max: -2,  pos: false, count: 0 },
    { range: '-1R',    min: -2,        max: 0,   pos: false, count: 0 },
    { range: '0–1R',   min: 0,         max: 1,   pos: true,  count: 0 },
    { range: '1–3R',   min: 1,         max: 3,   pos: true,  count: 0 },
    { range: '4–7R',   min: 3,         max: 7,   pos: true,  count: 0 },
    { range: '8–10R',  min: 7,         max: 10,  pos: true,  count: 0 },
    { range: '> 10R',  min: 10,        max: Infinity, pos: true, count: 0 },
  ];
  trades.forEach(t => {
    const r = parseFloat(t.r_multiple);
    if (isNaN(r)) return;
    for (const b of B) { if (r > b.min && r <= b.max) { b.count++; break; } }
  });
  return B;
}

function buildPairs(trades) {
  const m={};
  trades.forEach(t=>{if(!m[t.pair])m[t.pair]=[];m[t.pair].push(t);});
  return Object.entries(m).map(([pair,ts])=>{
    const wins=ts.filter(t=>t.net_pl>0),losses=ts.filter(t=>t.net_pl<0);
    const gW=wins.reduce((s,t)=>s+t.net_pl,0),gL=Math.abs(losses.reduce((s,t)=>s+t.net_pl,0));
    const rTs=ts.filter(t=>t.r_multiple!=null);
    return{
      pair,n:ts.length,
      wr:(wins.length/ts.length)*100,
      pl:+ts.reduce((s,t)=>s+t.net_pl,0).toFixed(2),
      avgWin:wins.length?gW/wins.length:0,
      avgLoss:losses.length?gL/losses.length:0,
      pf:gL>0?gW/gL:gW>0?9999:0,
      avgR:rTs.length?rTs.reduce((s,t)=>s+parseFloat(t.r_multiple),0)/rTs.length:null,
    };
  }).sort((a,b)=>b.pl-a.pl);
}

function buildRollingWR(trades,w=10) {
  const s=[...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
  return s.slice(w-1).map((_,i)=>{
    const slice=s.slice(i,i+w);
    return{i:i+w,wr:+(slice.filter(t=>t.net_pl>0).length/w*100).toFixed(1)};
  });
}

function buildRollingEx(trades,w=10) {
  const s=[...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
  return s.slice(w-1).map((_,i)=>{
    const sl=s.slice(i,i+w);
    const ws=sl.filter(t=>t.net_pl>0),ls=sl.filter(t=>t.net_pl<0);
    const wr=ws.length/sl.length;
    const aW=ws.length?ws.reduce((s,t)=>s+t.net_pl,0)/ws.length:0;
    const aL=ls.length?Math.abs(ls.reduce((s,t)=>s+t.net_pl,0))/ls.length:0;
    return{i:i+w,ex:+(wr*aW-(1-wr)*aL).toFixed(2)};
  });
}

function buildStreaks(trades) {
  const s=[...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
  let bW=0,bL=0,cW=0,cL=0;
  const allW=[],allL=[];
  s.forEach(t=>{
    if(t.net_pl>0){
      cW++;if(cL>0){allL.push(cL);cL=0;}if(cW>bW)bW=cW;
    } else {
      if(cW>0){allW.push(cW);cW=0;}
      if(t.net_pl<0){cL++;if(cL>bL)bL=cL;}
      else{if(cL>0){allL.push(cL);cL=0;}}
    }
  });
  if(cW>0)allW.push(cW);if(cL>0)allL.push(cL);
  const avgWin=allW.length?allW.reduce((a,b)=>a+b,0)/allW.length:0;
  const avgLoss=allL.length?allL.reduce((a,b)=>a+b,0)/allL.length:0;
  return{bestWin:bW,worstLoss:bL,avgWin,avgLoss};
}

function buildLS(trades) {
  return['Long','Short'].map(dir=>{
    const ts=trades.filter(t=>t.direction===dir);
    const ws=ts.filter(t=>t.net_pl>0),ls=ts.filter(t=>t.net_pl<0);
    const pl=ts.reduce((s,t)=>s+t.net_pl,0);
    const gW=ws.reduce((s,t)=>s+t.net_pl,0),gL=Math.abs(ls.reduce((s,t)=>s+t.net_pl,0));
    return{
      dir,n:ts.length,
      wr:ts.length?(ws.length/ts.length)*100:0,
      pl:+pl.toFixed(2),
      avg:ts.length?+(pl/ts.length).toFixed(2):0,
      avgWin:ws.length?+(gW/ws.length).toFixed(2):0,
      avgLoss:ls.length?+(gL/ls.length).toFixed(2):0,
      pf:gL>0?gW/gL:gW>0?9999:0,
    };
  });
}

function buildHeatmap(trades, days=90) {
  const end=new Date(), start=new Date();
  start.setDate(end.getDate()-(days-1));
  const dMap={};
  trades.forEach(t=>{dMap[t.date]=(dMap[t.date]||0)+t.net_pl;});
  const result=[];
  const startDay=start.getDay();
  for(let p=0;p<startDay;p++) result.push({date:null,pl:null});
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    result.push({date:k,pl:dMap[k]!=null?+dMap[k].toFixed(2):null});
  }
  return result;
}

function buildGrades(trades) {
  const GRADES=['A+','A','B','C','F'];
  const COLORS=[C.profit,C.green,C.blue,C.warn,C.loss];
  const m={};
  trades.forEach(t=>{const g=t.trade_grade||'—';if(!m[g])m[g]=[];m[g].push(t.net_pl);});
  return GRADES.map((g,i)=>{
    const pls=m[g]||[];
    const avg=pls.length?pls.reduce((s,v)=>s+v,0)/pls.length:0;
    return{grade:g,count:pls.length,avgPL:+avg.toFixed(2),color:COLORS[i]};
  });
}

function enrichModels(models) {
  return models.map(m => {
    const wins  = m.wins        || 0;
    const total = m.total_trades || 1;
    const gW    = m.total_wins   || 0;
    const gL    = Math.abs(m.total_losses || 0);
    const pl    = m.total_pl     || 0;
    const wr    = (wins / total) * 100;
    const pf    = gL > 0 ? gW / gL : gW > 0 ? 9999 : 0;
    const lossCount = total - wins;
    const aW  = wins      > 0 ? gW / wins      : 0;
    const aL  = lossCount > 0 ? gL / lossCount : 0;
    const exp = (wr / 100) * aW - ((100 - wr) / 100) * aL;
    return {
      ...m,
      winRate:      wr,
      profitFactor: pf,
      avgR:         m.avg_r != null ? parseFloat(m.avg_r) : null,
      expectancy:   +exp.toFixed(2),
      totalPL:      +pl,
    };
  });
}

function buildScore(S) {
  if(!S||S.n===0) return[{m:'Win Rate',s:0},{m:'Profit Factor',s:0},{m:'Expectancy',s:0},{m:'Sharpe',s:0},{m:'Consistency',s:0},{m:'Payoff',s:0}];
  const norm=(v,min,max)=>Math.min(Math.max(((v-min)/(max-min))*100,0),100);
  const avgPL=S.pl/S.n;
  const consistency=avgPL>0&&S.std>0
    ? Math.max(1-S.std/avgPL,0)*100
    : avgPL>0&&S.std===0 ? 100 : 0;
  return[
    {m:'Win Rate',      s:+norm(S.wr,20,85).toFixed(1)},
    {m:'Profit Factor', s:+norm(S.pf,0.5,3).toFixed(1)},
    {m:'Expectancy',    s:+norm(S.exp,-300,500).toFixed(1)},
    {m:'Sharpe',        s:+norm(S.sharpe,-2,3).toFixed(1)},
    {m:'Consistency',   s:+norm(consistency,0,100).toFixed(1)},
    {m:'Payoff',        s:+norm(S.avgLoss>0?S.avgWin/S.avgLoss:1,0.5,4).toFixed(1)},
  ];
}

function buildDayHourHeatmap(trades) {
  const DAYS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const grid  = {};
  DAYS.forEach(d => {
    grid[d] = {};
    HOURS.forEach(h => { grid[d][h] = { pl: 0, count: 0 }; });
  });
  const dayMap = { 0:'Sun',1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat' };
  trades.forEach(t => {
    if (!t.entry_time) return;
    const d    = new Date(t.date + 'T00:00:00');
    const day  = dayMap[d.getDay()];
    const hour = parseInt(t.entry_time.split(':')[0]);
    if (!isNaN(hour) && grid[day]) {
      grid[day][hour].pl    += t.net_pl;
      grid[day][hour].count += 1;
    }
  });
  let minPL = 0, maxPL = 0;
  DAYS.forEach(d => HOURS.forEach(h => {
    const v = grid[d][h].pl;
    if (v < minPL) minPL = v;
    if (v > maxPL) maxPL = v;
  }));
  let bestCell = null, worstCell = null;
  DAYS.forEach(d => HOURS.forEach(h => {
    const cell = grid[d][h];
    if (cell.count === 0) return;
    if (!bestCell  || cell.pl > bestCell.pl)  bestCell  = { day:d, hour:h, ...cell };
    if (!worstCell || cell.pl < worstCell.pl) worstCell = { day:d, hour:h, ...cell };
  }));
  return { grid, DAYS, HOURS, minPL, maxPL, bestCell, worstCell };
}

function buildViolations(trades) {
  const sorted   = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  const violated = sorted.filter(t => t.rule_violation);
  const clean    = sorted.filter(t => !t.rule_violation);
  const avg      = arr => arr.length ? arr.reduce((s, t) => s + t.net_pl, 0) / arr.length : null;
  const wr       = arr => arr.length ? (arr.filter(t => t.net_pl > 0).length / arr.length) * 100 : 0;
  const avgViol  = avg(violated);
  const avgClean = avg(clean);
  const hiddenCost = violated.reduce((s, t) => s + t.net_pl, 0);
  const rollingViol = sorted.map((_, i, arr) => {
    if (i < 9) return null;
    const window = arr.slice(i - 9, i + 1);
    const vr = (window.filter(t => t.rule_violation).length / 10) * 100;
    return { l: fmtD(arr[i].date), vr: +vr.toFixed(1) };
  }).filter(Boolean);
  const tagMap = {};
  violated.forEach(t => {
    if (t.mistake_tag) tagMap[t.mistake_tag] = (tagMap[t.mistake_tag] || 0) + 1;
  });
  const mistakeTags = Object.entries(tagMap)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  return {
    totalCount:    sorted.length,
    vCount:        violated.length,
    violationPct:  sorted.length ? (violated.length / sorted.length) * 100 : 0,
    avgViol, avgClean, hiddenCost,
    cleanWR:       wr(clean),
    violWR:        wr(violated),
    rollingViol, mistakeTags,
    violatedTrades: violated.slice().reverse(),
  };
}

function fmtD(date) {
  return new Date(date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
}