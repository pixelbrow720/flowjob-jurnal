import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Education.css';

const { ipcRenderer } = window.require('electron');
const crypto           = window.require('crypto');

// ─── PASSWORD HASHES (SHA-256) ────────────────────────────────────────────────
const h = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ADMIN hash
const ADMIN_HASH  = '69f33d08a6a095996e164219c615b68397961d6f01a0e65fdbdd68e1933a36d1';

// STUDENT hash
const ACCESS_HASH = '22ddc5f9a7c9ded7ca8379628e8d6c2ac88363e8275e0f90c7ff8425d1d47618';

// Per-week hashes — bagikan password aslinya ke murid sesuai progress
const WEEK_HASHES = {
  1:  '41c9aa5876dd960a4e3578cb561aeb22ba6654dc4c66f0e5a6e3d4e077a116f3', 
  2:  'afa81aebad49147e354551d3e2ae69abf9dea12afcaab5375e4533b288ae0e5b', 
  3:  '2c4186b6d16b60307dadd9c8004a54397f6c72c7a689d49bf8400e93ca127107', 
  4:  '059aa9664b3ad496df9acb6ac0148b4416ba701a99bb89673a6a76d6fff99556', 
  5:  '3116a57435ef36376d26eff5cd8e32a9f69ae6bd5358085d3d68338fba48964e', 
  6:  '3e3c7c47457c014bce0efad1a7643f5c7c28bdc4e7e448abcbf5996492e6115f', 
  7:  'd7488bea2f44bf4557ad9ee52244b3942d28389cb14aa5d7151580b6c0639035', 
  8:  '2e7f3a5dd59950f43c47e26347fc324c54796b29f2670c274956249a73ba6274', 
  9:  'b1e41ddc609df311a21dd9a27fd4fa22f00261eb745888c362b15e17403792bb', 
  10: '5d4716e22d7e7281602aaebb6ccb753ff05c60d9e1eeafb50a0f991a32ddd439', 
  11: 'c4caf4be588f1edf99d87eb60e1fbd1e183ff69ad712e68fbe82a0251d20291e', 
  12: 'f48ec9018718a3b887afcd4086a543772ff5177f46ecd7a4dc96b0a7169c8aa5', 
};

// ─────────────────────────────────────────────────────────────────────────────

const PHASE_COLORS = {
  'Intensive Learning':      '#8670ff',
  'Backtest & Validation':   '#ffaa00',
  'Forward Test':            '#00d4ff',
  'Refinement & Adjustment': '#ff0095',
};

const SLIDE_TYPE_LABELS = { intro: 'Intro', concept: 'Concept', homework: 'Task' };

// ─── Shake Hook ───────────────────────────────────────────────────────────────
function useShake() {
  const [shaking, setShaking] = useState(false);
  const trigger = () => { setShaking(true); setTimeout(() => setShaking(false), 500); };
  return [shaking, trigger];
}

// ─── Entry Gate ───────────────────────────────────────────────────────────────
// Handles both ADMIN and STUDENT login in one screen
function EntryGate({ onUnlock }) {
  const [input, setInput]     = useState('');
  const [error, setError]     = useState('');
  const [shake, triggerShake] = useShake();
  const inputRef              = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = () => {
    const hashed = h(input);
    if (hashed === ADMIN_HASH) {
      // Admin masuk → unlock semua, edit mode aktif
      onUnlock({ isAdmin: true });
    } else if (hashed === ACCESS_HASH) {
      // Student masuk → per-week lock aktif
      onUnlock({ isAdmin: false });
    } else {
      setError('Password salah. Coba lagi.');
      triggerShake();
      setInput('');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 20, padding: '48px 40px', width: 420, maxWidth: '90vw',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        animation: 'modalIn 0.22s ease',
      }}>

        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'rgba(134,112,255,0.12)',
          border: '1px solid rgba(134,112,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
        }}>🎓</div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            Education Center
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
            Area khusus bootcamp. Masukkan password untuk melanjutkan.
          </div>
        </div>

        <div style={{ width: '100%', animation: shake ? 'shakeX 0.4s ease' : 'none' }}>
          <input
            ref={inputRef}
            type="password"
            value={input}
            onChange={e => { setInput(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Masukkan password..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg-tertiary)',
              border: `1px solid ${error ? '#ff0095' : 'var(--border-color)'}`,
              borderRadius: 10, padding: '12px 16px', fontSize: 16,
              color: 'var(--text-primary)', fontFamily: 'var(--font-display)',
              outline: 'none', letterSpacing: '0.15em', textAlign: 'center',
              transition: 'border-color 0.15s',
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: '#ff0095', fontWeight: 600, textAlign: 'center', marginTop: 8 }}>
              {error}
            </div>
          )}
        </div>

        <button className="btn btn-primary" onClick={handleSubmit}
          style={{ width: '100%', padding: '12px', fontSize: 15, fontWeight: 700 }}>
          Masuk
        </button>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.5 }}>
          Flowjob Journal — Bootcamp Module
        </div>
      </div>

      <style>{`
        @keyframes shakeX {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
        @keyframes modalIn {
          from { opacity:0; transform:scale(0.94) translateY(-10px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Week Unlock Modal ────────────────────────────────────────────────────────
function WeekUnlockModal({ weekNumber, weekTitle, phaseColor, onUnlock, onClose }) {
  const [input, setInput]     = useState('');
  const [error, setError]     = useState('');
  const [shake, triggerShake] = useShake();
  const inputRef              = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = () => {
    if (h(input) === WEEK_HASHES[weekNumber]) {
      onUnlock(weekNumber);
    } else {
      setError('Password week salah. Minta ke mentor kamu!');
      triggerShake();
      setInput('');
    }
  };

  return (
    <div className="edu-modal-overlay" onClick={onClose}>
      <div className="edu-modal" onClick={e => e.stopPropagation()}
        style={{ alignItems: 'center' }}>

        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: `${phaseColor}18`, border: `1px solid ${phaseColor}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>🔒</div>

        <div style={{ textAlign: 'center' }}>
          <div className="edu-modal-title" style={{ textAlign: 'center' }}>
            Week {weekNumber} Terkunci
          </div>
          <div className="edu-modal-sub" style={{ textAlign: 'center' }}>
            <strong style={{ color: phaseColor }}>{weekTitle}</strong><br />
            Masukkan password week ini dari mentor kamu.
          </div>
        </div>

        <div style={{ width: '100%', animation: shake ? 'shakeX 0.4s ease' : 'none' }}>
          <input
            ref={inputRef}
            type="password"
            value={input}
            className="edu-modal-input"
            style={{
              width: '100%', boxSizing: 'border-box',
              borderColor: error ? '#ff0095' : undefined,
              textAlign: 'center', letterSpacing: '0.15em',
            }}
            onChange={e => { setInput(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Password week..."
          />
          {error && (
            <div className="edu-modal-error" style={{ textAlign: 'center', marginTop: 6 }}>{error}</div>
          )}
        </div>

        <div className="edu-modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={handleSubmit}
            style={{ background: phaseColor, border: 'none' }}>
            Unlock Week {weekNumber}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Education() {
  const [session, setSession] = useState(null); // null | { isAdmin: boolean }

  if (!session) {
    return <EntryGate onUnlock={(s) => setSession(s)} />;
  }
  return <EducationContent isAdmin={session.isAdmin} />;
}

// ─── Education Content ────────────────────────────────────────────────────────
function EducationContent({ isAdmin }) {
  const [weeks, setWeeks]               = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [slides, setSlides]             = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading]           = useState(true);

  // Admin → semua week langsung terbuka. Student → hanya week 1
  const [unlockedWeeks, setUnlockedWeeks]     = useState(isAdmin ? new Set(Array.from({length: 12}, (_, i) => i + 1)) : new Set([1]));
  const [weekUnlockModal, setWeekUnlockModal] = useState(null);

  // Admin → edit mode langsung aktif. Student → tidak
  const [isEditMode, setIsEditMode] = useState(isAdmin);

  const [editingSlide, setEditingSlide]   = useState(null);
  const [editContent, setEditContent]     = useState({});
  const [addSlideModal, setAddSlideModal] = useState(false);
  const [newSlide, setNewSlide]           = useState({ title: '', body: '', type: 'concept', imagePlaceholder: '' });
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(null);

  const slideRef = useRef(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadWeeks = useCallback(async () => {
    try {
      const data = await ipcRenderer.invoke('get-education-weeks');
      const list = data || [];
      setWeeks(list);
      if (list.length > 0) setSelectedWeek(list[0].week_number);
      // Kalau admin, pastikan semua week ke-unlock setelah data masuk
      if (isAdmin) {
        setUnlockedWeeks(new Set(list.map(w => w.week_number)));
      }
    } catch (err) {
      console.error('Failed to load education weeks:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const loadSlides = useCallback(async (weekNum) => {
    try {
      const data = await ipcRenderer.invoke('get-education-slides', weekNum);
      setSlides(data || []);
      setCurrentSlide(0);
      setEditingSlide(null);
    } catch (err) {
      console.error('Failed to load slides:', err);
      setSlides([]);
    }
  }, []);

  useEffect(() => { loadWeeks(); }, [loadWeeks]);
  useEffect(() => { if (selectedWeek) loadSlides(selectedWeek); }, [selectedWeek, loadSlides]);

  const currentWeek      = weeks.find(w => w.week_number === selectedWeek);
  const phaseColor       = PHASE_COLORS[currentWeek?.phase] || '#8670ff';
  const currentSlideData = slides[currentSlide];

  // ── Week selection ────────────────────────────────────────────────────────

  const handleSelectWeek = (week) => {
    if (isEditMode || unlockedWeeks.has(week.week_number)) {
      setSelectedWeek(week.week_number);
    } else {
      const pc = PHASE_COLORS[week.phase] || '#8670ff';
      setWeekUnlockModal({ weekNumber: week.week_number, weekTitle: week.title, phaseColor: pc });
    }
  };

  const handleWeekUnlock = (weekNumber) => {
    setUnlockedWeeks(prev => new Set([...prev, weekNumber]));
    setSelectedWeek(weekNumber);
    setWeekUnlockModal(null);
  };

  const goToSlide = (idx) => {
    if (idx >= 0 && idx < slides.length) setCurrentSlide(idx);
  };

  // ── Toggle Edit Mode (tanpa password) ────────────────────────────────────

  const toggleEditMode = () => {
    const next = !isEditMode;
    setIsEditMode(next);
    setEditingSlide(null);
    if (next) {
      // Masuk edit mode → buka semua week
      setUnlockedWeeks(new Set(weeks.map(w => w.week_number)));
    } else if (!isAdmin) {
      // Keluar edit mode (student) → reset ke week 1 saja
      setUnlockedWeeks(new Set([1]));
      setSelectedWeek(weeks[0]?.week_number ?? 1);
    }
  };

  // ── Slide CRUD ────────────────────────────────────────────────────────────

  const addSlide = async () => {
    const slide = {
      id:               `s${selectedWeek}-${Date.now()}`,
      weekNumber:       selectedWeek,
      slideOrder:       slides.length,
      type:             newSlide.type,
      title:            newSlide.title || 'Slide Baru',
      body:             newSlide.body  || '',
      image:            null,
      imagePlaceholder: newSlide.imagePlaceholder || null,
    };
    await ipcRenderer.invoke('upsert-education-slide', slide);
    await loadSlides(selectedWeek);
    setCurrentSlide(slides.length);
    setAddSlideModal(false);
    setNewSlide({ title: '', body: '', type: 'concept', imagePlaceholder: '' });
  };

  const startEdit = (slide) => {
    setEditingSlide(slide.id);
    setEditContent({
      type:             slide.type,
      title:            slide.title,
      body:             slide.body || '',
      imagePlaceholder: slide.image_placeholder || '',
    });
  };

  const saveEdit = async () => {
    const slide = slides.find(s => s.id === editingSlide);
    if (!slide) return;
    await ipcRenderer.invoke('upsert-education-slide', {
      id:               slide.id,
      weekNumber:       slide.week_number,
      slideOrder:       slide.slide_order,
      type:             editContent.type,
      title:            editContent.title,
      body:             editContent.body,
      image:            slide.image || null,
      imagePlaceholder: editContent.imagePlaceholder || null,
    });
    await loadSlides(selectedWeek);
    setEditingSlide(null);
  };

  const deleteSlide = async (slideId) => {
    const newIndex = Math.max(0, currentSlide - 1);
    await ipcRenderer.invoke('delete-education-slide', slideId);
    await loadSlides(selectedWeek);
    setCurrentSlide(newIndex);
    setConfirmDeleteModal(null);
  };

  const handleImageUpload = async (idx) => {
    try {
      const filePath = await ipcRenderer.invoke('select-file');
      if (!filePath) return;
      const savedPath = await ipcRenderer.invoke('save-screenshot', filePath);
      const s = slides[idx];
      await ipcRenderer.invoke('upsert-education-slide', {
        id: s.id, weekNumber: s.week_number, slideOrder: s.slide_order,
        type: s.type, title: s.title, body: s.body,
        image: savedPath, imagePlaceholder: s.image_placeholder || null,
      });
      await loadSlides(selectedWeek);
    } catch (err) { console.error('Image upload failed:', err); }
  };

  const handleImageRemove = async (idx) => {
    const s = slides[idx];
    await ipcRenderer.invoke('upsert-education-slide', {
      id: s.id, weekNumber: s.week_number, slideOrder: s.slide_order,
      type: s.type, title: s.title, body: s.body,
      image: null, imagePlaceholder: s.image_placeholder || null,
    });
    await loadSlides(selectedWeek);
  };

  // ── Render body ───────────────────────────────────────────────────────────

  const renderBody = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**'))
        return <p key={i} className="edu-body-heading">{line.replace(/\*\*/g, '')}</p>;
      if (line.startsWith('• ') || line.startsWith('→ ') || line.startsWith('+ ')) {
        const fmt = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <li key={i} className="edu-body-li" dangerouslySetInnerHTML={{ __html: fmt }} />;
      }
      if (/^\d+\. /.test(line)) {
        const fmt = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <li key={i} className="edu-body-li edu-body-li-num" dangerouslySetInnerHTML={{ __html: fmt }} />;
      }
      if (line.startsWith('---')) return <hr key={i} className="edu-body-divider" />;
      if (line === '') return <br key={i} />;
      const fmt = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
      return <p key={i} className="edu-body-p" dangerouslySetInnerHTML={{ __html: fmt }} />;
    });
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="edu-wrap fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Memuat data...</div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="edu-wrap fade-in">

      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Education Center</h1>
            <p className="page-subtitle">
              Materi Bootcamp Orderflow — Kurikulum 3 Bulan
              {isAdmin && (
                <span style={{
                  marginLeft: 10, fontSize: 11, fontWeight: 700,
                  background: 'rgba(134,112,255,0.15)',
                  color: '#8670ff', border: '1px solid rgba(134,112,255,0.3)',
                  borderRadius: 6, padding: '2px 8px', letterSpacing: '0.3px',
                }}>
                  ADMIN
                </span>
              )}
            </p>
          </div>

          {/* Tombol Edit Mode — toggle langsung, tanpa password */}
          <button
            className={`edu-edit-mode-btn ${isEditMode ? 'edu-edit-mode-btn--active' : ''}`}
            onClick={toggleEditMode}
          >
            {isEditMode
              ? <><span className="edu-edit-mode-dot" /> Edit Mode Aktif — Klik untuk keluar</>
              : 'Edit Mode'
            }
          </button>
        </div>
      </div>

      <div className="edu-layout">

        {/* Sidebar */}
        <div className="edu-sidebar">
          <div className="edu-sidebar-label">Minggu</div>
          {weeks.map(w => {
            const pc         = PHASE_COLORS[w.phase] || '#8670ff';
            const isSelected = w.week_number === selectedWeek;
            const isLocked   = !isEditMode && !unlockedWeeks.has(w.week_number);

            return (
              <button
                key={w.week_number}
                className={`edu-week-btn ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelectWeek(w)}
                style={{
                  borderColor: isSelected ? `${pc}44` : undefined,
                  background:  isSelected ? `${pc}11` : isLocked ? 'rgba(255,255,255,0.02)' : undefined,
                  color:       isSelected ? pc : isLocked ? 'var(--text-muted)' : undefined,
                  opacity:     isLocked ? 0.6 : 1,
                }}
              >
                <span className="edu-week-num">W{w.week_number}</span>
                <span className="edu-week-title">{w.title}</span>
                {!isEditMode && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, flexShrink: 0 }}>
                    {isLocked ? '🔒' : '✓'}
                  </span>
                )}
              </button>
            );
          })}

          {!isAdmin && !isEditMode && (
            <div style={{
              marginTop: 12, padding: '8px 10px',
              background: 'rgba(134,112,255,0.06)',
              border: '1px solid rgba(134,112,255,0.15)',
              borderRadius: 10, fontSize: 11,
              color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6,
            }}>
              {unlockedWeeks.size} / {weeks.length} week terbuka
            </div>
          )}
        </div>

        {/* Main */}
        <div className="edu-main">

          {currentWeek && (
            <div className="edu-week-header" style={{ borderColor: `${phaseColor}44` }}>
              <div className="edu-week-header-left">
                <div className="edu-phase-badge" style={{ background: `${phaseColor}22`, color: phaseColor, borderColor: `${phaseColor}44` }}>
                  {currentWeek.phase}
                </div>
                <h2 className="edu-week-heading">Minggu {selectedWeek}: {currentWeek.title}</h2>
              </div>
              <div className="edu-week-header-right">
                <div className="edu-slide-count">{slides.length} slide{slides.length !== 1 ? 's' : ''}</div>
                {isEditMode && (
                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setAddSlideModal(true)}>
                    + Tambah Slide
                  </button>
                )}
              </div>
            </div>
          )}

          {slides.length === 0 ? (
            <div className="edu-empty">
              <div className="edu-empty-line" />
              <div className="edu-empty-title">Belum ada konten untuk minggu ini</div>
              <div className="edu-empty-sub">
                {isEditMode
                  ? 'Tambahkan slide pertama untuk mulai mengisi materi minggu ini.'
                  : 'Konten belum tersedia. Hubungi mentor kamu.'}
              </div>
              {isEditMode && (
                <button className="btn btn-primary" onClick={() => setAddSlideModal(true)} style={{ marginTop: 16 }}>
                  + Tambah Slide Pertama
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="edu-slide-dots">
                {slides.map((s, i) => (
                  <button key={s.id}
                    className={`edu-dot ${i === currentSlide ? 'active' : ''}`}
                    onClick={() => goToSlide(i)} title={s.title}
                    style={{ background: i === currentSlide ? phaseColor : undefined }}
                  />
                ))}
              </div>

              {currentSlideData && (
                <div className="edu-slide" ref={slideRef}>
                  {editingSlide === currentSlideData.id ? (
                    <div className="edu-edit-form">
                      <div className="edu-edit-row">
                        <label>Tipe Slide</label>
                        <select value={editContent.type} onChange={e => setEditContent(p => ({ ...p, type: e.target.value }))}>
                          <option value="intro">Intro</option>
                          <option value="concept">Concept</option>
                          <option value="homework">Task</option>
                        </select>
                      </div>
                      <div className="edu-edit-row">
                        <label>Judul</label>
                        <input type="text" value={editContent.title || ''} onChange={e => setEditContent(p => ({ ...p, title: e.target.value }))} />
                      </div>
                      <div className="edu-edit-row">
                        <label>Konten (gunakan **bold**, • bullet, → arrow, --- divider)</label>
                        <textarea value={editContent.body || ''} onChange={e => setEditContent(p => ({ ...p, body: e.target.value }))} rows={14} />
                      </div>
                      <div className="edu-edit-row">
                        <label>Image Placeholder (opsional)</label>
                        <input type="text" value={editContent.imagePlaceholder || ''} onChange={e => setEditContent(p => ({ ...p, imagePlaceholder: e.target.value }))} placeholder="[PLACEHOLDER: deskripsi gambar]" />
                      </div>
                      <div className="edu-edit-actions">
                        <button className="btn btn-secondary" onClick={() => setEditingSlide(null)}>Batal</button>
                        <button className="btn btn-primary" onClick={saveEdit}>Simpan</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="edu-slide-header">
                        <span className="edu-slide-type-badge" style={{ background: `${phaseColor}22`, color: phaseColor }}>
                          {SLIDE_TYPE_LABELS[currentSlideData.type] || currentSlideData.type}
                        </span>
                        <span className="edu-slide-index">{currentSlide + 1} / {slides.length}</span>
                        {isEditMode && (
                          <div className="edu-slide-actions">
                            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => startEdit(currentSlideData)}>Edit</button>
                            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px', color: '#ff0095' }} onClick={() => setConfirmDeleteModal(currentSlideData)}>Hapus</button>
                          </div>
                        )}
                      </div>

                      <h3 className="edu-slide-title">{currentSlideData.title}</h3>
                      <div className="edu-slide-body">{renderBody(currentSlideData.body)}</div>

                      {currentSlideData.image ? (
                        <div className="edu-image-container">
                          <img src={`file://${currentSlideData.image}`} alt="slide" className="edu-image" />
                          {isEditMode && (
                            <button className="edu-image-remove" onClick={() => handleImageRemove(currentSlide)}>✕ Hapus Gambar</button>
                          )}
                        </div>
                      ) : (
                        (currentSlideData.image_placeholder || isEditMode) && (
                          <div
                            className={`edu-image-placeholder ${isEditMode ? 'edu-image-placeholder-clickable' : ''}`}
                            onClick={() => isEditMode && handleImageUpload(currentSlide)}
                          >
                            {currentSlideData.image_placeholder ? (
                              <>
                                <div className="edu-img-label">{isEditMode ? 'Klik untuk upload gambar' : 'Image Placeholder'}</div>
                                <div className="edu-img-desc">{currentSlideData.image_placeholder}</div>
                                {isEditMode && <div className="edu-img-upload-hint">+ Upload Image</div>}
                              </>
                            ) : isEditMode && (
                              <>
                                <div className="edu-img-label">Tambah Gambar (opsional)</div>
                                <div className="edu-img-upload-hint">+ Upload Image</div>
                              </>
                            )}
                          </div>
                        )
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="edu-nav">
                <button className="edu-nav-btn" onClick={() => goToSlide(currentSlide - 1)} disabled={currentSlide === 0}>Prev</button>
                <div className="edu-nav-progress">
                  {slides.map((_, i) => (
                    <div key={i} className={`edu-nav-pip ${i <= currentSlide ? 'filled' : ''}`}
                      style={{ background: i <= currentSlide ? phaseColor : undefined }}
                      onClick={() => goToSlide(i)} />
                  ))}
                </div>
                <button className="edu-nav-btn" onClick={() => goToSlide(currentSlide + 1)} disabled={currentSlide === slides.length - 1}>Next</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Week Unlock Modal */}
      {weekUnlockModal && (
        <WeekUnlockModal
          weekNumber={weekUnlockModal.weekNumber}
          weekTitle={weekUnlockModal.weekTitle}
          phaseColor={weekUnlockModal.phaseColor}
          onUnlock={handleWeekUnlock}
          onClose={() => setWeekUnlockModal(null)}
        />
      )}

      {/* Add Slide Modal */}
      {addSlideModal && (
        <div className="edu-modal-overlay" onClick={() => setAddSlideModal(false)}>
          <div className="edu-modal edu-modal-large" onClick={e => e.stopPropagation()}>
            <div className="edu-modal-title">Tambah Slide Baru</div>
            <div className="edu-edit-row">
              <label>Tipe</label>
              <select value={newSlide.type} onChange={e => setNewSlide(p => ({ ...p, type: e.target.value }))}>
                <option value="intro">Intro</option>
                <option value="concept">Concept</option>
                <option value="homework">Task</option>
              </select>
            </div>
            <div className="edu-edit-row">
              <label>Judul Slide</label>
              <input type="text" value={newSlide.title} autoFocus
                onChange={e => setNewSlide(p => ({ ...p, title: e.target.value }))}
                placeholder="Judul slide..." />
            </div>
            <div className="edu-edit-row">
              <label>Konten</label>
              <textarea value={newSlide.body}
                onChange={e => setNewSlide(p => ({ ...p, body: e.target.value }))}
                placeholder="Tulis materi... Gunakan **bold**, • bullet, → arrow" rows={10} />
            </div>
            <div className="edu-edit-row">
              <label>Image Placeholder (opsional)</label>
              <input type="text" value={newSlide.imagePlaceholder}
                onChange={e => setNewSlide(p => ({ ...p, imagePlaceholder: e.target.value }))}
                placeholder="[PLACEHOLDER: deskripsi gambar]" />
            </div>
            <div className="edu-modal-actions">
              <button className="btn btn-secondary" onClick={() => setAddSlideModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={addSlide}>+ Tambah</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDeleteModal && (
        <div className="edu-modal-overlay" onClick={() => setConfirmDeleteModal(null)}>
          <div className="edu-modal" onClick={e => e.stopPropagation()}>
            <div className="edu-modal-title">Hapus Slide?</div>
            <div className="edu-modal-sub">"{confirmDeleteModal.title}" akan dihapus permanen dari database.</div>
            <div className="edu-modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteModal(null)}>Batal</button>
              <button className="btn btn-primary" style={{ background: '#ff0095', border: 'none' }}
                onClick={() => deleteSlide(confirmDeleteModal.id)}>Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}