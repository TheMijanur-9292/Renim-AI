import React, { useState } from 'react';
import { renderMarkdownToHtml } from '../../utils/markdown';
import { AI_PERSONAS } from '../../services/powerups';

export interface ChatViewProps {
  isActive: boolean;
  handleNewChatSession: () => void;
  chatSessions: any[];
  activeChatSessionId: string | null;
  handleSelectChatSession: (sess: any) => void;
  handleDeleteChatSession: (id: string, e: React.MouseEvent) => void;
  chatHistoryRef: React.RefObject<HTMLDivElement>;
  chatHistory: any[];
  typingMsgIndex: number | null;
  typingVisibleText: string;
  isChatThinking: boolean;
  aiThinkingSteps: string[];
  thinkingStepIndex: number;
  chatInput: string;
  setChatInput: (s: string) => void;
  handleChatSubmit: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  isActive,
  handleNewChatSession,
  chatSessions,
  activeChatSessionId,
  handleSelectChatSession,
  handleDeleteChatSession,
  chatHistoryRef,
  chatHistory,
  typingMsgIndex,
  typingVisibleText,
  isChatThinking,
  aiThinkingSteps,
  thinkingStepIndex,
  chatInput,
  setChatInput,
  handleChatSubmit,
}) => {
  const [activePersona, setActivePersona] = useState('default');
  return (
    <div id="view-chat" className={`view-container ${isActive ? 'active' : ''}`}>
      <div className="chat-workspace-shell">
        {/* Left Sidebar: User Chat Sessions History */}
        <aside className="chat-sessions-sidebar">
          <div className="chat-sessions-header">
            <button
              className="mui-btn mui-btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleNewChatSession}
            >
              <span className="material-symbols-rounded icon-sm">add_comment</span>
              <span>New Chat Session</span>
            </button>
          </div>
          <div className="chat-sessions-list">
            {chatSessions.length === 0 ? (
              <div style={{ padding: '14px 10px', textAlign: 'center' }}>
                <span className="user-status">No past chat sessions yet. Start asking Copilot!</span>
              </div>
            ) : (
              chatSessions.map(sess => (
                <div
                  key={sess.id}
                  className={`chat-session-item ${activeChatSessionId === sess.id ? 'active' : ''}`}
                  onClick={() => handleSelectChatSession(sess)}
                >
                  <div className="chat-session-meta">
                    <span className="chat-session-title">{sess.title || 'New Chat'}</span>
                    <span className="chat-session-date">
                      {sess.updated_at
                        ? new Date(sess.updated_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Just now'}
                    </span>
                  </div>
                  <button
                    className="chat-session-del"
                    title="Delete session"
                    onClick={e => handleDeleteChatSession(sess.id, e)}
                  >
                    <span className="material-symbols-rounded icon-sm">delete</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Right Full-Screen Chat Area */}
        <div className="chat-layout">
          <div className="chat-history" id="chat-messages-container" ref={chatHistoryRef}>
            {chatHistory.map((msg, idx) => {
              const isStreamingThis = typingMsgIndex === idx;
              const displayContent = isStreamingThis ? typingVisibleText : msg.content;
              return (
                <div key={idx} className={`chat-msg msg-${msg.role}`}>
                  {msg.role === 'assistant' && (
                    <div className="ai-msg-avatar" title="Renim AI Copilot">
                      <img src="/icon.svg" alt="Renim AI" />
                    </div>
                  )}
                  <div className="msg-bubble">
                    {msg.role === 'assistant' ? (
                      <div className="ai-markdown-body">
                        <span
                          dangerouslySetInnerHTML={{
                            __html: renderMarkdownToHtml(displayContent),
                          }}
                        />
                        {isStreamingThis && <span className="ai-stream-cursor" />}
                      </div>
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    )}
                  </div>
                </div>
              );
            })}

            {isChatThinking && (
              <div className="chat-msg msg-assistant">
                <div className="ai-msg-avatar thinking-spin" title="Renim AI is working...">
                  <img src="/icon.svg" alt="Renim AI" />
                </div>
                <div className="ai-thinking-row">
                  <span className="ai-thinking-status">
                    {aiThinkingSteps[thinkingStepIndex]}
                  </span>
                  <div className="ai-typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '8px 16px 0 16px' }}>
            {AI_PERSONAS.map((p) => (
              <button
                key={p.id}
                className={`mui-btn mui-btn-sm ${activePersona === p.id ? 'mui-btn-primary' : 'mui-btn-outlined'}`}
                style={{ fontSize: '11px', padding: '4px 10px' }}
                onClick={() => {
                  setActivePersona(p.id);
                  if (p.instruction) {
                    setChatInput((prev: string) =>
                      prev.startsWith('[Role:') ? prev.replace(/^\[Role:[^\]]+\]\s*/, `[Role: ${p.label}] `) : `[Role: ${p.label}] ${prev}`
                    );
                  } else {
                    setChatInput((prev: string) => prev.replace(/^\[Role:[^\]]+\]\s*/, ''));
                  }
                }}
              >
                <span className="material-symbols-rounded icon-sm" style={{ fontSize: '14px' }}>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
          <div className="chat-input-bar">
            <input
              type="text"
              id="chat-input-field"
              className="mui-input"
              style={{ flex: 1 }}
              placeholder="Ask anything about your notes, past meetings, or agenda..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) handleChatSubmit();
              }}
            />
            <button className="mui-btn mui-btn-primary" id="btn-chat-send" onClick={handleChatSubmit}>
              <span className="material-symbols-rounded icon-sm">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
