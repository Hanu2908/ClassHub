import { motion, AnimatePresence } from 'motion/react';
import { Plus } from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { CopyButton } from '../../../components/CopyButton';
import { TagPill } from '../../../components/TagPill';
import { useSection } from '../../../hooks/useSectionMembers';
import { useUserTags, useDeleteTag, MAX_ACTIVE_TAGS } from '../../../hooks/useUserTags';
import { toast } from 'sonner';

interface ProfileIdentityCardProps {
  onOpenAddTag: () => void;
}

export function ProfileIdentityCard({ onOpenAddTag }: ProfileIdentityCardProps) {
  const { authUser, role, hub } = useAppStore();
  const { data: section } = useSection();
  const { data: myTags = [] } = useUserTags();
  const deleteTag = useDeleteTag();

  const displayName = authUser?.name ?? 'Student';
  const displayEmail = authUser?.email ?? '';
  const displayAvatar = authUser?.avatarUrl;
  const displayRole = role;

  const sectionName = section?.name ?? hub?.section ?? '—';
  const classRoll = authUser?.sectionRoll ?? hub?.classRoll ?? '—';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Avatar + identity */}
      <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
        {displayAvatar ? (
          <img src={displayAvatar} alt={displayName} className="avatar" style={{ margin: '0 auto 16px' }} />
        ) : (
          <div className="avatar-initials" style={{ margin: '0 auto 16px' }}>{initials}</div>
        )}
        <h2 className="t-feature" style={{ color: 'var(--text-primary)', marginBottom: 6 }}>
          {displayName}
        </h2>
        <p className="t-mono" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
          {displayEmail}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${displayRole === 'cr' ? 'badge-warning' : displayRole === 'teacher' ? 'badge-safe' : 'badge-info'}`}>
            {displayRole === 'cr' ? '⭐ CR' : displayRole === 'teacher' ? '👨‍🏫 Teacher' : 'Student'}
          </span>
          <span className="badge badge-info">{sectionName}</span>
          {authUser?.branch && (
            <span className="badge badge-info">{authUser.branch}</span>
          )}
          {displayRole !== 'teacher' && (
            <span className="t-mono" style={{ color: 'var(--text-secondary)', padding: '3px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-pill)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span>Roll {classRoll}</span>
              {classRoll && classRoll !== '—' && (
                <CopyButton
                  text={classRoll}
                  ariaLabel="Copy class roll number"
                  successMessage="Class roll number copied!"
                  iconSize={11}
                />
              )}
            </span>
          )}
        </div>
      </div>

      {/* My Tags */}
      <div>
        <p className="t-label" style={{ color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>MY TAGS</p>
        <div className="card" style={{ padding: '16px' }}>
          {myTags.length === 0 ? (
            <p className="t-caption" style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '8px 0' }}>
              No tags yet — add tags to let your section know.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <AnimatePresence mode="popLayout">
                {myTags.map(tag => (
                  <motion.div
                    key={tag.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <TagPill
                      tagText={tag.tagText}
                      expiresAt={tag.expiresAt}
                      showExpiry
                      onRemove={() => {
                        deleteTag.mutate(tag.id, {
                          onSuccess: () => toast.info('Tag removed'),
                          onError: (err) => toast.error(`Failed: ${err.message}`),
                        });
                      }}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          <button
            id="add-tag-btn"
            onClick={onOpenAddTag}
            disabled={myTags.length >= MAX_ACTIVE_TAGS}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              padding: '10px',
              fontSize: '13px',
              fontWeight: 600,
              color: myTags.length >= MAX_ACTIVE_TAGS ? 'var(--text-muted)' : 'var(--accent-primary)',
              background: 'rgba(74, 158, 255, 0.06)',
              border: '1px dashed rgba(74, 158, 255, 0.2)',
              borderRadius: 'var(--radius-md)',
              cursor: myTags.length >= MAX_ACTIVE_TAGS ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Plus size={14} />
            <span>{myTags.length >= MAX_ACTIVE_TAGS ? `Max ${MAX_ACTIVE_TAGS} tags reached` : 'Add Tag'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
