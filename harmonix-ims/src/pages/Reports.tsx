import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Download, BarChart2, AlertTriangle, ArrowLeftRight } from 'lucide-react'
import type { InventoryItem, Transaction } from '../types'

type ReportType = 'current-stock' | 'low-stock' | 'stock-movement'

export default function Reports() {
  const [report, setReport] = useState<ReportType>('current-stock')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [txns, setTxns] = useState<Transaction[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadItems() }, [])
  useEffect(() => { if (report === 'stock-movement') loadTxns() }, [report, from, to])

  async function loadItems() {
    setLoading(true)
    const { data } = await supabase.from('inventory_items').select('*, organization:organizations(*)').order('name')
    setItems(data ?? [])
    setLoading(false)
  }

  async function loadTxns() {
    setLoading(true)
    let q = supabase.from('transactions').select('*, item:inventory_items(*, organization:organizations(*))').order('date', { ascending: false })
    if (from) q = q.gte('date', from)
    if (to) q = q.lte('date', to)
    const { data } = await q
    setTxns(data ?? [])
    setLoading(false)
  }

  function exportCSV(rows: string[][], filename: string) {
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  function exportCurrentStock() {
    const rows = [
      ['Item Name', 'Item Code', 'Item Type', 'ISBN', 'Organization', 'Current Stock', 'Reorder Level', 'Status'],
      ...displayItems.map(i => [
        i.name, i.item_code, i.item_type ?? '', i.isbn ?? '',
        i.organization?.name ?? '', String(i.current_stock), String(i.reorder_quantity),
        i.current_stock <= i.reorder_quantity ? 'Low Stock' : 'OK'
      ])
    ]
    exportCSV(rows, 'harmonix-current-stock.csv')
  }

  function exportMovement() {
    const rows = [
      ['Date', 'Item Name', 'Item Code', 'Type', 'Quantity', 'Balance', 'Supplier', 'Invoice No', 'Receiver', 'Purpose'],
      ...txns.map(t => [
        t.date, t.item?.name ?? '', t.item?.item_code ?? '', t.type,
        String(t.quantity), String(t.balance_quantity),
        t.supplier ?? '', t.invoice_no ?? '', t.receiver ?? '', t.purpose ?? ''
      ])
    ]
    exportCSV(rows, 'harmonix-stock-movement.csv')
  }

  const lowStock = items.filter(i => i.current_stock <= i.reorder_quantity)
  const displayItems = report === 'low-stock' ? lowStock : items

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Reports</h2>
      </div>

      {/* Report selector */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {([
          { key: 'current-stock', label: 'Current Stock', icon: BarChart2 },
          { key: 'low-stock', label: 'Low Stock', icon: AlertTriangle },
          { key: 'stock-movement', label: 'Stock Movement', icon: ArrowLeftRight },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setReport(key)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-colors ${
              report === key ? 'bg-teal text-white border-teal' : 'bg-white text-gray-600 border-gray-200 hover:border-teal'
            }`}>
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* Stock Movement filters */}
      {report === 'stock-movement' && (
        <div className="flex gap-2 mb-4">
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
      ) : (
        <>
          {/* Current Stock / Low Stock */}
          {(report === 'current-stock' || report === 'low-stock') && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">{displayItems.length} item{displayItems.length !== 1 ? 's' : ''}</p>
                <button onClick={exportCurrentStock}
                  className="flex items-center gap-1.5 text-xs font-semibold text-teal border border-teal rounded-xl px-3 py-2 hover:bg-teal/5">
                  <Download size={14} /> Export CSV
                </button>
              </div>
              {displayItems.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  {report === 'low-stock' ? '🎉 No items are low on stock' : 'No items found'}
                </div>
              ) : (
                <div className="space-y-2">
                  {displayItems.map(item => {
                    const low = item.current_stock <= item.reorder_quantity
                    return (
                      <div key={item.id} className={`bg-white rounded-xl border p-3.5 shadow-sm ${low ? 'border-orange/30' : 'border-gray-100'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</p>
                            <p className="text-xs text-gray-400 font-mono">{item.item_code}</p>
                            {item.organization && <p className="text-xs text-gray-400 mt-0.5">{item.organization.name}</p>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-lg font-bold ${low ? 'text-orange' : 'text-teal'}`}>{item.current_stock}</p>
                            <p className="text-xs text-gray-400">Reorder: {item.reorder_quantity}</p>
                          </div>
                        </div>
                        {low && (
                          <div className="flex items-center gap-1.5 mt-2 bg-orange/10 rounded-lg px-2.5 py-1.5">
                            <AlertTriangle size={12} className="text-orange" />
                            <span className="text-xs text-orange font-medium">Low stock — reorder needed</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Stock Movement */}
          {report === 'stock-movement' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">{txns.length} transaction{txns.length !== 1 ? 's' : ''}</p>
                <button onClick={exportMovement}
                  className="flex items-center gap-1.5 text-xs font-semibold text-teal border border-teal rounded-xl px-3 py-2 hover:bg-teal/5">
                  <Download size={14} /> Export CSV
                </button>
              </div>
              {txns.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">No transactions found</div>
              ) : (
                <div className="space-y-2">
                  {txns.map(t => (
                    <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-gray-900 text-sm">{t.item?.name ?? '—'}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.type === 'stock-out' ? 'bg-orange text-white' : 'bg-teal text-white'}`}>
                          {t.type === 'stock-out' ? 'Out' : 'In'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mb-1.5">{formatDate(t.date)}</p>
                      <div className="flex gap-4 text-sm">
                        <div><p className="text-xs text-gray-400">Qty</p><p className="font-semibold">{t.type === 'stock-out' ? '-' : '+'}{t.quantity}</p></div>
                        <div><p className="text-xs text-gray-400">Balance</p><p className="font-semibold">{t.balance_quantity}</p></div>
                        {t.supplier && <div><p className="text-xs text-gray-400">Supplier</p><p className="font-medium truncate">{t.supplier}</p></div>}
                        {t.receiver && <div><p className="text-xs text-gray-400">Receiver</p><p className="font-medium truncate">{t.receiver}</p></div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
