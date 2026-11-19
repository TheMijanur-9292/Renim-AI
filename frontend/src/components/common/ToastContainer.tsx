import React from 'react';
import { Box, IconButton, Paper, Slide, Stack, Typography, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Icon } from '../ui';

export interface ToastItem {
  id: number | string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss?: (id: number | string) => void;
}

const TYPE_META: Record<ToastItem['type'], { icon: string; color: 'success' | 'info' | 'warning' | 'error' }> = {
  success: { icon: 'check_circle', color: 'success' },
  info: { icon: 'info', color: 'info' },
  warning: { icon: 'warning', color: 'warning' },
  error: { icon: 'error', color: 'error' },
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  const theme = useTheme();
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  if (toasts.length === 0) return null;

  return (
    <Box
      className="toast-container-fixed"
      role="region"
      aria-label="Notifications"
      sx={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        maxWidth: '380px',
        width: { sm: 380 },
        pointerEvents: 'none',
      }}
    >
      <Stack spacing={1} alignItems="flex-end">
        {toasts.map((t) => {
          const meta = TYPE_META[t.type] || TYPE_META.info;
          const main = theme.palette[meta.color].main;
          return (
            <Slide key={t.id} in direction="left" appear timeout={reduceMotion ? 0 : 260}>
              <Paper
                elevation={6}
                role={t.type === 'error' ? 'alert' : 'status'}
                sx={{
                  pointerEvents: 'auto',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  py: 1.25,
                  pl: 1.5,
                  pr: onDismiss ? 0.75 : 1.75,
                  borderRadius: '14px',
                  border: 1,
                  borderColor: alpha(main, 0.35),
                  boxShadow: theme.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,.5)' : '0 12px 30px rgba(15,23,42,.12)',
                }}
              >
                <Box sx={{ width: 30, height: 30, borderRadius: '9px', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(main, 0.12), color: main }}>
                  <Icon name={meta.icon} size={18} fill />
                </Box>
                <Typography variant="body2" sx={{ flex: 1, fontWeight: 500, color: 'text.primary', wordBreak: 'break-word' }}>
                  {t.message}
                </Typography>
                {onDismiss && (
                  <IconButton size="small" aria-label="Dismiss" onClick={() => onDismiss(t.id)} sx={{ color: 'text.secondary' }}>
                    <Icon name="close" size={16} />
                  </IconButton>
                )}
              </Paper>
            </Slide>
          );
        })}
      </Stack>
    </Box>
  );
};
