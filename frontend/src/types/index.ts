export type UserRole = 'admin' | 'employee'

export interface User {
  id: number
  name: string
  email: string
  display_name?: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

export type CourseType = 'GP_RATING' | 'CCMS' | 'ETO' | 'DNS' | 'BSC' | 'CHHOTI_TRAINING'

export type PaymentMode = 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER'

export interface BatchCollegeLink {
  id: number
  batch_id: number
  college_id: number
  college_name: string
  college_is_active: boolean
  added_by: number
  added_at: string
  student_count: number
}

export interface Batch {
  id: number
  name: string
  month: number
  year: number
  created_by: number
  created_at: string
  colleges?: BatchCollegeLink[]
}

export interface College {
  id: number
  name: string
  is_active: boolean
  created_by: number
  created_at: string
}

export interface Student {
  id: number
  student_number: string
  batch_college_id: number
  batch_id?: number
  batch_name?: string
  college_id?: number
  college_name?: string
  name: string
  course: CourseType
  agent_name?: string
  total_required: string | number
  total_paid: string | number
  total_due: string | number
  custom_data: Record<string, any>
  created_by: number
  created_at: string
  updated_at: string
}

export interface Payment {
  id: number
  student_id: number
  amount: string | number
  payment_date: string
  mode: PaymentMode
  online_account?: string
  recorded_by: number
  created_at: string
}

export interface StudentTotals {
  student_id: number
  student_number: string
  total_required: string | number
  total_paid: string | number
  total_due: string | number
}

export interface AuditLog {
  id: number
  timestamp: string
  user_id?: number
  action: string
  entity_type?: string
  entity_id?: string
  field?: string
  old_value?: string
  new_value?: string
  ip_address?: string
  user_agent?: string
}

export interface Notification {
  id: number
  recipient_id: number
  message: string
  entity_type?: string
  entity_id?: string
  is_read: boolean
  created_at: string
}

export interface PaginatedUsers {
  items: User[]
  total: number
  page: number
  limit: number
  pages: number
}
