import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Plus, Search, Building2, Pencil, Trash2, X } from 'lucide-react'
import type { Organization } from '../types'

export default function Organizations() {
  const { profile } = useAuth()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Organization | null>(null)
  const [form, setForm] = useState({ name: '', code: '', description: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canEdit = profile?.role === 'owner'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('organizations').select('*').order('name')
    setOrgs(data ?? [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ name: '', code: '', description: '', address: '' })
    setEditing(null)
    setError('')
    setModal('add')
  }

  function openEdit(org: Organization) {
    setForm({ name: org.name, code: org.code, description: org.description ?? '', address: org.address })
    setEditing(org)
    setError('')
    setModal('edit')
  }

  async function save() {
    if (!form.name.trim() || !form.code.trim() || !form.address.trim()) {
      setError('Name, Code and Address are required')
      return
    }
    setSaving(true)
    setError('')
    if (modal === 'add') {
      const { error: e } = await supabase.from('organizations').insert({
        name: form.name.trim(), code: form.code.trim().toUpperCase(),
        description: form.description.trim() || null, address: form.address.trim()
      })
      if (e) { setError(e.message); setSaving(false); return }
    } else if (editing) {
      const { error: e } = await supabase.from('organizations').update({
        name: form.name.trim(), code: form.code.trim().toUpperCase(),
        description: form.description.trim() || null, address: form.address.trim()
      }).eq('id', editing.id)
      if (e) { setError(e.message); setSaving(false); return }
    }
    await load()
    setSaving(false)
    setModal(null)
  }

  async function del(org: Organization) {
    if (!confirm(`Delete "${org.name}"?`)) return
    await supabase.from('organizations').delete().eq('id', org.id)
    await load()
  }

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Organizations</h2>
        {canEdit && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-teal text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
            <Plus size={18} /> Add Organization
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search organizations..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-teal border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No organizations found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(org => (
            <div key={org.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 size={20} className="text-orange" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900">{org.name}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-mono">{org.code}</span>
                  </div>
                  {org.description && <p className="text-sm text-gray-500 mt-0.5">{org.description}</p>}
                  <p className="text-sm text-gray-500 mt-0.5">{org.address}</p>
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                  <button onClick={() => openEdit(org)} className="flex-1 flex items-center justify-center gap-2 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                    <Pencil size={14} /> Edit
                  </button>
                  <button onClick={() => del(org)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{modal === 'add' ? 'Add Organization' : 'Edit Organization'}</h3>
              <button onClick={() => setModal(null)} className="p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Organization Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. HR Division" />
              <Field label="Organization Code *" value={form.code} onChange={v => setForm(f => ({ ...f, code: v }))} placeholder="e.g. HR-DIV" />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal resize-none"
                />
              </div>
              <Field label="Address *" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="Full address" />
              {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(null)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 py-3 bg-teal text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <input
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal"
      />
    </div>
  )
}
