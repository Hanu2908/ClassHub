import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, X, Users } from 'lucide-react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import Skeleton from 'react-loading-skeleton';
import { NavBar } from '../../components/NavBar';
import { useSectionMembers } from '../../hooks/useSectionMembers';
import { useUserTagsBatch, useDeleteTag } from '../../hooks/useUserTags';
import { useAppStore } from '../../store/appStore';
import { TagPill, TagOverflow } from '../../components/TagPill';
import { toast } from 'sonner';

const MAX_VISIBLE_TAGS = 3;

function DirectorySkeleton() {
  return (
    <div className="card" style={{ padding: 0 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderBottom: i < 5 ? '1px solid var(--border-default)' : 'none',
          }}
        >
          <Skeleton circle width={36} height={36} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Skeleton width={120} height={16} />
              <Skeleton width={40} height={14} />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <Skeleton width={60} height={20} borderRadius="var(--radius-pill)" />
              <Skeleton width={50} height={20} borderRadius="var(--radius-pill)" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SectionDirectoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tagFilter = searchParams.get('tag');
  const role = useAppStore(s => s.authUser?.role ?? 'student');
  const isCR = role === 'cr';

  const { data: members = [], isLoading } = useSectionMembers();
  const memberIds = useMemo(() => members.map(m => m.id), [members]);
  const { data: tagsByUser = {} } = useUserTagsBatch(memberIds);
  const deleteTag = useDeleteTag();

  // Filter members by tag if query param present
  const filteredMembers = useMemo(() => {
    if (!tagFilter) return members;
    const lower = tagFilter.toLowerCase();
    return members.filter(m => {
      const tags = tagsByUser[m.id] ?? [];
      return tags.some(t => t.tagText.toLowerCase() === lower);
    });
  }, [members, tagsByUser, tagFilter]);

  const clearFilter = () => {
    setSearchParams({});
  };

  const handleTagTap = (tagText: string) => {
    setSearchParams({ tag: tagText });
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      setScrollMargin(containerRef.current.offsetTop);
    }
  }, [filteredMembers.length, tagFilter]);

  const virtualizer = useWindowVirtualizer({
    count: filteredMembers.length,
    estimateSize: () => 72,
    overscan: 10,
    scrollMargin,
  });

  const handleTagRemove = (tagId: string) => {
    if (window.confirm('Remove this tag from this student?')) {
      deleteTag.mutate(tagId, {
        onSuccess: () => toast.info('Tag removed'),
        onError: (err) => toast.error(`Failed: ${err.message}`),
      });
    }
  };

  return (
    <div className="page-shell">
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,15,20,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)', padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
            padding: 0,
          }}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <Users size={18} color="var(--accent-primary)" />
        <h1 className="t-page-title" style={{ color: 'var(--text-primary)', flex: 1 }}>
          Section Directory
        </h1>
        <span className="t-mono-sm" style={{ color: 'var(--text-muted)' }}>
          {filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'}
        </span>
      </header>

      <main className="page-content">
        {/* Active tag filter chip */}
        {tagFilter && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            marginBottom: 12,
            background: 'rgba(74, 158, 255, 0.08)',
            border: '1px solid rgba(74, 158, 255, 0.2)',
            borderRadius: 'var(--radius-md)',
          }}>
            <span className="t-caption" style={{ color: 'var(--text-secondary)' }}>
              Showing:
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              background: 'rgba(74, 158, 255, 0.12)',
              borderRadius: 'var(--radius-pill)',
            }}>
              {tagFilter}
              <button
                onClick={clearFilter}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 14,
                  height: 14,
                  padding: 0,
                  border: 'none',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-secondary)',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontWeight: 700,
                }}
                aria-label="Clear tag filter"
              >
                <X size={9} />
              </button>
            </span>
          </div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <DirectorySkeleton />
        ) : filteredMembers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
            <p className="t-body-medium">No members found{tagFilter ? ` with tag "${tagFilter}"` : ''}.</p>
            {tagFilter && (
              <button
                onClick={clearFilter}
                className="t-button"
                style={{
                  marginTop: 12,
                  padding: '8px 16px',
                  fontSize: '12px',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <div
            ref={containerRef}
            className="card"
            style={{
              padding: 0,
              height: `${virtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const member = filteredMembers[virtualItem.index];
              if (!member) return null;

              const tags = tagsByUser[member.id] ?? [];
              const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
              const overflowCount = tags.length - MAX_VISIBLE_TAGS;

              return (
                <div
                  key={member.id}
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    borderBottom: virtualItem.index < filteredMembers.length - 1 ? '1px solid var(--border-default)' : 'none',
                  }}
                >
                  {/* Avatar */}
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      flexShrink: 0,
                    }}>
                      {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span className="t-body-medium" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                        {member.name}
                      </span>
                      {member.classRoll && (
                        <span className="t-mono-sm" style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '1px 5px',
                          borderRadius: 4,
                          fontSize: '10px',
                          color: 'var(--text-secondary)',
                        }}>
                          {member.classRoll}
                        </span>
                      )}
                      {member.role === 'cr' && (
                        <span className="t-mono-sm" style={{
                          background: 'rgba(167, 139, 250, 0.15)',
                          color: 'var(--status-announcement)',
                          padding: '1px 5px',
                          borderRadius: 4,
                          fontSize: '9px',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                        }}>
                          CR
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {visibleTags.map(tag => (
                          <TagPill
                            key={tag.id}
                            tagText={tag.tagText}
                            expiresAt={tag.expiresAt}
                            size="sm"
                            showExpiry
                            onTap={() => handleTagTap(tag.tagText)}
                            onRemove={isCR ? () => handleTagRemove(tag.id) : undefined}
                          />
                        ))}
                        {overflowCount > 0 && <TagOverflow count={overflowCount} size="sm" />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <NavBar />
    </div>
  );
}
