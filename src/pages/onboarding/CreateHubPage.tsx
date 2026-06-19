import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/appStore';
import { toast } from 'sonner';
import OnboardingLoader from '../../components/OnboardingLoader';

const classRollRegex = /^\d{2}$/;
const uniRollRegex = /^[0-9]{2}[A-Z]{5}[0-9]{3}$/;

function randomAlpha(n: number) {
  return Array.from({ length: n }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]).join('');
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

export default function CreateHubPage() {
  const navigate = useNavigate();
  const { setRole, setHub, refreshProfile, authUser } = useAppStore();
  const setAuthUser = useAppStore(s => s.setAuthUser);

  const [sectionCode, setSectionCode] = useState('');
  const [hubName, setHubName] = useState('');
  const [classRoll, setClassRoll] = useState('');
  const [universityRoll, setUniversityRoll] = useState('');
  const [dayScholar, setDayScholar] = useState(true);
  const [batch, setBatch] = useState('1');
  const [phone, setPhone] = useState('');
  const [branch, setBranch] = useState('Computer Science & Engineering');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const pendingCodeRef = useRef<string>('');

  const validate = () => {
    const e: Record<string, string> = {};
    const trimmedCode = sectionCode.trim();
    if (!trimmedCode) {
      e.sectionCode = 'Section code is required (e.g. P)';
    } else if (trimmedCode.replace(/[^A-Z0-9]/gi, '').length < 1) {
      e.sectionCode = 'Must contain at least one letter or number';
    } else if (/^[A-Z]+[12]$/i.test(trimmedCode)) {
      e.sectionCode = `Enter the full section code (e.g. '${trimmedCode.slice(0, -1)}' instead of '${trimmedCode}'). Batches are split automatically.`;
    }
    if (!hubName.trim()) e.hubName = 'Hub name is required';
    if (!classRollRegex.test(classRoll)) e.classRoll = 'Class roll must be exactly 2 digits (01–99)';
    if (!uniRollRegex.test(universityRoll.toUpperCase())) e.universityRoll = 'Enter a valid university roll (e.g. 25ESKCX089)';
    if (!phone.trim()) {
      e.phone = 'Phone number is required';
    } else if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      e.phone = 'Enter a valid 10-digit Indian phone number (starting with 6-9)';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setIsComplete(false);

    const prefix = sectionCode.toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(2, 'X').slice(0, 2);
    const inviteCode = prefix + randomAlpha(4);

    if (import.meta.env.DEV && localStorage.getItem('demo_mode') === 'true') {
      localStorage.setItem('demo_section_id', 'demo-section');
      setRole('cr');
      if (authUser) {
        setAuthUser({ 
          ...authUser, 
          role: 'cr', 
          sectionId: 'demo-section', 
          dayScholar, 
          subBatch: batch,
          phone: phone.trim(),
          branch: branch
        });
      }
      setHub({
        hubCode: inviteCode,
        section: sectionCode.toUpperCase(),
        hubName: hubName,
        institution: 'SKIT',
        classRoll: classRoll,
        universityRoll: universityRoll.toUpperCase(),
      });
      useAppStore.getState().setOfflineCache('section', {
        id: 'demo-section',
        name: sectionCode.toUpperCase(),
        college: 'SKIT',
        inviteCode: inviteCode,
        teacherInviteCode: 'T-DEMOCO',
        createdBy: authUser?.id || 'demo-user-id',
        branch: branch
      } as any);
      pendingCodeRef.current = inviteCode;
      setIsComplete(true);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('create_section_hub', {
        section_name: hubName,
        invite: inviteCode,
        class_roll: classRoll,
        uni_roll: universityRoll.toUpperCase(),
        p_branch: branch,
        p_phone: phone.trim(),
      });

      if (error) throw error;

      const returnedCode = data?.invite_code ?? inviteCode;
      pendingCodeRef.current = returnedCode;

      const { data: { user: authUserObj } } = await supabase.auth.getUser();
      if (authUserObj) {
        await supabase
          .from('users')
          .update({ 
            day_scholar: dayScholar, 
            sub_batch: batch,
            phone: phone.trim(),
            branch: branch
          })
          .eq('id', authUserObj.id);
      }

      await refreshProfile();
      setIsComplete(true);
    } catch (err: unknown) {
      setLoading(false);
      const message = err instanceof Error ? err.message : 'Failed to create section hub';
      if (message.includes('duplicate key value') || message.includes('already exists')) {
        setErrors({ sectionCode: 'Section hub already exists. Ask other CR for invite code!' });
      } else {
        toast.error(message);
      }
    }
  };

  if (generatedCode) {
    const directLink = `${window.location.origin}/onboarding/join?invite=${generatedCode}`;

    const handleShare = async () => {
      try {
        await navigator.share({ title: 'Join my ClassHub!', text: `Join Section hub with code: ${generatedCode}` });
      } catch {
        try {
          await navigator.clipboard.writeText(directLink);
          toast.success('Direct link copied to clipboard!');
        } catch {
          toast.error('Could not share or copy link');
        }
      }
    };

    return (
      <div className="card text-center animate-fade-in" style={{ padding: '32px 24px', maxWidth: 400, margin: '40px auto 20px' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: 'rgba(74,158,255,0.08)',
          display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', marginBottom: 16
        }}>
          <CheckCircle2 size={28} color="var(--accent-primary)" />
        </div>
        <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Hub Created Successfully!</p>
        <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
          Your Section Hub invite code is active. Share it with your classmates.
        </p>

        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
          padding: '16px 20px', marginBottom: 24
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Class Invite Code
          </span>
          <span className="t-page-title mono" style={{ letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
            {generatedCode}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-secondary" onClick={() => {
            navigator.clipboard.writeText(generatedCode);
            toast.success('Code copied!');
          }} style={{ flex: 1 }}>
            Copy Code
          </button>
          <button className="btn-primary" onClick={handleShare} style={{ flex: 1 }}>
            Share Link
          </button>
        </div>

        <button className="btn-secondary" onClick={() => navigate('/app/home')} style={{ width: '100%', marginTop: 16 }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', padding: '0 0 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 0' }}>
        <button
          id="create-back-btn"
          onClick={() => navigate('/onboarding/choice')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 8, marginLeft: -8, display: 'flex' }}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <BookOpen size={18} color="var(--accent-primary)" />
        <h1 className="t-page-title" style={{ color: 'var(--text-primary)' }}>Create Section Hub</h1>
      </div>

      <div style={{ padding: '32px 24px 16px', textAlign: 'center' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', background: 'rgba(46, 213, 115, 0.08)',
          display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', marginBottom: 14
        }}>
          <CheckCircle2 size={26} color="var(--status-safe)" />
        </div>
        <p className="t-card-title" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>Set up your section</p>
        <p className="t-body" style={{ color: 'var(--text-secondary)' }}>CR access granted after creation</p>
      </div>

      <form onSubmit={handleCreate} style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
            Section Code <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <input id="section-code-input" className={`input mono${errors.sectionCode ? ' input-error' : ''}`} placeholder="P" maxLength={3}
            value={sectionCode} onChange={e => setSectionCode(e.target.value.toUpperCase())} />
          <FieldError msg={errors.sectionCode} />
          <p className="t-mono-sm" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
            e.g. P, S, A (Enter the full section code. Batches like P1, P2 are generated automatically)
          </p>
        </div>

        <div>
          <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
            Hub Name <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <input id="hub-name-input" className={`input${errors.hubName ? ' input-error' : ''}`} placeholder="Section P — SKIT"
            value={hubName} onChange={e => setHubName(e.target.value)} />
          <FieldError msg={errors.hubName} />
        </div>

        <div>
          <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
            Branch <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <select
            id="branch-select"
            className="input"
            value={branch}
            onChange={e => setBranch(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '12px' }}
          >
            <option value="Computer Science & Engineering">Computer Science & Engineering</option>
            <option value="Information Technology">Information Technology</option>
            <option value="Electronics & Communication Engineering">Electronics & Communication Engineering</option>
            <option value="Electrical Engineering">Electrical Engineering</option>
            <option value="Mechanical Engineering">Mechanical Engineering</option>
            <option value="Civil Engineering">Civil Engineering</option>
            <option value="CSE (Artificial Intelligence)">CSE (Artificial Intelligence)</option>
            <option value="CSE (Data Science)">CSE (Data Science)</option>
            <option value="CSE (IoT)">CSE (IoT)</option>
          </select>
        </div>

        <div>
          <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
            Phone Number <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
            <span style={{
              background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', padding: '0 12px', color: 'var(--text-muted)',
              fontFamily: 'monospace', borderRight: '1px solid var(--border-default)', fontSize: 14
            }}>+91</span>
            <input
              id="phone-input"
              type="tel"
              className={`input${errors.phone ? ' input-error' : ''}`}
              placeholder="9314293931"
              maxLength={10}
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
              style={{ flex: 1, border: 'none', borderRadius: 0, outline: 'none' }}
            />
          </div>
          <FieldError msg={errors.phone} />
        </div>

        <div>
          <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
            Class Roll Number <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <input id="cr-class-roll-input" className={`input${errors.classRoll ? ' input-error' : ''}`} placeholder="01" maxLength={2} inputMode="numeric"
            value={classRoll} onChange={e => setClassRoll(e.target.value.replace(/\D/g, ''))} />
          <FieldError msg={errors.classRoll} />
        </div>

        <div>
          <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
            University Roll Number <span style={{ color: 'var(--status-critical)' }}>*</span>
          </label>
          <input id="cr-uni-roll-input" className={`input mono${errors.universityRoll ? ' input-error' : ''}`} placeholder="25ESKCX089" maxLength={12}
            value={universityRoll} onChange={e => setUniversityRoll(e.target.value.toUpperCase())} />
          <FieldError msg={errors.universityRoll} />
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

        {/* Batch Selection (Batch 1 vs. Batch 2) */}
        <div>
          <label className="t-subtitle" style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8, letterSpacing: '-0.01em' }}>
            Batch <span style={{ color: 'var(--status-critical)' }}>*</span>
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
              onClick={() => setBatch('1')}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: batch === '1' ? 'var(--accent-primary)' : 'transparent',
                color: batch === '1' ? '#fff' : 'var(--text-secondary)',
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
              Batch 1
            </button>
            <button
              type="button"
              onClick={() => setBatch('2')}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: batch === '2' ? 'var(--accent-primary)' : 'transparent',
                color: batch === '2' ? '#fff' : 'var(--text-secondary)',
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
              Batch 2
            </button>
          </div>
        </div>

        <button id="create-hub-btn" type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading ? <><Loader2 size={18} className="animate-spin" /> Creating…</> : 'Create Hub'}
        </button>
      </form>

      {loading && (
        <OnboardingLoader
          type="create"
          isComplete={isComplete}
          onFinished={() => {
            setGeneratedCode(pendingCodeRef.current);
            setLoading(false);
          }}
        />
      )}
    </div>
  );
}
