/**
 * Shared building blocks for workspace dialogs: responsive sizing,
 * reduced-motion aware transitions, and a consistent header row.
 */
import React from 'react';
import { Box, Grow, IconButton, Stack, Typography, useMediaQuery, type DialogProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { TransitionProps } from '@mui/material/transitions';
import { Icon, IconTile } from '../ui';
import type { Accent } from '../../theme/renimTheme';

export const GrowTransition = React.forwardRef(function GrowTransition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Grow ref={ref} {...props} style={{ transformOrigin: 'center 30%' }} />;
});

/** Common Dialog props: fullScreen on phones, Grow animation, reduced-motion support. */
export function useDialogProps(): Pick<DialogProps, 'fullScreen' | 'TransitionComponent' | 'transitionDuration' | 'slotProps'> & { isPhone: boolean } {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  return {
    isPhone,
    fullScreen: isPhone,
    TransitionComponent: GrowTransition,
    transitionDuration: reduce ? 0 : { enter: 240, exit: 160 },
    slotProps: { backdrop: { sx: { backdropFilter: 'blur(3px)', backgroundColor: 'rgba(2,6,23,0.5)' } } },
  };
}

export const DialogHeader: React.FC<{
  id: string;
  icon: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  accent?: Accent;
  onClose: () => void;
}> = ({ id, icon, title, subtitle, accent = 'cyan', onClose }) => (
  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 1.5 }}>
    <IconTile icon={icon} accent={accent} size={40} />
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography id={id} variant="h6" component="h2" sx={{ lineHeight: 1.25 }}>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
    </Box>
    <IconButton aria-label="Close" onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
      <Icon name="close" size={20} />
    </IconButton>
  </Stack>
);
