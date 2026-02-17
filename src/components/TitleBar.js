import React from 'react';
import './TitleBar.css';

const { ipcRenderer } = window.require('electron');
const PUB = process.env.PUBLIC_URL;

// Tiny inline SVG-style window controls using CSS shapes (no emoji, no unicode)
const MinimizeIcon = () => (
  <span style={{
    display: 'block', width: 12, height: 2,
    background: 'currentColor', borderRadius: 1,
  }} />
);

const MaximizeIcon = () => (
  <span style={{
    display: 'block', width: 11, height: 11,
    border: '1.5px solid currentColor', borderRadius: 2,
  }} />
);

const CloseIcon = () => (
  <img
    src={`${PUB}/trash-can.png`}
    alt="close"
    style={{ width: 14, height: 14, filter: 'invert(1) brightness(0.7)', display: 'block' }}
  />
);

function TitleBar() {
  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <div className="titlebar-logo">
          <img
            src={`${PUB}/flowjob-removebg-preview.png`}
            alt="Flowjob"
            className="logo-img"
          />
          <div className="logo-text">
            <span className="logo-name">Flowjob Journal</span>
            <span className="logo-tagline">Build Your System. Trade With Discipline.</span>
          </div>
        </div>
      </div>

      <div className="titlebar-controls">
        <button className="control-btn minimize" onClick={() => ipcRenderer.send('window-minimize')} title="Minimize">
          <MinimizeIcon />
        </button>
        <button className="control-btn maximize" onClick={() => ipcRenderer.send('window-maximize')} title="Maximize">
          <MaximizeIcon />
        </button>
        <button className="control-btn close" onClick={() => ipcRenderer.send('window-close')} title="Close">
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

export default TitleBar;