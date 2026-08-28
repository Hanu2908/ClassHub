import { useState, type CSSProperties } from 'react';
import { BottomSheet } from '../../../components/BottomSheet';
import { useSubjects } from '../../../hooks/useSubjects';
import { useCreateUnitTest } from '../../../hooks/useUnitTests';
import { Loader2, Link2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreateUnitTestModalProps {
  open: boolean;
  onClose: () => void;
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

export function CreateUnitTestModal({ open, onClose }: CreateUnitTestModalProps) {
  const { data: subjectsList = [] } = useSubjects();
  const createUnitTestMutation = useCreateUnitTest();

  const [subjectId, setSubjectId] = useState('');
  const [testType, setTestType] = useState<'UT1' | 'UT2'>('UT1');
  const [title, setTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(Date.now() + 86400000 * 2);
    d.setHours(17, 0, 0, 0);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [maxMarks, setMaxMarks] = useState('10');
  const [description, setDescription] = useState('');

  const resetForm = () => {
    setSubjectId('');
    setTestType('UT1');
    setTitle('');
    setFormUrl('');
    setMaxMarks('10');
    setDescription('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePublish = async () => {
    if (!subjectId) {
      toast.error('Please select a subject');
      return;
    }
    if (!dueDate) {
      toast.error('Please select a due date and time');
      return;
    }

    const trimmedUrl = formUrl.trim();
    if (trimmedUrl && !trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      toast.error('Please enter a valid URL starting with https://');
      return;
    }

    const selectedSubj = subjectsList.find(s => s.id === subjectId);
    const finalTitle = title.trim() || (selectedSubj ? `${selectedSubj.name} - ${testType}` : `Unit Test (${testType})`);

    try {
      await createUnitTestMutation.mutateAsync({
        subjectId,
        testType,
        title: finalTitle,
        formUrl: trimmedUrl || null,
        dueDate: new Date(dueDate).toISOString(),
        maxMarks: parseInt(maxMarks) || 10,
        description: description.trim() || undefined,
      });
      handleClose();
    } catch (err: any) {
      // Error handled by mutation
    }
  };

  return (
    <BottomSheet open={open} onClose={handleClose} title="Create Unit Test">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Test Type Selector */}
        <div>
          <label style={labelStyle}>Target Mid-Term</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              onClick={() => setTestType('UT1')}
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: testType === 'UT1' ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                background: testType === 'UT1' ? 'var(--accent-primary-glow)' : 'var(--bg-elevated)',
                color: testType === 'UT1' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              🧪 Unit Test 1 (Pre-MT1)
            </button>
            <button
              type="button"
              onClick={() => setTestType('UT2')}
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: testType === 'UT2' ? '1px solid var(--accent-primary)' : '1px solid var(--border-default)',
                background: testType === 'UT2' ? 'var(--accent-primary-glow)' : 'var(--bg-elevated)',
                color: testType === 'UT2' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              🧪 Unit Test 2 (Pre-MT2)
            </button>
          </div>
        </div>

        {/* Subject */}
        <div>
          <label style={labelStyle}>Subject <span style={{ color: 'var(--status-critical)' }}>*</span></label>
          <select
            style={inputStyle}
            value={subjectId}
            onChange={e => setSubjectId(e.target.value)}
          >
            <option value="" disabled>Select Subject…</option>
            {subjectsList.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.code ? `(${s.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Test Title / Topics */}
        <div>
          <label style={labelStyle}>Title / Topics (Optional)</label>
          <input
            style={inputStyle}
            placeholder="e.g. Unit 1: Arrays & Probability (default: Subject - UT)"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        {/* Google Form Link */}
        <div>
          <label style={labelStyle}>Google Form Link (Optional)</label>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...inputStyle, paddingLeft: 34 }}
              placeholder="https://forms.google.com/... (can be added later)"
              value={formUrl}
              onChange={e => setFormUrl(e.target.value)}
            />
            <Link2
              size={15}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
        </div>

        {/* Deadline and Max Marks */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Due Date & Time <span style={{ color: 'var(--status-critical)' }}>*</span></label>
            <input
              style={inputStyle}
              type="datetime-local"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Max Marks</label>
            <input
              style={inputStyle}
              type="number"
              min="1"
              max="100"
              value={maxMarks}
              onChange={e => setMaxMarks(e.target.value)}
            />
          </div>
        </div>

        {/* Description / Instructions */}
        <div>
          <label style={labelStyle}>Instructions (Optional)</label>
          <textarea
            style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
            placeholder="e.g. 10 MCQs, 30 min duration. Calculator allowed."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1 }}
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={handlePublish}
            disabled={createUnitTestMutation.isPending}
          >
            {createUnitTestMutation.isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : null}
            {createUnitTestMutation.isPending ? 'Publishing…' : 'Publish Unit Test'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
