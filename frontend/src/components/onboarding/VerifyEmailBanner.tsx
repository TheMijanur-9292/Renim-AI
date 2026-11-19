import React from 'react';
import { Box, Button, Collapse, IconButton, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Icon } from '../ui';

interface VerifyEmailBannerProps {
  accessToken: string | null;
  userEmail: string;
  /** Value cached at sign-in; refreshed from the server on mount. */
  initialVerified?: boolean;
  onNotify?: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
}

const dismissKey = (email: string) => `renim_verify_banner_dismissed_${(email || 'guest').toLowerCase()}`;

/** Calm reminder to confirm the account email. Never blocks anything; can be dismissed for this session. */
export const VerifyEmailBanner: React.FC<VerifyEmailBannerProps> = ({ accessToken, userEmail, initialVerified, onNotify }) => {
  const [verified, setVerified] = React.useState<boolean>(initialVerified !== false);
  const [dismissed, setDismissed] = React.useState<boolean>(() => {
    try {
      return sessionStorage.getItem(dismissKey(userEmail)) === '1';
    } catch {
      return false;
    }
  });
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.user && typeof data.user.email_verified === 'boolean') setVerified(data.user.email_verified);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken, userEmail]);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(dismissKey(userEmail), '1');
    } catch {}
  };

  const resend = async () => {
    if (!accessToken || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send the email. Try again later.');
      if (data.already_verified) {
        setVerified(true);
        onNotify?.('Your email is already confirmed.', 'success');
      } else {
        onNotify?.(`We sent a new link to ${userEmail}.`, 'success');
        if (data.verify_link) console.info('Dev confirm link:', data.verify_link);
      }
    } catch (e: any) {
      onNotify?.(e.message || 'Could not send the email.', 'warning');
    } finally {
      setSending(false);
    }
  };

  const show = Boolean(accessToken) && !verified && !dismissed;

  return (
    <Collapse in={show} unmountOnExit timeout={{ enter: 300, exit: 200 }}>
      <Box sx={{ px: { xs: 1.5, sm: 2.5, lg: 4 }, pt: 1.5 }}>
        <Stack
          role="status"
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={1.25}
          sx={(t) => ({
            px: 2,
            py: 1.25,
            borderRadius: '16px',
            border: 1,
            borderColor: alpha(t.palette.secondary.main, 0.3),
            bgcolor: alpha(t.palette.secondary.main, t.palette.mode === 'dark' ? 0.1 : 0.06),
          })}
        >
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
            <Icon name="mark_email_unread" size={20} sx={{ color: 'secondary.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Confirm your email to keep your account secure.</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5} justifyContent="flex-end">
            <Button size="small" variant="contained" color="primary" onClick={resend} disabled={sending}>
              {sending ? 'Sending…' : 'Resend email'}
            </Button>
            <IconButton size="small" onClick={dismiss} aria-label="Dismiss"><Icon name="close" size={18} /></IconButton>
          </Stack>
        </Stack>
      </Box>
    </Collapse>
  );
};
