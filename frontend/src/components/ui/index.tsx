/**
 * Renim AI — shared MUI building blocks for every workspace module.
 * Keep modules visually consistent: PageHeader → content grid of SectionCards.
 */
import React from 'react';
import { Box, Card, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { accentPalette, type Accent } from '../../theme/renimTheme';

export const rise = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
`;

/** Staggered entrance animation. Respects prefers-reduced-motion. */
export const riseSx = (i = 0): SxProps<Theme> => ({
  animation: `${rise} .55s cubic-bezier(.2,.7,.2,1) both`,
  animationDelay: `${Math.min(i, 10) * 60}ms`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
});

/** Material Symbols Rounded icon (already loaded by the app page). */
export const Icon: React.FC<{ name: string; size?: number; fill?: boolean; color?: string; sx?: SxProps<Theme> }> = ({
  name, size = 20, fill = false, color, sx,
}) => (
  <Box
    component="span"
    aria-hidden="true"
    className="material-symbols-rounded"
    sx={{
      fontSize: size, lineHeight: 1, color, flex: 'none', userSelect: 'none',
      fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'opsz' 24`,
      ...((sx as object) || {}),
    }}
  >
    {name}
  </Box>
);

/** Rounded tinted square holding an icon. */
export const IconTile: React.FC<{ icon: string; accent?: Accent; size?: number; fill?: boolean }> = ({
  icon, accent = 'cyan', size = 40, fill,
}) => {
  const c = accentPalette[accent];
  return (
    <Box sx={{ width: size, height: size, borderRadius: size >= 40 ? '12px' : '10px', bgcolor: c.bg, color: c.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <Icon name={icon} size={Math.round(size * 0.5)} fill={fill} />
    </Box>
  );
};

/** Module title row: overline + title + optional description and actions. */
export const PageHeader: React.FC<{
  title: React.ReactNode;
  overline?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, overline, description, actions }) => (
  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'flex-end' }} justifyContent="space-between" sx={{ mb: 3, ...riseSx(0) }}>
    <Box sx={{ minWidth: 0 }}>
      {overline && <Typography variant="overline" color="text.secondary">{overline}</Typography>}
      <Typography variant="h4" component="h1">{title}</Typography>
      {description && <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75, maxWidth: 720 }}>{description}</Typography>}
    </Box>
    {actions && <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ flex: 'none' }}>{actions}</Stack>}
  </Stack>
);

/** The standard content card. */
export const SectionCard: React.FC<{
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: string;
  accent?: Accent;
  action?: React.ReactNode;
  children?: React.ReactNode;
  index?: number;
  sx?: SxProps<Theme>;
  padding?: number;
}> = ({ title, subtitle, icon, accent = 'cyan', action, children, index = 1, sx, padding = 2.5 }) => (
  <Card sx={{ p: padding, ...riseSx(index), ...((sx as object) || {}) }}>
    {(title || action) && (
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: children ? 2 : 0 }}>
        {icon && <IconTile icon={icon} accent={accent} size={36} />}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {title && <Typography variant="h6" component="h2">{title}</Typography>}
          {subtitle && <Typography variant="caption" component="div">{subtitle}</Typography>}
        </Box>
        {action}
      </Stack>
    )}
    {children}
  </Card>
);

/** Compact KPI tile. */
export const StatCard: React.FC<{ icon: string; label: string; value: React.ReactNode; accent?: Accent; hint?: React.ReactNode; index?: number }> = ({
  icon, label, value, accent = 'cyan', hint, index = 1,
}) => (
  <Card sx={{ p: 2.25, display: 'flex', alignItems: 'center', gap: 1.75, ...riseSx(index) }}>
    <IconTile icon={icon} accent={accent} size={44} />
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{value}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
      {hint && <Typography variant="caption">{hint}</Typography>}
    </Box>
  </Card>
);

/** Friendly empty state. */
export const EmptyState: React.FC<{ icon: string; title: string; description?: React.ReactNode; action?: React.ReactNode }> = ({ icon, title, description, action }) => (
  <Stack alignItems="center" textAlign="center" spacing={1.25} sx={{ py: 5, px: 2 }}>
    <IconTile icon={icon} accent="slate" size={52} />
    <Typography variant="subtitle1">{title}</Typography>
    {description && <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>{description}</Typography>}
    {action}
  </Stack>
);

/** Responsive page container used by every module. */
export const PageContainer: React.FC<{ children: React.ReactNode; maxWidth?: number | string }> = ({ children, maxWidth = 'none' }) => (
  <Box sx={{ width: '100%', maxWidth, mx: 'auto', minHeight: '100%', boxSizing: 'border-box', px: { xs: 2, sm: 3, lg: 4.5 }, pt: { xs: 2, md: 3 }, pb: { xs: 12, md: 6 } }}>
    {children}
  </Box>
);


/** Legacy avatar presets are stored as emoji; render them as icons everywhere. */
export const AVATAR_ICON_MAP: Record<string, string> = {
  '\u{1F680}': 'rocket_launch', '\u{1F9E0}': 'psychology', '⚡': 'bolt',
  '\u{1F3AF}': 'target', '\u{1F6E1}️': 'shield', '\u{1F6E1}': 'shield', '\u{1F468}‍\u{1F4BB}': 'laptop_mac',
};
export const avatarIcon = (v?: string) => (v ? AVATAR_ICON_MAP[v] : undefined);
