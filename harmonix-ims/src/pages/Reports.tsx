import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { FileDown, FileText, Package, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import type { InventoryItem, Transaction } from '../types'

type ReportTab = 'overview' | 'stock-levels' | 'movement'

async function logoDataUri(): Promise<string> {
  try {
    const res = await fetch('/logo.png')
    const blob = await res.blob()
    return await new Promise(resolve => {
      const r = new FileReader()
      r.onloadend = () => resolve(r.result as string)
      r.readAsDataURL(blob)
    })
  } catch { return '' }
}

function openPDF(html: string) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.onload = () => setTimeout(() => win.print(), 400)
}

function pdfShell(title: string, logo: string, subtitle: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
@page{margin:18mm;size:A4}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a2e35;font-size:13px;line-height:1.5}
.hdr{background:#185D6D;color:white;padding:22px 28px;display:flex;align-items:center;justify-content:space-between;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.hdr-left{display:flex;align-items:center;gap:16px}
.hdr img{height:52px;object-fit:contain}
.hdr-title{font-size:19px;font-weight:800}
.hdr-sub{font-size:11px;opacity:.75;margin-top:3px}
.hdr-right{text-align:right;font-size:11px;opacity:.75}
.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:18px 28px;background:#f4f6f8;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sc{background:white;border-radius:8px;padding:12px 14px;border-left:4px solid #185D6D}
.sc.or{border-left-color:#FF9810}
.sc-val{font-size:22px;font-weight:800;color:#185D6D}
.sc.or .sc-val{color:#FF9810}
.sc-lbl{font-size:10px;color:#5a7278;margin-top:2px}
.content{padding:20px 28px}
.section-title{font-size:13px;font-weight:700;color:#185D6D;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;margin-top:20px;padding-bottom:6px;border-bottom:2px solid #185D6D}
table{width:100%;border-collapse:collapse;margin-top:4px}
th{background:#185D6D;color:white;padding:9px 11px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact}
td{padding:8px 11px;border-bottom:1px solid #e8f2f4;font-size:12px;vertical-align:middle}
tr:nth-child(even) td{background:#f4f9fa;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ok{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#d1fae5;color:#065f46;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.low{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff4e6;color:#c05c00;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.in{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#e8f2f4;color:#185D6D;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.out{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#fff4e6;color:#c05c00;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.footer{margin-top:28px;padding-top:12px;border-top:1px solid #dce8eb;display:flex;justify-content:space-between;font-size:10px;color:#5a7278}
</style></head><body>
<div class="hdr">
  <div class="hdr-left">
    ${logo ? `<img src="${logo}" alt="Harmonix"/>` : ''}
    <div><div class="hdr-title">${title}</div><div class="hdr-sub">${subtitle}</div></div>
  </div>
  <div class="hdr-right">Generated on<br/><strong>${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</strong></div>
</div>
${body}
</body></html>`
}

export default function Reports() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<ReportTab>('overview')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [txns, setTxns] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

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

  const thisMonth = new Date().toISOString().slice(0, 7)
  const lowStockItems = items.filter(i => i.current_stock <= i.reorder_quantity)
  const monthIn = txns.filter(t => t.type === 'stock-in' && t.date?.startsWith(thisMonth)).reduce((s, t) => s + t.quantity, 0)
  const monthOut = txns.filter(t => t.type === 'stock-out' && t.date?.startsWith(thisMonth)).reduce((s, t) => s + t.quantity, 0)

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - 5 + i)
    return d.toISOString().slice(0, 7)
  })
  const monthlyData = months.map(m => ({
    label: new Date(m + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
    in: txns.filter(t => t.type === 'stock-in' && t.date?.startsWith(m)).reduce((s, t) => s + t.quantity, 0),
    out: txns.filter(t => t.type === 'stock-out' && t.date?.startsWith(m)).reduce((s, t) => s + t.quantity, 0),
  }))
  const maxBar = Math.max(...monthlyData.flatMap(m => [m.in, m.out]), 1)

  function summaryHtml() {
    return `<div class="summary">
      <div class="sc"><div class="sc-val">${items.length}</div><div class="sc-lbl">Total Items</div></div>
      <div class="sc or"><div class="sc-val">${lowStockItems.length}</div><div class="sc-lbl">Low Stock Items</div></div>
      <div class="sc"><div class="sc-val">${monthIn}</div><div class="sc-lbl">Stock-In This Month</div></div>
      <div class="sc or"><div class="sc-val">${monthOut}</div><div class="sc-lbl">Stock-Out This Month</div></div>
    </div>`
  }

  async function exportStockPDF() {
    setExporting(true)
    const logo = await logoDataUri()
    const rows = (tab === 'stock-levels' ? items : lowStockItems).map(i => {
      const low = i.current_stock <= i.reorder_quantity
      return `<tr>
        <td>${i.name}</td>
        <td>${i.item_code}</td>
        <td>${i.item_type ?? '—'}</td>
        <td>${i.organization?.name ?? '—'}</td>
        <td style="font-weight:700;color:${low ? '#FF9810' : '#185D6D'}">${i.current_stock}</td>
        <td>${i.reorder_quantity}</td>
        <td><span class="${low ? 'low' : 'ok'}">${low ? 'Reorder Now' : 'OK'}</span></td>
      </tr>`
    }).join('')

    const reportTitle = tab === 'stock-levels' ? 'Current Stock Report' : 'Low Stock Report'
    const body = summaryHtml() + `<div class="content">
      <div class="section-title">${reportTitle}</div>
      <table>
        <thead><tr><th>Item Name</th><th>Item Code</th><th>Type</th><th>Organization</th><th>Stock</th><th>Reorder Level</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer"><span>Harmonix IMS — Inventory Report</span><span>Total: ${items.length} items &nbsp;|&nbsp; Low Stock: ${lowStockItems.length}</span></div>
    </div>`

    openPDF(pdfShell(reportTitle, logo, `Generated by ${profile?.name ?? 'Admin'}`, body))
    setExporting(false)
  }

  async function exportMovementPDF() {
    setExporting(true)
    const logo = await logoDataUri()
    const rows = txns.map(t => `<tr>
      <td>${new Date(t.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      <td>${t.item?.name ?? '—'}</td>
      <td>${t.item?.item_code ?? '—'}</td>
      <td><span class="${t.type === 'stock-in' ? 'in' : 'out'}">${t.type === 'stock-in' ? 'Stock-In' : 'Stock-Out'}</span></td>
      <td style="font-weight:700">${t.type === 'stock-in' ? '+' : '-'}${t.quantity}</td>
      <td>${t.balance_quantity}</td>
      <td>${t.supplier ?? t.receiver ?? '—'}</td>
    </tr>`).join('')

    const monthTable = monthlyData.map(m => `<tr>
      <td>${m.label}</td>
      <td style="color:#185D6D;font-weight:700">${m.in || '—'}</td>
      <td style="color:#FF9810;font-weight:700">${m.out || '—'}</td>
      <td style="font-weight:700">${m.in - m.out}</td>
    </tr>`).join('')

    const body = summaryHtml() + `<div class="content">
      <div class="section-title">Monthly Summary</div>
      <table>
        <thead><tr><th>Month</th><th>Stock-In</th><th>Stock-Out</th><th>Net</th></tr></thead>
        <tbody>${monthTable}</tbody>
      </table>
      <div class="section-title" style="margin-top:24px">Transaction Detail</div>
      <table>
        <thead><tr><th>Date</th><th>Item</th><th>Code</th><th>Type</th><th>Qty</th><th>Balance</th><th>Supplier / Receiver</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer"><span>Harmonix IMS — Stock Movement Report</span><span>Total transactions: ${txns.length}</span></div>
    </div>`

    openPDF(pdfShell('Stock Movement Report', logo, `Generated by ${profile?.name ?? 'Admin'}`, body))
    setExporting(false)
  }

  function handleExport() {
    if (tab === 'movement') exportMovementPDF()
    else exportStockPDF()
  }

  function exportCSV() {
    let csv = ''
    if (tab === 'movement') {
      csv = 'Date,Item,Item Code,Type,Quantity,Balance,Supplier/Receiver\n'
      csv += txns.map(t =>
        [
          t.date,
          t.item?.name ?? '',
          t.item?.item_code ?? '',
          t.type,
          t.quantity,
          t.balance_quantity,
          t.supplier ?? t.receiver ?? '',
        ].join(',')
      ).join('\n')
    } else {
      const rows = tab === 'stock-levels' ? items : lowStockItems
      csv = 'Item Name,Item Code,Item Type,Organization,Current Stock,Reorder Level,Status\n'
      csv += rows.map(i =>
        [
          i.name,
          i.item_code,
          i.item_type ?? '',
          i.organization?.name ?? '',
          i.current_stock,
          i.reorder_quantity,
          i.current_stock <= i.reorder_quantity ? 'Reorder Now' : 'OK',
        ].join(',')
      ).join('\n')
    }
    const label = tab === 'movement' ? 'movement' : tab === 'stock-levels' ? 'stock-levels' : 'overview'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `harmonix-${label}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Reports</h2>
        <div className="flex gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 border border-teal text-teal text-xs font-semibold rounded-xl px-3 py-2 hover:bg-teal/5">
            <FileText size={14} /> CSV
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 bg-teal text-white text-xs font-semibold rounded-xl px-3 py-2 disabled:opacity-60">
            <FileDown size={14} /> {exporting ? 'Preparing…' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <SummaryCard icon={<Package size={18} />} label="Total Items" value={items.length} color="teal" />
        <SummaryCard icon={<AlertTriangle size={18} />} label="Low Stock" value={lowStockItems.length} color={lowStockItems.length > 0 ? 'orange' : 'teal'} />
        <SummaryCard icon={<TrendingUp size={18} />} label="Stock-In (this month)" value={monthIn} color="teal" />
        <SummaryCard icon={<TrendingDown size={18} />} label="Stock-Out (this month)" value={monthOut} color="orange" />
      </div>

      {/* Tabs */}
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
                      <p className="text-xs text-gray-400">min {item.reorder_quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-bold text-teal uppercase tracking-wide mb-2">✓ Stock OK ({items.length - lowStockItems.length})</p>
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
          {items.map(item => {
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
                <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="absolute left-0 top-0 h-full rounded-full"
                    style={{ width: `${stockPct}%`, background: low ? '#FF9810' : '#185D6D' }} />
                  <div className="absolute top-0 h-full w-0.5 bg-gray-400"
                    style={{ left: `${reorderPct}%` }} />
                </div>
                {low && <p className="text-xs text-orange font-medium mt-1.5 flex items-center gap-1"><AlertTriangle size={11} /> Reorder needed</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* MOVEMENT */}
      {tab === 'movement' && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Stock-In vs Stock-Out — Last 6 Months</p>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
            <div className="flex items-end gap-2" style={{ height: '140px' }}>
              {monthlyData.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
                  <div className="flex items-end gap-0.5 w-full flex-1">
                    <div className="flex-1 flex flex-col justify-end">
                      <div className="w-full rounded-t-md bg-teal" style={{ height: `${(m.in / maxBar) * 110}px`, minHeight: m.in > 0 ? '4px' : '0' }} />
                    </div>
                    <div className="flex-1 flex flex-col justify-end">
                      <div className="w-full rounded-t-md bg-orange" style={{ height: `${(m.out / maxBar) * 110}px`, minHeight: m.out > 0 ? '4px' : '0' }} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{m.label}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 justify-center">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-teal" /><span className="text-xs text-gray-500">Stock-In</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange" /><span className="text-xs text-gray-500">Stock-Out</span></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-4 text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <span>Month</span><span className="text-center text-teal">In</span><span className="text-center text-orange">Out</span><span className="text-center">Net</span>
            </div>
            {monthlyData.map((m, i) => (
              <div key={i} className="grid grid-cols-4 px-4 py-3 border-b border-gray-50 last:border-0 text-sm">
                <span className="font-medium text-gray-700">{m.label}</span>
                <span className="text-center font-semibold text-teal">{m.in || '—'}</span>
                <span className="text-center font-semibold text-orange">{m.out || '—'}</span>
                <span className={`text-center font-semibold ${m.in - m.out >= 0 ? 'text-teal' : 'text-orange'}`}>{m.in - m.out || '—'}</span>
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
