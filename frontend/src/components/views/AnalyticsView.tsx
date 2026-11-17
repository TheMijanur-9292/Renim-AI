import React, { useEffect, useState } from 'react';
import { fetchAnalyticsOverview } from '../../services/enterprise';

interface AnalyticsViewProps {
  userEmail: string;
  showToast: (msg: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ userEmail, showToast }) => {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAnalyticsOverview>> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchAnalyticsOverview(userEmail);
      setData(res);
    } catch (e: any) {
      showToast(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [userEmail]);

  const kpis = data?.kpis;
  const tasks = data?.task_breakdown;
  const totalTasks = Math.max(tasks?.tasks_total || 1, 1);

  return (
    <section className="workspace-view active" id="view-analytics">
      <div className="card-header-flex" style={{ marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Executive Analytics & BI Dashboard</h2>
          <p className="muted-sm" style={{ marginTop: '4px' }}>
            Real-time workspace velocity, AI productivity ROI, and operational health metrics.
          </p>
        </div>
        <button className="mui-btn mui-btn-outlined mui-btn-sm" onClick={load}>
          <span className="material-symbols-rounded icon-sm">refresh</span>
          <span>Refresh Metrics</span>
        </button>
      </div>

      {loading || !data ? (
        <div className="mui-card"><p className="muted-sm">Calculating workspace intelligence...</p></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div className="mui-card">
              <div className="muted-sm">AI Time Saved</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#06b6d4', marginTop: '6px' }}>
                {kpis?.ai_hours_saved ?? 0} hrs
              </div>
              <div className="muted-sm" style={{ marginTop: '4px' }}>{kpis?.total_ai_calls ?? 0} AI executions</div>
            </div>
            <div className="mui-card">
              <div className="muted-sm">Task Completion Rate</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#10b981', marginTop: '6px' }}>
                {kpis?.completion_rate ?? 0}%
              </div>
              <div className="muted-sm" style={{ marginTop: '4px' }}>
                {tasks?.tasks_done ?? 0} of {tasks?.tasks_total ?? 0} tasks done
              </div>
            </div>
            <div className="mui-card">
              <div className="muted-sm">Knowledge Assets</div>
              <div style={{ fontSize: '26px', fontWeight: 800, marginTop: '6px' }}>
                {(kpis?.docs_count ?? 0) + (kpis?.notes_count ?? 0)}
              </div>
              <div className="muted-sm" style={{ marginTop: '4px' }}>
                {kpis?.docs_count ?? 0} Docs ({kpis?.docs_storage_mb ?? 0} MB) • {kpis?.notes_count ?? 0} Notes
              </div>
            </div>
            <div className="mui-card">
              <div className="muted-sm">Meetings Captured</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#8b5cf6', marginTop: '6px' }}>
                {kpis?.meetings_count ?? 0}
              </div>
              <div className="muted-sm" style={{ marginTop: '4px' }}>Urgent open tasks: {tasks?.urgent_open ?? 0}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            <div className="mui-card">
              <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 700 }}>Sprint & Task Distribution</h3>
              {[
                { label: 'Completed (Done)', val: tasks?.tasks_done || 0, color: '#10b981' },
                { label: 'In Progress', val: tasks?.tasks_in_progress || 0, color: '#06b6d4' },
                { label: 'Backlog (To-Do)', val: tasks?.tasks_todo || 0, color: '#f59e0b' }
              ].map((row) => {
                const pct = Math.round((row.val / totalTasks) * 100);
                return (
                  <div key={row.label} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span>{row.label}</span>
                      <strong>{row.val} ({pct}%)</strong>
                    </div>
                    <div style={{ height: '8px', borderRadius: '999px', background: 'var(--mui-border)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: row.color }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mui-card">
              <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 700 }}>AI Feature Usage Metering</h3>
              {data.ai_usage.length === 0 ? (
                <p className="muted-sm">No metered AI calls recorded yet. Try Ask Copilot or Enterprise RAG!</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.ai_usage.map((u) => (
                    <div key={u.feature} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--mui-border)' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{u.feature}</span>
                      <span className="cmd-badge">{u.calls} calls • {u.credits} credits</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};
