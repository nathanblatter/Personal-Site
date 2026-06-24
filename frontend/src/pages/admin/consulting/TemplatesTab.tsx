import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Pencil, X, FileText, Receipt, Loader2 } from 'lucide-react'
import { api, type Template, type TemplateKind, type InvoiceLineItem } from '../../../lib/api'
import { AdminInput, AdminTextarea } from '../AdminShared'
import type { AdminCallbacks } from '../AdminShared'
import { fmtCents, dollarsToCents, centsToDollars } from './crmShared'

export default function TemplatesTab({ showToast, showError }: AdminCallbacks) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Template | null>(null)
  const [creatingKind, setCreatingKind] = useState<TemplateKind | null>(null)

  const reload = useCallback(async () => { setTemplates(await api.crm.templates.list()) }, [])
  useEffect(() => { reload().catch(e => showError((e as Error).message)).finally(() => setLoading(false)) }, [reload, showError])

  const save = async (data: Partial<Template>, id?: string) => {
    try {
      if (id) await api.crm.templates.update(id, data)
      else await api.crm.templates.create(data)
      setEditing(null); setCreatingKind(null)
      await reload()
      showToast(id ? 'Template updated' : 'Template saved')
    } catch (e) { showError((e as Error).message) }
  }
  const remove = async (id: string) => {
    if (!confirm('Delete this template?')) return
    try { await api.crm.templates.delete(id); await reload(); showToast('Template deleted') }
    catch (e) { showError((e as Error).message) }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={18} className="animate-spin text-blue" /></div>

  const contracts = templates.filter(t => t.kind === 'contract')
  const invoices = templates.filter(t => t.kind === 'invoice')

  return (
    <div className="space-y-8">
      <p className="text-sm text-steel -mt-2">Save reusable scope/terms and invoice line items so you stop retyping them. Pick a template when drafting a contract or invoice.</p>

      <Section icon={FileText} title="Contract templates" onNew={() => { setCreatingKind('contract'); setEditing(null) }}>
        {creatingKind === 'contract' && <TemplateForm kind="contract" onSave={d => save(d)} onCancel={() => setCreatingKind(null)} />}
        {contracts.map(t => editing?.id === t.id
          ? <TemplateForm key={t.id} kind="contract" initial={t} onSave={d => save(d, t.id)} onCancel={() => setEditing(null)} />
          : <Row key={t.id} t={t} onEdit={() => { setEditing(t); setCreatingKind(null) }} onDelete={() => remove(t.id)}
              summary={t.total_value_cents ? fmtCents(t.total_value_cents) : 'No set value'} />)}
        {contracts.length === 0 && creatingKind !== 'contract' && <Empty />}
      </Section>

      <Section icon={Receipt} title="Invoice templates" onNew={() => { setCreatingKind('invoice'); setEditing(null) }}>
        {creatingKind === 'invoice' && <TemplateForm kind="invoice" onSave={d => save(d)} onCancel={() => setCreatingKind(null)} />}
        {invoices.map(t => editing?.id === t.id
          ? <TemplateForm key={t.id} kind="invoice" initial={t} onSave={d => save(d, t.id)} onCancel={() => setEditing(null)} />
          : <Row key={t.id} t={t} onEdit={() => { setEditing(t); setCreatingKind(null) }} onDelete={() => remove(t.id)}
              summary={`${t.line_items?.length || 0} line item(s)`} />)}
        {invoices.length === 0 && creatingKind !== 'invoice' && <Empty />}
      </Section>
    </div>
  )
}

function Section({ icon: Icon, title, onNew, children }: { icon: typeof FileText; title: string; onNew: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-snow border border-mist rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3 text-steel">
        <Icon size={15} /><span className="font-mono text-[10px] uppercase tracking-wider">{title}</span>
        <button onClick={onNew} className="ml-auto inline-flex items-center gap-1 text-xs text-blue hover:underline"><Plus size={13} /> New</button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
function Row({ t, summary, onEdit, onDelete }: { t: Template; summary: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm border border-mist rounded-lg px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-ink font-medium truncate">{t.name}</div>
        <div className="text-xs text-steel truncate">{t.title || summary}</div>
      </div>
      <span className="ml-auto font-mono text-[10px] text-steel">{summary}</span>
      <button onClick={onEdit} className="text-steel hover:text-blue" title="Edit"><Pencil size={13} /></button>
      <button onClick={onDelete} className="text-silver hover:text-ember" title="Delete"><Trash2 size={13} /></button>
    </div>
  )
}
function Empty() { return <div className="text-xs text-silver">No templates yet</div> }

function TemplateForm({ kind, initial, onSave, onCancel }: {
  kind: TemplateKind; initial?: Template; onSave: (d: Partial<Template>) => void; onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [value, setValue] = useState(centsToDollars(initial?.total_value_cents))
  const [scope, setScope] = useState(initial?.scope_md ?? '')
  const [terms, setTerms] = useState(initial?.terms_md ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [items, setItems] = useState<{ description: string; quantity: string; unit: string }[]>(
    (initial?.line_items || []).map(li => ({ description: li.description, quantity: String(li.quantity), unit: centsToDollars(li.unit_price_cents) }))
  )

  const setItem = (i: number, k: 'description' | 'quantity' | 'unit', v: string) =>
    setItems(items.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  const addItem = () => setItems([...items, { description: '', quantity: '1', unit: '' }])

  const submit = () => {
    if (!name.trim()) return
    if (kind === 'contract') {
      onSave({ kind, name: name.trim(), title: title.trim() || null, scope_md: scope.trim() || null, terms_md: terms.trim() || null, total_value_cents: value.trim() ? dollarsToCents(value) : null })
    } else {
      const line_items: InvoiceLineItem[] = items.filter(it => it.description.trim()).map(it => {
        const q = parseFloat(it.quantity || '1') || 1
        const unit = dollarsToCents(it.unit)
        return { description: it.description.trim(), quantity: q, unit_price_cents: unit, amount_cents: Math.round(q * unit) }
      })
      onSave({ kind, name: name.trim(), line_items, notes: notes.trim() || null })
    }
  }

  return (
    <div className="border border-blue/20 bg-blue-wash/30 rounded-lg p-4 space-y-3">
      <AdminInput label="Template name" value={name} onChange={setName} placeholder={kind === 'contract' ? 'Standard advisory SOW' : '50% deposit'} />
      {kind === 'contract' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminInput label="Default title" value={title} onChange={setTitle} placeholder="Consulting Agreement" />
            <AdminInput label="Default value ($)" value={value} onChange={setValue} placeholder="optional" />
          </div>
          <AdminTextarea label="Scope of work" value={scope} onChange={setScope} rows={4} />
          <AdminTextarea label="Terms & conditions" value={terms} onChange={setTerms} rows={4} />
        </>
      ) : (
        <>
          <div className="space-y-2">
            <label className="block font-mono text-[11px] text-steel tracking-wider uppercase">Line items</label>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_70px_90px_auto] gap-2 items-center">
                <input value={it.description} onChange={e => setItem(i, 'description', e.target.value)} placeholder="Description"
                  className="px-3 py-2 bg-white border border-mist rounded-lg text-sm focus:outline-none focus:border-blue/50" />
                <input value={it.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} placeholder="Qty"
                  className="px-2 py-2 bg-white border border-mist rounded-lg text-sm text-right font-mono focus:outline-none focus:border-blue/50" />
                <input value={it.unit} onChange={e => setItem(i, 'unit', e.target.value)} placeholder="$ rate"
                  className="px-2 py-2 bg-white border border-mist rounded-lg text-sm text-right font-mono focus:outline-none focus:border-blue/50" />
                <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="text-silver hover:text-ember"><X size={14} /></button>
              </div>
            ))}
            <button onClick={addItem} className="inline-flex items-center gap-1 text-xs text-blue hover:underline"><Plus size={12} /> Add line</button>
          </div>
          <AdminTextarea label="Notes" value={notes} onChange={setNotes} rows={2} />
        </>
      )}
      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={!name.trim()} className="px-3.5 py-2 bg-blue text-white rounded-lg text-sm font-medium hover:bg-blue/90 disabled:opacity-40">{initial ? 'Save' : 'Save template'}</button>
        <button onClick={onCancel} className="inline-flex items-center gap-1 px-3 py-2 text-steel hover:text-ink text-sm"><X size={14} /> Cancel</button>
      </div>
    </div>
  )
}
