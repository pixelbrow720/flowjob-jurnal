import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Education.css';

const { ipcRenderer } = window.require('electron');
const EDIT_PASSWORD = '140700';

const PHASE_COLORS = {
  'Intensive Learning':      '#8670ff',
  'Backtest & Validation':   '#ffaa00',
  'Forward Test':            '#00d4ff',
  'Refinement & Adjustment': '#ff0095',
};

const SLIDE_TYPE_LABELS = { intro: 'Intro', concept: 'Concept', homework: 'Task' };

// ─────────────────────────────────────────────────────────────────────────────
export default function Education() {
  const [weeks, setWeeks]               = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [slides, setSlides]             = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading]           = useState(true);

  const [isEditMode, setIsEditMode]         = useState(false);
  const [authModal, setAuthModal]           = useState(false);
  const [passwordInput, setPasswordInput]   = useState('');
  const [passwordError, setPasswordError]   = useState('');

  const [editingSlide, setEditingSlide]     = useState(null);
  const [editContent, setEditContent]       = useState({});
  const [addSlideModal, setAddSlideModal]   = useState(false);
  const [newSlide, setNewSlide]             = useState({ title: '', body: '', type: 'concept', imagePlaceholder: '' });
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(null);

  const slideRef = useRef(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadWeeks = useCallback(async () => {
    const data = await ipcRenderer.invoke('get-education-weeks');
    setWeeks(data || []);
    setLoading(false);
  }, []);

  const loadSlides = useCallback(async (weekNum) => {
    const data = await ipcRenderer.invoke('get-education-slides', weekNum);
    setSlides(data || []);
    setCurrentSlide(0);
    setEditingSlide(null);
  }, []);

  useEffect(() => { loadWeeks(); }, [loadWeeks]);
  useEffect(() => { loadSlides(selectedWeek); }, [selectedWeek, loadSlides]);

  const currentWeek      = weeks.find(w => w.week_number === selectedWeek);
  const phaseColor       = PHASE_COLORS[currentWeek?.phase] || '#8670ff';
  const currentSlideData = slides[currentSlide];

  const goToSlide = (idx) => {
    if (idx >= 0 && idx < slides.length) setCurrentSlide(idx);
  };

  // ── Auth ──────────────────────────────────────────────────────────────────

  const openAuthModal = () => {
    setAuthModal(true);
    setPasswordInput('');
    setPasswordError('');
  };

  const confirmAuth = () => {
    if (passwordInput === EDIT_PASSWORD) {
      setIsEditMode(true);
      setAuthModal(false);
    } else {
      setPasswordError('Password salah. Coba lagi.');
      setPasswordInput('');
    }
  };

  // ── Add slide ─────────────────────────────────────────────────────────────

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

  // ── Edit slide ────────────────────────────────────────────────────────────

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

  // ── Delete slide ──────────────────────────────────────────────────────────

  const deleteSlide = async (slideId) => {
    const newIndex = Math.max(0, currentSlide - 1);
    await ipcRenderer.invoke('delete-education-slide', slideId);
    await loadSlides(selectedWeek);
    setCurrentSlide(newIndex);
    setConfirmDeleteModal(null);
  };

  // ── Image upload ──────────────────────────────────────────────────────────

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

  // ── Loading state ─────────────────────────────────────────────────────────

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
            <p className="page-subtitle">Materi Bootcamp Orderflow — Kurikulum 3 Bulan</p>
          </div>
          {isEditMode ? (
            <button className="edu-edit-mode-btn edu-edit-mode-btn--active" onClick={() => { setIsEditMode(false); setEditingSlide(null); }}>
              <span className="edu-edit-mode-dot" /> Edit Mode Aktif — Klik untuk keluar
            </button>
          ) : (
            <button className="edu-edit-mode-btn" onClick={openAuthModal}>Edit Mode</button>
          )}
        </div>
      </div>

      <div className="edu-layout">

        {/* Sidebar */}
        <div className="edu-sidebar">
          <div className="edu-sidebar-label">Minggu</div>
          {weeks.map(w => {
            const pc         = PHASE_COLORS[w.phase] || '#8670ff';
            const isSelected = w.week_number === selectedWeek;
            return (
              <button key={w.week_number}
                className={`edu-week-btn ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedWeek(w.week_number)}
                style={{ borderColor: isSelected ? `${pc}44` : undefined, background: isSelected ? `${pc}11` : undefined, color: isSelected ? pc : undefined }}
              >
                <span className="edu-week-num">W{w.week_number}</span>
                <span className="edu-week-title">{w.title}</span>
              </button>
            );
          })}
        </div>

        {/* Main */}
        <div className="edu-main">

          {/* Week header */}
          <div className="edu-week-header" style={{ borderColor: `${phaseColor}44` }}>
            <div className="edu-week-header-left">
              <div className="edu-phase-badge" style={{ background: `${phaseColor}22`, color: phaseColor, borderColor: `${phaseColor}44` }}>
                {currentWeek?.phase}
              </div>
              <h2 className="edu-week-heading">Minggu {selectedWeek}: {currentWeek?.title}</h2>
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

          {/* Empty state */}
          {slides.length === 0 ? (
            <div className="edu-empty">
              <div className="edu-empty-line" />
              <div className="edu-empty-title">Belum ada konten untuk minggu ini</div>
              <div className="edu-empty-sub">
                {isEditMode
                  ? 'Tambahkan slide pertama untuk mulai mengisi materi minggu ini.'
                  : 'Konten belum tersedia. Masuk ke Edit Mode untuk menambahkan materi.'}
              </div>
              {isEditMode && (
                <button className="btn btn-primary" onClick={() => setAddSlideModal(true)} style={{ marginTop: 16 }}>
                  + Tambah Slide Pertama
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Slide dots */}
              <div className="edu-slide-dots">
                {slides.map((s, i) => (
                  <button key={s.id}
                    className={`edu-dot ${i === currentSlide ? 'active' : ''}`}
                    onClick={() => goToSlide(i)} title={s.title}
                    style={{ background: i === currentSlide ? phaseColor : undefined }}
                  />
                ))}
              </div>

              {/* Slide content */}
              {currentSlideData && (
                <div className="edu-slide" ref={slideRef}>

                  {editingSlide === currentSlideData.id ? (
                    /* Edit form */
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
                        <textarea value={editContent.body || ''} onChange={e => setEditContent(p => ({ ...p, body: e.target.value }))} rows={18} />
                      </div>
                      <div className="edu-edit-row">
                        <label>Image Placeholder</label>
                        <input type="text" value={editContent.imagePlaceholder || ''} onChange={e => setEditContent(p => ({ ...p, imagePlaceholder: e.target.value }))} placeholder="[PLACEHOLDER: deskripsi gambar...]" />
                      </div>
                      <div className="edu-edit-actions">
                        <button className="btn btn-secondary" onClick={() => setEditingSlide(null)}>Batal</button>
                        <button className="btn btn-primary" onClick={saveEdit}>Simpan</button>
                      </div>
                    </div>

                  ) : (
                    /* View mode */
                    <>
                      <div className="edu-slide-header">
                        <div className="edu-slide-type-badge" style={{ color: phaseColor, borderColor: `${phaseColor}44`, background: `${phaseColor}11` }}>
                          {SLIDE_TYPE_LABELS[currentSlideData.type] || currentSlideData.type}
                        </div>
                        <div className="edu-slide-num">{currentSlide + 1} / {slides.length}</div>
                        {isEditMode && (
                          <div className="edu-slide-actions">
                            <button className="edu-action-btn" onClick={() => startEdit(currentSlideData)}>Edit</button>
                            <button className="edu-action-btn edu-action-delete" onClick={() => setConfirmDeleteModal(currentSlideData)}>Remove</button>
                          </div>
                        )}
                      </div>

                      <h2 className="edu-slide-title" style={{ color: phaseColor }}>{currentSlideData.title}</h2>
                      <div className="edu-slide-body">{renderBody(currentSlideData.body)}</div>

                      {/* Image area */}
                      {currentSlideData.image ? (
                        <div className="edu-image-container">
                          <img src={`file://${currentSlideData.image}`} alt={currentSlideData.title} className="edu-image" />
                          {isEditMode && (
                            <div className="edu-image-overlay">
                              <button className="edu-img-action-btn" onClick={() => handleImageUpload(currentSlide)}>Ganti Gambar</button>
                              <button className="edu-img-action-btn edu-img-remove-btn" onClick={() => handleImageRemove(currentSlide)}>Hapus</button>
                            </div>
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

              {/* Navigation */}
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

      {/* Auth Modal */}
      {authModal && (
        <div className="edu-modal-overlay" onClick={() => setAuthModal(false)}>
          <div className="edu-modal" onClick={e => e.stopPropagation()}>
            <div className="edu-modal-title">Edit Mode</div>
            <div className="edu-modal-sub">Masukkan password untuk mengaktifkan edit mode.</div>
            <input type="password" value={passwordInput} className="edu-modal-input" autoFocus
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(''); }}
              onKeyDown={e => e.key === 'Enter' && confirmAuth()}
              placeholder="Password..." />
            {passwordError && <div className="edu-modal-error">{passwordError}</div>}
            <div className="edu-modal-actions">
              <button className="btn btn-secondary" onClick={() => setAuthModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={confirmAuth}>Masuk</button>
            </div>
          </div>
        </div>
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