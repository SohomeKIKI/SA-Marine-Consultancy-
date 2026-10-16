import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Plus,
  Trash2,
  Users,
  ArrowLeft,
  X,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import { api, ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { Batch, College } from '../../types'

export const BatchDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const batchId = Number(id)
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [showLinkModal, setShowLinkModal] = useState(false)
  const [selectedCollegeId, setSelectedCollegeId] = useState<number | ''>('')
  const [conflictError, setConflictError] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)

  // Fetch Batch Details (includes linked colleges)
  const { data: batch, isLoading, error } = useQuery<Batch>({
    queryKey: ['batches', batchId],
    queryFn: () => api.get(`/batches/${batchId}`),
    enabled: !!batchId,
  })

  // Fetch all colleges for link modal
  const { data: allColleges = [] } = useQuery<College[]>({
    queryKey: ['colleges'],
    queryFn: () => api.get('/colleges?active_only=true'),
    enabled: showLinkModal,
  })

  // Link college mutation
  const linkMutation = useMutation({
    mutationFn: (collegeId: number) =>
      api.post(`/batches/${batchId}/colleges`, { college_id: collegeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', batchId] })
      setShowLinkModal(false)
      setSelectedCollegeId('')
      setLinkError(null)
    },
    onError: (err: any) => {
      if (err instanceof ApiError) {
        setLinkError(err.message)
      } else {
        setLinkError('Failed to link college.')
      }
    },
  })

  // Unlink college mutation
  const unlinkMutation = useMutation({
    mutationFn: (collegeId: number) =>
      api.delete(`/batches/${batchId}/colleges/${collegeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', batchId] })
      setConflictError(null)
    },
    onError: (err: any) => {
      if (err instanceof ApiError) {
        setConflictError(err.message)
      } else {
        setConflictError('Failed to unlink college.')
      }
    },
  })

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !batch) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl">
        Batch not found or failed to load.
      </div>
    )
  }

  const linkedCollegeIds = new Set(batch.colleges?.map((c) => c.college_id) || [])
  const availableColleges = allColleges.filter((c) => !linkedCollegeIds.has(c.id) && c.is_active)

  return (
    <div className="space-y-6">
      <div className="flex items-start sm:items-center space-x-3 min-w-0">
        <Link
          to="/batches"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">{batch.name}</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">
              Batch #{batch.id}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Month: {batch.month} &bull; Year: {batch.year} &bull; Created on{' '}
            {new Date(batch.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {conflictError && (
        <div
          id="unlink-conflict-alert"
          className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start space-x-3"
        >
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900">Unlink Blocked (HTTP 409 Conflict)</h3>
            <p className="mt-0.5 text-xs text-amber-700">{conflictError}</p>
          </div>
          <button
            onClick={() => setConflictError(null)}
            className="text-amber-500 hover:text-amber-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Linked Colleges Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-base">Linked Colleges</h2>
            <span className="text-xs font-medium text-slate-500">
              ({batch.colleges?.length || 0})
            </span>
          </div>

          {user?.role === 'admin' && (
            <button
              id="link-college-button"
              onClick={() => {
                setLinkError(null)
                setShowLinkModal(true)
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Link College</span>
            </button>
          )}
        </div>

        {!batch.colleges || batch.colleges.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No colleges linked to this batch yet. Click &ldquo;Link College&rdquo; to add one.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {batch.colleges.map((link) => (
              <div
                key={link.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-900 text-sm">
                      {link.college_name}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        link.college_is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {link.college_is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 mt-1 text-xs text-slate-500">
                    <span className="flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{link.student_count} student(s) enrolled</span>
                    </span>
                    <span>Added on {new Date(link.added_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Link
                    to={`/students?batch_college_id=${link.id}`}
                    className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <span>View Students</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>

                  {user?.role === 'admin' && (
                    <button
                      id={`unlink-college-${link.college_id}`}
                      onClick={() => unlinkMutation.mutate(link.college_id)}
                      disabled={unlinkMutation.isPending}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Unlink college from batch"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link College Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 relative my-auto max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowLinkModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-1">Link College to {batch.name}</h2>
            <p className="text-xs text-slate-500 mb-5">
              Select an active college to associate with this batch. Deactivated colleges cannot be linked.
            </p>

            {linkError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{linkError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (selectedCollegeId) {
                  linkMutation.mutate(Number(selectedCollegeId))
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Available Active Colleges
                </label>
                {availableColleges.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">
                    No active unlinked colleges found. Create or activate a college first.
                  </p>
                ) : (
                  <select
                    id="college-select"
                    value={selectedCollegeId}
                    onChange={(e) => setSelectedCollegeId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                    required
                  >
                    <option value="">-- Select a college --</option>
                    {availableColleges.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="pt-3 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  id="link-submit-button"
                  type="submit"
                  disabled={!selectedCollegeId || linkMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {linkMutation.isPending ? 'Linking...' : 'Link College'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
