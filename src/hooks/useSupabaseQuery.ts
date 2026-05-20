import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type {
  Announcement, Assignment, AssignmentSet, Poll, PollOption,
  ScheduleSlot, ScheduleMap, AttendanceSubject,
} from '../store/appStore';

type SubjectRelation = { code: string; name: string } | null;
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

// ── Helper: current user context ─────────────────────────────────────────────

function useAuthContext() {
  const authUser = useAppStore(s => s.authUser);
  const isAuthLoading = useAppStore(s => s.isAuthLoading);
  return {
    userId: authUser?.id ?? null,
    sectionId: authUser?.sectionId ?? null,
    role: authUser?.role ?? 'student',
    isAuthLoading,
  };
}

// ── 1. Section info ──────────────────────────────────────────────────────────

export interface SectionInfo {
  id: string;
  name: string;
  college: string;
  inviteCode: string;
  createdBy: string | null;
}

export function useSection() {
  const { sectionId, isAuthLoading } = useAuthContext();
  return useQuery<SectionInfo | null>({
    queryKey: ['section', sectionId],
    enabled: !!sectionId && !isAuthLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sections')
        .select('id, name, college, invite_code, created_by')
        .eq('id', sectionId!)
        .single();
      
      if (error) {
        console.error('[useSection] query error:', error);
        return null;
      }
      if (!data) {
        console.warn('[useSection] no section data returned for ID:', sectionId);
        return null;
      }

      return {
        id: data.id,
        name: data.name,
        college: data.college,
        inviteCode: data.invite_code,
        createdBy: data.created_by,
      };
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
  const { sectionId, isAuthLoading } = useAuthContext();
  return useQuery<SubjectInfo[]>({
    queryKey: ['subjects', sectionId],
    enabled: !!sectionId && !isAuthLoading,
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
  const { sectionId, userId, isAuthLoading } = useAuthContext();
  const page = opts?.page ?? 0;
  const limit = opts?.limit ?? 100; // default cap to avoid unbounded fetches
  return useQuery<(Announcement & { isAcknowledged: boolean })[]>({
    queryKey: ['announcements', sectionId, userId, page, limit],
    enabled: !!sectionId && !isAuthLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const from = page * limit;
      const to = (page + 1) * limit - 1;
      const { data: anns, error: annErr } = await supabase
        .from('announcements')
        .select('id, title, message_content, priority, deadline_at, created_at')
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

      return (anns ?? []).map(a => ({
        id: a.id,
        title: a.title,
        body: a.message_content,
        priority: a.priority as 'critical' | 'general',
        deadline: a.deadline_at,
        postedAt: a.created_at,
        attachmentUrl: null,
        isAcknowledged: ackIds.includes(a.id),
      }));
    },
  });
}

// ── 4. Assignments ───────────────────────────────────────────────────────────

export function useAssignments(opts?: { page?: number; limit?: number }) {
  const { sectionId, userId, isAuthLoading } = useAuthContext();
  const page = opts?.page ?? 0;
  const limit = opts?.limit ?? 100;
  return useQuery<Assignment[]>({
    queryKey: ['assignments', sectionId, userId, page, limit],
    enabled: !!sectionId && !isAuthLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const from = page * limit;
      const to = (page + 1) * limit - 1;
      const assignmentsQuery = supabase
        .from('assignments')
        .select(`
          id, title, due_date, description, created_at,
          subjects:subject_id (code, name),
          assignment_sets (id, set_label, description, pdf_url, roll_start, roll_end, page_numbers)
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

      return (assigns ?? []).map(a => {
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
          dueDate: a.due_date,
          description: a.description ?? '',
          status: (sub?.status ?? 'pending') as 'pending' | 'submitted',
          pdfUrl: null,
          hasSets: sets.length > 0,
          sets,
          submittedLink: sub?.link ?? null,
          createdAt: a.created_at,
        };
      });
    },
  });
}

// ── 5. Polls ─────────────────────────────────────────────────────────────────

export function usePolls() {
  const { sectionId, userId, isAuthLoading } = useAuthContext();
  return useQuery<Poll[]>({
    queryKey: ['polls', sectionId, userId],
    enabled: !!sectionId && !isAuthLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
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
      const userVotes: Record<string, string[]> = {};

      if (pollIds.length > 0) {
        // 1. Fetch aggregate vote counts securely via RPC to bypass RLS select restrictions
        const { data: voteCounts, error: countsErr } = await supabase
          .rpc('batch_poll_results', { target_polls: pollIds });
        if (countsErr) throw countsErr;

        for (const r of voteCounts ?? []) {
          if (!results[r.poll_id]) results[r.poll_id] = {};
          results[r.poll_id][r.option_id] = r.votes;
        }

        // 2. Fetch the current user's votes from the votes table to determine userVotes state (complies with student_id NEVER in query rules)
        if (userId) {
          const { data: myVotes, error: myVotesErr } = await supabase
            .from('votes')
            .select('poll_id, option_id')
            .in('poll_id', pollIds);
          if (myVotesErr) throw myVotesErr;

          for (const mv of myVotes ?? []) {
            if (!userVotes[mv.poll_id]) {
              userVotes[mv.poll_id] = [];
            }
            userVotes[mv.poll_id].push(mv.option_id);
          }
        }
      }

      return pollArray.map(p => {
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
        };
      });
    },
  });
}

// ── 6. Schedule (timetable) ──────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function useSchedule(opts?: { day?: string; limit?: number }) {
  const { sectionId, isAuthLoading } = useAuthContext();
  const day = opts?.day ?? undefined; // day as 'Mon'..'Sun'
  const limit = opts?.limit ?? 500;

  return useQuery<ScheduleMap>({
    queryKey: ['schedule', sectionId, day, limit],
    enabled: !!sectionId && !isAuthLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      // If a specific day is requested, fetch only that day's slots to reduce payload.
      let query = supabase
        .from('timetable_slots')
        .select(`
          id, day_of_week, start_time, end_time, room, type, created_by,
          subjects:subject_id (code, name)
        `)
        .eq('section_id', sectionId!)
        .order('start_time');

      if (typeof day === 'string') {
        const idx = DAY_NAMES.indexOf(day);
        if (idx >= 0) query = query.eq('day_of_week', idx);
      } else {
        // global fetch: cap results to avoid accidental huge payloads
        query = query.limit(limit);
      }

      const { data, error } = await query;
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
          teacher: '',
          type: slot.type.charAt(0).toUpperCase() + slot.type.slice(1),
          startTime: slot.start_time.slice(0, 5), // HH:MM
          endTime: slot.end_time.slice(0, 5),
        };
        if (!map[dayName]) map[dayName] = [];
        map[dayName].push(entry);
      }
      return map;
    },
  });
}

// ── 7. Attendance ────────────────────────────────────────────────────────────

export function useAttendance() {
  const { userId, isAuthLoading } = useAuthContext();
  return useQuery<{ subjects: AttendanceSubject[]; overall: number }>({
    queryKey: ['attendance', userId],
    enabled: !!userId && !isAuthLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          present, od, makeup, absent, percentage,
          subjects:subject_id (code, name)
        `)
        .eq('user_id', userId!);
      if (error) throw error;

      const subjects: AttendanceSubject[] = (data ?? []).map(r => {
        const subj = r.subjects as SubjectRelation;
        const total = r.present + r.od + r.makeup + r.absent;
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
        };
      });

      const totalPresent = subjects.reduce((sum, s) => sum + s.present, 0);
      const totalHeld = subjects.reduce((sum, s) => sum + s.total, 0);
      const overall = totalHeld > 0 ? (totalPresent / totalHeld) * 100 : 0;

      return { subjects, overall };
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
  avatarUrl: string | null;
}

export function useSectionMembers() {
  const { sectionId, isAuthLoading } = useAuthContext();
  return useQuery<SectionMember[]>({
    queryKey: ['members', sectionId],
    enabled: !!sectionId && !isAuthLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, section_roll, university_roll, role, avatar_url')
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
        avatarUrl: u.avatar_url,
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
        .select('id, assignment_id, student_id, submission_link, status, submitted_at, nudge_sent')
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
      }));
    },
  });
}

