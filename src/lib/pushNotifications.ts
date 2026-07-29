import { supabase } from './supabase';
import { useAppStore } from '../store/appStore';

const VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) ||
  'BGRy15iVelRrX3XTTHNTh2lmdAN_NdD05K4N3eKSFY_VS1krsA8M_cX4x4CgblDNoEazFvU8lV1G8edFOWY8iRc';

/** Get serviceWorker registration with a 10-second timeout to prevent hangs on mobile cold boots */
async function getSWRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Service Worker ready timeout')), 10000))
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

/** Check if current browser or account has an active subscription */
export async function hasActiveSubscription(): Promise<boolean> {
  const reg = await getSWRegistration();
  if (reg) {
    const sub = await reg.pushManager.getSubscription().catch(() => null);
    if (sub) return true;
  }
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

    // Safely unsubscribe any stale/mismatched existing subscription first
    const existingSub = await reg.pushManager.getSubscription().catch(() => null);
    if (existingSub) {
      await existingSub.unsubscribe().catch(() => {});
    }

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

    let { error: upsertError } = await supabase.rpc('upsert_push_subscription', {
      sub_endpoint: json.endpoint,
      sub_p256dh: json.keys.p256dh,
      sub_auth: json.keys.auth,
      sub_user_agent: navigator.userAgent
    });

    if (upsertError) {
      console.warn('[Push] RPC upsert_push_subscription failed, attempting direct table upsert:', upsertError);
      const { error: directError } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'endpoint' });

      if (directError) {
        console.error('[Push] Direct push_subscriptions upsert also failed:', directError);
        return false;
      }
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
    if (!VAPID_PUBLIC_KEY) return;

    if (Notification.permission === 'denied') {
      // Permission has been explicitly denied by user. Sync this to the database.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('notifications_enabled')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.notifications_enabled) {
          console.warn('[Push] Permission explicitly denied. Cleaning up...');
          
          const reg = await getSWRegistration();
          if (reg) {
            const sub = await reg.pushManager.getSubscription().catch(() => null);
            if (sub) {
              await supabase.from('push_subscriptions')
                .delete()
                .eq('endpoint', sub.endpoint);
              await sub.unsubscribe().catch(() => {});
            }
          }

          await supabase
            .from('users')
            .update({ notifications_enabled: false })
            .eq('id', user.id);
            
          useAppStore.getState().refreshProfile();
        }
      }
      return;
    }

    if (Notification.permission !== 'granted') {
      // Permission is 'default' (not granted yet). Do NOT delete subscriptions on boot.
      return;
    }

    const reg = await getSWRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return; // User hasn't subscribed — nothing to heal

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Upsert the current subscription — idempotent if already present
    const { error } = await supabase.rpc('upsert_push_subscription', {
      sub_endpoint: json.endpoint,
      sub_p256dh: json.keys.p256dh,
      sub_auth: json.keys.auth,
      sub_user_agent: navigator.userAgent
    });

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

