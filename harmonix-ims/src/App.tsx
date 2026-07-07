import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Layout from './components/Layout'
import Organizations from './pages/Organizations'
import Users from './pages/Users'
import Inventory from './pages/Inventory'
import Transactions from './pages/Transactions'

export default function App() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="w-10 h-10 border-4 border-teal border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) return <Login />

  const role = profile.role

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout profile={profile} />}>
          {role === 'owner' && <Route index element={<Organizations />} />}
          {(role === 'owner' || role === 'admin') && (
            <>
              {role !== 'owner' && <Route index element={<Users />} />}
              <Route path="organizations" element={<Organizations />} />
              <Route path="users" element={<Users />} />
            </>
          )}
          {role === 'manager' && <Route index element={<Inventory />} />}
          {role === 'viewer' && <Route index element={<Inventory />} />}
          <Route path="inventory" element={<Inventory />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
