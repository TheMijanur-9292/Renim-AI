import React, { useEffect, useMemo, useState } from 'react';
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
  { id: 'view-today', label: 'Today Dashboard', icon: 'wb_sunny', section: 'Navigation' },
  { id: 'view-meetings', label: 'Meetings Hub', icon: 'mic', section: 'Navigation' },
  { id: 'view-notes', label: 'Smart Notes', icon: 'edit_note', section: 'Navigation' },
  { id: 'view-calendar', label: 'Calendar & Alerts', icon: 'calendar_month', section: 'Navigation' },
  { id: 'view-tasks', label: 'Tasks & Kanban Board', icon: 'task_alt', section: 'Navigation' },
  { id: 'view-growth', label: 'Habits, Goals, Mind-Map & Tools', icon: 'local_fire_department', section: 'Navigation' },
  { id: 'view-docs', label: 'Docs & Knowledge AI', icon: 'description', section: 'Navigation' },
  { id: 'view-rag', label: 'Enterprise RAG Search', icon: 'neurology', section: 'Navigation' },
  { id: 'view-chat', label: 'Ask Copilot AI', icon: 'smart_toy', section: 'Navigation' },
  { id: 'view-team', label: 'Team & Organizations (Multi-Tenant)', icon: 'corporate_fare', section: 'Enterprise' },
  { id: 'view-analytics', label: 'Analytics & BI', icon: 'analytics', section: 'Enterprise' },
  { id: 'view-integrations', label: 'Integrations & API Keys', icon: 'hub', section: 'Enterprise' },
  { id: 'view-billing', label: 'Billing & Quotas', icon: 'payments', section: 'Enterprise' },
  { id: 'view-security', label: 'Security & Audit Logs', icon: 'verified_user', section: 'Enterprise' },
  { id: 'view-profile', label: 'My Profile & Account', icon: 'account_circle', section: 'Enterprise' },
  { id: 'view-settings', label: 'Settings & Cloud', icon: 'tune', section: 'Enterprise' },
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
      { key: 'act-note', label: 'Create New Smart Note', sub: 'Quick Action', icon: 'add_notes', run: onCreateNote },
      { key: 'act-task', label: 'Create New Task', sub: 'Quick Action', icon: 'add_task', run: onCreateTask },
      { key: 'act-doc', label: 'Upload Knowledge Document', sub: 'Quick Action', icon: 'upload_file', run: onUploadDoc },
      ...VIEW_COMMANDS.map((v) => ({
        key: `view-${v.id}`,
        label: v.label,
        sub: v.section,
        icon: v.icon,
        run: () => onNavigateView(v.id),
      })),
      ...notes.slice(0, 8).map((n) => ({
        key: `note-${n.id}`,
        label: n.title || 'Untitled Note',
        sub: 'Smart Note',
        icon: 'description',
        run: () => onSelectNote(n.id),
      })),
      ...tasks.slice(0, 8).map((t) => ({
        key: `task-${t.id}`,
        label: t.title,
        sub: 'Task',
        icon: 'check_box',
        run: () => onNavigateView('view-tasks'),
      })),
      ...documents.slice(0, 6).map((d) => ({
        key: `doc-${d.id}`,
        label: d.filename || d.title || 'Document',
        sub: 'Knowledge Doc',
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

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9500,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '11vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92%',
          maxWidth: '580px',
          background: 'var(--mui-surface)',
          border: '1px solid var(--mui-border)',
          borderRadius: '14px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid var(--mui-border)' }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--mui-primary)' }}>search</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            placeholder="Jump to view, search notes/tasks/docs, or run quick action..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--mui-text-primary)', fontSize: '14px' }}
          />
          <kbd style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--mui-border)', color: 'var(--mui-text-muted)' }}>
            ESC
          </kbd>
        </div>

        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
          {items.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--mui-text-muted)', fontSize: '13px' }}>
              No matching commands or workspace items.
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.key}
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={() => item.run()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: idx === selectedIdx ? 'var(--mui-primary-subtle)' : 'transparent',
                  color: idx === selectedIdx ? 'var(--mui-text-primary)' : 'var(--mui-text-secondary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '18px', color: idx === selectedIdx ? 'var(--mui-primary)' : 'var(--mui-text-muted)' }}>
                    {item.icon}
                  </span>
                  <span style={{ fontSize: '13.5px', fontWeight: 500 }}>{item.label}</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--mui-text-muted)' }}>{item.sub}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
