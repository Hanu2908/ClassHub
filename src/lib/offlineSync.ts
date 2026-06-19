// src/lib/offlineSync.ts
import { supabase } from './supabase';
import { queryClient } from './queryClient';
import { getQueuedActions, dequeueAction } from './offlineDb';

export { saveSession, getSession, clearSession, enqueueAction, getQueuedActions, dequeueAction } from './offlineDb';
export type { OfflineAction, AuthSession } from './offlineDb';


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
