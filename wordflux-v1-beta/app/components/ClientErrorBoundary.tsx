'use client';
import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ClientErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Workspace error caught by boundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: 16, 
          margin: 16, 
          border: '1px solid #ef4444', 
          borderRadius: 8,
          backgroundColor: '#fef2f2' 
        }}>
          <h3 style={{ color: '#dc2626', margin: '0 0 8px 0' }}>Board failed to render</h3>
          <p style={{ color: '#7f1d1d', fontSize: 14, margin: '0 0 8px 0' }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <details style={{ fontSize: 12, color: '#991b1b' }}>
            <summary style={{ cursor: 'pointer', marginBottom: 8 }}>Stack trace</summary>
            <pre style={{ 
              overflow: 'auto', 
              padding: 8, 
              backgroundColor: '#fee2e2',
              borderRadius: 4,
              fontSize: 11
            }}>
              {this.state.error?.stack}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 12,
              padding: '6px 12px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}