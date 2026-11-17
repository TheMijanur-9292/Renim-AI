import React from 'react';

export interface DocsViewProps {
  isActive: boolean;
  documents: any[];
  onUploadDocClick: () => void;
  isDocUploading: boolean;
  activeDoc: any | null;
  setActiveDocId: (id: string | null) => void;
  setDocChatHistory: React.Dispatch<React.SetStateAction<any[]>>;
  handleDeleteDoc: (id: string) => void;
  showDocPreview: boolean;
  setShowDocPreview: (show: boolean) => void;
  docChatHistory: any[];
  isDocChatLoading: boolean;
  handleDocChatSubmit: (e: React.FormEvent) => void;
  docChatInput: string;
  setDocChatInput: (val: string) => void;
}

export const DocsView: React.FC<DocsViewProps> = ({
  isActive,
  documents,
  onUploadDocClick,
  isDocUploading,
  activeDoc,
  setActiveDocId,
  setDocChatHistory,
  handleDeleteDoc,
  showDocPreview,
  setShowDocPreview,
  docChatHistory,
  isDocChatLoading,
  handleDocChatSubmit,
  docChatInput,
  setDocChatInput,
}) => {
  return (
    <div id="view-docs" className={`view-container ${isActive ? 'active' : ''}`}>
      <div className="docs-layout">
        {/* Left: Document Library */}
        <div className="docs-sidebar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="mui-card-title" style={{ fontSize: '15px' }}>
                <span className="material-symbols-rounded">folder_open</span>
                <span>Knowledge Hub</span>
              </h3>
              <span className="user-status">{documents.length} Docs Indexed</span>
            </div>
            <button
              className="mui-btn mui-btn-primary mui-btn-sm"
              onClick={onUploadDocClick}
              disabled={isDocUploading}
            >
              <span className="material-symbols-rounded icon-sm">upload_file</span>
              <span>Upload</span>
            </button>
          </div>

          {/* Drag/Drop Box */}
          <div
            className="doc-upload-dropzone"
            onClick={onUploadDocClick}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '32px', color: '#06b6d4', marginBottom: '6px' }}>
              cloud_upload
            </span>
            <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 600, color: 'var(--mui-text-primary)' }}>
              {isDocUploading ? 'Indexing Document...' : 'Click to Upload PDF or Docs'}
            </p>
            <span style={{ fontSize: '11px', color: 'var(--mui-text-secondary)' }}>
              Supports PDF, DOCX, TXT, MD
            </span>
          </div>

          {/* Doc list */}
          <div className="doc-list">
            {documents.length === 0 ? (
              <div style={{ padding: '20px 10px', textAlign: 'center' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '28px', color: 'var(--mui-text-secondary)', opacity: 0.5 }}>
                  description
                </span>
                <p className="user-status" style={{ marginTop: '6px' }}>No documents uploaded yet. Upload a PDF or policy doc to chat with it!</p>
              </div>
            ) : (
              documents.map(d => (
                <div
                  key={d.id}
                  className={`doc-card ${activeDoc?.id === d.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveDocId(d.id);
                    setDocChatHistory([]);
                  }}
                >
                  <div className="doc-card-title">
                    <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#06b6d4' }}>
                      picture_as_pdf
                    </span>
                    <span>{d.title}</span>
                  </div>
                  <div className="doc-card-meta">
                    <span>{(d.file_size / 1024).toFixed(1)} KB • {new Date(d.created_at).toLocaleDateString()}</span>
                    <button
                      className="mui-btn-icon"
                      style={{ padding: '2px' }}
                      title="Delete Document"
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteDoc(d.id);
                      }}
                    >
                      <span className="material-symbols-rounded icon-sm">delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Chat With Document */}
        <div className="doc-main-panel">
          {activeDoc ? (
            <>
              <div className="doc-chat-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-rounded" style={{ color: '#06b6d4' }}>description</span>
                    <span>{activeDoc.title}</span>
                  </h3>
                  <span className="user-status">AI Document Q&A & Semantic Extraction</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="mui-btn mui-btn-outlined mui-btn-sm"
                    onClick={() => setShowDocPreview(!showDocPreview)}
                  >
                    <span className="material-symbols-rounded icon-sm">
                      {showDocPreview ? 'chat' : 'menu_book'}
                    </span>
                    <span>{showDocPreview ? 'Show Q&A Chat' : 'Show AI Summary'}</span>
                  </button>
                </div>
              </div>

              {showDocPreview ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
                  <div className="briefing-box" style={{ background: 'var(--mui-paper)', border: '1px solid var(--mui-border)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-rounded">auto_awesome</span>
                      <span>Executive AI Summary</span>
                    </h4>
                    <div style={{ fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--mui-text-primary)' }}>
                      {activeDoc.summary || 'Summary generating or unavailable.'}
                    </div>
                  </div>
                  <div style={{ marginTop: '16px' }}>
                    <h4 style={{ fontSize: '13px', color: 'var(--mui-text-secondary)', marginBottom: '8px' }}>Indexed Document Text Preview:</h4>
                    <pre style={{ fontSize: '12px', background: 'var(--mui-paper)', padding: '12px', borderRadius: 'var(--radius-sm)', overflowX: 'auto', maxHeight: '260px', color: 'var(--mui-text-primary)', border: '1px solid var(--mui-border)' }}>
                      {activeDoc.content_text ? activeDoc.content_text.slice(0, 1500) + '...' : 'No preview text.'}
                    </pre>
                  </div>
                </div>
              ) : (
                <>
                  <div className="doc-chat-messages">
                    <div className="doc-msg assistant">
                      <strong>Knowledge Hub Assistant</strong>
                      <p style={{ margin: '4px 0 0 0' }}>
                        I have indexed <strong>{activeDoc.title}</strong>. You can ask questions, ask to find clauses, summarize key points, or extract dates and numbers!
                      </p>
                    </div>

                    {activeDoc.summary && docChatHistory.length === 0 && (
                      <div className="doc-msg assistant" style={{ background: 'rgba(8, 145, 178, 0.08)', borderColor: 'rgba(6, 182, 212, 0.25)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#06b6d4', marginBottom: '4px' }}>
                          <span className="material-symbols-rounded icon-sm">auto_awesome</span>
                          <span>Auto-Generated Summary</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', whiteSpace: 'pre-wrap' }}>{activeDoc.summary}</p>
                      </div>
                    )}

                    {docChatHistory.map((m, idx) => (
                      <div key={idx} className={`doc-msg ${m.role}`}>
                        {m.content}
                      </div>
                    ))}

                    {isDocChatLoading && (
                      <div className="doc-msg assistant">
                        <span className="loading-spinner icon-sm" style={{ display: 'inline-block', marginRight: '6px' }} />
                        Consulting document and reasoning...
                      </div>
                    )}
                  </div>

                  <form className="doc-chat-input-bar" onSubmit={handleDocChatSubmit}>
                    <input
                      type="text"
                      className="mui-input"
                      placeholder={`Ask anything about "${activeDoc.title}"...`}
                      value={docChatInput}
                      onChange={e => setDocChatInput(e.target.value)}
                      disabled={isDocChatLoading}
                    />
                    <button
                      type="submit"
                      className="mui-btn mui-btn-primary"
                      disabled={isDocChatLoading || !docChatInput.trim()}
                    >
                      <span className="material-symbols-rounded">send</span>
                    </button>
                  </form>
                </>
              )}
            </>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', padding: '40px 20px' }}>
              <span className="material-symbols-rounded" style={{ fontSize: '48px', color: '#06b6d4', opacity: 0.6, marginBottom: '12px' }}>
                menu_book
              </span>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Select or Upload a Document</h3>
              <p className="user-status" style={{ maxWidth: '400px', margin: '0 auto 16px auto' }}>
                Upload business contracts, technical specifications, PDFs, or research papers. Our Qwen 2.5 AI engine will read and answer your questions directly from the document.
              </p>
              <button
                className="mui-btn mui-btn-primary"
                onClick={onUploadDocClick}
              >
                <span className="material-symbols-rounded icon-sm">upload_file</span>
                <span>Upload Document Now</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
