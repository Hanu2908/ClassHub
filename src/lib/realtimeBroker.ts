// src/lib/realtimeBroker.ts
import { supabase } from './supabase';

export interface RealtimeCallbacks {
  onAnnouncement?: (payload: any) => void;
  onAssignment?: (payload: any) => void;
  onPoll?: (payload: any) => void;
  onVote?: (payload: any) => void;
  onSubmission?: (payload: any) => void;
  onAcknowledgment?: (payload: any) => void;
}

/**
 * Creates a multiplexed real-time subscription for all section-scoped tables.
 * Decouples views and lifecycle providers from table filters and Supabase channel internals.
 * 
 * @param sectionId The current user's college section ID
 * @param callbacks Event triggers invoked on real-time database transitions
 * @returns A clean unsubscribe cleanup callback
 */
export function subscribeToSection(sectionId: string, callbacks: RealtimeCallbacks): () => void {
  if (import.meta.env.DEV) {
    console.log(`[RealtimeBroker] Spawning section realtime channel: ${sectionId}`);
  }

  const channel = supabase
    .channel(`section-realtime-${sectionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'announcements' },
      (payload) => {
        if (import.meta.env.DEV) console.log('[RealtimeBroker] announcements Postgres event:', payload);
        callbacks.onAnnouncement?.(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'assignments' },
      (payload) => {
        if (import.meta.env.DEV) console.log('[RealtimeBroker] assignments Postgres event:', payload);
        callbacks.onAssignment?.(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'polls' },
      (payload) => {
        if (import.meta.env.DEV) console.log('[RealtimeBroker] polls Postgres event:', payload);
        callbacks.onPoll?.(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'votes' },
      (payload) => {
        if (import.meta.env.DEV) console.log('[RealtimeBroker] votes Postgres event:', payload);
        callbacks.onVote?.(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'submissions' },
      (payload) => {
        if (import.meta.env.DEV) console.log('[RealtimeBroker] submissions Postgres event:', payload);
        callbacks.onSubmission?.(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'acknowledgments' },
      (payload) => {
        if (import.meta.env.DEV) console.log('[RealtimeBroker] acknowledgments Postgres event:', payload);
        callbacks.onAcknowledgment?.(payload);
      }
    )
    .subscribe((status) => {
      if (import.meta.env.DEV) {
        console.log(`[RealtimeBroker] Subscription status for section ${sectionId}:`, status);
      }
    });

  return () => {
    if (import.meta.env.DEV) {
      console.log(`[RealtimeBroker] Tearing down realtime channel for section: ${sectionId}`);
    }
    supabase.removeChannel(channel);
  };
}

interface QAChannelEntry {
  channel: any;
  refCount: number;
  listeners: Set<(payload: any) => void>;
}

const qaSubscriptions = new Map<string, QAChannelEntry>();

/**
 * Creates or reuses a reference-counted real-time websocket channel for announcement Q&A.
 * This pools websocket connections to prevent socket leaks when sibling components render.
 * 
 * @param announcementId The announcement ID to subscribe to
 * @param callbacks Callback refreshers triggered on reactions or comments changes
 * @returns An unsubscribe callback that decrements references and closes the channel when unused
 */
export function subscribeToAnnouncementQA(
  announcementId: string,
  callbacks: {
    onReaction?: (payload: any) => void;
    onComment?: (payload: any) => void;
  }
): () => void {
  const listener = (payload: any) => {
    if (payload.table === 'announcement_reactions') {
      callbacks.onReaction?.(payload);
    } else if (payload.table === 'announcement_comments') {
      callbacks.onComment?.(payload);
    }
  };

  const existing = qaSubscriptions.get(announcementId);

  if (existing) {
    if (import.meta.env.DEV) {
      console.log(`[RealtimeBroker] Re-using active socket connection for announcement Q&A: ${announcementId} (refCount: ${existing.refCount + 1})`);
    }
    existing.refCount++;
    existing.listeners.add(listener);

    return () => {
      existing.listeners.delete(listener);
      existing.refCount--;
      if (existing.refCount === 0) {
        if (import.meta.env.DEV) {
          console.log(`[RealtimeBroker] Closing pooled socket connection for announcement Q&A: ${announcementId}`);
        }
        supabase.removeChannel(existing.channel);
        qaSubscriptions.delete(announcementId);
      }
    };
  }

  if (import.meta.env.DEV) {
    console.log(`[RealtimeBroker] Spawning new pooled socket connection for announcement Q&A: ${announcementId}`);
  }

  const uniqueId = Math.random().toString(36).slice(2, 9);
  const listeners = new Set<(payload: any) => void>([listener]);

  const channel = supabase
    .channel(`announcement-qa-realtime-${announcementId}-${uniqueId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'announcement_reactions',
        filter: `announcement_id=eq.${announcementId}`,
      },
      (payload) => {
        listeners.forEach((l) => l(payload));
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'announcement_comments',
        filter: `announcement_id=eq.${announcementId}`,
      },
      (payload) => {
        listeners.forEach((l) => l(payload));
      }
    )
    .subscribe();

  qaSubscriptions.set(announcementId, {
    channel,
    refCount: 1,
    listeners,
  });

  return () => {
    const active = qaSubscriptions.get(announcementId);
    if (!active) return;
    active.listeners.delete(listener);
    active.refCount--;
    if (active.refCount === 0) {
      if (import.meta.env.DEV) {
        console.log(`[RealtimeBroker] Closing pooled socket connection for announcement Q&A: ${announcementId}`);
      }
      supabase.removeChannel(active.channel);
      qaSubscriptions.delete(announcementId);
    }
  };
}
