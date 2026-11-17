import React from 'react';

export interface PomodoroModalProps {
  isOpen: boolean;
  onClose: () => void;
  pomodoroSeconds: number;
  setPomodoroSeconds: React.Dispatch<React.SetStateAction<number>>;
  isPomodoroRunning: boolean;
  setIsPomodoroRunning: React.Dispatch<React.SetStateAction<boolean>>;
  pomodoroMode: 'focus25' | 'deep50' | 'break5';
  onSetPomodoroMode: (mode: 'focus25' | 'deep50' | 'break5') => void;
  ambientSound: 'off' | 'rain' | 'space' | 'hum';
  onToggleAmbient: (sound: 'off' | 'rain' | 'space' | 'hum') => void;
  tasks: Array<{ id: string; title: string; status: string; priority?: string }>;
  focusTaskId: string | null;
  setFocusTaskId: (id: string | null) => void;
  onToggleTask: (id: string, currentStatus: string) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const PomodoroModal: React.FC<PomodoroModalProps> = ({
  isOpen,
  onClose,
  pomodoroSeconds,
  setPomodoroSeconds,
  isPomodoroRunning,
  setIsPomodoroRunning,
  pomodoroMode,
  onSetPomodoroMode,
  ambientSound,
  onToggleAmbient,
  tasks,
  focusTaskId,
  setFocusTaskId,
  onToggleTask,
  showToast,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog pomodoro-modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="mui-card-header" style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-rounded" style={{ color: '#06b6d4' }}>timer</span>
            <h3 className="mui-card-title" style={{ margin: 0 }}>AI Deep Work Focus Studio</h3>
          </div>
          <button
            className="mui-btn-icon modal-close"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Mode selection pills */}
        <div className="pomodoro-pills-row">
          <button
            type="button"
            className={`pomodoro-pill-btn ${pomodoroMode === 'focus25' ? 'active' : ''}`}
            onClick={() => onSetPomodoroMode('focus25')}
          >
            25m Focus
          </button>
          <button
            type="button"
            className={`pomodoro-pill-btn ${pomodoroMode === 'deep50' ? 'active' : ''}`}
            onClick={() => onSetPomodoroMode('deep50')}
          >
            50m Deep Work
          </button>
          <button
            type="button"
            className={`pomodoro-pill-btn ${pomodoroMode === 'break5' ? 'active' : ''}`}
            onClick={() => onSetPomodoroMode('break5')}
          >
            5m Rest Break
          </button>
        </div>

        {/* Large Digital Digits */}
        <div className="pomodoro-digits-display">
          {String(Math.floor(pomodoroSeconds / 60)).padStart(2, '0')}:
          {String(pomodoroSeconds % 60).padStart(2, '0')}
        </div>

        {/* Active Task Selector */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '11.5px', color: 'var(--mui-text-secondary)', display: 'block', marginBottom: '6px' }}>
            Active Goal / Task Focus:
          </label>
          <select
            className="mui-input"
            style={{ fontSize: '12.5px', padding: '6px 10px', height: '36px' }}
            value={focusTaskId || ''}
            onChange={e => setFocusTaskId(e.target.value || null)}
          >
            <option value="">General Deep Work (No specific task)</option>
            {tasks.filter(t => t.status !== 'done').map(t => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.priority || 'Medium'})
              </option>
            ))}
          </select>
        </div>

        {/* Controls (Start, Pause, Reset, Complete Task) */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '24px' }}>
          <button
            type="button"
            className="mui-btn mui-btn-primary"
            style={{ padding: '8px 24px', fontSize: '14px', gap: '8px' }}
            onClick={() => setIsPomodoroRunning(!isPomodoroRunning)}
          >
            <span className="material-symbols-rounded icon-sm">
              {isPomodoroRunning ? 'pause' : 'play_arrow'}
            </span>
            <span>{isPomodoroRunning ? 'Pause Session' : 'Start Focus'}</span>
          </button>

          <button
            type="button"
            className="mui-btn mui-btn-outlined"
            style={{ padding: '8px 16px', fontSize: '14px', gap: '6px' }}
            onClick={() => {
              setIsPomodoroRunning(false);
              const resetSec = pomodoroMode === 'focus25' ? 25 * 60 : pomodoroMode === 'deep50' ? 50 * 60 : 5 * 60;
              setPomodoroSeconds(resetSec);
            }}
          >
            <span className="material-symbols-rounded icon-sm">restart_alt</span>
            <span>Reset</span>
          </button>

          {focusTaskId && (
            <button
              type="button"
              className="mui-btn mui-btn-outlined"
              style={{ borderColor: '#10b981', color: '#10b981', padding: '8px 14px', fontSize: '13px', gap: '6px' }}
              onClick={() => {
                onToggleTask(focusTaskId, 'todo');
                setFocusTaskId(null);
                showToast('Task marked as Done!', 'success');
              }}
              title="Mark active focus task complete"
            >
              <span className="material-symbols-rounded icon-sm">task_alt</span>
              <span>Mark Done</span>
            </button>
          )}
        </div>

        {/* Procedural Ambient Sound Synthesizer */}
        <div style={{ borderTop: '1px solid var(--mui-border)', paddingTop: '16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--mui-text-secondary)', display: 'block', marginBottom: '10px' }}>
            Procedural Ambient Sound Generator (Offline)
          </span>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`ambient-pill-btn ${ambientSound === 'off' ? 'active' : ''}`}
              onClick={() => onToggleAmbient('off')}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>volume_off</span>
              <span>Mute</span>
            </button>
            <button
              type="button"
              className={`ambient-pill-btn ${ambientSound === 'rain' ? 'active' : ''}`}
              onClick={() => onToggleAmbient('rain')}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>water_drop</span>
              <span>Cyber Rain</span>
            </button>
            <button
              type="button"
              className={`ambient-pill-btn ${ambientSound === 'space' ? 'active' : ''}`}
              onClick={() => onToggleAmbient('space')}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>rocket_launch</span>
              <span>Deep Space</span>
            </button>
            <button
              type="button"
              className={`ambient-pill-btn ${ambientSound === 'hum' ? 'active' : ''}`}
              onClick={() => onToggleAmbient('hum')}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>psychology</span>
              <span>Binaural Focus (10Hz)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
