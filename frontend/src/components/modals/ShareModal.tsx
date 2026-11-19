import React from 'react';
import { Box, Button, Dialog, DialogContent, Stack, TextField, Typography } from '@mui/material';
import { sanitizeHtml } from '../../utils/sanitize';
import { Icon } from '../ui';
import { DialogHeader, useDialogProps } from './DialogParts';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeNoteId: string | null;
  noteTitle: string;
  noteContent: string;
  noteEditorHtml?: string;
  onCopyShareLink: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  activeNoteId,
  noteTitle,
  noteContent,
  noteEditorHtml,
  onCopyShareLink
}) => {
  const { isPhone: _isPhone, ...dialogProps } = useDialogProps();

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/share/note/${activeNoteId || 'note-preview'}`
    : `/share/note/${activeNoteId || 'note-preview'}`;

  return (
    <Dialog
      {...dialogProps}
      open={isOpen}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="share-modal-title"
    >
      <DialogHeader id="share-modal-title" icon="share" title="Share note" subtitle="Anyone with the link can view a read-only copy." onClose={onClose} />
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: '8px !important', pb: { xs: 2, sm: 3 } }}>
        <Stack direction="row" spacing={1} alignItems="stretch">
          <TextField
            fullWidth
            size="small"
            value={shareUrl}
            slotProps={{ htmlInput: { readOnly: true, 'aria-label': 'Share link' } }}
            onFocus={e => e.target.select()}
          />
          <Button variant="contained" onClick={onCopyShareLink} startIcon={<Icon name="content_copy" size={18} />} sx={{ flex: 'none' }}>
            Copy
          </Button>
        </Stack>

        <Typography variant="overline" color="text.secondary" component="div" sx={{ mt: 3, mb: 1 }}>
          Preview
        </Typography>
        <Box sx={{ p: 2.5, borderRadius: '14px', border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
          <Typography variant="h6" component="h3" sx={{ mb: 1 }}>{noteTitle || 'Untitled note'}</Typography>
          <Box
            sx={{ fontSize: 14, lineHeight: 1.65, color: 'text.primary', maxHeight: 240, overflowY: 'auto', '& img': { maxWidth: '100%' }, '& > :first-of-type': { mt: 0 } }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(noteEditorHtml || noteContent || '') || '<em>This note is empty.</em>' }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
};
