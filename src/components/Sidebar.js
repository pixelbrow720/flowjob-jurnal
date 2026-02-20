import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Sidebar.css';

const { ipcRenderer, shell } = window.require('electron');
const PUB = process.env.PUBLIC_URL;

const navItems = [
  { path: '/',              label: 'Dashboard',      icon: `${PUB}/graph-bar.png` },
  { path: '/accounts',      label: 'Accounts',       icon: `${PUB}/briefcase.png` },
  { path: '/models',        label: 'Trading Models', icon: `${PUB}/target.png` },
  { path: '/journal',       label: 'Trade Journal',  icon: `${PUB}/book.png` },
  { path: '/daily-journal', label: 'Daily Journal',  icon: `${PUB}/pencil.png` },
  { path: '/analytics',     label: 'Analytics',      icon: `${PUB}/a.png` },
  { path: '/calendar',      label: 'Calendar P&L',   icon: `${PUB}/calendar.png` },
  { path: '/risk',          label: 'Trading Rules',  icon: `${PUB}/balance.png` },
  { path: '/education',     label: 'Education',      icon: `${PUB}/book.png` },
];

const DISCORD_URL = 'https://discord.com/invite/SjtNdPvPTZ';

function Sidebar() {
  const [stats, setStats] = useState(null);
  const location = useLocation();

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, [location]);

  const loadStats = async () => {
    try {
      const data = await ipcRenderer.invoke('get-analytics', {});
      setStats(data);
    } catch (e) {}
  };

  const winRate = stats ? `${stats.winRate.toFixed(1)}%` : '—';
  const totalPL = stats
    ? (stats.totalPL >= 0 ? `+$${stats.totalPL.toFixed(0)}` : `-$${Math.abs(stats.totalPL).toFixed(0)}`)
    : '—';
  const plClass = stats ? (stats.totalPL >= 0 ? 'positive' : 'negative') : '';

  const handleDiscord = () => {
    shell.openExternal(DISCORD_URL);
  };

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">
              <img src={item.icon} alt={item.label} className="nav-icon-img" />
            </span>
            <span className="nav-label">{item.label}</span>
            <div className="nav-indicator" />
          </NavLink>
        ))}

        {/* ── Discord ── */}
        <div className="discord-divider" />
        <button className="nav-item discord-nav-item" onClick={handleDiscord}>
          <span className="nav-icon discord-icon-wrap">
            <img
              src={`${PUB}/discord.png`}
              alt="Discord"
              className="nav-icon-img discord-icon-img"
            />
          </span>
          <span className="nav-label">Discord Community</span>
          <span className="discord-badge">JOIN</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="footer-stats-grid">
          <div className="footer-stat-item">
            <span className="footer-stat-label">Trades</span>
            <span className="footer-stat-val">{stats ? stats.totalTrades : '—'}</span>
          </div>
          <div className="footer-stat-item">
            <span className="footer-stat-label">Win Rate</span>
            <span className="footer-stat-val">{winRate}</span>
          </div>
          <div className="footer-stat-item wide">
            <span className="footer-stat-label">Total P&L</span>
            <span className={`footer-stat-val ${plClass}`}>{totalPL}</span>
          </div>
          {stats && (
            <div className="footer-stat-item wide">
              <span className="footer-stat-label">Profit Factor</span>
              <span className="footer-stat-val">
                {stats.profitFactor >= 9999 ? '∞' : stats.profitFactor.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;