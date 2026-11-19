import React from 'react';
import { Box, Button, CircularProgress, Collapse, Dialog, DialogActions, DialogContent, Divider, MenuItem, Stack, TextField } from '@mui/material';
import { Icon } from '../ui';
import { DialogHeader, useDialogProps } from './DialogParts';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailRecipient: string;
  setEmailRecipient: (val: string) => void;
  emailTone: string;
  setEmailTone: (val: string) => void;
  emailObjective: string;
  setEmailObjective: (val: string) => void;
  emailSubject: string;
  setEmailSubject: (val: string) => void;
  emailBody: string;
  setEmailBody: (val: string) => void;
  isEmailGenerating: boolean;
  onGenerateEmail: () => void;
  onCopyDraft: () => void;
}

export const EmailModal: React.FC<EmailModalProps> = ({
  isOpen,
  onClose,
  emailRecipient,
  setEmailRecipient,
  emailTone,
  setEmailTone,
  emailObjective,
  setEmailObjective,
  emailSubject,
  setEmailSubject,
  emailBody,
  setEmailBody,
  isEmailGenerating,
  onGenerateEmail,
  onCopyDraft
}) => {
  const { isPhone: _isPhone, ...dialogProps } = useDialogProps();
  const px = { xs: 2, sm: 3 };

  return (
    <Dialog
      {...dialogProps}
      open={isOpen}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="email-modal-title"
    >
      <DialogHeader id="email-modal-title" icon="forward_to_inbox" title="Draft an email" subtitle="Describe what you need and get a ready-to-send draft." onClose={onClose} />
      <DialogContent sx={{ px, pt: '8px !important' }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Recipient"
              fullWidth
              placeholder="e.g. Alex, the team, a client"
              value={emailRecipient}
              onChange={e => setEmailRecipient(e.target.value)}
            />
            <TextField label="Tone" select fullWidth value={emailTone} onChange={e => setEmailTone(e.target.value)}>
              <MenuItem value="Professional">Professional</MenuItem>
              <MenuItem value="Friendly">Friendly</MenuItem>
              <MenuItem value="Pitch">Persuasive</MenuItem>
              <MenuItem value="Urgent">Urgent</MenuItem>
              <MenuItem value="Executive Brief">Brief summary</MenuItem>
            </TextField>
          </Stack>
          <TextField
            label="Goal"
            fullWidth
            placeholder="e.g. Ask for feedback on the proposal"
            value={emailObjective}
            onChange={e => setEmailObjective(e.target.value)}
          />
          <Box>
            <Button
              variant="contained"
              disabled={isEmailGenerating}
              onClick={onGenerateEmail}
              startIcon={isEmailGenerating ? <CircularProgress size={16} color="inherit" /> : <Icon name="auto_awesome" size={18} />}
            >
              {isEmailGenerating ? 'Writing draft...' : 'Generate draft'}
            </Button>
          </Box>

          <Collapse in={!!emailSubject} unmountOnExit>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Divider />
              <TextField label="Subject" fullWidth value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
              <TextField label="Message" fullWidth multiline minRows={7} maxRows={16} value={emailBody} onChange={e => setEmailBody(e.target.value)} />
            </Stack>
          </Collapse>
        </Stack>
      </DialogContent>
      {emailSubject && (
        <DialogActions sx={{ px, pb: { xs: 2, sm: 2.5 }, pt: 1, gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={onCopyDraft} startIcon={<Icon name="content_copy" size={18} />}>
            Copy
          </Button>
          <Button
            variant="contained"
            component="a"
            href={`mailto:${encodeURIComponent(emailRecipient.includes('@') ? emailRecipient : '')}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
            startIcon={<Icon name="send" size={18} />}
          >
            Open in email app
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};
