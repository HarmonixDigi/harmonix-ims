import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Menu, X, Building2, Users, Package, ArrowLeftRight, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import type { Profile, Role } from '../types'

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner', admin: 'Admin', manager: 'Manager', viewer: 'Viewer'
}

const NAV = [
  { path: '/organizations', label: 'Organization Management', icon: Building2, roles: ['owner'] },
  { path: '/users', label: 'User Management', icon: Users, roles: ['owner', 'admin'] },
  { path: '/inventory', label: 'Inventory Management', icon: Package, roles: ['owner', 'admin', 'manager', 'viewer'] },
  { path: '/transactions', label: 'Transaction Management', icon: ArrowLeftRight, roles: ['owner', 'admin', 'manager', 'viewer'] },
] as const

interface Props { profile: Profile }

export default function Layout({ profile }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const visibleNav = NAV.filter(n => (n.roles as readonly string[]).includes(profile.role))

  const currentTitle = visibleNav.find(n =>
    location.pathname === n.path || (location.pathname === '/' && n === visibleNav[0])
  )?.label ?? 'Harmonix IMS'

  function go(path: string) {
    navigate(path)
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="bg-teal text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-30 shadow-md">
        <button onClick={() => setMenuOpen(true)} className="p-1 rounded-lg hover:bg-white/10 active:bg-white/20">
          <Menu size={22} />
        </button>
        <h1 className="flex-1 font-semibold text-base truncate">{currentTitle}</h1>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
          profile.role === 'owner' ? 'bg-orange text-white' : 'bg-white/20 text-white'
        }`}>
          {ROLE_LABEL[profile.role]}
        </span>
        <button onClick={logout} className="p-1 rounded-lg hover:bg-white/10 active:bg-white/20 ml-1">
          <LogOut size={20} />
        </button>
      </header>

      {/* Drawer overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="relative z-50 w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <span className="font-bold text-gray-800">Menu</span>
              <button onClick={() => setMenuOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="font-semibold text-gray-800">{profile.name}</p>
              <span className={`inline-block mt-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                profile.role === 'owner' ? 'bg-orange text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {ROLE_LABEL[profile.role]}
              </span>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {visibleNav.map(({ path, label, icon: Icon }) => {
                const active = location.pathname === path ||
                  (location.pathname === '/' && path === visibleNav[0].path)
                return (
                  <button
                    key={path}
                    onClick={() => go(path)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-colors ${
                      active
                        ? 'bg-orange text-white font-semibold'
                        : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="text-sm">{label}</span>
                  </button>
                )
              })}
            </nav>
            <div className="px-3 pb-6">
              <button
                onClick={() => { logout(); setMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50"
              >
                <LogOut size={20} />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
