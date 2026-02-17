import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Models from './pages/Models';
import Journal from './pages/Journal';
import Analytics from './pages/Analytics';
import Accounts from './pages/Accounts';
import CalendarPnL from './pages/CalendarPnL';
import RiskDashboard from './pages/RiskDashboard';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <TitleBar />
        <div className="app-container">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/models" element={<Models />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/calendar" element={<CalendarPnL />} />
              <Route path="/risk" element={<RiskDashboard />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;