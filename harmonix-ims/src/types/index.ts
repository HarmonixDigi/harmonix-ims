export type Role = 'owner' | 'admin' | 'manager' | 'viewer'

export interface Profile {
  id: string
  name: string
  username: string
  designation?: string
  mobile_number?: string
  email?: string
  role: Role
  created_at: string
}

export interface Organization {
  id: string
  name: string
  code: string
  description?: string
  address: string
  created_at: string
}

export type ItemType = 'book' | 'activity_sheet' | 'activity_resource' | 'merchandise'

export interface InventoryItem {
  id: string
  name: string
  item_code: string
  item_type?: ItemType
  isbn?: string
  organization_id?: string
  organization?: Organization
  reorder_quantity: number
  current_stock: number
  photograph_url?: string
  created_at: string
}

export interface Transaction {
  id: string
  item_id: string
  item?: InventoryItem
  date: string
  type: 'stock-in' | 'stock-out'
  supplier?: string
  invoice_no?: string
  receiver?: string
  purpose?: string
  quantity: number
  balance_quantity: number
  created_by?: string
  created_at: string
}
