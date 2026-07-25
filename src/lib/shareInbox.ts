import { openDB } from './offlineDb';
import { validateSharedFiles } from './utils/attachments';

export const SHARE_INBOX_TTL_MS = 24 * 60 * 60 * 1000;

export type ShareInboxState = 'draft' | 'attachment-retry';
export type ShareDestination = 'announcement' | 'assignment';

export interface ShareInboxEntry {
  id: string;
  createdAt: number;
  expiresAt: number;
  caption: string;
  files: File[];
  state: ShareInboxState;
  destination?: ShareDestination;
  parentId?: string;
}

export function retainFailedShareFiles(
  files: File[],
  failed: { filename: string; error: string }[],
): File[] {
  const failedNames = new Set(failed.map((item) => item.filename));
  return files.filter((file) => failedNames.has(file.name));
}

export async function stageShare(files: File[], caption = ''): Promise<ShareInboxEntry> {
  const isTextShare = caption.trim().length > 0;
  const validation = validateSharedFiles(files, isTextShare);
  if (!validation.ok) throw new Error(validation.error);

  const createdAt = Date.now();
  const entry: ShareInboxEntry = {
    id: `${createdAt}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt,
    expiresAt: createdAt + SHARE_INBOX_TTL_MS,
    caption: caption.trim(),
    files: validation.files,
    state: 'draft',
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction('share-inbox', 'readwrite').objectStore('share-inbox').put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  return entry;
}

export async function getShare(id: string): Promise<ShareInboxEntry | null> {
  const db = await openDB();
  const entry = await new Promise<ShareInboxEntry | null>((resolve, reject) => {
    const request = db.transaction('share-inbox', 'readonly').objectStore('share-inbox').get(id);
    request.onsuccess = () => resolve((request.result as ShareInboxEntry | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });

  if (entry && entry.expiresAt <= Date.now()) {
    await deleteShare(entry.id);
    return null;
  }
  return entry;
}

export async function updateShare(entry: ShareInboxEntry): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction('share-inbox', 'readwrite').objectStore('share-inbox').put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteShare(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction('share-inbox', 'readwrite').objectStore('share-inbox').delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function pruneExpiredShares(): Promise<void> {
  const db = await openDB();
  const entries = await new Promise<ShareInboxEntry[]>((resolve, reject) => {
    const request = db.transaction('share-inbox', 'readonly').objectStore('share-inbox').getAll();
    request.onsuccess = () => resolve((request.result as ShareInboxEntry[]) ?? []);
    request.onerror = () => reject(request.error);
  });
  await Promise.all(entries.filter((entry) => entry.expiresAt <= Date.now()).map((entry) => deleteShare(entry.id)));
}

export async function listPendingShares(): Promise<ShareInboxEntry[]> {
  await pruneExpiredShares();
  const db = await openDB();
  return new Promise<ShareInboxEntry[]>((resolve, reject) => {
    const request = db.transaction('share-inbox', 'readonly').objectStore('share-inbox').getAll();
    request.onsuccess = () => resolve((request.result as ShareInboxEntry[]) ?? []);
    request.onerror = () => reject(request.error);
  });
}
