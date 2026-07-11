import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Plus, Search, ArrowDownCircle, ArrowUpCircle, X, ChevronDown, AlertTriangle, Trash2 } from 'lucide-react'
import type { Transaction, InventoryItem } from '../types'

type SortMode = 'chronological' | 'item' | 'daterange'
type TxnType = 'stock-in' | 'stock-out'
interface LineItem { item_id: string; quantity: string; stock: number | null }

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
  const [header, setHeader] = useState({ date: today(), type: 'stock-in' as TxnType, supplier: '', invoice_no: '', receiver: '', purpose: '' })
  const [lines, setLines] = useState<LineItem[]>([{ item_id: '', quantity: '', stock: null }])
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

  async function onLineItemChange(idx: number, itemId: string) {
    let stock: number | null = null
    if (itemId) {
      const { data } = await supabase.from('inventory_items').select('current_stock').eq('id', itemId).single()
      stock = data?.current_stock ?? null
    }
    setLines(ls => ls.map((l, i) => i === idx ? { ...l, item_id: itemId, stock } : l))
  }

  function addLine() {
    setLines(ls => [...ls, { item_id: '', quantity: '', stock: null }])
  }

  function removeLine(idx: number) {
    setLines(ls => ls.filter((_, i) => i !== idx))
  }

  function getBalance(line: LineItem): number | null {
    const qty = parseInt(line.quantity) || 0
    if (line.stock === null || qty <= 0) return null
    return header.type === 'stock-in' ? line.stock + qty : line.stock - qty
  }

  async function save() {
    if (!header.date) { setError('Date is required'); return }
    if (header.type === 'stock-in' && !header.supplier) { setError('Supplier is required'); return }
    if (header.type === 'stock-out' && !header.receiver) { setError('Receiver is required'); return }
    const validLines = lines.filter(l => l.item_id && parseInt(l.quantity) > 0)
    if (validLines.length === 0) { setError('Add at least one item with quantity'); return }
    setSaving(true); setError('')

    for (const line of validLines) {
      const qty = parseInt(line.quantity)
      const balance = getBalance(line)
      if (balance === null) continue
      const { error: txErr } = await supabase.from('transactions').insert({
        item_id: line.item_id, date: header.date, type: header.type,
        supplier: header.type === 'stock-in' ? header.supplier : null,
        invoice_no: header.type === 'stock-in' ? header.invoice_no : null,
        receiver: header.type === 'stock-out' ? header.receiver : null,
        purpose: header.type === 'stock-out' ? header.purpose : null,
        quantity: qty, balance_quantity: balance, created_by: profile?.id
      })
      if (!txErr) {
        await supabase.from('inventory_items').update({ current_stock: balance }).eq('id', line.item_id)
      }
    }
    await load(); setSaving(false); setModal(false)
  }

  function openAdd() {
    setHeader({ date: today(), type: 'stock-in', supplier: '', invoice_no: '', receiver: '', purpose: '' })
    setLines([{ item_id: '', quantity: '', stock: null }])
    setError(''); setModal(true)
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
              {/* Header fields */}
              <FT label="Date *" value={header.date} onChange={v => setHeader(h => ({ ...h, date: v }))} type="date" />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Transaction Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['stock-in', 'stock-out'] as TxnType[]).map(t => (
                    <button key={t} onClick={() => setHeader(h => ({ ...h, type: t }))}
                      className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${header.type === t ? 'bg-teal text-white border-teal' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {t === 'stock-in' ? 'Stock-In' : 'Stock-Out'}
                    </button>
                  ))}
                </div>
              </div>
              {header.type === 'stock-in' ? (
                <>
                  <FT label="Supplier *" value={header.supplier} onChange={v => setHeader(h => ({ ...h, supplier: v }))} />
                  <FT label="Invoice No." value={header.invoice_no} onChange={v => setHeader(h => ({ ...h, invoice_no: v }))} />
                </>
              ) : (
                <>
                  <FT label="Receiver *" value={header.receiver} onChange={v => setHeader(h => ({ ...h, receiver: v }))} />
                  <FT label="Purpose" value={header.purpose} onChange={v => setHeader(h => ({ ...h, purpose: v }))} />
                </>
              )}

              {/* Line items */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Items *</label>
                <div className="space-y-2">
                  {lines.map((line, idx) => {
                    const balance = getBalance(line)
                    const selItem = items.find(i => i.id === line.item_id)
                    const warn = balance !== null && selItem && balance <= selItem.reorder_quantity
                    return (
                      <div key={idx} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <select value={line.item_id} onChange={e => onLineItemChange(idx, e.target.value)}
                              className="w-full appearance-none px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal">
                              <option value="">Select item…</option>
                              {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.current_stock})</option>)}
                            </select>
                            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          </div>
                          <input type="number" value={line.quantity} onChange={e => setLines(ls => ls.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))}
                            placeholder="Qty" min="1"
                            className="w-20 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal" />
                          {lines.length > 1 && (
                            <button onClick={() => removeLine(idx)} className="p-2 text-red-400 hover:text-red-600">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        {balance !== null && (
                          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${warn ? 'bg-orange/10 text-orange' : 'bg-teal/10 text-teal'}`}>
                            {warn && <AlertTriangle size={12} />}
                            Balance: {balance}{warn ? ' — Low stock!' : ''}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button onClick={addLine}
                  className="mt-2 w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-teal hover:text-teal transition-colors font-medium">
                  + Add Another Item
                </button>
              </div>

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
