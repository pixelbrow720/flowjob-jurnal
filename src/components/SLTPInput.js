/**
 * SLTPInput.js
 * 
 * Drop-in component for SL / TP fields in the Trade Form.
 * 
 * Props:
 *   slValue       {string|number}  - current SL value
 *   tpValue       {string|number}  - current TP value (optional)
 *   slMode        {'points'|'price'} - current mode
 *   onSlChange    (value) => void
 *   onTpChange    (value) => void
 *   onModeChange  (mode)  => void
 *   entryPrice    {number}  - optional, used to preview distance when in price mode
 *   direction     {'Long'|'Short'} - optional, used for visual indicator
 * 
 * Integration in your existing form:
 *   Replace the SL/TP inputs with:
 *     <SLTPInput
 *       slValue={form.sl_points}
 *       tpValue={form.tp_points}
 *       slMode={form.slMode || 'points'}
 *       onSlChange={v => setForm(f => ({ ...f, sl_points: v }))}
 *       onTpChange={v => setForm(f => ({ ...f, tp_points: v }))}
 *       onModeChange={m => setForm(f => ({ ...f, slMode: m }))}
 *       entryPrice={form.entry_price}
 *       direction={form.direction}
 *     />
 */

// BUG FIX: tambahkan useEffect ke import
import React, { useState, useEffect, useCallback } from 'react';

/* ── Valid price decimals for futures ─────────────────────── */
const VALID_DECIMALS = [0, 0.25, 0.5, 0.75];

/**
 * Snap a number to the nearest valid futures price decimal (.00 .25 .50 .75)
 */
function snapToValidDecimal(raw) {
  if (raw === '' || raw == null) return '';
  const num   = parseFloat(raw);
  if (isNaN(num)) return raw;
  const floor = Math.floor(num);
  const frac  = +(num - floor).toFixed(4);
  // Find nearest valid decimal
  let best = 0, bestDiff = Infinity;
  VALID_DECIMALS.forEach(d => {
    const diff = Math.abs(frac - d);
    if (diff < bestDiff) { bestDiff = diff; best = d; }
  });
  const result = floor + best;
  return +result.toFixed(2);
}

/**
 * Validate that the decimal part of a price is exactly .00 .25 .50 or .75
 */
function isValidPriceDecimal(val) {
  if (val === '' || val == null) return true; // empty = ok (optional field)
  const num  = parseFloat(val);
  if (isNaN(num)) return false;
  const frac = +(num % 1).toFixed(4);
  return VALID_DECIMALS.includes(Math.abs(frac));
}

/* ── Mode Toggle ─────────────────────────────────────────── */
const ModeToggle = ({ mode, onChange }) => (
  <div style={{
    display: 'flex',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: 2,
    gap: 2,
    marginBottom: 10,
    width: 'fit-content',
  }}>
    {['points', 'price'].map(m => (
      <button
        key={m}
        type="button"
        onClick={() => onChange(m)}
        style={{
          padding: '5px 14px',
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-display)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.3px',
          transition: 'all 0.15s',
          background:  mode === m ? '#8670ff' : 'transparent',
          color:       mode === m ? '#000'    : 'var(--text-muted)',
          textTransform: 'uppercase',
        }}>
        {m === 'points' ? 'Points' : 'Price'}
      </button>
    ))}
  </div>
);

/* ── Price Input with decimal validation ─────────────────── */
const PriceInput = ({ label, value, onChange, error, required, placeholder }) => {
  const [raw, setRaw] = useState(value != null ? String(value) : '');

  // BUG FIX #1: Sync raw state ketika prop value berubah dari parent.
  // Sebelumnya useState hanya diinit sekali saat mount, sehingga ketika
  // parent mengganti trade yang diedit (value prop berubah), input tetap
  // menampilkan nilai trade lama. useEffect ini memastikan raw selalu
  // up-to-date dengan prop terbaru.
  useEffect(() => {
    setRaw(value != null ? String(value) : '');
  }, [value]);

  const handleChange = (e) => {
    setRaw(e.target.value);
    onChange(e.target.value);
  };

  const handleBlur = () => {
    if (raw === '') { onChange(''); return; }
    const snapped = snapToValidDecimal(raw);
    setRaw(snapped === '' ? '' : String(snapped));
    onChange(snapped);
  };

  return (
    <div className="form-group" style={{ margin: 0 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}
        {required && <span style={{ color: '#ff0095', fontSize: 10 }}>*</span>}
        <span style={{
          fontSize: 9, background: 'rgba(134,112,255,0.12)',
          color: '#8670ff', padding: '1px 6px', borderRadius: 4,
          fontWeight: 700, letterSpacing: '0.3px',
        }}>
          .00 .25 .50 .75
        </span>
      </label>
      <input
        type="number"
        step="0.25"
        min="0"
        value={raw}
        placeholder={placeholder || '0.00'}
        onChange={handleChange}
        onBlur={handleBlur}
        style={{
          borderColor: error ? '#ff0095' : undefined,
          boxShadow:   error ? '0 0 0 1px rgba(255,0,149,0.3)' : undefined,
        }}
      />
      {error && (
        <div style={{
          fontSize: 11, color: '#ff0095', marginTop: 4,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span>⚠</span> Decimal must be .00, .25, .50, or .75
        </div>
      )}
    </div>
  );
};

/* ── Points Input ────────────────────────────────────────── */
const PointsInput = ({ label, value, onChange, required, placeholder }) => (
  <div className="form-group" style={{ margin: 0 }}>
    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {label}
      {required && <span style={{ color: '#ff0095', fontSize: 10 }}>*</span>}
      <span style={{
        fontSize: 9, background: 'rgba(0,194,255,0.1)',
        color: '#00c2ff', padding: '1px 6px', borderRadius: 4,
        fontWeight: 700, letterSpacing: '0.3px',
      }}>
        pts
      </span>
    </label>
    <input
      type="number"
      step="0.25"
      min="0"
      value={value || ''}
      placeholder={placeholder || '0'}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

/* ── Distance Preview ───────────────────────────────────── */
const DistancePreview = ({ entryPrice, slValue, tpValue, direction, mode }) => {
  if (!entryPrice || mode !== 'price') return null;
  const ep = parseFloat(entryPrice);
  const sl = parseFloat(slValue);
  const tp = parseFloat(tpValue);
  if (isNaN(ep)) return null;

  const slDist = !isNaN(sl) ? Math.abs(ep - sl) : null;
  const tpDist = !isNaN(tp) ? Math.abs(ep - tp) : null;

  const isLong   = direction === 'Long';
  const slValid  = !isNaN(sl) && (isLong ? sl < ep : sl > ep);
  const tpValid  = !isNaN(tp) && (isLong ? tp > ep : tp < ep);

  if (slDist == null && tpDist == null) return null;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 8, padding: '10px 14px',
      marginTop: 8,
      display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Distance from entry
      </span>
      {slDist != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff0095' }} />
          <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, color: slValid ? '#ff0095' : '#ffaa00' }}>
            SL: {slDist.toFixed(2)} pts
          </span>
          {!slValid && direction && (
            <span style={{ fontSize: 10, color: '#ffaa00' }}>
              ⚠ {isLong ? 'should be below entry' : 'should be above entry'}
            </span>
          )}
        </div>
      )}
      {tpDist != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8670ff' }} />
          <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, color: tpValid ? '#8670ff' : '#ffaa00' }}>
            TP: {tpDist.toFixed(2)} pts
          </span>
          {!tpValid && direction && (
            <span style={{ fontSize: 10, color: '#ffaa00' }}>
              ⚠ {isLong ? 'should be above entry' : 'should be below entry'}
            </span>
          )}
        </div>
      )}
      {slDist != null && tpDist != null && slDist > 0 && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>R:R</span>
          <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono,monospace', fontWeight: 800, color: '#8670ff' }}>
            1 : {(tpDist / slDist).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function SLTPInput({
  slValue,
  tpValue,
  slMode = 'points',
  onSlChange,
  onTpChange,
  onModeChange,
  entryPrice,
  direction,
}) {
  const [slError, setSlError] = useState(false);
  const [tpError, setTpError] = useState(false);

  const handleSlChange = useCallback((val) => {
    if (slMode === 'price') {
      setSlError(val !== '' && !isValidPriceDecimal(val));
    }
    onSlChange(val);
  }, [slMode, onSlChange]);

  const handleTpChange = useCallback((val) => {
    if (slMode === 'price') {
      setTpError(val !== '' && !isValidPriceDecimal(val));
    }
    onTpChange(val);
  }, [slMode, onTpChange]);

  const handleModeChange = (mode) => {
    setSlError(false);
    setTpError(false);
    // Clear values when switching modes to avoid type confusion
    onSlChange('');
    onTpChange('');
    onModeChange(mode);
  };

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          SL / TP Mode
        </span>
        <ModeToggle mode={slMode} onChange={handleModeChange} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {slMode === 'points'
            ? 'Enter distance in points/ticks'
            : 'Enter exact price level (decimals: .00 .25 .50 .75)'}
        </span>
      </div>

      {/* Inputs */}
      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {slMode === 'points' ? (
          <>
            <PointsInput
              label="Stop Loss"
              required
              value={slValue}
              onChange={handleSlChange}
              placeholder="e.g. 10"
            />
            <PointsInput
              label="Take Profit"
              value={tpValue}
              onChange={handleTpChange}
              placeholder="e.g. 20 (optional)"
            />
          </>
        ) : (
          <>
            <PriceInput
              label="Stop Loss Price"
              required
              value={slValue}
              onChange={handleSlChange}
              error={slError}
              placeholder="e.g. 4950.25"
            />
            <PriceInput
              label="Take Profit Price"
              value={tpValue}
              onChange={handleTpChange}
              error={tpError}
              placeholder="e.g. 5000.75 (optional)"
            />
          </>
        )}
      </div>

      {/* Distance preview (price mode only) */}
      <DistancePreview
        entryPrice={entryPrice}
        slValue={slValue}
        tpValue={tpValue}
        direction={direction}
        mode={slMode}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   UTILITY: Convert price SL/TP → points (for DB storage)
   Call this before saving the trade.
   
   Usage:
     const { sl_points, tp_points } = priceToPoints({
       slPrice: form.sl_value,
       tpPrice: form.tp_value,
       entryPrice: form.entry_price,
       mode: form.slMode,
     });
────────────────────────────────────────────────────────── */
export function priceToPoints({ slPrice, tpPrice, entryPrice, mode }) {
  if (mode === 'points') {
    return {
      sl_points: slPrice ? parseFloat(slPrice) : null,
      tp_points: tpPrice ? parseFloat(tpPrice) : null,
    };
  }
  // price mode: convert to points distance
  const ep = parseFloat(entryPrice);
  if (isNaN(ep)) {
    return { sl_points: null, tp_points: null };
  }
  const sl = slPrice ? parseFloat(slPrice) : null;
  const tp = tpPrice ? parseFloat(tpPrice) : null;
  return {
    sl_points: sl != null && !isNaN(sl) ? +Math.abs(ep - sl).toFixed(4) : null,
    tp_points: tp != null && !isNaN(tp) ? +Math.abs(ep - tp).toFixed(4) : null,
    sl_price:  sl,
    tp_price:  tp,
  };
}