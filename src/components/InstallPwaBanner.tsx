import { useState, useEffect } from 'react';
import { Download, X, Share, Plus, Sparkles } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore';

const SNOOZE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export default function InstallPwaBanner() {
  const location = useLocation();
  const { deferredPrompt, setDeferredPrompt, authUser } = useAppStore();
  const [isVisible, setIsVisible] = useState(false);
  const [hasAutoDismissed, setHasAutoDismissed] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [platform] = useState<'android' | 'ios' | 'other' | null>(() => {
    if (typeof window === 'undefined') return null;
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (/android/.test(userAgent)) return 'android';
    return 'other';
  });

  // Reset hasAutoDismissed when leaving the dashboard, so if they return they see it again.
  useEffect(() => {
    if (location.pathname !== '/app/home') {
      const timer = setTimeout(() => {
        setHasAutoDismissed(false);
        setIsVisible(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  // 10-second auto-dismiss timer
  useEffect(() => {
    if (!isVisible) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
      setHasAutoDismissed(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, [isVisible]);

  useEffect(() => {
    // Only display if user is on '/app/home' and is fully onboarded (has sectionId)
    if (location.pathname !== '/app/home' || !authUser?.sectionId) {
      const timer = setTimeout(() => setIsVisible(false), 0);
      return () => clearTimeout(timer);
    }

    // If already auto-dismissed this entry, do not show
    if (hasAutoDismissed) {
      const timer = setTimeout(() => setIsVisible(false), 0);
      return () => clearTimeout(timer);
    }

    // 1. Detect if running inside a standalone app (already installed)
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      const timer = setTimeout(() => setIsVisible(false), 0);
      return () => clearTimeout(timer);
    }

    // 2. Check if a snooze is active in localStorage
    const snoozedAt = localStorage.getItem('classhub-pwa-snoozed');
    if (snoozedAt) {
      const timeDiff = Date.now() - parseInt(snoozedAt, 10);
      if (timeDiff < SNOOZE_DURATION) {
        const timer = setTimeout(() => setIsVisible(false), 0);
        return () => clearTimeout(timer);
      }
    }

    // 3. Handle visibility
    if (platform === 'ios') {
      // For iOS, show banner after a short onboarding/loading delay (e.g. 2.5 seconds)
      const timer = setTimeout(() => setIsVisible(true), 2500);
      return () => clearTimeout(timer);
    } else if (deferredPrompt) {
      const timer = setTimeout(() => setIsVisible(true), 0);
      return () => clearTimeout(timer);
    }
  }, [deferredPrompt, location.pathname, authUser?.sectionId, hasAutoDismissed, platform]);

  // Handle dismiss (snooze banner for 7 days)
  const handleDismiss = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    localStorage.setItem('classhub-pwa-snoozed', Date.now().toString());
    setIsVisible(false);
  };

  // Handle install button click (Android/Chrome native trigger)
  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    
    // Trigger Chrome's native install prompt
    deferredPrompt.prompt();
    
    // Await decision
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsVisible(false);
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* ── Main Glassmorphic Banner ── */}
      <div 
        className="install-banner-slide"
        style={{
          position: 'fixed',
          bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          width: 'calc(100% - 32px)',
          maxWidth: 'calc(var(--frame-w) - 32px)',
          background: 'rgba(20, 24, 38, 0.72)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1.5px solid rgba(96, 165, 250, 0.18)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          padding: '16px',
          zIndex: 90,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Header Block */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* App Icon Circle container */}
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, #3B82F6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(96, 165, 250, 0.3)',
              flexShrink: 0
            }}>
              <Sparkles size={20} color="#fff" />
            </div>
            <div>
              <h4 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                Experience ClassHub Premium
              </h4>
              <p className="t-caption" style={{ color: 'var(--text-secondary)' }}>
                Add to your home screen for rapid load & offline features.
              </p>
            </div>
          </div>
          {/* Close Dismiss Button */}
          <button 
            onClick={handleDismiss}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-default)',
              borderRadius: '50%',
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Action Button */}
        {platform === 'ios' ? (
          <button
            onClick={() => setShowIOSInstructions(true)}
            className="t-button"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--text-primary)',
              color: 'var(--bg-base)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'opacity 0.2s',
            }}
          >
            <Download size={16} /> Get iOS App
          </button>
        ) : (
          <button
            onClick={handleAndroidInstall}
            disabled={!deferredPrompt}
            className="t-button"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(90deg, var(--accent-primary) 0%, #3b82f6 100%)',
              color: '#ffffff',
              border: 'none',
              cursor: deferredPrompt ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: deferredPrompt ? 1 : 0.6,
              transition: 'opacity 0.2s',
              boxShadow: '0 4px 12px rgba(96, 165, 250, 0.25)',
            }}
          >
            <Download size={16} /> Install Now
          </button>
        )}
      </div>

      {/* ── iOS Step-by-Step Instruction Overlay ── */}
      {showIOSInstructions && (
        <div 
          className="install-overlay-fade"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(5, 6, 10, 0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            boxSizing: 'border-box',
          }}
          onClick={() => setShowIOSInstructions(false)}
        >
          {/* Instruction Card inside root max-width */}
          <div 
            style={{
              width: '100%',
              maxWidth: '380px',
              background: 'rgba(28, 34, 54, 0.95)',
              border: '1.5px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-elevated)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title Block */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="t-feature" style={{ color: 'var(--text-primary)' }}>Install on your iOS</h3>
              <button 
                onClick={() => setShowIOSInstructions(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Instruction Lists */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Step 1 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-default)',
                  flexShrink: 0,
                  color: 'var(--accent-primary)',
                  fontWeight: 600
                }}>
                  1
                </div>
                <p className="t-body" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  Tap the Safari share button <span style={{ display: 'inline-flex', padding: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 6, color: 'var(--accent-primary)' }}><Share size={14} /></span> below.
                </p>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-default)',
                  flexShrink: 0,
                  color: 'var(--accent-primary)',
                  fontWeight: 600
                }}>
                  2
                </div>
                <p className="t-body" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  Scroll down and choose <span style={{ display: 'inline-flex', padding: '4px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: 6, color: '#fff', fontSize: '12px', fontWeight: 600, alignItems: 'center', gap: 4 }}><Plus size={12} /> Add to Home Screen</span>.
                </p>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-default)',
                  flexShrink: 0,
                  color: 'var(--accent-primary)',
                  fontWeight: 600
                }}>
                  3
                </div>
                <p className="t-body" style={{ color: 'var(--text-primary)' }}>
                  Name it "ClassHub" and tap <strong style={{ color: 'var(--accent-primary)' }}>Add</strong> in the top right.
                </p>
              </div>
            </div>

            {/* Acknowledge Button */}
            <button
              onClick={() => {
                setShowIOSInstructions(false);
                handleDismiss();
              }}
              className="t-button"
              style={{
                marginTop: 8,
                width: '100%',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(96, 165, 250, 0.2)',
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
