'use client'

import { useState, useCallback, createContext, useContext, type ReactNode } from 'react'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx.confirm
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ ...options, resolve })
    })
  }, [])

  function handleResolve(value: boolean) {
    state?.resolve(value)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          className="dialog-overlay"
          onClick={() => handleResolve(false)}
          style={{ zIndex: 100 }}
        >
          <div
            className="dialog-panel"
            style={{ maxWidth: 380 }}
            onClick={e => e.stopPropagation()}
          >
            {state.title && (
              <h3 style={{ margin: '0 0 8px', fontWeight: 700, color: '#fff', fontSize: '1rem' }}>
                {state.title}
              </h3>
            )}
            <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {state.message}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost btn-md"
                onClick={() => handleResolve(false)}
                style={{ flex: 1 }}
              >
                {state.cancelLabel ?? 'Cancel'}
              </button>
              <button
                className={`btn btn-md ${state.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => handleResolve(true)}
                style={{ flex: 1 }}
                autoFocus
              >
                {state.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
