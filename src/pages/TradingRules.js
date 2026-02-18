import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../components/Icon';

const { ipcRenderer } = window.require('electron');
const PROFIT = '#8670ff';
const LOSS   = '#ff0095';
const WARN   = '#ffaa00';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function defaultRules() {
  return {
    tradingDays:     ['Mon','Tue','Wed','Thu','Fri'],
    hoursEnabled:    true,
    hoursFrom:       '09:00',
    hoursTo:         '16:00',
    maxTradesPerDay: 0,
    maxLossPerTrade: 0,
    maxLossPerDay:   0,
    manualRules:     [],
  };
}

export default function TradingRules() {
  const [accounts, setAccounts]   = useState([]);
  const [selected, setSelected]   = useState(null);
  const [rules, setRules]         = useState(defaultRules());
  const [editMode, setEditMode]   = useState(false);
  const [form, setForm]           = useState(defaultRules());
  const [trades, setTrades]       = useState([]);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [newRule, setNewRule]     = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const accs = await ipcRenderer.invoke('get-accounts');
    setAccounts(accs || []);
    if (accs && accs.length > 0) selectAccount(accs[0]);
  };

  const selectAccount = async (acc) => {
    setSelected(acc);
    setEditMode(false);
    const r = await ipcRenderer.invoke('get-trading-rules', acc.id);
    setRules(r);
    setForm(r);
    const trd = await ipcRenderer.invoke('get-trades', { accountId: acc.id });
    setTrades(trd || []);
  };

  const saveRules = async () => {
    if (!selected) return;
    setSaving(true);
    await ipcRenderer.invoke('save-trading-rules', selected.id, form);
    setRules(form);
    setEditMode(false);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleDay = (day) => {
    setForm(f => {
      const days = f.tradingDays.includes(day)
        ? f.tradingDays.filter(d => d !== day)
        : [...f.tradingDays, day];
      return { ...f, tradingDays: days };
    });
  };

  const addManualRule = () => {
    const t = newRule.trim();
    if (!t) return;
    setForm(f => ({ ...f, manualRules: [...(f.manualRules || []), t] }));
    setNewRule('');
  };

  const removeManualRule = (i) => {
    setForm(f => ({ ...f, manualRules: f.manualRules.filter((_, x) => x !== i) }));
  };

  // ── Live metrics ──────────────────────────────────────────────────────────
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
  const todayTrades = trades.filter(t => t.date === today);
  const todayPL = todayTrades.reduce((s, t) => s + t.net_pl, 0);
  const capital = selected?.initial_balance || 25000;

  // Drawdown
  let cumPL = 0, peak = 0, maxDD = 0;
  [...trades].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(t => {
    cumPL += t.net_pl;
    if (cumPL > peak) peak = cumPL;
    const dd = peak - cumPL;
    if (dd > maxDD) maxDD = dd;
  });

  const totalPL = trades.reduce((s, t) => s + t.net_pl, 0);
  const violations = trades.filter(t => t.rule_violation).length;

  const activeRules = rules || defaultRules();

  // ── Rule status checks ────────────────────────────────────────────────────
  const now = _now;
  const currentDay = DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1];
  const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const isDayAllowed = activeRules.tradingDays.includes(currentDay);
  const isTimeAllowed = !activeRules.hoursEnabled || (currentTime >= activeRules.hoursFrom && currentTime <= activeRules.hoursTo);
  const tradesLimitHit = activeRules.maxTradesPerDay > 0 && todayTrades.length >= activeRules.maxTradesPerDay;
  const dailyLossHit = activeRules.maxLossPerDay > 0 && todayPL <= -activeRules.maxLossPerDay;
  const canTrade = isDayAllowed && isTimeAllowed && !tradesLimitHit && !dailyLossHit;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Trading Rules</h1>
        <p className="page-subtitle">Per-account rules & live status</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>

        {/* Account List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Accounts
          </div>
          {accounts.map(acc => (
            <button key={acc.id} onClick={() => selectAccount(acc)} style={{
              padding: '12px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              background: selected?.id === acc.id ? 'rgba(134,112,255,0.15)' : 'var(--bg-secondary)',
              border: `1px solid ${selected?.id === acc.id ? 'rgba(134,112,255,0.4)' : 'var(--border-color)'}`,
              color: selected?.id === acc.id ? PROFIT : 'var(--text-secondary)',
              fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, transition: 'all 0.15s',
            }}>
              {acc.name}
            </button>
          ))}
        </div>

        {/* Main Panel */}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Live Status Banner */}
            <div style={{
              borderRadius: 14, padding: '16px 24px',
              background: canTrade ? 'rgba(134,112,255,0.08)' : 'rgba(255,0,149,0.08)',
              border: `1px solid ${canTrade ? 'rgba(134,112,255,0.3)' : 'rgba(255,0,149,0.3)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: canTrade ? PROFIT : LOSS,
                  boxShadow: `0 0 8px ${canTrade ? PROFIT : LOSS}`,
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: canTrade ? PROFIT : LOSS }}>
                    {canTrade ? 'Trading Allowed' : 'Trading Restricted'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {selected.name} · {currentDay} {currentTime}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {!isDayAllowed && <Pill label="Day not allowed" color={LOSS} />}
                {!isTimeAllowed && <Pill label="Outside trading hours" color={LOSS} />}
                {tradesLimitHit && <Pill label={`Max ${activeRules.maxTradesPerDay} trades hit`} color={LOSS} />}
                {dailyLossHit && <Pill label="Daily loss limit hit" color={LOSS} />}
                {canTrade && <Pill label="All rules OK" color={PROFIT} />}
              </div>
            </div>

            {/* Today's Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: "Today's Trades", val: todayTrades.length, color: 'var(--text-primary)', suffix: '' },
                { label: "Today's P/L", val: `${todayPL >= 0 ? '+' : ''}$${todayPL.toFixed(0)}`, color: todayPL >= 0 ? PROFIT : LOSS, raw: true },
                { label: 'Max Drawdown', val: `-$${maxDD.toFixed(0)}`, color: LOSS, raw: true },
                { label: 'Rule Violations', val: violations, color: violations > 0 ? LOSS : PROFIT, suffix: '' },
              ].map(({ label, val, color, raw, suffix }) => (
                <div key={label} style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  borderRadius: 10, padding: '14px 16px',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color }}>
                    {raw ? val : `${val}${suffix !== undefined ? suffix : ''}`}
                  </div>
                </div>
              ))}
            </div>

            {/* Rules Editor */}
            <div style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              borderRadius: 14, overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                padding: '20px 24px', borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Rules — {selected.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    Capital: <span style={{ color: PROFIT, fontFamily: 'var(--font-mono)' }}>${capital.toLocaleString()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {saved && (
                    <span style={{ fontSize: 13, color: PROFIT, fontWeight: 600 }}>Saved!</span>
                  )}
                  {editMode ? (
                    <>
                      <button className="btn btn-secondary" onClick={() => { setEditMode(false); setForm(rules); }}>Cancel</button>
                      <button className="btn btn-primary" onClick={saveRules} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Rules'}
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-secondary" onClick={() => setEditMode(true)}>
                      <Icon name="edit" size={13} style={{ marginRight: 6 }} /> Edit Rules
                    </button>
                  )}
                </div>
              </div>

              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 28 }}>

                {/* Trading Days */}
                <RuleRow label="Trading Days" desc="Which days of the week you're allowed to trade">
                  <div style={{ display: 'flex', gap: 8 }}>
                    {DAYS.map(day => {
                      const active = (editMode ? form : activeRules).tradingDays.includes(day);
                      return (
                        <button key={day} onClick={() => editMode && toggleDay(day)} style={{
                          width: 44, height: 44, borderRadius: 10, fontWeight: 700, fontSize: 13,
                          cursor: editMode ? 'pointer' : 'default',
                          background: active ? PROFIT : 'var(--bg-tertiary)',
                          border: `1px solid ${active ? PROFIT : 'var(--border-color)'}`,
                          color: active ? '#000' : 'var(--text-muted)',
                          transition: 'all 0.15s',
                          fontFamily: 'var(--font-display)',
                        }}>
                          {day.slice(0, 2)}
                        </button>
                      );
                    })}
                  </div>
                </RuleRow>

                {/* Trading Hours */}
                <RuleRow label="Trading Hours" desc="Only allow entries within this time window (24h format)">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Toggle
                      on={(editMode ? form : activeRules).hoursEnabled}
                      onChange={v => editMode && setForm(f => ({ ...f, hoursEnabled: v }))}
                      disabled={!editMode}
                    />
                    {(editMode ? form : activeRules).hoursEnabled && (
                      <>
                        <input type="time" value={(editMode ? form : activeRules).hoursFrom}
                          disabled={!editMode}
                          onChange={e => setForm(f => ({ ...f, hoursFrom: e.target.value }))}
                          style={timeInput} />
                        <span style={{ color: 'var(--text-muted)' }}>to</span>
                        <input type="time" value={(editMode ? form : activeRules).hoursTo}
                          disabled={!editMode}
                          onChange={e => setForm(f => ({ ...f, hoursTo: e.target.value }))}
                          style={timeInput} />
                      </>
                    )}
                  </div>
                </RuleRow>

                {/* Max Trades Per Day */}
                <RuleRow label="Max Trades Per Day" desc="0 = unlimited. Auto-flags violation when exceeded.">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Toggle
                      on={(editMode ? form : activeRules).maxTradesPerDay > 0}
                      onChange={v => editMode && setForm(f => ({ ...f, maxTradesPerDay: v ? 3 : 0 }))}
                      disabled={!editMode}
                    />
                    {(editMode ? form : activeRules).maxTradesPerDay > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="number" min="1" max="50"
                          value={(editMode ? form : activeRules).maxTradesPerDay}
                          disabled={!editMode}
                          onChange={e => setForm(f => ({ ...f, maxTradesPerDay: parseInt(e.target.value) || 0 }))}
                          style={{ ...numInput, width: 80 }} />
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>trades/day</span>
                      </div>
                    )}
                  </div>
                </RuleRow>

                {/* Max Loss Per Trade */}
                <RuleRow label="Max Loss Per Trade" desc="Auto-flags violation if single trade loss exceeds this.">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Toggle
                      on={(editMode ? form : activeRules).maxLossPerTrade > 0}
                      onChange={v => editMode && setForm(f => ({ ...f, maxLossPerTrade: v ? 100 : 0 }))}
                      disabled={!editMode}
                    />
                    {(editMode ? form : activeRules).maxLossPerTrade > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>$</span>
                        <input type="number" min="1"
                          value={(editMode ? form : activeRules).maxLossPerTrade}
                          disabled={!editMode}
                          onChange={e => setForm(f => ({ ...f, maxLossPerTrade: parseFloat(e.target.value) || 0 }))}
                          style={{ ...numInput, width: 100 }} />
                      </div>
                    )}
                  </div>
                </RuleRow>

                {/* Max Loss Per Day */}
                <RuleRow label="Net Max Loss Per Day" desc="Auto-flags violation + marks as restricted if daily loss hits limit.">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Toggle
                      on={(editMode ? form : activeRules).maxLossPerDay > 0}
                      onChange={v => editMode && setForm(f => ({ ...f, maxLossPerDay: v ? 100 : 0 }))}
                      disabled={!editMode}
                    />
                    {(editMode ? form : activeRules).maxLossPerDay > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>$</span>
                        <input type="number" min="1"
                          value={(editMode ? form : activeRules).maxLossPerDay}
                          disabled={!editMode}
                          onChange={e => setForm(f => ({ ...f, maxLossPerDay: parseFloat(e.target.value) || 0 }))}
                          style={{ ...numInput, width: 100 }} />
                      </div>
                    )}
                  </div>
                </RuleRow>

                {/* Manual Rules */}
                <RuleRow label="Manual Rules" desc="Custom rules you want to enforce for this account.">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {((editMode ? form : activeRules).manualRules || []).map((r, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'var(--bg-tertiary)', borderRadius: 8,
                        padding: '10px 14px', border: '1px solid var(--border-color)',
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: PROFIT, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 14, color: 'var(--text-secondary)' }}>{r}</span>
                        {editMode && (
                          <button onClick={() => removeManualRule(i)} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: LOSS, fontSize: 16, lineHeight: 1, padding: '0 2px',
                          }}>×</button>
                        )}
                      </div>
                    ))}
                    {editMode && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          value={newRule}
                          onChange={e => setNewRule(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addManualRule()}
                          placeholder="e.g. No revenge trading after 2 losses"
                          style={{ flex: 1, fontSize: 14 }}
                        />
                        <button className="btn btn-secondary" onClick={addManualRule}>+ Add</button>
                      </div>
                    )}
                    {!editMode && (!activeRules.manualRules || activeRules.manualRules.length === 0) && (
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No manual rules set</span>
                    )}
                  </div>
                </RuleRow>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RuleRow({ label, desc, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start', paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, disabled }) {
  return (
    <button onClick={() => !disabled && onChange(!on)} style={{
      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: disabled ? 'default' : 'pointer',
      background: on ? '#8670ff' : 'var(--bg-tertiary)', position: 'relative', transition: 'background 0.2s',
      flexShrink: 0,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: on ? 23 : 3, transition: 'left 0.2s',
      }} />
    </button>
  );
}

function Pill({ label, color }) {
  return (
    <span style={{
      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: `${color}18`, border: `1px solid ${color}44`, color,
    }}>{label}</span>
  );
}

const timeInput = {
  padding: '8px 12px', background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-color)', borderRadius: 8,
  color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 14,
};

const numInput = {
  padding: '8px 12px', background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-color)', borderRadius: 8,
  color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 14,
};