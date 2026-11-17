import React from 'react';

interface PasteTranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const PasteTranscriptModal: React.FC<PasteTranscriptModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  return (
    <div id="modal-paste-transcript" className={`modal-backdrop ${isOpen ? '' : 'hidden'}`}>
      <div className="modal-dialog">
        <div className="mui-card-header">
          <h3 className="mui-card-title">
            <span className="material-symbols-rounded">content_paste</span>
            <span>Paste Meeting Transcript</span>
          </h3>
          <button className="mui-btn-icon modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form id="form-paste-transcript" onSubmit={onSubmit}>
          <div className="mui-input-group">
            <label>Meeting Title</label>
            <input
              type="text"
              name="title"
              className="mui-input"
              placeholder="Product Review Call"
              required
            />
          </div>
          <div className="mui-input-group">
            <label>Transcript Text</label>
            <textarea
              name="transcript"
              className="mui-input"
              style={{ height: '140px', resize: 'vertical' }}
              placeholder="Paste meeting dialogue or speech log here..."
              required
            ></textarea>
          </div>
          <button
            type="submit"
            className="mui-btn mui-btn-primary mui-btn-block"
            style={{ width: '100%', marginTop: '12px' }}
          >
            Summarize with AI
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasteTranscriptModal;
