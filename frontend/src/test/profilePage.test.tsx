import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, AuthContextType } from '../auth/AuthContext'
import { ProfilePage } from '../features/profile/ProfilePage'
import { api } from '../api/client'

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

describe('Profile Page', () => {
  const mockRefreshUser = vi.fn()

  const mockAdminContext: AuthContextType = {
    user: {
      id: 1,
      name: 'System Admin',
      email: 'admin@batchcrm.com',
      display_name: 'SuperAdmin',
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: mockRefreshUser,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders profile page with existing display name and email', () => {
    render(
      <AuthContext.Provider value={mockAdminContext}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByRole('heading', { name: /Account Profile/i })).toBeDefined()
    expect(screen.getByText('admin@batchcrm.com')).toBeDefined()
    const input = screen.getByLabelText(/Custom Display Name/i) as HTMLInputElement
    expect(input.value).toBe('SuperAdmin')
  })

  it('successfully updates display name and calls refreshUser', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({
      id: 1,
      name: 'System Admin',
      email: 'admin@batchcrm.com',
      display_name: 'Chief Officer',
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString(),
    })

    render(
      <AuthContext.Provider value={mockAdminContext}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    const input = screen.getByLabelText(/Custom Display Name/i)
    fireEvent.change(input, { target: { value: 'Chief Officer' } })

    const saveButton = screen.getByRole('button', { name: /Save Display Name/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/me', {
        display_name: 'Chief Officer',
      })
      expect(mockRefreshUser).toHaveBeenCalled()
      expect(screen.getByText(/Display name successfully updated/i)).toBeDefined()
    })
  })

  it('validates password minimum length of 8 characters', async () => {
    render(
      <AuthContext.Provider value={mockAdminContext}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    fireEvent.change(screen.getByLabelText(/^Current Password/i), {
      target: { value: 'OldPassword123!' },
    })
    fireEvent.change(screen.getByLabelText(/^New Password/i), {
      target: { value: 'short' },
    })
    fireEvent.change(screen.getByLabelText(/^Confirm New Password/i), {
      target: { value: 'short' },
    })

    const changeButton = screen.getByRole('button', { name: /Change Password/i })
    fireEvent.click(changeButton)

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeDefined()
      expect(api.post).not.toHaveBeenCalled()
    })
  })

  it('validates password confirmation match', async () => {
    render(
      <AuthContext.Provider value={mockAdminContext}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    fireEvent.change(screen.getByLabelText(/^Current Password/i), {
      target: { value: 'OldPassword123!' },
    })
    fireEvent.change(screen.getByLabelText(/^New Password/i), {
      target: { value: 'NewSecretPass123!' },
    })
    fireEvent.change(screen.getByLabelText(/^Confirm New Password/i), {
      target: { value: 'MismatchPass123!' },
    })

    const changeButton = screen.getByRole('button', { name: /Change Password/i })
    fireEvent.click(changeButton)

    await waitFor(() => {
      expect(screen.getByText(/confirmation do not match/i)).toBeDefined()
      expect(api.post).not.toHaveBeenCalled()
    })
  })

  it('successfully changes password and calls /me/change-password', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      message: 'Password changed successfully',
    })

    render(
      <AuthContext.Provider value={mockAdminContext}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </AuthContext.Provider>
    )

    fireEvent.change(screen.getByLabelText(/^Current Password/i), {
      target: { value: 'OldPassword123!' },
    })
    fireEvent.change(screen.getByLabelText(/^New Password/i), {
      target: { value: 'NewSecretPass123!' },
    })
    fireEvent.change(screen.getByLabelText(/^Confirm New Password/i), {
      target: { value: 'NewSecretPass123!' },
    })

    const changeButton = screen.getByRole('button', { name: /Change Password/i })
    fireEvent.click(changeButton)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/me/change-password', {
        current_password: 'OldPassword123!',
        new_password: 'NewSecretPass123!',
      })
      expect(screen.getByText(/Password successfully updated/i)).toBeDefined()
    })
  })
})
