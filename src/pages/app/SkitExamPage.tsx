import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, RotateCw, AlertCircle, ExternalLink } from 'lucide-react';

export default function SkitExamPage() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrouble, setIsTrouble] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to browser network connectivity changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Manage loading timeout logic
  useEffect(() => {
    // Reset states
    setIsLoading(true);
    setIsTrouble(false);

    // If offline, do not set timeout
    if (!isOnline) {
      setIsLoading(false);
      return;
    }

    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Set 6 seconds timeout
    timerRef.current = setTimeout(() => {
      setIsTrouble(true);
    }, 6000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [refreshKey, isOnline]);

  const handleIframeLoad = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsLoading(false);
    setIsTrouble(false);
    setIsRefreshing(false);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey(prev => prev + 1);
  };

  const handleRetryConnection = () => {
    const onlineStatus = navigator.onLine;
    setIsOnline(onlineStatus);
    if (onlineStatus) {
      setRefreshKey(prev => prev + 1);
    }
  };

  return (
    <div className="page-shell" style={{ height: '100dvh', paddingBottom: 0, overflow: 'hidden' }}>
      
      {/* Slim Header */}
      <header style={{
        height: '48px',
        background: 'rgba(13, 15, 20, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 100,
        flexShrink: 0
      }}>
        {/* Left Action: Exit */}
        <button
          id="exit-skit-exam-btn"
          onClick={() => navigate('/app/profile')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: 4,
            cursor: 'pointer',
            transition: 'color var(--transition-fast)'
          }}
          aria-label="Exit Portal"
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <X size={18} />
          <span className="t-mono-sm" style={{ fontWeight: 600 }}>EXIT</span>
        </button>

        {/* Center: Title */}
        <h1 className="t-subtitle" style={{
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--text-primary)',
          margin: 0
        }}>
          SKIT Exam Portal
        </h1>

        {/* Right Action: Refresh */}
        <button
          id="refresh-skit-exam-btn"
          onClick={handleRefresh}
          disabled={!isOnline}
          style={{
            background: 'none',
            border: 'none',
            color: isOnline ? 'var(--text-secondary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
            cursor: isOnline ? 'pointer' : 'not-allowed',
            transition: 'color var(--transition-fast)'
          }}
          aria-label="Refresh Portal"
          onMouseEnter={e => {
            if (isOnline) e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={e => {
            if (isOnline) e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <RotateCw size={16} className={isRefreshing ? 'spin' : ''} />
        </button>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, position: 'relative', width: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>
        
        {/* 1. Offline Mode Render */}
        {!isOnline && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 80,
            background: 'var(--bg-base)'
          }}>
            <div className="card" style={{
              width: '100%',
              maxWidth: '380px',
              padding: '24px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--status-warning-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(251, 191, 36, 0.2)'
              }}>
                <AlertCircle size={28} color="var(--status-warning)" />
              </div>
              <div>
                <h3 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 6 }}>Portal Offline</h3>
                <p className="t-body" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  The college exam portal requires an active internet connection to load. Please check your network and retry.
                </p>
              </div>
              <button
                className="btn-primary"
                onClick={handleRetryConnection}
                style={{ width: '100%', marginTop: 8 }}
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* 2. Shimmering Skeleton Loader */}
        {isOnline && isLoading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            padding: 16,
            zIndex: 70,
            background: 'var(--bg-base)'
          }}>
            {/* Top navigation row mock */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="skeleton" style={{ width: '70px', height: '24px', borderRadius: '4px' }} />
              <div className="skeleton" style={{ width: '90px', height: '24px', borderRadius: '4px' }} />
              <div className="skeleton" style={{ width: '60px', height: '24px', borderRadius: '4px' }} />
            </div>

            {/* Banner/Hero area mock */}
            <div className="skeleton" style={{ width: '100%', height: '120px', borderRadius: 'var(--radius-lg)' }} />

            {/* Sidebar + Main layout mock */}
            <div style={{ display: 'flex', gap: 16, flex: 1 }}>
              {/* Sidebar mock (desktop style) */}
              <div className="skeleton" style={{ width: '30%', height: '200px', borderRadius: 'var(--radius-md)', display: 'none' }} />
              
              {/* Main content forms mock */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                <div className="skeleton" style={{ width: '40%', height: '16px', borderRadius: '4px' }} />
                <div className="skeleton" style={{ width: '100%', height: '44px', borderRadius: 'var(--radius-md)' }} />
                <div className="skeleton" style={{ width: '100%', height: '44px', borderRadius: 'var(--radius-md)' }} />
                <div className="skeleton" style={{ width: '30%', height: '14px', borderRadius: '4px', marginTop: 10 }} />
                <div className="skeleton" style={{ width: '100%', height: '48px', borderRadius: 'var(--radius-md)' }} />
              </div>
            </div>
          </div>
        )}

        {/* 3. Slow Connection Warning Banner */}
        {isOnline && isTrouble && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '10px 16px',
            background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.09) 0%, rgba(34, 211, 238, 0.02) 100%)',
            borderBottom: '1px solid rgba(34, 211, 238, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            zIndex: 60,
            boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
            animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}>
            <p className="t-mono-sm" style={{ color: 'var(--status-info)', flex: 1, margin: 0 }}>
              Taking longer than usual. Try opening externally?
            </p>
            <a
              href="https://skitexam.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{
                padding: '6px 12px',
                minHeight: 'auto',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                borderColor: 'rgba(34, 211, 238, 0.3)',
                color: 'var(--status-info)',
                whiteSpace: 'nowrap'
              }}
            >
              Open External <ExternalLink size={10} />
            </a>
          </div>
        )}

        {/* 4. Live Portal Webframe */}
        {isOnline && (
          <iframe
            key={refreshKey}
            src="https://skitexam.com/"
            title="SKIT College Exam Portal"
            onLoad={handleIframeLoad}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              background: '#fff',
              opacity: isLoading ? 0 : 1,
              transition: 'opacity 0.25s ease-in'
            }}
          />
        )}

      </div>
    </div>
  );
}
