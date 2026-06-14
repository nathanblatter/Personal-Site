import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import {
  api,
  type ContactResponse,
  type OrganizationResponse,
  type DealResponse,
  type EngagementResponse,
  type CrmDashboard,
} from '../../lib/api'
import type { AdminCallbacks } from './AdminShared'
import { SubTabs } from './consulting/crmShared'
import DashboardTab from './consulting/DashboardTab'
import PipelineTab from './consulting/PipelineTab'
import ContactsTab from './consulting/ContactsTab'
import EngagementsTab from './consulting/EngagementsTab'
import InvoicesTab from './consulting/InvoicesTab'
import TemplatesTab from './consulting/TemplatesTab'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'engagements', label: 'Engagements' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'templates', label: 'Templates' },
]

export interface CrmShared extends AdminCallbacks {
  contacts: ContactResponse[]
  orgs: OrganizationResponse[]
  deals: DealResponse[]
  engagements: EngagementResponse[]
  reloadContacts: () => Promise<void>
  reloadOrgs: () => Promise<void>
  reloadDeals: () => Promise<void>
  reloadEngagements: () => Promise<void>
  reloadDashboard: () => Promise<void>
}

export default function ConsultingSection({ showToast, showError }: AdminCallbacks) {
  const [tab, setTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [contacts, setContacts] = useState<ContactResponse[]>([])
  const [orgs, setOrgs] = useState<OrganizationResponse[]>([])
  const [deals, setDeals] = useState<DealResponse[]>([])
  const [engagements, setEngagements] = useState<EngagementResponse[]>([])
  const [dashboard, setDashboard] = useState<CrmDashboard | null>(null)

  const reloadContacts = useCallback(async () => { setContacts(await api.crm.contacts.list()) }, [])
  const reloadOrgs = useCallback(async () => { setOrgs(await api.crm.organizations.list()) }, [])
  const reloadDeals = useCallback(async () => { setDeals(await api.crm.deals.list()) }, [])
  const reloadEngagements = useCallback(async () => { setEngagements(await api.crm.engagements.list()) }, [])
  const reloadDashboard = useCallback(async () => { setDashboard(await api.crm.dashboard()) }, [])

  useEffect(() => {
    Promise.all([reloadContacts(), reloadOrgs(), reloadDeals(), reloadEngagements(), reloadDashboard()])
      .catch(e => showError((e as Error).message))
      .finally(() => setLoading(false))
  }, [reloadContacts, reloadOrgs, reloadDeals, reloadEngagements, reloadDashboard, showError])

  const shared: CrmShared = {
    showToast, showError, contacts, orgs, deals, engagements,
    reloadContacts, reloadOrgs, reloadDeals, reloadEngagements, reloadDashboard,
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Consulting</h1>
        <p className="text-sm text-steel mt-1">Clients, pipeline, engagements, and invoicing.</p>
      </div>

      <SubTabs tabs={TABS} active={tab} onChange={setTab} />

      {loading ? (
        <div className="flex items-center gap-2 text-steel py-12 justify-center">
          <Loader2 size={20} className="animate-spin text-blue" />
          <span className="font-mono text-sm">Loading…</span>
        </div>
      ) : (
        <>
          {tab === 'dashboard' && <DashboardTab dashboard={dashboard} onJump={setTab} />}
          {tab === 'pipeline' && <PipelineTab shared={shared} />}
          {tab === 'contacts' && <ContactsTab shared={shared} />}
          {tab === 'engagements' && <EngagementsTab shared={shared} />}
          {tab === 'invoices' && <InvoicesTab shared={shared} />}
          {tab === 'templates' && <TemplatesTab showToast={showToast} showError={showError} />}
        </>
      )}
    </div>
  )
}
