import { useNavigate } from 'react-router-dom';
import { BarChart2, MessageSquare, ClipboardList, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { useSection } from '../../../hooks/useSectionMembers';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchAnnouncementsData } from './prefetchHelper';
import DirectShareTip from '../../../components/DirectShareTip';

export default function CRDashboardStation() {
  const queryClient = useQueryClient();
  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId;
  const userId = authUser?.id;
  const prefetchAnnouncements = () => prefetchAnnouncementsData(queryClient, sectionId, userId);

  const navigate = useNavigate();
  const { data: section } = useSection();

  return (
    <section style={{ animation: 'fadeSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both', margin: '4px 0 8px' }}>
      <DirectShareTip />
      <div 
        className="card-solid-cr"
        style={{
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span className="badge badge-info t-badge" style={{ fontSize: 9, padding: '2px 8px', letterSpacing: '0.04em' }}>
                CR HUB
              </span>
            </div>
            <h3 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 0, letterSpacing: '-0.015em' }}>
              {section?.name || 'Section Hub'}
            </h3>
          </div>
          <button 
            className="btn-secondary" 
            onClick={() => navigate('/app/cr-command')}
            style={{ 
              padding: '6px 12px', 
              minHeight: 'fit-content', 
              fontSize: 11, 
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              borderColor: 'rgba(96, 165, 250, 0.35)',
              background: 'rgba(96, 165, 250, 0.08)',
              borderRadius: 'var(--radius-sm)',
            }}
            aria-label="Open Command Center"
          >
            COMMAND CENTER →
          </button>
        </div>

        <div className="cr-command-grid">
          <button 
            onClick={() => navigate('/app/polls', { state: { openCreate: true } })}
            className="btn-tactile-cr glow-blue"
            aria-label="Create a new poll"
          >
            <BarChart2 size={18} color="var(--status-info)" style={{ filter: 'drop-shadow(0 0 4px rgba(34, 211, 238, 0.3))' }} />
            <span>New Poll</span>
          </button>

          <button 
            onClick={() => navigate('/app/announcements', { state: { openCreate: true } })}
            onMouseEnter={prefetchAnnouncements}
            onTouchStart={prefetchAnnouncements}
            className="btn-tactile-cr glow-violet"
            aria-label="Post a new announcement"
          >
            <MessageSquare size={18} color="var(--status-announcement)" style={{ filter: 'drop-shadow(0 0 4px rgba(167, 139, 250, 0.3))' }} />
            <span>Announce</span>
          </button>

          <button 
            onClick={() => navigate('/app/assignments', { state: { openCreate: true } })}
            className="btn-tactile-cr glow-emerald"
            aria-label="Create a new assignment"
          >
            <ClipboardList size={18} color="var(--status-safe)" style={{ filter: 'drop-shadow(0 0 4px rgba(52, 211, 153, 0.3))' }} />
            <span>Add Assign</span>
          </button>

          <button 
            onClick={() => navigate('/app/cr-command', { state: { openFlashPost: true } })}
            className="btn-tactile-cr glow-rose"
            aria-label="Send a flash post"
          >
            <AlertTriangle size={18} color="var(--status-critical)" style={{ filter: 'drop-shadow(0 0 4px rgba(248, 113, 113, 0.3))' }} />
            <span>Flash Post</span>
          </button>
        </div>
      </div>
    </section>
  );
}
