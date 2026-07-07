import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Plus, Search, ArrowDownCircle, ArrowUpCircle, X, ChevronDown, AlertTriangle } from 'lucide-react'
import type { Transaction, InventoryItem } from '../types'

type SortMode = 'chronological' | 'item' | 'daterange'

export default function Transactions() {
  const { profile } = useAuth()
  const [txns, setTxns] = useState<Transaction[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('chronological')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ item_id: '', date: today(), type: 'stock-in' as 'stock-in' | 'stock-out', supplier: '', invoice_no: '', receiver: '', purpose: '', quantity: '' })
  const [currentStock, setCurrentStock] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canAdd = profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'manager'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: txData }, { data: itemData }] = await Promise.all([
      supabase.from('transactions').select('*, item:inventory_items(*, organization:organizations(*))').order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('inventory_items').select('*, organization:organizations(*)').order('name')
    ])
    setTxns(txData ?? [])
    setItems(itemData ?? [])
    setLoading(false)
  }

  async function onItemChange(itemId: string) {
    setForm(f => ({ ...f, item_id: itemId }))
    if (itemId) {
      const { data } = await supabase.from('inventory_items').select('current_stock').eq('id', itemId).single()
      setCurrentStock(data?.current_stock ?? null)
    } else {
      setCurrentStock(null)
    }
  }

  const qty = parseInt(form.quantity) || 0
  const balance = currentStock !== null
    ? (form.type === 'stock-in' ? currentStock + qty : currentStock - qty)
    : null
  const selectedItem = items.find(i => i.id === form.item_id)
  const reorderWarning = balance !== null && selectedItem && balance <= selectedItem.reorder_quantity

  async function save() {
    if (!form.item_id || !form.date || qty <= 0) { setError('Item, Date and Quantity are required'); return }
    if (form.type === 'stock-in' && !form.supplier) { setError('Supplier is required'); return }
    if (form.type === 'stock-out' && !form.receiver) { setError('Receiver is required'); return }
    if (balance === null) { setError('Could not calculate balance'); return }
    setSaving(true); setError('')

    const { error: txErr } = await supabase.from('transactions').insert({
      item_id: form.item_id, date: form.date, type: form.type,
      supplier: form.type === 'stock-in' ? form.supplier : null,
      invoice_no: form.type === 'stock-in' ? form.invoice_no : null,
      receiver: form.type === 'stock-out' ? form.receiver : null,
      purpose: form.type === 'stock-out' ? form.purpose : null,
      quantity: qty, balance_quantity: balance, created_by: profile?.id
    })
    if (txErr) { setError(txErr.message); setSaving(false); return }

    await supabase.from('inventory_items').update({ current_stock: balance }).eq('id', form.item_id)
    await load(); setSaving(false); setModal(false)
  }

  function openAdd() {
    setForm({ item_id: '', date: today(), type: 'stock-in', supplier: '', invoice_no: '', receiver: '', purpose: '', quantity: '' })
    setCurrentStock(null); setError(''); setModal(true)
  }

  let filtered = txns.filter(t =>
    (t.item?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (t.item?.item_code ?? '').toLowerCase().includes(search.toLowerCase())
  )

  if (sort === 'daterange' && from && to) {
    filtered = filtered.filter(t => t.date >= from && t.date <= to)
  }

  if (sort === 'item') {
    filtered = [...filtered].sort((a, b) =>
      ((a.item?.name ?? '') + a.date).localeCompare((b.item?.name ?? '') + b.date)
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Transactions</h2>
        {canAdd && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-teal text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
            <Plus size={18} /> New Transaction
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
        </div>
        <div className="relative">
          <select value={sort} onChange={e => setSort(e.target.value as SortMode)}
            className="appearance-none bg-white border border-gray-200 rounded-xl px-3 py-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-teal">
            <option value="chronological">Chronological</option>
            <option value="item">Inventory Item</option>
            <option value="daterange">Date Range</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {sort === 'daterange' && (
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 border-teal border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No transactions found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2.5">
                  {t.type === 'stock-out'
                    ? <ArrowDownCircle size={22} className="text-orange flex-shrink-0 mt-0.5" />
                    : <ArrowUpCircle size={22} className="text-teal flex-shrink-0 mt-0.5" />
                  }
                  <div>
                    <p className="font-bold text-gray-900 leading-tight">{t.item?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400 font-mono">{t.item?.item_code}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                  t.type === 'stock-out' ? 'bg-orange text-white' : 'bg-teal text-white'
                }`}>
                  {t.type === 'stock-out' ? 'Stock-Out' : 'Stock-In'}
                </span>
              </div>

              <p className="text-xs text-gray-400 mb-2">📅 {formatDate(t.date)}</p>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Quantity</p>
                  <p className="font-semibold text-gray-800">{t.type === 'stock-out' ? '-' : '+'}{t.quantity}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Balance</p>
                  <p className="font-semibold text-gray-800">{t.balance_quantity}</p>
                </div>
                {t.supplier && <div><p className="text-xs text-gray-400">Supplier</p><p className="font-medium text-gray-700 truncate">{t.supplier}</p></div>}
                {t.invoice_no && <div><p className="text-xs text-gray-400">Invoice No.</p><p className="font-medium text-gray-700">{t.invoice_no}</p></div>}
                {t.receiver && <div><p className="text-xs text-gray-400">Receiver</p><p className="font-medium text-gray-700 truncate">{t.receiver}</p></div>}
                {t.purpose && <div className="col-span-2"><p className="text-xs text-gray-400">Purpose</p><p className="font-medium text-gray-700">{t.purpose}</p></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Record Transaction</h3>
              <button onClick={() => setModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Item *</label>
                <div className="relative">
                  <select value={form.item_id} onChange={e => onItemChange(e.target.value)}
                    className="w-full appearance-none px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal">
                    <option value="">Select item…</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.current_stock})</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <FT label="Date *" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} type="date" />

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Transaction Type *</label>
                <div className="relative">
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'stock-in' | 'stock-out' }))}
                    className="w-full appearance-none px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal">
                    <option value="stock-in">Stock-In</option>
                    <option value="stock-out">Stock-Out</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {form.type === 'stock-in' ? (
                <>
                  <FT label="Supplier *" value={form.supplier} onChange={v => setForm(f => ({ ...f, supplier: v }))} />
                  <FT label="Invoice No." value={form.invoice_no} onChange={v => setForm(f => ({ ...f, invoice_no: v }))} />
                  <FT label="Quantity In *" value={form.quantity} onChange={v => setForm(f => ({ ...f, quantity: v }))} type="number" />
                </>
              ) : (
                <>
                  <FT label="Receiver *" value={form.receiver} onChange={v => setForm(f => ({ ...f, receiver: v }))} />
                  <FT label="Purpose" value={form.purpose} onChange={v => setForm(f => ({ ...f, purpose: v }))} />
                  <FT label="Quantity Out *" value={form.quantity} onChange={v => setForm(f => ({ ...f, quantity: v }))} type="number" />
                </>
              )}

              {balance !== null && (
                <div className={`px-4 py-3 rounded-xl ${reorderWarning ? 'bg-orange/10 border border-orange/20' : 'bg-teal-light border border-teal/20'}`}>
                  <p className="text-sm font-semibold text-gray-700">Balance Quantity: <span className={reorderWarning ? 'text-orange' : 'text-teal'}>{balance}</span></p>
                  {reorderWarning && (
                    <div className="flex items-center gap-2 mt-1">
                      <AlertTriangle size={14} className="text-orange" />
                      <p className="text-xs text-orange font-medium">Stock will reach reorder level — time to procure!</p>
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 py-3 bg-teal text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                  {saving ? 'Saving…' : 'Record Transaction'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function FT({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal" />
    </div>
  )
}
