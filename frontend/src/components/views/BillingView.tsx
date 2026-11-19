import React, { useEffect, useState } from 'react';
import {
  Box, Button, Card, Chip, LinearProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography
} from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import {
  fetchBillingPlans,
  fetchBillingStatus,
  upgradeBillingPlan,
  fetchInvoices,
  type SaasPlan,
  type SubscriptionStatus
} from '../../services/enterprise';
import { Icon, PageContainer, PageHeader, SectionCard, EmptyState, riseSx } from '../ui';

interface BillingViewProps {
  userEmail: string;
  activeOrgId: string;
  showToast: (msg: string) => void;
}

const grow = keyframes`
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
`;

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

  const cycleToggle = (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={cycle}
      onChange={(_, v) => { if (v) setCycle(v); }}
      aria-label="Billing cycle"
      sx={{ bgcolor: 'background.paper', '& .MuiToggleButton-root': { minHeight: 44, px: 2, textTransform: 'none', fontWeight: 600 } }}
    >
      <ToggleButton value="monthly">Monthly</ToggleButton>
      <ToggleButton value="yearly">Yearly (save 20%)</ToggleButton>
    </ToggleButtonGroup>
  );

  return (
    <Box component="section" className="workspace-view active" id="view-billing">
      <PageContainer>
        <PageHeader
          overline="Plan & Billing"
          title="Plan & Billing"
          description={
            <>
              Current plan: <Box component="strong" sx={{ color: 'secondary.main' }}>{(sub?.plan_id || 'starter').toUpperCase()}</Box> · Billed {sub?.billing_cycle || 'monthly'}
            </>
          }
          actions={cycleToggle}
        />

        {sub && (
          <SectionCard index={1} icon="bolt" accent="cyan" title="AI credits this month" subtitle={`${sub.seats_limit} seats · ${sub.storage_mb_limit} MB storage included`} sx={{ mb: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }} flexWrap="wrap" useFlexGap spacing={1}>
              <Typography variant="body2" color="text.secondary">
                <Box component="strong" sx={{ color: 'text.primary', fontSize: 18 }}>{sub.ai_credits_used.toLocaleString()}</Box> / {sub.ai_credits_limit.toLocaleString()} credits
              </Typography>
              <Chip size="small" color={creditPct > 85 ? 'error' : 'default'} label={`${creditPct}% used`} />
            </Stack>
            <LinearProgress
              variant="determinate"
              value={creditPct}
              color={creditPct > 85 ? 'error' : 'secondary'}
              aria-label={`AI credits used: ${creditPct}%`}
              sx={{
                height: 12, borderRadius: 999,
                '& .MuiLinearProgress-bar': { borderRadius: 999 },
                transformOrigin: 'left',
                animation: `${grow} 1s cubic-bezier(.2,.7,.2,1) .2s both`,
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              }}
            />
          </SectionCard>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: `repeat(${Math.min(Math.max(plans.length, 1), 4)}, 1fr)` }, gap: 2, mb: 3, alignItems: 'stretch' }}>
          {plans.map((p, i) => {
            const isCurrent = sub?.plan_id === p.id;
            const price = cycle === 'yearly' ? p.price_yearly : p.price_monthly;
            return (
              <Card
                key={p.id}
                sx={(t) => ({
                  ...(riseSx(i + 2) as object),
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  transition: 'transform .25s ease, box-shadow .25s ease',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none', transition: 'none', '&:hover': { transform: 'none' } },
                  ...(isCurrent
                    ? {
                        bgcolor: t.palette.mode === 'dark' ? '#1e293b' : '#374151',
                        color: '#f8fafc',
                        borderColor: alpha('#22d3ee', 0.5),
                      }
                    : {}),
                })}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" component="h3" sx={{ color: 'inherit' }}>{p.name}</Typography>
                  {isCurrent && <Chip size="small" label="Current" sx={{ bgcolor: '#22d3ee', color: '#0f172a', fontWeight: 700 }} />}
                </Stack>
                <Box>
                  <Typography component="span" sx={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: 'inherit' }}>
                    ₹{price.toLocaleString('en-IN')}
                  </Typography>
                  <Typography component="span" variant="body2" sx={{ opacity: 0.7, color: 'inherit' }}>/{cycle === 'yearly' ? 'yr' : 'mo'}</Typography>
                </Box>
                <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0, flex: 1 }}>
                  {p.features.map((f) => (
                    <Stack component="li" key={f} direction="row" spacing={1} alignItems="flex-start">
                      <Icon name="check_circle" size={18} fill color={isCurrent ? '#22d3ee' : undefined} sx={{ color: isCurrent ? undefined : 'secondary.main', mt: '2px' }} />
                      <Typography variant="body2" sx={{ color: 'inherit', opacity: isCurrent ? 0.9 : 1 }}>{f}</Typography>
                    </Stack>
                  ))}
                </Stack>
                <Button
                  variant={isCurrent ? 'outlined' : 'contained'}
                  color="primary"
                  disabled={isCurrent}
                  onClick={() => handleUpgrade(p.id)}
                  sx={{
                    minHeight: 44,
                    ...(isCurrent ? { '&.Mui-disabled': { color: '#f8fafc', borderColor: alpha('#f8fafc', 0.3) } } : {}),
                  }}
                >
                  {isCurrent ? 'Your current plan' : `Switch to ${p.name}`}
                </Button>
              </Card>
            );
          })}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 2 }}>
          <SectionCard index={6} icon="data_usage" accent="violet" title="Usage by feature">
            {usage.length === 0 ? (
              <EmptyState icon="hourglass_empty" title="No usage yet" />
            ) : (
              <Box sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 3 }}>
                <Table size="small" sx={{ minWidth: 360 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Feature</TableCell>
                      <TableCell align="right">Requests</TableCell>
                      <TableCell align="right">Credits</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {usage.map((u) => (
                      <TableRow key={u.feature} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell sx={{ fontWeight: 600 }}>{u.feature}</TableCell>
                        <TableCell align="right">{u.calls}</TableCell>
                        <TableCell align="right">{u.credits}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </SectionCard>

          <SectionCard index={7} icon="receipt_long" accent="green" title="Invoices">
            {invoices.length === 0 ? (
              <EmptyState icon="receipt" title="No invoices yet" />
            ) : (
              <Box sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 3 }}>
                <Table size="small" sx={{ minWidth: 460 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.invoice_id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12.5 }}>{inv.invoice_id}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{new Date(inv.date).toLocaleDateString()} · {inv.cycle}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>₹{Number(inv.amount_usd || 0).toLocaleString('en-IN')}</TableCell>
                        <TableCell align="right">
                          <Chip size="small" variant="outlined" color={inv.status.toLowerCase() === 'paid' ? 'success' : 'default'} label={inv.status.toUpperCase()} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </SectionCard>
        </Box>
      </PageContainer>
    </Box>
  );
};
