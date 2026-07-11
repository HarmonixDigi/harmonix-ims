import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Download, Upload, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

type Tab = 'inventory' | 'transactions'
type RowStatus = 'pending' | 'ok' | 'error'
interface PreviewRow { data: Record<string, string>; status: RowStatus; message: string }

const INV_HEADERS = ['name', 'item_code', 'item_type', 'isbn', 'organization_code', 'reorder_quantity', 'current_stock']
const TXN_HEADERS = ['item_code', 'date', 'type', 'supplier', 'invoice_no', 'receiver', 'purpose', 'quantity']

const ITEM_TYPE_VALUES = ['book', 'activity_sheet', 'activity_resource', 'merchandise', '']
const TXN_TYPE_VALUES = ['stock-in', 'stock-out']

export default function Import() {
  const [tab, setTab] = useState<Tab>('inventory')
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [importResult, setImportResult] = useState({ ok: 0, failed: 0 })
  const fileRef = useRef<HTMLInputElement>(null)

  function downloadTemplate() {
    const headers = tab === 'inventory' ? INV_HEADERS : TXN_HEADERS
    const example = tab === 'inventory'
      ? '\nSample Book,BOOK-001,book,978-0-000-00000-0,HGF,10,50'
      : '\nBOOK-001,2024-01-15,stock-in,Publisher Name,INV-001,,,100'
    const csv = headers.join(',') + example
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `harmonix-${tab}-template.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function parseCSV(text: string): Record<string, string>[] {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
    })
  }

  function validateInventoryRow(row: Record<string, string>): string {
    if (!row.name?.trim()) return 'Name is required'
    if (!row.item_code?.trim()) return 'Item Code is required'
    if (row.item_type && !ITEM_TYPE_VALUES.includes(row.item_type)) return `Item Type must be one of: book, activity_sheet, activity_resource, merchandise`
    if (isNaN(Number(row.reorder_quantity))) return 'Reorder Quantity must be a number'
    if (isNaN(Number(row.current_stock))) return 'Current Stock must be a number'
    return ''
  }

  function validateTransactionRow(row: Record<string, string>): string {
    if (!row.item_code?.trim()) return 'Item Code is required'
    if (!row.date?.trim()) return 'Date is required'
    if (!TXN_TYPE_VALUES.includes(row.type)) return 'Type must be stock-in or stock-out'
    if (!row.quantity?.trim() || isNaN(Number(row.quantity)) || Number(row.quantity) <= 0) return 'Quantity must be a positive number'
    if (row.type === 'stock-in' && !row.supplier?.trim()) return 'Supplier is required for stock-in'
    if (row.type === 'stock-out' && !row.receiver?.trim()) return 'Receiver is required for stock-out'
    return ''
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setDone(false)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      const previewed: PreviewRow[] = rows.map(row => {
        const msg = tab === 'inventory' ? validateInventoryRow(row) : validateTransactionRow(row)
        return { data: row, status: msg ? 'error' : 'pending', message: msg }
      })
      setPreview(previewed)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function runImport() {
    setImporting(true)
    let ok = 0, failed = 0

    if (tab === 'inventory') {
      // load orgs for code lookup
      const { data: orgs } = await supabase.from('organizations').select('id,code')
      const orgMap = Object.fromEntries((orgs ?? []).map(o => [o.code.toUpperCase(), o.id]))

      for (const row of preview.filter(r => r.status !== 'error')) {
        const orgId = row.data.organization_code ? orgMap[row.data.organization_code.toUpperCase()] ?? null : null
        const { error } = await supabase.from('inventory_items').insert({
          name: row.data.name.trim(),
          item_code: row.data.item_code.trim().toUpperCase(),
          item_type: row.data.item_type || null,
          isbn: row.data.isbn || null,
          organization_id: orgId,
          reorder_quantity: Number(row.data.reorder_quantity) || 0,
          current_stock: Number(row.data.current_stock) || 0,
        })
        error ? failed++ : ok++
      }
    } else {
      // load items for code lookup
      const { data: itemsData } = await supabase.from('inventory_items').select('id,item_code,current_stock')
      const itemMap = Object.fromEntries((itemsData ?? []).map(i => [i.item_code.toUpperCase(), i]))

      for (const row of preview.filter(r => r.status !== 'error')) {
        const item = itemMap[row.data.item_code.toUpperCase()]
        if (!item) { failed++; continue }
        const qty = Number(row.data.quantity)
        const balance = row.data.type === 'stock-in' ? item.current_stock + qty : item.current_stock - qty
        const { error } = await supabase.from('transactions').insert({
          item_id: item.id,
          date: row.data.date,
          type: row.data.type,
          supplier: row.data.supplier || null,
          invoice_no: row.data.invoice_no || null,
          receiver: row.data.receiver || null,
          purpose: row.data.purpose || null,
          quantity: qty,
          balance_quantity: balance,
        })
        if (!error) {
          await supabase.from('inventory_items').update({ current_stock: balance }).eq('id', item.id)
          item.current_stock = balance
          ok++
        } else {
          failed++
        }
      }
    }

    setImportResult({ ok, failed })
    setDone(true)
    setImporting(false)
    setPreview([])
  }

  const validRows = preview.filter(r => r.status !== 'error').length
  const errorRows = preview.filter(r => r.status === 'error').length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Import Data</h2>
      </div>

      {/* Tab */}
      <div className="flex gap-2 mb-5">
        {(['inventory', 'transactions'] as Tab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setPreview([]); setDone(false) }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              tab === t ? 'bg-teal text-white border-teal' : 'bg-white text-gray-600 border-gray-200 hover:border-teal'
            }`}>
            {t === 'inventory' ? 'Inventory Items' : 'Transactions'}
          </button>
        ))}
      </div>

      {/* Instructions */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-800 mb-2">How to import</p>
        <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
          <li>Download the CSV template below</li>
          <li>Fill in your data in Excel or Google Sheets (keep the headers, add rows below)</li>
          <li>Save as CSV and upload here</li>
          <li>Review the preview and click Import</li>
        </ol>
        {tab === 'inventory' && (
          <p className="text-xs text-gray-400 mt-2">
            Item Type values: <code className="bg-gray-100 px-1 rounded">book</code> <code className="bg-gray-100 px-1 rounded">activity_sheet</code> <code className="bg-gray-100 px-1 rounded">activity_resource</code> <code className="bg-gray-100 px-1 rounded">merchandise</code>
          </p>
        )}
        {tab === 'transactions' && (
          <p className="text-xs text-gray-400 mt-2">
            Type values: <code className="bg-gray-100 px-1 rounded">stock-in</code> or <code className="bg-gray-100 px-1 rounded">stock-out</code> &nbsp;|&nbsp; Date format: <code className="bg-gray-100 px-1 rounded">YYYY-MM-DD</code>
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-5">
        <button onClick={downloadTemplate}
          className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-600 hover:border-teal hover:text-teal transition-colors font-medium">
          <Download size={16} /> Download Template
        </button>
        <button onClick={() => fileRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-teal text-white rounded-xl text-sm font-semibold hover:bg-teal/90">
          <Upload size={16} /> Upload CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
      </div>

      {/* Import result */}
      {done && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm">
          <p className="font-semibold text-gray-800 mb-2">Import complete</p>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-green-600"><CheckCircle size={16} /><span className="text-sm font-medium">{importResult.ok} imported</span></div>
            {importResult.failed > 0 && <div className="flex items-center gap-2 text-red-500"><XCircle size={16} /><span className="text-sm font-medium">{importResult.failed} failed</span></div>}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-3 text-sm">
              <span className="text-green-600 font-medium">{validRows} valid</span>
              {errorRows > 0 && <span className="text-red-500 font-medium">{errorRows} errors</span>}
            </div>
            {validRows > 0 && (
              <button onClick={runImport} disabled={importing}
                className="flex items-center gap-2 bg-teal text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60">
                {importing ? 'Importing…' : `Import ${validRows} row${validRows !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {preview.map((row, i) => (
              <div key={i} className={`bg-white rounded-xl border p-3 shadow-sm ${row.status === 'error' ? 'border-red-200' : 'border-gray-100'}`}>
                <div className="flex items-start gap-2">
                  {row.status === 'error'
                    ? <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                    : <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {tab === 'inventory' ? row.data.name || '(no name)' : `${row.data.item_code} — ${row.data.type} — ${row.data.date}`}
                    </p>
                    {row.status === 'error' && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <AlertTriangle size={11} className="text-red-400" />
                        <p className="text-xs text-red-500">{row.message}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {Object.entries(row.data).filter(([, v]) => v).slice(0, 4).map(([k, v]) => (
                        <span key={k} className="text-xs text-gray-400">{k}: <span className="text-gray-600">{v}</span></span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
