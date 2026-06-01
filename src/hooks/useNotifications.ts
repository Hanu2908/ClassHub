// src/hooks/useNotifications.ts
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore, mapDbNotification } from '../store/appStore';
import { showToast } from '../components/Toast';
import type { AppNotification, DbNotification } from '../store/appStore';

export function useNotifications() {
  const queryClient = useQueryClient();
  const authUser = useAppStore((s) => s.authUser);
  const userId = authUser?.id;
  const [instanceId, setInstanceId] = useState<string>('');

  // ── 1. Safe instanceId generation after render ──
  useEffect(() => {
    setInstanceId(Math.random().toString(36).substring(2, 9));
  }, []);

  // ── 2. Query to Fetch Notifications ──
  const query = useQuery<AppNotification[]>({
    queryKey: ['notifications', userId],
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notification_events')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(50); // Cap at 50 to keep it fast

      if (error) {
        console.error('[Notifications Hook] Fetch failed:', error);
        throw error;
      }

      return (data || []).map(mapDbNotification);
    },
  });

  // ── 3. Real-time PostgreSQL subscription ──
  useEffect(() => {
    if (!userId || !instanceId) return;

    if (import.meta.env.DEV) {
      console.log(`[useNotifications] Setting up notifications subscription for user: ${userId} (instance: ${instanceId})`);
    }

    const channel = supabase
      .channel(`user-notifications-${userId}-${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_events',
          filter: `recipient_id=eq.${userId}`,
        },
        async (payload) => {
          if (import.meta.env.DEV) {
            console.log('[useNotifications] Realtime notification change received:', payload);
          }

          // Force cache invalidation so React Query fetches the latest snapshot
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] });

          if (payload.eventType === 'INSERT') {
            const newNotif = mapDbNotification(payload.new as DbNotification);
            showToast(newNotif.title, 'info');
          }
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.log(`[useNotifications] Subscription status:`, status);
        }
      });

    return () => {
      if (import.meta.env.DEV) {
        console.log(`[useNotifications] Cleaning up notifications subscription for user: ${userId} (instance: ${instanceId})`);
      }
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient, instanceId]);

  // ── 3. Mutation: Mark All Read ──
  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const nowStr = new Date().toISOString();
      const { error } = await supabase
        .from('notification_events')
        .update({ read_at: nowStr })
        .eq('recipient_id', userId)
        .is('read_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  // ── 4. Mutation: Clear Single Notification ──
  const clear = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notification_events')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  // ── 5. Mutation: Clear All Notifications ──
  const clearAll = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from('notification_events')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  return {
    notifications: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    markAllRead: markAllRead.mutate,
    clear: clear.mutate,
    clearAll: clearAll.mutate,
  };
}
