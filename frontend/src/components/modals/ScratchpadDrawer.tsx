import React, { useEffect, useState } from 'react';

interface ScratchpadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAsNote: (title: string, text: string) => Promise<void>;
  onSaveAsTask: (title: string) => Promise<void>;
  showToast: (msg: string) => void;
}

export const ScratchpadDrawer: React.FC<ScratchpadDrawerProps> = ({
  isOpen,
  onClose,
  onSaveAsNote,
  onSaveAsTask,
  showToast
}) => {
  const [text, setText] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setText(localStorage.getItem('renim_quick_scratchpad') || '');
    }
  }, []);

  const handleChange = (val: string) => {
    setText(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('renim_quick_scratchpad', val);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(2, 6, 23, 0.45)',
          backdropFilter: 'blur(2px)',
          zIndex: 9090,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '360px',
          maxWidth: '92vw',
          background: 'var(--mui-surface)',
          color: 'var(--mui-text-primary)',
          borderLeft: '1px solid var(--mui-border)',
          boxShadow: '-8px 0 30px rgba(0,0,0,0.35)',
          zIndex: 9100,
          display: 'flex',
          flexDirection: 'column',
          padding: '18px'
        }}
      >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px' }}>
          <span className="material-symbols-rounded icon-sm" style={{ color: '#06b6d4' }}>sticky_note_2</span>
          <span>Quick Scratchpad</span>
        </div>
        <button className="mui-btn-icon" onClick={onClose} title="Close Scratchpad">
          <span className="material-symbols-rounded icon-sm">close</span>
        </button>
      </div>
      <p className="muted-sm" style={{ margin: '0 0 10px 0' }}>
        Auto-saved locally. Capture links, ideas, or snippets from anywhere and convert in 1 click.
      </p>
      <textarea
        className="mui-input"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Jot down quick thoughts, phone numbers, or meeting reminders..."
        style={{ flex: 1, resize: 'none', lineHeight: 1.6, padding: '12px', marginBottom: '12px' }}
      />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          className="mui-btn mui-btn-primary mui-btn-sm"
          style={{ flex: 1 }}
          onClick={async () => {
            if (!text.trim()) return showToast('Scratchpad is empty');
            const firstLine = text.trim().split('\n')[0].slice(0, 50);
            await onSaveAsNote(firstLine || 'Scratchpad Note', text);
            showToast('Saved to Smart Notes!');
          }}
        >
          Save as Note
        </button>
        <button
          className="mui-btn mui-btn-outlined mui-btn-sm"
          style={{ flex: 1 }}
          onClick={async () => {
            if (!text.trim()) return showToast('Scratchpad is empty');
            const firstLine = text.trim().split('\n')[0].slice(0, 80);
            await onSaveAsTask(firstLine);
            showToast('Added to Tasks!');
          }}
        >
          Convert to Task
        </button>
        <button
          className="mui-btn mui-btn-outlined mui-btn-sm"
          onClick={() => {
            handleChange('');
            showToast('Scratchpad cleared');
          }}
        >
          Clear
        </button>
      </div>
      </div>
    </>
  );
};
