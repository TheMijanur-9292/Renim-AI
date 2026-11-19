import React from 'react';
import { Avatar, Box, ButtonBase, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { Icon, avatarIcon } from '../ui';

export type ViewId =
  | 'view-today'
  | 'view-meetings'
  | 'view-notes'
  | 'view-calendar'
  | 'view-tasks'
  | 'view-growth'
  | 'view-docs'
  | 'view-rag'
  | 'view-chat'
  | 'view-team'
  | 'view-analytics'
  | 'view-integrations'
  | 'view-billing'
  | 'view-security'
  | 'view-settings'
  | 'view-profile'
  | 'view-superadmin';

interface SidebarProps {
  activeView: ViewId;
  setActiveView: (view: ViewId) => void;
  counts: {
    meetings: number;
    notes: number;
    tasks: number;
    events: number;
    documents: number;
  };
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
  isSuperAdmin?: boolean;
  activeOrgName?: string;
  isAuthenticated: boolean;
  onAuthTrigger: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

type NavItem = { id: ViewId; icon: string; label: string; count?: number; gold?: boolean };

const isImg = (u: string) => u.startsWith('http') || u.startsWith('data:image');

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  counts,
  userName,
  userEmail,
  userAvatarUrl = '',
  isSuperAdmin = false,
  activeOrgName,
  isAuthenticated,
  onAuthTrigger,
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile
}) => {
  const handleSelect = (view: ViewId) => {
    setActiveView(view);
    onCloseMobile?.();
  };

  const teamLabel =
    activeOrgName && activeOrgName !== 'Personal' && activeOrgName !== 'Personal Workspace'
      ? `Team · ${activeOrgName.slice(0, 14)}`
      : 'Team';

  const groups: Array<{ title: string; items: NavItem[] }> = [
    {
      title: 'Workspace',
      items: [
        { id: 'view-today', icon: 'wb_sunny', label: 'Today' },
        { id: 'view-meetings', icon: 'mic', label: 'Meetings', count: counts.meetings },
        { id: 'view-notes', icon: 'edit_note', label: 'Notes', count: counts.notes },
        { id: 'view-calendar', icon: 'calendar_month', label: 'Calendar', count: counts.events },
        { id: 'view-tasks', icon: 'task_alt', label: 'Tasks', count: counts.tasks },
        { id: 'view-growth', icon: 'local_fire_department', label: 'Habits & Goals' },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        { id: 'view-docs', icon: 'description', label: 'Documents', count: counts.documents },
        { id: 'view-rag', icon: 'travel_explore', label: 'Knowledge Search' },
        { id: 'view-chat', icon: 'forum', label: 'Ask Copilot' },
      ],
    },
    {
      title: 'Organization',
      items: [
        { id: 'view-team', icon: 'groups', label: teamLabel },
        { id: 'view-analytics', icon: 'insights', label: 'Insights' },
        { id: 'view-integrations', icon: 'hub', label: 'Integrations' },
        { id: 'view-billing', icon: 'credit_card', label: 'Plan & Billing' },
        { id: 'view-security', icon: 'shield_lock', label: 'Security' },
        ...(isSuperAdmin ? [{ id: 'view-superadmin' as ViewId, icon: 'admin_panel_settings', label: 'Super Admin', gold: true }] : []),
        { id: 'view-settings', icon: 'tune', label: 'Settings' },
      ],
    },
  ];

  const NavButton = ({ item }: { item: NavItem }) => {
    const on = activeView === item.id;
    const btn = (
      <ButtonBase
        onClick={() => handleSelect(item.id)}
        aria-current={on ? 'page' : undefined}
        aria-label={collapsed ? item.label : undefined}
        sx={(t) => ({
          width: '100%',
          height: 40,
          px: collapsed ? 0 : 1.5,
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 1.5,
          borderRadius: '10px',
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: on ? 700 : 500,
          color: on ? 'text.primary' : 'text.secondary',
          bgcolor: on ? (t.palette.mode === 'dark' ? 'rgba(34,211,238,.12)' : '#ecf3f6') : 'transparent',
          transition: 'background-color .15s, color .15s',
          '&:hover': { bgcolor: on ? undefined : t.palette.mode === 'dark' ? 'rgba(148,163,184,.1)' : '#f1f5f9', color: on ? undefined : 'text.primary' },
          boxShadow: on ? `inset 3px 0 0 ${t.palette.mode === 'dark' ? '#22d3ee' : '#0891b2'}` : 'none',
        })}
      >
        <Icon name={item.icon} size={20} fill={on} sx={{ color: item.gold ? '#f59e0b' : on ? 'secondary.main' : 'inherit' }} />
        {!collapsed && (
          <>
            <Box component="span" sx={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</Box>
            {!!item.count && (
              <Box component="span" sx={(t) => ({ fontSize: 11, fontWeight: 700, px: 0.9, py: 0.2, borderRadius: 999, bgcolor: on ? 'background.paper' : t.palette.mode === 'dark' ? 'rgba(148,163,184,.14)' : '#f1f5f9', color: on ? 'inherit' : 'text.secondary' })}>
                {item.count}
              </Box>
            )}
          </>
        )}
      </ButtonBase>
    );
    return collapsed ? <Tooltip title={item.label} placement="right">{btn}</Tooltip> : btn;
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`} style={{ padding: 0 }}>
      <Stack sx={{ height: '100%', minHeight: 0 }}>
        {/* Brand */}
        <Stack direction="row" alignItems="center" justifyContent={collapsed ? 'center' : 'space-between'} sx={{ px: collapsed ? 1 : 2, pt: 2.25, pb: 1.25, gap: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.25} component="a" href="/" sx={{ color: 'text.primary', textDecoration: 'none', minWidth: 0 }}>
            <Box component="img" src="/icon.svg" alt="Renim AI" sx={{ width: 32, height: 32, borderRadius: '10px', flex: 'none' }} />
            {!collapsed && (
              <Typography sx={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                Renim <Box component="span" sx={{ color: 'secondary.main' }}>AI</Box>
              </Typography>
            )}
          </Stack>
          {onToggleCollapse && !collapsed && (
            <IconButton size="small" onClick={onToggleCollapse} aria-label="Collapse sidebar" className="sidebar-collapse-btn">
              <Icon name="left_panel_close" size={19} />
            </IconButton>
          )}
        </Stack>
        {onToggleCollapse && collapsed && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1 }}>
            <IconButton size="small" onClick={onToggleCollapse} aria-label="Expand sidebar"><Icon name="left_panel_open" size={19} /></IconButton>
          </Box>
        )}

        {/* Nav */}
        <Box component="nav" aria-label="Workspace" sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: collapsed ? 1 : 1.5, pb: 1.5 }}>
          {groups.map((g) => (
            <Box key={g.title}>
              {collapsed ? (
                <Box sx={{ height: 14 }} />
              ) : (
                <Typography variant="overline" component="div" sx={{ color: 'text.disabled', px: 1.5, pt: 2, pb: 0.5, fontSize: 11 }}>
                  {g.title}
                </Typography>
              )}
              <Stack spacing={0.25}>
                {g.items.map((it) => <NavButton key={it.id} item={it} />)}
              </Stack>
            </Box>
          ))}
        </Box>

        {/* User */}
        <Box sx={{ p: collapsed ? 1 : 1.5, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction={collapsed ? 'column' : 'row'} alignItems="center" spacing={1}>
            <ButtonBase
              onClick={() => handleSelect('view-profile')}
              aria-label="Open my profile"
              sx={{ flex: 1, minWidth: 0, width: collapsed ? 'auto' : undefined, display: 'flex', alignItems: 'center', gap: 1.25, p: 0.75, borderRadius: '12px', justifyContent: 'flex-start', textAlign: 'left', '&:hover': { bgcolor: 'action.hover' } }}
            >
              <Avatar
                src={isImg(userAvatarUrl) ? userAvatarUrl : undefined}
                alt={userName}
                sx={{ width: 34, height: 34, fontSize: 14, fontWeight: 800, color: '#0f172a', background: 'linear-gradient(135deg,#67e8f9,#818cf8)', outline: activeView === 'view-profile' ? '2px solid' : 'none', outlineColor: 'secondary.main', outlineOffset: 2 }}
              >
                {!isImg(userAvatarUrl) && (avatarIcon(userAvatarUrl) ? <Icon name={avatarIcon(userAvatarUrl)!} size={18} /> : (userAvatarUrl || (userName ? userName.charAt(0).toUpperCase() : 'U')))}
              </Avatar>
              {!collapsed && (
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 13, fontWeight: 700 }}>{userName}</Typography>
                  <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>{userEmail}</Typography>
                </Box>
              )}
            </ButtonBase>
            <Tooltip title={isAuthenticated ? 'Sign out' : 'Sign in'}>
              <IconButton size="small" onClick={onAuthTrigger} aria-label={isAuthenticated ? 'Sign out' : 'Sign in'} id="btn-auth-trigger">
                <Icon name={isAuthenticated ? 'logout' : 'login'} size={19} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Stack>
    </aside>
  );
};
