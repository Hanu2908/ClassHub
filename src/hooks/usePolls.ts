import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type { Poll, PollOption } from '../store/appStore';
import { pollSchema } from '../lib/validation/polls.schema';
import { enqueueAction } from '../lib/offlineSync';

// ── Helper: current user context ─────────────────────────────────────────────

function useAuthContext() {
  const authUser = useAppStore(s => s.authUser);
  const session = useAppStore(s => s.session);
  const isAuthLoading = useAppStore(s => s.isAuthLoading);
  const isDemo = authUser?.sectionId === 'demo-section';
  const isAuthenticated = !!session || isDemo;
  return {
    userId: authUser?.id ?? null,
    sectionId: authUser?.sectionId ?? null,
    role: authUser?.role ?? 'student',
    isAuthLoading,
    isAuthenticated,
  };
}

type PollOptionRelation = { id: string; label: string; sort_order: number };
interface VoteRow {
  option_id: string;
  student_id: string;
  users: {
    name: string;
    section_roll: string | null;
  } | null;
}

// ── Polls Query ──────────────────────────────────────────────────────────────

export function usePolls() {
  const { sectionId, userId, isAuthenticated } = useAuthContext();
  const queryResult = useQuery<Poll[]>({
    queryKey: ['polls', sectionId, userId],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60, // 1 minute
    queryFn: async () => {
      try {
        const { data: polls, error } = await supabase
          .from('polls')
          .select(`
            id, question_text, poll_type, is_active, expires_at, created_at, allow_multiple,
            poll_options (id, label, sort_order)
          `)
          .eq('section_id', sectionId!)
          .order('created_at', { ascending: false });
        if (error) throw error;

        const pollArray = polls ?? [];
        const pollIds = pollArray.map(p => p.id);
        const results: Record<string, Record<string, number>> = {};
        const voterCounts: Record<string, number> = {};
        const userVotes: Record<string, string[]> = {};

        if (pollIds.length > 0) {
          // Fetch aggregate vote counts, voter counts, and current user's votes concurrently
          const [resultsRes, voterCountsRes, myVotesRes] = await Promise.all([
            supabase.rpc('batch_poll_results', { target_polls: pollIds }),
            supabase.rpc('batch_poll_voter_counts', { target_polls: pollIds }),
            userId
              ? supabase.from('votes').select('poll_id, option_id').in('poll_id', pollIds)
              : Promise.resolve({ data: [], error: null })
          ]);

          if (resultsRes.error) throw resultsRes.error;
          if (voterCountsRes.error) throw voterCountsRes.error;
          if (myVotesRes.error) throw myVotesRes.error;

          for (const r of resultsRes.data ?? []) {
            if (!results[r.poll_id]) results[r.poll_id] = {};
            results[r.poll_id][r.option_id] = r.votes;
          }

          for (const vc of voterCountsRes.data ?? []) {
            voterCounts[vc.poll_id] = Number(vc.voter_count);
          }

          for (const mv of myVotesRes.data ?? []) {
            if (!userVotes[mv.poll_id]) {
              userVotes[mv.poll_id] = [];
            }
            userVotes[mv.poll_id].push(mv.option_id);
          }
        }

        const result = pollArray.map(p => {
          const opts = ((p.poll_options ?? []) as PollOptionRelation[]).sort((a, b) => a.sort_order - b.sort_order);
          const isActive = p.is_active && (!p.expires_at || new Date(p.expires_at) > new Date());

          const options: PollOption[] = opts.map((o) => ({
            id: o.id,
            text: o.label,
            votes: results[p.id]?.[o.id] ?? 0,
          }));

          const myVotesForPoll = userVotes[p.id] ?? [];

          return {
            id: p.id,
            question: p.question_text,
            type: p.poll_type === 'general' ? 'anonymous' as const : 'actionable' as const,
            closesAt: p.expires_at ?? new Date(Date.now() + 7 * 86400000).toISOString(),
            status: isActive ? 'active' as const : 'closed' as const,
            options,
            createdAt: p.created_at,
            allowMultiple: p.allow_multiple ?? false,
            userVotes: myVotesForPoll,
            userVote: myVotesForPoll[0] ?? null, // Backward compatibility
            voterCount: voterCounts[p.id] ?? 0,
          };
        });

        useAppStore.getState().setOfflineCache('polls', result);
        return result;
      } catch (err) {
        console.error('[usePolls] Query failed, returning offline cache:', err);
        const cached = useAppStore.getState().offlineCache?.polls;
        if (cached) return cached;
        throw err;
      }
    },
  });

  const optimisticVotes = useAppStore(s => s.optimisticVotes);
  const data = useMemo(() => {
    if (!queryResult.data) return queryResult.data;
    return queryResult.data.map(poll => {
      const localVotes = optimisticVotes[poll.id];
      if (!localVotes) return poll;

      const localVoteSet = new Set(localVotes);
      const dbVoteSet = new Set(poll.userVotes);

      // Overlay userVotes state
      const userVotes = localVotes;
      const userVote = localVotes[0] ?? null;

      // Adjust options' vote counts
      const options = poll.options.map(opt => {
        let votes = opt.votes;
        const inDb = dbVoteSet.has(opt.id);
        const inLocal = localVoteSet.has(opt.id);

        if (inLocal && !inDb) {
          votes += 1;
        } else if (!inLocal && inDb) {
          votes = Math.max(0, votes - 1);
        }

        return { ...opt, votes };
      });

      // Adjust voterCount total
      const hadDbVotes = dbVoteSet.size > 0;
      const hasLocalVotes = localVoteSet.size > 0;
      let voterCount = poll.voterCount ?? 0;

      if (hasLocalVotes && !hadDbVotes) {
        voterCount += 1;
      } else if (!hasLocalVotes && hadDbVotes) {
        voterCount = Math.max(0, voterCount - 1);
      }

      return {
        ...poll,
        userVotes,
        userVote,
        options,
        voterCount,
      };
    });
  }, [queryResult.data, optimisticVotes]);

  return { ...queryResult, data };
}

// ── Polls Realtime Sync ──────────────────────────────────────────────────────

export function usePollsRealtime(sectionId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!sectionId) return;

    const uniqueId = Math.random().toString(36).slice(2, 9);
    const channel = supabase
      .channel(`polls-realtime-${sectionId}-${uniqueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'polls',
        },
        () => {
          qc.invalidateQueries({ queryKey: ['polls', sectionId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
        },
        (payload: any) => {
          qc.invalidateQueries({ queryKey: ['polls', sectionId] });
          if (payload.new && payload.new.poll_id) {
            qc.invalidateQueries({ queryKey: ['actionable_poll_votes', payload.new.poll_id] });
          }
          if (payload.old && payload.old.poll_id) {
            qc.invalidateQueries({ queryKey: ['actionable_poll_votes', payload.old.poll_id] });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [sectionId, qc]);
}

// ── Actionable Poll Votes Query ──────────────────────────────────────────────

export interface ActionablePollVote {
  optionId: string;
  studentId: string;
  studentName: string;
  classRoll: string | null;
}

export function useActionablePollVotes(pollId: string, enabled: boolean) {
  return useQuery<ActionablePollVote[]>({
    queryKey: ['actionable_poll_votes', pollId],
    enabled: enabled && !!pollId,
    staleTime: 1000 * 30, // 30 seconds for quick update
    queryFn: async () => {
      const { data, error } = await supabase
        .from('votes')
        .select(`
          option_id,
          student_id,
          users:student_id (name, section_roll)
        `)
        .eq('poll_id', pollId);

      if (error) throw error;

      return (data as unknown as VoteRow[] ?? []).map((v) => {
        const u = v.users;
        return {
          optionId: v.option_id,
          studentId: v.student_id,
          studentName: u?.name ?? 'Unknown',
          classRoll: u?.section_roll ?? null,
        };
      });
    },
  });
}

// ── Create Poll Mutation ─────────────────────────────────────────────────────

export function useCreatePoll() {
  const qc = useQueryClient();
  const { sectionId, userId, role } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      question: string;
      pollType: 'general' | 'actionable';
      expiresAt?: string | null;
      options: string[];
      allowMultiple: boolean;
    }) => {
      // 1. Enforce strict CR authorization check
      if (role !== 'cr') {
        throw new Error('Unauthorized: Only Class Representatives can create polls');
      }

      // 2. Validate input using Zod
      const validated = pollSchema.parse({
        question: input.question.trim(),
        type: input.pollType,
        options: input.options,
      });

      const { data: poll, error } = await supabase
        .from('polls')
        .insert({
          section_id: sectionId!,
          created_by: userId!,
          question_text: validated.question,
          poll_type: validated.type,
          expires_at: input.expiresAt ?? null,
          allow_multiple: input.allowMultiple,
        })
        .select('id')
        .single();
      if (error) throw error;

      const { error: optErr } = await supabase.from('poll_options').insert(
        (validated.options ?? []).map((label, i) => ({
          poll_id: poll.id,
          label: label.trim(),
          sort_order: i,
        }))
      );
      if (optErr) throw optErr;

      // Trigger push notification for new poll
      try {
        await supabase.functions.invoke('send-new-poll-notification', {
          body: { pollId: poll.id }
        });
      } catch (err) {
        console.warn('Failed to send push notification for new poll:', err);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['polls'] }),
  });
}

// ── Delete Poll Mutation ─────────────────────────────────────────────────────

export function useDeletePoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('polls').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['polls'] }),
  });
}

// ── Vote Poll Mutation ───────────────────────────────────────────────────────

export function useVotePoll() {
  const qc = useQueryClient();
  const { userId, sectionId } = useAuthContext();
  const setOptimisticVote = useAppStore(s => s.setOptimisticVote);
  const clearOptimisticVote = useAppStore(s => s.clearOptimisticVote);

  return useMutation({
    onMutate: async (input: {
      pollId: string;
      optionId: string;
      pollType: 'general' | 'anonymous' | 'actionable';
      allowMultiple: boolean;
      isSelected: boolean;
    }) => {
      // Look up current poll data from TanStack cache
      const polls = qc.getQueryData<Poll[]>(['polls', sectionId, userId]);
      const poll = polls?.find(p => p.id === input.pollId);
      const currentVotes = poll?.userVotes ?? [];

      let newVotes: string[];
      if (input.allowMultiple) {
        if (input.isSelected) {
          // Was selected, so remove it
          newVotes = currentVotes.filter(id => id !== input.optionId);
        } else {
          // Was not selected, so add it
          newVotes = [...currentVotes, input.optionId];
        }
      } else {
        if (input.isSelected) {
          // Was selected, remove it
          newVotes = [];
        } else {
          // Was not selected, set as the only choice
          newVotes = [input.optionId];
        }
      }

      setOptimisticVote(input.pollId, newVotes);
    },
    mutationFn: async (input: {
      pollId: string;
      optionId: string;
      pollType: 'general' | 'anonymous' | 'actionable';
      allowMultiple: boolean;
      isSelected: boolean;
    }) => {
      const executeMutation = async () => {
        const isAnonymous = input.pollType === 'general' || input.pollType === 'anonymous';
        let token: string | null = null;
        if (isAnonymous) {
          const { data, error } = await supabase.rpc('calculate_anonymous_token', {
            user_id: userId!,
            poll_id: input.pollId
          });
          if (error) throw error;
          token = data;
        }

        if (input.allowMultiple) {
          if (input.isSelected) {
            const deleteQuery = supabase.from('votes').delete().eq('option_id', input.optionId);
            if (isAnonymous) {
              deleteQuery.eq('anonymous_token', token!);
            } else {
              deleteQuery.eq('student_id', userId!);
            }
            const { error } = await deleteQuery;
            if (error) throw error;
          } else {
            const { error } = await supabase.from('votes').insert({
              poll_id: input.pollId,
              option_id: input.optionId,
              student_id: isAnonymous ? null : userId!,
              anonymous_token: token,
            });
            if (error) throw error;
          }
        } else {
          const deleteQuery = supabase.from('votes').delete().eq('poll_id', input.pollId);
          if (isAnonymous) {
            deleteQuery.eq('anonymous_token', token!);
          } else {
            deleteQuery.eq('student_id', userId!);
          }
          const { error: delErr } = await deleteQuery;
          if (delErr) throw delErr;

          if (!input.isSelected) {
            const { error } = await supabase.from('votes').insert({
              poll_id: input.pollId,
              option_id: input.optionId,
              student_id: isAnonymous ? null : userId!,
              anonymous_token: token,
            });
            if (error) throw error;
          }
        }
      };

      if (!navigator.onLine) {
        if (import.meta.env.DEV) {
          console.log('[OfflineSync] Network offline. Enqueuing poll vote.');
        }
        await enqueueAction('vote', { ...input, userId: userId! });
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((reg) => {
            if ('sync' in reg) {
              return (reg as any).sync.register('sync-offline-actions');
            }
          }).catch((err) => console.warn('[OfflineSync] Sync registration failed:', err));
        }
        return; // Optimistic success
      }

      try {
        await executeMutation();
      } catch (err: any) {
        const isNetworkErr = err.message?.includes('Failed to fetch') || err.name === 'TypeError';
        if (isNetworkErr) {
          if (import.meta.env.DEV) {
            console.warn('[OfflineSync] Vote failed due to network error. Enqueuing vote:', err);
          }
          await enqueueAction('vote', { ...input, userId: userId! });
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((reg) => {
              if ('sync' in reg) {
                return (reg as any).sync.register('sync-offline-actions');
              }
            }).catch((syncErr) => console.warn('[OfflineSync] Sync registration failed:', syncErr));
          }
          return; // Optimistic success
        }
        throw err;
      }
    },
    onSuccess: () => {
      return qc.invalidateQueries({ queryKey: ['polls'] });
    },
    onSettled: (_data, _error, input) => {
      if (input?.pollId) {
        // Cooldown delay to prevent race conditions with Realtime WebSocket sync invalidations
        setTimeout(() => {
          clearOptimisticVote(input.pollId);
        }, 800);
      }
    },
  });
}
