import React from 'react';
import { Box, Button, Card, Chip, Grid2 as Grid, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { EmptyState, Icon, PageContainer, PageHeader, SectionCard, riseSx } from '../ui';
import { SPEECH_LANG_OPTIONS, getLangPrefs, setLangPrefs, type SpeechLang } from '../../services/workspace';

export interface MeetingsViewProps {
  isActive: boolean;
  waveformCanvasRef: React.RefObject<HTMLCanvasElement>;
  isMeetingRecording: boolean;
  startMeetingRecording: (source: 'mic' | 'tab') => void;
  setShowPasteModal: (show: boolean) => void;
  onUploadAudioClick: () => void;
  filteredMeetings: any[];
  activeMeetingId: string | null;
  setActiveMeetingId: (id: string | null) => void;
  activeMeeting: any | null;
  handleCopyMeetingMd: () => void;
  handleDeleteMeeting: () => void;
  liveTranscriptText: string;
}

const priorityColor = (p?: string): 'error' | 'warning' | 'default' => {
  const v = (p || 'medium').toLowerCase();
  return v === 'high' || v === 'urgent' ? 'error' : v === 'medium' ? 'warning' : 'default';
};

// ---- Speaker-labelled transcript rendering (presentation only) ----
// Matches "Speaker A: text", "[Name]: text", "[00:25 - Name]: text" and "Name: text" (short names only).
const SPEAKER_LINE = /^\s*(?:\[(?:\d{1,2}:\d{2}(?::\d{2})?\s*[-–]\s*)?([^\]]{1,40})\]|(Speaker\s+[A-Z0-9]{1,3}|[\p{L}][\p{L}\p{M} .'-]{0,30}))\s*:\s*(.+)$/u;
const SPEAKER_COLORS = ['#0891b2', '#7c3aed', '#d97706', '#059669', '#db2777', '#2563eb', '#dc2626', '#65a30d'];

type TranscriptRow = { speaker: string | null; text: string };

const parseSpeakerTranscript = (raw: string): TranscriptRow[] | null => {
  const lines = String(raw || '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return null;
  const rows: TranscriptRow[] = lines.map((line) => {
    const m = line.match(SPEAKER_LINE);
    if (!m) return { speaker: null, text: line.trim() };
    const name = (m[1] || m[2] || '').trim();
    // Guard against prose like "Note: ..." being treated as a speaker when brackets/"Speaker" are absent.
    if (!m[1] && !/^Speaker\s/i.test(name) && name.split(/\s+/).length > 3) return { speaker: null, text: line.trim() };
    return { speaker: name, text: m[3].trim() };
  });
  const tagged = rows.filter((r) => r.speaker).length;
  return tagged >= 2 && tagged >= rows.length / 2 ? rows : null;
};

const SpeakerTranscript: React.FC<{ raw: string }> = ({ raw }) => {
  const rows = React.useMemo(() => parseSpeakerTranscript(raw), [raw]);
  if (!rows) return <>{raw}</>;
  const colorOf = new Map<string, string>();
  rows.forEach((r) => {
    if (r.speaker && !colorOf.has(r.speaker)) colorOf.set(r.speaker, SPEAKER_COLORS[colorOf.size % SPEAKER_COLORS.length]);
  });
  return (
    <Stack spacing={1} sx={{ whiteSpace: 'normal' }}>
      {rows.map((r, i) => (
        <Stack key={i} direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 1.25 }} alignItems={{ xs: 'flex-start', sm: 'baseline' }}>
          {r.speaker ? (
            <Chip
              size="small"
              label={r.speaker}
              sx={{
                flexShrink: 0, height: 22, fontSize: 11.5, fontWeight: 600, maxWidth: 160,
                color: colorOf.get(r.speaker), bgcolor: 'transparent', border: 1, borderColor: colorOf.get(r.speaker),
              }}
            />
          ) : null}
          <Typography variant="body2" component="span" sx={{ fontSize: 13, lineHeight: 1.7, color: 'text.secondary', overflowWrap: 'anywhere' }}>
            {r.text}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
};

const RecorderLanguageSelect: React.FC<{ disabled?: boolean }> = ({ disabled }) => {
  const [lang, setLang] = React.useState<SpeechLang>(() => getLangPrefs().speechLang);
  React.useEffect(() => {
    const sync = () => setLang(getLangPrefs().speechLang);
    window.addEventListener('renim-lang-prefs', sync);
    return () => window.removeEventListener('renim-lang-prefs', sync);
  }, []);
  return (
    <TextField
      select
      size="small"
      label="Speech language"
      value={lang}
      disabled={disabled}
      onChange={(e) => setLang(setLangPrefs({ speechLang: e.target.value as SpeechLang }).speechLang)}
      fullWidth
      sx={{ mt: 1.5 }}
      helperText={disabled ? 'Applies to your next recording.' : undefined}
    >
      {SPEECH_LANG_OPTIONS.map((o) => (
        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
      ))}
    </TextField>
  );
};

export const MeetingsView: React.FC<MeetingsViewProps> = ({
  isActive,
  waveformCanvasRef,
  isMeetingRecording,
  startMeetingRecording,
  setShowPasteModal,
  onUploadAudioClick,
  filteredMeetings,
  activeMeetingId,
  setActiveMeetingId,
  activeMeeting,
  handleCopyMeetingMd,
  handleDeleteMeeting,
  liveTranscriptText,
}) => {
  return (
    <div id="view-meetings" className={`view-container ${isActive ? 'active' : ''}`}>
      <PageContainer>
        <PageHeader
          overline="Workspace"
          title="Meetings"
          description="Record, upload or paste a conversation and get a summary with action items."
        />

        <Grid container spacing={2.5}>
          {/* Left: recorder + list */}
          <Grid size={{ xs: 12, md: 5, lg: 4 }}>
            <Stack spacing={2.5}>
              <SectionCard index={1} icon="graphic_eq" accent="violet" title="Recorder" subtitle={isMeetingRecording ? 'Recording...' : 'Capture a new meeting'}>
                {/* Live audio waveform */}
                <Box
                  sx={{
                    borderRadius: 3, bgcolor: 'action.hover', p: 1, mb: 2, border: 1,
                    borderColor: isMeetingRecording ? 'error.main' : 'transparent',
                    transition: 'border-color .3s ease',
                  }}
                >
                  <canvas
                    ref={waveformCanvasRef}
                    id="audio-waveform"
                    className="canvas-waves"
                    width={300}
                    height={50}
                    style={{ width: '100%', height: 50, display: 'block' }}
                  ></canvas>
                </Box>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    color={isMeetingRecording ? 'error' : 'primary'}
                    id="btn-meeting-record-toggle"
                    onClick={() => startMeetingRecording('mic')}
                    startIcon={<Icon name={isMeetingRecording ? 'stop' : 'mic'} size={18} />}
                    sx={{ flex: 1, minHeight: 44, transition: 'background-color .25s ease' }}
                  >
                    <span id="btn-record-label">
                      {isMeetingRecording ? 'Stop and summarize' : 'Record'}
                    </span>
                  </Button>
                  <Tooltip title="Record a browser tab">
                    <IconButton id="btn-meeting-tab-record" aria-label="Record a browser tab" onClick={() => startMeetingRecording('tab')} sx={{ width: 44, height: 44, border: 1, borderColor: 'divider' }}>
                      <Icon name="tab" size={20} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Paste a transcript">
                    <IconButton id="btn-meeting-paste-transcript" aria-label="Paste a transcript" onClick={() => setShowPasteModal(true)} sx={{ width: 44, height: 44, border: 1, borderColor: 'divider' }}>
                      <Icon name="content_paste" size={20} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Upload audio (.mp3, .wav, .m4a)">
                    <IconButton aria-label="Upload audio file" onClick={onUploadAudioClick} sx={{ width: 44, height: 44, border: 1, borderColor: 'divider' }}>
                      <Icon name="upload" size={20} />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <RecorderLanguageSelect disabled={isMeetingRecording} />
              </SectionCard>

              <SectionCard index={2} icon="history" accent="slate" title="Past meetings" subtitle={`${filteredMeetings.length} saved`}>
                <Stack id="meetings-list-container" spacing={1} sx={{ maxHeight: { md: 460 }, overflowY: 'auto', mx: -0.5, px: 0.5 }}>
                  {filteredMeetings.length === 0 ? (
                    <EmptyState icon="mic_none" title="No meetings yet" description="Record or upload one to get started." />
                  ) : (
                    filteredMeetings.map(m => {
                      const selected = activeMeetingId === m.id;
                      return (
                        <Box
                          key={m.id}
                          component="button"
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setActiveMeetingId(m.id)}
                          sx={{
                            width: '100%', textAlign: 'left', font: 'inherit', color: 'text.primary', cursor: 'pointer',
                            p: 1.5, minHeight: 56, borderRadius: 3, border: 1,
                            borderColor: selected ? 'secondary.main' : 'divider',
                            bgcolor: selected ? 'action.selected' : 'background.paper',
                            transition: 'background-color .2s ease, border-color .2s ease, transform .2s ease',
                            '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-1px)' },
                            '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 1 },
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{m.title}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(m.created_at).toLocaleDateString()} · {m.action_items?.length || 0} action items
                          </Typography>
                        </Box>
                      );
                    })
                  )}
                </Stack>
              </SectionCard>
            </Stack>
          </Grid>

          {/* Right: details */}
          <Grid size={{ xs: 12, md: 7, lg: 8 }}>
            <Card id="meeting-detail-view" sx={{ p: { xs: 2, sm: 3 }, ...riseSx(3) }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'flex-start' }} sx={{ mb: 3 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h5" component="h2" id="meeting-view-title" sx={{ overflowWrap: 'anywhere' }}>
                    {activeMeeting ? activeMeeting.title : 'Select a meeting'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" id="meeting-view-date" sx={{ mt: 0.5 }}>
                    {activeMeeting
                      ? `Recorded on ${new Date(activeMeeting.created_at).toLocaleString()}`
                      : 'No meeting selected'}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" id="btn-copy-meeting-md" onClick={handleCopyMeetingMd} startIcon={<Icon name="content_copy" size={18} />} sx={{ minHeight: 44 }}>
                    Copy notes
                  </Button>
                  <Tooltip title="Delete meeting">
                    <IconButton id="btn-delete-meeting" aria-label="Delete meeting" onClick={handleDeleteMeeting} sx={{ width: 44, height: 44, border: 1, borderColor: 'divider' }}>
                      <Icon name="delete" size={20} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>

              <Stack spacing={2}>
                <Box sx={{ p: 2, borderRadius: 4, border: 1, borderColor: 'divider' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Icon name="notes" size={20} sx={{ color: 'secondary.main' }} />
                    <Typography variant="subtitle2" component="h3">Summary</Typography>
                  </Stack>
                  <Typography id="meeting-view-summary" component="div" className="briefing-content" variant="body2" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {activeMeeting
                      ? activeMeeting.summary || 'No summary available.'
                      : 'Pick a past meeting or record a new one to see its notes.'}
                  </Typography>
                </Box>

                <Box sx={{ p: 2, borderRadius: 4, border: 1, borderColor: 'divider' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Icon name="task_alt" size={20} sx={{ color: 'secondary.main' }} />
                    <Typography variant="subtitle2" component="h3">Action items and decisions</Typography>
                  </Stack>
                  <Box id="meeting-view-actions">
                    {activeMeeting && activeMeeting.action_items && activeMeeting.action_items.length > 0 ? (
                      <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
                        {activeMeeting.action_items.map((a: any, idx: number) => (
                          <Stack key={idx} direction="row" alignItems="center" spacing={1.25} sx={{ py: 1 }}>
                            <Icon name="check_circle" size={18} sx={{ color: 'success.main' }} />
                            <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{a.task}</Typography>
                            <Chip size="small" variant="outlined" color={priorityColor(a.priority)} label={a.priority || 'Medium'} />
                          </Stack>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">No action items recorded.</Typography>
                    )}
                  </Box>
                </Box>

                <Box sx={{ p: 2, borderRadius: 4, border: 1, borderColor: 'divider' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Icon name="chat" size={20} sx={{ color: 'secondary.main' }} />
                    <Typography variant="subtitle2" component="h3">Transcript</Typography>
                    {isMeetingRecording && <Chip size="small" color="error" label="Live" sx={{ height: 20, fontSize: 11 }} />}
                  </Stack>
                  <Box
                    id="meeting-view-transcript"
                    sx={{ maxHeight: 240, overflowY: 'auto', fontSize: 13, lineHeight: 1.7, color: 'text.secondary', whiteSpace: 'pre-wrap' }}
                  >
                    {isMeetingRecording
                      ? liveTranscriptText
                      : activeMeeting
                      ? (activeMeeting.raw_transcript ? <SpeakerTranscript raw={activeMeeting.raw_transcript} /> : 'No transcript saved.')
                      : 'The transcript will appear here.'}
                  </Box>
                </Box>
              </Stack>
            </Card>
          </Grid>
        </Grid>
      </PageContainer>
    </div>
  );
};
