import { useState, useEffect } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Plus, Search, User, Pencil, Trash2, X, ChevronDown } from 'lucide-react'
import type { Profile, Role } from '../types'

const ROLES: Role[] = ['owner', 'admin', 'manager', 'viewer']
const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', admin: 'Admin', manager: 'Manager', viewer: 'Viewer' }
const ROLE_ORDER: Record<Role, number> = { owner: 0, admin: 1, manager: 2, viewer: 3 }

type SortMode = 'alphabetical' | 'role'

export default function Users() {
  const { profile: me } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('alphabetical')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [form, setForm] = useState({ name: '', designation: '', email: '', mobile_number: '', username: '', password: '', role: 'viewer' as Role })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canEdit = me?.role === 'owner' || me?.role === 'admin'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*')
    setUsers(data ?? [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ name: '', designation: '', email: '', mobile_number: '', username: '', password: '', role: 'viewer' })
    setEditing(null); setError(''); setModal('add')
  }

  function openEdit(u: Profile) {
    setForm({ name: u.name, designation: u.designation ?? '', email: u.email ?? '', mobile_number: u.mobile_number ?? '', username: u.username, password: '', role: u.role })
    setEditing(u); setError(''); setModal('edit')
  }

  async function save() {
    if (!form.name.trim() || !form.username.trim() || !form.email.trim()) {
      setError('Name, Username and Email are required'); return
    }
    if (modal === 'add' && !form.password) { setError('Password is required'); return }
    setSaving(true); setError('')

    if (modal === 'add') {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: form.email.trim(), password: form.password,
        email_confirm: true
      })
      if (authErr || !authData.user) { setError(authErr?.message ?? 'Failed to create user'); setSaving(false); return }
      const { error: profErr } = await supabase.from('profiles').insert({
        id: authData.user.id, name: form.name.trim(), username: form.username.trim(),
        designation: form.designation.trim() || null, email: form.email.trim(),
        mobile_number: form.mobile_number.trim() || null, role: form.role
      })
      if (profErr) { setError(profErr.message); setSaving(false); return }
    } else if (editing) {
      const { error: profErr } = await supabase.from('profiles').update({
        name: form.name.trim(), username: form.username.trim(),
        designation: form.designation.trim() || null, email: form.email.trim(),
        mobile_number: form.mobile_number.trim() || null, role: form.role
      }).eq('id', editing.id)
      if (profErr) { setError(profErr.message); setSaving(false); return }
    }
    await load(); setSaving(false); setModal(null)
  }

  async function del(u: Profile) {
    if (u.id === me?.id) { alert("You can't delete your own account"); return }
    if (!confirm(`Delete user "${u.name}"?`)) return
    await supabase.from('profiles').delete().eq('id', u.id)
    await load()
  }

  const sorted = [...users]
    .filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'alphabetical'
      ? a.name.localeCompare(b.name)
      : ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name)
    )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Team Members</h2>
        {canEdit && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-teal text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
            <Plus size={18} /> Add User
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
        </div>
        <div className="relative">
          <select value={sort} onChange={e => setSort(e.target.value as SortMode)}
            className="appearance-none bg-white border border-gray-200 rounded-xl px-3 py-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-teal">
            <option value="alphabetical">Alphabetical</option>
            <option value="role">User Role</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 border-teal border-t-transparent rounded-full animate-spin" /></div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No users found</div>
      ) : (
        <div className="space-y-3">
          {sorted.map(u => (
            <div key={u.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-gray-600">
                    {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900">{u.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      u.role === 'owner' ? 'bg-orange text-white' : 'bg-gray-100 text-gray-500'
                    }`}>{ROLE_LABEL[u.role]}</span>
                  </div>
                  {u.designation && <p className="text-sm text-gray-500 mt-0.5">{u.designation}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">@{u.username}</p>
                  {u.email && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">✉ {u.email}</p>}
                  {u.mobile_number && <p className="text-xs text-gray-400 flex items-center gap-1">📱 {u.mobile_number}</p>}
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                  <button onClick={() => openEdit(u)} className="flex-1 flex items-center justify-center gap-2 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                    <Pencil size={14} /> Edit
                  </button>
                  <button onClick={() => del(u)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600">
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
              <h3 className="font-bold text-gray-900">{modal === 'add' ? 'Add User' : 'Edit User'}</h3>
              <button onClick={() => setModal(null)} className="p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <F label="Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
              <F label="Designation" value={form.designation} onChange={v => setForm(f => ({ ...f, designation: v }))} />
              <F label="Email *" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
              <F label="Mobile Number" value={form.mobile_number} onChange={v => setForm(f => ({ ...f, mobile_number: v }))} type="tel" />
              <F label="Username *" value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} />
              {modal === 'add' && <F label="Password *" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} type="password" />}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role</label>
                <div className="relative">
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                    className="w-full appearance-none px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal">
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
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

function F({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
    </div>
  )
}
