import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react'
import { api } from '../../api/client'
import { AuditLog } from '../../types'

interface PaginatedAuditLogs {
  items: AuditLog[]
  total: number
  page: number
  limit: number
  pages: number
}

export const AuditLogPage: React.FC = () => {
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [filterAction, setFilterAction] = useState('')
  const [filterEntityType, setFilterEntityType] = useState('')
  const [filterEntityId, setFilterEntityId] = useState('')
  const [filterUserId, setFilterUserId] = useState('')

  // Build query
  const queryParts = [`page=${page}`, `limit=${limit}`]
  if (filterAction) queryParts.push(`action=${encodeURIComponent(filterAction)}`)
  if (filterEntityType) queryParts.push(`entity_type=${encodeURIComponent(filterEntityType)}`)
  if (filterEntityId.trim()) queryParts.push(`entity_id=${encodeURIComponent(filterEntityId.trim())}`)
  if (filterUserId.trim()) queryParts.push(`user_id=${encodeURIComponent(filterUserId.trim())}`)
  const queryString = `?${queryParts.join('&')}`

  const { data: logData, isLoading, error, refetch } = useQuery<PaginatedAuditLogs>({
    queryKey: ['audit-logs', queryString],
    queryFn: () => api.get(`/audit/logs${queryString}`),
  })

  const resetFilters = () => {
    setFilterAction('')
    setFilterEntityType('')
    setFilterEntityId('')
    setFilterUserId('')
    setPage(1)
  }

  const actions = ['create', 'update', 'delete', 'view', 'link', 'unlink', 'login', 'logout']
  const entityTypes = ['student', 'payment', 'batch', 'college', 'batch_college', 'user']

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audit Logs</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
              Admin Only
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Immutable, append-only security and mutation records across all CRM entities.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
        <select
          id="audit-filter-action"
          value={filterAction}
          onChange={(e) => {
            setFilterAction(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-auto px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white"
        >
          <option value="">All Actions</option>
          {actions.map((act) => (
            <option key={act} value={act}>
              {act.toUpperCase()}
            </option>
          ))}
        </select>

        <select
          id="audit-filter-entity-type"
          value={filterEntityType}
          onChange={(e) => {
            setFilterEntityType(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-auto px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600 bg-white"
        >
          <option value="">All Entities</option>
          {entityTypes.map((ent) => (
            <option key={ent} value={ent}>
              {ent.toUpperCase()}
            </option>
          ))}
        </select>

        <input
          id="audit-filter-entity-id"
          type="text"
          placeholder="Filter by Entity ID..."
          value={filterEntityId}
          onChange={(e) => {
            setFilterEntityId(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-40 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
        />

        <input
          id="audit-filter-user-id"
          type="number"
          placeholder="Filter by User ID..."
          value={filterUserId}
          onChange={(e) => {
            setFilterUserId(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-36 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
        />

        {(filterAction || filterEntityType || filterEntityId || filterUserId) && (
          <button
            onClick={resetFilters}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 text-center sm:text-left"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Audit Log Table */}
      {isLoading ? (
        <div className="py-20 flex justify-center items-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load audit logs. Please try again.
        </div>
      ) : !logData || logData.items.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
          <ShieldAlert className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">No audit logs found</h3>
          <p className="text-sm text-slate-500 mt-1">Try clearing your search filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50/75 uppercase tracking-wider font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3.5 whitespace-nowrap">Timestamp</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">User</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Action</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Target</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Field</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Delta (Old &rarr; New)</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logData.items.map((log) => {
                  const isChange = log.old_value !== null || log.new_value !== null
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-800 whitespace-nowrap">
                        {log.user_id ? `User #${log.user_id}` : 'System / Anonymous'}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                            log.action === 'create'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.action === 'update'
                              ? 'bg-blue-100 text-blue-800'
                              : log.action === 'delete'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-900">{log.entity_type || '—'}</span>
                        {log.entity_id && (
                          <span className="text-slate-400 font-mono text-[11px] ml-1">
                            #{log.entity_id}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-600 whitespace-nowrap">
                        {log.field || '—'}
                      </td>
                      <td className="px-5 py-3 max-w-xs truncate whitespace-nowrap">
                        {isChange ? (
                          <span className="font-mono text-[11px]">
                            <span className="text-red-600 line-through mr-1">{log.old_value || 'null'}</span>
                            <span className="text-slate-400">&rarr;</span>
                            <span className="text-emerald-600 ml-1 font-semibold">{log.new_value || 'null'}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                        {log.ip_address || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <span className="text-xs text-slate-500 text-center sm:text-left">
              Showing page <span className="font-semibold text-slate-900">{logData.page}</span> of{' '}
              <span className="font-semibold text-slate-900">{logData.pages}</span> ({logData.total} records)
            </span>

            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= logData.pages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
