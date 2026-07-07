import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Plus, Search, Package, Pencil, Trash2, X, ChevronDown, Camera } from 'lucide-react'
import type { InventoryItem, Organization } from '../types'

type SortMode = 'alphabetical' | 'organization'

export default function Inventory() {
  const { profile } = useAuth()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('alphabetical')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [form, setForm] = useState({ name: '', item_code: '', organization_id: '', reorder_quantity: '', photograph_url: '' })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const canEdit = profile?.role === 'owner' || profile?.role === 'admin'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: itemData }, { data: orgData }] = await Promise.all([
      supabase.from('inventory_items').select('*, organization:organizations(*)').order('name'),
      supabase.from('organizations').select('*').order('name')
    ])
    setItems(itemData ?? [])
    setOrgs(orgData ?? [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ name: '', item_code: '', organization_id: '', reorder_quantity: '', photograph_url: '' })
    setPhotoFile(null); setPhotoPreview(''); setEditing(null); setError(''); setModal('add')
  }

  function openEdit(item: InventoryItem) {
    setForm({ name: item.name, item_code: item.item_code, organization_id: item.organization_id ?? '', reorder_quantity: String(item.reorder_quantity), photograph_url: item.photograph_url ?? '' })
    setPhotoFile(null); setPhotoPreview(item.photograph_url ?? ''); setEditing(item); setError(''); setModal('edit')
  }

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!photoFile) return form.photograph_url || null
    const ext = photoFile.name.split('.').pop()
    const path = `items/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('item-photos').upload(path, photoFile)
    if (error) return null
    const { data } = supabase.storage.from('item-photos').getPublicUrl(path)
    return data.publicUrl
  }

  async function save() {
    if (!form.name.trim() || !form.item_code.trim()) { setError('Name and Item Code are required'); return }
    const rq = parseInt(form.reorder_quantity) || 0
    setSaving(true); setError('')
    const photoUrl = await uploadPhoto()

    if (modal === 'add') {
      const { error: e } = await supabase.from('inventory_items').insert({
        name: form.name.trim(), item_code: form.item_code.trim().toUpperCase(),
        organization_id: form.organization_id || null, reorder_quantity: rq,
        current_stock: 0, photograph_url: photoUrl
      })
      if (e) { setError(e.message); setSaving(false); return }
    } else if (editing) {
      const { error: e } = await supabase.from('inventory_items').update({
        name: form.name.trim(), item_code: form.item_code.trim().toUpperCase(),
        organization_id: form.organization_id || null, reorder_quantity: rq,
        photograph_url: photoUrl ?? editing.photograph_url
      }).eq('id', editing.id)
      if (e) { setError(e.message); setSaving(false); return }
    }
    await load(); setSaving(false); setModal(null)
  }

  async function del(item: InventoryItem) {
    if (!confirm(`Delete "${item.name}"?`)) return
    await supabase.from('inventory_items').delete().eq('id', item.id)
    await load()
  }

  const filtered = items
    .filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.item_code.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'alphabetical'
      ? a.name.localeCompare(b.name)
      : ((a.organization?.name ?? '') + a.name).localeCompare((b.organization?.name ?? '') + b.name)
    )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Inventory Items</h2>
        {canEdit && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-teal text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
            <Plus size={18} /> Add Item
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search inventory..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
        </div>
        <div className="relative">
          <select value={sort} onChange={e => setSort(e.target.value as SortMode)}
            className="appearance-none bg-white border border-gray-200 rounded-xl px-3 py-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-teal">
            <option value="alphabetical">Alphabetical</option>
            <option value="organization">Organization</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 border-teal border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No items found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const pct = item.reorder_quantity > 0 ? Math.min(100, Math.round((item.current_stock / (item.reorder_quantity * 2)) * 100)) : 50
            const low = item.current_stock <= item.reorder_quantity
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  {item.photograph_url ? (
                    <img src={item.photograph_url} alt={item.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 bg-orange/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Package size={22} className="text-orange" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 leading-tight">{item.name}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{item.item_code}</p>
                  </div>
                  {item.organization && (
                    <span className="text-xs text-gray-400 flex-shrink-0">{item.organization.name}</span>
                  )}
                </div>

                {low && (
                  <div className="flex items-center gap-2 bg-orange/10 border border-orange/20 rounded-xl px-3 py-2 mb-3">
                    <span className="text-orange text-sm">⚠</span>
                    <span className="text-sm text-orange font-medium">Low stock — Reorder needed</span>
                  </div>
                )}

                <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                  <span>Current Stock</span>
                  <span className="font-semibold text-gray-800">{item.current_stock}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${pct}%`,
                    background: `linear-gradient(to right, #185D6D ${low ? 60 : 80}%, #FF9810)`
                  }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">Reorder Level: {item.reorder_quantity}</p>

                {canEdit && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                    <button onClick={() => openEdit(item)} className="flex-1 flex items-center justify-center gap-2 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                      <Pencil size={14} /> Edit
                    </button>
                    <button onClick={() => del(item)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600">
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{modal === 'add' ? 'Add Item' : 'Edit Item'}</h3>
              <button onClick={() => setModal(null)} className="p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <FI label="Item Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
              <FI label="Item Code *" value={form.item_code} onChange={v => setForm(f => ({ ...f, item_code: v }))} placeholder="e.g. BOOK-001" />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Organization</label>
                <div className="relative">
                  <select value={form.organization_id} onChange={e => setForm(f => ({ ...f, organization_id: e.target.value }))}
                    className="w-full appearance-none px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal">
                    <option value="">None</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <FI label="Reorder Quantity" value={form.reorder_quantity} onChange={v => setForm(f => ({ ...f, reorder_quantity: v }))} type="number" />

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Photo</label>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
                <button onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-teal hover:text-teal transition-colors">
                  <Camera size={18} />
                  {photoPreview ? 'Change Photo' : 'Take / Upload Photo'}
                </button>
                {photoPreview && <img src={photoPreview} alt="preview" className="w-full h-40 object-cover rounded-xl mt-2" />}
              </div>

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

function FI({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
    </div>
  )
}
