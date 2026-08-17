'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 200,
          gap: 12,
          padding: 24,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 36 }}>⚠️</div>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: '1rem' }}>
            Something went wrong
          </div>
          <div style={{
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            maxWidth: 320,
            lineHeight: 1.5,
            fontFamily: 'monospace',
            background: 'var(--bg-overlay)',
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
          }}>
            {this.state.error?.message ?? 'Unknown error'}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={this.reset}
            style={{ marginTop: 4 }}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
