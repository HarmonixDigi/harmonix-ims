import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Download, Package, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import type { InventoryItem, Transaction } from '../types'

type ReportTab = 'overview' | 'stock-levels' | 'movement'

export default function Reports() {
  const [tab, setTab] = useState<ReportTab>('overview')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [txns, setTxns] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: itemData }, { data: txData }] = await Promise.all([
        supabase.from('inventory_items').select('*, organization:organizations(*)').order('name'),
        supabase.from('transactions').select('*, item:inventory_items(name,item_code)').order('date', { ascending: true })
      ])
      setItems(itemData ?? [])
      setTxns(txData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // Summary stats
  const thisMonth = new Date().toISOString().slice(0, 7)
  const lowStockItems = items.filter(i => i.current_stock <= i.reorder_quantity)
  const monthIn = txns.filter(t => t.type === 'stock-in' && t.date?.startsWith(thisMonth)).reduce((s, t) => s + t.quantity, 0)
  const monthOut = txns.filter(t => t.type === 'stock-out' && t.date?.startsWith(thisMonth)).reduce((s, t) => s + t.quantity, 0)

  // Last 6 months for movement chart
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - 5 + i)
    return d.toISOString().slice(0, 7)
  })
  const monthlyData = months.map(m => ({
    label: new Date(m + '-01').toLocaleDateString('en-GB', { month: 'short' }),
    in: txns.filter(t => t.type === 'stock-in' && t.date?.startsWith(m)).reduce((s, t) => s + t.quantity, 0),
    out: txns.filter(t => t.type === 'stock-out' && t.date?.startsWith(m)).reduce((s, t) => s + t.quantity, 0),
  }))
  const maxBar = Math.max(...monthlyData.flatMap(m => [m.in, m.out]), 1)

  function exportCSV() {
    let rows: string[][]
    let filename: string
    if (tab === 'stock-levels' || tab === 'overview') {
      rows = [
        ['Item Name', 'Item Code', 'Item Type', 'Organization', 'Current Stock', 'Reorder Level', 'Status'],
        ...items.map(i => [
          i.name, i.item_code, i.item_type ?? '', i.organization?.name ?? '',
          String(i.current_stock), String(i.reorder_quantity),
          i.current_stock <= i.reorder_quantity ? 'Low Stock' : 'OK'
        ])
      ]
      filename = 'harmonix-stock-report.csv'
    } else {
      rows = [
        ['Date', 'Item', 'Type', 'Quantity', 'Balance'],
        ...txns.map(t => [t.date, t.item?.name ?? '', t.type, String(t.quantity), String(t.balance_quantity)])
      ]
      filename = 'harmonix-movement-report.csv'
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-3 border-teal border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Reports</h2>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 text-xs font-semibold text-teal border border-teal rounded-xl px-3 py-2 hover:bg-teal/5">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Summary cards — always visible */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <SummaryCard icon={<Package size={18} />} label="Total Items" value={items.length} color="teal" />
        <SummaryCard icon={<AlertTriangle size={18} />} label="Low Stock" value={lowStockItems.length} color={lowStockItems.length > 0 ? 'orange' : 'teal'} />
        <SummaryCard icon={<TrendingUp size={18} />} label="Stock-In (this month)" value={monthIn} color="teal" />
        <SummaryCard icon={<TrendingDown size={18} />} label="Stock-Out (this month)" value={monthOut} color="orange" />
      </div>

      {/* Tab selector */}
      <div className="flex gap-1.5 mb-5 bg-gray-100 p-1 rounded-xl">
        {([
          { key: 'overview', label: 'Overview' },
          { key: 'stock-levels', label: 'Stock Levels' },
          { key: 'movement', label: 'Movement' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === key ? 'bg-white text-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Low stock section */}
          {lowStockItems.length > 0 && (
            <div>
              <p className="text-xs font-bold text-orange uppercase tracking-wide mb-2">⚠ Needs Reorder ({lowStockItems.length})</p>
              <div className="space-y-2">
                {lowStockItems.map(item => (
                  <div key={item.id} className="bg-white rounded-xl border border-orange/20 p-3 flex items-center gap-3">
                    <div className="w-9 h-9 bg-orange/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <AlertTriangle size={16} className="text-orange" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.organization?.name ?? 'No org'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-orange">{item.current_stock}</p>
                      <p className="text-xs text-gray-400">of {item.reorder_quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Healthy items */}
          <div>
            <p className="text-xs font-bold text-teal uppercase tracking-wide mb-2">
              ✓ Stock OK ({items.length - lowStockItems.length})
            </p>
            <div className="space-y-2">
              {items.filter(i => i.current_stock > i.reorder_quantity).map(item => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.organization?.name ?? 'No org'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-teal">{item.current_stock}</p>
                    <p className="text-xs text-gray-400">min {item.reorder_quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STOCK LEVELS */}
      {tab === 'stock-levels' && (
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No items found</div>
          ) : items.map(item => {
            const low = item.current_stock <= item.reorder_quantity
            const max = Math.max(item.current_stock, item.reorder_quantity * 2, 1)
            const stockPct = Math.min(100, (item.current_stock / max) * 100)
            const reorderPct = Math.min(100, (item.reorder_quantity / max) * 100)
            return (
              <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{item.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{item.item_code}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-base font-bold ${low ? 'text-orange' : 'text-teal'}`}>{item.current_stock}</span>
                    <p className="text-xs text-gray-400">/ reorder {item.reorder_quantity}</p>
                  </div>
                </div>
                {/* Bar track */}
                <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="absolute left-0 top-0 h-full rounded-full transition-all"
                    style={{ width: `${stockPct}%`, background: low ? '#FF9810' : '#185D6D' }} />
                  {/* Reorder marker */}
                  <div className="absolute top-0 h-full w-0.5 bg-gray-300"
                    style={{ left: `${reorderPct}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-400">0</span>
                  <span className="text-xs text-gray-400">Reorder: {item.reorder_quantity}</span>
                </div>
                {low && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-orange font-medium">
                    <AlertTriangle size={11} /> Low — reorder needed
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MOVEMENT CHART */}
      {tab === 'movement' && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Stock-In vs Stock-Out — Last 6 Months</p>

          {/* SVG Bar Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
            <div className="flex items-end gap-2 h-40">
              {monthlyData.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex items-end gap-0.5 w-full" style={{ height: '120px' }}>
                    {/* Stock-In bar */}
                    <div className="flex-1 flex flex-col justify-end">
                      <div className="w-full rounded-t-md bg-teal transition-all"
                        style={{ height: `${(m.in / maxBar) * 120}px`, minHeight: m.in > 0 ? '4px' : '0' }} />
                    </div>
                    {/* Stock-Out bar */}
                    <div className="flex-1 flex flex-col justify-end">
                      <div className="w-full rounded-t-md bg-orange transition-all"
                        style={{ height: `${(m.out / maxBar) * 120}px`, minHeight: m.out > 0 ? '4px' : '0' }} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 font-medium">{m.label}</p>
                </div>
              ))}
            </div>
            {/* Legend */}
            <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 justify-center">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-teal" /><span className="text-xs text-gray-500">Stock-In</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange" /><span className="text-xs text-gray-500">Stock-Out</span></div>
            </div>
          </div>

          {/* Monthly summary table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-3 text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <span>Month</span><span className="text-center text-teal">In</span><span className="text-center text-orange">Out</span>
            </div>
            {monthlyData.map((m, i) => (
              <div key={i} className="grid grid-cols-3 px-4 py-3 border-b border-gray-50 last:border-0 text-sm">
                <span className="font-medium text-gray-700">{m.label}</span>
                <span className="text-center font-semibold text-teal">{m.in || '—'}</span>
                <span className="text-center font-semibold text-orange">{m.out || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: 'teal' | 'orange' }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color === 'teal' ? 'bg-teal/10 text-teal' : 'bg-orange/10 text-orange'}`}>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${color === 'teal' ? 'text-teal' : 'text-orange'}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
    </div>
  )
}
