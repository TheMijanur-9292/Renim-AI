import React from 'react';
import {
  Avatar, Badge, Box, Button, ButtonBase, Chip, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Tooltip, Typography,
} from '@mui/material';
import type { ViewId } from './Sidebar';
import { Icon, avatarIcon } from '../ui';

export const VIEW_META: Record<ViewId, { title: string; icon: string }> = {
  'view-today': { title: 'Today', icon: 'wb_sunny' },
  'view-meetings': { title: 'Meetings', icon: 'mic' },
  'view-notes': { title: 'Notes', icon: 'edit_note' },
  'view-calendar': { title: 'Calendar', icon: 'calendar_month' },
  'view-tasks': { title: 'Tasks', icon: 'task_alt' },
  'view-growth': { title: 'Habits & Goals', icon: 'local_fire_department' },
  'view-docs': { title: 'Documents', icon: 'description' },
  'view-rag': { title: 'Knowledge Search', icon: 'travel_explore' },
  'view-chat': { title: 'Ask Copilot', icon: 'forum' },
  'view-team': { title: 'Team', icon: 'groups' },
  'view-analytics': { title: 'Insights', icon: 'insights' },
  'view-integrations': { title: 'Integrations', icon: 'hub' },
  'view-billing': { title: 'Plan & Billing', icon: 'credit_card' },
  'view-security': { title: 'Security', icon: 'shield_lock' },
  'view-settings': { title: 'Settings', icon: 'tune' },
  'view-profile': { title: 'My Profile', icon: 'account_circle' },
  'view-superadmin': { title: 'Super Admin', icon: 'admin_panel_settings' }
};

interface HeaderProps {
  activeView: ViewId;
  themeMode: 'dark' | 'light';
  toggleThemeMode: () => void;
  isAuthenticated: boolean;
  isOffline: boolean;
  isPWAInstallable: boolean;
  isPushEnabled: boolean;
  onInstallPWA: () => void;
  onTogglePushNotifications: () => void;
  onOpenCommandPalette: () => void;
  onOpenCreateDialog: () => void;
  onOpenFocusModal?: () => void;
  onOpenScratchpad?: () => void;
  orgs?: Array<{ id: string; name: string; role?: string }>;
  activeOrgId?: string;
  onSelectOrg?: (orgId: string) => void;
  onToggleMobileMenu?: () => void;
  userName?: string;
  userAvatarUrl?: string;
  onOpenProfile?: () => void;
  /** Inbox bell + panel. When given it replaces the plain alerts toggle (the toggle lives inside the panel). */
  notificationCenter?: React.ReactNode;
}

const isImg = (u: string) => u.startsWith('http') || u.startsWith('data:image');

export const Header: React.FC<HeaderProps> = ({
  activeView,
  themeMode,
  toggleThemeMode,
  isAuthenticated,
  isOffline,
  isPWAInstallable,
  isPushEnabled,
  onInstallPWA,
  onTogglePushNotifications,
  onOpenCommandPalette,
  onOpenCreateDialog,
  onOpenFocusModal,
  onOpenScratchpad,
  orgs = [],
  activeOrgId = '',
  onSelectOrg,
  onToggleMobileMenu,
  userName = 'User',
  userAvatarUrl = '',
  onOpenProfile,
  notificationCenter
}) => {
  const [orgAnchor, setOrgAnchor] = React.useState<null | HTMLElement>(null);
  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const meta = VIEW_META[activeView];

  return (
    <Box
      component="header"
      className="app-header"
      sx={(t) => ({
        height: 'auto !important',
        minHeight: 68,
        px: { xs: 1.5, sm: 2.5, lg: 4 },
        py: 1.25,
        gap: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: t.palette.mode === 'dark' ? 'rgba(11,17,32,.82)' : 'rgba(246,248,250,.82)',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        zIndex: 5,
      })}
    >
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
        {onToggleMobileMenu && (
          <IconButton className="mobile-menu-btn" onClick={onToggleMobileMenu} aria-label="Open navigation menu" sx={{ border: 1, borderColor: 'divider' }}>
            <Icon name="menu" />
          </IconButton>
        )}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, display: { xs: 'flex', md: 'none' } }}>
          <Icon name={meta.icon} size={20} />
          <Typography noWrap sx={{ fontWeight: 800, fontSize: 16 }} id="header-view-title">{meta.title}</Typography>
        </Stack>
        <ButtonBase
          onClick={onOpenCommandPalette}
          aria-label="Search workspace"
          sx={(t) => ({
            display: { xs: 'none', md: 'flex' },
            flex: 1,
            maxWidth: 520,
            height: 44,
            px: 1.75,
            gap: 1.25,
            justifyContent: 'flex-start',
            borderRadius: '12px',
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            color: 'text.secondary',
            fontFamily: 'inherit',
            fontSize: 14,
            transition: 'border-color .15s, box-shadow .15s',
            '&:hover': { borderColor: t.palette.mode === 'dark' ? '#334155' : '#cbd5e1' },
          })}
        >
          <Icon name="search" />
          <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>Search notes, meetings, tasks…</Box>
          <Box component="kbd" sx={(t) => ({ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, px: 0.9, py: 0.3, borderRadius: '6px', bgcolor: t.palette.mode === 'dark' ? 'rgba(148,163,184,.14)' : '#f1f5f9', color: 'text.secondary' })}>Ctrl K</Box>
        </ButtonBase>
      </Stack>

      <Stack direction="row" alignItems="center" spacing={{ xs: 0.5, sm: 1 }} sx={{ flex: 'none' }}>
        {isOffline && <Chip size="small" icon={<Icon name="cloud_off" size={16} />} label="Offline" sx={{ bgcolor: '#fffbeb', color: '#92400e', display: { xs: 'none', sm: 'inline-flex' } }} />}
        {isPWAInstallable && (
          <Tooltip title="Install the app on this device">
            <IconButton onClick={onInstallPWA} aria-label="Install app" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}><Icon name="install_mobile" /></IconButton>
          </Tooltip>
        )}
        <IconButton onClick={onOpenCommandPalette} aria-label="Search" sx={{ display: { xs: 'inline-flex', md: 'none' } }}><Icon name="search" /></IconButton>

        {onSelectOrg && orgs.length > 0 && (
          <>
            <Button
              variant="outlined"
              size="small"
              onClick={(e) => setOrgAnchor(e.currentTarget)}
              endIcon={<Icon name="unfold_more" size={18} />}
              sx={{ display: { xs: 'none', lg: 'inline-flex' }, maxWidth: 200, justifyContent: 'space-between' }}
              aria-haspopup="menu"
            >
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeOrg ? activeOrg.name : 'Personal'}</Box>
            </Button>
            <Menu anchorEl={orgAnchor} open={!!orgAnchor} onClose={() => setOrgAnchor(null)} slotProps={{ paper: { sx: { minWidth: 240, mt: 1, borderRadius: '14px', border: 1, borderColor: 'divider' } } }}>
              <MenuItem selected={!activeOrgId} onClick={() => { onSelectOrg(''); setOrgAnchor(null); }}>
                <ListItemIcon><Icon name="person" size={19} /></ListItemIcon>
                <ListItemText primary="Personal workspace" />
              </MenuItem>
              {orgs.map((o) => (
                <MenuItem key={o.id} selected={o.id === activeOrgId} onClick={() => { onSelectOrg(o.id); setOrgAnchor(null); }}>
                  <ListItemIcon><Icon name="apartment" size={19} /></ListItemIcon>
                  <ListItemText primary={o.name} secondary={o.role} />
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

        {onOpenScratchpad && (
          <Tooltip title="Scratchpad">
            <IconButton onClick={onOpenScratchpad} aria-label="Open scratchpad" id="btn-header-scratchpad" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}><Icon name="sticky_note_2" /></IconButton>
          </Tooltip>
        )}
        {onOpenFocusModal && (
          <Tooltip title="Focus timer">
            <IconButton onClick={onOpenFocusModal} aria-label="Open focus timer" id="btn-header-deep-work" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}><Icon name="timer" /></IconButton>
          </Tooltip>
        )}
        {notificationCenter ?? (
          <Tooltip title={isPushEnabled ? 'Notifications on — click to turn off' : 'Turn on notifications'}>
            <IconButton onClick={onTogglePushNotifications} aria-label="Toggle notifications">
              <Badge variant="dot" color="secondary" invisible={!isPushEnabled}>
                <Icon name={isPushEnabled ? 'notifications_active' : 'notifications_off'} />
              </Badge>
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={themeMode === 'dark' ? 'Light mode' : 'Dark mode'}>
          <IconButton onClick={toggleThemeMode} aria-label="Toggle theme" id="btn-theme-toggle"><Icon name={themeMode === 'dark' ? 'light_mode' : 'dark_mode'} /></IconButton>
        </Tooltip>
        <Button variant="contained" color="primary" onClick={onOpenCreateDialog} id="btn-quick-new" sx={{ minWidth: { xs: 44, sm: 'auto' }, px: { xs: 1.25, sm: 2 } }} aria-label="Create">
          <Icon name="add" size={20} />
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.75 }}>Create</Box>
        </Button>
        {onOpenProfile && (
          <Tooltip title={`${userName} — profile`}>
            <IconButton onClick={onOpenProfile} id="btn-header-profile" aria-label="Open my profile" sx={{ p: 0.25, display: { xs: 'none', sm: 'inline-flex' } }}>
              <Avatar
                src={isImg(userAvatarUrl) ? userAvatarUrl : undefined}
                alt={userName}
                sx={{ width: 36, height: 36, fontSize: 14, fontWeight: 800, color: '#0f172a', background: 'linear-gradient(135deg,#67e8f9,#818cf8)' }}
              >
                {!isImg(userAvatarUrl) && (avatarIcon(userAvatarUrl) ? <Icon name={avatarIcon(userAvatarUrl)!} size={18} /> : (userAvatarUrl || (userName ? userName.charAt(0).toUpperCase() : 'U')))}
              </Avatar>
            </IconButton>
          </Tooltip>
        )}
        {!isAuthenticated && <span hidden id="cloud-sync-status">Local Mode</span>}
      </Stack>
    </Box>
  );
};
