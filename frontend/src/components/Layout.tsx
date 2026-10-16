import React, { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  LogOut,
  FolderKanban,
  GraduationCap,
  ShieldAlert,
  Check,
  CheckCheck,
  Building2,
  Users,
  User as UserIcon,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api/client'
import { Notification } from '../types'

export const Layout: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showNotifications, setShowNotifications] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Poll unread count every 30 seconds
  const { data: unreadData } = useQuery<{ unread_count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/notifications/unread-count'),
    refetchInterval: 30000,
    enabled: !!user,
  })

  // Fetch full notifications list when dropdown is opened
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications'),
    enabled: showNotifications && !!user,
  })

  // Mark all as read mutation
  const markAllMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })

  // Mark single as read mutation
  const markSingleMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const unreadCount = unreadData?.unread_count || 0

  const navLinks = [
    { to: '/batches', label: 'Batches', icon: FolderKanban },
    { to: '/colleges', label: 'Colleges', icon: Building2 },
    { to: '/students', label: 'Students', icon: GraduationCap },
    ...(user?.role === 'admin'
      ? [
          { to: '/employees', label: 'Employees', icon: Users },
          { to: '/audit', label: 'Audit Log', icon: ShieldAlert },
        ]
      : []),
  ]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-8 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              id="mobile-menu-button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-hidden"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link to="/batches" className="flex items-center space-x-2.5 sm:space-x-3 group min-w-0">
              <img
                src="/logo.png"
                alt="SA Marine Consultancy Logo"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-contain shadow-xs group-hover:scale-105 transition-transform shrink-0"
              />
              <div className="min-w-0">
                <span className="font-bold text-slate-900 text-sm sm:text-lg tracking-tight block truncate">
                  SA Marine Consultancy
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon
                const isActive = location.pathname.startsWith(link.to)
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
            {/* Notifications Menu */}
            <div className="relative">
              <button
                id="notifications-button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-hidden"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span
                    id="unread-badge"
                    className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 md:w-96 max-w-[calc(100vw-2rem)] rounded-xl bg-white shadow-xl border border-slate-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllMutation.mutate()}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-500">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div
                          key={n.id}
                          className={`p-3.5 text-xs transition-colors flex items-start justify-between space-x-2 ${
                            !n.is_read ? 'bg-blue-50/50' : 'bg-white'
                          }`}
                        >
                          <div className="flex-1">
                            <p className="text-slate-800 leading-relaxed font-normal">{n.message}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {new Date(n.created_at).toLocaleString()}
                            </span>
                          </div>
                          {!n.is_read && (
                            <button
                              onClick={() => markSingleMutation.mutate(n.id)}
                              title="Mark read"
                              className="text-slate-400 hover:text-blue-600 p-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Tag & Header Link */}
            <div className="flex items-center space-x-2 sm:space-x-3 border-l border-slate-200 pl-2.5 sm:pl-4">
              <Link
                to="/profile"
                id="header-profile-link"
                className="text-right hidden sm:block group hover:opacity-85 transition-opacity"
                title="Account Profile"
              >
                <span id="header-user-display" className="block text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {user?.display_name || user?.email}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {user?.display_name ? user?.email : user?.name}
                </span>
              </Link>
              <Link
                to="/profile"
                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors sm:hidden"
                title="Profile"
              >
                <UserIcon className="w-4 h-4" />
              </Link>
              <span
                id="user-role-badge"
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${
                  user?.role === 'admin'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {user?.role}
              </span>
              <button
                id="logout-button"
                onClick={handleLogout}
                className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Drawer Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-4 space-y-2 shadow-lg animate-in slide-in-from-top duration-150">
            <div className="py-2 px-1 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                  {(user?.display_name || user?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-900">{user?.display_name || user?.name}</span>
                  <span className="block text-[11px] text-slate-500">{user?.email}</span>
                </div>
              </div>
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${
                  user?.role === 'admin'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {user?.role}
              </span>
            </div>

            <div className="space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon
                const isActive = location.pathname.startsWith(link.to)
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                )
              })}
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/profile'
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>Account Profile</span>
              </Link>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleLogout()
                }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 w-full pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-center justify-around h-16 shadow-lg">
        {navLinks.slice(0, 4).map((link) => {
          const Icon = link.icon
          const isActive = location.pathname.startsWith(link.to)
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="truncate">{link.label}</span>
            </Link>
          )
        })}
        <Link
          to="/profile"
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors ${
            location.pathname === '/profile' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <UserIcon className={`w-5 h-5 mb-0.5 ${location.pathname === '/profile' ? 'text-blue-600' : 'text-slate-400'}`} />
          <span>Profile</span>
        </Link>
      </nav>

      <footer className="hidden md:block border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        SA Marine Consultancy &copy; {new Date().getFullYear()} — Internal Management System
      </footer>
    </div>
  )
}
