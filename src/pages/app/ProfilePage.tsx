import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, LogOut, Settings, ChevronRight, Megaphone, ClipboardList, BarChart2, Calendar, Eye, TrendingUp, Bell, Trash2 } from 'lucide-react';
import { NavBar } from '../../components/NavBar';
import { CROnly } from '../../components/Shared';
import { useAppStore } from '../../store/appStore';
import { mockUser, mockHub } from '../../data/mockData';
import { showToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, role, hub, signOut } = useAppStore();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const displayName = user?.name ?? mockUser.name;
  const displayEmail = user?.email ?? mockUser.email;
  const displayAvatar = user?.avatarUrl;
  const displayHub = hub ?? mockHub;
  const displayRole = role;

  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleCopy = () => {
    navigator.clipboard.writeText(displayHub.hubCode);
    showToast('Hub code copied!', 'success');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut().catch(() => { });
    signOut();
    navigate('/');
  };

  const handleLeaveHub = () => {
    signOut();
    navigate('/onboarding/choice');
  };

  const CRTools = [
    { id: 'cr-announcement', icon: Megaphone, label: 'Post Announcement', path: '/app/announcements' },
    { id: 'cr-assignments', icon: ClipboardList, label: 'Manage Assignments', path: '/app/assignments' },
    { id: 'cr-polls', icon: BarChart2, label: 'Create Poll', path: '/app/polls' },
    { id: 'cr-timetable', icon: Calendar, label: 'Edit Timetable', path: '/app/schedule' },
    { id: 'cr-acks', icon: Eye, label: 'View Acknowledgments', path: '/app/announcements' },
    { id: 'cr-attendance', icon: TrendingUp, label: 'Attendance Overview', path: '/app/attendance' },
  ];

  return (
    <div className="page-shell">
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <h1 style={{ font: '600 18px var(--font-display)', color: 'var(--text-primary)' }}>Profile</h1>
      </header>

      <main className="page-content">
        {/* Avatar + identity */}
        <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
          {displayAvatar ? (
            <img src={displayAvatar} alt={displayName} className="avatar" style={{ margin: '0 auto 16px' }} />
          ) : (
            <div className="avatar-initials" style={{ margin: '0 auto 16px' }}>{initials}</div>
          )}
          <h2 style={{ font: '700 20px var(--font-display)', color: 'var(--text-primary)', marginBottom: 6 }}>
            {displayName}
          </h2>
          <p style={{ font: '400 12px var(--font-mono)', color: 'var(--text-muted)', marginBottom: 12 }}>
            {displayEmail}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <span className={`badge ${displayRole === 'cr' ? 'badge-warning' : 'badge-info'}`}>
              {displayRole === 'cr' ? '⭐ Class Rep' : 'Student'}
            </span>
            <span className="badge badge-info">{displayHub.section}</span>
            <span style={{ font: '400 12px var(--font-mono)', color: 'var(--text-secondary)', padding: '3px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-pill)' }}>
              Roll {hub?.classRoll ?? mockUser.classRoll}
            </span>
          </div>
        </div>

        {/* Hub info */}
        <div>
          <p style={{ font: '500 12px var(--font-body)', color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>HUB INFO</p>
          <div className="card" style={{ padding: 0 }}>
            {[
              { label: 'Hub Code', value: displayHub.hubCode, action: <button id="copy-hub-code" onClick={handleCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', font: '500 12px var(--font-body)', display: 'flex', alignItems: 'center', gap: 4 }}><Copy size={13} /> Copy</button> },
              { label: 'Section', value: displayHub.section },
              { label: 'Institution', value: displayHub.institution },
              { label: 'University Roll', value: hub?.universityRoll ?? mockUser.universityRoll },
            ].map((row, i, arr) => (
              <div key={row.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-default)' : 'none',
              }}>
                <span style={{ font: '400 13px var(--font-body)', color: 'var(--text-secondary)' }}>{row.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ font: '500 13px var(--font-mono)', color: 'var(--text-primary)' }}>{row.value}</span>
                  {row.action}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance shortcut */}
        <div>
          <p style={{ font: '500 12px var(--font-body)', color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>ATTENDANCE</p>
          <button id="go-attendance-btn" className="list-row" style={{ width: '100%' }} onClick={() => navigate('/app/attendance')}>
            <TrendingUp size={18} color="var(--accent-primary)" />
            <span style={{ flex: 1, font: '500 14px var(--font-body)', color: 'var(--text-primary)', textAlign: 'left' }}>Update Attendance</span>
            <ChevronRight size={16} color="var(--text-muted)" />
          </button>
        </div>

        {/* Settings */}
        <div>
          <p style={{ font: '500 12px var(--font-body)', color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>SETTINGS</p>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Bell size={16} color="var(--text-secondary)" />
                <span style={{ font: '400 14px var(--font-body)', color: 'var(--text-primary)' }}>Notifications</span>
              </div>
              <div style={{ width: 44, height: 24, borderRadius: 12, background: 'var(--accent-primary)', position: 'relative', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', right: 2, top: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Settings size={16} color="var(--text-secondary)" />
                <span style={{ font: '400 14px var(--font-body)', color: 'var(--text-primary)' }}>Theme</span>
              </div>
              <span style={{ font: '400 13px var(--font-body)', color: 'var(--text-muted)' }}>Dark</span>
            </div>
          </div>
        </div>



        {/* Danger zone */}
        <div>
          <p style={{ font: '500 12px var(--font-body)', color: 'var(--status-critical)', marginBottom: 8, paddingLeft: 4 }}>DANGER ZONE</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!showLeaveConfirm ? (
              <button id="leave-hub-btn" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--status-warning)' }}
                onClick={() => setShowLeaveConfirm(true)}>
                <Trash2 size={15} /> Leave Hub
              </button>
            ) : (
              <div style={{ background: 'var(--status-critical-bg)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                <p style={{ font: '500 13px var(--font-body)', color: 'var(--text-primary)', marginBottom: 12 }}>
                  Are you sure? You'll need a new hub code to rejoin.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button id="confirm-leave-btn" style={{ flex: 1, padding: '10px', background: 'var(--status-critical)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', font: '600 13px var(--font-body)', cursor: 'pointer' }}
                    onClick={handleLeaveHub}>Leave</button>
                  <button id="cancel-leave-btn" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowLeaveConfirm(false)}>Cancel</button>
                </div>
              </div>
            )}
            <button id="sign-out-btn" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--status-critical)' }}
              onClick={handleSignOut}>
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>
      </main>

      <NavBar />
    </div>
  );
}
