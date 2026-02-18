import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', padding: 40, gap: 16,
        }}>
          <div style={{
            background: 'rgba(255,0,149,0.08)',
            border: '1px solid rgba(255,0,149,0.3)',
            borderRadius: 14, padding: '28px 36px', maxWidth: 520, textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e8edf3', marginBottom: 8 }}>
              Terjadi Error di Halaman Ini
            </h2>
            <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6, marginBottom: 16 }}>
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                background: '#8670ff', border: 'none', borderRadius: 8,
                padding: '10px 24px', color: '#fff', fontWeight: 700,
                fontSize: 14, cursor: 'pointer', fontFamily: 'Outfit,sans-serif',
              }}>
              Coba Lagi
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;