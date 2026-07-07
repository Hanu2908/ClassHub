import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Users, 
  Activity, 
  HardDrive, 
  RefreshCw, 
  Clock, 
  Mail, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  FileText,
  User,
  Bell,
  ShieldAlert,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { subscribeToPush, unsubscribeFromPush } from '../../lib/pushNotifications';

interface FeedbackReport {
  id: string;
  user_id: string | null;
  type: 'bug' | 'feature_request' | 'feedback';
  title: string;
  description: string;
  device_info: {
    userAgent: string;
    screenSize: string;
    connection: string;
    pwaInstalled: boolean;
    currentPath: string;
    timestamp: string;
    devicePixelRatio?: number;
    language?: string;
  };
  status: 'pending' | 'investigating' | 'in_progress' | 'resolved' | 'closed';
  developer_notes: string | null;
  created_at: string;
  updated_at: string;
  users?: {
    name: string;
    email: string;
    role: string;
    section_roll: string | null;
    university_roll: string | null;
  } | null;
}

export default function DeveloperConsolePage() {
  const navigate = useNavigate();
  const authUser = useAppStore(s => s.authUser);
  
  // Stats states
  const [onlineCount, setOnlineCount] = useState<number | '—'>('—');
  const [dbLatency, setDbLatency] = useState<number | '—'>('—');
  const [pinging, setPinging] = useState(false);
  const [pwaStatus, setPwaStatus] = useState<{ active: boolean; cacheCount: number }>({ active: false, cacheCount: 0 });

  // Web Push Diagnostics states
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [swRegistered, setSwRegistered] = useState(false);
  const [dbSubscribed, setDbSubscribed] = useState(false);
  const [activeEndpoint, setActiveEndpoint] = useState('');
  const [sendingTestPush, setSendingTestPush] = useState(false);

  // Bug reports state
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'bug' | 'feature_request' | 'feedback'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'resolved'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Notes state
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [updatingNotesId, setUpdatingNotesId] = useState<string | null>(null);

  // Product Analytics states & functions
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [purgingAnalytics, setPurgingAnalytics] = useState(false);

  const fetchAnalytics = async () => {
    if (!authUser?.sectionId) return;
    setLoadingAnalytics(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-analytics-summary', {
        body: { sectionId: authUser.sectionId }
      });
      if (error) throw error;
      setAnalyticsData(data);
    } catch (err: any) {
      console.error('[Analytics Error]', err);
      toast.error(err.message || 'Failed to load analytics summary');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handlePurgeStaleAnalytics = async () => {
    if (!window.confirm('Are you sure you want to purge all analytics events older than 60 days?')) return;
    setPurgingAnalytics(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-analytics-summary', {
        body: { action: 'purge' }
      });
      if (error) throw error;
      toast.success(`Successfully purged ${data.purgedCount || 0} stale events ✓`);
      if (analyticsData) {
        fetchAnalytics();
      }
    } catch (err: any) {
      console.error('[Purge Error]', err);
      toast.error(err.message || 'Failed to purge stale analytics');
    } finally {
      setPurgingAnalytics(false);
    }
  };

  useEffect(() => {
    if (analyticsExpanded && !analyticsData && !loadingAnalytics) {
      fetchAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsExpanded]);

  // 1. Supabase Presence (Online count)
  useEffect(() => {
    if (!authUser?.id) return;

    const channel = supabase.channel('global-presence', {
      config: {
        presence: {
          key: authUser.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // Count total active socket connections/sessions across all user keys
        let totalConnections = 0;
        Object.values(state).forEach((presences: any) => {
          totalConnections += presences.length;
        });
        setOnlineCount(totalConnections);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            user_name: authUser.name
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [authUser]);

  // 2. High-precision DB Latency Ping
  const pingDatabase = async () => {
    if (!authUser?.id) return;
    setPinging(true);
    const start = performance.now();
    try {
      // Primary-key index lookup on current user is highly optimized (< 1ms in Postgres)
      const { error } = await supabase
        .from('users')
        .select('id')
        .eq('id', authUser.id)
        .single();

      if (error) throw error;
      const end = performance.now();
      setDbLatency(Math.round(end - start));
    } catch (err) {
      console.error('[Ping Error]', err);
      setDbLatency('—');
      toast.error('Database latency check failed');
    } finally {
      setPinging(false);
    }
  };

  // 3. Web Push Audit
  const refreshPushDiagnostics = async () => {
    try {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setPushSupported(supported);
      if (!supported) return;

      setPushPermission(Notification.permission);

      const regs = await navigator.serviceWorker.getRegistrations();
      const activeSW = regs.find(r => !!r.active);
      setSwRegistered(!!activeSW);

      if (activeSW) {
        const sub = await activeSW.pushManager.getSubscription();
        setDbSubscribed(!!sub);
        if (sub) {
          setActiveEndpoint(sub.endpoint);
        } else {
          setActiveEndpoint('');
        }
      }
    } catch (err) {
      console.warn('Failed to audit push diagnostics:', err);
    }
  };

  const handleTestSubscribe = async () => {
    const success = await subscribeToPush();
    if (success) {
      toast.success('Successfully subscribed to Web Push!');
    } else {
      toast.error('Subscription failed. Verify notification permissions.');
    }
    refreshPushDiagnostics();
  };

  const handleTestUnsubscribe = async () => {
    await unsubscribeFromPush();
    toast.info('Successfully unsubscribed from Web Push.');
    refreshPushDiagnostics();
  };

  const handleTriggerTestPush = async () => {
    if (!authUser?.sectionId) return;
    setSendingTestPush(true);
    try {
      const { error } = await supabase.functions.invoke('send-custom-notification', {
        body: {
          title: '🚨 Dev Push Diagnosis Success',
          body: `Transmission successful! Tested by ${authUser.name} on ${new Date().toLocaleTimeString('en-IN', { timeStyle: 'short' })}`,
          sectionId: authUser.sectionId,
        },
      });

      if (error) throw error;
      toast.success('Broadcast test push triggered successfully!');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('[Test Push Error]', error);
      toast.error(error.message || 'Failed to trigger test push broadcast');
    } finally {
      setSendingTestPush(false);
    }
  };

  // 4. Service Worker Cache Integrity Audit
  useEffect(() => {
    const checkPWA = async () => {
      try {
        const isSupported = 'serviceWorker' in navigator && typeof caches !== 'undefined';
        if (!isSupported) return;
        
        const regs = await navigator.serviceWorker.getRegistrations();
        const isActive = regs.some(r => !!r.active);
        const cacheKeys = await caches.keys();
        setPwaStatus({ active: isActive, cacheCount: cacheKeys.length });
      } catch (err) {
        console.warn('PWA telemetry unavailable', err);
      }
    };
    checkPWA();
    pingDatabase();
    refreshPushDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4. Fetch Feedback Reports
  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('feedback_reports')
        .select(`
          *,
          users (
            name,
            email,
            role,
            section_roll,
            university_roll
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data as any as FeedbackReport[]);
    } catch (err: any) {
      console.error('[FetchReports Error]', err);
      toast.error(err.message || 'Failed to load feedback reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // 5. Update Report Status
  const handleUpdateStatus = async (id: string, nextStatus: FeedbackReport['status']) => {
    try {
      const { error } = await (supabase as any)
        .from('feedback_reports')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setReports(prev =>
        prev.map(r => r.id === id ? { ...r, status: nextStatus, updated_at: new Date().toISOString() } : r)
      );
      toast.success(`Status updated to ${nextStatus}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update report status');
    }
  };

  // 6. Save Private Developer Notes
  const handleSaveNotes = async (id: string) => {
    setUpdatingNotesId(id);
    try {
      const { error } = await (supabase as any)
        .from('feedback_reports')
        .update({ developer_notes: tempNotes.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setReports(prev =>
        prev.map(r => r.id === id ? { ...r, developer_notes: tempNotes.trim() || null, updated_at: new Date().toISOString() } : r)
      );
      setEditingNotesId(null);
      toast.success('Developer notes updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save notes');
    } finally {
      setUpdatingNotesId(null);
    }
  };

  // 7. Spam Purge / Delete Report
  const handleDeleteReport = async (id: string) => {
    if (!window.confirm('Are you absolutely sure you want to purge this bug report permanently?')) return;
    try {
      const { error } = await (supabase as any)
        .from('feedback_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setReports(prev => prev.filter(r => r.id !== id));
      toast.info('Report purged successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete report');
    }
  };

  // Filter logic
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesType = filterType === 'all' || r.type === filterType;
      const matchesStatus = 
        filterStatus === 'all' ||
        (filterStatus === 'open' && r.status !== 'resolved' && r.status !== 'closed') ||
        (filterStatus === 'resolved' && (r.status === 'resolved' || r.status === 'closed'));
      return matchesType && matchesStatus;
    });
  }, [reports, filterType, filterStatus]);

  // Color mapping helpers
  const getTypeBadge = (type: FeedbackReport['type']) => {
    switch (type) {
      case 'bug':
        return { label: '🐛 BUG', bg: 'rgba(244, 63, 94, 0.1)', border: 'rgba(244, 63, 94, 0.25)', text: '#FB7185' };
      case 'feature_request':
        return { label: '💡 FEATURE', bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.25)', text: '#C084FC' };
      case 'feedback':
        return { label: '💬 FEEDBACK', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)', text: '#34D399' };
    }
  };

  const getStatusColor = (status: FeedbackReport['status']) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', color: '#FBBF24', border: 'rgba(251, 191, 36, 0.3)' };
      case 'investigating':
        return { label: 'Investigating', color: '#FB923C', border: 'rgba(251, 146, 60, 0.3)' };
      case 'in_progress':
        return { label: 'In Progress', color: '#60A5FA', border: 'rgba(96, 165, 250, 0.3)' };
      case 'resolved':
        return { label: 'Resolved', color: '#34D399', border: 'rgba(52, 211, 153, 0.3)' };
      case 'closed':
        return { label: 'Closed', color: '#9CA3AF', border: 'rgba(156, 163, 175, 0.3)' };
    }
  };

  const getLatencyColor = (latency: number | '—') => {
    if (latency === '—') return 'var(--text-muted)';
    if (latency < 45) return '#34D399'; // Green
    if (latency < 100) return '#FBBF24'; // Yellow/Orange
    return '#F43F5E'; // Red
  };

  return (
    <div className="page-shell">
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <button 
          onClick={() => navigate('/app/profile')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="t-page-title" style={{ color: 'var(--text-primary)', font: '600 19px var(--font-display)' }}>Developer Console</h1>
      </header>

      <main className="page-content" style={{ paddingBottom: 80 }}>
        {/* Bento Telemetry Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 12, marginBottom: 20 }}>
          
          {/* Active Users */}
          <div className="card" style={{ padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', minHeight: 110 }}>
            <Users size={18} color="#8B5CF6" style={{ marginBottom: 6 }} />
            <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ONLINE USERS
            </span>
            <span className="t-mono" style={{ font: '600 24px var(--font-mono)', color: 'var(--text-primary)', margin: '4px 0' }}>
              {onlineCount}
            </span>
            <span className="t-helper" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Realtime Presence
            </span>
          </div>

          {/* DB Latency */}
          <div className="card" style={{ padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', minHeight: 110, position: 'relative' }}>
            <button 
              onClick={pingDatabase} 
              disabled={pinging}
              style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <RefreshCw size={11} className={pinging ? 'animate-spin' : ''} />
            </button>
            <Activity size={18} color="#EC4899" style={{ marginBottom: 6 }} />
            <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              DB LATENCY
            </span>
            <span className="t-mono" style={{ font: '600 24px var(--font-mono)', color: getLatencyColor(dbLatency), margin: '4px 0' }}>
              {dbLatency === '—' ? '—' : `${dbLatency}ms`}
            </span>
            <span className="t-helper" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Supabase Roundtrip
            </span>
          </div>

          {/* PWA SW integrity */}
          <div className="card" style={{ padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', minHeight: 110 }}>
            <HardDrive size={18} color="#10B981" style={{ marginBottom: 6 }} />
            <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              PWA SW CACHE
            </span>
            <span className="t-mono" style={{ font: '600 18px var(--font-mono)', color: 'var(--text-primary)', margin: '6px 0' }}>
              {pwaStatus.active ? `${pwaStatus.cacheCount} FILES` : 'OFFLINE'}
            </span>
            <span className="t-helper" style={{ fontSize: 12, color: pwaStatus.active ? '#10B981' : 'var(--status-critical)' }}>
              {pwaStatus.active ? 'INTEGRITY: ACTIVE' : 'INTEGRITY: ERROR'}
            </span>
          </div>
        </div>

        {/* Bento Row 2: Developer Push Notification Diagnostics (Self-Removing console card) */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: 20, border: '1px dashed var(--accent-violet, #8B5CF6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Bell size={20} color="#8B5CF6" />
            <h3 style={{ margin: 0, font: '600 14px var(--font-display)', color: 'var(--text-primary)' }}>
              Web Push Notification Diagnostics
            </h3>
            <span style={{ fontSize: 12, background: 'rgba(139, 92, 246, 0.1)', color: '#A78BFA', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
              DEV ONLY
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 16, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>SUPPORTED:</span>{' '}
              <span style={{ color: pushSupported ? '#10B981' : 'var(--status-critical)' }}>
                {pushSupported ? 'YES' : 'NO'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>PERMISSION:</span>{' '}
              <span style={{ color: pushPermission === 'granted' ? '#10B981' : pushPermission === 'denied' ? 'var(--status-critical)' : '#FBBF24' }}>
                {pushPermission.toUpperCase()}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>SW REGISTERED:</span>{' '}
              <span style={{ color: swRegistered ? '#10B981' : 'var(--status-critical)' }}>
                {swRegistered ? 'YES' : 'NO'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>DB SUBSCRIBED:</span>{' '}
              <span style={{ color: dbSubscribed ? '#10B981' : 'var(--status-critical)' }}>
                {dbSubscribed ? 'YES' : 'NO'}
              </span>
            </div>
          </div>

          {activeEndpoint && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>
                ACTIVE DEVICE ENDPOINT:
              </span>
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: '#38BDF8',
                wordBreak: 'break-all'
              }}>
                {activeEndpoint}
              </div>
            </div>
          )}

          {/* Diagnosis Operations */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {!dbSubscribed ? (
              <button
                onClick={handleTestSubscribe}
                style={{
                  background: '#8B5CF6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 16px',
                  font: '600 11px var(--font-mono)',
                  cursor: 'pointer'
                }}
              >
                1. Subscribe Device
              </button>
            ) : (
              <button
                onClick={handleTestUnsubscribe}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  borderRadius: 6,
                  padding: '8px 16px',
                  font: '600 11px var(--font-mono)',
                  cursor: 'pointer'
                }}
              >
                Disable Subscription
              </button>
            )}

            <button
              onClick={handleTriggerTestPush}
              disabled={!dbSubscribed || sendingTestPush}
              style={{
                background: !dbSubscribed ? 'rgba(255,255,255,0.02)' : 'rgba(16, 185, 129, 0.1)',
                border: !dbSubscribed ? '1px solid var(--border-default)' : '1px solid rgba(16, 185, 129, 0.3)',
                color: !dbSubscribed ? 'var(--text-muted)' : '#34D399',
                borderRadius: 6,
                padding: '8px 16px',
                font: '600 11px var(--font-mono)',
                cursor: !dbSubscribed ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {sendingTestPush ? 'Broadcasting…' : '2. Broadcast Test Push'}
            </button>
          </div>
          
          {!dbSubscribed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <ShieldAlert size={12} color="var(--status-warning)" />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                You must subscribe this device before triggering a test push broadcast.
              </span>
            </div>
          )}
        </div>

        {/* ═══════════════ Product Analytics & Usage Metrics ═══════════════ */}
        <div className="card" style={{ padding: 0, marginBottom: 20, border: analyticsExpanded ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-default)', overflow: 'hidden', transition: 'border-color 0.2s ease' }}>
          {/* Collapsible Header */}
          <button
            onClick={() => setAnalyticsExpanded(!analyticsExpanded)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', gap: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(52, 211, 153, 0.05))',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <BarChart3 size={16} color="#10B981" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ margin: 0, font: '600 14px var(--font-display)', color: 'var(--text-primary)' }}>
                  Product Analytics & Usage Metrics
                </h3>
                <span style={{ font: '11px var(--font-mono)', color: 'var(--text-muted)' }}>
                  WAU · DAU · Retention · Feature Ranking
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, background: 'rgba(16, 185, 129, 0.1)', color: '#34D399', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
                BETA
              </span>
              {analyticsExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
            </div>
          </button>

          {/* Expanded Analytics Content */}
          {analyticsExpanded && (
            <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-default)' }}>

              {/* Controls Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                <button
                  onClick={fetchAnalytics}
                  disabled={loadingAnalytics}
                  style={{
                    background: 'none', border: 'none', cursor: loadingAnalytics ? 'wait' : 'pointer',
                    color: 'var(--accent-primary)', font: '600 11px var(--font-mono)',
                    display: 'flex', alignItems: 'center', gap: 4, padding: 0
                  }}
                >
                  <RefreshCw size={11} className={loadingAnalytics ? 'animate-spin' : ''} /> REFRESH DATA
                </button>
                <button
                  onClick={handlePurgeStaleAnalytics}
                  disabled={purgingAnalytics}
                  style={{
                    background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.2)',
                    borderRadius: 6, padding: '5px 10px', cursor: purgingAnalytics ? 'wait' : 'pointer',
                    color: '#FB7185', font: '600 10px var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  <Trash2 size={10} /> {purgingAnalytics ? 'PURGING…' : 'PURGE 60d+'}
                </button>
              </div>

              {/* Loading State */}
              {loadingAnalytics && !analyticsData && (
                <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <RefreshCw size={20} color="#10B981" className="animate-spin" />
                  <span style={{ font: '11px var(--font-mono)', color: 'var(--text-muted)' }}>COMPUTING ANALYTICS...</span>
                </div>
              )}

              {/* Analytics Widgets Grid */}
              {analyticsData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Row 1: WAU + Retention side by side */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                    {/* Widget 1 — WAU Counter */}
                    <div style={{
                      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-default)',
                      borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
                    }}>
                      <Users size={16} color="#8B5CF6" />
                      <span style={{ font: '9px var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Weekly Active
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{
                          font: '700 28px var(--font-mono)',
                          color: (analyticsData.wau?.percentage ?? 0) >= 70 ? '#34D399' : (analyticsData.wau?.percentage ?? 0) >= 40 ? '#FBBF24' : '#F43F5E'
                        }}>
                          {analyticsData.wau?.active ?? 0}
                        </span>
                        <span style={{ font: '500 13px var(--font-mono)', color: 'var(--text-muted)' }}>
                          /{analyticsData.wau?.total ?? 0}
                        </span>
                      </div>
                      <div style={{
                        padding: '3px 8px', borderRadius: 20, font: '600 10px var(--font-mono)',
                        background: (analyticsData.wau?.percentage ?? 0) >= 70 ? 'rgba(52, 211, 153, 0.1)' : (analyticsData.wau?.percentage ?? 0) >= 40 ? 'rgba(251, 191, 36, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                        color: (analyticsData.wau?.percentage ?? 0) >= 70 ? '#34D399' : (analyticsData.wau?.percentage ?? 0) >= 40 ? '#FBBF24' : '#FB7185'
                      }}>
                        {analyticsData.wau?.percentage ?? 0}% USAGE
                      </div>
                    </div>

                    {/* Widget 3 — Retention Indicator */}
                    <div style={{
                      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-default)',
                      borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
                    }}>
                      <TrendingUp size={16} color="#EC4899" />
                      <span style={{ font: '9px var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        7-Day Retention
                      </span>
                      <span style={{
                        font: '700 28px var(--font-mono)',
                        color: (analyticsData.retention?.percentage ?? 0) >= 60 ? '#34D399' : (analyticsData.retention?.percentage ?? 0) >= 30 ? '#FBBF24' : '#F43F5E'
                      }}>
                        {analyticsData.retention?.percentage ?? 0}%
                      </span>
                      <span style={{ font: '10px var(--font-mono)', color: 'var(--text-muted)' }}>
                        {analyticsData.retention?.returned7d ?? 0} users returned
                      </span>
                    </div>
                  </div>

                  {/* Widget 2 — DAU Sparkline (7-day CSS bar chart) */}
                  <div style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-default)',
                    borderRadius: 10, padding: 16
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Activity size={14} color="#38BDF8" />
                        <span style={{ font: '600 11px var(--font-mono)', color: 'var(--text-secondary)' }}>DAILY ACTIVE USERS</span>
                      </div>
                      <span style={{ font: '10px var(--font-mono)', color: 'var(--text-muted)' }}>LAST 7 DAYS</span>
                    </div>
                    {analyticsData.dauSeries && analyticsData.dauSeries.length > 0 ? (() => {
                      const maxCount = Math.max(...analyticsData.dauSeries.map((d: any) => d.count), 1);
                      return (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 72 }}>
                          {analyticsData.dauSeries.map((day: any, i: number) => {
                            const heightPct = Math.max((day.count / maxCount) * 100, 4);
                            const dayLabel = new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2);
                            return (
                              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                                <span style={{ font: '600 9px var(--font-mono)', color: '#38BDF8' }}>{day.count}</span>
                                <div style={{
                                  width: '100%', borderRadius: '4px 4px 0 0',
                                  height: `${heightPct}%`, minHeight: 3,
                                  background: `linear-gradient(180deg, #38BDF8 0%, rgba(56, 189, 248, 0.3) 100%)`,
                                  transition: 'height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                }} />
                                <span style={{ font: '8px var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{dayLabel}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })() : (
                      <div style={{ padding: '16px 0', textAlign: 'center', font: '11px var(--font-mono)', color: 'var(--text-muted)' }}>
                        No DAU data available yet
                      </div>
                    )}
                  </div>

                  {/* Widget 4 — Feature Usage Ranking */}
                  <div style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-default)',
                    borderRadius: 10, padding: 16
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                      <Zap size={14} color="#FBBF24" />
                      <span style={{ font: '600 11px var(--font-mono)', color: 'var(--text-secondary)' }}>FEATURE ENGAGEMENT RANKING</span>
                    </div>
                    {analyticsData.featureRanking && analyticsData.featureRanking.length > 0 ? (() => {
                      const maxFeature = Math.max(...analyticsData.featureRanking.map((f: any) => f.count), 1);
                      const eventLabels: Record<string, string> = {
                        attendance_updated: '📋 Attendance',
                        assignment_viewed: '📄 Assignment View',
                        assignment_submitted: '✅ Assignment Submit',
                        announcement_acknowledged: '📢 Announcement Ack',
                        poll_voted: '🗳️ Poll Vote',
                        profile_viewed: '👤 Profile View',
                      };
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {analyticsData.featureRanking.map((feature: any, i: number) => {
                            const barWidth = Math.max((feature.count / maxFeature) * 100, 2);
                            return (
                              <div key={i}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                  <span style={{ font: '11px var(--font-mono)', color: 'var(--text-primary)' }}>
                                    {eventLabels[feature.event_name] || feature.event_name}
                                  </span>
                                  <span style={{ font: '600 10px var(--font-mono)', color: 'var(--text-muted)' }}>{feature.count}×</span>
                                </div>
                                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                                  <div style={{
                                    height: '100%', borderRadius: 2, width: `${barWidth}%`,
                                    background: `linear-gradient(90deg, #FBBF24, #F59E0B)`,
                                    transition: 'width 0.5s ease'
                                  }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })() : (
                      <div style={{ padding: '12px 0', textAlign: 'center', font: '11px var(--font-mono)', color: 'var(--text-muted)' }}>
                        No feature engagement data yet
                      </div>
                    )}
                  </div>

                  {/* Widget 5 — Inactive Students */}
                  <div style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-default)',
                    borderRadius: 10, padding: 16
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                      <AlertTriangle size={14} color="#F43F5E" />
                      <span style={{ font: '600 11px var(--font-mono)', color: 'var(--text-secondary)' }}>INACTIVE STUDENTS (7d+)</span>
                      {analyticsData.inactiveStudents && (
                        <span style={{
                          marginLeft: 'auto', font: '600 10px var(--font-mono)',
                          background: analyticsData.inactiveStudents.length > 0 ? 'rgba(244, 63, 94, 0.1)' : 'rgba(52, 211, 153, 0.1)',
                          color: analyticsData.inactiveStudents.length > 0 ? '#FB7185' : '#34D399',
                          padding: '2px 6px', borderRadius: 4
                        }}>
                          {analyticsData.inactiveStudents.length}
                        </span>
                      )}
                    </div>
                    {analyticsData.inactiveStudents && analyticsData.inactiveStudents.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                        {analyticsData.inactiveStudents.map((student: any, i: number) => (
                          <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 10px', borderRadius: 6,
                            background: 'rgba(244, 63, 94, 0.03)', border: '1px solid rgba(244, 63, 94, 0.08)'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ font: '12px var(--font-mono)', color: 'var(--text-primary)' }}>{student.name}</span>
                              <span style={{ font: '9px var(--font-mono)', color: 'var(--text-muted)' }}>{student.email}</span>
                            </div>
                            <span style={{ font: '9px var(--font-mono)', color: '#FB7185', whiteSpace: 'nowrap' }}>
                              {student.lastSeen ? `Last: ${new Date(student.lastSeen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Never seen'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '12px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <span style={{ font: '11px var(--font-mono)', color: '#34D399' }}>🎉 All students active in the last 7 days!</span>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Empty state — no data and not loading */}
              {!analyticsData && !loadingAnalytics && (
                <div style={{ padding: '30px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <BarChart3 size={24} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                  <span style={{ font: '11px var(--font-mono)', color: 'var(--text-muted)' }}>Click REFRESH DATA to load analytics</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="t-label" style={{ color: 'var(--text-muted)' }}>TRANSMISSIONS FEED ({filteredReports.length})</span>
            <button 
              onClick={fetchReports} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', font: '600 11px var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={11} /> REFRESH
            </button>
          </div>

          {/* Filter Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {[
                { id: 'all', label: 'All Categories' },
                { id: 'bug', label: '🐛 Bugs' },
                { id: 'feature_request', label: '💡 Suggestions' },
                { id: 'feedback', label: '💬 Feedbacks' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id as any)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-default)',
                    font: '600 11px var(--font-mono)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    background: filterType === f.id ? 'var(--bg-elevated)' : 'transparent',
                    color: filterType === f.id ? 'var(--accent-violet, #8B5CF6)' : 'var(--text-secondary)',
                    borderColor: filterType === f.id ? '#8B5CF6' : 'var(--border-default)'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Status Filter Pills */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'all', label: 'All Statuses' },
                { id: 'open', label: 'Open' },
                { id: 'resolved', label: 'Resolved/Closed' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id as any)}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    borderRadius: 8,
                    border: '1px solid var(--border-default)',
                    font: '600 10px var(--font-mono)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    background: filterStatus === f.id ? 'var(--bg-elevated)' : 'transparent',
                    color: filterStatus === f.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    borderColor: filterStatus === f.id ? 'var(--text-secondary)' : 'var(--border-default)'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reports List */}
        {loading ? (
          <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <RefreshCw size={24} color="var(--accent-primary)" className="animate-spin" />
            <p className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>DECRYPTING TRANSMISSIONS...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="card" style={{ padding: '40px 10px', textAlign: 'center', borderStyle: 'dashed' }}>
            <p className="t-mono" style={{ color: 'var(--text-muted)', fontSize: 13, letterSpacing: '0.02em' }}>
              --- NO OUTSTANDING ANOMALIES RECORDED ---
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredReports.map(report => {
              const typeBadge = getTypeBadge(report.type);
              const statusBadge = getStatusColor(report.status);
              const isExpanded = expandedId === report.id;
              
              const submitterName = report.users?.name || 'Former ClassHub Student';
              const submitterEmail = report.users?.email || '';
              const submitterSection = report.users?.section_roll || '—';

              return (
                <div key={report.id} className="card" style={{ padding: 0, overflow: 'hidden', border: isExpanded ? '1px solid var(--border-hover)' : '1px solid var(--border-default)' }}>
                  
                  {/* Summary/Header Zone clickable */}
                  <div 
                    onClick={() => {
                      setExpandedId(isExpanded ? null : report.id);
                      setEditingNotesId(null);
                    }}
                    style={{ padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        font: '600 9px var(--font-mono)',
                        background: typeBadge.bg,
                        color: typeBadge.text,
                        border: `1px solid ${typeBadge.border}`
                      }}>
                        {typeBadge.label}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          font: '600 9px var(--font-mono)',
                          color: statusBadge.color,
                          border: `1px solid ${statusBadge.border}`
                        }}>
                          {statusBadge.label.toUpperCase()}
                        </span>
                        {isExpanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                      </div>
                    </div>

                    <div>
                      <h3 className="t-subtitle" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                        {report.title}
                      </h3>
                      <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} />
                        {new Date(report.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · {new Date(report.created_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={11} color="var(--text-muted)" />
                      <span className="t-caption" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        {submitterName} ({submitterSection})
                      </span>
                    </div>
                  </div>

                  {/* Expanded Diagnostics & Moderation panel */}
                  {isExpanded && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-default)', background: '#0D0F14' }}>
                      
                      {/* Description */}
                      <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-default)' }}>
                        <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>REPORT DETAIL</p>
                        <p className="t-body" style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.45, font: '13px var(--font-mono)' }}>
                          {report.description}
                        </p>
                      </div>

                      {/* Submitter details */}
                      <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <p className="t-label" style={{ color: 'var(--text-muted)' }}>SUBMITTER CONTEXT</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="t-mono-sm" style={{ color: 'var(--text-secondary)' }}>{submitterEmail}</span>
                          {submitterEmail && (
                            <a 
                              href={`mailto:${submitterEmail}?subject=ClassHub Report: ${encodeURIComponent(report.title)}`}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, font: '600 11px var(--font-mono)', color: 'var(--accent-primary)', textDecoration: 'none' }}
                            >
                              <Mail size={12} /> Contact
                            </a>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Section Roll: {submitterSection}</span>
                          <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>Univ Roll: {report.users?.university_roll || '—'}</span>
                        </div>
                      </div>

                      {/* Diagnostics harvest */}
                      <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-default)' }}>
                        <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 6 }}>ENVIRONMENT DIAGNOSTICS</p>
                        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-default)', borderRadius: 6, padding: 10, font: '11px var(--font-mono)', color: '#38BDF8', overflowX: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div><span style={{ color: 'var(--text-muted)' }}>Browser OS:</span> {report.device_info.userAgent}</div>
                          <div><span style={{ color: 'var(--text-muted)' }}>Viewport Size:</span> {report.device_info.screenSize} (DPR: {report.device_info.devicePixelRatio || 1})</div>
                          <div><span style={{ color: 'var(--text-muted)' }}>PWA Display:</span> {report.device_info.pwaInstalled ? 'Standalone App 📱' : 'Browser Mode 🌐'}</div>
                          <div><span style={{ color: 'var(--text-muted)' }}>Network Speed:</span> {report.device_info.connection.toUpperCase()}</div>
                          <div><span style={{ color: 'var(--text-muted)' }}>Active Route:</span> {report.device_info.currentPath}</div>
                        </div>
                      </div>

                      {/* Moderation Controls */}
                      <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p className="t-label" style={{ color: 'var(--text-muted)' }}>ADMIN ACTIONS</p>
                        
                        <div style={{ display: 'flex', gap: 10 }}>
                          {/* Status Picker dropdown */}
                          <div style={{ flex: 1, position: 'relative' }}>
                            <select
                              value={report.status}
                              onChange={e => handleUpdateStatus(report.id, e.target.value as any)}
                              style={{
                                width: '100%',
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 6,
                                padding: '8px 10px',
                                font: '600 11px var(--font-mono)',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              <option value="pending">Mark: Pending</option>
                              <option value="investigating">Mark: Investigating</option>
                              <option value="in_progress">Mark: In Progress</option>
                              <option value="resolved">Mark: Resolved ✓</option>
                              <option value="closed">Mark: Closed</option>
                            </select>
                          </div>

                          {/* Deletion Purge button */}
                          <button
                            onClick={() => handleDeleteReport(report.id)}
                            style={{
                              background: 'rgba(244, 63, 94, 0.1)',
                              border: '1px solid rgba(244, 63, 94, 0.3)',
                              borderRadius: 6,
                              padding: '8px 12px',
                              cursor: 'pointer',
                              color: '#FB7185',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Spam Purge"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Private Notes */}
                      <div style={{ padding: '14px 0 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <p className="t-label" style={{ color: 'var(--text-muted)' }}>PRIVATE DEVELOPER WORK-NOTES</p>
                        
                        {editingNotesId === report.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <textarea
                              rows={3}
                              value={tempNotes}
                              onChange={e => setTempNotes(e.target.value)}
                              placeholder="Log details about root cause, visual adjustments, or PR references here..."
                              style={{
                                width: '100%',
                                background: '#13131C',
                                border: '1px solid var(--accent-violet, #8B5CF6)',
                                borderRadius: 6,
                                padding: '8px 10px',
                                font: '12px var(--font-mono)',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                resize: 'none'
                              }}
                            />
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => setEditingNotesId(null)}
                                className="btn-secondary"
                                style={{ padding: '4px 10px', fontSize: 12, minHeight: 'fit-content' }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveNotes(report.id)}
                                disabled={updatingNotesId === report.id}
                                style={{
                                  background: '#8B5CF6',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '4px 12px',
                                  font: '600 11px var(--font-mono)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                {updatingNotesId === report.id ? 'Saving…' : 'Save Notes'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={() => {
                              setEditingNotesId(report.id);
                              setTempNotes(report.developer_notes || '');
                            }}
                            style={{
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid var(--border-default)',
                              borderRadius: 6,
                              padding: '10px 12px',
                              font: '12px var(--font-mono)',
                              color: report.developer_notes ? 'var(--text-primary)' : 'var(--text-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              minHeight: 38
                            }}
                          >
                            <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>
                              {report.developer_notes || 'No work-notes logged. Click to add notes...'}
                            </span>
                            <FileText size={12} color="var(--text-muted)" style={{ flexShrink: 0, marginLeft: 8 }} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
