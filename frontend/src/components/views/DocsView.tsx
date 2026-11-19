import React from 'react';
import { Box, Button, ButtonBase, Card, CircularProgress, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { EmptyState, Icon, IconTile, PageContainer, PageHeader, riseSx, rise } from '../ui';

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

const msgEnterSx = {
  animation: `${rise} .4s cubic-bezier(.2,.7,.2,1) both`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
};

const bubbleSx = (role: string) => ({
  maxWidth: { xs: '92%', md: '80%' },
  alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
  px: 2,
  py: 1.25,
  borderRadius: '16px',
  fontSize: 14,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap' as const,
  overflowWrap: 'anywhere' as const,
  ...(role === 'user'
    ? { bgcolor: 'primary.main', color: 'primary.contrastText', borderTopRightRadius: '6px' }
    : { bgcolor: 'action.hover', color: 'text.primary', borderTopLeftRadius: '6px' }),
  ...msgEnterSx,
});

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
      <PageContainer>
        <PageHeader
          overline="Library"
          title="Documents"
          description="Upload files, read a quick summary, and ask questions about what's inside."
          actions={
            <Button
              variant="contained"
              color="primary"
              onClick={onUploadDocClick}
              disabled={isDocUploading}
              startIcon={isDocUploading ? <CircularProgress size={16} color="inherit" /> : <Icon name="upload_file" size={18} />}
              sx={{ minHeight: 44 }}
            >
              Upload
            </Button>
          }
        />

        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 2.5 },
            gridTemplateColumns: { xs: '1fr', md: '320px minmax(0, 1fr)', xl: '360px minmax(0, 1fr)' },
            height: { md: 'calc(100dvh - 230px)' },
            minHeight: { md: 540 },
          }}
        >
          {/* Library */}
          <Card sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, ...(riseSx(1) as object) }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">Your files</Typography>
              <Typography variant="caption" color="text.secondary">
                {documents.length} {documents.length === 1 ? 'file' : 'files'}
              </Typography>
            </Stack>

            <ButtonBase
              className="doc-upload-dropzone"
              onClick={onUploadDocClick}
              aria-label="Upload a document"
              sx={{
                flexDirection: 'column', gap: 0.5, width: '100%', py: 2.5, px: 2, borderRadius: '16px',
                border: '1.5px dashed', borderColor: 'divider', bgcolor: 'action.hover',
                transition: 'border-color .2s ease, background-color .2s ease, transform .2s ease',
                '&:hover': { borderColor: 'secondary.main', transform: 'translateY(-1px)' },
                '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
              }}
            >
              <Icon name="cloud_upload" size={30} sx={{ color: 'secondary.main' }} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {isDocUploading ? 'Uploading and reading...' : 'Click to upload a file'}
              </Typography>
              <Typography variant="caption" color="text.secondary">PDF, DOCX, TXT or MD</Typography>
            </ButtonBase>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', maxHeight: { xs: 320, md: 'none' }, mx: -0.5, px: 0.5 }}>
              {documents.length === 0 ? (
                <EmptyState icon="description" title="No documents yet" description="Upload a file to summarize it or ask questions about it." />
              ) : (
                <Stack spacing={1}>
                  {documents.map((d, i) => {
                    const selected = activeDoc?.id === d.id;
                    return (
                      <Box
                        key={d.id}
                        role="button"
                        tabIndex={0}
                        aria-current={selected ? 'true' : undefined}
                        onClick={() => {
                          setActiveDocId(d.id);
                          setDocChatHistory([]);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setActiveDocId(d.id);
                            setDocChatHistory([]);
                          }
                        }}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, minHeight: 56, cursor: 'pointer',
                          borderRadius: '14px', border: '1px solid',
                          borderColor: selected ? 'secondary.main' : 'divider',
                          bgcolor: selected ? 'action.selected' : 'background.paper',
                          transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
                          '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 },
                          '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main' },
                          '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
                          ...(riseSx(i + 2) as object),
                        }}
                      >
                        <IconTile icon="picture_as_pdf" accent="cyan" size={36} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{d.title}</Typography>
                          <Typography variant="caption" color="text.secondary" component="div" noWrap>
                            {(d.file_size / 1024).toFixed(1)} KB · {new Date(d.created_at).toLocaleDateString()}
                          </Typography>
                        </Box>
                        <Tooltip title="Delete document">
                          <IconButton
                            aria-label={`Delete ${d.title}`}
                            sx={{ width: 40, height: 40 }}
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteDoc(d.id);
                            }}
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

          {/* Viewer / Q&A */}
          <Card
            sx={{
              p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
              minHeight: { xs: 480, md: 0 }, height: { xs: activeDoc ? 'calc(100dvh - 200px)' : 'auto', md: 'auto' },
              ...(riseSx(2) as object),
            }}
          >
            {activeDoc ? (
              <>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                  sx={{ px: { xs: 2, sm: 2.5 }, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                    <IconTile icon="description" accent="cyan" size={40} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6" component="h2" noWrap>{activeDoc.title}</Typography>
                      <Typography variant="caption" color="text.secondary">Ask questions or read the summary</Typography>
                    </Box>
                  </Stack>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowDocPreview(!showDocPreview)}
                    startIcon={<Icon name={showDocPreview ? 'chat' : 'menu_book'} size={18} />}
                    sx={{ minHeight: 40, flex: 'none' }}
                  >
                    {showDocPreview ? 'Back to questions' : 'View summary'}
                  </Button>
                </Stack>

                {showDocPreview ? (
                  <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: { xs: 2, sm: 2.5 } }}>
                    <Box sx={{ p: 2, borderRadius: '16px', border: '1px solid', borderColor: 'divider', borderLeft: '3px solid', borderLeftColor: 'secondary.main', ...msgEnterSx }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, color: 'secondary.main' }}>
                        <Icon name="auto_awesome" size={18} />
                        <Typography variant="subtitle2" sx={{ color: 'inherit' }}>Summary</Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {activeDoc.summary || 'Summary is still being prepared or is unavailable.'}
                      </Typography>
                    </Box>
                    <Typography variant="overline" color="text.secondary" component="h3" sx={{ display: 'block', mt: 2.5, mb: 1 }}>
                      Text preview
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        m: 0, p: 1.5, fontSize: 12.5, lineHeight: 1.6, maxHeight: 260, overflow: 'auto',
                        whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', borderRadius: '12px',
                        border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover', color: 'text.primary',
                      }}
                    >
                      {activeDoc.content_text ? activeDoc.content_text.slice(0, 1500) + '...' : 'No preview text.'}
                    </Box>
                  </Box>
                ) : (
                  <>
                    <Box aria-live="polite" sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: { xs: 2, sm: 2.5 }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={bubbleSx('assistant')}>
                        <Typography variant="subtitle2" component="strong">Document assistant</Typography>
                        <Box component="p" sx={{ m: 0, mt: 0.5 }}>
                          I've read <strong>{activeDoc.title}</strong>. Ask a question, find a section, summarize key points, or pull out dates and numbers.
                        </Box>
                      </Box>

                      {activeDoc.summary && docChatHistory.length === 0 && (
                        <Box sx={{ ...bubbleSx('assistant'), bgcolor: 'transparent', border: '1px solid', borderColor: 'secondary.main' }}>
                          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5, color: 'secondary.main', fontWeight: 700 }}>
                            <Icon name="auto_awesome" size={16} />
                            <span>Quick summary</span>
                          </Stack>
                          <Box component="p" sx={{ m: 0, whiteSpace: 'pre-wrap' }}>{activeDoc.summary}</Box>
                        </Box>
                      )}

                      {docChatHistory.map((m, idx) => (
                        <Box key={idx} sx={bubbleSx(m.role)}>
                          {m.content}
                        </Box>
                      ))}

                      {isDocChatLoading && (
                        <Stack direction="row" spacing={1} alignItems="center" sx={bubbleSx('assistant')}>
                          <CircularProgress size={14} color="secondary" />
                          <span>Reading the document...</span>
                        </Stack>
                      )}
                    </Box>

                    <Box
                      component="form"
                      onSubmit={handleDocChatSubmit}
                      sx={{ display: 'flex', gap: 1, alignItems: 'center', px: { xs: 1.5, sm: 2.5 }, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
                    >
                      <TextField
                        fullWidth
                        inputProps={{ 'aria-label': 'Ask about this document' }}
                        placeholder={`Ask anything about "${activeDoc.title}"...`}
                        value={docChatInput}
                        onChange={e => setDocChatInput(e.target.value)}
                        disabled={isDocChatLoading}
                      />
                      <IconButton
                        type="submit"
                        aria-label="Send question"
                        disabled={isDocChatLoading || !docChatInput.trim()}
                        sx={{
                          width: 48, height: 48, flex: 'none', borderRadius: '14px',
                          bgcolor: 'primary.main', color: 'primary.contrastText',
                          '&:hover': { bgcolor: 'primary.dark' },
                          '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
                        }}
                      >
                        <Icon name="send" size={20} />
                      </IconButton>
                    </Box>
                  </>
                )}
              </>
            ) : (
              <Box sx={{ m: 'auto', py: { xs: 4, md: 6 } }}>
                <EmptyState
                  icon="menu_book"
                  title="Select or upload a document"
                  description="Upload contracts, reports, lesson plans, policies or research. You can then ask questions and get answers straight from the file."
                  action={
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={onUploadDocClick}
                      startIcon={<Icon name="upload_file" size={18} />}
                      sx={{ minHeight: 44, mt: 1 }}
                    >
                      Upload a document
                    </Button>
                  }
                />
              </Box>
            )}
          </Card>
        </Box>
      </PageContainer>
    </div>
  );
};
