# Harmonix IMS — Claude Instructions

## Project Overview
Mobile-first Inventory Management System for Harmonix/Aptean.
React + TypeScript + Vite + Tailwind CSS + Supabase backend.

## Supabase Project
- URL: https://tofmmzvqhmcatsbnavia.supabase.co
- Anon key and service key are in `.env` (never commit this file)
- Tables: `profiles`, `organizations`, `inventory_items`, `transactions`
- Storage bucket: `item-photos` (public)
- RLS: disabled (app-level role enforcement only)

## Brand Colors
- Teal: `#185D6D` — headers, action buttons, active states
- Orange: `#FF9810` — Owner badge, low stock banners, active menu pill
- Background: `#F4F6F8`
- Red: delete buttons only

## Role System
| Role | Organizations | Users | Inventory | Transactions |
|---|---|---|---|---|
| owner | Full | Full | Full | Full |
| admin | — | Full | Full | Full |
| manager | — | — | View | Add + View |
| viewer | — | — | View | View |

## Auth
- Login is username-based: app queries `profiles` by username → gets email → `signInWithPassword`
- Creating users requires the service role key (stored in `VITE_SUPABASE_SERVICE_KEY`)
- First admin: username `admin`, email `admin@harmonix.com`, role `owner`

## Key Files
- `src/hooks/useAuth.ts` — auth logic (login, logout, session, profile)
- `src/App.tsx` — route guard + role-based navigation
- `src/components/Layout.tsx` — teal header, hamburger drawer, role badge
- `src/pages/Inventory.tsx` — has dual camera/upload buttons (`capture="environment"`)
- `src/pages/Transactions.tsx` — auto-calculates balance, reorder warning
- `public/icon-192.png`, `public/icon-512.png` — PWA icons (teal H)
- `public/sw.js` — service worker for PWA/offline support
- `manifest.json` — PWA manifest

## Commands
```
npm run dev      # local dev at http://localhost:3000
npm run build    # production build → dist/
npm run preview  # preview the production build locally
```

## Deployment
- **Hosting**: Netlify — https://harmonix-ims.netlify.app
- **Auto-deploy**: push to `main` branch → Netlify rebuilds automatically
- **GitHub repo**: https://github.com/HarmonixDigi/harmonix-ims
- **Netlify env vars**: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_SERVICE_KEY

## Making Changes
1. Edit files here in Claude Code
2. Test locally with `npm run dev`
3. Push to GitHub → Netlify auto-deploys

## PWA / App Packaging
- **Android APK**: https://www.pwabuilder.com → paste Netlify URL → Android → Other Android → Generate Package
- **Windows**: Open in Edge → install icon in address bar
- **iOS**: Open in Safari → Share → Add to Home Screen

## Common Tasks

### Add a new page
1. Create `src/pages/NewPage.tsx`
2. Add route in `src/App.tsx`
3. Add nav item in `src/components/Layout.tsx` (with role check if needed)

### Add a new database column
1. Run `ALTER TABLE table_name ADD COLUMN col_name type;` in Supabase SQL editor
2. Update the TypeScript type in `src/types/index.ts`
3. Update the relevant page component

### Change a color
All colors are in `tailwind.config.js` under `theme.extend.colors`.
Use `bg-teal`, `text-teal`, `bg-orange`, `text-orange` in components.
