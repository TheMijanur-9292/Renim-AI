import React from 'react';
import { Box, ButtonBase } from '@mui/material';
import type { ViewId } from './Sidebar';
import { Icon } from '../ui';

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
    { id: 'view-chat', label: 'Copilot', icon: 'forum' },
  ];

  const Tab = ({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) => (
    <ButtonBase
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`mobile-nav-btn ${active ? 'active' : ''}`}
      sx={{
        flexDirection: 'column',
        gap: '3px',
        fontFamily: 'inherit',
        fontSize: 11,
        fontWeight: active ? 700 : 600,
        color: active ? 'text.primary' : 'text.secondary',
        minHeight: 56,
        position: 'relative',
        '&::before': {
          content: '""', position: 'absolute', top: 6, width: 44, height: 28, borderRadius: 999,
          bgcolor: active ? 'action.selected' : 'transparent', transition: 'background-color .2s',
        },
      }}
    >
      <Icon name={icon} size={22} fill={active} sx={{ position: 'relative', color: active ? 'secondary.main' : 'inherit' }} />
      <Box component="span" sx={{ position: 'relative' }}>{label}</Box>
    </ButtonBase>
  );

  return (
    <Box component="nav" className="mobile-bottom-nav" aria-label="Mobile navigation" sx={{ boxShadow: 'none !important' }}>
      {items.map((item) => (
        <Tab key={item.id} active={!isMenuOpen && activeView === item.id} icon={item.icon} label={item.label} onClick={() => onSelectView(item.id)} />
      ))}
      <Tab active={isMenuOpen} icon={isMenuOpen ? 'close' : 'apps'} label="More" onClick={onOpenMenu} />
    </Box>
  );
};
