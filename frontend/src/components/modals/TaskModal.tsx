import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, MenuItem, Stack, TextField } from '@mui/material';
import { DialogHeader, useDialogProps } from './DialogParts';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const { isPhone, ...dialogProps } = useDialogProps();

  return (
    <Dialog
      {...dialogProps}
      id="modal-task"
      open={isOpen}
      // Original closed only via the close button (no backdrop/Escape close).
      onClose={() => {}}
      maxWidth="xs"
      fullWidth
      aria-labelledby="modal-task-title"
    >
      <form id="form-create-task" onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', height: isPhone ? '100%' : undefined }}>
        <DialogHeader id="modal-task-title" icon="add_task" title="New task" onClose={onClose} />
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: '8px !important' }}>
          <Stack spacing={2}>
            <TextField name="title" label="Title" required autoFocus fullWidth placeholder="e.g. Review the proposal" />
            <TextField name="priority" label="Priority" select fullWidth defaultValue="Medium">
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
            </TextField>
            <TextField name="due_date" label="Due date (optional)" type="date" fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2.5 }, pt: 1, gap: 1, mt: isPhone ? 'auto' : 0 }}>
          <Button variant="outlined" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">Add task</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
