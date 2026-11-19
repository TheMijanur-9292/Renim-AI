import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Grow, IconButton, InputBase, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Icon, IconTile } from '../ui';

interface FocusTimerWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionComplete?: (minutes: number) => void;
}

type SoundMode = 'none' | 'rain' | 'brown' | 'drone';

export const FocusTimerWidget: React.FC<FocusTimerWidgetProps> = ({
  isOpen,
  onClose,
  onSessionComplete,
}) => {
  const [presetMinutes, setPresetMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [soundMode, setSoundMode] = useState<SoundMode>('none');
  const [focusLabel, setFocusLabel] = useState('Deep work');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundNodeRef = useRef<AudioNode | null>(null);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          onSessionComplete?.(presetMinutes);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, presetMinutes, onSessionComplete]);

  // WebAudio synthesized ambient sound (zero external audio files needed)
  useEffect(() => {
    const stopAudio = () => {
      try {
        if (soundNodeRef.current && 'stop' in soundNodeRef.current) {
          (soundNodeRef.current as AudioScheduledSourceNode).stop();
        }
        soundNodeRef.current?.disconnect();
      } catch {}
      soundNodeRef.current = null;
    };

    stopAudio();
    if (soundMode === 'none') return;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContextClass();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    gain.connect(ctx.destination);

    if (soundMode === 'drone') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 174;
      osc.connect(gain);
      osc.start();
      soundNodeRef.current = osc;
    } else {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (soundMode === 'brown') {
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
          data[i] *= 2.5;
        } else {
          data[i] = white * 0.35;
        }
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = soundMode === 'rain' ? 1200 : 420;

      noise.connect(filter);
      filter.connect(gain);
      noise.start();
      soundNodeRef.current = noise;
    }

    return stopAudio;
  }, [soundMode]);

  const theme = useTheme();
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  const selectPreset = (m: number) => {
    setRunning(false);
    setPresetMinutes(m);
    setSecondsLeft(m * 60);
  };

  const toggleSx = { textTransform: 'none', fontWeight: 600, fontSize: 12, py: 0.5 } as const;

  return (
    <Grow in={isOpen} unmountOnExit timeout={reduceMotion ? 0 : 220} style={{ transformOrigin: 'bottom left' }}>
      <Paper
        elevation={8}
        role="dialog"
        aria-labelledby="focus-timer-title"
        sx={{
          position: 'fixed',
          zIndex: 8500,
          bottom: { xs: 'calc(84px + env(safe-area-inset-bottom, 0px))', md: 22 },
          left: { xs: 12, md: 260 },
          right: { xs: 12, sm: 'auto' },
          width: { sm: 340 },
          p: 2,
          borderRadius: '18px',
          border: 1,
          borderColor: 'divider',
          boxShadow: theme.palette.mode === 'dark' ? '0 20px 50px rgba(0,0,0,.55)' : '0 20px 50px rgba(15,23,42,.14)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.5 }}>
          <IconTile icon="timer" size={32} />
          <Typography id="focus-timer-title" variant="subtitle2" sx={{ flex: 1, fontWeight: 700 }}>Focus timer</Typography>
          <IconButton size="small" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={18} />
          </IconButton>
        </Stack>

        <InputBase
          fullWidth
          value={focusLabel}
          onChange={(e) => setFocusLabel(e.target.value)}
          placeholder="What are you focusing on?"
          inputProps={{ 'aria-label': 'Focus label' }}
          sx={{ mb: 1.5, px: 1.5, py: 0.5, fontSize: 13.5, borderRadius: '10px', border: 1, borderColor: 'divider', bgcolor: 'background.default' }}
        />

        <Box sx={{ textAlign: 'center', py: 2, mb: 1.5, borderRadius: '14px', border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
          <Typography
            component="div"
            aria-live="off"
            sx={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', color: running ? 'primary.main' : 'text.primary', transition: 'color .2s ease' }}
          >
            {mins}:{secs}
          </Typography>
          <Stack direction="row" spacing={0.75} justifyContent="center" sx={{ mt: 1.25 }}>
            {[15, 25, 45, 5].map((m) => (
              <Button
                key={m}
                size="small"
                variant={presetMinutes === m ? 'contained' : 'outlined'}
                disableElevation
                onClick={() => selectPreset(m)}
                sx={{ minWidth: 0, px: 1.25, py: 0.25, fontSize: 12 }}
              >
                {m === 5 ? '5m break' : `${m}m`}
              </Button>
            ))}
          </Stack>
        </Box>

        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <Button
            fullWidth
            variant="contained"
            onClick={() => setRunning((r) => !r)}
            startIcon={<Icon name={running ? 'pause' : 'play_arrow'} size={20} fill />}
          >
            {running ? 'Pause' : 'Start'}
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setRunning(false);
              setSecondsLeft(presetMinutes * 60);
            }}
          >
            Reset
          </Button>
        </Stack>

        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.75, fontWeight: 600 }}>
          Background sound
        </Typography>
        <ToggleButtonGroup exclusive fullWidth size="small" value={soundMode} aria-label="Background sound">
          {(
            [
              { id: 'none', label: 'Off' },
              { id: 'rain', label: 'Rain' },
              { id: 'brown', label: 'Deep' },
              { id: 'drone', label: 'Hum' },
            ] as Array<{ id: SoundMode; label: string }>
          ).map((s) => (
            <ToggleButton key={s.id} value={s.id} onClick={() => setSoundMode(s.id)} sx={toggleSx}>
              {s.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Paper>
    </Grow>
  );
};
