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
  const dayHourData = useMemo(() => buildDayHourHeatmap(trades), [trades]);
  const selAcc    = accounts.find(a => a.id === parseInt(filters.accountId));
  const violations = useMemo(() => buildViolations(trades), [trades]);

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
                  {m:'Win Rate %', Long:+ls[0].wr.toFixed(1),     Short:+ls[1].wr.toFixed(1)},
                  {m:'PF Score',   Long:+Math.min(ls[0].pf/3*100,100).toFixed(1), Short:+Math.min(ls[1].pf/3*100,100).toFixed(1)},
                  {m:'Payoff×20',  Long:+Math.min(ls[0].avgLoss>0?(ls[0].avgWin/ls[0].avgLoss)*20:100,100).toFixed(1),
                                   Short:+Math.min(ls[1].avgLoss>0?(ls[1].avgWin/ls[1].avgLoss)*20:100,100).toFixed(1)},
                ]}
                margin={{...MAR,left:8}} barCategoryGap="22%">
                <CartesianGrid {...GRID_P} />
                <XAxis dataKey="m" tick={TICK} tickLine={false} axisLine={false} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} domain={[0,100]} tickFormatter={v=>`${v}`} />
                <Tooltip contentStyle={{background:'#060610',border:'1px solid #2a2a3a',borderRadius:10,fontSize:12}} itemStyle={{color:'#e8edf3'}} cursor={{fill:'rgba(255,255,255,0.02)'}} />
                <ReferenceLine y={50} stroke="#2a2a3a" strokeDasharray="4 4" />
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

      {/* ══ 13. RULE VIOLATION TRACKER ══ */}
      <div className="a-section">
        <ASection
          title="Rule Violation Tracker"
          sub="Trades where you broke your own rules — the real cost of indiscipline"
        />

        {/* Top KPI row */}
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

            {/* Chart 1: Clean vs Violated Avg P/L comparison */}
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
                  <YAxis tick={TICK} tickLine={false} axisLine={false} tickFormatter={v=>`${v>=0?'+':''}$${Math.abs(v).toFixed(0)}`} />
                  <Tooltip content={<Tip fmt={fmtMoney} />} cursor={{fill:'rgba(255,255,255,0.02)'}} />
                  <ReferenceLine y={0} stroke="#2a2a3a" />
                  <Bar dataKey="val" radius={[8,8,0,0]} maxBarSize={80}>
                    <Cell fill={violations.avgClean >= 0 ? C.profit : C.loss} fillOpacity={0.9} />
                    <Cell fill={C.loss} fillOpacity={0.9} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AChart>

            {/* Chart 2: Win Rate comparison */}
            <AChart title="Clean vs. Violated — Win Rate %" dot={C.warn} h={240}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { label: 'Clean', val: violations.cleanWR || 0 },
                    { label: 'Violated', val: violations.violWR || 0 },
                  ]}
                  margin={MAR}
                  barCategoryGap="35%"
                >
                  <CartesianGrid {...GRID_P} />
                  <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} />
                  <YAxis tick={TICK} tickLine={false} axisLine={false} domain={[0,100]} tickFormatter={v=>`${v}%`} />
                  <Tooltip content={<Tip fmt={v=>`${v.toFixed(1)}%`} color={C.warn} />} cursor={{fill:'rgba(255,255,255,0.02)'}} />
                  <Bar dataKey="val" radius={[8,8,0,0]} maxBarSize={80}>
                    <Cell fill={C.profit} fillOpacity={0.9} />
                    <Cell fill={C.warn} fillOpacity={0.85} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AChart>

            {/* Chart 3: Rolling violation frequency */}
            <AChart title="Violation Frequency — Rolling 10 Trades" dot={C.loss} h={220}>
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

            {/* Chart 4: Mistake tag breakdown */}
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

        {/* Violation log table */}
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
                      <td style={{ padding:'7px 12px', color: t.direction==='long'?C.profit:C.loss, fontWeight:700, textTransform:'uppercase', fontSize:10 }}>{t.direction || '—'}</td>
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
  // Dynamic scale: find max absolute P/L in this period for opacity normalization
  const maxAbs=Math.max(...data.map(d=>d.pl!=null?Math.abs(d.pl):0),1);
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
          let bg = 'rgba(255,255,255,0.025)';
          if (hasPL) {
            // Scale opacity 0.18–0.88 relative to the largest day in the period
            const op = Math.min(0.18 + (Math.abs(d.pl)/maxAbs)*0.7, 0.88);
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
  // Sort first — Object insertion order determines chart order and cumPL correctness
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
  // Loss side: losses in this system are always -1R (stop hit).
  // Only two negative buckets needed:
  //   "< -2R"  — catastrophic / scaling losses beyond 2R
  //   "-1R"    — standard stop-loss bucket (captures all -2R to 0R)
  //
  // Win side: wide buckets for runners
  //   "0–1R"   — small wins / BE
  //   "1–3R"   — moderate winners
  //   "4–7R"   — good runners
  //   "8–10R"  — great runners
  //   "> 10R"  — exceptional / home-run trades
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
    for (const b of B) {
      if (r > b.min && r <= b.max) { b.count++; break; }
    }
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
      // Win: close loss streak if open
      cW++;if(cL>0){allL.push(cL);cL=0;}if(cW>bW)bW=cW;
    } else {
      // Loss OR breakeven: both break a win streak and count as non-win
      if(cW>0){allW.push(cW);cW=0;}
      if(t.net_pl<0){cL++;if(cL>bL)bL=cL;}
      else{if(cL>0){allL.push(cL);cL=0;}} // breakeven resets loss streak too
    }
  });
  if(cW>0)allW.push(cW);if(cL>0)allL.push(cL);
  const avgWin=allW.length?allW.reduce((a,b)=>a+b,0)/allW.length:0;
  const avgLoss=allL.length?allL.reduce((a,b)=>a+b,0)/allL.length:0;
  // Current streak: walk backward from last trade
  let current=0;
  for(let i=s.length-1;i>=0;i--){
    const t=s[i];
    if(t.net_pl===0){break;} // breakeven breaks any streak
    const isW=t.net_pl>0;
    if(i===s.length-1||s[i+1].net_pl===0){current=isW?1:-1;}
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
    // Use losing_trades if provided by DB, else (total-wins) as fallback
    const lossCount=m.losing_trades!=null?m.losing_trades:(total-wins);
    const aW=wins>0?gW/wins:0,aL=lossCount>0?gL/lossCount:0;
    const exp=(wr/100)*aW-((100-wr)/100)*aL;
    return{...m,winRate:wr,profitFactor:pf,avgR:m.avg_r!=null?parseFloat(m.avg_r):null,expectancy:+exp.toFixed(2),totalPL:+pl};
  });
}

function buildScore(S) {
  if(!S||S.n===0) return[{m:'Win Rate',s:0},{m:'Profit Factor',s:0},{m:'Expectancy',s:0},{m:'Sharpe',s:0},{m:'Consistency',s:0},{m:'Payoff',s:0}];
  const norm=(v,min,max)=>Math.min(Math.max(((v-min)/(max-min))*100,0),100);
  // Consistency: coefficient of variation inverse, but ONLY rewards if edge is positive.
  // If avgPL <= 0, consistency score is 0 — consistent losing is not a skill.
  const avgPL=S.pl/S.n;
  const consistency=avgPL>0&&S.std>0
    ? Math.max(1-S.std/avgPL,0)*100  // lower CV = more consistent profitable edge
    : avgPL>0&&S.std===0
      ? 100                           // zero volatility, positive avg = perfect
      : 0;                            // losing or breakeven avg = 0 consistency score
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
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  // Hours 00–23
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  // Initialize grid: dayHour[day][hour] = { pl: 0, count: 0 }
  const grid = {};
  DAYS.forEach(d => {
    grid[d] = {};
    HOURS.forEach(h => { grid[d][h] = { pl: 0, count: 0 }; });
  });

  const dayMap = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

  trades.forEach(t => {
    if (!t.entry_time) return;
    const d = new Date(t.date + 'T00:00:00');
    const day = dayMap[d.getDay()];
    const hour = parseInt(t.entry_time.split(':')[0]);
    if (!isNaN(hour) && grid[day]) {
      grid[day][hour].pl    += t.net_pl;
      grid[day][hour].count += 1;
    }
  });

  // Find min/max for colour scaling
  let minPL = 0, maxPL = 0;
  DAYS.forEach(d => HOURS.forEach(h => {
    const v = grid[d][h].pl;
    if (v < minPL) minPL = v;
    if (v > maxPL) maxPL = v;
  }));

  // Find best and worst cells
  let bestCell = null, worstCell = null;
  DAYS.forEach(d => HOURS.forEach(h => {
    const cell = grid[d][h];
    if (cell.count === 0) return;
    if (!bestCell || cell.pl > bestCell.pl)  bestCell  = { day: d, hour: h, ...cell };
    if (!worstCell || cell.pl < worstCell.pl) worstCell = { day: d, hour: h, ...cell };
  }));

  return { grid, DAYS, HOURS, minPL, maxPL, bestCell, worstCell };
}

function DayHourHeatmap({ data }) {
  const PROFIT = '#8670ff';
  const LOSS   = '#ff0095';
  const { grid, DAYS, HOURS, minPL, maxPL, bestCell, worstCell } = data;

  const [tooltip, setTooltip] = useState(null);

  // Filter hours to only show ones that have at least 1 trade (save space)
  const activeHours = HOURS.filter(h => DAYS.some(d => grid[d][h].count > 0));

  function cellColor(pl, count) {
    if (count === 0) return 'rgba(255,255,255,0.03)';
    if (pl > 0) {
      const intensity = maxPL > 0 ? Math.min(pl / maxPL, 1) : 0;
      const alpha = 0.15 + intensity * 0.75;
      return `rgba(134,112,255,${alpha.toFixed(2)})`;   // purple accent = profit
    } else {
      const intensity = minPL < 0 ? Math.min(Math.abs(pl) / Math.abs(minPL), 1) : 0;
      const alpha = 0.15 + intensity * 0.75;
      return `rgba(255,0,149,${alpha.toFixed(2)})`;     // pink accent = loss
    }
  }

  const tradesWithTime = DAYS.reduce((sum, d) => 
    sum + HOURS.reduce((s, h) => s + grid[d][h].count, 0), 0);

  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
      borderRadius: 14, padding: 24,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Weekday × Hour Heatmap</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            P&L by day of week and entry hour — only trades with Entry Time are shown
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: PROFIT }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Profit</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: LOSS }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loss</span>
          </div>
        </div>
      </div>

      {tradesWithTime === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
          No trades with Entry Time logged yet. Add Entry Time when journaling to see this heatmap.
        </div>
      ) : (
        <>
          {/* Grid */}
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${activeHours.length}, 1fr)`, gap: 3, minWidth: 500 }}>
              {/* Header row: hours */}
              <div />
              {activeHours.map(h => (
                <div key={h} style={{
                  textAlign: 'center', fontSize: 11, color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', paddingBottom: 6, fontWeight: 600,
                }}>
                  {String(h).padStart(2,'0')}
                </div>
              ))}

              {/* Data rows: each day */}
              {DAYS.map(day => (
                <React.Fragment key={day}>
                  {/* Y-axis label */}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
                    paddingRight: 8, paddingLeft: 4,
                  }}>
                    {day}
                  </div>

                  {/* Hour cells */}
                  {activeHours.map(h => {
                    const cell = grid[day][h];
                    const bg = cellColor(cell.pl, cell.count);
                    const isBest  = bestCell?.day === day && bestCell?.hour === h;
                    const isWorst = worstCell?.day === day && worstCell?.hour === h;
                    return (
                      <div
                        key={h}
                        onMouseEnter={e => setTooltip({ day, hour: h, cell, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          height: 36, borderRadius: 6, background: bg,
                          border: isBest  ? `1.5px solid ${PROFIT}` :
                                  isWorst ? `1.5px solid ${LOSS}` :
                                  '1px solid rgba(255,255,255,0.04)',
                          cursor: cell.count > 0 ? 'pointer' : 'default',
                          transition: 'opacity 0.15s',
                          position: 'relative',
                        }}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Tooltip */}
          {tooltip && tooltip.cell.count > 0 && (
            <div style={{
              position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 10,
              background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, padding: '10px 14px', zIndex: 9999, pointerEvents: 'none',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)', minWidth: 140,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                {tooltip.day} @ {String(tooltip.hour).padStart(2,'0')}:00
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
                Trades: <strong style={{ color: 'var(--text-primary)' }}>{tooltip.cell.count}</strong>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: tooltip.cell.pl >= 0 ? PROFIT : LOSS }}>
                {tooltip.cell.pl >= 0 ? '+' : ''}${tooltip.cell.pl.toFixed(2)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Avg: {tooltip.cell.count > 0 ? `${(tooltip.cell.pl / tooltip.cell.count >= 0 ? '+' : '')}$${(tooltip.cell.pl / tooltip.cell.count).toFixed(2)}` : '—'}
              </div>
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 20 }}>
            {[
              {
                label: 'BEST TIMING',
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
        </>
      )}
    </div>
  );
}

function buildViolations(trades) {
  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  const violated = sorted.filter(t => t.rule_violation);
  const clean    = sorted.filter(t => !t.rule_violation);

  const avg = arr => arr.length ? arr.reduce((s, t) => s + t.net_pl, 0) / arr.length : null;
  const wr  = arr => arr.length ? (arr.filter(t => t.net_pl > 0).length / arr.length) * 100 : 0;

  const avgViol  = avg(violated);
  const avgClean = avg(clean);

  // "Hidden cost" = total P&L of violated trades (negative = money lost to bad discipline)
  const hiddenCost = violated.reduce((s, t) => s + t.net_pl, 0);

  // Rolling 10-trade violation rate
  const rollingViol = sorted.map((_, i, arr) => {
    if (i < 9) return null;
    const window = arr.slice(i - 9, i + 1);
    const vr = (window.filter(t => t.rule_violation).length / 10) * 100;
    return { l: fmtD(arr[i].date), vr: +vr.toFixed(1) };
  }).filter(Boolean);

  // Mistake tag breakdown (only on violated trades)
  const tagMap = {};
  violated.forEach(t => {
    if (t.mistake_tag) {
      tagMap[t.mistake_tag] = (tagMap[t.mistake_tag] || 0) + 1;
    }
  });
  const mistakeTags = Object.entries(tagMap)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    totalCount:    sorted.length,
    vCount:        violated.length,
    violationPct:  sorted.length ? (violated.length / sorted.length) * 100 : 0,
    avgViol,
    avgClean,
    hiddenCost,
    cleanWR:       wr(clean),
    violWR:        wr(violated),
    rollingViol,
    mistakeTags,
    violatedTrades: violated.slice().reverse(), // most recent first
  };
}

function fmtD(date) {
  return new Date(date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
}