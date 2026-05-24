import { supabase } from './supabase';
import { useAppStore } from '../store/appStore';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

/** Get serviceWorker registration with a 3-second timeout to prevent hangs in Dev mode */
async function getSWRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Service Worker ready timeout')), 3000))
    ]);
    return reg;
  } catch (err) {
    console.warn('[Push] Service worker not ready or timed out:', err);
    return null;
  }
}

/** Check if push is supported in this browser */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/** Get current browser permission state */
export function getPushPermission(): NotificationPermission {
  return Notification.permission;
}

/** Check if user has active subscription in DB */
export async function hasActiveSubscription(): Promise<boolean> {
  const { count } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true });
  return (count ?? 0) > 0;
}

/** Subscribe to push notifications + save to DB */
export async function subscribeToPush(): Promise<boolean> {
  try {
    if (!VAPID_PUBLIC_KEY) {
      console.error('[Push] VAPID_PUBLIC_KEY not configured');
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const reg = await getSWRegistration();
    if (!reg) return false;
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      console.error('[Push] Invalid subscription object');
      return false;
    }

    // Save subscription to DB (RLS ensures user_id = auth.uid())
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[Push] No authenticated user');
      return false;
    }

    const { error: upsertError } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }, { onConflict: 'endpoint' });

    if (upsertError) {
      console.error('[Push] Failed to save subscription:', upsertError);
      return false;
    }

    // Set notifications_enabled = true in DB
    const { error: updateError } = await supabase
      .from('users')
      .update({ notifications_enabled: true })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Push] Failed to update user profile notifications state:', updateError);
    } else {
      useAppStore.getState().refreshProfile();
    }

    return true;
  } catch (err) {
    console.error('[Push] Subscribe failed:', err);
    return false;
  }
}

/** Unsubscribe from push + remove from DB */
export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await getSWRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();

    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await supabase.from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ notifications_enabled: false })
        .eq('id', user.id);
      
      if (updateError) {
        console.error('[Push] Failed to update user profile notifications state:', updateError);
      } else {
        useAppStore.getState().refreshProfile();
      }
    }
  } catch (err) {
    console.error('[Push] Unsubscribe failed:', err);
  }
}

/**
 * Heal function: called on app boot / auth ready.
 * If the browser has an active push subscription and permission is granted,
 * ensure it is registered in Supabase. The server may have cleaned up a stale
 * endpoint — this silently re-saves the current subscription so pushes resume
 * without any user action.
 */
export async function ensurePushSubscription(): Promise<void> {
  try {
    if (!isPushSupported()) return;
    if (Notification.permission !== 'granted') return;
    if (!VAPID_PUBLIC_KEY) return;

    const reg = await getSWRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return; // User hasn't subscribed — nothing to heal

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Upsert the current subscription — idempotent if already present
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      console.warn('[Push] ensurePushSubscription upsert failed:', error);
    } else {
      console.log('[Push] Subscription ensured in DB');
    }
  } catch (err) {
    // Non-critical — don't throw, just log
    console.warn('[Push] ensurePushSubscription failed:', err);
  }
}

/** Convert base64-encoded VAPID key to Uint8Array for pushManager */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

