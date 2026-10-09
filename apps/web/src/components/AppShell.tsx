import type { User, UserAvailability } from '@xatxoot/shared'
import { useState } from 'react'

export interface AppShellProps {
  user?: User | null
  organizationName?: string
  onLogout?: () => void
  children?: React.ReactNode
}

export function AppShell({
  user = {
    id: 'mock-user',
    email: 'operator@xatxoot.local',
    displayName: 'Operator Petugas',
    role: 'agent',
    availability: 'online',
    active: true,
    createdAt: new Date().toISOString(),
  },
  organizationName = 'Xatxoot Support',
  onLogout,
  children,
}: AppShellProps) {
  const [availability, setAvailability] = useState<UserAvailability>(user?.availability || 'online')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleAvailabilityChange = (newStatus: UserAvailability) => {
    setAvailability(newStatus)
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {
      // Ignore network errors on logout
    } finally {
      setIsLoggingOut(false)
      if (onLogout) {
        onLogout()
      } else {
        window.location.href = '/login'
      }
    }
  }

  const getStatusColor = (status: UserAvailability) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500'
      case 'busy':
        return 'bg-amber-500'
      case 'offline':
        return 'bg-slate-400'
      default:
        return 'bg-emerald-500'
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased">
      {/* Top Bar Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        {/* Brand & Organization Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            X
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-sm leading-tight flex items-center gap-2">
              <span>{organizationName}</span>
              <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Instance
              </span>
            </h1>
            <p className="text-[11px] text-slate-500">Xatxoot Customer Support</p>
          </div>
        </div>

        {/* User Session & Availability Top Bar Elements */}
        {user && (
          <div className="flex items-center gap-4">
            {/* Availability Selector */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
              <span className={`w-2 h-2 rounded-full ${getStatusColor(availability)}`} />
              <select
                value={availability}
                onChange={(e) => handleAvailabilityChange(e.target.value as UserAvailability)}
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer capitalize"
              >
                <option value="online">Online</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            {/* User Profile Pill */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-semibold flex items-center justify-center text-xs">
                {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <span>{user.displayName}</span>
                  <span className="text-[10px] font-medium capitalize px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                    {user.role}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                  {user.email}
                </div>
              </div>
            </div>

            {/* Logout Action */}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="py-1.5 px-3 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200"
            >
              {isLoggingOut ? 'Keluar...' : 'Logout'}
            </button>
          </div>
        )}
      </header>

      {/* Main Layout Body: Left Sidebar Strip + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mini WhatsApp-style Navigation Strip */}
        <aside className="w-14 bg-slate-800 text-slate-400 flex flex-col items-center py-4 gap-4 shrink-0">
          <button
            type="button"
            title="Chats & Inbox"
            className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center transition-all hover:brightness-110"
          >
            💬
          </button>
          <button
            type="button"
            title="Contacts"
            className="w-10 h-10 rounded-xl hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all"
          >
            👥
          </button>
          <button
            type="button"
            title="Teams"
            className="w-10 h-10 rounded-xl hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all"
          >
            🏢
          </button>
          <div className="mt-auto">
            <button
              type="button"
              title="Settings"
              className="w-10 h-10 rounded-xl hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all"
            >
              ⚙️
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100">
          {children || (
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
              <h2 className="text-xl font-bold text-slate-800 mb-2">Selamat Datang di Xatxoot</h2>
              <p className="text-sm text-slate-600">
                Pilih percakapan di bilah navigasi untuk mulai berinteraksi dengan kontak WhatsApp.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default AppShell
