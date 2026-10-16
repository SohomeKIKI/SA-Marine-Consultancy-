import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  GraduationCap,
  Plus,
  Search,
  ArrowRight,
  X,
  AlertCircle,
} from 'lucide-react'
import { api, ApiError } from '../../api/client'
import { Student, Batch, College, CourseType } from '../../types'

export const StudentsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const batchCollegeIdParam = searchParams.get('batch_college_id')
  const [selectedBatchId, setSelectedBatchId] = useState<string>('')
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Form State
  const [batchCollegeId, setBatchCollegeId] = useState<number | ''>(
    batchCollegeIdParam ? Number(batchCollegeIdParam) : ''
  )
  const [name, setName] = useState('')
  const [course, setCourse] = useState<CourseType>('GP_RATING')
  const [agentName, setAgentName] = useState('')
  const [totalRequired, setTotalRequired] = useState('')

  // Fetch batches & colleges for filtering
  const { data: batches = [] } = useQuery<Batch[]>({
    queryKey: ['batches'],
    queryFn: () => api.get('/batches'),
  })

  const { data: colleges = [] } = useQuery<College[]>({
    queryKey: ['colleges'],
    queryFn: () => api.get('/colleges'),
  })

  // Build query string
  const queryParts = []
  if (batchCollegeIdParam) queryParts.push(`batch_college_id=${batchCollegeIdParam}`)
  if (selectedBatchId) queryParts.push(`batch_id=${selectedBatchId}`)
  if (selectedCollegeId) queryParts.push(`college_id=${selectedCollegeId}`)
  if (searchQuery.trim()) queryParts.push(`search=${encodeURIComponent(searchQuery.trim())}`)
  const queryString = queryParts.length ? `?${queryParts.join('&')}` : ''

  // Fetch students
  const { data: studentsData, isLoading, error } = useQuery<{ items: Student[]; total: number }>({
    queryKey: ['students', queryString],
    queryFn: () => api.get(`/students${queryString}`),
  })

  // Create student mutation
  const createStudentMutation = useMutation({
    mutationFn: (data: any) => api.post('/students', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      setShowAddModal(false)
      setName('')
      setAgentName('')
      setTotalRequired('')
      setErrorMessage(null)
    },
    onError: (err: any) => {
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Failed to create student.')
      }
    },
  })

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!batchCollegeId) {
      setErrorMessage('Please select a batch and college assignment.')
      return
    }
    createStudentMutation.mutate({
      batch_college_id: Number(batchCollegeId),
      name: name.trim(),
      course,
      agent_name: agentName.trim() || null,
      total_required: Number(totalRequired),
      custom_data: {},
    })
  }

  const courses: CourseType[] = ['GP_RATING', 'CCMS', 'ETO', 'DNS', 'BSC', 'CHHOTI_TRAINING']

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Students</h1>
          <p className="text-sm text-slate-500">
            Enrolled student profiles, training courses, and fee schedules.
          </p>
        </div>

        <button
          id="add-student-button"
          onClick={() => {
            setErrorMessage(null)
            setShowAddModal(true)
          }}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Student</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            id="student-search-input"
            type="text"
            placeholder="Search by student name, ID (e.g. STU-2026-000001), or agent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            id="filter-batch-select"
            value={selectedBatchId}
            onChange={(e) => {
              setSelectedBatchId(e.target.value)
              if (batchCollegeIdParam) {
                searchParams.delete('batch_college_id')
                setSearchParams(searchParams)
              }
            }}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          >
            <option value="">All Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            id="filter-college-select"
            value={selectedCollegeId}
            onChange={(e) => {
              setSelectedCollegeId(e.target.value)
              if (batchCollegeIdParam) {
                searchParams.delete('batch_college_id')
                setSearchParams(searchParams)
              }
            }}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          >
            <option value="">All Colleges</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {batchCollegeIdParam && (
            <button
              onClick={() => {
                searchParams.delete('batch_college_id')
                setSearchParams(searchParams)
              }}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <span>Clear link filter</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Students Table */}
      {isLoading ? (
        <div className="py-20 flex justify-center items-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load students. Please try again.
        </div>
      ) : !studentsData || studentsData.items.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
          <GraduationCap className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">No students found</h3>
          <p className="text-sm text-slate-500 mt-1">Try adjusting your filters or click &ldquo;Add Student&rdquo;.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50/75 text-xs uppercase tracking-wider font-semibold text-slate-500">
                <tr>
                  <th className="px-6 py-3.5">Student ID &amp; Name</th>
                  <th className="px-6 py-3.5">Course</th>
                  <th className="px-6 py-3.5">Batch / College</th>
                  <th className="px-6 py-3.5 text-right">Required</th>
                  <th className="px-6 py-3.5 text-right">Paid</th>
                  <th className="px-6 py-3.5 text-right">Due</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentsData.items.map((student) => {
                  const dueNum = Number(student.total_due)
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="block font-mono text-xs font-semibold text-blue-600">
                          {student.student_number}
                        </span>
                        <span className="font-semibold text-slate-900 text-sm">{student.name}</span>
                        {student.agent_name && (
                          <span className="block text-[11px] text-slate-400">Agent: {student.agent_name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {student.course}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span className="block font-medium text-slate-800">{student.batch_name || 'N/A'}</span>
                        <span className="text-slate-500">{student.college_name || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-900">
                        ₹{Number(student.total_required).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-emerald-600">
                        ₹{Number(student.total_paid).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`font-semibold ${
                            dueNum > 0 ? 'text-amber-600' : 'text-slate-400'
                          }`}
                        >
                          ₹{dueNum.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/students/${student.id}`}
                          className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          <span>Manage</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-6 relative my-8">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-1">Add New Student</h2>
            <p className="text-xs text-slate-500 mb-5">
              The student ID will be generated automatically in sequence (e.g. STU-2026-000001).
            </p>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  id="student-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Course
                </label>
                <select
                  id="student-course-select"
                  value={course}
                  onChange={(e) => setCourse(e.target.value as CourseType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                >
                  {courses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Batch &amp; College Assignment
                </label>
                <select
                  id="student-batch-college-select"
                  value={batchCollegeId}
                  onChange={(e) => setBatchCollegeId(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">-- Select linked Batch &amp; College --</option>
                  {batches.map((b) => (
                    <optgroup key={b.id} label={b.name}>
                      {b.colleges?.map((bc) => (
                        <option key={bc.id} value={bc.id}>
                          {b.name} — {bc.college_name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Total Required Fee (₹)
                  </label>
                  <input
                    id="student-total-required-input"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={totalRequired}
                    onChange={(e) => setTotalRequired(e.target.value)}
                    placeholder="150000.00"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Agent Name (Optional)
                  </label>
                  <input
                    id="student-agent-input"
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="Direct / Agent name"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  id="student-save-submit"
                  type="submit"
                  disabled={createStudentMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {createStudentMutation.isPending ? 'Saving...' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
