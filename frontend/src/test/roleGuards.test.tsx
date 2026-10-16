import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthContext, RequireAuth, RequireAdmin, AuthContextType } from '../auth/AuthContext'

describe('Role Guards', () => {
  it('RequireAuth redirects unauthenticated user to /login', () => {
    const mockContext: AuthContextType = {
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    }

    render(
      <AuthContext.Provider value={mockContext}>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/login" element={<div>Login Page Screen</div>} />
            <Route
              path="/protected"
              element={
                <RequireAuth>
                  <div>Protected Content</div>
                </RequireAuth>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByText('Login Page Screen')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('RequireAdmin displays Access Denied when user is an employee', () => {
    const mockContext: AuthContextType = {
      user: {
        id: 2,
        name: 'Employee User',
        email: 'emp@test.com',
        role: 'employee',
        is_active: true,
        created_at: new Date().toISOString(),
      },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    }

    render(
      <AuthContext.Provider value={mockContext}>
        <MemoryRouter initialEntries={['/audit']}>
          <Routes>
            <Route
              path="/audit"
              element={
                <RequireAdmin>
                  <div>Admin Secret Audit Logs</div>
                </RequireAdmin>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('Admin Secret Audit Logs')).not.toBeInTheDocument()
  })

  it('RequireAdmin renders protected content when user is an admin', () => {
    const mockContext: AuthContextType = {
      user: {
        id: 1,
        name: 'Admin User',
        email: 'admin@test.com',
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
      },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    }

    render(
      <AuthContext.Provider value={mockContext}>
        <MemoryRouter initialEntries={['/audit']}>
          <Routes>
            <Route
              path="/audit"
              element={
                <RequireAdmin>
                  <div>Admin Secret Audit Logs</div>
                </RequireAdmin>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByText('Admin Secret Audit Logs')).toBeInTheDocument()
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument()
  })
})
