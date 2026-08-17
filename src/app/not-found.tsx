import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100dvh', gap: 14,
      textAlign: 'center', padding: 24,
      background: 'var(--bg-base)',
    }}>
      <div style={{ fontSize: 56, lineHeight: 1 }}>404</div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#fff', margin: 0 }}>
        Page not found
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', margin: 0 }}>
        The page you're looking for doesn't exist.
      </p>
      <Link
        href="/office"
        style={{
          marginTop: 6, padding: '8px 20px', borderRadius: 8,
          background: 'var(--accent-primary)', color: '#fff',
          textDecoration: 'none', fontWeight: 500, fontSize: '0.9375rem',
        }}
      >
        Back to Office
      </Link>
    </div>
  )
}
