import { supabase } from './supabase';
import { track } from '@vercel/analytics';

type AnalyticsEvent =
  | 'app_opened'
  | 'attendance_updated'
  | 'assignment_viewed'
  | 'assignment_submitted'
  | 'announcement_acknowledged'
  | 'poll_voted'
  | 'profile_viewed';

// Events that also get sent to Vercel track() (free tier budget: 3 events)
const VERCEL_TRACKED: Set<AnalyticsEvent> = new Set([
  'app_opened',
  'attendance_updated',
  'announcement_acknowledged',
]);

export function logEvent(
  event: AnalyticsEvent,
  userId: string,
  sectionId: string,
  data: Record<string, unknown> = {}
) {
  // 1. Supabase INSERT (fire-and-forget, no await needed)
  supabase
    .from('analytics_events')
    .insert({ user_id: userId, section_id: sectionId, event_name: event, event_data: data as any })
    .then(({ error }) => {
      if (error) console.warn('[Analytics] Insert failed:', error.message);
    });

  // 2. Vercel track() for budget-constrained events
  if (VERCEL_TRACKED.has(event)) {
    try {
      track(event, { section_id: sectionId, ...data });
    } catch (err) {
      console.warn('[Analytics] Vercel track failed:', err);
    }
  }
}

const SESSION_KEY = 'classhub_session_tracked';

export function trackAppOpened(userId: string, sectionId: string) {
  if (sessionStorage.getItem(SESSION_KEY)) return;
  sessionStorage.setItem(SESSION_KEY, 'true');
  logEvent('app_opened', userId, sectionId);
}
