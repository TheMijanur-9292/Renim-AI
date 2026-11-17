import React from 'react';
import type { ViewId } from './Sidebar';

interface MobileBottomNavProps {
  activeView: ViewId;
  onSelectView: (view: ViewId) => void;
  onOpenMenu: () => void;
  isMenuOpen: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onSelectView,
  onOpenMenu,
  isMenuOpen,
}) => {
  const items: Array<{ id: ViewId; label: string; icon: string }> = [
    { id: 'view-today', label: 'Today', icon: 'wb_sunny' },
    { id: 'view-notes', label: 'Notes', icon: 'edit_note' },
    { id: 'view-tasks', label: 'Tasks', icon: 'task_alt' },
    { id: 'view-chat', label: 'Copilot', icon: 'smart_toy' },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      {items.map((item) => {
        const active = !isMenuOpen && activeView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`mobile-nav-btn ${active ? 'active' : ''}`}
            onClick={() => onSelectView(item.id)}
          >
            <span className="material-symbols-rounded">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        className={`mobile-nav-btn ${isMenuOpen ? 'active' : ''}`}
        onClick={onOpenMenu}
      >
        <span className="material-symbols-rounded">{isMenuOpen ? 'close' : 'apps'}</span>
        <span>More</span>
      </button>
    </nav>
  );
};
