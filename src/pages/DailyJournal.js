import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';

const { ipcRenderer } = window.require('electron');
const PROFIT = '#8670ff';
const LOSS = '#ff0095';
const WARN = '#ffaa00';

function DailyJournal() {
  const [entries, setEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [entry, setEntry] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('pre'); // 'pre' or 'post'

  useEffect(() => {
    loadEntries();
  }, []);

  useEffect(() => {
    loadEntry(selectedDate);
  }, [selectedDate]);

  const loadEntries = async () => {
    const all = await ipcRenderer.invoke('get-daily-journals');
    setEntries(all || []);
  };

  const loadEntry = async (date) => {
    const found = await ipcRenderer.invoke('get-daily-journal', date);
    if (found) {
      setEntry(found);
      setEditMode(false);
      // Auto switch tab based on content
      if (found.execution_notes || found.what_worked) {
        setActiveTab('post');
      } else {
        setActiveTab('pre');
      }
    } else {
      setEntry({
        date,
        market_bias: '',
        planned_setups: '',
        risk_plan: '',
        emotional_state_pre: '',
        pre_market_image: null,
        execution_notes: '',
        what_worked: '',
        what_didnt_work: '',
        lessons_learned: '',
        emotional_state_post: '',
        post_session_image: null,
        discipline_score: 5,
      });
      setEditMode(true);
      setActiveTab('pre');
    }
  };

  const saveEntry = async () => {
    await ipcRenderer.invoke('save-daily-journal', entry);
    loadEntries();
    setEditMode(false);
  };

  const deleteEntry = async () => {
    if (window.confirm('Delete this journal entry?')) {
      await ipcRenderer.invoke('delete-daily-journal', selectedDate);
      loadEntries();
      loadEntry(selectedDate);
    }
  };

  const updateField = (field, value) => {
    setEntry({ ...entry, [field]: value });
  };

  const handleImageUpload = async (field) => {
    const filePath = await ipcRenderer.invoke('select-file');
    if (filePath) {
      const saved = await ipcRenderer.invoke('save-screenshot', filePath);
      updateField(field, saved);
    }
  };

  // Calculate stats
  const completedEntries = entries.filter(e => e.discipline_score);
  const avgDiscipline = completedEntries.length > 0
    ? (completedEntries.reduce((sum, e) => sum + (e.discipline_score || 0), 0) / completedEntries.length)
    : 0;
  
  // Discipline streak
  let streak = 0;
  const sortedEntries = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const e of sortedEntries) {
    if (e.discipline_score >= 7) streak++;
    else break;
  }

  const recentDates = entries.slice(0, 10);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Daily Journal</h1>
        <p className="page-subtitle">Pre-market plan & post-session reflection</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
        {/* Enhanced Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stats Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(134,112,255,0.08), rgba(255,0,149,0.04))',
            border: '1px solid rgba(134,112,255,0.2)',
            borderRadius: 14,
            padding: 20,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
              📊 STATS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <StatItem label="Avg Discipline" value={avgDiscipline.toFixed(1)} suffix="/10" color={avgDiscipline >= 7 ? PROFIT : avgDiscipline >= 5 ? WARN : LOSS} />
              <StatItem label="Discipline Streak" value={streak} suffix={` day${streak !== 1 ? 's' : ''}`} color={streak >= 5 ? PROFIT : WARN} />
              <StatItem label="Total Entries" value={entries.length} suffix="" color="var(--text-primary)" />
            </div>
          </div>

          {/* Date Picker */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: 20,
          }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'block' }}>
              SELECT DATE
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ width: '100%', fontSize: 14 }}
            />
          </div>

          {/* Recent Entries */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: '16px 12px',
            maxHeight: 400,
            overflowY: 'auto',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12, padding: '0 8px' }}>
              RECENT ENTRIES
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recentDates.map((e) => (
                <button
                  key={e.date}
                  onClick={() => setSelectedDate(e.date)}
                  style={{
                    background: selectedDate === e.date ? 'rgba(134,112,255,0.12)' : 'transparent',
                    border: `1px solid ${selectedDate === e.date ? 'rgba(134,112,255,0.3)' : 'transparent'}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                    fontSize: 13,
                    color: selectedDate === e.date ? PROFIT : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(ev) => {
                    if (selectedDate !== e.date) {
                      ev.target.style.background = 'var(--bg-tertiary)';
                      ev.target.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(ev) => {
                    if (selectedDate !== e.date) {
                      ev.target.style.background = 'transparent';
                      ev.target.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 3, fontSize: 13 }}>
                    {new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: (e.discipline_score || 0) >= 7 ? PROFIT : (e.discipline_score || 0) >= 4 ? WARN : LOSS }} />
                    Score: {e.discipline_score || '—'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h2>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {entry?.id ? `Entry ID: ${entry.id}` : 'New entry'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {entry?.id && !editMode && (
                    <>
                      <button className="btn btn-secondary" onClick={() => setEditMode(true)}>
                        <Icon name="edit" size={13} style={{ marginRight: 6 }} /> Edit
                      </button>
                      <button className="btn btn-danger" onClick={deleteEntry}>
                        <Icon name="delete" size={13} style={{ marginRight: 6 }} /> Delete
                      </button>
                    </>
                  )}
                  {editMode && (
                    <>
                      <button className="btn btn-secondary" onClick={() => {
                        setEditMode(false);
                        loadEntry(selectedDate);
                      }}>
                        Cancel
                      </button>
                      <button className="btn btn-primary" onClick={saveEntry}>
                        <Icon name="save" size={13} style={{ marginRight: 6 }} /> Save Entry
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}>
              <Tab label="🌅 Pre-Market Plan" active={activeTab === 'pre'} onClick={() => setActiveTab('pre')} color={PROFIT} />
              <Tab label="🌙 Post-Session Reflection" active={activeTab === 'post'} onClick={() => setActiveTab('post')} color={LOSS} />
            </div>

            {/* Content */}
            <div style={{ padding: 28 }}>
              {entry && (
                <>
                  {activeTab === 'pre' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      <FieldCard
                        label="Market Bias"
                        icon="📈"
                        placeholder="Bullish, Bearish, or Neutral? Why?"
                        value={entry.market_bias}
                        onChange={(v) => updateField('market_bias', v)}
                        disabled={!editMode}
                      />
                      <FieldCard
                        label="Planned Setups"
                        icon="🎯"
                        placeholder="Which models are you watching? What conditions are you looking for?"
                        value={entry.planned_setups}
                        onChange={(v) => updateField('planned_setups', v)}
                        disabled={!editMode}
                        rows={4}
                      />
                      <FieldCard
                        label="Risk Plan"
                        icon="🛡️"
                        placeholder="Max loss today? Max trades? Position sizing rules?"
                        value={entry.risk_plan}
                        onChange={(v) => updateField('risk_plan', v)}
                        disabled={!editMode}
                        rows={3}
                      />
                      <FieldCard
                        label="Emotional State"
                        icon="🧠"
                        placeholder="How are you feeling? Calm, anxious, confident, tired?"
                        value={entry.emotional_state_pre}
                        onChange={(v) => updateField('emotional_state_pre', v)}
                        disabled={!editMode}
                      />
                      
                      {/* Pre-market image */}
                      <ImageUploadCard
                        label="Chart Screenshot / Setup Image"
                        imagePath={entry.pre_market_image}
                        onUpload={() => handleImageUpload('pre_market_image')}
                        onRemove={() => updateField('pre_market_image', null)}
                        disabled={!editMode}
                      />
                    </div>
                  )}

                  {activeTab === 'post' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      <FieldCard
                        label="Execution Notes"
                        icon="⚡"
                        placeholder="Did you follow your plan? Any deviations? Were you disciplined?"
                        value={entry.execution_notes}
                        onChange={(v) => updateField('execution_notes', v)}
                        disabled={!editMode}
                        rows={4}
                      />
                      <FieldCard
                        label="What Worked"
                        icon="✅"
                        placeholder="What went well today? What should you repeat?"
                        value={entry.what_worked}
                        onChange={(v) => updateField('what_worked', v)}
                        disabled={!editMode}
                        rows={3}
                      />
                      <FieldCard
                        label="What Didn't Work"
                        icon="❌"
                        placeholder="What needs improvement? What mistakes did you make?"
                        value={entry.what_didnt_work}
                        onChange={(v) => updateField('what_didnt_work', v)}
                        disabled={!editMode}
                        rows={3}
                      />
                      <FieldCard
                        label="Lessons Learned"
                        icon="💡"
                        placeholder="Key takeaways from today that will make you a better trader"
                        value={entry.lessons_learned}
                        onChange={(v) => updateField('lessons_learned', v)}
                        disabled={!editMode}
                        rows={3}
                      />
                      <FieldCard
                        label="Emotional State"
                        icon="😌"
                        placeholder="How do you feel after today's session?"
                        value={entry.emotional_state_post}
                        onChange={(v) => updateField('emotional_state_post', v)}
                        disabled={!editMode}
                      />
                      
                      {/* Post-session image */}
                      <ImageUploadCard
                        label="Results Screenshot"
                        imagePath={entry.post_session_image}
                        onUpload={() => handleImageUpload('post_session_image')}
                        onRemove={() => updateField('post_session_image', null)}
                        disabled={!editMode}
                      />

                      {/* Discipline Score */}
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(134,112,255,0.06), rgba(255,0,149,0.03))',
                        border: '1px solid rgba(134,112,255,0.2)',
                        borderRadius: 12,
                        padding: 20,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                          ⭐ Discipline Score
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={entry.discipline_score}
                            onChange={(e) => updateField('discipline_score', parseInt(e.target.value))}
                            disabled={!editMode}
                            style={{
                              flex: 1,
                              height: 8,
                              borderRadius: 4,
                              appearance: 'none',
                              background: `linear-gradient(to right, ${entry.discipline_score >= 7 ? PROFIT : entry.discipline_score >= 4 ? WARN : LOSS} 0%, ${entry.discipline_score >= 7 ? PROFIT : entry.discipline_score >= 4 ? WARN : LOSS} ${entry.discipline_score * 10}%, var(--bg-elevated) ${entry.discipline_score * 10}%, var(--bg-elevated) 100%)`,
                            }}
                          />
                          <div style={{
                            fontSize: 36,
                            fontWeight: 900,
                            fontFamily: 'var(--font-mono)',
                            color: entry.discipline_score >= 7 ? PROFIT : entry.discipline_score >= 4 ? WARN : LOSS,
                            minWidth: 65,
                            textAlign: 'center',
                            lineHeight: 1,
                          }}>
                            {entry.discipline_score}
                          </div>
                        </div>
                        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                          1 = Poor discipline · 10 = Perfect execution
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components
function StatItem({ label, value, suffix, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)', color }}>
        {value}<span style={{ fontSize: 11, fontWeight: 600 }}>{suffix}</span>
      </span>
    </div>
  );
}

function Tab({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '14px 20px',
        background: active ? 'var(--bg-secondary)' : 'transparent',
        border: 'none',
        borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        fontFamily: 'var(--font-display)',
        fontSize: 14,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.target.style.background = 'var(--bg-tertiary)';
          e.target.style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.target.style.background = 'transparent';
          e.target.style.color = 'var(--text-muted)';
        }
      }}
    >
      {label}
    </button>
  );
}

function FieldCard({ label, icon, placeholder, value, onChange, disabled, rows = 2 }) {
  const isTextarea = rows > 2;
  const Tag = isTextarea ? 'textarea' : 'input';
  
  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      border: '1px solid var(--border-color)',
      borderRadius: 10,
      padding: 18,
    }}>
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        {label}
      </label>
      <Tag
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={isTextarea ? rows : undefined}
        style={{
          width: '100%',
          fontSize: 14,
          padding: '12px 14px',
          background: disabled ? 'rgba(0,0,0,0.2)' : 'var(--bg-secondary)',
          border: `1px solid ${disabled ? 'transparent' : 'var(--border-color)'}`,
          borderRadius: 8,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          lineHeight: 1.6,
          resize: isTextarea ? 'vertical' : undefined,
        }}
      />
    </div>
  );
}

function ImageUploadCard({ label, imagePath, onUpload, onRemove, disabled }) {
  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      border: '1px solid var(--border-color)',
      borderRadius: 10,
      padding: 18,
    }}>
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: 12,
      }}>
        📷 {label}
      </label>
      
      {imagePath ? (
        <div style={{ position: 'relative' }}>
          <img
            src={`file://${imagePath}`}
            alt="uploaded"
            style={{
              width: '100%',
              maxHeight: 300,
              objectFit: 'contain',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              background: '#000',
            }}
          />
          {!disabled && (
            <button
              onClick={onRemove}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'rgba(255,0,149,0.9)',
                border: 'none',
                borderRadius: 6,
                padding: '6px 12px',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
              }}
            >
              Remove
            </button>
          )}
        </div>
      ) : (
        !disabled && (
          <button
            onClick={onUpload}
            style={{
              width: '100%',
              padding: '40px 20px',
              background: 'rgba(134,112,255,0.05)',
              border: '2px dashed rgba(134,112,255,0.3)',
              borderRadius: 8,
              color: 'var(--text-secondary)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(134,112,255,0.1)';
              e.target.style.borderColor = 'rgba(134,112,255,0.5)';
              e.target.style.color = PROFIT;
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(134,112,255,0.05)';
              e.target.style.borderColor = 'rgba(134,112,255,0.3)';
              e.target.style.color = 'var(--text-secondary)';
            }}
          >
            📷 Click to upload image
          </button>
        )
      )}
    </div>
  );
}

export default DailyJournal;