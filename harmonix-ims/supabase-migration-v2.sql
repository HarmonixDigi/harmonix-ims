-- Migration v2: Item Type, ISBN, and FK fixes
-- Run this in Supabase → SQL Editor

-- 1. Add item_type and isbn columns to inventory_items
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS item_type text CHECK (item_type IN ('book','activity_sheet','activity_resource','merchandise')),
  ADD COLUMN IF NOT EXISTS isbn text;

-- 2. Fix delete bug: allow org deletion even when inventory items reference it
--    (sets organization_id to NULL on linked items instead of blocking delete)
ALTER TABLE inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_organization_id_fkey,
  ADD CONSTRAINT inventory_items_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

-- 3. Fix delete bug: allow user deletion even when transactions reference them
--    (sets created_by to NULL on linked transactions instead of blocking delete)
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_created_by_fkey,
  ADD CONSTRAINT transactions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
