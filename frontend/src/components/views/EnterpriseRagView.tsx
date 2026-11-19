import React, { useEffect, useState } from 'react';
import { Box, Button, Card, Chip, CircularProgress, InputAdornment, Stack, TextField, Tooltip, Typography } from '@mui/material';
import {
  fetchRagStatus, ragAskWorkspace, ragSearchWorkspace, rebuildRagIndex, type RagHit, type RagStatus,
} from '../../services/enterprise';
import { renderMarkdownToHtml } from '../../utils/markdown';
import { Icon, IconTile, PageContainer, PageHeader, SectionCard, riseSx } from '../ui';

interface EnterpriseRagViewProps {
  userEmail: string;
  showToast: (msg: string) => void;
}

const SOURCE_ICON: Record<string, string> = {
  note: 'sticky_note_2',
  notes: 'sticky_note_2',
  meeting: 'groups',
  meetings: 'groups',
  doc: 'description',
  document: 'description',
  documents: 'description',
  task: 'task_alt',
  tasks: 'task_alt',
};

export const EnterpriseRagView: React.FC<EnterpriseRagViewProps> = ({ userEmail, showToast }) => {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [hits, setHits] = useState<RagHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchRagStatus()
      .then((s) => { if (alive) setStatus(s); })
      .catch(() => { if (alive) setStatus(null); });
    return () => { alive = false; };
  }, [userEmail]);

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const res = await rebuildRagIndex();
      showToast(res.started ? 'Rebuilding the search index in the background' : res.reason || 'Smart search is turned off');
    } catch (e: any) {
      showToast(e.message || 'Could not start the rebuild');
    } finally {
      setRebuilding(false);
    }
  };

  const smartOn = !!status?.semantic_enabled;

  const handleAsk = async () => {
    if (!query.trim()) return showToast('Enter a question or search query');
    setLoading(true);
    try {
      const apiKey = typeof window !== 'undefined' ? localStorage.getItem('renim_ai_api_key') || undefined : undefined;
      const model = typeof window !== 'undefined' ? localStorage.getItem('renim_ai_model') || undefined : undefined;
      const baseUrl = typeof window !== 'undefined' ? localStorage.getItem('renim_ai_base_url') || undefined : undefined;
      const res = await ragAskWorkspace(query.trim(), userEmail, { api_key: apiKey, model, base_url: baseUrl });
      setAnswer(res.answer);
      setHits(res.citations);
    } catch (e: any) {
      showToast(e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchOnly = async () => {
    if (!query.trim()) return showToast('Enter a keyword to search');
    setLoading(true);
    try {
      const res = await ragSearchWorkspace(query.trim(), userEmail);
      setAnswer('');
      setHits(res.hits);
      if (res.hits.length === 0) showToast('No matches found in your workspace');
    } catch (e: any) {
      showToast(e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="workspace-view active" id="view-rag">
      <PageContainer>
        <PageHeader
          overline="Search"
          title="Knowledge Search"
          description="Search across your notes, meetings, documents and tasks, and get answers with sources you can check."
        />

        <Card sx={{ p: { xs: 2, sm: 2.5 }, mb: 3, ...riseSx(1) }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
            <TextField
              fullWidth
              label="What are you looking for?"
              placeholder="e.g. What did we agree on pricing last month?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon name="search" />
                  </InputAdornment>
                ),
              }}
            />
            <Stack direction="row" spacing={1} sx={{ flex: 'none' }}>
              <Button
                variant="contained"
                color="primary"
                disabled={loading}
                onClick={handleAsk}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Icon name="auto_awesome" size={18} />}
                sx={{ minHeight: 48, flex: { xs: 1, md: 'none' }, whiteSpace: 'nowrap' }}
              >
                {loading ? 'Searching...' : 'Ask AI'}
              </Button>
              <Button
                variant="outlined"
                disabled={loading}
                onClick={handleSearchOnly}
                startIcon={<Icon name="manage_search" size={18} />}
                sx={{ minHeight: 48, flex: { xs: 1, md: 'none' }, whiteSpace: 'nowrap' }}
              >
                Find matches
              </Button>
            </Stack>
          </Stack>
          {status && (
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
              <Tooltip
                title={smartOn
                  ? 'Results match by meaning as well as by keywords.'
                  : 'Results match by keywords. Smart search turns on when an embedding model is configured.'}
              >
                <Stack direction="row" alignItems="center" spacing={0.75} aria-live="polite">
                  <Box
                    sx={{
                      width: 8, height: 8, borderRadius: '50%',
                      bgcolor: smartOn ? 'secondary.main' : 'text.disabled',
                      boxShadow: smartOn ? '0 0 0 3px rgba(6, 182, 212, 0.18)' : 'none',
                      transition: 'background-color .3s ease, box-shadow .3s ease',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Smart search {smartOn ? 'on' : 'off'}
                    {smartOn && status.indexed_chunks > 0 ? ` · ${status.indexed_chunks} passages indexed` : ''}
                  </Typography>
                </Stack>
              </Tooltip>
              {smartOn && (
                <Button
                  variant="text"
                  size="small"
                  color="inherit"
                  disabled={rebuilding}
                  onClick={handleRebuild}
                  startIcon={rebuilding ? <CircularProgress size={12} color="inherit" /> : <Icon name="refresh" size={16} />}
                  sx={{ ml: 'auto', color: 'text.secondary', fontSize: 12.5, minHeight: 32 }}
                >
                  Rebuild index
                </Button>
              )}
            </Stack>
          )}
        </Card>

        {answer && (
          <SectionCard
            index={2}
            icon="auto_awesome"
            accent="cyan"
            title="Answer"
            subtitle="Written from your workspace, with numbered sources below"
            sx={{ mb: 3, borderLeft: '3px solid', borderLeftColor: 'secondary.main' }}
          >
            <Box
              className="markdown-body"
              sx={{ fontSize: 15, lineHeight: 1.7, overflowWrap: 'anywhere' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(answer) }}
            />
          </SectionCard>
        )}

        {hits.length > 0 && (
          <SectionCard index={3} icon="link" accent="slate" title={`Sources (${hits.length})`}>
            <Stack spacing={1.25}>
              {hits.map((h, i) => (
                <Box
                  key={`${h.source_type}-${h.source_id}`}
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    borderRadius: '14px',
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
                    '&:hover': { transform: 'translateY(-2px)', borderColor: 'secondary.main', boxShadow: 2 },
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
                    ...(riseSx(i + 3) as object),
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <IconTile icon={SOURCE_ICON[String(h.source_type).toLowerCase()] || 'article'} accent="cyan" size={36} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
                        <Chip size="small" label={`Source ${i + 1}`} color="secondary" variant="outlined" />
                        <Chip size="small" label={h.source_type} sx={{ textTransform: 'capitalize' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                          Match {h.score}
                        </Typography>
                      </Stack>
                      <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>{h.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
                        {h.snippet}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </SectionCard>
        )}
      </PageContainer>
    </section>
  );
};
