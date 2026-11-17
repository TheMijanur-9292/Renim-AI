import React, { useState } from 'react';
import { ragAskWorkspace, ragSearchWorkspace, type RagHit } from '../../services/enterprise';
import { renderMarkdownToHtml } from '../../utils/markdown';

interface EnterpriseRagViewProps {
  userEmail: string;
  showToast: (msg: string) => void;
}

export const EnterpriseRagView: React.FC<EnterpriseRagViewProps> = ({ userEmail, showToast }) => {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [hits, setHits] = useState<RagHit[]>([]);
  const [loading, setLoading] = useState(false);

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
      showToast(e.message || 'RAG search failed');
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
      if (res.hits.length === 0) showToast('No matching records found across workspace');
    } catch (e: any) {
      showToast(e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="workspace-view active" id="view-rag">
      <div className="mui-card" style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
          Enterprise Cross-Workspace RAG Search
        </h2>
        <p className="muted-sm" style={{ marginTop: '4px', marginBottom: '14px' }}>
          Query across ALL uploaded PDFs, Smart Notes, Meeting Transcripts, and Tasks simultaneously with AI-verified source citations.
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="mui-input"
            placeholder="e.g. What pricing or architecture decisions were made in recent meetings and docs?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            style={{ flex: 1, minWidth: '250px' }}
          />
          <button className="mui-btn mui-btn-primary" disabled={loading} onClick={handleAsk}>
            <span className="material-symbols-rounded icon-sm">auto_awesome</span>
            <span>{loading ? 'Searching...' : 'Ask Enterprise RAG'}</span>
          </button>
          <button className="mui-btn mui-btn-outlined" disabled={loading} onClick={handleSearchOnly}>
            <span className="material-symbols-rounded icon-sm">search</span>
            <span>Keyword Lookup</span>
          </button>
        </div>
      </div>

      {answer && (
        <div className="mui-card" style={{ marginBottom: '20px', borderLeft: '4px solid #06b6d4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: 700, color: '#06b6d4' }}>
            <span className="material-symbols-rounded icon-sm">neurology</span>
            <span>AI Synthesized Answer (With Citations)</span>
          </div>
          <div
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(answer) }}
          />
        </div>
      )}

      {hits.length > 0 && (
        <div className="mui-card">
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700 }}>
            Retrieved Workspace Sources ({hits.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {hits.map((h, i) => (
              <div
                key={`${h.source_type}-${h.source_id}`}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--mui-border)',
                  background: 'var(--mui-bg-paper)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="cmd-badge">Source {i + 1}</span>
                    <span className="cmd-badge" style={{ textTransform: 'uppercase' }}>{h.source_type}</span>
                    <strong>{h.title}</strong>
                  </div>
                  <span className="muted-sm">Score: {h.score}</span>
                </div>
                <p className="muted-sm" style={{ margin: 0, lineHeight: 1.5 }}>{h.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
