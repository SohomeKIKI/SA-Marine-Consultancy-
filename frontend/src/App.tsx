import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, RequireAuth, RequireAdmin } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { LoginPage } from './features/auth/LoginPage'
import { BatchesPage } from './features/batches/BatchesPage'
import { BatchDetailPage } from './features/batches/BatchDetailPage'
import { CollegesPage } from './features/colleges/CollegesPage'
import { StudentsPage } from './features/students/StudentsPage'
import { StudentDetailPage } from './features/students/StudentDetailPage'
import { AuditLogPage } from './features/audit/AuditLogPage'
import { EmployeesPage } from './features/employees/EmployeesPage'
import { ProfilePage } from './features/profile/ProfilePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Authenticated routes */}
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route path="/" element={<Navigate to="/batches" replace />} />
              <Route path="/batches" element={<BatchesPage />} />
              <Route path="/batches/:id" element={<BatchDetailPage />} />
              <Route path="/colleges" element={<CollegesPage />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/students/:id" element={<StudentDetailPage />} />
              <Route path="/profile" element={<ProfilePage />} />

              {/* Admin-only routes */}
              <Route
                path="/employees"
                element={
                  <RequireAdmin>
                    <EmployeesPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/audit"
                element={
                  <RequireAdmin>
                    <AuditLogPage />
                  </RequireAdmin>
                }
              />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/batches" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
