import type {} from '~/types/electron'

const BASE_URL = 'http://localhost:3001'

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

export function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  if (isElectron()) {
    return window.electronAPI!.get(path, params)
  }
  const query = params ? '?' + new URLSearchParams(params).toString() : ''
  return request<T>(`${path}${query}`)
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  if (isElectron()) {
    return window.electronAPI!.post(path, body)
  }
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  if (isElectron()) {
    return window.electronAPI!.patch(path, body)
  }
  return request<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function apiDelete<T = void>(path: string): Promise<T> {
  if (isElectron()) {
    return window.electronAPI!.del(path)
  }
  return request<T>(path, { method: 'DELETE' })
}
