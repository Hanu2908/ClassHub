import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { showToast } from '../../components/Toast';

const classRollRegex = /^\d{2}$/;
const uniRollRegex = /^[0-9]{2}[A-Z]{2,5}[0-9]{3,5}$/;
const hubCodeRegex = /^[A-Z0-9]{2}[A-Z]{4}$/;

interface FormErrors {
  hubCode?: string;
  classRoll?: string;
  universityRoll?: string;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p style={{ font: '400 11px var(--font-mono)', color: 'var(--status-critical)', marginTop: 6 }}>{msg}</p>;
}

export default function JoinHubPage() {
  const navigate = useNavigate();
  const { setHub, setRole, setFirstTime } = useAppStore();

  const [hubCode, setHubCode] = useState('');
  const [classRoll, setClassRoll] = useState('');
  const [universityRoll, setUniversityRoll] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!hubCodeRegex.test(hubCode)) e.hubCode = 'Enter a valid 6-character hub code (e.g. P2WXYZ)';
    if (!classRollRegex.test(classRoll)) e.classRoll = 'Class roll must be exactly 2 digits (01–99)';
    if (!uniRollRegex.test(universityRoll.toUpperCase())) e.universityRoll = 'Enter a valid university roll (e.g. 25ESKCX089)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    const section = hubCode.slice(0, 2).toUpperCase();
    setHub({
      hubCode: hubCode.toUpperCase(),
      section,
      hubName: `Section ${section}`,
      institution: 'SKIT Jaipur',
      classRoll,
      universityRoll: universityRoll.toUpperCase(),
    });
    setRole('student');
    setFirstTime(true);
    setLoading(false);
    showToast('Joined hub successfully! Welcome 🎉', 'success');
    navigate('/app/home');
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', padding: '0 0 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 0' }}>
        <button
          id="join-back-btn"
          onClick={() => navigate('/onboarding/choice')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 8, marginLeft: -8, display: 'flex' }}
          aria-label="Go back"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ font: '600 18px var(--font-display)', color: 'var(--text-primary)' }}>Join a Hub</h1>
      </div>

      {/* Icon + subtitle */}
      <div style={{ textAlign: 'center', padding: '32px 24px 24px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--accent-primary-glow)', border: '1px solid rgba(74,158,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <Lock size={26} color="var(--accent-primary)" />
        </div>
        <p style={{ font: '600 17px var(--font-display)', color: 'var(--text-primary)', marginBottom: 6 }}>
          Enter your hub details
        </p>
        <p style={{ font: '400 13px var(--font-body)', color: 'var(--text-secondary)' }}>
          Get the code from your Class Rep
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Hub Code */}
        <div>
          <label style={{ font: '500 13px var(--font-body)', color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
            Hub Code <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <input
            id="hub-code-input"
            className={`input mono${errors.hubCode ? ' input-error' : ''}`}
            placeholder="P2WXYZ"
            maxLength={6}
            value={hubCode}
            onChange={e => setHubCode(e.target.value.toUpperCase())}
            onBlur={() => {
              if (hubCode && !hubCodeRegex.test(hubCode))
                setErrors(p => ({ ...p, hubCode: 'Enter a valid 6-character hub code (e.g. P2WXYZ)' }));
              else setErrors(p => ({ ...p, hubCode: undefined }));
            }}
            style={{ letterSpacing: '0.2em', fontSize: 20, textAlign: 'center' }}
          />
          <FieldError msg={errors.hubCode} />
          <p style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)', marginTop: 6 }}>
            e.g. P2WXYZ — get this from your CR
          </p>
        </div>

        {/* Class Roll */}
        <div>
          <label style={{ font: '500 13px var(--font-body)', color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
            Class Roll Number <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <input
            id="class-roll-input"
            className={`input${errors.classRoll ? ' input-error' : ''}`}
            placeholder="17"
            maxLength={2}
            inputMode="numeric"
            value={classRoll}
            onChange={e => setClassRoll(e.target.value.replace(/\D/g, ''))}
            onBlur={() => {
              if (classRoll && !classRollRegex.test(classRoll))
                setErrors(p => ({ ...p, classRoll: 'Class roll must be exactly 2 digits (01–99)' }));
              else setErrors(p => ({ ...p, classRoll: undefined }));
            }}
          />
          <FieldError msg={errors.classRoll} />
          <p style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)', marginTop: 6 }}>
            Your 2-digit class roll (e.g. 17)
          </p>
        </div>

        {/* University Roll */}
        <div>
          <label style={{ font: '500 13px var(--font-body)', color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
            University Roll Number <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <input
            id="uni-roll-input"
            className={`input mono${errors.universityRoll ? ' input-error' : ''}`}
            placeholder="25ESKCX089"
            maxLength={12}
            value={universityRoll}
            onChange={e => setUniversityRoll(e.target.value.toUpperCase())}
            onBlur={() => {
              const v = universityRoll.toUpperCase();
              if (v && !uniRollRegex.test(v))
                setErrors(p => ({ ...p, universityRoll: 'Enter a valid university roll (e.g. 25ESKCX089)' }));
              else setErrors(p => ({ ...p, universityRoll: undefined }));
            }}
          />
          <FieldError msg={errors.universityRoll} />
          <p style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)', marginTop: 6 }}>
            e.g. 25ESKCX089
          </p>
        </div>

        <button
          id="join-hub-btn"
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {loading ? <><Loader2 size={18} className="animate-spin" /> Joining…</> : 'Join Hub'}
        </button>
      </form>
    </div>
  );
}
