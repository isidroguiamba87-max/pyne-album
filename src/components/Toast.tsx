import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Kind = 'success' | 'error' | 'info'
interface ToastMsg {
  id: number
  text: string
  kind: Kind
}

const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {})

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([])

  const push = useCallback((text: string, kind: Kind = 'info') => {
    const id = ++seq
    setItems((xs) => [...xs, { id, text, kind }])
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4500)
  }, [])

  return (
    <Ctx.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
        role="status"
        aria-live="polite"
      >
        {items.map((m) => (
          <div
            key={m.id}
            className={`animate-pop-in pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-2xl ${
              m.kind === 'success'
                ? 'bg-gold text-navy'
                : m.kind === 'error'
                  ? 'bg-red text-white'
                  : 'bg-white text-navy'
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  return useContext(Ctx)
}
