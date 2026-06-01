import { useEffect, useState } from 'react';
import { ArrowLeft, ClipboardList, Loader2, Megaphone, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileUploader } from '../../components/FileUploader';
import { showToast } from '../../components/Toast';
import { useAppStore } from '../../store/appStore';
import { deleteShare, getShare, updateShare, type ShareInboxEntry } from '../../lib/shareInbox';
import { uploadAttachments } from '../../lib/utils/uploadAttachment';

const ERROR_MESSAGES: Record<string, string> = {
  'empty-share': 'No supported file was shared.',
  'too-many-files': 'Share at most 5 files at a time.',
  'file-too-large': 'Each shared file must be 10 MB or smaller.',
  'unsupported-type': 'ClassHub direct sharing accepts photos and PDFs only.',
  'invalid-share': 'ClassHub could not read this shared item.',
};

export default function ShareIntakePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('id');
  const errorCode = params.get('error');
  const authUser = useAppStore(s => s.authUser);
  const [entry, setEntry] = useState<ShareInboxEntry | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!id) return;
    getShare(id)
      .then(setEntry)
      .catch(() => showToast('Failed to load shared files', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const persist = async (next: ShareInboxEntry) => {
    setEntry(next);
    await updateShare(next);
  };

  const discard = async () => {
    if (entry) await deleteShare(entry.id);
    navigate('/app/home', { replace: true });
  };

  const chooseDestination = async (destination: 'announcement' | 'assignment') => {
    if (!entry) return;
    await persist({ ...entry, destination });
    navigate(`/app/${destination === 'announcement' ? 'announcements' : 'assignments'}`, {
      state: { openCreate: true, shareInboxId: entry.id },
    });
  };

  const retry = async () => {
    if (!entry?.parentId || !entry.destination || !authUser?.sectionId || !authUser.id) return;
    setRetrying(true);
    const result = await uploadAttachments(entry.files, {
      sectionId: authUser.sectionId,
      parentType: entry.destination,
      parentId: entry.parentId,
      userId: authUser.id,
    });
    if (result.failed.length === 0) {
      await deleteShare(entry.id);
      showToast('Missing attachments uploaded', 'success');
      navigate(`/app/${entry.destination === 'announcement' ? 'announcements' : 'assignments'}`, { replace: true });
    } else {
      const failedNames = new Set(result.failed.map((item) => item.filename));
      await persist({ ...entry, files: entry.files.filter((file) => failedNames.has(file.name)) });
      showToast(`${result.failed.length} attachment(s) still need retry`, 'warning');
    }
    setRetrying(false);
  };

  if (authUser?.role !== 'cr') {
    return <Message title="CR access required" body="Only a Class Representative can turn shared files into posts." />;
  }
  if (errorCode) return <Message title="Share could not be imported" body={ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES['invalid-share']} />;
  if (loading) return <Message title="Loading shared files" body="Preparing your WhatsApp attachment..." loading />;
  if (!entry) return <Message title="Shared files expired" body="This local share is unavailable. Share it from WhatsApp again." />;

  return (
    <div className="page-shell" style={{ padding: '20px 16px 32px' }}>
      <button className="btn-secondary" onClick={() => navigate('/app/home')} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <ArrowLeft size={16} /> Home
      </button>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <p className="t-mono-sm" style={{ color: 'var(--accent-primary)', marginBottom: 4 }}>SHARED TO CLASSHUB</p>
          <h1 className="t-page-title" style={{ color: 'var(--text-primary)' }}>Review faculty files</h1>
          <p className="t-body" style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Nothing is uploaded until you choose a post type and publish.</p>
        </div>
        <FileUploader files={entry.files} onChange={(files) => void persist({ ...entry, files })} />
        <div>
          <label htmlFor="shared-caption" className="t-label" style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Imported caption</label>
          <textarea id="shared-caption" value={entry.caption} onChange={(event) => setEntry({ ...entry, caption: event.target.value })} onBlur={() => void updateShare(entry)}
            placeholder="Add or edit details before continuing..."
            style={{ width: '100%', minHeight: 88, padding: '10px 12px', boxSizing: 'border-box', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }} />
        </div>
        {entry.state === 'attachment-retry' ? (
          <button className="btn-primary" disabled={retrying} onClick={() => void retry()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {retrying && <Loader2 className="animate-spin" size={16} />} Retry missing attachments
          </button>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <button className="btn-primary" onClick={() => void chooseDestination('announcement')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Megaphone size={16} /> Post announcement
            </button>
            <button className="btn-secondary" onClick={() => void chooseDestination('assignment')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ClipboardList size={16} /> Create assignment
            </button>
          </div>
        )}
        <button onClick={() => void discard()} style={{ background: 'none', border: 'none', color: 'var(--status-critical)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <Trash2 size={15} /> Discard shared files
        </button>
      </div>
    </div>
  );
}

function Message({ title, body, loading = false }: { title: string; body: string; loading?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="page-shell" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ textAlign: 'center', maxWidth: 380 }}>
        {loading && <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 12px' }} />}
        <h1 className="t-page-title" style={{ color: 'var(--text-primary)' }}>{title}</h1>
        <p className="t-body" style={{ color: 'var(--text-secondary)', margin: '8px 0 16px' }}>{body}</p>
        {!loading && <button className="btn-secondary" onClick={() => navigate('/app/home')}>Back to home</button>}
      </div>
    </div>
  );
}
