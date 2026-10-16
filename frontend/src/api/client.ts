const DEFAULT_API_URL = 'https://sa-marine-consultancy.onrender.com'
const BACKEND_URL = (import.meta.env.VITE_API_URL ?? (import.meta.env.MODE === 'test' ? '' : DEFAULT_API_URL)).replace(/\/+$/, '')
const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : '/api'

export class ApiError extends Error {
  status: number
  data: any

  constructor(status: number, message: string, data?: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Ensures httpOnly cookies are always attached
  }

  let response = await fetch(url, config)

  // Handle 401 and try refresh once if not on login or refresh endpoint
  if (response.status === 401 && !url.includes('/iam/login') && !url.includes('/iam/refresh')) {
    try {
      const refreshRes = await fetch(`${API_BASE}/iam/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (refreshRes.ok) {
        // Retry original request
        response = await fetch(url, config)
      }
    } catch {
      // Refresh failed; proceed with original 401
    }
  }

  if (!response.ok) {
    let errorData = null
    let errorMsg = `Request failed with status ${response.status}`
    try {
      errorData = await response.json()
      if (errorData?.detail) {
        errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail)
      }
    } catch {
      // Non-JSON response
    }
    throw new ApiError(response.status, errorMsg, errorData)
  }

  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { method: 'GET', ...options }),
  post: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined, ...options }),
  patch: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, ...options }),
  put: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, ...options }),
  delete: <T>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { method: 'DELETE', ...options }),
}
