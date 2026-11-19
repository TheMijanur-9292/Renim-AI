import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Dialog, InputBase, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Icon } from '../ui';
import { useDialogProps } from './DialogParts';
import type { ViewId } from '../common/Sidebar';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  setQuery: (q: string) => void;
  notes: Array<{ id: string; title: string }>;
  tasks: Array<{ id: string; title: string }>;
  documents: Array<{ id: string; filename?: string; title?: string }>;
  onNavigateView: (view: ViewId) => void;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onCreateTask: () => void;
  onUploadDoc: () => void;
  onSelectDoc: (docId: string) => void;
}

const VIEW_COMMANDS: Array<{ id: ViewId; label: string; icon: string; section: string }> = [
  { id: 'view-today', label: 'Today', icon: 'wb_sunny', section: 'Go to' },
  { id: 'view-meetings', label: 'Meetings', icon: 'mic', section: 'Go to' },
  { id: 'view-notes', label: 'Notes', icon: 'edit_note', section: 'Go to' },
  { id: 'view-calendar', label: 'Calendar', icon: 'calendar_month', section: 'Go to' },
  { id: 'view-tasks', label: 'Tasks', icon: 'task_alt', section: 'Go to' },
  { id: 'view-growth', label: 'Habits & goals', icon: 'local_fire_department', section: 'Go to' },
  { id: 'view-docs', label: 'Documents', icon: 'description', section: 'Go to' },
  { id: 'view-rag', label: 'Knowledge search', icon: 'neurology', section: 'Go to' },
  { id: 'view-chat', label: 'Ask Copilot', icon: 'forum', section: 'Go to' },
  { id: 'view-team', label: 'Team', icon: 'corporate_fare', section: 'Workspace' },
  { id: 'view-analytics', label: 'Insights', icon: 'insights', section: 'Workspace' },
  { id: 'view-integrations', label: 'Integrations', icon: 'hub', section: 'Workspace' },
  { id: 'view-billing', label: 'Plan & Billing', icon: 'credit_card', section: 'Workspace' },
  { id: 'view-security', label: 'Security', icon: 'verified_user', section: 'Workspace' },
  { id: 'view-profile', label: 'Profile', icon: 'account_circle', section: 'Workspace' },
  { id: 'view-settings', label: 'Settings', icon: 'tune', section: 'Workspace' },
];

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  query,
  setQuery,
  notes,
  tasks,
  documents,
  onNavigateView,
  onSelectNote,
  onCreateNote,
  onCreateTask,
  onUploadDoc,
  onSelectDoc,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const { isPhone, ...dialogProps } = useDialogProps();
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (isOpen) setSelectedIdx(0);
  }, [isOpen]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: Array<{
      key: string;
      label: string;
      sub: string;
      icon: string;
      run: () => void;
    }> = [
      { key: 'act-note', label: 'New note', sub: 'Actions', icon: 'add_notes', run: onCreateNote },
      { key: 'act-task', label: 'New task', sub: 'Actions', icon: 'add_task', run: onCreateTask },
      { key: 'act-doc', label: 'Upload document', sub: 'Actions', icon: 'upload_file', run: onUploadDoc },
      ...VIEW_COMMANDS.map((v) => ({
        key: `view-${v.id}`,
        label: v.label,
        sub: v.section,
        icon: v.icon,
        run: () => onNavigateView(v.id),
      })),
      ...notes.slice(0, 8).map((n) => ({
        key: `note-${n.id}`,
        label: n.title || 'Untitled note',
        sub: 'Notes',
        icon: 'description',
        run: () => onSelectNote(n.id),
      })),
      ...tasks.slice(0, 8).map((t) => ({
        key: `task-${t.id}`,
        label: t.title,
        sub: 'Tasks',
        icon: 'check_box',
        run: () => onNavigateView('view-tasks'),
      })),
      ...documents.slice(0, 6).map((d) => ({
        key: `doc-${d.id}`,
        label: d.filename || d.title || 'Document',
        sub: 'Documents',
        icon: 'article',
        run: () => onSelectDoc(d.id),
      })),
    ];

    if (!q) return list.slice(0, 12);
    return list.filter((i) => i.label.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q)).slice(0, 14);
  }, [query, notes, tasks, documents, onCreateNote, onCreateTask, onUploadDoc, onNavigateView, onSelectNote, onSelectDoc]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => (items.length ? (i + 1) % items.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
      } else if (e.key === 'Enter' && items[selectedIdx]) {
        e.preventDefault();
        items[selectedIdx].run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, items, selectedIdx, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  return (
    <Dialog
      {...dialogProps}
      open={isOpen}
      // Escape is handled by the keydown listener above; backdrop click closes.
      disableEscapeKeyDown
      onClose={(_e, reason) => { if (reason === 'backdropClick') onClose(); }}
      maxWidth={false}
      aria-labelledby="command-palette-title"
      sx={{ '& .MuiDialog-container': { alignItems: isPhone ? 'stretch' : 'flex-start' } }}
      PaperProps={{ sx: { width: isPhone ? '100%' : 'min(620px, 92vw)', mt: isPhone ? 0 : '11vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: isPhone ? '100%' : '70vh' } }}
    >
      <Typography id="command-palette-title" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Command palette
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Icon name="search" size={24} sx={{ color: 'primary.main' }} />
        <InputBase
          autoFocus
          fullWidth
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIdx(0);
          }}
          placeholder="Search or jump to..."
          inputProps={{ 'aria-label': 'Search commands' }}
          sx={{ fontSize: 18, fontWeight: 500 }}
        />
        <Box
          component={isPhone ? 'button' : 'kbd'}
          onClick={isPhone ? onClose : undefined}
          aria-label={isPhone ? 'Close' : undefined}
          sx={{ fontSize: 11, fontWeight: 700, px: 0.75, py: 0.25, borderRadius: '6px', border: 1, borderColor: 'divider', color: 'text.secondary', bgcolor: 'transparent', fontFamily: 'inherit', cursor: isPhone ? 'pointer' : 'default' }}
        >
          ESC
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
        {items.length === 0 ? (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <Icon name="search_off" size={28} sx={{ color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No results found.</Typography>
          </Box>
        ) : (
          <List ref={listRef} disablePadding role="listbox" aria-label="Results">
            {items.map((item, idx) => {
              const active = idx === selectedIdx;
              const showHeader = idx === 0 || items[idx - 1].sub !== item.sub;
              return (
                <React.Fragment key={item.key}>
                  {showHeader && (
                    <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: '28px', mt: idx === 0 ? 0 : 1, px: 1.5, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
                      {item.sub}
                    </ListSubheader>
                  )}
                  <ListItemButton
                    data-idx={idx}
                    role="option"
                    aria-selected={active}
                    selected={active}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    onClick={() => item.run()}
                    sx={(t) => ({
                      py: 1,
                      px: 1.5,
                      transition: 'background-color .12s ease',
                      '&.Mui-selected, &.Mui-selected:hover': { bgcolor: alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.16 : 0.07) },
                    })}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: active ? 'primary.main' : 'text.secondary' }}>
                      <Icon name={item.icon} size={20} />
                    </ListItemIcon>
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14.5, fontWeight: active ? 600 : 500, noWrap: true }} />
                    {active && <Icon name="keyboard_return" size={16} sx={{ color: 'text.secondary', ml: 1 }} />}
                  </ListItemButton>
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Box>
    </Dialog>
  );
};
