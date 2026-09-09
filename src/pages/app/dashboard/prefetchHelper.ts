import { supabase } from '../../../lib/supabase';
import type { QueryClient } from '@tanstack/react-query';

// ── Prefetch helper for Announcements ──
export const prefetchAnnouncementsData = (queryClient: QueryClient | any, sectionId: string | null | undefined, userId: string | null | undefined) => {
  if (!sectionId || !userId) return;

  import('../AnnouncementsPage').catch(() => {});

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

// ── Prefetch helper for Assignments ──
const fetchAssignmentsBatch = async (sectionId: string, userId: string | null | undefined, limit: number) => {
  const assignmentsQuery = supabase
    .from('assignments')
    .select(`
      id, title, subject_id, due_date, description, created_at, target_batch, is_archived,
      subjects:subject_id (code, name),
      assignment_sets (id, set_label, description, pdf_url, roll_start, roll_end, page_numbers),
      attachments (id, filename, file_size, file_type, storage_path)
    `)
    .eq('section_id', sectionId)
    .order('created_at', { ascending: false })
    .range(0, limit - 1);

  const submissionQuery = userId
    ? supabase
        .from('submissions')
        .select('assignment_id, submission_link, status, cr_verified')
        .eq('student_id', userId)
    : Promise.resolve({ data: [], error: null });

  const [{ data: assigns, error }, { data: subs, error: subErr }] = await Promise.all([
    assignmentsQuery,
    submissionQuery,
  ] as const);

  if (error || subErr) return [];

  const userSubs: Record<string, { link: string | null; status: string; crVerified: boolean }> = {};
  for (const s of subs ?? []) {
    userSubs[s.assignment_id] = { link: s.submission_link, status: s.status, crVerified: s.cr_verified ?? false };
  }

  return (assigns ?? []).map(a => {
    const sub = userSubs[a.id];
    const subjectData = a.subjects as any;
    const sets = ((a.assignment_sets ?? []) as any[]).map(s => ({
      id: s.id,
      label: s.set_label,
      rollStart: s.roll_start,
      rollEnd: s.roll_end,
      pageNumbers: s.page_numbers ?? '',
      description: s.description,
      pdfUrl: s.pdf_url,
    }));

    return {
      id: a.id,
      title: a.title,
      subject: subjectData?.name ?? 'Unknown',
      subjectCode: subjectData?.code ?? '???',
      subjectId: a.subject_id,
      dueDate: a.due_date,
      description: a.description ?? '',
      status: (sub?.status ?? 'pending') as 'pending' | 'submitted',
      pdfUrl: null,
      hasSets: sets.length > 0,
      sets,
      submittedLink: sub?.link ?? null,
      crVerified: sub?.crVerified ?? false,
      createdAt: a.created_at,
      targetBatch: (a as any).target_batch ?? null,
      attachments: ((a.attachments as any) ?? []).map((att: any) => ({
        id: att.id,
        filename: att.filename,
        fileSize: att.file_size,
        fileType: att.file_type,
        storagePath: att.storage_path,
      })),
    };
  });
};

// ── Prefetch helper for CR Command Center ──
export const prefetchCRCommandData = (queryClient: QueryClient | any, sectionId: string | null | undefined, userId?: string | null | undefined) => {
  if (!sectionId) return;

  // Prefetch route code chunk
  import('../CRCommandPage').catch(() => {});

  // 1. Members
  queryClient.prefetchQuery({
    queryKey: ['members', sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, section_roll, university_roll, role, cr_rank, avatar_url, day_scholar, phone, sub_batch')
        .eq('section_id', sectionId)
        .order('section_roll')
        .limit(200);
      if (error) throw error;
      return (data ?? []).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        classRoll: u.section_roll,
        universityRoll: u.university_roll,
        role: u.role as 'student' | 'cr' | 'teacher',
        crRank: (u as Record<string, unknown>).cr_rank as 'primary' | 'co' | null ?? null,
        avatarUrl: u.avatar_url,
        dayScholar: u.day_scholar,
        phone: u.phone ?? null,
        subBatch: (u as Record<string, unknown>).sub_batch as string | null ?? null,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });

  // 2. Section Attendance Aggregates
  queryClient.prefetchQuery({
    queryKey: ['section_attendance', sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('user_id, present, od, makeup, absent, users!inner(section_id)')
        .eq('users.section_id', sectionId);
      if (error) return {};

      const aggregates: Record<string, any> = {};
      (data ?? []).forEach(r => {
        const total = r.present + r.od + r.absent;
        const attended = r.present + r.od + r.makeup;
        if (!aggregates[r.user_id]) {
          aggregates[r.user_id] = {
            userId: r.user_id,
            totalPresent: 0,
            totalHeld: 0,
            overallPercentage: null,
          };
        }
        aggregates[r.user_id].totalPresent += attended;
        aggregates[r.user_id].totalHeld += total;
      });

      Object.values(aggregates).forEach((agg: any) => {
        if (agg.totalHeld > 0) {
          agg.overallPercentage = (agg.totalPresent / agg.totalHeld) * 100;
        }
      });
      return aggregates;
    },
    staleTime: 1000 * 60 * 5,
  });

  // 3. Section Teachers List
  queryClient.prefetchQuery({
    queryKey: ['section-teachers-list', sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('section_teachers')
        .select('id, teacher_id, is_counsellor_for_batch, users(name, email), subject_id, subjects(name, code)')
        .eq('section_id', sectionId);
      if (error) return [];
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // 4. Section CRs
  queryClient.prefetchQuery({
    queryKey: ['section_crs', sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, section_roll, cr_rank, avatar_url')
        .eq('section_id', sectionId)
        .eq('role', 'cr')
        .order('name');
      if (error) return [];
      return (data ?? []).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        classRoll: u.section_roll,
        crRank: (u as Record<string, unknown>).cr_rank as 'primary' | 'co' | null ?? null,
        avatarUrl: u.avatar_url,
      }));
    },
    staleTime: 1000 * 30,
  });

  // 5. Assignments (limit 200 for submission tracker)
  queryClient.prefetchQuery({
    queryKey: ['assignments', sectionId, userId, 0, 200],
    queryFn: () => fetchAssignmentsBatch(sectionId, userId, 200),
    staleTime: 1000 * 60 * 2,
  });
};

// ── Prefetch helper for Polls ──
export const prefetchPollsData = (queryClient: QueryClient | any, sectionId: string | null | undefined, userId?: string | null | undefined) => {
  if (!sectionId) return;
  import('../PollsPage').catch(() => {});
  if (userId) {
    queryClient.prefetchQuery({
      queryKey: ['polls', sectionId, userId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('polls')
          .select(`
            id, question_text, poll_type, is_active, expires_at, created_at, allow_multiple,
            options:poll_options (id, option_text, vote_count),
            votes:poll_votes (id, option_id, student_id)
          `)
          .eq('section_id', sectionId)
          .order('created_at', { ascending: false });
        if (error) return [];
        return data ?? [];
      },
      staleTime: 1000 * 60,
    });
  }
};

// ── Prefetch helper for Assignments ──
export const prefetchAssignmentsData = (queryClient: QueryClient | any, sectionId: string | null | undefined, userId?: string | null | undefined) => {
  if (!sectionId) return;
  import('../AssignmentsPage').catch(() => {});
  queryClient.prefetchQuery({
    queryKey: ['assignments', sectionId, userId, 0, 100],
    queryFn: () => fetchAssignmentsBatch(sectionId, userId, 100),
    staleTime: 1000 * 60 * 2,
  });
};
