import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';

const { ipcRenderer } = window.require('electron');
const PROFIT = '#8670ff';
const LOSS = '#ff0095';

function DailyJournal() {
  const [entries, setEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [entry, setEntry] = useState(null);
  const [editMode, setEditMode] = useState(false);

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
    } else {
      setEntry({
        date,
        market_bias: '',
        planned_setups: '',
        risk_plan: '',
        emotional_state_pre: '',
        execution_notes: '',
        what_worked: '',
        what_didnt_work: '',
        lessons_learned: '',
        emotional_state_post: '',
        discipline_score: 5,
      });
      setEditMode(true);
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

  const recentDates = entries.slice(0, 10);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Daily Journal</h1>
        <p className="page-subtitle">Pre-market plan and post-session reflection</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
        {/* Date Sidebar */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: 20,
          height: 'fit-content',
        }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
              SELECT DATE
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ width: '100%', fontSize: 14 }}
            />
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, marginTop: 24 }}>
            RECENT ENTRIES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentDates.map((e) => (
              <button
                key={e.date}
                onClick={() => setSelectedDate(e.date)}
                style={{
                  background: selectedDate === e.date ? 'rgba(134,112,255,0.12)' : 'transparent',
                  border: `1px solid ${selectedDate === e.date ? 'rgba(134,112,255,0.3)' : 'var(--border-color)'}`,
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
                <div style={{ fontWeight: 600, marginBottom: 3 }}>
                  {new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Discipline: {e.discipline_score}/10
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: 28,
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {entry?.id ? 'Entry saved' : 'New entry'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {entry?.id && !editMode && (
                  <>
                    <button className="btn btn-secondary" onClick={() => setEditMode(true)}>
                      <Icon name="edit" size={14} style={{ marginRight: 6 }} /> Edit
                    </button>
                    <button className="btn btn-danger" onClick={deleteEntry}>
                      <Icon name="delete" size={14} style={{ marginRight: 6 }} /> Delete
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
                      <Icon name="save" size={14} style={{ marginRight: 6 }} /> Save
                    </button>
                  </>
                )}
              </div>
            </div>

            {entry && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {/* Pre-Market Section */}
                <Section title="🌅 Pre-Market Plan" color={PROFIT}>
                  <Field
                    label="Market Bias"
                    placeholder="Bullish/Bearish/Neutral — what's your directional bias?"
                    value={entry.market_bias}
                    onChange={(v) => updateField('market_bias', v)}
                    disabled={!editMode}
                  />
                  <Field
                    label="Planned Setups"
                    placeholder="Which models are you watching? What conditions are you looking for?"
                    value={entry.planned_setups}
                    onChange={(v) => updateField('planned_setups', v)}
                    disabled={!editMode}
                    rows={4}
                  />
                  <Field
                    label="Risk Plan"
                    placeholder="Max loss today? How many trades max? Position sizing?"
                    value={entry.risk_plan}
                    onChange={(v) => updateField('risk_plan', v)}
                    disabled={!editMode}
                    rows={3}
                  />
                  <Field
                    label="Emotional State (Pre)"
                    placeholder="How are you feeling? Calm, anxious, confident?"
                    value={entry.emotional_state_pre}
                    onChange={(v) => updateField('emotional_state_pre', v)}
                    disabled={!editMode}
                  />
                </Section>

                {/* Post-Session Section */}
                <Section title="🌙 Post-Session Reflection" color={LOSS}>
                  <Field
                    label="Execution Notes"
                    placeholder="Did you follow your plan? Any deviations?"
                    value={entry.execution_notes}
                    onChange={(v) => updateField('execution_notes', v)}
                    disabled={!editMode}
                    rows={4}
                  />
                  <Field
                    label="What Worked"
                    placeholder="What went well today?"
                    value={entry.what_worked}
                    onChange={(v) => updateField('what_worked', v)}
                    disabled={!editMode}
                    rows={3}
                  />
                  <Field
                    label="What Didn't Work"
                    placeholder="What needs improvement?"
                    value={entry.what_didnt_work}
                    onChange={(v) => updateField('what_didnt_work', v)}
                    disabled={!editMode}
                    rows={3}
                  />
                  <Field
                    label="Lessons Learned"
                    placeholder="Key takeaways from today"
                    value={entry.lessons_learned}
                    onChange={(v) => updateField('lessons_learned', v)}
                    disabled={!editMode}
                    rows={3}
                  />
                  <Field
                    label="Emotional State (Post)"
                    placeholder="How do you feel after today's session?"
                    value={entry.emotional_state_post}
                    onChange={(v) => updateField('emotional_state_post', v)}
                    disabled={!editMode}
                  />
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 10 }}>
                      Discipline Score (1-10)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={entry.discipline_score}
                        onChange={(e) => updateField('discipline_score', parseInt(e.target.value))}
                        disabled={!editMode}
                        style={{ flex: 1 }}
                      />
                      <div style={{
                        fontSize: 28,
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        color: entry.discipline_score >= 7 ? PROFIT : entry.discipline_score >= 4 ? '#ffaa00' : LOSS,
                        minWidth: 50,
                        textAlign: 'center',
                      }}>
                        {entry.discipline_score}
                      </div>
                    </div>
                  </div>
                </Section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, color, children }) {
  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      border: `1px solid ${color}22`,
      borderRadius: 10,
      padding: 20,
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color, display: 'flex', alignItems: 'center', gap: 8 }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, placeholder, value, onChange, disabled, rows = 2 }) {
  const isTextarea = rows > 2;
  const Tag = isTextarea ? 'textarea' : 'input';
  
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
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
          background: disabled ? 'var(--bg-elevated)' : 'var(--bg-secondary)',
          border: `1px solid ${disabled ? 'var(--border-color)' : 'var(--border-bright)'}`,
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

export default DailyJournal;