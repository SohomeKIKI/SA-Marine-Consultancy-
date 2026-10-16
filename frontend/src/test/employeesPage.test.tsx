import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext, RequireAdmin, AuthContextType } from '../auth/AuthContext'
import { EmployeesPage } from '../features/employees/EmployeesPage'
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

describe('Employees Page & Admin Guard', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  it('blocks employee from accessing /employees with Access Denied', () => {
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
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockContext}>
          <MemoryRouter initialEntries={['/employees']}>
            <Routes>
              <Route
                path="/employees"
                element={
                  <RequireAdmin>
                    <EmployeesPage />
                  </RequireAdmin>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    )

    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('Employees & Accounts')).not.toBeInTheDocument()
  })

  it('renders employees directory and management controls for admin', async () => {
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

    vi.mocked(api.get).mockResolvedValue({
      items: [
        {
          id: 1,
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'admin',
          is_active: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          name: 'Priya Sharma',
          email: 'priya@test.com',
          role: 'employee',
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ],
      total: 2,
      page: 1,
      limit: 10,
      pages: 1,
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockContext}>
          <MemoryRouter initialEntries={['/employees']}>
            <Routes>
              <Route
                path="/employees"
                element={
                  <RequireAdmin>
                    <EmployeesPage />
                  </RequireAdmin>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    )

    expect(screen.getByText('Employees & Accounts')).toBeInTheDocument()
    expect(screen.getByText('Add Employee')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search by name or email...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument()
      expect(screen.getByText('priya@test.com')).toBeInTheDocument()
    })
  })
})
