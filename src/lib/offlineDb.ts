// src/lib/offlineDb.ts

const DB_NAME = 'classhub-offline';
const DB_VERSION = 2;

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
export function openDB(): Promise<IDBDatabase> {
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
      if (!db.objectStoreNames.contains('share-inbox')) {
        db.createObjectStore('share-inbox', { keyPath: 'id' });
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
    console.error('[OfflineDb] Failed to save session:', err);
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
    console.error('[OfflineDb] Failed to read session:', err);
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
    console.error('[OfflineDb] Failed to clear session:', err);
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
    console.error('[OfflineDb] Failed to enqueue action:', err);
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
    console.error('[OfflineDb] Failed to fetch queued actions:', err);
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
    console.error('[OfflineDb] Failed to dequeue action:', err);
  }
}
