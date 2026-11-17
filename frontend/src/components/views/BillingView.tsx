import React, { useEffect, useState } from 'react';
import {
  fetchBillingPlans,
  fetchBillingStatus,
  upgradeBillingPlan,
  fetchInvoices,
  type SaasPlan,
  type SubscriptionStatus
} from '../../services/enterprise';

interface BillingViewProps {
  userEmail: string;
  activeOrgId: string;
  showToast: (msg: string) => void;
}

export const BillingView: React.FC<BillingViewProps> = ({ userEmail, activeOrgId, showToast }) => {
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [usage, setUsage] = useState<Array<{ feature: string; credits: number; tokens: number; calls: number }>>([]);
  const [invoices, setInvoices] = useState<Array<{ invoice_id: string; date: string; amount_usd: number; cycle: string; status: string }>>([]);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');

  const loadBilling = async () => {
    try {
      const [pRes, sRes, iRes] = await Promise.all([
        fetchBillingPlans(),
        fetchBillingStatus(userEmail, activeOrgId || 'personal'),
        fetchInvoices(userEmail)
      ]);
      setPlans(pRes.plans);
      setSub(sRes.subscription);
      setUsage(sRes.usage_breakdown || []);
      setInvoices(iRes.invoices || []);
    } catch (e: any) {
      showToast(e.message || 'Failed to load billing status');
    }
  };

  useEffect(() => {
    loadBilling();
  }, [userEmail, activeOrgId]);

  const handleUpgrade = async (planId: string) => {
    try {
      const res = await upgradeBillingPlan(planId, cycle, userEmail, activeOrgId || 'personal');
      setSub(res.subscription);
      showToast(res.message);
      await loadBilling();
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const creditPct = sub ? Math.min(100, Math.round((sub.ai_credits_used / Math.max(sub.ai_credits_limit, 1)) * 100)) : 0;

  return (
    <section className="workspace-view active" id="view-billing">
      <div className="mui-card" style={{ marginBottom: '20px' }}>
        <div className="card-header-flex">
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Subscription & AI Usage Metering</h2>
            <p className="muted-sm" style={{ marginTop: '4px' }}>
              Active Plan: <strong style={{ color: '#06b6d4' }}>{(sub?.plan_id || 'starter').toUpperCase()}</strong> • Cycle: {sub?.billing_cycle || 'monthly'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`mui-btn mui-btn-sm ${cycle === 'monthly' ? 'mui-btn-primary' : 'mui-btn-outlined'}`}
              onClick={() => setCycle('monthly')}
            >
              Monthly
            </button>
            <button
              className={`mui-btn mui-btn-sm ${cycle === 'yearly' ? 'mui-btn-primary' : 'mui-btn-outlined'}`}
              onClick={() => setCycle('yearly')}
            >
              Yearly (Save 20%)
            </button>
          </div>
        </div>

        {sub && (
          <div style={{ marginTop: '14px', padding: '14px', borderRadius: '10px', border: '1px solid var(--mui-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span>Monthly AI Credits Meter</span>
              <strong>{sub.ai_credits_used.toLocaleString()} / {sub.ai_credits_limit.toLocaleString()} credits ({creditPct}%)</strong>
            </div>
            <div style={{ height: '10px', borderRadius: '999px', background: 'var(--mui-border)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${creditPct}%`,
                  height: '100%',
                  background: creditPct > 85 ? '#ef4444' : '#06b6d4'
                }}
              />
            </div>
            <div className="muted-sm" style={{ marginTop: '8px' }}>
              Seat Quota: {sub.seats_limit} seats • Knowledge Storage Limit: {sub.storage_mb_limit} MB
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        {plans.map((p) => {
          const isCurrent = sub?.plan_id === p.id;
          const price = cycle === 'yearly' ? p.price_yearly : p.price_monthly;
          return (
            <div
              key={p.id}
              className="mui-card"
              style={{
                border: isCurrent ? '2px solid #06b6d4' : '1px solid var(--mui-border)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{p.name}</h3>
                  {isCurrent && <span className="cmd-badge">CURRENT</span>}
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, margin: '10px 0' }}>
                  ₹{price.toLocaleString('en-IN')}<span className="muted-sm" style={{ fontSize: '12px' }}>/{cycle === 'yearly' ? 'yr' : 'mo'}</span>
                </div>
                <ul style={{ paddingLeft: '18px', margin: '0 0 14px 0', fontSize: '13px', lineHeight: 1.6 }}>
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
              <button
                className={`mui-btn ${isCurrent ? 'mui-btn-outlined' : 'mui-btn-primary'}`}
                disabled={isCurrent}
                onClick={() => handleUpgrade(p.id)}
              >
                {isCurrent ? 'Active Plan' : `Switch to ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        <div className="mui-card">
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700 }}>Metered Usage Breakdown</h3>
          {usage.length === 0 ? (
            <p className="muted-sm">No usage logged yet.</p>
          ) : (
            usage.map((u) => (
              <div key={u.feature} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--mui-border)', fontSize: '13px' }}>
                <span>{u.feature}</span>
                <strong>{u.credits} credits ({u.calls} calls)</strong>
              </div>
            ))
          )}
        </div>

        <div className="mui-card">
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700 }}>Billing & Invoice History</h3>
          {invoices.length === 0 ? (
            <p className="muted-sm">No paid invoices yet.</p>
          ) : (
            invoices.map((inv) => (
              <div key={inv.invoice_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--mui-border)', fontSize: '13px' }}>
                <div>
                  <strong>{inv.invoice_id}</strong>
                  <div className="muted-sm">{new Date(inv.date).toLocaleDateString()} • {inv.cycle}</div>
                </div>
                <span className="cmd-badge">₹{Number(inv.amount_usd || 0).toLocaleString('en-IN')} • {inv.status.toUpperCase()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
