import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Layout from './components/Layout'
import Organizations from './pages/Organizations'
import Users from './pages/Users'
import Inventory from './pages/Inventory'
import Transactions from './pages/Transactions'
import Reports from './pages/Reports'
import Import from './pages/Import'

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
          <Route index element={<Transactions />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="reports" element={<Reports />} />
          {(role === 'owner' || role === 'admin') && (
            <>
              <Route path="organizations" element={<Organizations />} />
              <Route path="users" element={<Users />} />
              <Route path="import" element={<Import />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
