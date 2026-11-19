import React from 'react';
import { Box, Button, CircularProgress, Dialog, DialogContent, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Icon } from '../ui';
import { DialogHeader, useDialogProps } from './DialogParts';

const MODE_SECONDS = { focus25: 25 * 60, deep50: 50 * 60, break5: 5 * 60 } as const;

export interface PomodoroModalProps {
  isOpen: boolean;
  onClose: () => void;
  pomodoroSeconds: number;
  setPomodoroSeconds: React.Dispatch<React.SetStateAction<number>>;
  isPomodoroRunning: boolean;
  setIsPomodoroRunning: React.Dispatch<React.SetStateAction<boolean>>;
  pomodoroMode: 'focus25' | 'deep50' | 'break5';
  onSetPomodoroMode: (mode: 'focus25' | 'deep50' | 'break5') => void;
  ambientSound: 'off' | 'rain' | 'space' | 'hum';
  onToggleAmbient: (sound: 'off' | 'rain' | 'space' | 'hum') => void;
  tasks: Array<{ id: string; title: string; status: string; priority?: string }>;
  focusTaskId: string | null;
  setFocusTaskId: (id: string | null) => void;
  onToggleTask: (id: string, currentStatus: string) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const PomodoroModal: React.FC<PomodoroModalProps> = ({
  isOpen,
  onClose,
  pomodoroSeconds,
  setPomodoroSeconds,
  isPomodoroRunning,
  setIsPomodoroRunning,
  pomodoroMode,
  onSetPomodoroMode,
  ambientSound,
  onToggleAmbient,
  tasks,
  focusTaskId,
  setFocusTaskId,
  onToggleTask,
  showToast,
}) => {
  const { isPhone: _isPhone, ...dialogProps } = useDialogProps();
  const total = MODE_SECONDS[pomodoroMode];
  const progress = Math.max(0, Math.min(100, (pomodoroSeconds / total) * 100));
  const ringColor = pomodoroMode === 'break5' ? 'success.main' : 'primary.main';

  return (
    <Dialog
      {...dialogProps}
      open={isOpen}
      // Backdrop click closes (as before); Escape did not.
      onClose={(_e, reason) => { if (reason === 'backdropClick') onClose(); }}
      maxWidth="xs"
      fullWidth
      aria-labelledby="pomodoro-modal-title"
    >
      <DialogHeader id="pomodoro-modal-title" icon="timer" title="Focus timer" onClose={onClose} />
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: '8px !important', pb: 3 }}>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={pomodoroMode}
          aria-label="Session length"
          sx={{ mb: 3, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600 } }}
        >
          <ToggleButton value="focus25" onClick={() => onSetPomodoroMode('focus25')}>25m focus</ToggleButton>
          <ToggleButton value="deep50" onClick={() => onSetPomodoroMode('deep50')}>50m deep work</ToggleButton>
          <ToggleButton value="break5" onClick={() => onSetPomodoroMode('break5')}>5m break</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ position: 'relative', width: 220, height: 220, mx: 'auto', mb: 3 }}>
          <CircularProgress variant="determinate" value={100} size={220} thickness={2.4} sx={{ position: 'absolute', inset: 0, color: 'divider' }} />
          <CircularProgress
            variant="determinate"
            value={progress}
            size={220}
            thickness={2.4}
            sx={{
              position: 'absolute', inset: 0, color: ringColor,
              '& .MuiCircularProgress-circle': { strokeLinecap: 'round', transition: 'stroke-dashoffset 1s linear' },
              '@media (prefers-reduced-motion: reduce)': { '& .MuiCircularProgress-circle': { transition: 'none' } },
            }}
          />
          <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0 }}>
            <Typography
              component="div"
              sx={{ fontSize: 52, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', m: 0, p: 0, color: 'text.primary' }}
            >
              {String(Math.floor(pomodoroSeconds / 60)).padStart(2, '0')}:{String(pomodoroSeconds % 60).padStart(2, '0')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, fontWeight: 600 }}>
              {isPomodoroRunning ? 'In progress' : 'Paused'}
            </Typography>
          </Stack>
        </Box>

        <TextField
          select
          fullWidth
          size="small"
          label="Focus on"
          value={focusTaskId || ''}
          onChange={e => setFocusTaskId(e.target.value || null)}
          sx={{ mb: 2.5 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">No specific task</MenuItem>
          {tasks.filter(t => t.status !== 'done').map(t => (
            <MenuItem key={t.id} value={t.id}>
              {t.title} ({t.priority || 'Medium'})
            </MenuItem>
          ))}
        </TextField>

        <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => setIsPomodoroRunning(!isPomodoroRunning)}
            startIcon={<Icon name={isPomodoroRunning ? 'pause' : 'play_arrow'} size={20} fill />}
            sx={{ px: 3 }}
          >
            {isPomodoroRunning ? 'Pause' : 'Start'}
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => {
              setIsPomodoroRunning(false);
              const resetSec = pomodoroMode === 'focus25' ? 25 * 60 : pomodoroMode === 'deep50' ? 50 * 60 : 5 * 60;
              setPomodoroSeconds(resetSec);
            }}
            startIcon={<Icon name="restart_alt" size={20} />}
          >
            Reset
          </Button>
          {focusTaskId && (
            <Button
              variant="outlined"
              color="success"
              size="large"
              title="Mark the focus task as done"
              onClick={() => {
                onToggleTask(focusTaskId, 'todo');
                setFocusTaskId(null);
                showToast('Task marked as done', 'success');
              }}
              startIcon={<Icon name="task_alt" size={20} />}
            >
              Mark done
            </Button>
          )}
        </Stack>

        <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
          <Typography variant="overline" color="text.secondary" component="div" sx={{ mb: 1 }}>
            Background sound
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={ambientSound}
            aria-label="Background sound"
            sx={{ flexWrap: { xs: 'wrap', sm: 'nowrap' }, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, gap: 0.75, flex: { xs: '1 1 45%', sm: 1 } } }}
          >
            <ToggleButton value="off" onClick={() => onToggleAmbient('off')}><Icon name="volume_off" size={16} />Off</ToggleButton>
            <ToggleButton value="rain" onClick={() => onToggleAmbient('rain')}><Icon name="water_drop" size={16} />Rain</ToggleButton>
            <ToggleButton value="space" onClick={() => onToggleAmbient('space')}><Icon name="nights_stay" size={16} />Space</ToggleButton>
            <ToggleButton value="hum" onClick={() => onToggleAmbient('hum')}><Icon name="graphic_eq" size={16} />Hum</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
