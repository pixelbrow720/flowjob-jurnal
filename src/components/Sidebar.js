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
  { path: '/profile',       label: 'My Profile',     icon: `${PUB}/user.png` },
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
            <img src={item.icon} alt="" className="nav-icon" />
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-stats">
        <div className="sidebar-stat">
          <span className="sidebar-stat-label">Win Rate</span>
          <span className="sidebar-stat-value">{winRate}</span>
        </div>
        <div className="sidebar-stat">
          <span className="sidebar-stat-label">Net P/L</span>
          <span className={`sidebar-stat-value ${plClass}`}>{totalPL}</span>
        </div>
      </div>

      <button className="discord-btn" onClick={handleDiscord}>
        Join Discord
      </button>
    </aside>
  );
}

export default Sidebar;