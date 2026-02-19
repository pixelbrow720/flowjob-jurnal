import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

const PROFIT = '#8670ff';
const LOSS   = '#ff0095';

function CalendarPnL() {
  const [trades, setTrades]         = useState([]);
  const [accounts, setAccounts]     = useState([]);
  const [accountId, setAccountId]   = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    ipcRenderer.invoke('get-accounts').then(a => setAccounts(a || []));
  }, []);

  useEffect(() => {
    const fp = {};
    if (accountId) fp.accountId = parseInt(accountId);
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    fp.startDate = new Date(y, m, 1).toISOString().split('T')[0];
    fp.endDate   = new Date(y, m + 1, 0).toISOString().split('T')[0];
    ipcRenderer.invoke('get-trades', fp).then(t => setTrades(t || []));
  }, [accountId, currentDate]);

  // Group trades by date
  const byDate = {};
  trades.forEach(t => {
    const d = t.date;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(t);
  });

  const dayPnL = {};
  Object.entries(byDate).forEach(([d, ts]) => {
    const pl   = ts.reduce((s, t) => s + t.net_pl, 0);
    const wins = ts.filter(t => t.net_pl > 0).length;
    dayPnL[d]  = { pl, trades: ts.length, wins };
  });

  const year        = currentDate.getFullYear();
  const month       = currentDate.getMonth();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName   = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Summary stats
  const tradingDays = Object.keys(dayPnL).length;
  const greenDays   = Object.values(dayPnL).filter(d => d.pl > 0).length;
  const totalPL     = Object.values(dayPnL).reduce((s, d) => s + d.pl, 0);
  const plValues    = Object.values(dayPnL).map(d => d.pl);
  const bestDay     = tradingDays > 0 ? Math.max(...plValues) : 0;
  const worstDay    = tradingDays > 0 ? Math.min(...plValues) : 0;

  const selectedDateStr = selectedDay
    ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : null;
  const selectedTrades = selectedDateStr ? (byDate[selectedDateStr] || []) : [];
  const selectedStats  = selectedDateStr ? dayPnL[selectedDateStr] : null;

  // BUG FIX #3: Reset selectedDay ketika pindah bulan
  // Tanpa ini, hari yang dipilih di bulan sebelumnya ikut terbawa ke bulan baru
  const goToPrevMonth = () => {
    setSelectedDay(null);
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setSelectedDay(null);
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  // BUG FIX #4: Format Best Day dengan benar — prefix disesuaikan dengan nilai aktual
  // Kalau semua hari rugi, bestDay bisa negatif, jadi tidak bisa hardcode "+$"
  const formatBestDay = (val) => {
    if (val >= 0) return `+$${val.toFixed(2)}`;
    return `-$${Math.abs(val).toFixed(2)}`;
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Calendar P&L</h1>
        <p className="page-subtitle">Daily performance at a glance</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ minWidth: 200 }}>
            <option value="">All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Row */}
      <div className="content-grid grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: 'Month P&L',    value: `${totalPL >= 0 ? '+' : ''}$${totalPL.toFixed(2)}`, color: totalPL >= 0 ? PROFIT : LOSS },
          { label: 'Trading Days', value: tradingDays, color: 'var(--text-primary)' },
          { label: 'Green Days',   value: `${greenDays} / ${tradingDays}`, color: PROFIT },
          // BUG FIX #4: gunakan formatBestDay() supaya prefix sesuai nilai
          { label: 'Best Day',     value: formatBestDay(bestDay), color: bestDay >= 0 ? PROFIT : LOSS },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color, fontSize: 26 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        {/* Calendar */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: 24,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          {/* Month Navigation — BUG FIX #3: pakai handler yang reset selectedDay */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <button
              onClick={goToPrevMonth}
              style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
                borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
                fontSize: 14, fontWeight: 600, transition: 'all 0.15s',
              }}
            >← Prev</button>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{monthName}</h2>
            <button
              onClick={goToNextMonth}
              style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
                borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
                fontSize: 14, fontWeight: 600, transition: 'all 0.15s',
              }}
            >Next →</button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const data    = dayPnL[dateStr];
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              const isSel   = day === selectedDay;

              let bg         = 'rgba(255,255,255,0.02)';
              let borderCol  = 'rgba(255,255,255,0.06)';

              if (data) {
                bg = data.pl >= 0
                  ? 'rgba(134,112,255,0.08)'
                  : 'rgba(255,0,149,0.08)';
                borderCol = data.pl >= 0
                  ? 'rgba(134,112,255,0.3)'
                  : 'rgba(255,0,149,0.3)';
              }
              if (isSel) borderCol = data?.pl >= 0 ? PROFIT : LOSS;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  style={{
                    background:  bg,
                    border:      `1px solid ${borderCol}`,
                    borderRadius: 10,
                    padding:     '8px 6px',
                    minHeight:   72,
                    cursor:      data ? 'pointer' : 'default',
                    transition:  'all 0.15s',
                    position:    'relative',
                    boxShadow:   isSel ? `0 0 0 2px ${data?.pl >= 0 ? PROFIT : LOSS}` : 'none',
                  }}
                  onMouseEnter={e => data && (e.currentTarget.style.transform = 'scale(1.04)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <div style={{
                    fontSize: 12, fontWeight: isToday ? 800 : 600,
                    color: isToday ? PROFIT : 'var(--text-secondary)',
                    marginBottom: 4,
                  }}>{day}</div>
                  {data && (
                    <>
                      <div style={{
                        fontSize: 12, fontWeight: 700,
                        fontFamily: 'JetBrains Mono,monospace',
                        color: data.pl >= 0 ? PROFIT : LOSS,
                        lineHeight: 1.2,
                      }}>
                        {data.pl >= 0 ? '+' : ''}${Math.abs(data.pl) >= 1000
                          ? `${(data.pl / 1000).toFixed(1)}k`
                          : data.pl.toFixed(0)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {data.trades}T · {data.wins}W
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Detail Panel */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: 20,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          alignSelf: 'start',
        }}>
          {!selectedDay ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ marginBottom: 12 }}>
                <img src={`${process.env.PUBLIC_URL}/calendar.png`} alt="" style={{ width: 48, filter: 'invert(1) brightness(0.4)' }} />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Click a day to see its trades</p>
            </div>
          ) : (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                {new Date(year, month, selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </h3>
              {selectedStats ? (
                <>
                  <div style={{
                    fontSize: 28, fontWeight: 800,
                    fontFamily: 'JetBrains Mono,monospace',
                    color: selectedStats.pl >= 0 ? PROFIT : LOSS,
                    marginBottom: 16,
                  }}>
                    {selectedStats.pl >= 0 ? '+' : ''}${selectedStats.pl.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                    {selectedStats.trades} trades · {selectedStats.wins} wins · {Math.round(selectedStats.wins / selectedStats.trades * 100)}% WR
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedTrades.map(t => (
                      <div key={t.id} style={{
                        background: 'var(--bg-tertiary)',
                        border: `1px solid ${t.net_pl >= 0 ? 'rgba(134,112,255,0.2)' : 'rgba(255,0,149,0.2)'}`,
                        borderRadius: 8, padding: '10px 12px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{t.pair}</span>
                          <span style={{
                            fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, fontSize: 14,
                            color: t.net_pl >= 0 ? PROFIT : LOSS,
                          }}>
                            {t.net_pl >= 0 ? '+' : ''}${t.net_pl.toFixed(2)}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          <span className={`badge badge-${t.direction === 'Long' ? 'success' : 'danger'}`}
                            style={{ fontSize: 10, padding: '2px 7px' }}>
                            {t.direction}
                          </span>
                          {t.r_multiple != null && ` · ${t.r_multiple.toFixed(2)}R`}
                          {t.trade_grade && ` · ${t.trade_grade}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 16 }}>No trades on this day.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CalendarPnL;