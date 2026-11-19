import React, { useEffect, useState } from 'react';
import { Box, Button, Drawer, IconButton, Stack, TextField, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Icon, IconTile } from '../ui';

interface ScratchpadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAsNote: (title: string, text: string) => Promise<void>;
  onSaveAsTask: (title: string) => Promise<void>;
  showToast: (msg: string) => void;
}

export const ScratchpadDrawer: React.FC<ScratchpadDrawerProps> = ({
  isOpen,
  onClose,
  onSaveAsNote,
  onSaveAsTask,
  showToast
}) => {
  const [text, setText] = useState('');
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setText(localStorage.getItem('renim_quick_scratchpad') || '');
    }
  }, []);

  const handleChange = (val: string) => {
    setText(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('renim_quick_scratchpad', val);
    }
  };

  return (
    <Drawer
      anchor={isPhone ? 'bottom' : 'right'}
      open={isOpen}
      // Backdrop click closes (as before); Escape did not.
      onClose={(_e, reason) => { if (reason === 'backdropClick') onClose(); }}
      transitionDuration={reduceMotion ? 0 : undefined}
      slotProps={{ backdrop: { sx: { backdropFilter: 'blur(2px)', backgroundColor: 'rgba(2,6,23,0.4)' } } }}
      PaperProps={{
        role: 'dialog',
        'aria-labelledby': 'scratchpad-title',
        sx: {
          width: isPhone ? '100%' : 380,
          maxWidth: isPhone ? '100%' : '92vw',
          height: isPhone ? '78vh' : '100%',
          borderRadius: isPhone ? '22px 22px 0 0' : '22px 0 0 22px',
          borderLeft: isPhone ? 0 : 1,
          borderTop: isPhone ? 1 : 0,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          p: { xs: 2, sm: 2.5 },
          pb: isPhone ? 'calc(16px + env(safe-area-inset-bottom, 0px))' : undefined,
        },
      }}
    >
      {isPhone && <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mt: -0.5, mb: 1.5 }} />}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
        <IconTile icon="sticky_note_2" accent="amber" size={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id="scratchpad-title" variant="h6" component="h2" sx={{ lineHeight: 1.25 }}>Scratchpad</Typography>
          <Typography variant="body2" color="text.secondary">Saved automatically on this device.</Typography>
        </Box>
        <IconButton aria-label="Close" size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <Icon name="close" size={20} />
        </IconButton>
      </Stack>

      <TextField
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Jot down ideas, links or reminders..."
        multiline
        fullWidth
        slotProps={{ htmlInput: { 'aria-label': 'Scratchpad text' } }}
        sx={{
          flex: 1, my: 1.5, minHeight: 0,
          '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start', lineHeight: 1.6 },
          '& textarea': { height: '100% !important', overflowY: 'auto !important' },
        }}
      />

      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          sx={{ flex: 1 }}
          startIcon={<Icon name="note_add" size={18} />}
          onClick={async () => {
            if (!text.trim()) return showToast('Scratchpad is empty');
            const firstLine = text.trim().split('\n')[0].slice(0, 50);
            await onSaveAsNote(firstLine || 'Scratchpad Note', text);
            showToast('Saved to notes');
          }}
        >
          Save as note
        </Button>
        <Button
          variant="outlined"
          sx={{ flex: 1 }}
          startIcon={<Icon name="add_task" size={18} />}
          onClick={async () => {
            if (!text.trim()) return showToast('Scratchpad is empty');
            const firstLine = text.trim().split('\n')[0].slice(0, 80);
            await onSaveAsTask(firstLine);
            showToast('Added to tasks');
          }}
        >
          Make task
        </Button>
        <IconButton
          aria-label="Clear scratchpad"
          title="Clear"
          onClick={() => {
            handleChange('');
            showToast('Scratchpad cleared');
          }}
          sx={{ border: 1, borderColor: 'divider', borderRadius: '10px' }}
        >
          <Icon name="delete_sweep" size={20} />
        </IconButton>
      </Stack>
    </Drawer>
  );
};
