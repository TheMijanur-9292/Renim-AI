import React from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, MobileStepper, Stack, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Icon, IconTile, riseSx } from '../ui';
import type { Accent } from '../../theme/renimTheme';

export const USE_CASES: { id: string; label: string; icon: string }[] = [
  { id: 'meetings', label: 'Meetings & calls', icon: 'call' },
  { id: 'studying', label: 'Studying & lectures', icon: 'school' },
  { id: 'sales', label: 'Sales & clients', icon: 'handshake' },
  { id: 'team', label: 'Team projects', icon: 'groups' },
  { id: 'personal', label: 'Personal planning', icon: 'event_note' },
];

const welcomeKey = (email: string) => `renim_welcome_done_${(email || 'guest').toLowerCase()}`;
const useCasesKey = (email: string) => `renim_use_cases_${(email || 'guest').toLowerCase()}`;

export const hasSeenWelcome = (email: string) => {
  try {
    return localStorage.getItem(welcomeKey(email)) === '1';
  } catch {
    return true; // if storage is unavailable, never nag
  }
};

export const loadUseCases = (email: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(useCasesKey(email)) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

interface WelcomeDialogProps {
  open: boolean;
  userEmail: string;
  userName?: string;
  onClose: () => void;
  onUseCasesChange?: (ids: string[]) => void;
  onWriteNote: () => void;
  onRecordMeeting: () => void;
  onAddTask: () => void;
  isPushEnabled: boolean;
  onEnableNotifications: () => void;
  onConnectCalendar: () => void;
}

const ActionButton: React.FC<{ icon: string; accent: Accent; title: string; hint: string; onClick: () => void; index: number; done?: boolean }> = ({
  icon, accent, title, hint, onClick, index, done,
}) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    sx={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, p: 1.75, textAlign: 'left', font: 'inherit', color: 'inherit',
      bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: '16px', cursor: 'pointer',
      transition: 'border-color .15s, transform .15s',
      '&:hover': { borderColor: 'secondary.main', transform: 'translateY(-1px)' },
      '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 2 },
      '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
      ...(riseSx(index) as object),
    }}
  >
    <IconTile icon={icon} accent={accent} />
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography variant="subtitle2">{title}</Typography>
      <Typography variant="caption" color="text.secondary">{hint}</Typography>
    </Box>
    <Icon name={done ? 'check_circle' : 'arrow_forward'} size={18} sx={{ opacity: done ? 1 : 0.5, color: done ? 'success.main' : undefined }} />
  </Box>
);

export const WelcomeDialog: React.FC<WelcomeDialogProps> = ({
  open, userEmail, userName, onClose, onUseCasesChange, onWriteNote, onRecordMeeting, onAddTask, isPushEnabled, onEnableNotifications, onConnectCalendar,
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [step, setStep] = React.useState(0);
  const [picked, setPicked] = React.useState<string[]>(() => loadUseCases(userEmail));

  const finish = () => {
    try {
      localStorage.setItem(welcomeKey(userEmail), '1');
    } catch {}
    onClose();
  };

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(useCasesKey(userEmail), JSON.stringify(next));
      } catch {}
      onUseCasesChange?.(next);
      return next;
    });
  };

  // Opening another flow ends the welcome so it never stacks on top of that flow.
  const runAndFinish = (fn: () => void) => () => {
    finish();
    fn();
  };

  const firstName = (userName || '').split(' ')[0];

  return (
    <Dialog
      open={open}
      onClose={finish}
      fullScreen={fullScreen}
      maxWidth="sm"
      fullWidth
      aria-labelledby="welcome-title"
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : '20px' } }}
    >
      <Stack direction="row" justifyContent="flex-end" sx={{ px: 1.5, pt: 1.5 }}>
        <Button size="small" color="inherit" onClick={finish}>Skip</Button>
      </Stack>
      <DialogContent sx={{ pt: 0, px: { xs: 2.5, sm: 4 } }}>
        {step === 0 && (
          <Box key="s0">
            <Box sx={riseSx(0)}><IconTile icon="waving_hand" accent="cyan" size={48} /></Box>
            <Typography id="welcome-title" variant="h5" sx={{ fontWeight: 800, mt: 2, ...(riseSx(1) as object) }}>
              {firstName ? `Welcome, ${firstName}` : 'Welcome to Renim'}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75, mb: 2.5, ...(riseSx(2) as object) }}>
              What do you mostly use Renim for? Pick any that fit.
            </Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={riseSx(3)}>
              {USE_CASES.map((u) => {
                const on = picked.includes(u.id);
                return (
                  <Chip
                    key={u.id}
                    icon={<Icon name={on ? 'check' : u.icon} size={18} />}
                    label={u.label}
                    onClick={() => toggle(u.id)}
                    color={on ? 'secondary' : 'default'}
                    variant={on ? 'filled' : 'outlined'}
                    aria-pressed={on}
                    sx={{ height: 40, px: 0.5, borderRadius: '12px', fontWeight: 600 }}
                  />
                );
              })}
            </Stack>
          </Box>
        )}
        {step === 1 && (
          <Box key="s1">
            <Typography id="welcome-title" variant="h5" sx={{ fontWeight: 800, ...(riseSx(0) as object) }}>Capture your first thing</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75, mb: 2.5, ...(riseSx(1) as object) }}>Start with whatever is on your mind.</Typography>
            <Stack spacing={1.25}>
              <ActionButton index={2} icon="edit_note" accent="cyan" title="Write a note" hint="Jot down ideas or plans" onClick={runAndFinish(onWriteNote)} />
              <ActionButton index={3} icon="mic" accent="violet" title="Record a meeting" hint="Get a summary when you're done" onClick={runAndFinish(onRecordMeeting)} />
              <ActionButton index={4} icon="task_alt" accent="green" title="Add a task" hint="Keep track of what's next" onClick={runAndFinish(onAddTask)} />
            </Stack>
          </Box>
        )}
        {step === 2 && (
          <Box key="s2">
            <Typography id="welcome-title" variant="h5" sx={{ fontWeight: 800, ...(riseSx(0) as object) }}>Stay on top of your day</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75, mb: 2.5, ...(riseSx(1) as object) }}>Get a heads-up before things start.</Typography>
            <Stack spacing={1.25}>
              <ActionButton
                index={2}
                icon={isPushEnabled ? 'notifications_active' : 'notifications'}
                accent="amber"
                title={isPushEnabled ? 'Alerts are on' : 'Turn on alerts'}
                hint="Reminders on this device"
                done={isPushEnabled}
                onClick={() => { if (!isPushEnabled) onEnableNotifications(); }}
              />
              <ActionButton index={3} icon="calendar_month" accent="indigo" title="Connect calendar" hint="Bring in your events" onClick={runAndFinish(onConnectCalendar)} />
            </Stack>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2.5, pt: 1, flexDirection: 'column', alignItems: 'stretch', gap: 1 }}>
        <MobileStepper
          variant="dots"
          steps={3}
          position="static"
          activeStep={step}
          sx={{ bgcolor: 'transparent', p: 0 }}
          backButton={
            <Button size="small" color="inherit" onClick={() => setStep((s) => s - 1)} disabled={step === 0} startIcon={<Icon name="arrow_back" size={18} />}>
              Back
            </Button>
          }
          nextButton={
            step < 2 ? (
              <Button variant="contained" color="primary" size="small" onClick={() => setStep((s) => s + 1)} endIcon={<Icon name="arrow_forward" size={18} />}>
                Next
              </Button>
            ) : (
              <Button variant="contained" color="primary" size="small" onClick={finish}>Done</Button>
            )
          }
        />
      </DialogActions>
    </Dialog>
  );
};
