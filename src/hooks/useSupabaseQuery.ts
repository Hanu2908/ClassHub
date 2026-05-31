import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type {
  Announcement, Assignment, AssignmentSet, Poll, PollOption,
  ScheduleSlot, ScheduleMap, AttendanceSubject, Exam, StudentExamPrep,
  SectionInfo,
} from '../store/appStore';
export type { SectionInfo };

type SubjectRelation = { code: string; name: string; semester?: number } | null;
type AssignmentSetRelation = {
  id: string;
  set_label: string;
  description: string;
  pdf_url: string | null;
  roll_start: number;
  roll_end: number;
  page_numbers: string | null;
};
type PollOptionRelation = { id: string; label: string; sort_order: number };

interface AttachmentRow {
  id: string;
  filename: string;
  file_size: number;
  file_type: string;
  storage_path: string;
}

interface VoteRow {
  option_id: string;
  student_id: string;
  users: {
    name: string;
    section_roll: string | null;
  } | null;
}

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

// ── 1. Section info ──────────────────────────────────────────────────────────

export function useSection() {
  const { sectionId, isAuthenticated } = useAuthContext();
  return useQuery<SectionInfo | null>({
    queryKey: ['section', sectionId],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('sections')
          .select('id, name, college, invite_code, created_by')
          .eq('id', sectionId!)
          .single();
        
        if (error) throw error;
        if (!data) throw new Error('No section data returned');

        const sectionData: SectionInfo = {
          id: data.id,
          name: data.name,
          college: data.college,
          inviteCode: data.invite_code,
          createdBy: data.created_by,
        };
        useAppStore.getState().setOfflineCache('section', sectionData);
        return sectionData;
      } catch (err) {
        console.error('[useSection] Error, using offline cache fallback:', err);
        const cached = useAppStore.getState().offlineCache?.section;
        if (cached) return cached;
        return null;
      }
    },
  });
}

// ── 2. Subjects ──────────────────────────────────────────────────────────────

export interface SubjectInfo {
  id: string;
  code: string;
  name: string;
  semester: number;
  accent: string;
  sectionId: string;
}

export function useSubjects() {
  const { sectionId, isAuthenticated } = useAuthContext();
  return useQuery<SubjectInfo[]>({
    queryKey: ['subjects', sectionId],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, code, name, semester, accent, section_id')
        .eq('section_id', sectionId!)
        .order('code');
      if (error) throw error;
      return (data ?? []).map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
        semester: s.semester,
        accent: s.accent,
        sectionId: s.section_id,
      }));
    },
  });
}

export function useMutateSubjects() {
  const queryClient = useQueryClient();
  const { sectionId } = useAuthContext();

  return useMutation({
    mutationFn: async (payload: { action: 'create' | 'update' | 'delete'; subject: Partial<SubjectInfo> }) => {
      if (!sectionId) throw new Error('No section ID');
      const { action, subject } = payload;

      if (action === 'create') {
        const { error } = await supabase
          .from('subjects')
          .insert({
            section_id: sectionId,
            code: subject.code!,
            name: subject.name!,
            semester: subject.semester!,
            accent: subject.accent || '#4A9EFF',
          });
        if (error) throw error;
      } else if (action === 'update') {
        const { error } = await supabase
          .from('subjects')
          .update({
            code: subject.code,
            name: subject.name,
            semester: subject.semester,
            accent: subject.accent,
          })
          .eq('id', subject.id!)
          .eq('section_id', sectionId);
        if (error) throw error;
      } else if (action === 'delete') {
        const { error } = await supabase
          .from('subjects')
          .delete()
          .eq('id', subject.id!)
          .eq('section_id', sectionId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects', sectionId] });
      queryClient.invalidateQueries({ queryKey: ['assignments', sectionId] });
    },
  });
}

// ── 3. Announcements ─────────────────────────────────────────────────────────

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

// ── 4. Assignments ───────────────────────────────────────────────────────────

export function useAssignments(opts?: { page?: number; limit?: number }) {
  const { sectionId, userId, isAuthenticated } = useAuthContext();
  const page = opts?.page ?? 0;
  const limit = opts?.limit ?? 100;
  return useQuery<Assignment[]>({
    queryKey: ['assignments', sectionId, userId, page, limit],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      try {
        const from = page * limit;
        const to = (page + 1) * limit - 1;
        const assignmentsQuery = supabase
          .from('assignments')
          .select(`
            id, title, subject_id, due_date, description, created_at,
            subjects:subject_id (code, name),
            assignment_sets (id, set_label, description, pdf_url, roll_start, roll_end, page_numbers),
            attachments (id, filename, file_size, file_type, storage_path)
          `)
          .eq('section_id', sectionId!)
          .order('created_at', { ascending: false })
          .range(from, to);

        const submissionQuery = userId
          ? supabase
              .from('submissions')
              .select('assignment_id, submission_link, status')
              .eq('student_id', userId)
          : Promise.resolve({ data: [], error: null });

        const [{ data: assigns, error }, { data: subs, error: subErr }] = await Promise.all([
          assignmentsQuery,
          submissionQuery,
        ] as const);

        if (error) throw error;
        if (subErr) throw subErr;

        const userSubs: Record<string, { link: string | null; status: string }> = {};
        for (const s of subs ?? []) {
          userSubs[s.assignment_id] = { link: s.submission_link, status: s.status };
        }

        const result = (assigns ?? []).map(a => {
          const sub = userSubs[a.id];
          const subjectData = a.subjects as SubjectRelation;
          const sets: AssignmentSet[] = ((a.assignment_sets ?? []) as AssignmentSetRelation[]).map(s => ({
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
            createdAt: a.created_at,
            attachments: ((a.attachments as unknown as AttachmentRow[]) ?? []).map((att) => ({
              id: att.id,
              filename: att.filename,
              fileSize: att.file_size,
              fileType: att.file_type,
              storagePath: att.storage_path,
            })),
          };
        });

        useAppStore.getState().setOfflineCache('assignments', result);
        return result;
      } catch (err) {
        console.error('[useAssignments] Query failed, returning offline cache:', err);
        const cached = useAppStore.getState().offlineCache?.assignments;
        if (cached) return cached;
        throw err;
      }
    },
  });
}

// ── 5. Polls ─────────────────────────────────────────────────────────────────

export function usePolls() {
  const { sectionId, userId, isAuthenticated } = useAuthContext();
  const queryResult = useQuery<Poll[]>({
    queryKey: ['polls', sectionId, userId],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
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
          // 1. Fetch aggregate vote counts, voter counts, and current user's votes concurrently
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
          filter: `section_id=eq.${sectionId}`,
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

// ── 6. Schedule (timetable) ──────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function useSchedule() {
  const { sectionId, isAuthenticated } = useAuthContext();

  return useQuery<ScheduleMap>({
    queryKey: ['schedule', sectionId],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('timetable_slots')
          .select(`
            id, day_of_week, start_time, end_time, room, type, teacher, created_by,
            subjects:subject_id (code, name)
          `)
          .eq('section_id', sectionId!)
          .order('start_time');

        if (error) throw error;

        const map: ScheduleMap = {};
        for (const slot of data ?? []) {
          const dayName = DAY_NAMES[slot.day_of_week] ?? 'Mon';
          const subjectData = slot.subjects as SubjectRelation;
          const entry: ScheduleSlot = {
            id: slot.id,
            day: dayName,
            subject: subjectData?.name ?? 'Free Period',
            code: subjectData?.code ?? '',
            room: slot.room ?? '',
            teacher: (slot as Record<string, unknown>).teacher as string ?? '',
            type: slot.type.charAt(0).toUpperCase() + slot.type.slice(1),
            startTime: slot.start_time.slice(0, 5), // HH:MM
            endTime: slot.end_time.slice(0, 5),
          };
          if (!map[dayName]) map[dayName] = [];
          map[dayName].push(entry);
        }

        useAppStore.getState().setOfflineCache('schedule', map);
        return map;
      } catch (err) {
        console.error('[useSchedule] Query failed, returning offline cache:', err);
        const cached = useAppStore.getState().offlineCache?.schedule;
        if (cached) return cached;
        throw err;
      }
    },
  });
}

// ── 7. Attendance ────────────────────────────────────────────────────────────

export function useAttendance() {
  const { userId, isAuthenticated } = useAuthContext();
  return useQuery<{ subjects: AttendanceSubject[]; overall: number; lastUpdated: string | null }>({
    queryKey: ['attendance', userId],
    enabled: !!userId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('attendance_records')
          .select(`
            present, od, makeup, absent, percentage, updated_at,
            subjects:subject_id (code, name, semester)
          `)
          .eq('user_id', userId!);
        if (error) throw error;

        const subjects: AttendanceSubject[] = (data ?? []).map(r => {
          const subj = r.subjects as SubjectRelation;
          const total = r.present + r.od + r.absent;
          const attended = r.present + r.od + r.makeup;
          const pct = r.percentage ?? (total > 0 ? (attended / total) * 100 : 0);
          // canSkip: how many more can skip while staying >= 75%
          const canSkip = total > 0 ? Math.floor((attended - 0.75 * total) / 0.75) : 0;
          // needToAttend: how many more to reach 75%
          const need = total > 0 ? Math.max(0, Math.ceil((0.75 * total - attended) / 0.25)) : 0;
          return {
            code: subj?.code ?? '???',
            name: subj?.name ?? 'Unknown',
            type: 'Lecture',
            present: attended,
            absent: r.absent,
            total,
            percentage: Number(pct),
            canSkip: Math.max(0, canSkip),
            needToAttend: need,
            semester: subj?.semester ?? 1,
          };
        });

        const totalPresent = subjects.reduce((sum, s) => sum + s.present, 0);
        const totalHeld = subjects.reduce((sum, s) => sum + s.total, 0);
        const overall = totalHeld > 0 ? (totalPresent / totalHeld) * 100 : 0;

        let maxUpdatedAt: string | null = null;
        if (data && data.length > 0) {
          const dates = data
            .map(r => r.updated_at)
            .filter(Boolean)
            .map(d => new Date(d).getTime());
          if (dates.length > 0) {
            maxUpdatedAt = new Date(Math.max(...dates)).toISOString();
          }
        }

        const result = { subjects, overall, lastUpdated: maxUpdatedAt };
        useAppStore.getState().setOfflineCache('attendance', result);
        return result;
      } catch (err) {
        console.error('[useAttendance] Query failed, returning offline cache:', err);
        const cached = useAppStore.getState().offlineCache?.attendance;
        if (cached) return cached;
        throw err;
      }
    },
  });
}

// ── 8. Section members ───────────────────────────────────────────────────────

export interface SectionMember {
  id: string;
  name: string;
  email: string;
  classRoll: string | null;
  universityRoll: string | null;
  role: 'student' | 'cr';
  crRank: 'primary' | 'co' | null;
  avatarUrl: string | null;
  dayScholar: boolean;
}

export function useSectionMembers() {
  const { sectionId, isAuthenticated } = useAuthContext();
  return useQuery<SectionMember[]>({
    queryKey: ['members', sectionId],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, section_roll, university_roll, role, cr_rank, avatar_url, day_scholar')
        .eq('section_id', sectionId!)
        .order('section_roll')
        .limit(200); // safeguard: avoid extremely large member lists on the dashboard
      if (error) throw error;
      return (data ?? []).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        classRoll: u.section_roll,
        universityRoll: u.university_roll,
        role: u.role as 'student' | 'cr',
        crRank: (u as Record<string, unknown>).cr_rank as 'primary' | 'co' | null ?? null,
        avatarUrl: u.avatar_url,
        dayScholar: u.day_scholar,
      }));
    },
  });
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  submissionLink: string | null;
  status: 'pending' | 'submitted';
  submittedAt: string | null;
  nudgeSent: boolean;
  crVerified: boolean;
}

export function useAssignmentSubmissions(assignmentId: string | null) {
  const { role } = useAuthContext();
  const isCR = role === 'cr';
  
  return useQuery<AssignmentSubmission[]>({
    queryKey: ['assignment_submissions', assignmentId],
    enabled: !!assignmentId && isCR,
    staleTime: 1000 * 30, // 30 seconds for quick updates in command center
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submissions')
        .select('id, assignment_id, student_id, submission_link, status, submitted_at, nudge_sent, cr_verified')
        .eq('assignment_id', assignmentId!);
      if (error) throw error;
      
      return (data ?? []).map(s => ({
        id: s.id,
        assignmentId: s.assignment_id,
        studentId: s.student_id,
        submissionLink: s.submission_link,
        status: s.status as 'pending' | 'submitted',
        submittedAt: s.submitted_at,
        nudgeSent: s.nudge_sent,
        crVerified: s.cr_verified ?? false,
      }));
    },
  });
}

export interface StudentAttendanceAggregate {
  userId: string;
  totalPresent: number;
  totalHeld: number;
  overallPercentage: number | null;
}

export function useSectionAttendance() {
  const { role, sectionId, isAuthenticated } = useAuthContext();
  const isCR = role === 'cr';

  return useQuery<Record<string, StudentAttendanceAggregate>>({
    queryKey: ['section_attendance', sectionId],
    enabled: !!sectionId && isAuthenticated && isCR,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('user_id, present, od, makeup, absent');
      
      if (error) throw error;

      const aggregates: Record<string, StudentAttendanceAggregate> = {};
      
      (data ?? []).forEach(r => {
        const total = r.present + r.od + r.absent;
        const attended = r.present + r.od + r.makeup;
        
        if (!aggregates[r.user_id]) {
          aggregates[r.user_id] = {
            userId: r.user_id,
            totalPresent: 0,
            totalHeld: 0,
            overallPercentage: null
          };
        }
        
        aggregates[r.user_id].totalPresent += attended;
        aggregates[r.user_id].totalHeld += total;
      });

      Object.values(aggregates).forEach(agg => {
        if (agg.totalHeld > 0) {
          agg.overallPercentage = (agg.totalPresent / agg.totalHeld) * 100;
        }
      });

      return aggregates;
    }
  });
}

export interface GlobalResource {
  id: string;
  subjectCode: string;
  subjectName: string;
  semester: string;
  branch: string;
  accentColor: string;
  syllabusUrl: string;
  notesUrl: string;
  pyqsUrl: string;
  practiceUrl: string;
  labUrl: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface GlobalPYQ {
  id: string;
  semester: string;
  year: string;
  url: string;
  isLatest: boolean;
  createdAt: string;
}

export function useGlobalResources() {
  const { isAuthenticated } = useAuthContext();
  return useQuery<GlobalResource[]>({
    queryKey: ['global_resources'],
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_resources' as any)
        .select('*')
        .order('subject_code', { ascending: true }) as any;
      
      if (error) throw error;
      
      return (data ?? []).map((r: any) => ({
        id: r.id,
        subjectCode: r.subject_code,
        subjectName: r.subject_name,
        semester: r.semester,
        branch: r.branch,
        accentColor: r.accent_color ?? '#8B5CF6',
        syllabusUrl: r.syllabus_url ?? '',
        notesUrl: r.notes_url ?? '',
        pyqsUrl: r.pyqs_url ?? '',
        practiceUrl: r.practice_url ?? '',
        labUrl: r.lab_url ?? '',
        updatedAt: r.updated_at,
        updatedBy: r.updated_by,
      }));
    },
  });
}

export function useGlobalPYQs() {
  const { isAuthenticated } = useAuthContext();
  return useQuery<GlobalPYQ[]>({
    queryKey: ['global_pyqs'],
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_pyqs' as any)
        .select('*')
        .order('year', { ascending: false }) as any;
      
      if (error) throw error;
      
      return (data ?? []).map((p: any) => ({
        id: p.id,
        semester: p.semester,
        year: p.year,
        url: p.url,
        isLatest: p.is_latest,
        createdAt: p.created_at,
      }));
    },
  });
}

// ── Section CRs (for Manage CRs UI) ─────────────────────────────────────────

export interface SectionCR {
  id: string;
  name: string;
  email: string;
  classRoll: string | null;
  crRank: 'primary' | 'co' | null;
  avatarUrl: string | null;
}

export function useSectionCRs() {
  const { sectionId, isAuthenticated } = useAuthContext();
  return useQuery<SectionCR[]>({
    queryKey: ['section_crs', sectionId],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 30, // 30 seconds for quick updates
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, section_roll, cr_rank, avatar_url')
        .eq('section_id', sectionId!)
        .eq('role', 'cr')
        .order('cr_rank');
      if (error) throw error;
      return (data ?? []).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        classRoll: u.section_roll,
        crRank: (u as Record<string, unknown>).cr_rank as 'primary' | 'co' | null ?? null,
        avatarUrl: u.avatar_url,
      }));
    },
  });
}

// ── CR Transfer Audit Log ────────────────────────────────────────────────────

export interface CRTransferEntry {
  id: string;
  actorId: string;
  targetId: string;
  action: string;
  note: string | null;
  createdAt: string;
}

export function useCRTransferLog() {
  const { sectionId, role, isAuthenticated } = useAuthContext();
  return useQuery<CRTransferEntry[]>({
    queryKey: ['cr_transfer_log', sectionId],
    enabled: !!sectionId && isAuthenticated && role === 'cr',
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cr_transfer_log')
        .select('id, actor_id, target_id, action, note, created_at')
        .eq('section_id', sectionId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map(e => ({
        id: e.id,
        actorId: e.actor_id,
        targetId: e.target_id,
        action: e.action,
        note: e.note,
        createdAt: e.created_at,
      }));
    },
  });
}

export function useExams() {
  const { sectionId, isAuthenticated } = useAuthContext();
  return useQuery<Exam[]>({
    queryKey: ['exams', sectionId],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      // 1. Fetch active subjects in this section
      const { data: subjects, error: subjError } = await supabase
        .from('subjects')
        .select('code')
        .eq('section_id', sectionId!);
      if (subjError) throw subjError;

      const subjectCodes = (subjects ?? []).map(s => s.code);
      if (subjectCodes.length === 0) return [];

      // 2. Fetch base exams filtered by subject codes, and join section-specific overrides
      const { data: examsData, error: examsError } = await (supabase as any)
        .from('exams')
        .select(`
          *,
          exam_overrides (
            id,
            room,
            seating_plan_path,
            section_id
          )
        `)
        .in('subject_code', subjectCodes)
        .order('exam_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (examsError) throw examsError;

      return (examsData ?? []).map((e: any) => {
        // Find override for current section
        const overrides = e.exam_overrides || [];
        const sectionOverride = overrides.find((o: any) => o.section_id === sectionId);

        return {
          id: e.id,
          semester: e.semester,
          subjectCode: e.subject_code,
          subjectName: e.subject_name,
          examType: e.exam_type,
          examDate: e.exam_date,
          startTime: e.start_time,
          endTime: e.end_time,
          maxMarks: e.max_marks,
          room: e.room,
          seatingPlanPath: e.seating_plan_path,
          syllabusUnits: e.syllabus_units || [],
          syllabusPdfPath: e.syllabus_pdf_path,
          activeRoom: sectionOverride?.room || e.room,
          activeSeatingPlan: sectionOverride?.seating_plan_path || e.seating_plan_path,
          baseCreatorId: e.created_by,
          overrideId: sectionOverride?.id || null,
          createdAt: e.created_at,
          createdBy: e.created_by
        };
      });
    }
  });
}

export function useStudentExamPrep(examId: string) {
  const { userId, isAuthenticated } = useAuthContext();
  return useQuery<StudentExamPrep[]>({
    queryKey: ['student_exam_prep', examId, userId],
    enabled: !!examId && !!userId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('student_exam_prep')
        .select('*')
        .eq('exam_id', examId)
        .eq('user_id', userId!);
      if (error) throw error;

      return (data ?? []).map((p: any) => ({
        id: p.id,
        userId: p.user_id,
        examId: p.exam_id,
        unitIndex: p.unit_index,
        isPrepared: p.is_prepared
      }));
    }
  });
}

