import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type { Announcement } from '../store/appStore';
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

interface AttachmentRow {
  id: string;
  filename: string;
  file_size: number;
  file_type: string;
  storage_path: string;
}

// ── Announcements Query ──────────────────────────────────────────────────────

export function useAnnouncements(opts?: { page?: number; limit?: number }) {
  const { sectionId, userId, isAuthenticated } = useAuthContext();
  const page = opts?.page ?? 0;
  const limit = opts?.limit ?? 100; // default cap to avoid unbounded fetches
  const queryResult = useQuery<(Announcement & { isAcknowledged: boolean })[]>({
    queryKey: ['announcements', sectionId, userId, page, limit],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      try {
        const from = page * limit;
        const to = (page + 1) * limit - 1;
        const { data: anns, error: annErr } = await supabase
          .from('announcements')
          .select(`
            id, title, message_content, priority, deadline_at, expires_at, created_at,
            attachments (id, filename, file_size, file_type, storage_path)
          `)
          .eq('section_id', sectionId!)
          .order('created_at', { ascending: false })
          .range(from, to);
        if (annErr) throw annErr;

        let ackIds: string[] = [];
        if (userId && Array.isArray(anns) && anns.length > 0) {
          const announcementIds = anns.map(a => a.id);
          const { data: acks, error: ackErr } = await supabase
            .from('acknowledgments')
            .select('announcement_id')
            .eq('user_id', userId)
            .in('announcement_id', announcementIds);
          if (ackErr) throw ackErr;
          ackIds = (acks ?? []).map(a => a.announcement_id);
        }

        const result = (anns ?? []).map(a => ({
          id: a.id,
          title: a.title,
          body: a.message_content,
          priority: a.priority as 'critical' | 'general',
          deadline: a.deadline_at,
          postedAt: a.created_at,
          expiresAt: (a as any).expires_at ?? null,
          attachmentUrl: null,
          isAcknowledged: ackIds.includes(a.id),
          attachments: ((a.attachments as unknown as AttachmentRow[]) ?? []).map((att) => ({
            id: att.id,
            filename: att.filename,
            fileSize: att.file_size,
            fileType: att.file_type,
            storagePath: att.storage_path,
          })),
        }));

        useAppStore.getState().setOfflineCache('announcements', result);
        return result;
      } catch (err) {
        console.error('[useAnnouncements] Query failed, returning offline cache:', err);
        const cached = useAppStore.getState().offlineCache?.announcements;
        if (cached) return cached;
        throw err;
      }
    },
  });

  const optimisticAcks = useAppStore(s => s.optimisticAcks);
  const data = useMemo(() => {
    if (!queryResult.data) return queryResult.data;
    return queryResult.data.map(ann => ({
      ...ann,
      isAcknowledged: ann.isAcknowledged || optimisticAcks.has(ann.id)
    }));
  }, [queryResult.data, optimisticAcks]);

  return { ...queryResult, data };
}

// ── Create Announcement Mutation ─────────────────────────────────────────────

let isCreatingAnnouncement = false;

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  const { sectionId, userId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      message: string;
      priority: 'general' | 'critical';
      deadline?: string | null;
      expiresAt?: string | null;
    }) => {
      if (isCreatingAnnouncement) {
        console.warn('Announcement creation already in flight. Ignoring duplicate request.');
        return;
      }
      isCreatingAnnouncement = true;
      try {
        const { data, error } = await supabase
          .from('announcements')
          .insert({
            section_id: sectionId!,
            author_id: userId!,
            title: input.title,
            message_content: input.message,
            priority: input.priority,
            deadline_at: input.deadline ?? null,
            expires_at: input.expiresAt ?? null,
          })
          .select('id')
          .single();

        if (error) throw error;

        if (data?.id) {
          try {
            const { data: pushData, error: funcError } = await supabase.functions.invoke('send-critical-announcement', {
              body: { announcementId: data.id },
            });
            if (funcError) {
              console.warn('Failed to broadcast critical announcement notification:', funcError);
            } else {
              console.log('Push notification result:', pushData);
            }
          } catch (err) {
            console.warn('Error invoking send-critical-announcement function:', err);
          }
        }

        return data?.id;
      } finally {
        isCreatingAnnouncement = false;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

// ── Delete Announcement Mutation ─────────────────────────────────────────────

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

// ── Acknowledge Announcement Mutation ────────────────────────────────────────

const inFlightAcks = new Set<string>();

export function useAcknowledge() {
  const qc = useQueryClient();
  const { userId } = useAuthContext();
  const addOptimisticAck = useAppStore(s => s.addOptimisticAck);
  const removeOptimisticAck = useAppStore(s => s.removeOptimisticAck);

  return useMutation({
    onMutate: async (announcementId: string) => {
      addOptimisticAck(announcementId);
    },
    mutationFn: async (announcementId: string) => {
      const key = `${announcementId}-${userId}`;
      if (inFlightAcks.has(key)) {
        console.warn('Acknowledgment already in flight. Ignoring duplicate request.');
        return;
      }
      inFlightAcks.add(key);

      try {
        if (!navigator.onLine) {
          if (import.meta.env.DEV) {
            console.log('[OfflineSync] Network offline. Enqueuing acknowledgment.');
          }
          await enqueueAction('acknowledge', { announcementId, userId: userId! });
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
          const { error } = await supabase.from('acknowledgments').insert({
            announcement_id: announcementId,
            user_id: userId!,
          });
          if (error) {
            throw error;
          }
        } catch (err: any) {
          const isNetworkErr = err.message?.includes('Failed to fetch') || err.name === 'TypeError';
          if (isNetworkErr) {
            if (import.meta.env.DEV) {
              console.warn('[OfflineSync] Mutation failed due to network error. Enqueuing acknowledgment:', err);
            }
            await enqueueAction('acknowledge', { announcementId, userId: userId! });
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
      } finally {
        inFlightAcks.delete(key);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['section_acknowledgments'] });
    },
    onSettled: (_data, _error, announcementId) => {
      removeOptimisticAck(announcementId);
    },
  });
}
