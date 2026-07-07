-- Run this in your Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/tofmmzvqhmcatsbnavia/sql

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  username text UNIQUE NOT NULL,
  designation text,
  mobile_number text,
  email text,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','admin','manager','viewer')),
  created_at timestamptz DEFAULT now()
);

-- 2. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  description text,
  address text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Inventory items
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  item_code text UNIQUE NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  reorder_quantity integer NOT NULL DEFAULT 0,
  current_stock integer NOT NULL DEFAULT 0,
  photograph_url text,
  created_at timestamptz DEFAULT now()
);

-- 4. Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  date date NOT NULL,
  type text NOT NULL CHECK (type IN ('stock-in','stock-out')),
  supplier text,
  invoice_no text,
  receiver text,
  purpose text,
  quantity integer NOT NULL,
  balance_quantity integer NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. Storage bucket for item photos
INSERT INTO storage.buckets (id, name, public) VALUES ('item-photos', 'item-photos', true)
ON CONFLICT DO NOTHING;

-- 6. Disable RLS for now (enable and add policies when ready)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- 7. Storage policy (allow all authenticated users to upload)
CREATE POLICY "allow uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'item-photos');
CREATE POLICY "allow reads" ON storage.objects FOR SELECT USING (bucket_id = 'item-photos');

-- ============================================================
-- SEED: Create admin user
-- Step 1: Go to Authentication > Users > Add User in Supabase Dashboard
-- Email: admin@harmonix.life  Password: Admin@123
-- Copy the UUID Supabase gives you, then run step 2:

-- Step 2: (replace <UUID> with actual UUID from step 1)
-- INSERT INTO profiles (id, name, username, designation, role, email)
-- VALUES ('<UUID>', 'System Admin', 'admin', 'System Administrator', 'owner', 'admin@harmonix.life');
-- ============================================================
