// src/lib/offlineSync.ts
import { supabase } from './supabase';
import { queryClient } from './queryClient';
import { getQueuedActions, dequeueAction } from './offlineDb';

export { saveSession, getSession, clearSession, enqueueAction, getQueuedActions, dequeueAction } from './offlineDb';
export type { OfflineAction, AuthSession } from './offlineDb';

/**
 * Helper to identify if a database error is transient (network timeout/offline/gateway error)
 * vs fatal (schema mismatch, RLS restriction, invalid UUID format).
 */
function isTransientError(error: any): boolean {
  if (!error) return false;
  const status = error.status;
  const message = error.message?.toLowerCase() || '';
  if (status === 502 || status === 503 || status === 504 || status === 0) return true;
  if (message.includes('fetch') || message.includes('network') || message.includes('load failed')) return true;
  return false;
}

/**
 * Re-execute all queued offline actions using the active Supabase JS client.
 * Designed to run on the client side when returning online.
 */
export async function playbackOfflineActionsClient(): Promise<void> {
  const actions = await getQueuedActions();
  if (actions.length === 0) return;

  // Retrieve/refresh the session to ensure a valid JWT is set in headers before playing back actions
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    console.warn('[OfflineSync] Aborting playback: active session is missing or invalid.');
    return;
  }

  console.log(`[OfflineSync] Found ${actions.length} queued offline actions. Starting playback...`);

  for (const action of actions) {
    try {
      if (action.type === 'acknowledge') {
        const { announcementId, userId } = action.payload;
        // Resolve fallback placeholder or missing user ID to currently active user ID
        const resolvedUserId = (userId === 'null-fallback' || !userId) ? session.user.id : userId;
        
        const { error } = await supabase.from('acknowledgments').insert({
          announcement_id: announcementId,
          user_id: resolvedUserId,
        });

        // 23505 code = unique key violation (meaning acknowledgment already exists in remote database)
        if (!error || error.code === '23505') {
          await dequeueAction(action.id);
        } else {
          if (isTransientError(error)) {
            console.error(`[OfflineSync] Temporary failure for acknowledgment ${action.id}:`, error);
            break; // Halt loop to maintain action processing order
          } else {
            console.error(`[OfflineSync] Fatal error for acknowledgment ${action.id}, discarding:`, error);
            await dequeueAction(action.id);
          }
        }
      } else if (action.type === 'vote') {
        const { pollId, optionId, pollType, allowMultiple, isSelected, userId } = action.payload;
        // Resolve fallback placeholder or missing user ID to currently active user ID
        const resolvedUserId = (userId === 'null-fallback' || !userId) ? session.user.id : userId;
        const isAnonymous = pollType === 'general' || pollType === 'anonymous';
        let token: string | null = null;

        if (isAnonymous) {
          const { data, error: rpcErr } = await supabase.rpc('calculate_anonymous_token', {
            user_id: resolvedUserId,
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
              deleteQuery.eq('student_id', resolvedUserId);
            }
            const { error: err } = await deleteQuery;
            error = err;
          } else {
            const { error: err } = await supabase.from('votes').insert({
              poll_id: pollId,
              option_id: optionId,
              student_id: isAnonymous ? null : resolvedUserId,
              anonymous_token: token,
            });
            error = err;
          }
        } else {
          const deleteQuery = supabase.from('votes').delete().eq('poll_id', pollId);
          if (isAnonymous) {
            deleteQuery.eq('anonymous_token', token!);
          } else {
            deleteQuery.eq('student_id', resolvedUserId);
          }
          const { error: delErr } = await deleteQuery;
          if (delErr) {
            error = delErr;
          } else if (!isSelected) {
            const { error: err } = await supabase.from('votes').insert({
              poll_id: pollId,
              option_id: optionId,
              student_id: isAnonymous ? null : resolvedUserId,
              anonymous_token: token,
            });
            error = err;
          }
        }

        if (!error || error.code === '23505') {
          await dequeueAction(action.id);
        } else {
          if (isTransientError(error)) {
            console.error(`[OfflineSync] Temporary failure for vote ${action.id}:`, error);
            break; // Halt loop to maintain order
          } else {
            console.error(`[OfflineSync] Fatal error for vote ${action.id}, discarding:`, error);
            await dequeueAction(action.id);
          }
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
