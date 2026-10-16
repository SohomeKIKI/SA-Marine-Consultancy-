import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users,
  Plus,
  Search,
  Filter,
  KeyRound,
  UserCheck,
  UserX,
  LogOut,
  Edit2,
  X,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { api, ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { User, UserRole, PaginatedUsers } from '../../types'

export const EmployeesPage: React.FC = () => {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()

  // Filters & Pagination State
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const limit = 10

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [resettingUser, setResettingUser] = useState<User | null>(null)

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    role: 'employee' as UserRole,
    password: '',
  })

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'employee' as UserRole,
  })

  const [newPassword, setNewPassword] = useState('')
  const [bannerMessage, setBannerMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  // Query: Paginated Users
  const queryParams = new URLSearchParams()
  if (search.trim()) queryParams.set('search', search.trim())
  if (roleFilter !== 'all') queryParams.set('role', roleFilter)
  if (statusFilter !== 'all') queryParams.set('is_active', statusFilter === 'active' ? 'true' : 'false')
  queryParams.set('page', page.toString())
  queryParams.set('limit', limit.toString())

  const { data, isLoading } = useQuery<PaginatedUsers>({
    queryKey: ['admin-users', search, roleFilter, statusFilter, page],
    queryFn: () => api.get(`/admin/users?${queryParams.toString()}`),
  })

  const users = data?.items || []
  const total = data?.total || 0
  const totalPages = data?.pages || 1

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newUserData: typeof createForm) => api.post('/admin/users', newUserData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setShowCreateModal(false)
      setCreateForm({ name: '', email: '', role: 'employee', password: '' })
      setBannerMessage({ type: 'success', text: 'Employee account created successfully.' })
    },
    onError: (err: any) => {
      setBannerMessage({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Failed to create user.',
      })
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof editForm }) =>
      api.patch(`/admin/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setEditingUser(null)
      setBannerMessage({ type: 'success', text: 'User details updated successfully.' })
    },
    onError: (err: any) => {
      setBannerMessage({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Failed to update user.',
      })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api.post(`/admin/users/${id}/reset-password`, { password }),
    onSuccess: () => {
      setResettingUser(null)
      setNewPassword('')
      setBannerMessage({ type: 'success', text: 'Password reset and sessions revoked successfully.' })
    },
    onError: (err: any) => {
      setBannerMessage({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Failed to reset password.',
      })
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, currentActive }: { id: number; currentActive: boolean }) => {
      const endpoint = currentActive ? `/admin/users/${id}/deactivate` : `/admin/users/${id}/activate`
      return api.post(endpoint)
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setBannerMessage({
        type: 'success',
        text: vars.currentActive ? 'Account deactivated and sessions revoked.' : 'Account activated successfully.',
      })
    },
    onError: (err: any) => {
      setBannerMessage({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Action failed.',
      })
    },
  })

  const revokeSessionsMutation = useMutation({
    mutationFn: (id: number) => api.post(`/admin/users/${id}/revoke-sessions`),
    onSuccess: () => {
      setBannerMessage({ type: 'success', text: 'All active sessions for this user have been revoked.' })
    },
    onError: (err: any) => {
      setBannerMessage({
        type: 'error',
        text: err instanceof ApiError ? err.message : 'Failed to revoke sessions.',
      })
    },
  })

  const handleOpenEdit = (user: User) => {
    setEditingUser(user)
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
    })
    setBannerMessage(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2">
            <Users className="w-6 h-6 text-blue-600" />
            <span>Employees & Accounts</span>
          </h1>
          <p className="text-sm text-slate-500">
            Create, manage, and configure system access for staff and administrators.
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true)
            setBannerMessage(null)
          }}
          className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Alert Banner */}
      {bannerMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            bannerMessage.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <div className="flex items-center space-x-2 text-sm font-medium">
            {bannerMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{bannerMessage.text}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setPage(1)
              }}
              className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="employee">Employee</option>
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading user directory...</div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">No users match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 flex items-center space-x-2">
                          <span>{u.display_name ? u.display_name : u.name}</span>
                          {isSelf && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-blue-100 text-blue-700">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center space-x-1.5">
                          <span>{u.email}</span>
                          {u.display_name && (
                            <span className="text-slate-400">({u.name})</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center space-x-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                            u.is_active
                              ? 'bg-green-50 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.is_active ? 'bg-green-500' : 'bg-slate-400'
                            }`}
                          />
                          <span>{u.is_active ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                            title="Edit User"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setResettingUser(u)
                              setNewPassword('')
                              setBannerMessage(null)
                            }}
                            className="p-1.5 rounded-md text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Reset Password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          <button
                            disabled={isSelf}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Are you sure you want to ${
                                    u.is_active ? 'deactivate' : 'activate'
                                  } ${u.name}?`
                                )
                              ) {
                                toggleActiveMutation.mutate({ id: u.id, currentActive: u.is_active })
                              }
                            }}
                            className={`p-1.5 rounded-md transition-colors ${
                              isSelf
                                ? 'opacity-30 cursor-not-allowed text-slate-400'
                                : u.is_active
                                ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                                : 'text-slate-500 hover:text-green-600 hover:bg-green-50'
                            }`}
                            title={isSelf ? 'Cannot deactivate self' : u.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {u.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>

                          <button
                            disabled={isSelf}
                            onClick={() => {
                              if (window.confirm(`Revoke all active sessions for ${u.name}?`)) {
                                revokeSessionsMutation.mutate(u.id)
                              }
                            }}
                            className={`p-1.5 rounded-md transition-colors ${
                              isSelf
                                ? 'opacity-30 cursor-not-allowed text-slate-400'
                                : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title={isSelf ? 'Cannot revoke self via this button' : 'Revoke All Sessions'}
                          >
                            <LogOut className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {users.length} of {total} accounts
            </div>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create User Dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Create Employee Account</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                createMutation.mutate(createForm)
              }}
              className="p-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  required
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="employee@company.com"
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Password <span className="text-slate-400 font-normal">(min 8 characters)</span>
                </label>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Dialog */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Edit User: {editingUser.name}</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                editMutation.mutate({ id: editingUser.id, data: editForm })
              }}
              className="p-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <select
                  disabled={editingUser.id === currentUser?.id}
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Administrator</option>
                </select>
                {editingUser.id === currentUser?.id && (
                  <p className="text-[11px] text-slate-400 mt-1">You cannot modify your own role.</p>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {editMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Dialog */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Reset Password: {resettingUser.name}</h3>
              <button
                onClick={() => setResettingUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                resetPasswordMutation.mutate({ id: resettingUser.id, password: newPassword })
              }}
              className="p-4 space-y-4"
            >
              <p className="text-xs text-slate-500 leading-relaxed">
                Setting a new password will immediately revoke all existing active refresh tokens and sessions for this user.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password <span className="text-slate-400 font-normal">(min 8 characters)</span>
                </label>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPasswordMutation.isPending}
                  className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {resetPasswordMutation.isPending ? 'Resetting...' : 'Confirm Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
