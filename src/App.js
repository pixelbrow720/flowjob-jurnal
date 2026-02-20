import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Models from './pages/Models';
import Journal from './pages/Journal';
import Analytics from './pages/Analytics';
import Accounts from './pages/Accounts';
import CalendarPnL from './pages/CalendarPnL';
import TradingRules from './pages/TradingRules';
import DailyJournal from './pages/DailyJournal';
import Education from './pages/Education';
import Profile from './pages/Profile';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

const { ipcRenderer } = window.require('electron');

function App() {
  useEffect(() => {
    ipcRenderer.invoke('get-setting', 'user_profile').then((raw) => {
      if (raw) {
        try {
          const p = JSON.parse(raw);
          if (p.accentColor) {
            document.documentElement.style.setProperty('--accent-primary', p.accentColor);
            document.documentElement.style.setProperty('--profit-color', p.accentColor);
          }
        } catch (e) {}
      }
    });
  }, []);

  return (
    <Router>
      <div className="app">
        <TitleBar />
        <div className="app-container">
          <Sidebar />
          <main className="main-content">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/models" element={<Models />} />
                <Route path="/journal" element={<Journal />} />
                <Route path="/daily-journal" element={<DailyJournal />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/calendar" element={<CalendarPnL />} />
                <Route path="/risk" element={<TradingRules />} />
                <Route path="/education" element={<Education />} />
                <Route path="/profile" element={<Profile />} />
              </Routes>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;