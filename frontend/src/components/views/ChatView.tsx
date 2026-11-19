import React, { useState } from 'react';
import { Box, Button, Card, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { renderMarkdownToHtml } from '../../utils/markdown';
import { AI_PERSONAS } from '../../services/powerups';
import { Icon, PageContainer, PageHeader, riseSx, rise } from '../ui';

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

const msgEnterSx = {
  animation: `${rise} .4s cubic-bezier(.2,.7,.2,1) both`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
};

const Avatar: React.FC<{ spinning?: boolean; title: string }> = ({ spinning, title }) => (
  <Box
    className={`ai-msg-avatar${spinning ? ' thinking-spin' : ''}`}
    title={title}
    sx={{
      width: 32, height: 32, flex: 'none', borderRadius: '10px', border: '1px solid', borderColor: 'divider',
      bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      '& img': { width: 20, height: 20 },
    }}
  >
    <img src="/icon.svg" alt="Renim AI" />
  </Box>
);

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
  // setChatInput is a React state setter at runtime; it accepts updater functions.
  const updateChatInput = setChatInput as unknown as React.Dispatch<React.SetStateAction<string>>;
  return (
    <div id="view-chat" className={`view-container ${isActive ? 'active' : ''}`}>
      <PageContainer>
        <PageHeader
          overline="Assistant"
          title="Chat"
          description="Ask questions about your notes, meetings and plans, or get help drafting anything."
          actions={
            <Button
              variant="contained"
              color="primary"
              startIcon={<Icon name="add_comment" size={18} />}
              onClick={handleNewChatSession}
              sx={{ minHeight: 44 }}
            >
              New chat
            </Button>
          }
        />

        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 2.5 },
            gridTemplateColumns: { xs: '1fr', md: '280px minmax(0, 1fr)', xl: '320px minmax(0, 1fr)' },
            height: { md: 'calc(100dvh - 230px)' },
            minHeight: { md: 520 },
          }}
        >
          {/* Sessions */}
          <Card
            component="aside"
            aria-label="Past chats"
            sx={{ p: 1.5, display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: { xs: 260, md: 'none' }, ...(riseSx(1) as object) }}
          >
            <Typography variant="overline" color="text.secondary" sx={{ px: 1, pb: 0.5 }}>
              Recent chats
            </Typography>
            <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {chatSessions.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No chats yet. Ask your first question to get started.
                </Typography>
              ) : (
                <Stack spacing={0.5}>
                  {chatSessions.map((sess, i) => {
                    const selected = activeChatSessionId === sess.id;
                    return (
                      <Box
                        key={sess.id}
                        role="button"
                        tabIndex={0}
                        aria-current={selected ? 'true' : undefined}
                        onClick={() => handleSelectChatSession(sess)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectChatSession(sess);
                          }
                        }}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1, minHeight: 52, pl: 1.5, pr: 0.5, py: 0.75,
                          borderRadius: '12px', cursor: 'pointer',
                          bgcolor: selected ? 'action.selected' : 'transparent',
                          boxShadow: selected ? (t) => `inset 3px 0 0 ${t.palette.secondary.main}` : 'none',
                          transition: 'background-color .2s ease, transform .2s ease',
                          '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover', transform: 'translateX(2px)' },
                          '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main' },
                          '&:hover .chat-del': { opacity: 1 },
                          '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
                          ...(riseSx(i + 2) as object),
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: selected ? 700 : 600 }}>
                            {sess.title || 'New Chat'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap component="div">
                            {sess.updated_at
                              ? new Date(sess.updated_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Just now'}
                          </Typography>
                        </Box>
                        <Tooltip title="Delete chat">
                          <IconButton
                            className="chat-del"
                            aria-label="Delete chat"
                            size="small"
                            onClick={e => handleDeleteChatSession(sess.id, e)}
                            sx={{ width: 40, height: 40, opacity: { xs: 1, md: 0.55 }, transition: 'opacity .2s' }}
                          >
                            <Icon name="delete" size={18} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </Card>

          {/* Conversation */}
          <Card
            sx={{
              display: 'flex', flexDirection: 'column', p: 0, overflow: 'hidden',
              height: { xs: 'calc(100dvh - 200px)', md: 'auto' }, minHeight: { xs: 460, md: 0 },
              ...(riseSx(2) as object),
            }}
          >
            <Box
              id="chat-messages-container"
              ref={chatHistoryRef}
              aria-live="polite"
              sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: { xs: 1.5, sm: 3 }, py: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              {chatHistory.map((msg, idx) => {
                const isStreamingThis = typingMsgIndex === idx;
                const displayContent = isStreamingThis ? typingVisibleText : msg.content;
                const isUser = msg.role !== 'assistant';
                return (
                  <Stack
                    key={idx}
                    direction="row"
                    spacing={1.25}
                    className={`chat-msg msg-${msg.role}`}
                    sx={{ justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-start', ...msgEnterSx }}
                  >
                    {msg.role === 'assistant' && <Avatar title="Renim AI" />}
                    <Box
                      sx={{
                        maxWidth: { xs: '88%', md: isUser ? '70%' : '82%' }, minWidth: 0,
                        px: 2, py: 1.25, borderRadius: '16px', overflowWrap: 'anywhere',
                        ...(isUser
                          ? { bgcolor: 'primary.main', color: 'primary.contrastText', borderTopRightRadius: '6px' }
                          : { bgcolor: 'action.hover', color: 'text.primary', borderTopLeftRadius: '6px' }),
                      }}
                    >
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
                        <Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                          {msg.content}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                );
              })}

              {isChatThinking && (
                <Stack direction="row" spacing={1.25} alignItems="center" className="chat-msg msg-assistant" sx={msgEnterSx}>
                  <Avatar spinning title="Renim AI is working..." />
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, py: 1.25, borderRadius: '16px', bgcolor: 'action.hover' }}>
                    <Typography variant="body2" color="text.secondary" className="ai-thinking-status">
                      {aiThinkingSteps[thinkingStepIndex]}
                    </Typography>
                    <div className="ai-typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </Stack>
                </Stack>
              )}
            </Box>

            <Box sx={{ borderTop: '1px solid', borderColor: 'divider', px: { xs: 1.5, sm: 2.5 }, pt: 1.5, pb: { xs: 1.5, sm: 2 } }}>
              <Stack
                direction="row"
                spacing={0.75}
                aria-label="Response style"
                sx={{ overflowX: 'auto', pb: 1.25, mx: -0.5, px: 0.5, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
              >
                {AI_PERSONAS.map((p) => {
                  const on = activePersona === p.id;
                  return (
                    <Button
                      key={p.id}
                      size="small"
                      variant={on ? 'contained' : 'outlined'}
                      color={on ? 'primary' : 'inherit'}
                      aria-pressed={on}
                      startIcon={<Icon name={p.icon} size={16} />}
                      onClick={() => {
                        setActivePersona(p.id);
                        if (p.instruction) {
                          updateChatInput((prev: string) =>
                            prev.startsWith('[Role:') ? prev.replace(/^\[Role:[^\]]+\]\s*/, `[Role: ${p.label}] `) : `[Role: ${p.label}] ${prev}`
                          );
                        } else {
                          updateChatInput((prev: string) => prev.replace(/^\[Role:[^\]]+\]\s*/, ''));
                        }
                      }}
                      sx={{ flex: 'none', minHeight: 36, borderRadius: 999, fontSize: 12.5, whiteSpace: 'nowrap', borderColor: on ? undefined : 'divider' }}
                    >
                      {p.label}
                    </Button>
                  );
                })}
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  fullWidth
                  id="chat-input-field"
                  inputProps={{ 'aria-label': 'Message' }}
                  placeholder="Ask anything about your notes, meetings or schedule..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as KeyboardEvent).isComposing) handleChatSubmit();
                  }}
                />
                <IconButton
                  id="btn-chat-send"
                  aria-label="Send message"
                  onClick={handleChatSubmit}
                  sx={{
                    width: 48, height: 48, flex: 'none', borderRadius: '14px',
                    bgcolor: 'primary.main', color: 'primary.contrastText',
                    transition: 'transform .15s ease, background-color .2s ease',
                    '&:hover': { bgcolor: 'primary.dark', transform: 'translateY(-1px)' },
                  }}
                >
                  <Icon name="send" size={20} />
                </IconButton>
              </Stack>
            </Box>
          </Card>
        </Box>
      </PageContainer>
    </div>
  );
};
