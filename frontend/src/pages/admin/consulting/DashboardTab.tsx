import { TrendingUp, DollarSign, Repeat, Clock, Users, Briefcase, AlertCircle } from 'lucide-react'
import type { CrmDashboard } from '../../../lib/api'
import { fmtCents, fmtMinutes, fmtDate, Pill } from './crmShared'

function Stat({ icon: Icon, label, value, hint }: { icon: typeof TrendingUp; label: string; value: string; hint?: string }) {
  return (
    <div className="bg-snow border border-mist rounded-xl p-5">
      <div className="flex items-center gap-2 text-steel mb-2">
        <Icon size={15} />
        <span className="font-mono text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-ink">{value}</div>
      {hint && <div className="text-xs text-steel mt-1">{hint}</div>}
    </div>
  )
}

export default function DashboardTab({ dashboard, onJump }: { dashboard: CrmDashboard | null; onJump: (tab: string) => void }) {
  if (!dashboard) return null
  const d = dashboard
  const stageOrder = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat icon={DollarSign} label="Outstanding AR" value={fmtCents(d.outstanding_ar_cents)} hint="Unpaid invoice balances" />
        <Stat icon={Repeat} label="MRR" value={fmtCents(d.mrr_cents)} hint="Active retainers" />
        <Stat icon={TrendingUp} label="Pipeline value" value={fmtCents(d.pipeline_value_cents)} hint="Open deals" />
        <Stat icon={DollarSign} label="Paid this month" value={fmtCents(d.paid_this_month_cents)} />
        <Stat icon={Clock} label="Unbilled time" value={fmtMinutes(d.unbilled_minutes)} />
        <Stat icon={Briefcase} label="Active engagements" value={String(d.active_engagements)} />
      </div>

      <div className="bg-snow border border-mist rounded-xl p-5">
        <div className="flex items-center gap-2 text-steel mb-4">
          <Users size={15} />
          <span className="font-mono text-[10px] uppercase tracking-wider">Pipeline</span>
          <span className="text-xs text-steel">· {d.contacts_count} contacts</span>
          <button onClick={() => onJump('pipeline')} className="ml-auto text-xs text-blue hover:underline">View pipeline →</button>
        </div>
        <div className="flex flex-wrap gap-3">
          {stageOrder.map(s => (
            <div key={s} className="flex items-center gap-2">
              <Pill label={s} kind="stage" />
              <span className="text-sm font-medium text-ink">{d.pipeline_counts[s] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      {d.overdue_invoices.length > 0 && (
        <div className="bg-ember/5 border border-ember/20 rounded-xl p-5">
          <div className="flex items-center gap-2 text-ember mb-3">
            <AlertCircle size={15} />
            <span className="font-mono text-[10px] uppercase tracking-wider">Overdue invoices</span>
            <button onClick={() => onJump('invoices')} className="ml-auto text-xs text-blue hover:underline">View all →</button>
          </div>
          <div className="space-y-2">
            {d.overdue_invoices.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-xs text-ink">{inv.number}</span>
                <span className="text-steel">{inv.contact_name || '—'}</span>
                <span className="text-steel">due {fmtDate(inv.due_date)}</span>
                <span className="ml-auto font-medium text-ink">{fmtCents(inv.total_cents - inv.amount_paid_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
