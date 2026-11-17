import React from 'react';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailRecipient: string;
  setEmailRecipient: (val: string) => void;
  emailTone: string;
  setEmailTone: (val: string) => void;
  emailObjective: string;
  setEmailObjective: (val: string) => void;
  emailSubject: string;
  setEmailSubject: (val: string) => void;
  emailBody: string;
  setEmailBody: (val: string) => void;
  isEmailGenerating: boolean;
  onGenerateEmail: () => void;
  onCopyDraft: () => void;
}

export const EmailModal: React.FC<EmailModalProps> = ({
  isOpen,
  onClose,
  emailRecipient,
  setEmailRecipient,
  emailTone,
  setEmailTone,
  emailObjective,
  setEmailObjective,
  emailSubject,
  setEmailSubject,
  emailBody,
  setEmailBody,
  isEmailGenerating,
  onGenerateEmail,
  onCopyDraft
}) => {
  if (!isOpen) return null;

  return (
    <div className="email-modal-backdrop" onClick={onClose}>
      <div className="email-modal-box" onClick={e => e.stopPropagation()}>
        <div className="mui-card-header">
          <h3 className="mui-card-title">
            <span className="material-symbols-rounded" style={{ color: '#06b6d4' }}>forward_to_inbox</span>
            <span>AI Email & Outreach Draftsman</span>
          </h3>
          <button className="mui-btn-icon modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="mui-input-group">
              <label>Recipient Name or Role</label>
              <input
                type="text"
                className="mui-input"
                placeholder="e.g. Stakeholders, Alex (Client), Engineering Team"
                value={emailRecipient}
                onChange={e => setEmailRecipient(e.target.value)}
              />
            </div>
            <div className="mui-input-group">
              <label>Tone of Voice</label>
              <select
                className="mui-input"
                value={emailTone}
                onChange={e => setEmailTone(e.target.value)}
              >
                <option value="Professional">Professional & Formal</option>
                <option value="Friendly">Friendly & Collaborative</option>
                <option value="Pitch">Pitch / Persuasive</option>
                <option value="Urgent">Action-Oriented & Urgent</option>
                <option value="Executive Brief">Executive Summary</option>
              </select>
            </div>
          </div>

          <div className="mui-input-group">
            <label>Email Objective / Call-to-Action</label>
            <input
              type="text"
              className="mui-input"
              placeholder="e.g. Request review on meeting deliverables, follow up on contract..."
              value={emailObjective}
              onChange={e => setEmailObjective(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="mui-btn mui-btn-primary"
            disabled={isEmailGenerating}
            onClick={onGenerateEmail}
            style={{ alignSelf: 'flex-start' }}
          >
            <span className="material-symbols-rounded icon-sm">
              {isEmailGenerating ? 'sync' : 'auto_awesome'}
            </span>
            <span>{isEmailGenerating ? 'Drafting with Qwen 2.5...' : 'Generate Email Draft'}</span>
          </button>

          {emailSubject && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="mui-input-group">
                <label>Generated Subject</label>
                <input
                  type="text"
                  className="mui-input"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                />
              </div>

              <div className="mui-input-group">
                <label>Generated Body</label>
                <textarea
                  className="mui-input"
                  style={{ height: '180px', fontFamily: 'inherit', lineHeight: 1.6 }}
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="mui-btn mui-btn-outlined"
                  onClick={onCopyDraft}
                >
                  <span className="material-symbols-rounded icon-sm">content_copy</span>
                  <span>Copy Full Draft</span>
                </button>
                <a
                  href={`mailto:${encodeURIComponent(emailRecipient.includes('@') ? emailRecipient : '')}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                  className="mui-btn mui-btn-primary"
                  style={{ textDecoration: 'none' }}
                >
                  <span className="material-symbols-rounded icon-sm">send</span>
                  <span>Open in Mail Client</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
