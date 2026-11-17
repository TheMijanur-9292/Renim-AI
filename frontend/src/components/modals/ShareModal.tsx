import React from 'react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeNoteId: string | null;
  noteTitle: string;
  noteContent: string;
  noteEditorHtml?: string;
  onCopyShareLink: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  activeNoteId,
  noteTitle,
  noteContent,
  noteEditorHtml,
  onCopyShareLink
}) => {
  if (!isOpen) return null;

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/share/note/${activeNoteId || 'note-preview'}`
    : `/share/note/${activeNoteId || 'note-preview'}`;

  return (
    <div className="email-modal-backdrop" onClick={onClose}>
      <div className="email-modal-box" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        <div className="mui-card-header">
          <h3 className="mui-card-title">
            <span className="material-symbols-rounded" style={{ color: '#06b6d4' }}>share</span>
            <span>Shareable Note Link</span>
          </h3>
          <button className="mui-btn-icon modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <p className="user-status" style={{ margin: '8px 0 14px 0' }}>
          Anyone with this link can view a read-only live preview of this document.
        </p>

        <div className="mui-input-group" style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="mui-input"
            readOnly
            value={shareUrl}
          />
          <button
            type="button"
            className="mui-btn mui-btn-primary"
            onClick={onCopyShareLink}
          >
            <span className="material-symbols-rounded icon-sm">content_copy</span>
            <span>Copy</span>
          </button>
        </div>

        <div style={{ marginTop: '16px', background: 'var(--mui-paper)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--mui-border)' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>{noteTitle || 'Untitled Note'}</h3>
          <div
            style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--mui-text-primary)', maxHeight: '200px', overflowY: 'auto' }}
            dangerouslySetInnerHTML={{ __html: noteEditorHtml || noteContent || '<em>Empty note.</em>' }}
          />
        </div>
      </div>
    </div>
  );
};
