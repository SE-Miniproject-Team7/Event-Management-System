
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const code = error.response?.data?.error?.code
    const requestUrl = error.config?.url || ''

    const excludedEndpoints = [
      '/auth/login',
      '/auth/me',
      '/auth/logout',
    ]

    const isExcludedEndpoint = excludedEndpoints.some(
      (endpoint) =>
        requestUrl === endpoint ||
        requestUrl.startsWith(`${endpoint}?`),
    )

    if (
      status === 401 &&
      code === 'UNAUTHENTICATED' &&
      !isExcludedEndpoint
    ) {
      window.dispatchEvent(new Event('ems:unauthenticated'))
    }

    return Promise.reject(error)
  },
)

export default api
