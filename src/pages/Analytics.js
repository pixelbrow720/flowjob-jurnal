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
  const S         = useMemo(() => calcStats(trades),        [trades]);
  const equity    = useMemo(() => buildEquity(trades),      [trades]);
  const dd        = useMemo(() => buildDrawdown(trades),    [trades]);
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
  const selAcc    = accounts.find(a => a.id === parseInt(filters.accountId));

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
          <AStat label="Calmar Ratio"  value={S.calmar>=999?'∞':S.calmar.toFixed(2)}                         col={S.calmar>=1?'col-profit':'col-warn'} desc="Net P/L ÷ Max drawdown" />
          <AStat label="Payoff Ratio"  value={S.avgLoss>0?(S.avgWin/S.avgLoss).toFixed(2):'∞'}               col={S.avgWin>=S.avgLoss?'col-profit':'col-warn'} desc="Avg win ÷ avg loss" />
          <AStat label="Std Deviation" value={`$${S.std.toFixed(2)}`}                                         col="col-base"   desc="Per-trade P/L volatility" />
          <AStat label="Best Streak"   value={`${streaks.bestWin}W`}                                          col="col-profit" sub={`Avg win streak: ${streaks.avgWin.toFixed(1)}`} />
          <AStat label="Worst Streak"  value={`${streaks.worstLoss}L`}                                        col="col-loss"   sub={`Current: ${streaks.current>0?`${streaks.current}W`:streaks.current<0?`${Math.abs(streaks.current)}L`:'—'}`} />
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
                <Tooltip content={<Tip fmt={fmtMoney} />} cursor={{stroke:'#2a2a3a',strokeWidth:1}} />
                <ReferenceLine y={0} stroke="#2a2a3a" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="eq" stroke="none" fill="url(#gProfit)" dot={false} activeDot={false} />
                <Line type="monotone" dataKey="eq" stroke={C.profit} strokeWidth={2.5}
                  dot={false} activeDot={{r:5,fill:C.profit,stroke:'#000',strokeWidth:2}} />
              </ComposedChart>
            </ResponsiveContainer>
          </AChart>
        </div>

        <div className="a-grid-2">
          <AChart title="Drawdown from Peak" dot={C.loss} h={200}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dd} margin={MAR}>
                <SvgDefs />
                <CartesianGrid {...GRID_P} />
                <XAxis dataKey="l" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={v=>`-$${Math.abs(v)>=1000?(Math.abs(v)/1000).toFixed(1)+'k':Math.abs(v).toFixed(0)}`} />
                <Tooltip content={<Tip fmt={v=>`-$${Math.abs(v).toFixed(2)}`} color={C.loss} />} cursor={{stroke:'#2a2a3a',strokeWidth:1}} />
                <Area type="monotone" dataKey="dd" stroke={C.loss} strokeWidth={2} fill="url(#gLoss)"
                  dot={false} activeDot={{r:4,fill:C.loss,stroke:'#000',strokeWidth:2}} />
              </AreaChart>
            </ResponsiveContainer>
          </AChart>

          <AChart title="Per-Trade P/L Bar" dot={C.blue} h={200}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sorted.map((t,i)=>({l:fmtD(t.date),pl:+t.net_pl.toFixed(2)}))} margin={MAR} barCategoryGap="15%">
                <CartesianGrid {...GRID_P} />
                <XAxis dataKey="l" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={v=>`$${v>=0?'':'-'}${Math.abs(v).toFixed(0)}`} />
                <Tooltip content={<Tip fmt={fmtMoney} />} cursor={{fill:'rgba(255,255,255,0.02)'}} />
                <ReferenceLine y={0} stroke="#2a2a3a" />
                <Bar dataKey="pl" radius={[3,3,0,0]} maxBarSize={10}>
                  {sorted.map((t,i)=><Cell key={i} fill={t.net_pl>=0?C.profit:C.loss} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </AChart>
        </div>
      </div>

      {/* ══ 5. ROLLING METRICS ══ */}
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
                  <td className={`mono ${p.pf>=1.5?'col-profit':p.pf>=1?'col-warn':'col-loss'}`}>{p.pf.toFixed(2)}</td>
                  <td className="mono col-profit">+${p.avgWin.toFixed(2)}</td>
                  <td className="mono col-loss">-${p.avgLoss.toFixed(2)}</td>
                  <td className="mono">{p.avgLoss>0?(p.avgWin/p.avgLoss).toFixed(2):'∞'}</td>
                  <td className={`mono ${p.pl>=0?'col-profit':'col-loss'}`}>{fmtMoney(p.pl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ 9. LONG vs SHORT ══ */}
      <div className="a-section">
        <ASection title="Long vs Short" sub="Are you better buying dips or fading rallies?" />
        <div className="a-grid-2">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {ls.map((d,di)=>[
              <AStat key={`${d.dir}-wr`}  label={`${d.dir} Win Rate`} value={fmtPct(d.wr)}   col={d.wr>=50?'col-profit':'col-loss'} sub={`${d.n} trades`} pct={d.wr} pctCol={d.wr>=50?C.profit:C.loss} />,
              <AStat key={`${d.dir}-pl`}  label={`${d.dir} P/L`}      value={fmtMoney(d.pl)}  col={d.pl>=0?'col-profit':'col-loss'} sub={`Avg: ${fmtMoney(d.avg)}`} />,
            ])}
          </div>

          <AChart title="Long vs Short — Side by Side" dot={C.blue} h={200}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  {m:'Win Rate', Long:ls[0].wr,            Short:ls[1].wr},
                  {m:'Avg Win',  Long:ls[0].avgWin/10,     Short:ls[1].avgWin/10},
                  {m:'Avg Loss', Long:ls[0].avgLoss/10,    Short:ls[1].avgLoss/10},
                  {m:'PF×25',    Long:Math.min(ls[0].pf*25,100), Short:Math.min(ls[1].pf*25,100)},
                ]}
                margin={{...MAR,left:8}} barCategoryGap="22%">
                <CartesianGrid {...GRID_P} />
                <XAxis dataKey="m" tick={TICK} tickLine={false} axisLine={false} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{background:'#060610',border:'1px solid #2a2a3a',borderRadius:10,fontSize:12}} itemStyle={{color:'#e8edf3'}} />
                <Bar dataKey="Long"  fill={C.profit} fillOpacity={0.85} radius={[4,4,0,0]} maxBarSize={32} />
                <Bar dataKey="Short" fill={C.blue}   fillOpacity={0.85} radius={[4,4,0,0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </AChart>
        </div>
      </div>

      {/* ══ 10. MODEL PERFORMANCE ══ */}
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
              <thead><tr><th>Model</th><th>Trades</th><th>Win Rate</th><th>P. Factor</th><th>Avg R</th><th>Expectancy</th><th>Net P/L</th></tr></thead>
              <tbody>
                {mperf.map(m=>(
                  <tr key={m.id}>
                    <td style={{fontWeight:700,color:'var(--text-primary)'}}>{m.name}</td>
                    <td className="mono">{m.total_trades}</td>
                    <td className={`mono ${m.winRate>=50?'col-profit':'col-loss'}`}>{m.winRate.toFixed(1)}%</td>
                    <td className={`mono ${m.profitFactor>=1.5?'col-profit':m.profitFactor>=1?'col-warn':'col-loss'}`}>{m.profitFactor.toFixed(2)}</td>
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

      {/* ══ 11. TRADE GRADES ══ */}
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
                <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={v=>`${v>=0?'+':''}$${Math.abs(v).toFixed(0)}`} />
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

      {/* ══ 12. TIME ANALYSIS ══ */}
      <div className="a-section">
        <ASection title="Time-Based Performance" />
        <div className="a-grid-2" style={{marginBottom:16}}>
          <AChart title="Monthly P/L + Cumulative (dashed)" dot={C.profit} h={240}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly} margin={MAR} barCategoryGap="30%">
                <SvgDefs />
                <CartesianGrid {...GRID_P} />
                <XAxis dataKey="m" tick={TICK} tickLine={false} axisLine={false} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={fmtK} />
                <Tooltip content={<Tip fmt={fmtMoney} />} cursor={{fill:'rgba(255,255,255,0.02)'}} />
                <ReferenceLine y={0} stroke="#2a2a3a" />
                <Bar dataKey="pl" radius={[6,6,0,0]} maxBarSize={48}>
                  {monthly.map((e,i)=><Cell key={i} fill={e.pl>=0?C.profit:C.loss} fillOpacity={0.9} />)}
                </Bar>
                <Line type="monotone" dataKey="cumPL" stroke={C.blue} strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </AChart>

          <AChart title="Day of Week — Average P/L" dot={C.warn} h={240}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dow} margin={MAR} barCategoryGap="26%">
                <CartesianGrid {...GRID_P} />
                <XAxis dataKey="d" tick={TICK} tickLine={false} axisLine={false} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={v=>`${v<0?'-':''}$${Math.abs(v).toFixed(0)}`} />
                <Tooltip content={<Tip fmt={fmtMoney} />} cursor={{fill:'rgba(255,255,255,0.02)'}} />
                <ReferenceLine y={0} stroke="#2a2a3a" />
                <Bar dataKey="avg" radius={[6,6,0,0]} maxBarSize={52}>
                  {dow.map((e,i)=><Cell key={i} fill={e.avg>=0?C.profit:C.loss} fillOpacity={0.9} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </AChart>
        </div>

        <AChart title="Daily P/L Heatmap — Last 90 Days" dot={C.blue} h="auto">
          <HeatmapGrid data={heatmap} />
        </AChart>
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
          <div key={i} title={`#${i+1} · ${t.pair||''} · ${t.net_pl>=0?'+':''}$${t.net_pl.toFixed(2)}`}
            style={{width:16,height:h,borderRadius:'3px 3px 2px 2px',background:col,opacity:0.82,
              flexShrink:0,cursor:'default',boxShadow:`0 0 4px ${col}44`}} />
        );
      })}
      <div style={{fontSize:10,color:'#4a5568',marginLeft:'auto',alignSelf:'flex-end',paddingBottom:2,whiteSpace:'nowrap'}}>
        ← older · newer →
      </div>
    </div>
  );
}

function HeatmapGrid({ data }) {
  return (
    <div>
      <div style={{display:'flex',gap:4,marginBottom:6}}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>(
          <div key={d} style={{width:32,textAlign:'center',fontSize:9,color:'#555f6e',fontWeight:700}}>{d}</div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,32px)',gap:3}}>
        {data.map((d,i)=>{
          if (!d.date) return <div key={i} />;
          const hasPL  = d.pl !== null && d.pl !== 0;
          const maxAbs = 1;
          let bg = 'rgba(255,255,255,0.025)';
          if (hasPL) {
            const op = Math.min(0.18 + Math.abs(d.pl) / 1000 * 0.5, 0.85);
            bg = d.pl>0 ? `rgba(134,112,255,${op})` : `rgba(255,0,149,${op})`;
          }
          const day = new Date(d.date+'T00:00:00');
          return (
            <div key={i}
              title={`${d.date}: ${d.pl!==null ? `${d.pl>=0?'+':''}$${d.pl.toFixed(2)}` : 'No trades'}`}
              style={{
                width:32,height:32,borderRadius:5,cursor:'default',
                background:bg,
                border:`1px solid ${hasPL?(d.pl>0?'rgba(134,112,255,0.22)':'rgba(255,0,149,0.22)'):'rgba(255,255,255,0.04)'}`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:9,color:'rgba(255,255,255,0.35)',fontFamily:'JetBrains Mono,monospace',
                transition:'opacity 0.15s',
              }}>
              {day.getDate()}
            </div>
          );
        })}
      </div>
      <div style={{display:'flex',gap:18,marginTop:12}}>
        {[{bg:'rgba(134,112,255,0.55)',label:'Profit'},{bg:'rgba(255,0,149,0.55)',label:'Loss'},{bg:'rgba(255,255,255,0.04)',label:'No trades',border:'1px solid rgba(255,255,255,0.1)'}].map((x,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:6,fontSize:10,color:'#555f6e'}}>
            <div style={{width:10,height:10,borderRadius:3,background:x.bg,border:x.border}} />{x.label}
          </div>
        ))}
        <div style={{marginLeft:'auto',fontSize:10,color:'#555f6e'}}>Darker = larger magnitude</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CALCULATION ENGINE
───────────────────────────────────────────── */

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

  // Expectancy = (WR × avgWin) - (LossRate × avgLoss)
  const exp = (wr/100)*avgWin - ((100-wr)/100)*avgLoss;

  // R-multiple stats
  const rVals = trades.filter(t=>t.r_multiple!=null).map(t=>parseFloat(t.r_multiple));
  const avgR  = rVals.length ? rVals.reduce((s,r)=>s+r,0)/rVals.length : 0;
  const bestR  = rVals.length ? Math.max(...rVals) : null;
  const worstR = rVals.length ? Math.min(...rVals) : null;
  const rStd   = rVals.length>1 ? Math.sqrt(rVals.reduce((s,r)=>s+Math.pow(r-avgR,2),0)/rVals.length) : 0;

  // P/L stats
  const returns = trades.map(t=>t.net_pl);
  const avgRet  = pl/trades.length;
  const std     = trades.length>1 ? Math.sqrt(returns.reduce((s,r)=>s+Math.pow(r-avgRet,2),0)/returns.length) : 0;

  // Sharpe: (avgReturn / stdDev) × sqrt(252)
  const sharpe  = std>0 ? (avgRet/std)*Math.sqrt(252) : 0;

  // Sortino: downside deviation = sqrt(mean of squared negative returns)
  const negRets = returns.filter(r=>r<0);
  const downDev = negRets.length>0 ? Math.sqrt(negRets.reduce((s,r)=>s+r*r,0)/negRets.length) : std;
  const sortino = downDev>0 ? (avgRet/downDev)*Math.sqrt(252) : 0;

  // Max drawdown: largest peak-to-trough of cumulative P/L (chronological)
  const sorted = [...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
  let cum=0,peak=0,maxDD=0;
  sorted.forEach(t=>{cum+=t.net_pl;if(cum>peak)peak=cum;const d=peak-cum;if(d>maxDD)maxDD=d;});

  // Calmar: net P/L / max drawdown
  const calmar = maxDD>0 ? pl/maxDD : pl>0 ? 9999 : 0;

  return {
    n:trades.length, wins:wins.length, losses:losses.length, be:be.length,
    wr, pl, grossW, grossL, pf, exp,
    avgWin, avgLoss, avgR, rStd, bestR, worstR,
    best:  returns.length?Math.max(...returns):0,
    worst: returns.length?Math.min(...returns):0,
    sharpe, sortino, calmar, std, maxDD,
  };
}

function buildEquity(trades) {
  let c=0;
  return [...trades].sort((a,b)=>new Date(a.date)-new Date(b.date)).map((t,i)=>{c+=t.net_pl;return{l:fmtD(t.date),eq:+c.toFixed(2)};});
}

function buildDrawdown(trades) {
  let c=0,peak=0;
  return [...trades].sort((a,b)=>new Date(a.date)-new Date(b.date)).map(t=>{
    c+=t.net_pl;if(c>peak)peak=c;return{l:fmtD(t.date),dd:+((-(peak-c)).toFixed(2))};
  });
}

function buildMonthly(trades) {
  const m={};
  trades.forEach(t=>{
    const k=new Date(t.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',year:'2-digit'});
    m[k]=(m[k]||0)+t.net_pl;
  });
  let cum=0;
  return Object.entries(m).map(([month,pl])=>{cum+=pl;return{m:month,pl:+pl.toFixed(2),cumPL:+cum.toFixed(2)};});
}

function buildDow(trades) {
  const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const data=DAYS.map(d=>({d,sum:0,n:0}));
  trades.forEach(t=>{const i=new Date(t.date+'T00:00:00').getDay();data[i].sum+=t.net_pl;data[i].n++;});
  return data.map(({d,sum,n})=>({d,avg:n>0?+(sum/n).toFixed(2):0,n}));
}

function buildRDist(trades) {
  const B=[
    {range:'< -2R',min:-Infinity,max:-2,pos:false,count:0},
    {range:'-2 to -1R',min:-2,max:-1,pos:false,count:0},
    {range:'-1 to 0R',min:-1,max:0,pos:false,count:0},
    {range:'0 to 1R',min:0,max:1,pos:true,count:0},
    {range:'1 to 2R',min:1,max:2,pos:true,count:0},
    {range:'2 to 3R',min:2,max:3,pos:true,count:0},
    {range:'> 3R',min:3,max:Infinity,pos:true,count:0},
  ];
  trades.forEach(t=>{
    const r=parseFloat(t.r_multiple);
    if(isNaN(r))return;
    for(const b of B){if(r>b.min&&r<=b.max){b.count++;break;}}
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
    if(t.net_pl>0){cW++;if(cL>0){allL.push(cL);cL=0;}if(cW>bW)bW=cW;}
    else if(t.net_pl<0){cL++;if(cW>0){allW.push(cW);cW=0;}if(cL>bL)bL=cL;}
  });
  if(cW>0)allW.push(cW);if(cL>0)allL.push(cL);
  const avgWin=allW.length?allW.reduce((a,b)=>a+b,0)/allW.length:0;
  const avgLoss=allL.length?allL.reduce((a,b)=>a+b,0)/allL.length:0;
  let current=0;
  for(let i=s.length-1;i>=0;i--){
    const isW=s[i].net_pl>0;
    if(i===s.length-1){current=isW?1:-1;}
    else{const cont=(current>0&&isW)||(current<0&&!isW);if(cont)current=current>0?current+1:current-1;else break;}
  }
  return{bestWin:bW,worstLoss:bL,avgWin,avgLoss,current};
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

function buildHeatmap(trades,days=90) {
  const end=new Date(),start=new Date();
  start.setDate(end.getDate()-(days-1));
  const dMap={};
  trades.forEach(t=>{dMap[t.date]=(dMap[t.date]||0)+t.net_pl;});
  const result=[];
  const startDay=start.getDay();
  for(let p=0;p<startDay;p++) result.push({date:null,pl:null});
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
    const k=d.toISOString().split('T')[0];
    result.push({date:k,pl:dMap[k]??null});
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
  return models.map(m=>{
    const wins=m.winning_trades||0,total=m.total_trades||1;
    const gW=m.gross_profit||0,gL=Math.abs(m.gross_loss||0);
    const pl=(m.total_pl||0);
    const wr=(wins/total)*100;
    const pf=gL>0?gW/gL:gW>0?9999:0;
    const aW=wins>0?gW/wins:0,aL=(total-wins)>0?gL/(total-wins):0;
    const exp=(wr/100)*aW-((100-wr)/100)*aL;
    return{...m,winRate:wr,profitFactor:pf,avgR:m.avg_r!=null?parseFloat(m.avg_r):null,expectancy:+exp.toFixed(2),totalPL:+pl};
  });
}

function buildScore(S) {
  if(!S||S.n===0) return[{m:'Win Rate',s:0},{m:'Profit Factor',s:0},{m:'Expectancy',s:0},{m:'Sharpe',s:0},{m:'Consistency',s:0},{m:'Payoff',s:0}];
  const norm=(v,min,max)=>Math.min(Math.max(((v-min)/(max-min))*100,0),100);
  return[
    {m:'Win Rate',      s:+norm(S.wr,20,85).toFixed(1)},
    {m:'Profit Factor', s:+norm(S.pf,0.5,3).toFixed(1)},
    {m:'Expectancy',    s:+norm(S.exp,-300,500).toFixed(1)},
    {m:'Sharpe',        s:+norm(S.sharpe,-2,3).toFixed(1)},
    {m:'Consistency',   s:+norm(S.std>0?Math.max(1-S.std/(Math.abs(S.pl/S.n)||1),0)*100:50,0,100).toFixed(1)},
    {m:'Payoff',        s:+norm(S.avgLoss>0?S.avgWin/S.avgLoss:1,0.5,4).toFixed(1)},
  ];
}

function fmtD(date) {
  return new Date(date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
}