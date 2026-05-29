// src/lib/offlineSync.ts
import { supabase } from './supabase';
import { queryClient } from './queryClient';

const DB_NAME = 'classhub-offline';
const DB_VERSION = 1;

export interface OfflineAction {
  id: string;
  type: 'acknowledge' | 'vote';
  payload: any;
  timestamp: number;
}

export interface AuthSession {
  token: string;
  userId: string;
}

/**
 * Open or upgrade the offline IndexedDB database.
 * Works seamlessly in both the window and service worker global scopes.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('auth-session')) {
        db.createObjectStore('auth-session', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('offline-actions')) {
        db.createObjectStore('offline-actions', { keyPath: 'id' });
      }
    };
  });
}

/**
 * Save the active user session so that the Service Worker can read it for background actions.
 */
export async function saveSession(token: string, userId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('auth-session', 'readwrite');
      const store = transaction.objectStore('auth-session');
      const request = store.put({ key: 'session', token, userId });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[OfflineSync] Failed to save session:', err);
  }
}

/**
 * Retrieve the active user session.
 */
export async function getSession(): Promise<AuthSession | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('auth-session', 'readonly');
      const store = transaction.objectStore('auth-session');
      const request = store.get('session');

      request.onsuccess = () => {
        if (request.result) {
          resolve({
            token: request.result.token,
            userId: request.result.userId,
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[OfflineSync] Failed to read session:', err);
    return null;
  }
}

/**
 * Delete the active user session on sign out.
 */
export async function clearSession(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('auth-session', 'readwrite');
      const store = transaction.objectStore('auth-session');
      const request = store.delete('session');

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[OfflineSync] Failed to clear session:', err);
  }
}

/**
 * Add a mutation request to the offline queue.
 */
export async function enqueueAction(type: 'acknowledge' | 'vote', payload: any): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const action: OfflineAction = {
    id,
    type,
    payload,
    timestamp: Date.now(),
  };

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('offline-actions', 'readwrite');
      const store = transaction.objectStore('offline-actions');
      const request = store.put(action);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[OfflineSync] Failed to enqueue action:', err);
    return id;
  }
}

/**
 * Retrieve all currently queued offline actions.
 */
export async function getQueuedActions(): Promise<OfflineAction[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('offline-actions', 'readonly');
      const store = transaction.objectStore('offline-actions');
      const request = store.getAll();

      request.onsuccess = () => {
        const actions: OfflineAction[] = request.result || [];
        // Sort actions chronologically by timestamp
        actions.sort((a, b) => a.timestamp - b.timestamp);
        resolve(actions);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[OfflineSync] Failed to fetch queued actions:', err);
    return [];
  }
}

/**
 * Dequeue a processed action by ID.
 */
export async function dequeueAction(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('offline-actions', 'readwrite');
      const store = transaction.objectStore('offline-actions');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[OfflineSync] Failed to dequeue action:', err);
  }
}

/**
 * Re-execute all queued offline actions using the active Supabase JS client.
 * Designed to run on the client side when returning online.
 */
export async function playbackOfflineActionsClient(): Promise<void> {
  const actions = await getQueuedActions();
  if (actions.length === 0) return;

  console.log(`[OfflineSync] Found ${actions.length} queued offline actions. Starting playback...`);

  for (const action of actions) {
    try {
      if (action.type === 'acknowledge') {
        const { announcementId, userId } = action.payload;
        const { error } = await supabase.from('acknowledgments').insert({
          announcement_id: announcementId,
          user_id: userId,
        });

        // 23505 code = unique key violation (meaning acknowledgment already exists in remote database)
        if (!error || error.code === '23505') {
          await dequeueAction(action.id);
        } else {
          console.error(`[OfflineSync] Temporary failure for acknowledgment ${action.id}:`, error);
          break; // Halt loop to maintain action processing order
        }
      } else if (action.type === 'vote') {
        const { pollId, optionId, pollType, allowMultiple, isSelected, userId } = action.payload;
        const isAnonymous = pollType === 'general' || pollType === 'anonymous';
        let token: string | null = null;

        if (isAnonymous) {
          const { data, error: rpcErr } = await supabase.rpc('calculate_anonymous_token', {
            user_id: userId,
            poll_id: pollId,
          });
          if (rpcErr) throw rpcErr;
          token = data;
        }

        let error: any = null;

        if (allowMultiple) {
          if (isSelected) {
            const deleteQuery = supabase.from('votes').delete().eq('option_id', optionId);
            if (isAnonymous) {
              deleteQuery.eq('anonymous_token', token!);
            } else {
              deleteQuery.eq('student_id', userId);
            }
            const { error: err } = await deleteQuery;
            error = err;
          } else {
            const { error: err } = await supabase.from('votes').insert({
              poll_id: pollId,
              option_id: optionId,
              student_id: isAnonymous ? null : userId,
              anonymous_token: token,
            });
            error = err;
          }
        } else {
          const deleteQuery = supabase.from('votes').delete().eq('poll_id', pollId);
          if (isAnonymous) {
            deleteQuery.eq('anonymous_token', token!);
          } else {
            deleteQuery.eq('student_id', userId);
          }
          const { error: delErr } = await deleteQuery;
          if (delErr) {
            error = delErr;
          } else if (!isSelected) {
            const { error: err } = await supabase.from('votes').insert({
              poll_id: pollId,
              option_id: optionId,
              student_id: isAnonymous ? null : userId,
              anonymous_token: token,
            });
            error = err;
          }
        }

        if (!error || error.code === '23505') {
          await dequeueAction(action.id);
        } else {
          console.error(`[OfflineSync] Temporary failure for vote ${action.id}:`, error);
          break; // Halt loop to maintain order
        }
      }
    } catch (err) {
      console.error(`[OfflineSync] Error playing back action ${action.id}:`, err);
      break;
    }
  }

  // Invalidate queries to refresh the React UI state with remote changes
  try {
    queryClient.invalidateQueries({ queryKey: ['announcements'] });
    queryClient.invalidateQueries({ queryKey: ['section_acknowledgments'] });
    queryClient.invalidateQueries({ queryKey: ['polls'] });
  } catch {
    // Ignore if queryClient cannot be imported (e.g. in some isolated worker testing contexts)
  }
}
