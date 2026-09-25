// localStorage seguro (modo privado / bloqueado não rebenta a app)

export function getItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function setItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* ignorar */
  }
}

export function getJSON<T>(key: string, fallback: T): T {
  const raw = getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function setJSON(key: string, value: unknown) {
  setItem(key, JSON.stringify(value))
}
