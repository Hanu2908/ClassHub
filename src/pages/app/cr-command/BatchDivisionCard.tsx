import { useState, useEffect } from 'react';
import { SlidersHorizontal, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { useSection } from '../../../hooks/useSectionMembers';
import { useUpdateBatchConfig } from '../../../hooks/useSectionAdmin';
import { SectionHead } from './crCommandShared';
import { toast } from 'sonner';

export function BatchDivisionCard() {
  const { data: section } = useSection();
  const updateBatchConfig = useUpdateBatchConfig();
  const currentEndRoll = section?.batch1EndRoll ?? 30;
  const [cutoff, setCutoff] = useState<number>(currentEndRoll);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (section?.batch1EndRoll) {
      setCutoff(section.batch1EndRoll);
    }
  }, [section?.batch1EndRoll]);

  const handleSave = async () => {
    if (cutoff < 1) {
      toast.error('Cutoff roll must be at least 1');
      return;
    }
    await updateBatchConfig.mutateAsync({
      batch1EndRoll: cutoff,
      applyToExisting,
    });
  };

  return (
    <div className="card" style={{ padding: 0 }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '14px 16px',
          borderRadius: 'var(--radius-lg)',
          userSelect: 'none',
        }}
      >
        <SectionHead
          icon={<SlidersHorizontal size={16} color="var(--accent-primary)" />}
          title="Batch Division Setup"
        />
        {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </div>

      {expanded ? (
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="t-caption" style={{ color: 'var(--text-secondary)' }}>
            Configure automatic sub-batch division for practical labs, tutorials, and attendance rosters.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            background: 'var(--bg-elevated)',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <p className="t-mono-sm" style={{ color: '#60A5FA', fontWeight: 600 }}>BATCH 1 (B1)</p>
              <p className="t-body-medium" style={{ color: 'var(--text-primary)', marginTop: 2 }}>
                Roll 1 to {cutoff}
              </p>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-default)' }}>
              <p className="t-mono-sm" style={{ color: '#A78BFA', fontWeight: 600 }}>BATCH 2 (B2)</p>
              <p className="t-body-medium" style={{ color: 'var(--text-primary)', marginTop: 2 }}>
                Roll {cutoff + 1} onwards
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            <label className="t-label" style={{ color: 'var(--text-secondary)' }}>
              Batch 1 Cutoff (End Roll Number)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min="1"
                max="200"
                value={cutoff}
                onChange={e => setCutoff(parseInt(e.target.value, 10) || 1)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                {[30, 32, 35, 40].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCutoff(val)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: cutoff === val ? 'var(--accent-primary-glow)' : 'var(--bg-elevated)',
                      border: cutoff === val ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                      color: cutoff === val ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
            <input
              type="checkbox"
              checked={applyToExisting}
              onChange={e => setApplyToExisting(e.target.checked)}
              style={{ accentColor: 'var(--accent-primary)', width: 16, height: 16 }}
            />
            <span className="t-caption" style={{ color: 'var(--text-primary)' }}>
              Re-assign all existing students to match this new cutoff
            </span>
          </label>

          <button
            type="button"
            className="btn-primary"
            disabled={updateBatchConfig.isPending}
            onClick={handleSave}
            style={{ marginTop: 6, minHeight: 42 }}
          >
            {updateBatchConfig.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Save Batch Configuration'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
