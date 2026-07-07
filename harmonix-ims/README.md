# Harmonix IMS

Mobile-first Inventory Management System built with React + TypeScript + Supabase.

## Setup

### 1. Supabase
1. Open your Supabase project: https://supabase.com/dashboard/project/tofmmzvqhmcatsbnavia
2. Go to SQL Editor → paste and run `supabase-setup.sql`
3. Go to Authentication → Users → Add User:
   - Email: `admin@harmonix.life`
   - Password: `Admin@123`
   - Copy the UUID shown
4. Back in SQL Editor, run:
   ```sql
   INSERT INTO profiles (id, name, username, designation, role, email)
   VALUES ('<paste-uuid-here>', 'System Admin', 'admin', 'System Administrator', 'owner', 'admin@harmonix.life');
   ```
5. Go to Project Settings → API → copy **Project URL** and **anon public key**

### 2. Environment
```bash
cp .env.example .env
# Edit .env and fill in your Supabase URL and anon key
```

### 3. Run locally
```bash
npm install
npm run dev
# Opens at http://localhost:3000
```

### 4. Build & Deploy to Netlify
```bash
npm run build
# Upload the dist/ folder to Netlify
# OR connect GitHub repo to Netlify for auto-deploy
```

### 5. Get Android APK (free)
1. Deploy to Netlify first (get a public URL)
2. Go to https://www.pwabuilder.com
3. Enter your Netlify URL
4. Click "Package for stores" → Android → Download APK
5. Install on Android phone (enable "Install from unknown sources")

## Login
- Username: `admin`
- Password: `Admin@123`

## Roles
| Role | Organizations | Users | Inventory | Transactions |
|---|---|---|---|---|
| Owner | Full | Full | Full | Full |
| Admin | — | Full | Full | Full |
| Manager | — | — | View only | Add + View |
| Viewer | — | — | View only | View only |
