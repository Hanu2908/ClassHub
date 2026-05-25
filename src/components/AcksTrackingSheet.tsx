import { useState } from 'react';
import { Bell, Search, Loader } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { showToast } from './Toast';
import { supabase } from '../lib/supabase';
import type { Announcement } from '../store/appStore';
import type { SectionMember } from '../hooks/useSupabaseQuery';

export interface SectionAck {
  announcement_id: string;
  user_id: string;
  acknowledged_at: string;
}

interface AcksTrackingSheetProps {
  announcement: Announcement;
  onClose: () => void;
  sectionAcks: SectionAck[];
  members: SectionMember[];
}

export default function AcksTrackingSheet({ announcement, onClose, sectionAcks, members }: AcksTrackingSheetProps) {
  const [activeTab, setActiveTab] = useState<'acknowledged' | 'pending'>('acknowledged');
  const [studentSearch, setStudentSearch] = useState('');
  const [nudgingIds, setNudgingIds] = useState<Set<string>>(new Set());
  const [isNudgingAll, setIsNudgingAll] = useState(false);

  // Filter out CR accounts to get students list
  const totalStudents = members.filter(m => m.role === 'student');
  
  // Find which students acknowledged this announcement
  const announcementAcks = sectionAcks.filter(a => a.announcement_id === announcement.id);
  const ackedUserIds = new Set(announcementAcks.map(a => a.user_id));

  const ackedStudents = totalStudents.filter(m => ackedUserIds.has(m.id));
  const pendingStudents = totalStudents.filter(m => !ackedUserIds.has(m.id));

  // Fuzzy filter by name or class roll
  const filterList = (list: SectionMember[]) => {
    return list.filter(m => 
      m.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
      (m.classRoll && m.classRoll.toLowerCase().includes(studentSearch.toLowerCase()))
    );
  };

  const filteredAcked = filterList(ackedStudents);
  const filteredPending = filterList(pendingStudents);

  const handleNudgeSingle = async (studentId: string, studentName: string) => {
    setNudgingIds(prev => {
      const next = new Set(prev);
      next.add(studentId);
      return next;
    });
    try {
      const { error } = await supabase.functions.invoke('nudge-unacknowledged', {
        body: { announcementId: announcement.id, studentId }
      });
      if (error) throw error;
      showToast(`Nudge sent to ${studentName}`, 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to send nudge', 'error');
    } finally {
      setNudgingIds(prev => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  };

  const handleNudgeAll = async () => {
    if (pendingStudents.length === 0) {
      showToast('All students have already acknowledged', 'info');
      return;
    }
    setIsNudgingAll(true);
    try {
      const { error } = await supabase.functions.invoke('nudge-unacknowledged', {
        body: { announcementId: announcement.id }
      });
      if (error) throw error;
      showToast(`Nudge sent to all unacknowledged students (${pendingStudents.length})`, 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to send bulk nudge', 'error');
    } finally {
      setIsNudgingAll(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="Acknowledgment Status">
      <div style={{ paddingBottom: 24 }}>
        <div style={{ marginBottom: 12 }}>
          <h3 className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>
            {announcement.title}
          </h3>
          <p className="t-caption" style={{ color: 'var(--text-secondary)' }}>
            Acknowledgment tracking: <strong style={{ color: 'var(--status-announcement)' }}>{ackedStudents.length} / {totalStudents.length} acknowledged</strong>
          </p>
        </div>

        {/* Dynamic Search Bar */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input className="t-body" 
            type="text" 
            placeholder="Search students..." 
            value={studentSearch} 
            onChange={e => setStudentSearch(e.target.value)} 
            aria-label="Search student reading receipts"
            style={{
              width: '100%', padding: '10px 12px 10px 36px', boxSizing: 'border-box',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>

        {/* Slide tabs */}
        <div className="sheet-tabs-container">
          <button 
            className={`sheet-tab-button${activeTab === 'acknowledged' ? ' active' : ''}`}
            onClick={() => setActiveTab('acknowledged')}
          >
            Acknowledged ({ackedStudents.length})
          </button>
          <button 
            className={`sheet-tab-button${activeTab === 'pending' ? ' active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending ({pendingStudents.length})
          </button>
        </div>

        {/* Nudge All Button for critical announcements */}
        {activeTab === 'pending' && announcement.priority === 'critical' && pendingStudents.length > 0 && (
          <button
            onClick={handleNudgeAll}
            disabled={isNudgingAll} className="t-subtitle" style={{ width: '100%', padding: '10px 14px', marginBottom: 16,
              background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              color: 'var(--status-announcement)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all var(--transition-fast)' }}
          >
            {isNudgingAll ? <Loader size={14} className="spin" /> : <Bell size={14} />}
            Nudge All Unacknowledged ({pendingStudents.length})
          </button>
        )}

        {/* Students List */}
        <div style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: 4 }} className="custom-scrollbar">
          {(activeTab === 'acknowledged' ? filteredAcked : filteredPending).length === 0 ? (
            <div className="t-body" style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)' }}>
              No students found.
            </div>
          ) : (
            (activeTab === 'acknowledged' ? filteredAcked : filteredPending).map(student => (
              <div key={student.id} className="student-ack-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                    overflow: 'hidden', flexShrink: 0
                  }}>
                    {student.avatarUrl ? (
                      <img src={student.avatarUrl} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      student.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="t-body-medium" style={{ color: 'var(--text-primary)' }}>{student.name}</div>
                    <div className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
                      {student.classRoll || 'No Roll'} • {student.email}
                    </div>
                  </div>
                </div>
                {activeTab === 'pending' && announcement.priority === 'critical' && (
                  <button 
                    onClick={() => handleNudgeSingle(student.id, student.name)}
                    className="btn-nudge-single"
                    disabled={nudgingIds.has(student.id)}
                    title={`Nudge ${student.name}`}
                  >
                    {nudgingIds.has(student.id) ? (
                      <Loader size={14} className="spin" />
                    ) : (
                      <Bell size={14} />
                    )}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
