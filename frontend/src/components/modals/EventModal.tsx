import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, MenuItem, Stack, TextField } from '@mui/material';
import { DialogHeader, useDialogProps } from './DialogParts';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  calSelectedDateStr: string;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  calSelectedDateStr
}) => {
  const { isPhone, ...dialogProps } = useDialogProps();

  return (
    <Dialog
      {...dialogProps}
      id="modal-event"
      open={isOpen}
      // Original closed only via the close button (no backdrop/Escape close).
      onClose={() => {}}
      maxWidth="xs"
      fullWidth
      aria-labelledby="modal-event-title"
    >
      <form id="form-create-event" onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', height: isPhone ? '100%' : undefined }}>
        <DialogHeader id="modal-event-title" icon="event" accent="indigo" title="New event" subtitle="Add it to your calendar with a reminder." onClose={onClose} />
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: '8px !important' }}>
          <Stack spacing={2}>
            <TextField name="title" label="Title" required autoFocus fullWidth placeholder="e.g. Weekly planning" />
            <Stack direction="row" spacing={1.5}>
              <TextField name="event_date" label="Date" type="date" required fullWidth defaultValue={calSelectedDateStr} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField name="start_time" label="Time" type="time" required fullWidth defaultValue="10:00" slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
            <TextField name="category" label="Category" select fullWidth defaultValue="Work">
              <MenuItem value="Work">Work</MenuItem>
              <MenuItem value="Meeting">Meeting</MenuItem>
              <MenuItem value="Deadline">Deadline</MenuItem>
              <MenuItem value="Personal">Personal</MenuItem>
            </TextField>
            <TextField name="reminder_minutes" label="Reminder" select fullWidth defaultValue="15">
              <MenuItem value="5">5 minutes before</MenuItem>
              <MenuItem value="15">15 minutes before</MenuItem>
              <MenuItem value="30">30 minutes before</MenuItem>
              <MenuItem value="60">1 hour before</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2.5 }, pt: 1, gap: 1, mt: isPhone ? 'auto' : 0 }}>
          <Button variant="outlined" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">Create event</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
