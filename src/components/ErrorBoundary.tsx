import React, { type ErrorInfo } from 'react';
import { reportAutomatedCrash } from '../lib/crashTelemetry';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  variant?: 'app' | 'page';
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const isPage = this.props.variant === 'page';
    console.error(`[ErrorBoundary] Caught render lifecycle crash (${this.props.variant || 'app'}):`, error);

    // 1. Silent backend dispatch of automated crash telemetry
    reportAutomatedCrash({
      title: `${isPage ? 'Page' : 'App'} Crash: ${error.name}: ${error.message}`,
      error,
      componentStack: info.componentStack || undefined,
    });
  }

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isPage = this.props.variant === 'page';

      if (isPage) {
        // Page-level localized glassmorphic fallback card
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            width: '100%',
            minHeight: '60dvh', // fit cleanly inside route shells
            boxSizing: 'border-box',
          }}>
            <div className="card" style={{
              maxWidth: 320,
              width: '100%',
              textAlign: 'center',
              background: '#13131C', // var(--bg-card)
              border: '1px dashed rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md, 12px)',
              padding: '24px 20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
              animation: 'popIn 0.3s ease both',
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(244, 63, 94, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <ShieldAlert size={20} color="#FB7185" />
              </div>

              <h3 className="t-subtitle" style={{
                color: '#F0F0FF',
                fontWeight: 600,
                fontSize: '14px',
                margin: '0 0 6px',
              }}>
                View Render Anomaly
              </h3>

              <p className="t-mono-sm" style={{
                color: '#9090B8',
                fontSize: '11px',
                lineHeight: 1.5,
                margin: '0 0 18px',
              }}>
                This feature encountered an unhandled render crash. Telemetry diagnostics have been sent. Try reloading the tab or switching navigation routes.
              </p>

              <button
                onClick={this.handleRefresh}
                className="btn-secondary"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  minHeight: 40,
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={12} /> Reload This View
              </button>
            </div>
          </div>
        );
      }

      // App-Level Full Screen Fallback (Ultimate shell defense)
      return (
        <div style={{
          minHeight: '100dvh',
          background: '#0A0A0F', // var(--bg-app)
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          boxSizing: 'border-box',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div className="card" style={{
            maxWidth: 360,
            width: '100%',
            textAlign: 'center',
            background: '#13131C', // var(--bg-card)
            border: '1px solid var(--border-default, #2A2A40)',
            borderRadius: 'var(--radius-md, 12px)',
            padding: '32px 24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            animation: 'popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 0 20px rgba(244, 63, 94, 0.15)',
            }}>
              <ShieldAlert size={26} color="#FB7185" />
            </div>

            <h2 className="t-feature" style={{
              color: '#F0F0FF',
              fontSize: '18px',
              fontWeight: 600,
              margin: '0 0 10px',
              letterSpacing: '-0.02em',
            }}>
              Unexpected Anomaly Detected
            </h2>

            <p className="t-body" style={{
              color: '#9090B8',
              fontSize: '13px',
              lineHeight: 1.5,
              margin: '0 0 24px',
            }}>
              Application crashed during rendering. A telemetry diagnosis report has been automatically dispatched to our development team.
            </p>

            <button
              onClick={this.handleRefresh}
              className="btn-primary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 44,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={15} /> Refresh Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
