'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: '#ef4444' }}>
          <h2>Component Error</h2>
          <p style={{ fontSize: 14, marginTop: 10 }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>
            <summary>Stack trace</summary>
            {this.state.error?.stack}
          </details>
        </div>
      )
    }

    return this.props.children
  }
}