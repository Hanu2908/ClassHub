import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Share2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/appStore';
import { showToast } from '../../components/Toast';

const classRollRegex = /^\d{2}$/;
const uniRollRegex = /^[0-9]{2}[A-Z]{2,5}[0-9]{3,5}$/;

function randomAlpha(n: number) {
  return Array.from({ length: n }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]).join('');
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p style={{ display: 'flex', alignItems: 'center', gap: 6, font: '500 12px var(--font-body)', color: 'var(--status-critical)', marginTop: 8 }}>
      <AlertCircle size={14} />
      {msg}
    </p>
  );
}

export default function CreateHubPage() {
  const navigate = useNavigate();
  const { setRole, setHub, refreshProfile, authUser } = useAppStore();
  const setAuthUser = useAppStore(s => s.setAuthUser);

  const [sectionCode, setSectionCode] = useState('');
  const [hubName, setHubName] = useState('');
  const [classRoll, setClassRoll] = useState('');
  const [universityRoll, setUniversityRoll] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!sectionCode.trim() || sectionCode.length < 1) e.sectionCode = 'Section code is required (e.g. P2)';
    if (!hubName.trim()) e.hubName = 'Hub name is required';
    if (!classRollRegex.test(classRoll)) e.classRoll = 'Class roll must be exactly 2 digits (01–99)';
    if (!uniRollRegex.test(universityRoll.toUpperCase())) e.universityRoll = 'Enter a valid university roll (e.g. 25ESKCX089)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    // Generate invite code matching DB regex: ^[A-Z0-9]{2}[A-Z]{4}$
    const inviteCode = sectionCode.toUpperCase().slice(0, 2) + randomAlpha(4);

    if (import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true') {
      localStorage.setItem('demo_section_id', 'demo-section');
      // Creator = CR role
      setRole('cr');
      if (authUser) {
        setAuthUser({ ...authUser, role: 'cr', sectionId: 'demo-section' });
      }
      setHub({
        hubCode: inviteCode,
        section: sectionCode.toUpperCase(),
        hubName: hubName,
        institution: 'SKIT',
        classRoll: classRoll,
        universityRoll: universityRoll.toUpperCase(),
      });
      setGeneratedCode(inviteCode);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('create_section_hub', {
        section_name: hubName,
        invite: inviteCode,
        class_roll: classRoll,
        uni_roll: universityRoll.toUpperCase(),
      });

      if (error) throw error;

      // Use the invite_code from the returned section
      const returnedCode = data?.invite_code ?? inviteCode;
      setGeneratedCode(returnedCode);

      // Refresh profile from backend so route guard sees new sectionId + CR role
      await refreshProfile();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create hub';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    showToast('Hub code copied!', 'success');
  };

  const shareCode = async () => {
    if (!generatedCode) return;
    try {
      await navigator.share({ title: 'Join my ClassHub!', text: `Join Section hub with code: ${generatedCode}` });
    } catch {
      copyCode();
    }
  };

  if (generatedCode) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 360, width: '100%', textAlign: 'center', animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <h2 style={{ font: '700 22px var(--font-display)', color: 'var(--text-primary)', marginBottom: 8 }}>Hub Created!</h2>
          <p style={{ font: '400 13px var(--font-body)', color: 'var(--text-secondary)', marginBottom: 24 }}>
            Share this code with students to invite them.
          </p>

          {/* Generated code */}
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border-active)',
            borderRadius: 'var(--radius-md)', padding: '20px 16px', marginBottom: 16,
            boxShadow: 'var(--shadow-glow-blue)',
          }}>
            <p style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)', marginBottom: 8 }}>Your Hub Code</p>
            <p style={{
              font: '700 32px var(--font-mono)', color: 'var(--accent-primary)',
              letterSpacing: '0.18em',
            }}>{generatedCode}</p>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button id="copy-code-btn" className="btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={copyCode}>
              <Copy size={15} /> Copy Code
            </button>
            <button id="share-code-btn" className="btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={shareCode}>
              <Share2 size={15} /> Share
            </button>
          </div>

          <button id="goto-dashboard-btn" className="btn-primary" onClick={() => navigate('/app/home')}>
            Go to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', padding: '0 0 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 0' }}>
        <button
          id="create-back-btn"
          onClick={() => navigate('/onboarding/choice')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 8, marginLeft: -8, display: 'flex' }}
          aria-label="Go back"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ font: '600 18px var(--font-display)', color: 'var(--text-primary)' }}>Create a Hub</h1>
      </div>

      <div style={{ textAlign: 'center', padding: '28px 24px 20px' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--status-safe-bg)', border: '1px solid rgba(52,201,123,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <CheckCircle2 size={26} color="var(--status-safe)" />
        </div>
        <p style={{ font: '600 17px var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 }}>Set up your section</p>
        <p style={{ font: '400 13px var(--font-body)', color: 'var(--text-secondary)' }}>CR access granted after creation</p>
      </div>

      <form onSubmit={handleCreate} style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label style={{ font: '600 14px var(--font-display)', color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
            Section Code <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <input id="section-code-input" className={`input mono${errors.sectionCode ? ' input-error' : ''}`} placeholder="P2" maxLength={3}
            value={sectionCode} onChange={e => setSectionCode(e.target.value.toUpperCase())} />
          <FieldError msg={errors.sectionCode} />
          <p style={{ font: '400 11px var(--font-mono)', color: 'var(--text-muted)', marginTop: 6 }}>e.g. P2, A3, CS1</p>
        </div>

        <div>
          <label style={{ font: '600 14px var(--font-display)', color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
            Hub Name <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <input id="hub-name-input" className={`input${errors.hubName ? ' input-error' : ''}`} placeholder="Section P2 — SKIT"
            value={hubName} onChange={e => setHubName(e.target.value)} />
          <FieldError msg={errors.hubName} />
        </div>

        <div>
          <label style={{ font: '600 14px var(--font-display)', color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
            Class Roll Number <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <input id="cr-class-roll-input" className={`input${errors.classRoll ? ' input-error' : ''}`} placeholder="01" maxLength={2} inputMode="numeric"
            value={classRoll} onChange={e => setClassRoll(e.target.value.replace(/\D/g, ''))} />
          <FieldError msg={errors.classRoll} />
        </div>

        <div>
          <label style={{ font: '600 14px var(--font-display)', color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
            University Roll Number <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <input id="cr-uni-roll-input" className={`input mono${errors.universityRoll ? ' input-error' : ''}`} placeholder="25ESKCX089" maxLength={12}
            value={universityRoll} onChange={e => setUniversityRoll(e.target.value.toUpperCase())} />
          <FieldError msg={errors.universityRoll} />
        </div>

        <button id="create-hub-btn" type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading ? <><Loader2 size={18} className="animate-spin" /> Creating…</> : 'Create Hub'}
        </button>
      </form>
    </div>
  );
}
