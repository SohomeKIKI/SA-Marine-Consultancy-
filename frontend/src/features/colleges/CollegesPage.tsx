import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Ban, CheckCircle, X, AlertCircle } from 'lucide-react'
import { api, ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { College } from '../../types'

export const CollegesPage: React.FC = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [collegeName, setCollegeName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { data: colleges = [], isLoading, error } = useQuery<College[]>({
    queryKey: ['colleges', 'all'],
    queryFn: () => api.get('/colleges'),
  })

  const createCollegeMutation = useMutation({
    mutationFn: (name: string) => api.post('/colleges', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colleges'] })
      setShowCreateModal(false)
      setCollegeName('')
      setErrorMessage(null)
    },
    onError: (err: any) => {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Failed to create college.')
      }
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/colleges/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colleges'] })
    },
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!collegeName.trim()) return
    createCollegeMutation.mutate(collegeName.trim())
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Colleges</h1>
          <p className="text-sm text-slate-500">
            Directory of partner academies and maritime colleges. (Colleges are never deleted).
          </p>
        </div>

        {user?.role === 'admin' && (
          <button
            id="create-college-button"
            onClick={() => {
              setErrorMessage(null)
              setShowCreateModal(true)
            }}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create College</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center items-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load colleges. Please try again.
        </div>
      ) : colleges.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">No colleges found</h3>
          <p className="text-sm text-slate-500 mt-1">Get started by creating the first college.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50/75 text-xs uppercase tracking-wider font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3.5">College Name</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Added On</th>
                {user?.role === 'admin' && <th className="px-6 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {colleges.map((college) => (
                <tr key={college.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <span>{college.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        college.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {college.is_active ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <Ban className="w-3 h-3 text-slate-400" />
                          <span>Deactivated</span>
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {new Date(college.created_at).toLocaleDateString()}
                  </td>
                  {user?.role === 'admin' && (
                    <td className="px-6 py-4 text-right">
                      {college.is_active ? (
                        <button
                          id={`deactivate-college-${college.id}`}
                          onClick={() => deactivateMutation.mutate(college.id)}
                          disabled={deactivateMutation.isPending}
                          className="inline-flex items-center space-x-1 text-xs text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-md font-medium transition-colors"
                        >
                          <Ban className="w-3 h-3" />
                          <span>Deactivate</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Deactivated</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create College Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-1">Add New College</h2>
            <p className="text-xs text-slate-500 mb-5">
              Enter the unique name of the academy or maritime training institute.
            </p>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  College Name
                </label>
                <input
                  id="college-name-input"
                  type="text"
                  required
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  placeholder="e.g. Tolani Maritime Institute"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  id="college-save-submit"
                  type="submit"
                  disabled={!collegeName.trim() || createCollegeMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {createCollegeMutation.isPending ? 'Saving...' : 'Add College'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
