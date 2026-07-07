import { useNavigate } from 'react-router-dom';
import { BarChart2, MessageSquare, ClipboardList, AlertTriangle, BookOpen } from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { useSection } from '../../../hooks/useSectionMembers';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchAnnouncementsData } from './prefetchHelper';
import DirectShareTip from '../../../components/DirectShareTip';
import { useSubjects } from '../../../hooks/useSubjects';

export default function CRDashboardStation() {
  const queryClient = useQueryClient();
  const authUser = useAppStore(s => s.authUser);
  const sectionId = authUser?.sectionId;
  const userId = authUser?.id;
  const prefetchAnnouncements = () => prefetchAnnouncementsData(queryClient, sectionId, userId);

  const navigate = useNavigate();
  const { data: section } = useSection();
  const { data: subjects = [], isLoading: isSubjectsLoading } = useSubjects();

  return (
    <section style={{ animation: 'fadeSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both', margin: '4px 0 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <DirectShareTip />

      {subjects.length === 0 && !isSubjectsLoading && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(192, 132, 252, 0.15) 0%, rgba(96, 165, 250, 0.05) 100%)',
          border: '1px solid rgba(192, 132, 252, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: '0 8px 32px rgba(192, 132, 252, 0.05)',
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(192, 132, 252, 0.2)', border: '1px solid rgba(192, 132, 252, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <BookOpen size={18} color="#c084fc" />
            </div>
            <div>
              <h4 className="t-subtitle" style={{ color: '#fff', margin: '0 0 4px', fontWeight: 600 }}>
                Set up Section Curriculum
              </h4>
              <p className="t-body" style={{ color: '#a1a1aa', margin: 0, fontSize: 13, lineHeight: 1.4 }}>
                Your newly created Section Hub does not have any subjects yet. Add subjects to enable attendance tracking, assignments, and exam schedules for your section.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button 
              className="btn-primary" 
              onClick={() => navigate('/app/cr/subjects')}
              style={{
                padding: '8px 16px',
                fontSize: 12,
                borderRadius: 8,
                background: '#fff',
                color: '#000',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              Add Subjects Now
            </button>
          </div>
        </div>
      )}

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
              <span className="badge badge-info t-badge" style={{ fontSize: 12, padding: '2px 8px', letterSpacing: '0.04em' }}>
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
              fontSize: 12, 
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
