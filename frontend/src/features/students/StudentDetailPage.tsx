import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CreditCard,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { Student, Payment, PaymentMode, CourseType } from '../../types'

export const StudentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const studentId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Tab & Modal States
  const [showEditStudent, setShowEditStudent] = useState(false)
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Edit Student Form State
  const [editName, setEditName] = useState('')
  const [editCourse, setEditCourse] = useState<CourseType>('GP_RATING')
  const [editAgent, setEditAgent] = useState('')
  const [editRequired, setEditRequired] = useState('')

  // Payment Form State
  const [payAmount, setPayAmount] = useState('')
  const [payMode, setPayMode] = useState<PaymentMode>('CASH')
  const [payAccount, setPayAccount] = useState('')

  // Fetch Student
  const { data: student, isLoading: studentLoading } = useQuery<Student>({
    queryKey: ['students', studentId],
    queryFn: () => api.get(`/students/${studentId}`),
    enabled: !!studentId,
  })

  // Fetch Payments for Student
  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ['payments', studentId],
    queryFn: () => api.get(`/payments/students/${studentId}`),
    enabled: !!studentId,
  })

  // Update Student Mutation
  const updateStudentMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/students/${studentId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', studentId] })
      setShowEditStudent(false)
      setSuccessMessage('Student details updated successfully.')
      setErrorMessage(null)
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to update student.')
    },
  })

  // Delete Student Mutation (Admin only)
  const deleteStudentMutation = useMutation({
    mutationFn: () => api.delete(`/students/${studentId}`),
    onSuccess: () => {
      navigate('/students')
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to delete student.')
    },
  })

  // Add Payment Mutation
  const addPaymentMutation = useMutation({
    mutationFn: (data: any) => api.post('/payments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', studentId] })
      queryClient.invalidateQueries({ queryKey: ['students', studentId] })
      setShowAddPayment(false)
      setPayAmount('')
      setPayAccount('')
      setSuccessMessage('Payment recorded successfully.')
      setErrorMessage(null)
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to record payment.')
    },
  })

  // Edit Payment Mutation (Admin only)
  const editPaymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/payments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', studentId] })
      queryClient.invalidateQueries({ queryKey: ['students', studentId] })
      setEditingPayment(null)
      setSuccessMessage('Payment updated successfully.')
      setErrorMessage(null)
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to update payment.')
    },
  })

  // Delete Payment Mutation (Admin only)
  const deletePaymentMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', studentId] })
      queryClient.invalidateQueries({ queryKey: ['students', studentId] })
      setSuccessMessage('Payment deleted successfully.')
      setErrorMessage(null)
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to delete payment.')
    },
  })

  const openEditModal = () => {
    if (!student) return
    setEditName(student.name)
    setEditCourse(student.course)
    setEditAgent(student.agent_name || '')
    setEditRequired(String(student.total_required))
    setErrorMessage(null)
    setShowEditStudent(true)
  }

  const handleEditStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateStudentMutation.mutate({
      name: editName.trim(),
      course: editCourse,
      agent_name: editAgent.trim() || null,
      total_required: Number(editRequired),
    })
  }

  const handleAddPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (['UPI', 'CARD', 'BANK_TRANSFER'].includes(payMode) && !payAccount.trim()) {
      setErrorMessage(`Online account / reference identifier is required for ${payMode} payments.`)
      return
    }
    addPaymentMutation.mutate({
      student_id: studentId,
      amount: Number(payAmount),
      mode: payMode,
      online_account: payAccount.trim() || null,
    })
  }

  const handleUpdatePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPayment) return
    if (['UPI', 'CARD', 'BANK_TRANSFER'].includes(editingPayment.mode) && !editingPayment.online_account?.trim()) {
      setErrorMessage(`Online account / reference identifier is required for ${editingPayment.mode} payments.`)
      return
    }
    editPaymentMutation.mutate({
      id: editingPayment.id,
      data: {
        amount: Number(editingPayment.amount),
        mode: editingPayment.mode,
        online_account: editingPayment.online_account?.trim() || null,
      },
    })
  }

  if (studentLoading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl">
        Student record not found.
      </div>
    )
  }

  const courses: CourseType[] = ['GP_RATING', 'CCMS', 'ETO', 'DNS', 'BSC', 'CHHOTI_TRAINING']
  const paymentModes: PaymentMode[] = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/students"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md">
                {student.student_number}
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{student.name}</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Course: <span className="font-semibold text-slate-700">{student.course}</span> &bull;{' '}
              Batch: <span className="font-semibold text-slate-700">{student.batch_name || 'N/A'}</span> &bull;{' '}
              College: <span className="font-semibold text-slate-700">{student.college_name || 'N/A'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            id="edit-student-button"
            onClick={openEditModal}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Student</span>
          </button>

          {user?.role === 'admin' && (
            <button
              id="delete-student-button"
              onClick={() => {
                if (window.confirm(`Are you sure you want to permanently delete student ${student.name}?`)) {
                  deleteStudentMutation.mutate()
                }
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Student</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications / Alerts */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Payment KPI Summary Cards */}
      <div id="payment-panel-kpis" className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Total Required
          </span>
          <div className="text-2xl font-bold text-slate-900">
            ₹{Number(student.total_required).toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Scheduled tuition &amp; fees</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block mb-1">
            Total Paid
          </span>
          <div className="text-2xl font-bold text-emerald-600">
            ₹{Number(student.total_paid).toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Cumulative verified receipts</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider block mb-1">
            Total Due
          </span>
          <div className="text-2xl font-bold text-amber-600">
            ₹{Number(student.total_due).toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Calculated remaining balance</span>
        </div>
      </div>

      {/* Payment History Panel */}
      <div id="payment-panel" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-base">Payment History</h2>
            <span className="text-xs font-medium text-slate-500">({payments.length})</span>
          </div>

          <button
            id="add-payment-button"
            onClick={() => {
              setErrorMessage(null)
              setShowAddPayment(true)
            }}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Payment</span>
          </button>
        </div>

        {paymentsLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading payments...</div>
        ) : payments.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No payments recorded for this student yet. Click &ldquo;Add Payment&rdquo; to log the first instalment.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50/75 text-xs uppercase tracking-wider font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-3.5">Payment ID</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Mode</th>
                <th className="px-6 py-3.5">Online Account / Ref</th>
                <th className="px-6 py-3.5 text-right">Amount</th>
                {user?.role === 'admin' && <th className="px-6 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3.5 font-mono text-xs text-slate-600">#{p.id}</td>
                  <td className="px-6 py-3.5 text-xs text-slate-700">
                    {new Date(p.payment_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {p.mode}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-xs text-slate-600 font-mono">
                    {p.online_account || '—'}
                  </td>
                  <td className="px-6 py-3.5 text-right font-semibold text-emerald-600">
                    ₹{Number(p.amount).toLocaleString()}
                  </td>
                  {user?.role === 'admin' && (
                    <td className="px-6 py-3.5 text-right space-x-2">
                      <button
                        id={`edit-payment-${p.id}`}
                        onClick={() => {
                          setEditingPayment(p)
                          setErrorMessage(null)
                        }}
                        className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Edit Payment (Admin Only)"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`delete-payment-${p.id}`}
                        onClick={() => {
                          if (window.confirm(`Delete payment #${p.id} of ₹${p.amount}?`)) {
                            deletePaymentMutation.mutate(p.id)
                          }
                        }}
                        className="p-1 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete Payment (Admin Only)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Student Modal */}
      {showEditStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowEditStudent(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-1">Edit Student</h2>
            <p className="text-xs text-slate-500 mb-5">
              Updates to student details create field-level audit entries. Employee edits automatically notify administrators.
            </p>

            <form onSubmit={handleEditStudentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Course
                </label>
                <select
                  value={editCourse}
                  onChange={(e) => setEditCourse(e.target.value as CourseType)}
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
                  Total Required (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editRequired}
                  onChange={(e) => setEditRequired(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={editAgent}
                  onChange={(e) => setEditAgent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditStudent(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateStudentMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateStudentMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowAddPayment(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-1">Record New Payment</h2>
            <p className="text-xs text-slate-500 mb-5">
              Amount must be greater than 0. Online account is required for UPI, Card, and Bank Transfer.
            </p>

            <form onSubmit={handleAddPaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Amount (₹)
                </label>
                <input
                  id="payment-amount-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="50000.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Mode
                </label>
                <select
                  id="payment-mode-select"
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as PaymentMode)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                >
                  {paymentModes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {['UPI', 'CARD', 'BANK_TRANSFER'].includes(payMode) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Online Account / Reference Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="payment-account-input"
                    type="text"
                    required
                    placeholder="e.g. HDFC_UPI_REF_98124"
                    value={payAccount}
                    onChange={(e) => setPayAccount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddPayment(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  id="payment-save-submit"
                  type="submit"
                  disabled={addPaymentMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {addPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Payment Modal (Admin Only) */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 relative">
            <button
              onClick={() => setEditingPayment(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-1">Edit Payment #{editingPayment.id}</h2>
            <p className="text-xs text-slate-500 mb-5">
              Administrator modification. Every edited field is recorded in the immutable audit log.
            </p>

            <form onSubmit={handleUpdatePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={editingPayment.amount}
                  onChange={(e) =>
                    setEditingPayment({ ...editingPayment, amount: Number(e.target.value) })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Mode
                </label>
                <select
                  value={editingPayment.mode}
                  onChange={(e) =>
                    setEditingPayment({ ...editingPayment, mode: e.target.value as PaymentMode })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                >
                  {paymentModes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {['UPI', 'CARD', 'BANK_TRANSFER'].includes(editingPayment.mode) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Online Account / Reference Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPayment.online_account || ''}
                    onChange={(e) =>
                      setEditingPayment({ ...editingPayment, online_account: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editPaymentMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {editPaymentMutation.isPending ? 'Saving...' : 'Update Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
