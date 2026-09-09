import { useState } from 'react';
import { Users, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { useSection } from '../../../hooks/useSectionMembers';
import {
  useSectionTeachers,
  useAssignBatchCounsellor,
  useRevokeTeacherAccess,
} from '../../../hooks/useSectionTeachers';

export function ManageTeachers() {
  const { data: section } = useSection();
  const sectionName = section?.name || '';
  const [expanded, setExpanded] = useState(false);
  const [headerHovered, setHeaderHovered] = useState(false);
  const [headerActive, setHeaderActive] = useState(false);

  const { data: sectionTeachers = [], isLoading } = useSectionTeachers(section?.id);
  const assignCounsellorMutation = useAssignBatchCounsellor(section?.id);
  const deleteTeacherMutation = useRevokeTeacherAccess(section?.id);

  if (!section?.id) return null;

  return (
    <div className="card" style={{ padding: 0 }}>
      <div 
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => { setHeaderHovered(false); setHeaderActive(false); }}
        onTouchStart={() => setHeaderActive(true)}
        onTouchEnd={() => setHeaderActive(false)}
        onMouseDown={() => setHeaderActive(true)}
        onMouseUp={() => setHeaderActive(false)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', padding: '14px 16px', borderRadius: 'var(--radius-lg)',
          transition: 'background var(--transition-fast)', userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          background: headerActive
            ? 'rgba(255, 255, 255, 0.08)'
            : (headerHovered ? 'rgba(255, 255, 255, 0.04)' : 'transparent')
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} color="var(--accent-primary)" />
          <span className="t-subtitle" style={{ color: 'var(--text-primary)' }}>Manage Section Teachers</span>
          <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>({sectionTeachers.length})</span>
        </div>
        {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </div>

      {expanded ? (
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-default)' }}>
          {isLoading ? (
            <p className="t-caption" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>Loading teachers...</p>
          ) : sectionTeachers.length === 0 ? (
            <p className="t-caption" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>No teachers linked to this section.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sectionTeachers.map(st => (
                <div key={st.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                }}>
                  {/* Avatar circle */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-default)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span className="t-badge" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {st.users?.name ? st.users.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'T'}
                    </span>
                  </div>

                  {/* Name + email + subject */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="t-body-medium" style={{ color: 'var(--text-primary)' }}>
                      {st.users?.name || 'Unnamed Teacher'}
                    </p>
                    <p className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {st.users?.email}
                    </p>
                    {st.subjects && (
                      <p className="t-mono-sm" style={{ color: 'var(--accent-primary)', fontSize: 12, marginTop: 2 }}>
                        Subject: {st.subjects.name} ({st.subjects.code})
                      </p>
                    )}
                  </div>

                  {/* Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                        Counsellor
                      </span>
                      <select
                        value={st.is_counsellor_for_batch || ''}
                        onChange={e => {
                          const val = e.target.value === '' ? null : (e.target.value as '1' | '2');
                          assignCounsellorMutation.mutate({ mappingId: st.id, batch: val });
                        }}
                        className="input"
                        style={{ fontSize: 12, padding: '2px 6px', height: 24, width: 90 }}
                      >
                        <option value="">None</option>
                        <option value="1">{sectionName || 'B'}1</option>
                        <option value="2">{sectionName || 'B'}2</option>
                      </select>
                    </div>

                    <button
                      onClick={() => {
                        if (window.confirm(`Revoke teacher access for ${st.users?.name || 'this teacher'}?`)) {
                          deleteTeacherMutation.mutate(st.id);
                        }
                      }}
                      style={{
                        background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)',
                        borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                        color: 'var(--status-critical)', fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4, height: 24, marginTop: 12
                      }}
                      title={`Revoke ${st.users?.name || 'teacher'}'s access`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
