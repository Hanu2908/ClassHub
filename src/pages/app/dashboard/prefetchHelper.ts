import { supabase } from '../../../lib/supabase';

// ── Prefetch helper (exported for sub-components) ──
export const prefetchAnnouncementsData = (queryClient: any, sectionId: string | null | undefined, userId: string | null | undefined) => {
  if (!sectionId || !userId) return;

  queryClient.prefetchQuery({
    queryKey: ['announcements', sectionId, userId, 0, 100],
    queryFn: async () => {
      const { data: anns, error: annErr } = await supabase
        .from('announcements')
        .select(`
          id, title, message_content, priority, deadline_at, expires_at, created_at,
          attachments (id, filename, file_size, file_type, storage_path)
        `)
        .eq('section_id', sectionId!)
        .order('created_at', { ascending: false })
        .range(0, 99);
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

      return (anns ?? []).map(a => ({
        id: a.id,
        title: a.title,
        body: a.message_content,
        priority: a.priority as 'critical' | 'general',
        deadline: a.deadline_at,
        postedAt: a.created_at,
        expiresAt: a.expires_at ?? null,
        isAcknowledged: ackIds.includes(a.id),
        attachments: ((a.attachments as any) ?? []).map((att: any) => ({
          id: att.id,
          filename: att.filename,
          fileSize: att.file_size,
          fileType: att.file_type,
          storagePath: att.storage_path,
        })),
      }));
    },
    staleTime: 1000 * 60 * 5,
  });

  queryClient.prefetchQuery({
    queryKey: ['section_acknowledgments', sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acknowledgments')
        .select('announcement_id, user_id, acknowledged_at');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
};
