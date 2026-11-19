import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, ButtonBase, Card, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  IconButton, LinearProgress, Stack, Tooltip, Typography,
} from '@mui/material';
import { SMART_NOTE_TEMPLATES } from '../../services/powerups';
import { checkNoteVersion, importNotesFile, type NotesImportResult } from '../../services/enterprise';
import { EmptyState, Icon, PageContainer, riseSx } from '../ui';

export interface NotesViewProps {
  isActive: boolean;
  handleNewNote: () => void;
  filteredNotes: any[];
  activeNoteId: string | null;
  selectNote: (n: any) => void;
  stripHtmlPreview: (html: string) => string;
  noteTitle: string;
  setNoteTitle: (t: string) => void;
  noteEditorRef: React.RefObject<HTMLDivElement>;
  noteContent: string;
  setNoteContent: (c: string) => void;
  triggerNoteSave: (title: string, html: string) => void;
  execEditorCmd: (cmd: string, val?: string) => void;
  noteLineSpacing: string;
  setNoteLineSpacing: (s: string) => void;
  handleInsertLink: () => void;
  handleInsertTable: () => void;
  handleInsertImage: () => void;
  handleInsertCodeBlock: () => void;
  noteSpellCheck: boolean;
  setNoteSpellCheck: (sc: boolean) => void;
  isVoiceDictating: boolean;
  toggleVoiceDictation: () => void;
  voiceDictationLang: 'bn-BD' | 'en-US';
  setVoiceDictationLang: (lang: 'bn-BD' | 'en-US') => void;
  handleNotePaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  noteSaveStatus: string;
  handleDeleteNote: () => void;
  noteSaveTimerRef: React.MutableRefObject<any>;
  persistNoteNow: (title: string, html: string, showToastFeedback?: boolean) => Promise<any>;
  handleNoteAI: (action: string) => void;
  handleOpenEmailModal: (type: 'note' | 'general') => void;
  handleExportPDF: () => void;
  handleExportMarkdown: () => void;
  setShowShareModal: (show: boolean) => void;
  onPublicShareNote?: () => void;
  onToggleTeamVisibility?: () => void;
  hasActiveOrg?: boolean;
  /** Reloads the note list (used after importing notes or loading the latest version). */
  onNotesChanged?: () => void;
}

const IMPORT_ACCEPT = '.md,.markdown,.txt,.html,.htm,.zip,.enex';
const IMPORT_FORMATS: { icon: string; label: string; hint: string }[] = [
  { icon: 'description', label: 'Markdown or text', hint: '.md, .txt' },
  { icon: 'folder_zip', label: 'Notion export', hint: '.zip (Markdown or HTML)' },
  { icon: 'html', label: 'Google Docs or web page', hint: '.html (File > Download > Web page)' },
  { icon: 'note_stack', label: 'Evernote export', hint: '.enex' },
];

/** Dialog for importing notes from export files of other tools. */
const ImportNotesDialog: React.FC<{ open: boolean; onClose: () => void; onImported: (r: NotesImportResult) => void }> = ({
  open, onClose, onImported,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<NotesImportResult | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setFile(null); setBusy(false); setProgress(0); setResult(null); setError(''); };
  const close = () => { if (busy) return; reset(); onClose(); };

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    setResult(null);
    setError('');
    if (f.size > 15 * 1024 * 1024) { setFile(null); setError('This file is larger than 15 MB.'); return; }
    if (!/\.(md|markdown|txt|html?|zip|enex)$/i.test(f.name)) { setFile(null); setError('This file type is not supported.'); return; }
    setFile(f);
  };

  const start = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setProgress(0);
    try {
      const r = await importNotesFile(file, setProgress);
      setResult(r);
      setFile(null);
      onImported(r);
    } catch (e: any) {
      setError(e?.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" aria-labelledby="import-notes-title">
      <DialogTitle id="import-notes-title" sx={{ pb: 0.5 }}>Import notes</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Bring in notes exported from other apps. Each page or note becomes a new note tagged "imported".
        </Typography>
        <Box
          role="button"
          tabIndex={0}
          aria-label="Choose a file to import, or drop it here"
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e: React.KeyboardEvent) => {
            if ((e.key === 'Enter' || e.key === ' ') && !busy) { e.preventDefault(); inputRef.current?.click(); }
          }}
          onDragOver={(e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e: React.DragEvent) => { e.preventDefault(); setDragOver(false); if (!busy) pick(e.dataTransfer.files?.[0]); }}
          sx={{
            p: { xs: 2.5, sm: 3.5 }, borderRadius: '16px', border: '2px dashed', textAlign: 'center', cursor: busy ? 'default' : 'pointer',
            borderColor: dragOver ? 'secondary.main' : 'divider',
            bgcolor: dragOver ? 'action.selected' : 'action.hover',
            transition: 'border-color .2s ease, background-color .2s ease, transform .2s ease',
            transform: dragOver ? 'scale(1.01)' : 'none',
            '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main' },
            '@media (prefers-reduced-motion: reduce)': { transition: 'none', transform: 'none' },
          }}
        >
          <Icon name="upload_file" size={34} sx={{ color: 'secondary.main' }} />
          <Typography variant="subtitle2" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
            {file ? file.name : 'Drop a file here or click to choose'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : 'Up to 15 MB'}
          </Typography>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept={IMPORT_ACCEPT}
            onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }}
          />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, mt: 2 }}>
          {IMPORT_FORMATS.map((f) => (
            <Stack key={f.label} direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <Icon name={f.icon} size={18} sx={{ color: 'text.secondary', flex: 'none' }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>{f.label}</Typography>
                <Typography variant="caption" color="text.secondary">{f.hint}</Typography>
              </Box>
            </Stack>
          ))}
        </Box>

        {busy && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              color="secondary"
              variant={progress < 100 ? 'determinate' : 'indeterminate'}
              value={progress}
              sx={{ height: 6, borderRadius: 3 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {progress < 100 ? `Uploading ${progress}%` : 'Creating notes...'}
            </Typography>
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {result && (
          <Alert severity={result.imported > 0 ? 'success' : 'warning'} sx={{ mt: 2 }}>
            {result.imported > 0
              ? `Imported ${result.imported} note${result.imported === 1 ? '' : 's'}.`
              : 'No notes were found in this file.'}
            {result.skipped > 0 ? ` ${result.skipped} item${result.skipped === 1 ? ' was' : 's were'} skipped.` : ''}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} disabled={busy}>{result ? 'Done' : 'Cancel'}</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={start}
          disabled={!file || busy}
          startIcon={<Icon name="file_upload" size={18} />}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/** Compact toolbar icon button with tooltip + aria-label. */
const ToolBtn: React.FC<{ label: string; icon: string; onClick: () => void; active?: boolean; danger?: boolean; className?: string }> = ({
  label, icon, onClick, active, danger, className,
}) => (
  <Tooltip title={label}>
    <IconButton
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={className}
      onClick={onClick}
      sx={{
        width: { xs: 40, md: 34 }, height: { xs: 40, md: 34 }, borderRadius: '10px', flex: 'none',
        color: danger ? '#ffffff' : active ? 'secondary.main' : 'text.secondary',
        bgcolor: danger ? 'error.main' : active ? 'action.selected' : 'transparent',
        '&:hover': { bgcolor: danger ? 'error.dark' : 'action.hover', color: danger ? '#ffffff' : 'text.primary' },
      }}
    >
      <Icon name={icon} size={19} />
    </IconButton>
  </Tooltip>
);

const ToolDivider = () => <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.75 }} />;

const selectSx = {
  height: { xs: 40, md: 34 },
  px: 1,
  borderRadius: '10px',
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  color: 'text.primary',
  font: 'inherit',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  flex: 'none',
  '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main' },
};

const colorWrapSx = {
  position: 'relative' as const,
  width: { xs: 40, md: 34 },
  height: { xs: 40, md: 34 },
  borderRadius: '10px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'text.secondary',
  cursor: 'pointer',
  flex: 'none',
  '&:hover': { bgcolor: 'action.hover' },
  '& input': { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' },
};

const AI_ACTIONS: { action: string; icon: string; label: string }[] = [
  { action: 'summarize', icon: 'summarize', label: 'Summarize' },
  { action: 'action_items', icon: 'checklist', label: 'Pull out action items' },
  { action: 'professional', icon: 'badge', label: 'Make it professional' },
  { action: 'fix_grammar', icon: 'spellcheck', label: 'Fix grammar and style' },
  { action: 'expand', icon: 'lightbulb', label: 'Suggest next steps' },
  { action: 'translate_bn', icon: 'translate', label: 'Translate to Bengali (বাংলা)' },
  { action: 'translate_en', icon: 'language', label: 'Translate to English' },
  { action: 'tone_clevel', icon: 'workspace_premium', label: 'Short brief for leaders' },
  { action: 'tone_pitch', icon: 'campaign', label: 'Persuasive tone' },
  { action: 'polish_voice_memo', icon: 'record_voice_over', label: 'Clean up dictation' },
];

const aiBtnSx = {
  justifyContent: 'flex-start',
  gap: 1.25,
  width: '100%',
  minHeight: 44,
  px: 1.5,
  borderRadius: '12px',
  textAlign: 'left' as const,
  fontSize: 13.5,
  fontWeight: 600,
  color: 'text.primary',
  transition: 'background-color .2s ease, transform .2s ease',
  '& .ai-ico': { color: 'secondary.main' },
  '&:hover': { bgcolor: 'action.hover', transform: 'translateX(3px)' },
  '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
};

export const NotesView: React.FC<NotesViewProps> = ({
  isActive,
  handleNewNote,
  filteredNotes,
  activeNoteId,
  selectNote,
  stripHtmlPreview,
  noteTitle,
  setNoteTitle,
  noteEditorRef,
  noteContent,
  setNoteContent,
  triggerNoteSave,
  execEditorCmd,
  noteLineSpacing,
  setNoteLineSpacing,
  handleInsertLink,
  handleInsertTable,
  handleInsertImage,
  handleInsertCodeBlock,
  noteSpellCheck,
  setNoteSpellCheck,
  isVoiceDictating,
  toggleVoiceDictation,
  voiceDictationLang,
  setVoiceDictationLang,
  handleNotePaste,
  noteSaveStatus,
  handleDeleteNote,
  noteSaveTimerRef,
  persistNoteNow,
  handleNoteAI,
  handleOpenEmailModal,
  handleExportPDF,
  handleExportMarkdown,
  setShowShareModal,
  onPublicShareNote,
  onToggleTeamVisibility,
  hasActiveOrg,
  onNotesChanged,
}) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // --- Safe concurrent editing ---
  // baseline: the server's updated_at for the version this editor is based on.
  // seen*: titles/contents this editor has held, so our own saves are never mistaken for someone else's.
  const baselineRef = useRef<{ id: string | null; updatedAt: string | null }>({ id: null, updatedAt: null });
  const seenContentRef = useRef<string[]>([]);
  const seenTitleRef = useRef<string[]>([]);
  const [conflict, setConflict] = useState<{ note: any; kind: 'save' | 'remote' } | null>(null);
  const conflictRef = useRef(conflict);
  conflictRef.current = conflict;
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  const remember = (list: React.MutableRefObject<string[]>, v: string) => {
    if (typeof v !== 'string' || list.current[list.current.length - 1] === v) return;
    list.current.push(v);
    if (list.current.length > 80) list.current.shift();
  };
  const rememberTitle = (t: string) => {
    remember(seenTitleRef, t);
    remember(seenTitleRef, t.trim() || 'Untitled Note');
  };
  const isOwnVersion = (n: any) =>
    !!n && seenContentRef.current.includes(n.content || '') && seenTitleRef.current.includes(n.title || '');
  const adopt = (n: any) => {
    if (n?.updated_at && n.id === baselineRef.current.id) baselineRef.current.updatedAt = String(n.updated_at);
  };

  // Another note opened: reset the baseline.
  useEffect(() => {
    const n = filteredNotes.find((x) => x.id === activeNoteId);
    baselineRef.current = { id: activeNoteId, updatedAt: n?.updated_at ? String(n.updated_at) : null };
    seenContentRef.current = [];
    seenTitleRef.current = [];
    if (n) {
      remember(seenContentRef, n.content || '');
      rememberTitle(n.title || '');
    }
    if (noteEditorRef.current) remember(seenContentRef, noteEditorRef.current.innerHTML);
    setConflict(null);
    setLocalStatus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNoteId]);

  useEffect(() => {
    rememberTitle(noteTitle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteTitle]);

  // Record every editor state (typing, toolbar, paste and AI actions all change the editor).
  useEffect(() => {
    const el = noteEditorRef.current;
    if (!el || typeof MutationObserver === 'undefined') return;
    remember(seenContentRef, el.innerHTML);
    const obs = new MutationObserver(() => remember(seenContentRef, el.innerHTML));
    obs.observe(el, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteEditorRef]);

  // When the list reloads, accept our own saves and flag anyone else's.
  useEffect(() => {
    const n = filteredNotes.find((x) => x.id === activeNoteId);
    const base = baselineRef.current;
    if (!n || !n.updated_at || base.id !== activeNoteId) return;
    if (!base.updatedAt) {
      base.updatedAt = String(n.updated_at);
      return;
    }
    if (String(n.updated_at) === base.updatedAt) return;
    if (isOwnVersion(n)) adopt(n);
    else if (!conflictRef.current) setConflict({ note: n, kind: 'remote' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNotes, activeNoteId]);

  /** Checks the server version, then hands off to the normal save. */
  const guardedPersist = useCallback(
    async (title: string, html: string, notify: boolean) => {
      const base = baselineRef.current;
      if (conflictRef.current) {
        setLocalStatus('Not saved yet: choose a version above');
        return;
      }
      if (base.id && base.updatedAt) {
        const check = await checkNoteVersion(base.id, base.updatedAt);
        if (check.status === 'conflict') {
          if (isOwnVersion(check.note)) adopt(check.note);
          else {
            setConflict({ note: check.note, kind: 'save' });
            setLocalStatus('Not saved yet: choose a version above');
            return;
          }
        }
      }
      setLocalStatus(null);
      await persistNoteNow(title, html, notify);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistNoteNow],
  );

  /** Same 600 ms debounce as the normal autosave, with a version check first. */
  const guardedTrigger = (title: string, html: string) => {
    setLocalStatus('Saving...');
    if (noteSaveTimerRef.current) clearTimeout(noteSaveTimerRef.current);
    noteSaveTimerRef.current = setTimeout(() => {
      guardedPersist(title, html, false);
    }, 600);
  };

  // Light check of the open note every 30 s while this tab is visible.
  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const base = baselineRef.current;
      if (!base.id || !base.updatedAt || conflictRef.current) return;
      const check = await checkNoteVersion(base.id, base.updatedAt);
      if (check.status !== 'conflict' || baselineRef.current.id !== check.note?.id) return;
      if (isOwnVersion(check.note)) adopt(check.note);
      else if (!conflictRef.current) setConflict({ note: check.note, kind: 'remote' });
    }, 30000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, activeNoteId]);

  const loadLatest = () => {
    if (!conflict) return;
    if (noteSaveTimerRef.current) clearTimeout(noteSaveTimerRef.current);
    const latest = conflict.note;
    baselineRef.current = { id: latest.id, updatedAt: latest.updated_at ? String(latest.updated_at) : null };
    remember(seenContentRef, latest.content || '');
    rememberTitle(latest.title || '');
    setConflict(null);
    setLocalStatus(null);
    selectNote(latest);
    onNotesChanged?.();
  };

  const keepMine = () => {
    if (!conflict) return;
    if (noteSaveTimerRef.current) clearTimeout(noteSaveTimerRef.current);
    if (conflict.note?.updated_at) baselineRef.current.updatedAt = String(conflict.note.updated_at);
    setConflict(null);
    setLocalStatus(null);
    const html = noteEditorRef.current ? noteEditorRef.current.innerHTML : noteContent;
    persistNoteNow(noteTitle, html, true);
  };

  return (
    <div id="view-notes" className={`view-container ${isActive ? 'active' : ''}`}>
      <PageContainer>
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2, md: 2.5 },
            gridTemplateColumns: {
              xs: '1fr',
              md: '260px minmax(0, 1fr)',
              lg: '280px minmax(0, 1fr) 260px',
              xl: '300px minmax(0, 1fr) 280px',
            },
            alignItems: 'stretch',
          }}
        >
          {/* Notes list */}
          <Card
            sx={{
              p: 1.5, display: 'flex', flexDirection: 'column', minHeight: 0,
              height: { md: 'calc(100dvh - 140px)' }, maxHeight: { xs: 380, md: 'none' }, minWidth: 0,
              position: { md: 'sticky' }, top: { md: 16 },
              ...(riseSx(0) as object),
            }}
          >
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Button
                variant="contained"
                color="primary"
                id="btn-new-note"
                onClick={handleNewNote}
                startIcon={<Icon name="add" size={18} />}
                sx={{ flex: 1, minHeight: 44 }}
              >
                New note
              </Button>
              <Tooltip title="Start from a template">
                <IconButton
                  aria-label="Start from a template"
                  aria-expanded={showTemplates}
                  onClick={() => setShowTemplates((v) => !v)}
                  sx={{
                    width: 44, height: 44, borderRadius: '12px', border: '1px solid',
                    borderColor: showTemplates ? 'secondary.main' : 'divider',
                    color: showTemplates ? 'secondary.main' : 'text.secondary',
                    bgcolor: showTemplates ? 'action.selected' : 'transparent',
                  }}
                >
                  <Icon name="dashboard_customize" size={20} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Import notes from other apps">
                <IconButton
                  aria-label="Import notes"
                  id="btn-import-notes"
                  onClick={() => setShowImport(true)}
                  sx={{
                    width: 44, height: 44, borderRadius: '12px', border: '1px solid', borderColor: 'divider',
                    color: 'text.secondary', '&:hover': { color: 'secondary.main', borderColor: 'secondary.main' },
                  }}
                >
                  <Icon name="upload_file" size={20} />
                </IconButton>
              </Tooltip>
            </Stack>

            <Collapse in={showTemplates} unmountOnExit>
              <Box sx={{ mb: 1, p: 1, borderRadius: '14px', border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
                <Typography variant="overline" color="text.secondary" sx={{ px: 0.75, display: 'block' }}>
                  Templates
                </Typography>
                <Stack spacing={0.25}>
                  {SMART_NOTE_TEMPLATES.map((tpl) => (
                    <ButtonBase
                      key={tpl.id}
                      onClick={() => {
                        handleNewNote();
                        setTimeout(() => {
                          setNoteTitle(tpl.title);
                          setNoteContent(tpl.content);
                          if (noteEditorRef.current) {
                            noteEditorRef.current.innerHTML = tpl.content;
                          }
                          (triggerNoteSave as (...args: any[]) => void)();
                        }, 30);
                        setShowTemplates(false);
                      }}
                      sx={{ ...aiBtnSx, minHeight: 40, fontSize: 13 }}
                    >
                      <Icon name={tpl.icon} size={18} sx={{ color: 'secondary.main' }} />
                      <span>{tpl.name}</span>
                    </ButtonBase>
                  ))}
                </Stack>
              </Box>
            </Collapse>

            <Box id="notes-list-container" sx={{ flex: 1, minHeight: 0, overflowY: 'auto', mx: -0.5, px: 0.5 }}>
              {filteredNotes.length === 0 ? (
                <EmptyState icon="sticky_note_2" title="No notes yet" description="Select New note to start writing." />
              ) : (
                <Stack spacing={0.75}>
                  {filteredNotes.map((n, i) => {
                    const selected = activeNoteId === n.id;
                    return (
                      <ButtonBase
                        key={n.id}
                        onClick={() => selectNote(n)}
                        aria-current={selected ? 'true' : undefined}
                        sx={{
                          display: 'block', width: '100%', textAlign: 'left', p: 1.5, borderRadius: '14px',
                          border: '1px solid', borderColor: selected ? 'secondary.main' : 'transparent',
                          bgcolor: selected ? 'action.selected' : 'transparent',
                          transition: 'background-color .2s ease, transform .2s ease, border-color .2s ease',
                          '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover', transform: 'translateY(-1px)' },
                          '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main' },
                          '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
                          ...(riseSx(i + 1) as object),
                        }}
                      >
                        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                          {n.title || 'Untitled Note'}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="div"
                          sx={{ mt: 0.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}
                        >
                          {stripHtmlPreview(n.content || '') || 'Empty note...'}
                        </Typography>
                      </ButtonBase>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </Card>

          {/* Editor */}
          <Card
            sx={{
              p: 0, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden',
              height: { xs: 'auto', md: 'calc(100dvh - 140px)' }, minHeight: { xs: 520, md: 520 },
              ...(riseSx(1) as object),
            }}
          >
            <Collapse in={!!conflict} unmountOnExit>
              <Alert
                severity="warning"
                role="status"
                icon={<Icon name="sync_problem" size={20} />}
                sx={{ mx: { xs: 1.5, sm: 2.5 }, mt: { xs: 1.5, sm: 2 }, borderRadius: '12px', alignItems: 'center', flexWrap: 'wrap' }}
                action={
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    <Button size="small" color="inherit" onClick={loadLatest}>Load latest</Button>
                    <Button size="small" color="inherit" onClick={keepMine}>Keep mine (overwrite)</Button>
                  </Stack>
                }
              >
                {conflict?.kind === 'remote' ? 'Updated by someone else.' : 'This note was changed elsewhere.'}
              </Alert>
            </Collapse>
            <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 } }}>
              <Box
                component="input"
                type="text"
                id="note-title-input"
                className="note-title-input"
                aria-label="Note title"
                placeholder="Untitled note"
                value={noteTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const val = e.target.value;
                  setNoteTitle(val);
                  const currentHtml = noteEditorRef.current ? noteEditorRef.current.innerHTML : noteContent;
                  guardedTrigger(val, currentHtml);
                }}
                sx={{
                  width: '100%', minWidth: 0, fontSize: { xs: 22, sm: 26 }, fontWeight: 800, letterSpacing: '-0.02em',
                  color: 'text.primary', bgcolor: 'transparent', border: 'none', outline: 'none', p: 0, mb: 1.5,
                  '&::placeholder': { color: 'text.disabled' },
                }}
              />
            </Box>

            {/* Formatting toolbar */}
            <Box
              role="toolbar"
              aria-label="Text formatting"
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.25, flexWrap: { xs: 'nowrap', md: 'wrap' },
                overflowX: { xs: 'auto', md: 'visible' }, mx: { xs: 1.5, sm: 2.5 }, px: 0.75, py: 0.5,
                borderRadius: '14px', border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover',
                scrollbarWidth: 'thin',
              }}
            >
              <ToolBtn label="Undo (Ctrl+Z)" icon="undo" onClick={() => execEditorCmd('undo')} />
              <ToolBtn label="Redo (Ctrl+Y)" icon="redo" onClick={() => execEditorCmd('redo')} />
              <ToolDivider />
              <ToolBtn label="Bold (Ctrl+B)" icon="format_bold" onClick={() => execEditorCmd('bold')} />
              <ToolBtn label="Italic (Ctrl+I)" icon="format_italic" onClick={() => execEditorCmd('italic')} />
              <ToolBtn label="Underline (Ctrl+U)" icon="format_underlined" onClick={() => execEditorCmd('underline')} />
              <ToolBtn label="Strikethrough" icon="strikethrough_s" onClick={() => execEditorCmd('strikeThrough')} />
              <ToolDivider />

              <Box
                component="select"
                aria-label="Font"
                title="Font"
                defaultValue="Inter"
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => execEditorCmd('fontName', e.target.value)}
                sx={selectSx}
              >
                <option value="Inter">Font</option>
                <option value="Inter">Inter Sans</option>
                <option value="Plus Jakarta Sans">Jakarta Sans</option>
                <option value="JetBrains Mono">JetBrains Mono</option>
                <option value="Georgia">Serif</option>
              </Box>

              <Box
                component="select"
                aria-label="Text size"
                title="Text size"
                defaultValue="3"
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => execEditorCmd('fontSize', e.target.value)}
                sx={{ ...selectSx, ml: 0.5 }}
              >
                <option value="1">8</option>
                <option value="2">10</option>
                <option value="3">12</option>
                <option value="4">14</option>
                <option value="5">18</option>
                <option value="6">24</option>
              </Box>

              <Box
                component="select"
                aria-label="Line spacing and paragraph style"
                title="Line spacing and paragraph style"
                value={noteLineSpacing}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const val = e.target.value;
                  if (val.startsWith('H') || val === 'P') {
                    execEditorCmd('formatBlock', val);
                  } else {
                    setNoteLineSpacing(val);
                  }
                }}
                sx={{ ...selectSx, ml: 0.5 }}
              >
                <option value="1.2">Tight spacing</option>
                <option value="1.65">Normal spacing</option>
                <option value="2.0">Relaxed spacing</option>
                <option value="H1">Heading 1</option>
                <option value="H2">Heading 2</option>
                <option value="H3">Heading 3</option>
                <option value="P">Paragraph</option>
              </Box>
              <ToolDivider />

              <ToolBtn label="Align left" icon="format_align_left" onClick={() => execEditorCmd('justifyLeft')} />
              <ToolBtn label="Align center" icon="format_align_center" onClick={() => execEditorCmd('justifyCenter')} />
              <ToolBtn label="Bulleted list" icon="format_list_bulleted" onClick={() => execEditorCmd('insertUnorderedList')} />
              <ToolBtn label="Numbered list" icon="format_list_numbered" onClick={() => execEditorCmd('insertOrderedList')} />
              <ToolBtn label="Indent" icon="format_indent_increase" onClick={() => execEditorCmd('indent')} />
              <ToolBtn label="Outdent" icon="format_indent_decrease" onClick={() => execEditorCmd('outdent')} />
              <ToolDivider />

              <ToolBtn label="Superscript" icon="superscript" onClick={() => execEditorCmd('superscript')} />
              <ToolBtn label="Subscript" icon="subscript" onClick={() => execEditorCmd('subscript')} />

              <Tooltip title="Text color">
                <Box component="label" sx={colorWrapSx}>
                  <Icon name="format_color_text" size={19} />
                  <input
                    type="color"
                    aria-label="Text color"
                    defaultValue="#818cf8"
                    onChange={e => execEditorCmd('foreColor', e.target.value)}
                  />
                </Box>
              </Tooltip>
              <Tooltip title="Highlight">
                <Box component="label" sx={colorWrapSx}>
                  <Icon name="ink_highlighter" size={19} />
                  <input
                    type="color"
                    aria-label="Highlight color"
                    defaultValue="#fef08a"
                    onChange={e => execEditorCmd('hiliteColor', e.target.value)}
                  />
                </Box>
              </Tooltip>

              <ToolBtn label="Clear formatting" icon="ink_eraser" onClick={() => execEditorCmd('removeFormat')} />
              <ToolDivider />

              <ToolBtn label="Insert link" icon="link" onClick={handleInsertLink} />
              <ToolBtn label="Insert table" icon="table_chart" onClick={handleInsertTable} />
              <ToolBtn label="Insert divider" icon="horizontal_rule" onClick={() => execEditorCmd('insertHorizontalRule')} />
              <ToolBtn label="Insert image" icon="add_photo_alternate" onClick={handleInsertImage} />
              <ToolBtn label="Insert code block" icon="code" onClick={handleInsertCodeBlock} />
              <ToolBtn label="Spell check" icon="spellcheck" active={noteSpellCheck} onClick={() => setNoteSpellCheck(!noteSpellCheck)} />
              <ToolDivider />

              <ToolBtn
                label={isVoiceDictating ? 'Stop dictation' : 'Start dictation'}
                icon={isVoiceDictating ? 'mic_off' : 'mic'}
                danger={isVoiceDictating}
                className={isVoiceDictating ? 'voice-dictating-pulse' : undefined}
                onClick={toggleVoiceDictation}
              />
              <Box
                component="select"
                aria-label="Dictation language"
                title="Dictation language"
                value={voiceDictationLang}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVoiceDictationLang(e.target.value as any)}
                sx={{ ...selectSx, ml: 0.5 }}
              >
                <option value="bn-BD">বাংলা (BN)</option>
                <option value="en-US">English (US)</option>
              </Box>
            </Box>

            {/* Rich ContentEditable Note Surface */}
            <Box sx={{ flex: 1, minHeight: { xs: 280, md: 0 }, display: 'flex', flexDirection: 'column', px: { xs: 2, sm: 3 }, py: 2 }}>
              <div
                ref={noteEditorRef}
                id="note-content-input"
                className="note-rich-editor"
                contentEditable
                suppressContentEditableWarning
                spellCheck={noteSpellCheck}
                aria-label="Note content"
                role="textbox"
                aria-multiline="true"
                style={{ lineHeight: noteLineSpacing, fontSize: '15px' }}
                data-placeholder="Start writing, or paste text, lists and tables..."
                onInput={e => {
                  const html = e.currentTarget.innerHTML;
                  setNoteContent(html);
                  guardedTrigger(noteTitle, html);
                }}
                onPaste={handleNotePaste}
              />
            </Box>

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
              sx={{ px: { xs: 2, sm: 3 }, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
            >
              <Typography variant="caption" color="text.secondary" id="note-save-status" noWrap sx={{ minWidth: 0 }}>
                {localStatus ?? noteSaveStatus}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flex: 'none' }}>
                <Tooltip title="Delete note">
                  <IconButton
                    id="btn-delete-note"
                    aria-label="Delete note"
                    onClick={handleDeleteNote}
                    sx={{ width: 44, height: 44, borderRadius: '12px', border: '1px solid', borderColor: 'divider', '&:hover': { color: 'error.main' } }}
                  >
                    <Icon name="delete" size={20} />
                  </IconButton>
                </Tooltip>
                <Button
                  variant="contained"
                  color="primary"
                  id="btn-manual-save-note"
                  startIcon={<Icon name="save" size={18} />}
                  sx={{ minHeight: 44 }}
                  onClick={() => {
                    if (noteSaveTimerRef.current) clearTimeout(noteSaveTimerRef.current);
                    const html = noteEditorRef.current ? noteEditorRef.current.innerHTML : noteContent;
                    guardedPersist(noteTitle, html, true);
                  }}
                >
                  Save
                </Button>
              </Stack>
            </Stack>
          </Card>

          {/* AI assistant + export */}
          <Card
            component="aside"
            aria-label="Writing assistant"
            sx={{
              p: 1.5, minWidth: 0, gridColumn: { md: '1 / -1', lg: 'auto' },
              height: { lg: 'calc(100dvh - 140px)' }, overflowY: { lg: 'auto' },
              ...(riseSx(2) as object),
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1, pt: 0.5, pb: 1 }}>
              <Icon name="auto_awesome" size={20} sx={{ color: 'secondary.main' }} />
              <Typography variant="subtitle2">Writing assistant</Typography>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)', lg: '1fr' },
                gap: 0.25,
              }}
            >
              {AI_ACTIONS.map((a) => (
                <ButtonBase key={a.action} onClick={() => handleNoteAI(a.action)} sx={aiBtnSx}>
                  <Icon name={a.icon} size={19} sx={{ color: 'secondary.main' }} />
                  <span>{a.label}</span>
                </ButtonBase>
              ))}
              <ButtonBase onClick={() => handleOpenEmailModal('note')} sx={aiBtnSx}>
                <Icon name="forward_to_inbox" size={19} sx={{ color: 'secondary.main' }} />
                <span>Draft an email</span>
              </ButtonBase>
            </Box>

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="overline" color="text.secondary" sx={{ px: 1, display: 'block', mb: 1 }}>
              Export and share
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)', lg: '1fr 1fr' }, gap: 1 }}>
              <Button variant="outlined" onClick={handleExportPDF} title="Print or save as PDF" startIcon={<Icon name="picture_as_pdf" size={18} />} sx={{ minHeight: 44 }}>
                PDF
              </Button>
              <Button variant="outlined" onClick={handleExportMarkdown} title="Download as Markdown (.md)" startIcon={<Icon name="download" size={18} />} sx={{ minHeight: 44 }}>
                Markdown
              </Button>
              <Button
                variant="outlined"
                onClick={() => setShowShareModal(true)}
                startIcon={<Icon name="share" size={18} />}
                sx={{ minHeight: 44, gridColumn: { xs: '1 / -1', md: 'auto', lg: '1 / -1' } }}
              >
                Share preview
              </Button>
              {onPublicShareNote && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={onPublicShareNote}
                  startIcon={<Icon name="public" size={18} />}
                  sx={{ minHeight: 44, gridColumn: { xs: '1 / -1', md: 'auto', lg: '1 / -1' } }}
                >
                  Copy public link
                </Button>
              )}
              {hasActiveOrg && onToggleTeamVisibility && (
                <Button
                  variant="outlined"
                  onClick={onToggleTeamVisibility}
                  startIcon={<Icon name="groups" size={18} />}
                  sx={{ minHeight: 44, gridColumn: { xs: '1 / -1', md: 'auto', lg: '1 / -1' } }}
                >
                  Share with team
                </Button>
              )}
            </Box>
          </Card>
        </Box>
      </PageContainer>
      <ImportNotesDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={(r) => {
          if (r.imported > 0) onNotesChanged?.();
        }}
      />
    </div>
  );
};
