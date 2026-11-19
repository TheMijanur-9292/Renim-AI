import React from 'react';
import {
  Badge, Box, Button, Divider, Drawer, IconButton, List, ListItemButton, Popover, Stack, Switch, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Icon, IconTile } from '../ui';
import type { Accent } from '../../theme/renimTheme';
import type { InboxItem, InboxKind } from './useNotificationInbox';

const KIND_META: Record<InboxKind, { icon: string; accent: Accent }> = {
  success: { icon: 'check_circle', accent: 'green' },
  info: { icon: 'info', accent: 'cyan' },
  warning: { icon: 'warning', accent: 'amber' },
  error: { icon: 'error', accent: 'red' },
  reminder: { icon: 'event', accent: 'indigo' },
  ai: { icon: 'auto_awesome', accent: 'violet' },
};

export const timeAgo = (at: number, now = Date.now()) => {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'Just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? 'Yesterday' : `${d} days ago`;
  return new Date(at).toLocaleDateString();
};

interface NotificationCenterProps {
  items: InboxItem[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onClearAll: () => void;
  isPushEnabled: boolean;
  onTogglePush: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  items, unreadCount, onMarkAllRead, onMarkRead, onClearAll, isPushEnabled, onTogglePush,
}) => {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const open = Boolean(anchor);
  const close = () => setAnchor(null);
  const now = Date.now();

  const panel = (
    <Box sx={{ width: isPhone ? '100%' : 380, maxWidth: '100%', display: 'flex', flexDirection: 'column', maxHeight: isPhone ? '80vh' : 520 }}>
      {isPhone && <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mt: 1.25 }} />}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.25, pt: 2, pb: 1.25 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Notifications</Typography>
        <Stack direction="row" spacing={0.5}>
          <Button size="small" onClick={onMarkAllRead} disabled={unreadCount === 0}>Mark all as read</Button>
          {isPhone && <IconButton size="small" onClick={close} aria-label="Close notifications"><Icon name="close" size={18} /></IconButton>}
        </Stack>
      </Stack>
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <Stack alignItems="center" spacing={1.25} sx={{ py: 6, px: 3, textAlign: 'center' }}>
            <IconTile icon="notifications" accent="slate" size={48} />
            <Typography variant="subtitle2">You're all caught up</Typography>
            <Typography variant="body2" color="text.secondary">Updates, reminders and finished work will show up here.</Typography>
          </Stack>
        ) : (
          <List disablePadding>
            {items.map((item) => {
              const meta = KIND_META[item.kind] || KIND_META.info;
              return (
                <ListItemButton
                  key={item.id}
                  onClick={() => onMarkRead(item.id)}
                  sx={{ alignItems: 'flex-start', gap: 1.5, px: 2.25, py: 1.25, bgcolor: item.read ? 'transparent' : 'action.hover' }}
                >
                  <IconTile icon={meta.icon} accent={meta.accent} size={34} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: item.read ? 500 : 700, wordBreak: 'break-word' }}>{item.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{timeAgo(item.at, now)}</Typography>
                  </Box>
                  {!item.read && <Box aria-label="Unread" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'secondary.main', mt: 0.9, flex: 'none' }} />}
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Box>
      <Divider />
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.25, py: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Icon name={isPushEnabled ? 'notifications_active' : 'notifications_off'} size={18} />
          <Typography variant="body2">Device alerts</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {items.length > 0 && <Button size="small" color="inherit" onClick={onClearAll}>Clear</Button>}
          <Switch checked={isPushEnabled} onChange={onTogglePush} inputProps={{ 'aria-label': 'Device alerts' }} />
        </Stack>
      </Stack>
    </Box>
  );

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} id="btn-header-inbox">
          <Badge badgeContent={unreadCount} color="secondary" max={99}>
            <Icon name="notifications" />
          </Badge>
        </IconButton>
      </Tooltip>
      {isPhone ? (
        <Drawer anchor="bottom" open={open} onClose={close} PaperProps={{ sx: { borderTopLeftRadius: 20, borderTopRightRadius: 20 } }}>
          {panel}
        </Drawer>
      ) : (
        <Popover
          open={open}
          anchorEl={anchor}
          onClose={close}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { mt: 1, borderRadius: '20px', border: 1, borderColor: 'divider', overflow: 'hidden' } } }}
        >
          {panel}
        </Popover>
      )}
    </>
  );
};
