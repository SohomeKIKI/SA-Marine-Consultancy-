import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { StudentDetailPage } from '../features/students/StudentDetailPage'
import * as AuthContextModule from '../auth/AuthContext'
import { api } from '../api/client'

describe('Payment Panel Role-Based Controls', () => {
  const mockStudent = {
    id: 1,
    student_number: 'STU-2026-000001',
    batch_college_id: 1,
    batch_name: 'January 2026',
    college_name: 'Maritime Academy',
    name: 'Test Student',
    course: 'GP_RATING',
    total_required: '150000.00',
    total_paid: '50000.00',
    total_due: '100000.00',
    custom_data: {},
    created_by: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const mockPayments = [
    {
      id: 101,
      student_id: 1,
      amount: '50000.00',
      payment_date: new Date().toISOString(),
      mode: 'CASH',
      online_account: null,
      recorded_by: 1,
      created_at: new Date().toISOString(),
    },
  ]

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/students/1']}>
          <Routes>
            <Route path="/students/:id" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('renders Add Payment for Employee, but hides Edit and Delete payment controls', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
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
    })

    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/students/1') return mockStudent
      if (url === '/payments/students/1') return mockPayments
      return null
    })

    const Wrapper = createWrapper()
    render(<StudentDetailPage />, { wrapper: Wrapper })

    // Wait for student details to load
    expect(await screen.findByText('Test Student')).toBeInTheDocument()

    // Add Payment button MUST be visible for employee
    expect(screen.getByRole('button', { name: /add payment/i })).toBeInTheDocument()

    // Edit and Delete buttons for payments MUST NOT be present for employee
    expect(screen.queryByTitle(/edit payment \(admin only\)/i)).not.toBeInTheDocument()
    expect(screen.queryByTitle(/delete payment \(admin only\)/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete student/i })).not.toBeInTheDocument()
  })

  it('renders Add Payment, Edit Payment, and Delete Payment controls for Admin', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
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
    })

    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/students/1') return mockStudent
      if (url === '/payments/students/1') return mockPayments
      return null
    })

    const Wrapper = createWrapper()
    render(<StudentDetailPage />, { wrapper: Wrapper })

    expect(await screen.findByText('Test Student')).toBeInTheDocument()

    // Add Payment button MUST be visible for admin
    expect(screen.getByRole('button', { name: /add payment/i })).toBeInTheDocument()

    // Edit and Delete payment buttons MUST be visible for admin
    expect(screen.getByTitle(/edit payment \(admin only\)/i)).toBeInTheDocument()
    expect(screen.getByTitle(/delete payment \(admin only\)/i)).toBeInTheDocument()

    // Delete Student button MUST also be visible for admin
    expect(screen.getByRole('button', { name: /delete student/i })).toBeInTheDocument()
  })
})
