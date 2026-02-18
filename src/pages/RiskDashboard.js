import Icon from '../components/Icon';
import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');
const PROFIT = '#8670ff';
const LOSS   = '#ff0095';
const WARN   = '#ffaa00';

function RiskDashboard() {
  const [accounts, setAccounts]   = useState([]);
  const [selected, setSelected]   = useState(null);
  const [trades, setTrades]       = useState([]);
  const [settings, setSettings]   = useState({});
  const [editMode, setEditMode]   = useState(false);
  const [editForm, setEditForm]   = useState({
    maxDailyDrawdown: 2,
    maxTotalDrawdown: 10,
    profitTarget:     10,
    consistencyPct:   40,
  });

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    const accs = await ipcRenderer.invoke('get-accounts');
    setAccounts(accs || []);
    if (accs && accs.length > 0) selectAccount(accs[0]);
  };

  const selectAccount = async (acc) => {
    setSelected(acc);
    const savedSettings = await ipcRenderer.invoke('get-setting', `risk_${acc.id}`);
    const parsed = savedSettings ? JSON.parse(savedSettings) : {
      maxDailyDrawdown: 2,
      maxTotalDrawdown: 10,
      profitTarget:     10,
      consistencyPct:   40,
    };
    setSettings(parsed);
    setEditForm(parsed);
    const trd = await ipcRenderer.invoke('get-trades', { accountId: acc.id });
    setTrades(trd || []);
  };

  const saveSettings = async () => {
    await ipcRenderer.invoke('set-setting', `risk_${selected.id}`, JSON.stringify(editForm));
    setSettings(editForm);
    setEditMode(false);
  };

  // ── Metrics ───────────────────────────────────────────────────────────────
  const today      = new Date().toISOString().split('T')[0];
  const todayTrades = trades.filter(t => t.date === today);
  const todayPL    = todayTrades.reduce((s, t) => s + t.net_pl, 0);
  const totalPL    = trades.reduce((s, t) => s + t.net_pl, 0);

  // Max drawdown
  let cumPL = 0, peak = 0, maxDD = 0;
  [...trades].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
    cumPL += t.net_pl;
    if (cumPL > peak) peak = cumPL;
    const dd = peak - cumPL;
    if (dd > maxDD) maxDD = dd;
  });

  const capital     = selected?.initial_balance || 25000;
  const dailyDDPct  = capital > 0 ? Math.abs(Math.min(todayPL, 0)) / capital * 100 : 0;
  const totalDDPct  = capital > 0 ? maxDD / capital * 100 : 0;
  const profitPct   = capital > 0 ? totalPL / capital * 100 : 0;

  // ── Consistency: daily profit must NOT exceed X% of profit target ─────────
  // profitTargetDollar = capital * profitTarget%
  // maxDailyAllowed    = profitTargetDollar * consistencyPct%
  // A day is "consistent" if its profit <= maxDailyAllowed
  const maxDailyDD   = settings.maxDailyDrawdown || 2;
  const maxTotalDD   = settings.maxTotalDrawdown  || 10;
  const targetPct    = settings.profitTarget      || 10;
  const consPct      = settings.consistencyPct    || 40;

  const profitTargetDollar = capital * (targetPct / 100);
  const maxDailyAllowed    = profitTargetDollar * (consPct / 100);

  // Group trades by day
  const dayMap = {};
  trades.forEach(t => {
    dayMap[t.date] = (dayMap[t.date] || 0) + t.net_pl;
  });
  const dayVals       = Object.values(dayMap);
  const tradingDays   = dayVals.length;

  // Days where profit exceeded the daily cap (inconsistent days)
  const inconsistentDays = dayVals.filter(v => v > maxDailyAllowed).length;
  const consistentDays   = tradingDays - inconsistentDays;
  const consistencyScore = tradingDays > 0 ? (consistentDays / tradingDays) * 100 : 100;

  // Status helpers
  const dailyStatus  = dailyDDPct >= maxDailyDD   ? 'breach' : dailyDDPct  >= maxDailyDD  * 0.7 ? 'warn' : 'ok';
  const totalStatus  = totalDDPct >= maxTotalDD    ? 'breach' : totalDDPct  >= maxTotalDD  * 0.7 ? 'warn' : 'ok';
  const profitStatus = profitPct  >= targetPct     ? 'reached' : 'pending';
  // Consistency is "ok" when most days are under the cap
  const consStatus   = inconsistentDays === 0 ? 'ok'
    : inconsistentDays <= Math.ceil(tradingDays * 0.1) ? 'warn' : 'breach';

  const statusColor = (s) => ({ ok: PROFIT, warn: WARN, breach: LOSS, reached: PROFIT, pending: WARN }[s] || PROFIT);
  const statusLabel = (s) => ({ ok: 'SAFE', warn: 'WARNING', breach: 'BREACHED', reached: 'REACHED', pending: 'PENDING' }[s] || s);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Risk Dashboard</h1>
        <p className="page-subtitle">Monitor your risk limits and performance targets</p>
      </div>

      {/* Account selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {accounts.map(acc => (
          <button key={acc.id}
            onClick={() => selectAccount(acc)}
            style={{
              padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
              background: selected?.id === acc.id ? 'rgba(134,112,255,0.15)' : 'var(--bg-secondary)',
              border: `1px solid ${selected?.id === acc.id ? 'rgba(134,112,255,0.4)' : 'var(--border-color)'}`,
              color: selected?.id === acc.id ? PROFIT : 'var(--text-secondary)',
              fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600,
              transition: 'all 0.15s',
            }}>
            {acc.name}
          </button>
        ))}
      </div>

      {!selected ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="warning" size={48} color="muted" /></div>
          <h3 className="empty-state-title">No accounts found</h3>
          <p className="empty-state-description">Create an account first to set risk limits</p>
        </div>
      ) : (
        <>
          {/* Settings Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: 24, marginBottom: 24,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Risk Settings — {selected.name}</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Capital: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    ${capital.toLocaleString()}
                  </strong>
                  &nbsp;·&nbsp;
                  Profit Target: <strong style={{ color: PROFIT, fontFamily: 'var(--font-mono)' }}>
                    ${profitTargetDollar.toLocaleString()}
                  </strong>
                  &nbsp;·&nbsp;
                  Max Daily Allowed: <strong style={{ color: WARN, fontFamily: 'var(--font-mono)' }}>
                    ${maxDailyAllowed.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </strong>
                </p>
              </div>
              <button onClick={() => editMode ? saveSettings() : setEditMode(true)}
                style={{
                  padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
                  background: editMode ? PROFIT : 'var(--bg-elevated)',
                  border: `1px solid ${editMode ? 'transparent' : 'var(--border-color)'}`,
                  color: editMode ? '#000' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
                }}>
                <Icon name={editMode ? 'save' : 'edit'} size={14} color="default" style={{ marginRight: 6 }} />
                {editMode ? 'Save' : 'Edit'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[
                { key: 'maxDailyDrawdown', label: 'Max Daily DD %',      icon: 'down',   suffix: '%', desc: 'Max loss per day as % of capital' },
                { key: 'maxTotalDrawdown', label: 'Max Total DD %',       icon: 'down',   suffix: '%', desc: 'Max total drawdown as % of capital' },
                { key: 'profitTarget',     label: 'Profit Target %',      icon: 'target', suffix: '%', desc: `Goal: $${profitTargetDollar.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                { key: 'consistencyPct',   label: 'Max Daily Profit %',   icon: 'chart',  suffix: '%', desc: `Max/day: $${maxDailyAllowed.toLocaleString(undefined, { maximumFractionDigits: 0 })} of profit target` },
              ].map(({ key, label, icon, suffix, desc }) => (
                <div key={key} style={{
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                  borderRadius: 10, padding: '14px 16px',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.5px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name={icon} size={12} color="muted" /> {label}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>{desc}</div>
                  {editMode ? (
                    <input type="number" step="0.5" min="0"
                      value={editForm[key]}
                      onChange={e => setEditForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
                      style={{ width: '100%', fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace',
                        background: 'var(--bg-elevated)', border: '1px solid var(--accent-primary)',
                        borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)' }} />
                  ) : (
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'JetBrains Mono,monospace', color: PROFIT }}>
                      {settings[key]}{suffix}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Status Cards */}
          <div className="content-grid grid-4" style={{ marginBottom: 24 }}>
            {[
              {
                label:   'Daily Drawdown',
                current: `${dailyDDPct.toFixed(2)}%`,
                sub:     `$${Math.abs(Math.min(todayPL, 0)).toFixed(2)} today`,
                limit:   `Limit: ${maxDailyDD}% ($${(capital * maxDailyDD / 100).toFixed(0)})`,
                status:  dailyStatus,
                bar:     Math.min(dailyDDPct / maxDailyDD * 100, 100),
              },
              {
                label:   'Total Drawdown',
                current: `${totalDDPct.toFixed(2)}%`,
                sub:     `-$${maxDD.toFixed(2)}`,
                limit:   `Limit: ${maxTotalDD}% ($${(capital * maxTotalDD / 100).toFixed(0)})`,
                status:  totalStatus,
                bar:     Math.min(totalDDPct / maxTotalDD * 100, 100),
              },
              {
                label:   'Profit Progress',
                current: `${profitPct.toFixed(2)}%`,
                sub:     `$${totalPL.toFixed(2)}`,
                limit:   `Target: ${targetPct}% ($${profitTargetDollar.toFixed(0)})`,
                status:  profitStatus,
                bar:     Math.min(Math.max(profitPct / targetPct * 100, 0), 100),
              },
              {
                label:   'Consistency',
                current: `${consistencyScore.toFixed(0)}%`,
                sub:     `${inconsistentDays} day${inconsistentDays !== 1 ? 's' : ''} exceeded cap`,
                limit:   `Max/day: $${maxDailyAllowed.toFixed(0)} (${consPct}% of target)`,
                status:  consStatus,
                bar:     consistencyScore,
              },
            ].map((card, i) => (
              <div key={i} style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                border: `1px solid ${statusColor(card.status)}33`,
                borderRadius: 14, padding: 20,
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  {card.label}
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'JetBrains Mono,monospace',
                  color: statusColor(card.status), marginBottom: 2 }}>
                  {card.current}
                </div>
                <div style={{ fontSize: 12, color: PROFIT, fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                  {card.sub}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  {card.limit}
                </div>
                <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${card.bar}%`,
                    background: statusColor(card.status), borderRadius: 3,
                    transition: 'width 0.6s ease',
                    boxShadow: `0 0 8px ${statusColor(card.status)}88`,
                  }} />
                </div>
                <div style={{
                  display: 'inline-block', marginTop: 10,
                  padding: '3px 10px', borderRadius: 20,
                  background: `${statusColor(card.status)}22`,
                  border: `1px solid ${statusColor(card.status)}44`,
                  fontSize: 11, fontWeight: 700, color: statusColor(card.status),
                  letterSpacing: '0.5px',
                }}>
                  {statusLabel(card.status)}
                </div>
              </div>
            ))}
          </div>

          {/* Consistency Detail */}
          {tradingDays > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16, padding: 24, marginBottom: 24,
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Daily Profit Breakdown
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 10 }}>
                  Cap: ${maxDailyAllowed.toFixed(0)}/day ({consPct}% of ${profitTargetDollar.toFixed(0)} target)
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(dayMap)
                  .sort((a, b) => new Date(b[0]) - new Date(a[0]))
                  .slice(0, 14)
                  .map(([date, pl]) => {
                    const exceeded = pl > maxDailyAllowed;
                    const barPct   = Math.min(Math.abs(pl) / Math.max(maxDailyAllowed * 2, 1) * 100, 100);
                    return (
                      <div key={date} style={{
                        display: 'grid', gridTemplateColumns: '100px 1fr 120px 80px',
                        gap: 12, alignItems: 'center',
                        background: exceeded ? 'rgba(255,0,149,0.05)' : 'var(--bg-tertiary)',
                        border: `1px solid ${exceeded ? 'rgba(255,0,149,0.2)' : 'var(--border-color)'}`,
                        borderRadius: 8, padding: '10px 14px',
                      }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', width: `${barPct}%`,
                            background: pl >= 0 ? (exceeded ? LOSS : PROFIT) : LOSS,
                            borderRadius: 3,
                          }} />
                        </div>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13,
                          color: pl >= 0 ? (exceeded ? LOSS : PROFIT) : LOSS,
                          textAlign: 'right',
                        }}>
                          {pl >= 0 ? '+' : ''}${pl.toFixed(2)}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, textAlign: 'right',
                          color: exceeded ? LOSS : PROFIT,
                        }}>
                          {exceeded ? 'EXCEEDED' : 'OK'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Today's Trades */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: 24,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)',
              marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              Today's Trades — {today}
              <span style={{
                marginLeft: 'auto', fontSize: 20, fontWeight: 800,
                fontFamily: 'JetBrains Mono,monospace',
                color: todayPL >= 0 ? PROFIT : LOSS,
              }}>
                {todayPL >= 0 ? '+' : ''}${todayPL.toFixed(2)}
              </span>
            </div>
            {todayTrades.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No trades today.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {todayTrades.map(t => (
                  <div key={t.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg-tertiary)', borderRadius: 8,
                    border: `1px solid ${t.net_pl >= 0 ? 'rgba(134,112,255,0.2)' : 'rgba(255,0,149,0.2)'}`,
                    padding: '10px 16px',
                  }}>
                    <div>
                      <span style={{ fontWeight: 700 }}>{t.pair}</span>
                      <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                        {t.direction} · {t.position_size} contracts
                      </span>
                    </div>
                    <span style={{
                      fontFamily: 'JetBrains Mono,monospace', fontWeight: 700,
                      color: t.net_pl >= 0 ? PROFIT : LOSS,
                    }}>
                      {t.net_pl >= 0 ? '+' : ''}${t.net_pl.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default RiskDashboard;