import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, Stack, TextField } from '@mui/material';
import { DialogHeader, useDialogProps } from './DialogParts';

interface PasteTranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const PasteTranscriptModal: React.FC<PasteTranscriptModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const { isPhone, ...dialogProps } = useDialogProps();

  return (
    <Dialog
      {...dialogProps}
      id="modal-paste-transcript"
      open={isOpen}
      // Stays mounted while hidden (as before) and only closes via the close button.
      keepMounted
      onClose={() => {}}
      maxWidth="sm"
      fullWidth
      aria-labelledby="modal-paste-transcript-title"
    >
      <form id="form-paste-transcript" onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', height: isPhone ? '100%' : undefined }}>
        <DialogHeader id="modal-paste-transcript-title" icon="content_paste" accent="violet" title="Paste transcript" subtitle="We'll turn it into a summary with action items." onClose={onClose} />
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: '8px !important', flex: isPhone ? 1 : undefined }}>
          <Stack spacing={2}>
            <TextField name="title" label="Meeting title" required fullWidth placeholder="e.g. Product review" />
            <TextField
              name="transcript"
              label="Transcript"
              required
              fullWidth
              multiline
              minRows={6}
              maxRows={14}
              placeholder="Paste the conversation here..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2.5 }, pt: 1, gap: 1 }}>
          <Button variant="outlined" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">Summarize</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default PasteTranscriptModal;
