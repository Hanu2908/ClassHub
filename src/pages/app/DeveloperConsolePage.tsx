import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../components/Toast';
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
  User
} from 'lucide-react';

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
        // Count unique user keys active on presence channel
        const count = Object.keys(state).length;
        setOnlineCount(count);
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
    setPinging(true);
    const start = performance.now();
    try {
      // Lightweight remote table head count to measure query roundtrip
      const { error } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .limit(1);

      if (error) throw error;
      const end = performance.now();
      setDbLatency(Math.round(end - start));
    } catch (err) {
      console.error('[Ping Error]', err);
      setDbLatency('—');
      showToast('Database latency check failed', 'error');
    } finally {
      setPinging(false);
    }
  };

  // 3. Service Worker Cache Integrity Audit
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
      showToast(err.message || 'Failed to load feedback reports', 'error');
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
      showToast(`Status updated to ${nextStatus}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update report status', 'error');
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
      showToast('Developer notes updated successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save notes', 'error');
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
      showToast('Report purged successfully', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete report', 'error');
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
            <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              ONLINE USERS
            </span>
            <span className="t-mono" style={{ font: '600 24px var(--font-mono)', color: 'var(--text-primary)', margin: '4px 0' }}>
              {onlineCount}
            </span>
            <span className="t-helper" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
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
            <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              DB LATENCY
            </span>
            <span className="t-mono" style={{ font: '600 24px var(--font-mono)', color: getLatencyColor(dbLatency), margin: '4px 0' }}>
              {dbLatency === '—' ? '—' : `${dbLatency}ms`}
            </span>
            <span className="t-helper" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              Supabase Roundtrip
            </span>
          </div>

          {/* PWA SW integrity */}
          <div className="card" style={{ padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', minHeight: 110 }}>
            <HardDrive size={18} color="#10B981" style={{ marginBottom: 6 }} />
            <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              PWA SW CACHE
            </span>
            <span className="t-mono" style={{ font: '600 18px var(--font-mono)', color: 'var(--text-primary)', margin: '6px 0' }}>
              {pwaStatus.active ? `${pwaStatus.cacheCount} FILES` : 'OFFLINE'}
            </span>
            <span className="t-helper" style={{ fontSize: 9, color: pwaStatus.active ? '#10B981' : 'var(--status-critical)' }}>
              {pwaStatus.active ? 'INTEGRITY: ACTIVE' : 'INTEGRITY: ERROR'}
            </span>
          </div>
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
                      <h3 className="t-subtitle" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                        {report.title}
                      </h3>
                      <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} />
                        {new Date(report.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · {new Date(report.created_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={11} color="var(--text-muted)" />
                      <span className="t-caption" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
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
                                style={{ padding: '4px 10px', fontSize: 11, minHeight: 'fit-content' }}
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
