import React, { useState, useEffect, useCallback } from 'react';
import './Profile.css';

const { ipcRenderer } = window.require('electron');
const PUB = process.env.PUBLIC_URL;

// ─── Badge Definitions ────────────────────────────────────────────────────────
const BADGES = [
  {
    id: 'first-trade',
    name: 'First Step',
    desc: 'Log your very first trade',
    icon: 'trading.png',
    category: 'Milestones',
    check: (s) => s.totalTrades >= 1,
  },
  {
    id: 'trades-50',
    name: 'Getting Serious',
    desc: 'Log 50 trades',
    icon: 'consistency.png',
    category: 'Milestones',
    check: (s) => s.totalTrades >= 50,
  },
  {
    id: 'trades-100',
    name: 'Century Club',
    desc: 'Log 100 trades',
    icon: 'consistency.png',
    category: 'Milestones',
    check: (s) => s.totalTrades >= 100,
  },
  {
    id: 'trades-500',
    name: 'The Grind',
    desc: 'Log 500 trades',
    icon: 'dedication.png',
    category: 'Milestones',
    check: (s) => s.totalTrades >= 500,
  },
  {
    id: 'in-the-green',
    name: 'In The Green',
    desc: 'Achieve positive total P&L (min 10 trades)',
    icon: 'profits.png',
    category: 'Performance',
    check: (s) => s.totalPL > 0 && s.totalTrades >= 10,
  },
  {
    id: 'winrate-60',
    name: 'Sharp Edge',
    desc: 'Win rate ≥ 60% (min 20 trades)',
    icon: 'success.png',
    category: 'Performance',
    check: (s) => s.winRate >= 60 && s.totalTrades >= 20,
  },
  {
    id: 'winrate-70',
    name: 'Sniper',
    desc: 'Win rate ≥ 70% (min 20 trades)',
    icon: 'success.png',
    category: 'Performance',
    check: (s) => s.winRate >= 70 && s.totalTrades >= 20,
  },
  {
    id: 'profitfactor-2',
    name: 'Double Edge',
    desc: 'Profit factor ≥ 2.0 (min 20 trades)',
    icon: 'profit.png',
    category: 'Performance',
    check: (s) => s.profitFactor >= 2.0 && s.totalTrades >= 20,
  },
  {
    id: 'sharpe-1',
    name: 'Risk Adjusted',
    desc: 'Sharpe ratio ≥ 1.0 (min 20 trades)',
    icon: 'sharp.png',
    category: 'Performance',
    check: (s) => s.sharpeRatio >= 1.0 && s.totalTrades >= 20,
  },
  {
    id: 'sharpe-2',
    name: 'Alpha Generator',
    desc: 'Sharpe ratio ≥ 2.0 (min 20 trades)',
    icon: 'sharp.png',
    category: 'Performance',
    check: (s) => s.sharpeRatio >= 2.0 && s.totalTrades >= 20,
  },
  {
    id: 'chart-master',
    name: 'Chart Master',
    desc: 'Trade 5+ different instruments',
    icon: 'chart.png',
    category: 'Performance',
    check: (s) => s.uniqueInstruments >= 5,
  },
  {
    id: 'streak-7',
    name: 'Week Warrior',
    desc: '7-day daily journal streak',
    icon: 'fire.png',
    category: 'Consistency',
    check: (s) => s.maxJournalStreak >= 7,
  },
  {
    id: 'streak-30',
    name: 'Monthly Dedication',
    desc: '30-day daily journal streak',
    icon: 'fire.png',
    category: 'Consistency',
    check: (s) => s.maxJournalStreak >= 30,
  },
  {
    id: 'journals-30',
    name: 'Dedicated Trader',
    desc: 'Write 30+ daily journals',
    icon: 'dedication.png',
    category: 'Consistency',
    check: (s) => s.totalJournals >= 30,
  },
  {
    id: 'journals-100',
    name: 'The Analyst',
    desc: 'Write 100+ daily journals',
    icon: 'dedication.png',
    category: 'Consistency',
    check: (s) => s.totalJournals >= 100,
  },
];

const BADGE_CATEGORIES = ['Milestones', 'Performance', 'Consistency'];

// ─── Theme Colors ─────────────────────────────────────────────────────────────
const ACCENT_COLORS = [
  { name: 'Purple',  value: '#8670ff' },
  { name: 'Cyan',    value: '#00d4ff' },
  { name: 'Green',   value: '#00ff88' },
  { name: 'Gold',    value: '#ffd700' },
  { name: 'Orange',  value: '#ff8c00' },
  { name: 'Red',     value: '#ff4444' },
  { name: 'Pink',    value: '#ff69b4' },
  { name: 'Teal',    value: '#00c9a7' },
];

const TRADER_TITLES = [
  'Scalper', 'Swing Trader', 'Day Trader', 'Position Trader',
  'Quant Trader', 'Algo Trader', 'Momentum Trader', 'Contrarian',
  'Market Maker', 'Risk Manager', 'The Sniper', 'The Patient One',
  'The Disciplined', 'System Builder',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeJournalStreak(journals) {
  if (!journals || journals.length === 0) return 0;
  const dates = [...new Set(journals.map((j) => j.date))].sort();
  let maxStreak = 1;
  let curStreak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      curStreak++;
      maxStreak = Math.max(maxStreak, curStreak);
    } else {
      curStreak = 1;
    }
  }
  return maxStreak;
}

function applyAccentColor(color) {
  document.documentElement.style.setProperty('--accent-primary', color);
  document.documentElement.style.setProperty('--profit-color', color);
}

// ─── Component ────────────────────────────────────────────────────────────────
function Profile() {
  const [activeTab, setActiveTab] = useState('profile');

  // Profile state
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [motto, setMotto] = useState('');
  const [avatar, setAvatar] = useState(null);

  // Appearance state
  const [accentColor, setAccentColor] = useState('#8670ff');
  const [customColor, setCustomColor] = useState('#8670ff');

  // Badge state
  const [stats, setStats] = useState(null);
  const [badgeFilter, setBadgeFilter] = useState('All');

  // Danger Zone state
  const [resetStep, setResetStep]       = useState(0);
  const [resetInput, setResetInput]     = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg]         = useState('');

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // ── Load on mount ──
  useEffect(() => {
    loadProfile();
    loadStats();
  }, []);

  const loadProfile = async () => {
    try {
      const raw = await ipcRenderer.invoke('get-setting', 'user_profile');
      if (raw) {
        const p = JSON.parse(raw);
        setName(p.name || '');
        setTitle(p.title || '');
        setMotto(p.motto || '');
        setAvatar(p.avatar || null);
        if (p.accentColor) {
          setAccentColor(p.accentColor);
          setCustomColor(p.accentColor);
          applyAccentColor(p.accentColor);
        }
      }
    } catch (e) {}
  };

  const loadStats = async () => {
    try {
      const [analytics, trades, journals] = await Promise.all([
        ipcRenderer.invoke('get-analytics', {}),
        ipcRenderer.invoke('get-trades', {}),
        ipcRenderer.invoke('get-daily-journals'),
      ]);

      const uniqueInstruments = new Set((trades || []).map((t) => t.pair)).size;
      const maxJournalStreak = computeJournalStreak(journals || []);

      setStats({
        totalTrades: analytics?.totalTrades || 0,
        winRate: analytics?.winRate || 0,
        profitFactor: analytics?.profitFactor || 0,
        totalPL: analytics?.totalPL || 0,
        sharpeRatio: analytics?.sharpeRatio || 0,
        uniqueInstruments,
        maxJournalStreak,
        totalJournals: (journals || []).length,
      });
    } catch (e) {}
  };

  // ── Save profile ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const profile = { name, title, motto, avatar, accentColor };
      await ipcRenderer.invoke('set-setting', 'user_profile', JSON.stringify(profile));
      applyAccentColor(accentColor);
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (e) {
      setSaveMsg('Error saving');
    }
    setSaving(false);
  };

  // ── Avatar upload ──
  const handleAvatarUpload = async () => {
    const filePath = await ipcRenderer.invoke('select-file');
    if (!filePath) return;
    const fs = window.require('fs');
    const data = fs.readFileSync(filePath);
    const base64 = `data:image/png;base64,${data.toString('base64')}`;
    setAvatar(base64);
  };

  // ── Accent color select ──
  const handleColorSelect = (color) => {
    setAccentColor(color);
    setCustomColor(color);
    applyAccentColor(color);
  };

  // ── Reset All Data ──
  const handleReset = async () => {
    if (resetInput !== 'RESET') {
      setResetMsg('Ketik RESET dengan huruf kapital untuk konfirmasi.');
      return;
    }
    setResetLoading(true);
    setResetMsg('');
    try {
      const result = await ipcRenderer.invoke('reset-all-data');
      if (result.success) {
        setResetMsg('✓ Semua data berhasil dihapus. Restart app untuk memulai dari awal.');
        setResetStep(0);
        setResetInput('');
        loadStats();
      } else {
        setResetMsg(`Error: ${result.error}`);
      }
    } catch (e) {
      setResetMsg(`Error: ${e.message}`);
    }
    setResetLoading(false);
  };

  // ── Badge compute ──
  const earnedBadges = stats
    ? BADGES.filter((b) => b.check(stats)).map((b) => b.id)
    : [];

  const filteredBadges =
    badgeFilter === 'All'
      ? BADGES
      : BADGES.filter((b) => b.category === badgeFilter);

  const earnedCount = earnedBadges.length;

  return (
    <div className="profile-page">
      {/* ── Page Header ── */}
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Personalize your experience and track your achievements</p>
      </div>

      {/* ── Tab Bar ── */}
      <div className="profile-tabs">
        <button
          className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <img src={`${PUB}/user.png`} alt="" className="tab-icon" />
          Profile
        </button>
        <button
          className={`profile-tab ${activeTab === 'appearance' ? 'active' : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          <img src={`${PUB}/palette.png`} alt="" className="tab-icon" />
          Appearance
        </button>
        <button
          className={`profile-tab ${activeTab === 'badges' ? 'active' : ''}`}
          onClick={() => setActiveTab('badges')}
        >
          <img src={`${PUB}/medals.png`} alt="" className="tab-icon" />
          Badges
          {earnedCount > 0 && (
            <span className="tab-badge-count">{earnedCount}</span>
          )}
        </button>
        <button
          className={`profile-tab ${activeTab === 'danger' ? 'active' : ''}`}
          onClick={() => { setActiveTab('danger'); setResetStep(0); setResetInput(''); setResetMsg(''); }}
          style={activeTab === 'danger'
            ? { color: '#ff0095', borderColor: 'rgba(255,0,149,0.2)', background: 'rgba(255,0,149,0.08)' }
            : {}}
        >
          <img
            src={`${PUB}/trash-can.png`}
            alt=""
            className="tab-icon"
            style={activeTab === 'danger'
              ? { filter: 'invert(30%) sepia(100%) saturate(1000%) hue-rotate(300deg) brightness(1.1)' }
              : {}}
          />
          Danger Zone
        </button>
      </div>

      {/* ══════════════════════════════════════════════════
          TAB: PROFILE
      ══════════════════════════════════════════════════ */}
      {activeTab === 'profile' && (
        <div className="profile-tab-content">
          <div className="profile-layout">
            {/* Left: Avatar + Preview */}
            <div className="profile-left">
              <div className="profile-card">
                <div className="profile-avatar-section">
                  <div
                    className="profile-avatar"
                    onClick={handleAvatarUpload}
                    title="Click to change avatar"
                  >
                    {avatar ? (
                      <img src={avatar} alt="Avatar" className="profile-avatar-img" />
                    ) : (
                      <div className="profile-avatar-placeholder">
                        <img
                          src={`${PUB}/user.png`}
                          alt="user"
                          className="avatar-placeholder-icon"
                        />
                        <span className="avatar-upload-hint">Click to upload</span>
                      </div>
                    )}
                    <div className="avatar-overlay">
                      <span>Change</span>
                    </div>
                  </div>

                  <div className="profile-identity">
                    <div className="profile-display-name">{name || 'Your Name'}</div>
                    {title && <div className="profile-display-title">{title}</div>}
                    {motto && <div className="profile-display-motto">"{motto}"</div>}
                  </div>
                </div>

                {/* Quick stats */}
                {stats && (
                  <div className="profile-quick-stats">
                    <div className="pq-stat">
                      <span className="pq-val">{stats.totalTrades}</span>
                      <span className="pq-label">Trades</span>
                    </div>
                    <div className="pq-stat">
                      <span className="pq-val">{stats.winRate.toFixed(1)}%</span>
                      <span className="pq-label">Win Rate</span>
                    </div>
                    <div className="pq-stat">
                      <span className={`pq-val ${stats.totalPL >= 0 ? 'positive' : 'negative'}`}>
                        {stats.totalPL >= 0 ? '+' : ''}${stats.totalPL.toFixed(0)}
                      </span>
                      <span className="pq-label">Total P&L</span>
                    </div>
                    <div className="pq-stat">
                      <span className="pq-val">{earnedCount}</span>
                      <span className="pq-label">Badges</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Form */}
            <div className="profile-right">
              <div className="profile-card">
                <div className="profile-card-title">Edit Profile</div>

                <div className="profile-form">
                  <div className="pf-group">
                    <label className="pf-label">Display Name</label>
                    <input
                      className="pf-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name..."
                      maxLength={40}
                    />
                  </div>

                  <div className="pf-group">
                    <label className="pf-label">Trader Title</label>
                    <div className="pf-title-grid">
                      {TRADER_TITLES.map((t) => (
                        <button
                          key={t}
                          className={`pf-title-chip ${title === t ? 'selected' : ''}`}
                          onClick={() => setTitle(title === t ? '' : t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <input
                      className="pf-input"
                      style={{ marginTop: 10 }}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Or type a custom title..."
                      maxLength={40}
                    />
                  </div>

                  <div className="pf-group">
                    <label className="pf-label">Trading Motto</label>
                    <input
                      className="pf-input"
                      value={motto}
                      onChange={(e) => setMotto(e.target.value)}
                      placeholder="e.g. Process over profits..."
                      maxLength={80}
                    />
                    <span className="pf-hint">{motto.length}/80</span>
                  </div>

                  <div className="pf-actions">
                    <button
                      className="btn btn-primary"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                    {saveMsg && (
                      <span className={`save-msg ${saveMsg === 'Saved!' ? 'ok' : 'err'}`}>
                        {saveMsg}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: APPEARANCE
      ══════════════════════════════════════════════════ */}
      {activeTab === 'appearance' && (
        <div className="profile-tab-content">
          <div className="appearance-layout">
            {/* Accent Color */}
            <div className="profile-card appearance-card">
              <div className="profile-card-title">
                <img src={`${PUB}/palette.png`} alt="" className="card-title-icon" />
                Accent Color
              </div>
              <p className="appearance-desc">
                Choose the primary color used across the entire app — buttons, highlights, active states, and charts.
              </p>

              <div className="color-swatches">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className={`color-swatch ${accentColor === c.value ? 'selected' : ''}`}
                    style={{ '--swatch-color': c.value }}
                    onClick={() => handleColorSelect(c.value)}
                    title={c.name}
                  >
                    <div className="swatch-dot" />
                    <span className="swatch-name">{c.name}</span>
                  </button>
                ))}
              </div>

              <div className="custom-color-row">
                <label className="pf-label">Custom Color</label>
                <div className="custom-color-input-row">
                  <input
                    type="color"
                    className="custom-color-picker"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      handleColorSelect(e.target.value);
                    }}
                  />
                  <input
                    className="pf-input custom-color-hex"
                    value={customColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomColor(val);
                      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                        handleColorSelect(val);
                      }
                    }}
                    placeholder="#8670ff"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Live preview */}
              <div className="appearance-preview">
                <div className="preview-label">Preview</div>
                <div className="preview-row">
                  <button
                    className="btn btn-primary preview-btn"
                    style={{ background: accentColor }}
                  >
                    Primary Button
                  </button>
                  <div
                    className="preview-badge"
                    style={{
                      background: `${accentColor}22`,
                      color: accentColor,
                      border: `1px solid ${accentColor}44`,
                    }}
                  >
                    Active Badge
                  </div>
                  <div
                    className="preview-bar"
                    style={{ background: accentColor }}
                  />
                </div>
              </div>
            </div>

            {/* Save appearance */}
            <div className="appearance-save-row">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Appearance'}
              </button>
              {saveMsg && (
                <span className={`save-msg ${saveMsg === 'Saved!' ? 'ok' : 'err'}`}>
                  {saveMsg}
                </span>
              )}
              <span className="appearance-note">
                Changes apply immediately and persist across sessions.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: BADGES
      ══════════════════════════════════════════════════ */}
      {activeTab === 'badges' && (
        <div className="profile-tab-content">
          {/* Header stats */}
          <div className="badges-header">
            <div className="badges-progress-card">
              <div className="badges-progress-info">
                <span className="badges-earned-count">{earnedCount}</span>
                <span className="badges-total-count">/ {BADGES.length} Badges Earned</span>
              </div>
              <div className="badges-progress-bar">
                <div
                  className="badges-progress-fill"
                  style={{ width: `${(earnedCount / BADGES.length) * 100}%` }}
                />
              </div>
              <div className="badges-progress-pct">
                {Math.round((earnedCount / BADGES.length) * 100)}% Complete
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="badge-filter-bar">
            {['All', ...BADGE_CATEGORIES].map((cat) => (
              <button
                key={cat}
                className={`badge-filter-btn ${badgeFilter === cat ? 'active' : ''}`}
                onClick={() => setBadgeFilter(cat)}
              >
                {cat}
                <span className="badge-filter-count">
                  {cat === 'All'
                    ? BADGES.length
                    : BADGES.filter((b) => b.category === cat).length}
                </span>
              </button>
            ))}
          </div>

          {/* Badge grid */}
          <div className="badges-grid">
            {filteredBadges.map((badge) => {
              const earned = earnedBadges.includes(badge.id);
              return (
                <div
                  key={badge.id}
                  className={`badge-card ${earned ? 'earned' : 'locked'}`}
                >
                  <div className="badge-icon-wrap">
                    <img
                      src={`${PUB}/${badge.icon}`}
                      alt={badge.name}
                      className="badge-icon"
                    />
                    {earned && <div className="badge-earned-glow" />}
                    {!earned && <div className="badge-lock-overlay">🔒</div>}
                  </div>
                  <div className="badge-info">
                    <div className="badge-name">{badge.name}</div>
                    <div className="badge-desc">{badge.desc}</div>
                    <div className="badge-category-tag">{badge.category}</div>
                  </div>
                  {earned && (
                    <div className="badge-earned-check">✓</div>
                  )}
                </div>
              );
            })}
          </div>

          {!stats && (
            <div className="badges-loading">Loading your stats...</div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: DANGER ZONE
      ══════════════════════════════════════════════════ */}
      {activeTab === 'danger' && (
        <div className="profile-tab-content">
          <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Warning Banner */}
            <div style={{
              background: 'rgba(255,0,149,0.06)',
              border: '1px solid rgba(255,0,149,0.25)',
              borderRadius: 14, padding: '20px 24px',
              display: 'flex', gap: 16, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,0,149,0.12)',
                border: '1px solid rgba(255,0,149,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img
                  src={`${PUB}/trash-can.png`}
                  alt=""
                  style={{ width: 18, filter: 'invert(30%) sepia(100%) saturate(1000%) hue-rotate(300deg) brightness(1.1)' }}
                />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#ff0095', marginBottom: 6 }}>
                  Area Berbahaya
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  Tindakan di sini <strong style={{ color: 'var(--text-primary)' }}>tidak dapat dibatalkan</strong>.
                  Semua data trades, models, jurnal harian, dan settings akan dihapus permanen.
                  Akun default (Forward Test & Backtest) akan direset ke balance awal, akun custom akan dihapus.
                </div>
              </div>
            </div>

            {/* Reset Card */}
            <div className="profile-card" style={{ border: '1px solid rgba(255,0,149,0.15)' }}>
              <div className="profile-card-title" style={{ marginBottom: 8 }}>
                <img
                  src={`${PUB}/trash-can.png`}
                  alt=""
                  className="card-title-icon"
                  style={{ filter: 'invert(30%) sepia(100%) saturate(1000%) hue-rotate(300deg) brightness(1.1)' }}
                />
                Reset Semua Data
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                Menghapus seluruh data aplikasi dan mengembalikan ke kondisi fresh install.
                Data yang akan dihapus:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
                {[
                  { label: 'Semua Trades', count: stats ? `${stats.totalTrades} records` : '—' },
                  { label: 'Semua Trading Models', count: 'semua' },
                  { label: 'Semua Daily Journals', count: 'semua' },
                  { label: 'Education Slides', count: 'semua' },
                  { label: 'Settings & Profile', count: 'termasuk accent color' },
                  { label: 'Custom Accounts', count: 'Forward & Backtest direset' },
                ].map(({ label, count }) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px',
                    background: 'rgba(255,0,149,0.04)',
                    border: '1px solid rgba(255,0,149,0.1)',
                    borderRadius: 8,
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#ff0095', fontWeight: 600 }}>{count}</span>
                  </div>
                ))}
              </div>

              {/* Step 0 — Initial button */}
              {resetStep === 0 && (
                <>
                  <button
                    onClick={() => setResetStep(1)}
                    style={{
                      padding: '10px 24px', borderRadius: 8, cursor: 'pointer',
                      background: 'rgba(255,0,149,0.12)',
                      border: '1px solid rgba(255,0,149,0.35)',
                      color: '#ff0095', fontFamily: 'var(--font-display)',
                      fontSize: 14, fontWeight: 700, transition: 'all 0.15s',
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,0,149,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,0,149,0.12)'}
                  >
                    <img
                      src={`${PUB}/trash-can.png`}
                      alt=""
                      style={{ width: 14, filter: 'invert(30%) sepia(100%) saturate(1000%) hue-rotate(300deg) brightness(1.1)' }}
                    />
                    Reset Semua Data
                  </button>
                  {resetMsg.startsWith('✓') && (
                    <div style={{
                      marginTop: 14, padding: '12px 16px', borderRadius: 8,
                      background: 'rgba(0,229,160,0.08)',
                      border: '1px solid rgba(0,229,160,0.25)',
                      fontSize: 13, color: '#00e5a0', fontWeight: 600,
                    }}>
                      {resetMsg}
                    </div>
                  )}
                </>
              )}

              {/* Step 1 — First confirmation */}
              {resetStep === 1 && (
                <div style={{
                  background: 'rgba(255,170,0,0.07)',
                  border: '1px solid rgba(255,170,0,0.3)',
                  borderRadius: 10, padding: '20px',
                }}>
                  <div style={{ fontWeight: 700, color: '#ffaa00', marginBottom: 8, fontSize: 14 }}>
                    Kamu yakin ingin menghapus semua data?
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.6 }}>
                    Ini akan menghapus secara permanen{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {stats ? `${stats.totalTrades} trades` : 'semua trades'}
                    </strong>{' '}
                    dan seluruh data lainnya. Aksi ini tidak bisa dibatalkan.
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => setResetStep(0)}
                      style={{
                        padding: '9px 20px', borderRadius: 8, cursor: 'pointer',
                        background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
                        fontSize: 13, fontWeight: 600,
                      }}
                    >
                      Batalkan
                    </button>
                    <button
                      onClick={() => setResetStep(2)}
                      style={{
                        padding: '9px 20px', borderRadius: 8, cursor: 'pointer',
                        background: 'rgba(255,170,0,0.15)', border: '1px solid rgba(255,170,0,0.4)',
                        color: '#ffaa00', fontFamily: 'var(--font-display)',
                        fontSize: 13, fontWeight: 700,
                      }}
                    >
                      Ya, lanjutkan
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 — Final confirmation with typed input */}
              {resetStep === 2 && (
                <div style={{
                  background: 'rgba(255,0,149,0.07)',
                  border: '1px solid rgba(255,0,149,0.3)',
                  borderRadius: 10, padding: '20px',
                }}>
                  <div style={{ fontWeight: 700, color: '#ff0095', marginBottom: 8, fontSize: 14 }}>
                    Konfirmasi terakhir — ini tidak bisa dibatalkan!
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
                    Ketik{' '}
                    <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                      RESET
                    </strong>{' '}
                    di bawah untuk mengkonfirmasi penghapusan data.
                  </p>
                  <input
                    type="text"
                    value={resetInput}
                    onChange={e => { setResetInput(e.target.value); setResetMsg(''); }}
                    placeholder="Ketik RESET di sini..."
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleReset()}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      marginBottom: 12,
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      borderColor: resetInput === 'RESET' ? '#ff0095' : undefined,
                      boxShadow: resetInput === 'RESET' ? '0 0 0 2px rgba(255,0,149,0.2)' : undefined,
                    }}
                  />
                  {resetMsg && !resetMsg.startsWith('✓') && (
                    <div style={{ fontSize: 12, color: '#ffaa00', marginBottom: 12, fontWeight: 600 }}>
                      {resetMsg}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => { setResetStep(0); setResetInput(''); setResetMsg(''); }}
                      style={{
                        padding: '9px 20px', borderRadius: 8, cursor: 'pointer',
                        background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
                        fontSize: 13, fontWeight: 600,
                      }}
                    >
                      Batalkan
                    </button>
                    <button
                      onClick={handleReset}
                      disabled={resetLoading || resetInput !== 'RESET'}
                      style={{
                        padding: '9px 24px', borderRadius: 8,
                        cursor: resetInput === 'RESET' && !resetLoading ? 'pointer' : 'not-allowed',
                        background: resetInput === 'RESET' ? '#ff0095' : 'rgba(255,0,149,0.1)',
                        border: 'none',
                        color: resetInput === 'RESET' ? '#fff' : 'rgba(255,0,149,0.4)',
                        fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
                        opacity: resetLoading ? 0.6 : 1, transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      {resetLoading ? (
                        <>
                          <span style={{
                            width: 12, height: 12,
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderTopColor: '#fff',
                            borderRadius: '50%',
                            animation: 'spin 0.7s linear infinite',
                            display: 'inline-block',
                          }} />
                          Menghapus...
                        </>
                      ) : 'Hapus Semua Data'}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;