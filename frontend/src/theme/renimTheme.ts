import { createTheme, alpha, type Theme } from '@mui/material/styles';

/**
 * Renim AI design tokens — shared by the marketing site and the workspace.
 * Plus Jakarta Sans, dark-navy ink, one cyan accent, soft radii, quiet borders.
 */
export const tokens = {
  ink: '#0f172a',
  cyan: '#0891b2',
  cyanText: '#0e7490',
  cyanSoft: '#ecfeff',
  indigo: '#4f46e5',
  indigoSoft: '#eef2ff',
  violet: '#7c3aed',
  violetSoft: '#f5f3ff',
  green: '#059669',
  greenSoft: '#ecfdf5',
  amber: '#b45309',
  amberSoft: '#fffbeb',
  red: '#b91c1c',
  redSoft: '#fef2f2',
  font: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
};

export const accentPalette = {
  cyan: { fg: tokens.cyanText, bg: tokens.cyanSoft },
  indigo: { fg: tokens.indigo, bg: tokens.indigoSoft },
  violet: { fg: tokens.violet, bg: tokens.violetSoft },
  green: { fg: tokens.green, bg: tokens.greenSoft },
  amber: { fg: tokens.amber, bg: tokens.amberSoft },
  red: { fg: tokens.red, bg: tokens.redSoft },
  slate: { fg: '#334155', bg: '#f1f5f9' },
} as const;
export type Accent = keyof typeof accentPalette;

export function makeRenimTheme(mode: 'light' | 'dark'): Theme {
  const dark = mode === 'dark';
  const bg = dark ? '#0b1120' : '#f6f8fa';
  const paper = dark ? '#111827' : '#ffffff';
  const line = dark ? 'rgba(148,163,184,.16)' : '#e6ebf0';
  const text = dark ? '#e2e8f0' : tokens.ink;
  const muted = dark ? '#94a3b8' : '#475569';
  const primary = dark ? '#e2e8f0' : '#374151';

  return createTheme({
    palette: {
      mode,
      primary: { main: primary, dark: dark ? '#cbd5e1' : '#1f2937', contrastText: dark ? '#0f172a' : '#ffffff' },
      secondary: { main: dark ? '#22d3ee' : tokens.cyan, contrastText: '#ffffff' },
      info: { main: tokens.cyan },
      success: { main: tokens.green },
      warning: { main: '#d97706' },
      error: { main: '#dc2626' },
      background: { default: bg, paper },
      text: { primary: text, secondary: muted },
      divider: line,
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: tokens.font,
      h1: { fontWeight: 800, letterSpacing: '-0.03em' },
      h2: { fontWeight: 800, letterSpacing: '-0.03em' },
      h3: { fontWeight: 800, letterSpacing: '-0.025em' },
      h4: { fontWeight: 800, letterSpacing: '-0.025em', fontSize: 'clamp(1.6rem, 2.6vw, 2.15rem)', lineHeight: 1.15 },
      h5: { fontWeight: 700, letterSpacing: '-0.02em', fontSize: '1.25rem' },
      h6: { fontWeight: 700, letterSpacing: '-0.01em', fontSize: '1rem' },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 700, fontSize: '0.875rem' },
      body1: { fontSize: '0.95rem', lineHeight: 1.6 },
      body2: { fontSize: '0.875rem', lineHeight: 1.55 },
      caption: { fontSize: '0.78rem', color: muted },
      overline: { fontWeight: 700, letterSpacing: '0.12em', fontSize: '0.7rem', lineHeight: 1.6 },
      button: { textTransform: 'none', fontWeight: 700, letterSpacing: 0 },
    },
    components: {
      MuiCssBaseline: { styleOverrides: { body: { fontFamily: tokens.font } } },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: line },
        },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: { root: { borderRadius: 20, borderColor: line, backgroundColor: paper } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 12, minHeight: 40, paddingInline: 16 },
          sizeSmall: { minHeight: 34, paddingInline: 12, borderRadius: 10 },
          sizeLarge: { minHeight: 48, paddingInline: 22 },
          outlined: { borderColor: line, color: text, '&:hover': { borderColor: dark ? '#334155' : '#cbd5e1', backgroundColor: dark ? 'rgba(148,163,184,.08)' : '#f8fafc' } },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { borderRadius: 12 } },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 600 },
          sizeSmall: { height: 24, fontSize: '0.72rem' },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: dark ? 'rgba(15,23,42,.6)' : '#ffffff',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: dark ? 'rgba(148,163,184,.24)' : '#d5dde5' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: tokens.cyan, borderWidth: 1 },
            '&.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(tokens.cyan, 0.15)}` },
          },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 40 },
          indicator: { height: 3, borderRadius: 3, backgroundColor: dark ? '#22d3ee' : tokens.cyan },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 700, minHeight: 40, paddingInline: 14, color: muted, '&.Mui-selected': { color: text } },
        },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 22, border: `1px solid ${line}` } },
      },
      MuiTooltip: {
        styleOverrides: { tooltip: { backgroundColor: '#374151', fontSize: '0.75rem', fontWeight: 600, borderRadius: 8, padding: '6px 10px' } },
      },
      MuiLinearProgress: {
        styleOverrides: { root: { borderRadius: 999, height: 6, backgroundColor: dark ? 'rgba(148,163,184,.15)' : '#f1f5f9' }, bar: { borderRadius: 999 } },
      },
      MuiListItemButton: {
        styleOverrides: { root: { borderRadius: 10 } },
      },
      MuiTableCell: {
        styleOverrides: { root: { borderColor: line }, head: { fontWeight: 700, color: muted, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' } },
      },
      MuiSwitch: {
        styleOverrides: { switchBase: { '&.Mui-checked + .MuiSwitch-track': { backgroundColor: tokens.cyan, opacity: 1 } } },
      },
    },
  });
}
