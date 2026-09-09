import React from 'react';
import { CheckCircle2, Trash2, FileText, Loader2, MoreVertical, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { Assignment } from '../../../store/appStore';
import { AttachmentCard } from '../../../components/AttachmentCard';
import { generateGradient } from '../../../lib/utils';
import { getSubjectAcronym, getUserSet } from './assignmentUtils';

export type AssignmentWithStatus = Assignment & {
  isSubmitted?: boolean;
  isExpired?: boolean;
  isOverdue?: boolean;
};

interface AssignmentCardProps {
  assignment: AssignmentWithStatus;
  classRoll: string;
  now: number;
  role: string;
  isHighlighted: boolean;
  highlightRef?: React.RefObject<HTMLDivElement | null>;
  onEdit: (a: Assignment) => void;
  onToggleArchive: (a: Assignment) => void;
  onDelete: (a: Assignment) => void;
  onOpenPdf: (url: string, title: string, pageRange?: string) => void;
  onSubmit: (id: string) => void;
  isSubmitting: boolean;
}

export function AssignmentCard({
  assignment: a,
  classRoll,
  now,
  role,
  isHighlighted,
  highlightRef,
  onEdit,
  onToggleArchive,
  onDelete,
  onOpenPdf,
  onSubmit,
  isSubmitting,
}: AssignmentCardProps) {
  const userSet = getUserSet(classRoll, a.sets ?? []);
  const isSubmitted = a.isSubmitted;

  const diff = new Date(a.dueDate).getTime() - now;
  const days = diff / (1000 * 60 * 60 * 24);

  let bdg = 'badge-info';
  let lbl = 'Pending';

  if (isSubmitted) {
    if (a.crVerified) {
      bdg = 'badge-safe';
      lbl = 'Marked ✓';
    } else {
      bdg = 'badge-warning';
      lbl = 'Submitted';
    }
  } else if (a.isExpired) {
    bdg = 'badge-critical';
    lbl = 'Expired';
  } else if (a.isOverdue) {
    bdg = 'badge-critical';
    lbl = 'Overdue';
  } else if (days < 1) {
    bdg = 'badge-critical';
    lbl = 'Urgent';
  } else if (days < 2) {
    bdg = 'badge-warning';
    lbl = 'Tomorrow';
  }

  return (
    <article
      ref={isHighlighted && highlightRef ? highlightRef : null}
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        animation: 'fadeSlideUp 0.35s ease both',
        outline: isHighlighted ? '2px solid var(--accent-primary)' : undefined,
        outlineOffset: isHighlighted ? '2px' : undefined,
        boxShadow: isHighlighted ? '0 0 0 4px rgba(74,158,255,0.15)' : undefined,
      }}
    >
      {/* Card Header: Subject, Title, Badges, CR Menu */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: generateGradient(a.subjectCode || a.subject),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
            }}
          >
            <span className="t-mono" style={{ color: '#fff', fontSize: 13, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
              {getSubjectAcronym(a.subject)}
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 className="t-card-title truncate" style={{ color: 'var(--text-primary)', margin: 0, fontSize: '15px' }} title={a.subject}>
              {a.subject}
            </h2>
            <p className="t-body-medium truncate" style={{ color: 'var(--text-secondary)', margin: '2px 0 0 0', fontWeight: 500, fontSize: '13px' }}>
              {a.title}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {a.isArchived && (
            <span className="badge" style={{
              background: 'rgba(148, 163, 184, 0.15)',
              color: '#94a3b8',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '11px',
            }}>
              <Archive size={11} />
              Archived
            </span>
          )}
          {(a as any).isExpired && !a.isArchived && (
            <span className="badge" style={{
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '11px',
            }}>
              <Archive size={11} />
              Expired
            </span>
          )}
          <span className={`badge ${bdg}`} style={{ fontSize: '11px' }}>{lbl}</span>
          <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            Due • {new Date(a.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
          </span>

          {role === 'cr' ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                    padding: '5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    outline: 'none',
                    color: 'var(--text-secondary)',
                  }}
                  aria-label="More actions"
                  title="More actions"
                >
                  <MoreVertical size={14} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    minWidth: 150,
                    backgroundColor: 'var(--bg-surface-elevated, #1e293b)',
                    borderRadius: 8,
                    padding: 4,
                    boxShadow: '0px 10px 38px -10px rgba(22, 23, 24, 0.35), 0px 10px 20px -15px rgba(22, 23, 24, 0.2)',
                    border: '1px solid var(--border-default, rgba(255, 255, 255, 0.1))',
                    zIndex: 10000,
                  }}
                  sideOffset={5}
                  align="end"
                >
                  <DropdownMenu.Item
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(a);
                    }}
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <Pencil size={13} color="var(--accent-primary, #6366f1)" />
                    <span>Edit</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleArchive(a);
                    }}
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {a.isArchived ? <ArchiveRestore size={13} color="var(--accent-primary)" /> : <Archive size={13} color="var(--text-secondary)" />}
                    <span>{a.isArchived ? 'Restore' : 'Archive'}</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(a);
                    }}
                    style={{
                      fontSize: '13px',
                      color: '#ef4444',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <Trash2 size={13} color="#ef4444" />
                    <span>Delete</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </div>
      </div>

      {a.description ? (
        <p className="t-body" style={{ color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, fontSize: '13px' }}>{a.description}</p>
      ) : null}

      {/* Helpful Student Set Guidance Card */}
      {a.hasSets && userSet ? (
        <div style={{
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(74, 158, 255, 0.2)',
          background: 'linear-gradient(135deg, rgba(74, 158, 255, 0.08) 0%, rgba(74, 158, 255, 0.02) 100%)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your Assigned Set: {userSet.label}
            </span>
            <span className="t-mono-sm" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              Roll {userSet.rollStart}–{userSet.rollEnd}
            </span>
          </div>
          <p className="t-body-medium" style={{ color: 'var(--text-primary)', margin: 0, fontSize: '13.5px', fontWeight: 500, lineHeight: 1.45 }}>
            {userSet.description 
              ? userSet.description 
              : `Solve questions on Pages ${userSet.pageNumbers || '—'} of the attached assignment.`}
          </p>
        </div>
      ) : null}

      {/* Attachments list */}
      {a.attachments && a.attachments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {a.attachments.map(att => (
            <AttachmentCard
              key={att.id}
              attachment={att}
              pageNumber={a.hasSets && userSet ? userSet.pageNumbers : undefined}
            />
          ))}
        </div>
      )}

      {/* Non-set PDF link */}
      {!a.hasSets && a.pdfUrl ? (
        <button
          onClick={() => onOpenPdf(a.pdfUrl!, a.title)}
          className="t-label"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            minHeight: 36,
            width: 'fit-content',
          }}
        >
          <FileText size={13} />
          View PDF
        </button>
      ) : null}

      {isSubmitted ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 12px',
            background: a.crVerified ? 'var(--status-safe-bg)' : 'var(--status-warning-bg)',
            border: a.crVerified ? '1px solid rgba(52,201,123,0.35)' : '1px solid rgba(251,146,60,0.35)',
            borderRadius: 'var(--radius-md)',
            transition: 'all 0.3s ease',
          }}
        >
          <CheckCircle2 size={15} color={a.crVerified ? 'var(--status-safe)' : 'var(--status-warning)'} />
          <p className="t-button" style={{ color: a.crVerified ? 'var(--status-safe)' : 'var(--status-warning)', margin: 0, fontSize: '13px' }}>
            {a.crVerified ? 'Marked ✓' : 'Submitted (Pending from CR)'}
          </p>
        </div>
      ) : (
        <button
          className="t-button active:scale-[0.98] transition-transform duration-150"
          id={`submit-btn-${a.id}`}
          onClick={() => onSubmit(a.id)}
          disabled={isSubmitting}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 14px',
            background: 'var(--accent-primary-glow)',
            border: '1px solid rgba(74,158,255,0.4)',
            borderRadius: 'var(--radius-md)',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            color: 'var(--accent-primary)',
            width: '100%',
            fontWeight: 600,
            fontSize: '13px',
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" size={15} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <CheckCircle2 size={15} />
          )}
          <span>{isSubmitting ? 'Submitting…' : 'Mark as Submitted'}</span>
        </button>
      )}
    </article>
  );
}
