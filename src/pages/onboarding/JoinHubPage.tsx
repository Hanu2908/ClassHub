import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/appStore';
import { toast } from 'sonner';
import OnboardingLoader from '../../components/OnboardingLoader';

const classRollRegex = /^\d{2}$/;
const uniRollRegex = /^[0-9]{2}[A-Z]{5}[0-9]{3}$/;
const hubCodeRegex = /^[A-Z0-9]{2}[A-Z]{4}$/;

interface FormErrors {
  hubCode?: string;
  classRoll?: string;
  universityRoll?: string;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="t-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-critical)', marginTop: 8 }}>
      <AlertCircle size={14} />
      {msg}
    </p>
  );
}

export default function JoinHubPage() {
  const navigate = useNavigate();
  const { setRole, setHub, refreshProfile, authUser } = useAppStore();
  const setAuthUser = useAppStore(s => s.setAuthUser);

  const [hubCode, setHubCode] = useState('');
  const [classRoll, setClassRoll] = useState('');
  const [universityRoll, setUniversityRoll] = useState('');
  const [dayScholar, setDayScholar] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Load and pre-fill pending invite code from URL parameters or sessionStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('invite') || params.get('code');
    const storedCode = sessionStorage.getItem('classhub-pending-invite-code');
    const activeCode = urlCode || storedCode;

    if (activeCode && hubCodeRegex.test(activeCode.toUpperCase())) {
      setHubCode(activeCode.toUpperCase());
      
      // Clean up sessionStorage
      sessionStorage.removeItem('classhub-pending-invite-code');
      
      // Clean up URL parameters to keep the URL address bar clean
      if (urlCode) {
        const newParams = new URLSearchParams(window.location.search);
        newParams.delete('invite');
        newParams.delete('code');
        const cleanSearch = newParams.toString();
        const cleanUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
        window.history.replaceState(null, '', cleanUrl);
      }
    }
  }, []);

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
    setIsComplete(false);

    if (import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true') {
      localStorage.setItem('demo_section_id', 'demo-section');
      // Join = student role
      setRole('student');
      if (authUser) {
        setAuthUser({ ...authUser, role: 'student', sectionId: 'demo-section', dayScholar });
      }
      setHub({
        hubCode: hubCode,
        section: 'Demo Section',
        hubName: 'Demo Hub',
        institution: 'SKIT',
        classRoll: classRoll,
        universityRoll: universityRoll.toUpperCase(),
      });
      setIsComplete(true);
      return;
    }

    try {
      const { error } = await supabase.rpc('join_section', {
        invite: hubCode.toUpperCase(),
        class_roll: classRoll,
        uni_roll: universityRoll.toUpperCase(),
      });

      if (error) throw error;

      // Update day_scholar status in profile
      const { data: { user: authUserObj } } = await supabase.auth.getUser();
      if (authUserObj) {
        await supabase
          .from('users')
          .update({ day_scholar: dayScholar })
          .eq('id', authUserObj.id);
      }

      // Refresh profile from backend so route guard sees new sectionId
      await refreshProfile();
      setIsComplete(true);
    } catch (err: unknown) {
      setLoading(false);
      const message = err instanceof Error ? err.message : 'Failed to join hub';
      if (message.includes('Invalid invite code')) {
        setErrors({ hubCode: 'Invalid invite code. Double-check with your CR.' });
      } else {
        toast.error(message);
      }
    }
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
        <h1 className="t-page-title" style={{ color: 'var(--text-primary)' }}>Join a Hub</h1>
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
        <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 6 }}>
          Enter your hub details
        </p>
        <p className="t-body" style={{ color: 'var(--text-secondary)' }}>
          Get the code from your Class Rep
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Hub Code */}
        <div>
          <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
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
          <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
            e.g. P2WXYZ — get this from your CR
          </p>
        </div>

        {/* Class Roll */}
        <div>
          <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
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
          <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
            Your 2-digit class roll (e.g. 17)
          </p>
        </div>

        {/* University Roll */}
        <div>
          <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
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
          <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
            e.g. 25ESKCX089
          </p>
        </div>

        {/* Commuter Status (Day Scholar vs. Hosteler) */}
        <div>
          <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
            Commuter Status <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <div style={{
            display: 'flex',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: 4,
            gap: 4
          }}>
            <button
              type="button"
              onClick={() => setDayScholar(true)}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: dayScholar ? 'var(--accent-primary)' : 'transparent',
                color: dayScholar ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.2s ease'
              }}
            >
              <span>🚌</span> Day Scholar
            </button>
            <button
              type="button"
              onClick={() => setDayScholar(false)}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: !dayScholar ? 'var(--accent-primary)' : 'transparent',
                color: !dayScholar ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.2s ease'
              }}
            >
              <span>🏠</span> Hosteler
            </button>
          </div>
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

      {loading && (
        <OnboardingLoader
          type="join"
          isComplete={isComplete}
          onFinished={() => {
            toast.success('Joined hub successfully! Welcome 🎉');
            navigate('/app/home');
          }}
        />
      )}
    </div>
  );
}
