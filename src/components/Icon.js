/**
 * Reusable icon component — uses PNG files from /public
 * Usage: <Icon name="trash" size={16} color="loss" />
 */
import React from 'react';

const PUB = process.env.PUBLIC_URL;

// Map logical name → PNG filename in /public
const ICON_MAP = {
  // Nav / pages
  'dashboard':     'graph-bar.png',
  'accounts':      'briefcase.png',
  'models':        'target.png',
  'journal':       'book.png',
  'analytics':     'a.png',
  'calendar':      'calendar.png',
  'risk':          'balance.png',
  // Actions
  'edit':          'pencil.png',
  'delete':        'trash-can.png',
  'preview':       'eye.png',
  'photo':         'eye.png',
  'save':          'pencil.png',
  'target':        'target.png',
  'warning':       'balance.png',
  'help':          'balance.png',
  // Charts / data
  'chart':         'graph-bar.png',
  'equity':        'rise.png',
  'up':            'rise.png',
  'drawdown':      'trend.png',
  'down':          'trend.png',
  'balance':       'balance.png',
  // Profile & Settings
  'user':          'user.png',
  'profile':       'user.png',
  'palette':       'palette.png',
  'settings':      'settings-gears.png',
  'medals':        'medals.png',
  'fire':          'fire.png',
  // Badge icons
  'badge-sharp':   'sharp.png',
  'badge-profit':  'profit.png',
  'badge-profits': 'profits.png',
  'badge-trading': 'trading.png',
  'badge-chart':   'chart.png',
  'badge-success': 'success.png',
  'badge-consist': 'consistency.png',
  'badge-dedic':   'dedication.png',
};

// CSS filter values for each "color" prop
const FILTER_MAP = {
  default:  'invert(1) brightness(0.7)',
  muted:    'invert(1) brightness(0.4)',
  bright:   'invert(1) brightness(1)',
  profit:   'invert(58%) sepia(60%) saturate(500%) hue-rotate(210deg) brightness(1.1)',  // #8670ff
  loss:     'invert(30%) sepia(100%) saturate(1000%) hue-rotate(300deg) brightness(1.1)', // #ff0095
  warning:  'invert(70%) sepia(100%) saturate(500%) hue-rotate(5deg) brightness(1.1)',   // #ffaa00
  active:   'invert(58%) sepia(60%) saturate(500%) hue-rotate(210deg) brightness(1.1)',
};

function Icon({ name, size = 16, color = 'default', style = {}, className = '', alt = '' }) {
  const file = ICON_MAP[name] || ICON_MAP['chart'];
  const filter = FILTER_MAP[color] || FILTER_MAP['default'];
  return (
    <img
      src={`${PUB}/${file}`}
      alt={alt || name}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        filter,
        flexShrink: 0,
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style,
      }}
    />
  );
}

export default Icon;