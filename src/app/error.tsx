'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0d0f14', color: '#f0f2f7', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100dvh', gap: 16, textAlign: 'center', padding: 24,
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ color: '#8b92a8', fontSize: '0.9375rem', margin: 0, maxWidth: 380, lineHeight: 1.6 }}>
            An unexpected error occurred. Your data is safe.
          </p>
          {error.message && (
            <code style={{
              background: '#1e2330', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '8px 14px',
              fontSize: '0.8125rem', color: '#93c5fd', maxWidth: 420, wordBreak: 'break-word',
            }}>
              {error.message}
            </code>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={reset}
              style={{
                padding: '8px 20px', borderRadius: 8, fontSize: '0.9375rem',
                background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500,
              }}
            >
              Try again
            </button>
            <a
              href="/office"
              style={{
                padding: '8px 20px', borderRadius: 8, fontSize: '0.9375rem',
                background: '#1e2330', color: '#8b92a8',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer', fontWeight: 500, textDecoration: 'none',
              }}
            >
              Back to Office
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
