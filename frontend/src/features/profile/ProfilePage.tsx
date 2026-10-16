import React, { useState } from 'react'
import { User as UserIcon, Shield, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { api, ApiError } from '../../api/client'
import { User } from '../../types'

export const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth()

  // Display Name state
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSuccess, setNameSuccess] = useState('')
  const [nameError, setNameError] = useState('')

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Sync if user changes
  React.useEffect(() => {
    if (user?.display_name !== undefined) {
      setDisplayName(user.display_name || '')
    }
  }, [user?.display_name])

  const handleUpdateDisplayName = async (e: React.FormEvent) => {
    e.preventDefault()
    setNameSaving(true)
    setNameSuccess('')
    setNameError('')

    try {
      const trimmed = displayName.trim()
      await api.patch<User>('/me', {
        display_name: trimmed === '' ? null : trimmed,
      })
      await refreshUser()
      setNameSuccess('Display name successfully updated.')
      setTimeout(() => setNameSuccess(''), 4000)
    } catch (err: any) {
      if (err instanceof ApiError) {
        setNameError(err.message)
      } else {
        setNameError('Failed to update display name.')
      }
    } finally {
      setNameSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordSaving(true)
    setPasswordSuccess('')
    setPasswordError('')

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.')
      setPasswordSaving(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      setPasswordSaving(false)
      return
    }

    try {
      await api.post<{ message: string }>('/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      setPasswordSuccess('Password successfully updated. All other active sessions have been revoked.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(''), 5000)
    } catch (err: any) {
      if (err instanceof ApiError) {
        setPasswordError(err.message)
      } else {
        setPasswordError('Failed to change password.')
      }
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your personal display name and secure authentication credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Summary Card */}
        <div className="md:col-span-1 bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4 self-start">
          <div className="flex flex-col items-center text-center space-y-3 pb-4 border-b border-slate-100">
            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl shadow-inner">
              {(user?.display_name || user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 id="profile-summary-name" className="text-base font-bold text-slate-900">
                {user?.display_name || user?.name}
              </h2>
              <p id="profile-summary-email" className="text-xs text-slate-500">
                {user?.email}
              </p>
            </div>
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${
                user?.role === 'admin'
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}
            >
              {user?.role}
            </span>
          </div>

          <div className="text-xs space-y-2 text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Account ID:</span>
              <span className="font-semibold text-slate-800">#{user?.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Full Name:</span>
              <span className="font-semibold text-slate-800">{user?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Status:</span>
              <span className="font-semibold text-emerald-600">Active</span>
            </div>
          </div>
        </div>

        {/* Action Forms */}
        <div className="md:col-span-2 space-y-6">
          {/* Display Name Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-2">
              <UserIcon className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Display Name</h2>
            </div>

            <form onSubmit={handleUpdateDisplayName} className="p-6 space-y-4">
              {nameSuccess && (
                <div id="profile-name-success" className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-2 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{nameSuccess}</span>
                </div>
              )}

              {nameError && (
                <div id="profile-name-error" className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{nameError}</span>
                </div>
              )}

              <div>
                <label htmlFor="profile-display-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Custom Display Name
                </label>
                <input
                  id="profile-display-name-input"
                  type="text"
                  maxLength={100}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Captain Miller or Dr. Scully"
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Your display name will be shown in the header, employee lists, student edit notifications, and audit records. If left blank, your email ({user?.email}) will be shown instead.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  id="save-display-name-button"
                  type="submit"
                  disabled={nameSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
                >
                  {nameSaving ? 'Saving...' : 'Save Display Name'}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-2">
              <KeyRound className="w-4 h-4 text-purple-600" />
              <h2 className="text-sm font-bold text-slate-900">Security & Password</h2>
            </div>

            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              {passwordSuccess && (
                <div id="password-change-success" className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-2 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {passwordError && (
                <div id="password-change-error" className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div>
                <label htmlFor="current-password-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Password
                </label>
                <input
                  id="current-password-input"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new-password-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    New Password
                  </label>
                  <input
                    id="new-password-input"
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="confirm-password-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-password-input"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-lg text-amber-900 flex items-start space-x-2 text-[11px] leading-relaxed">
                <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Security Note:</strong> Changing your password will automatically invalidate all other active refresh sessions on other devices. You will stay signed in on this browser.
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  id="change-password-button"
                  type="submit"
                  disabled={passwordSaving}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
                >
                  {passwordSaving ? 'Updating...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
