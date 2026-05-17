import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type {
  Announcement, Assignment, AssignmentSet, Poll, PollOption,
  ScheduleSlot, ScheduleMap, AttendanceSubject,
} from '../store/appStore';

// ── Helper: current user context ─────────────────────────────────────────────

function useAuthContext() {
  const authUser = useAppStore(s => s.authUser);
  return {
    userId: authUser?.id ?? null,
    sectionId: authUser?.sectionId ?? null,
    role: authUser?.role ?? 'student',
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
  const { sectionId } = useAuthContext();
  return useQuery<SectionInfo | null>({
    queryKey: ['section', sectionId],
    enabled: !!sectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sections')
        .select('id, name, college, invite_code, created_by')
        .eq('id', sectionId!)
        .single();
      if (error || !data) return null;
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
  const { sectionId } = useAuthContext();
  return useQuery<SubjectInfo[]>({
    queryKey: ['subjects', sectionId],
    enabled: !!sectionId,
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

export function useAnnouncements() {
  const { sectionId, userId } = useAuthContext();
  return useQuery<(Announcement & { isAcknowledged: boolean })[]>({
    queryKey: ['announcements', sectionId],
    enabled: !!sectionId,
    queryFn: async () => {
      // Fetch announcements
      const { data: anns, error: annErr } = await supabase
        .from('announcements')
        .select('*')
        .eq('section_id', sectionId!)
        .order('created_at', { ascending: false });
      if (annErr) throw annErr;

      // Fetch current user's acknowledgments
      let ackIds: string[] = [];
      if (userId) {
        const { data: acks } = await supabase
          .from('acknowledgments')
          .select('announcement_id')
          .eq('user_id', userId);
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

export function useAssignments() {
  const { sectionId, userId } = useAuthContext();
  return useQuery<Assignment[]>({
    queryKey: ['assignments', sectionId],
    enabled: !!sectionId,
    queryFn: async () => {
      // Fetch assignments with subject info
      const { data: assigns, error } = await supabase
        .from('assignments')
        .select(`
          *,
          subjects:subject_id (code, name),
          assignment_sets (id, set_label, description, pdf_url, roll_start, roll_end)
        `)
        .eq('section_id', sectionId!)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch current user's submissions
      let userSubs: Record<string, { link: string | null; status: string }> = {};
      if (userId) {
        const { data: subs } = await supabase
          .from('submissions')
          .select('assignment_id, submission_link, status')
          .eq('student_id', userId);
        for (const s of subs ?? []) {
          userSubs[s.assignment_id] = { link: s.submission_link, status: s.status };
        }
      }

      return (assigns ?? []).map(a => {
        const sub = userSubs[a.id];
        const subjectData = a.subjects as any;
        const sets: AssignmentSet[] = ((a.assignment_sets ?? []) as any[]).map(s => ({
          id: s.id,
          label: s.set_label,
          rollStart: s.roll_start,
          rollEnd: s.roll_end,
          pageNumbers: '',
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
  const { sectionId, userId } = useAuthContext();
  return useQuery<(Poll & { userVote: string | null })[]>({
    queryKey: ['polls', sectionId],
    enabled: !!sectionId,
    queryFn: async () => {
      const { data: polls, error } = await supabase
        .from('polls')
        .select(`
          *,
          poll_options (id, label, sort_order)
        `)
        .eq('section_id', sectionId!)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Get user's votes
      let userVotes: Record<string, string> = {};
      if (userId) {
        const { data: votes } = await supabase
          .from('votes')
          .select('poll_id, option_id')
          .eq('student_id', userId);
        for (const v of votes ?? []) {
          userVotes[v.poll_id] = v.option_id;
        }
      }

      // Get vote counts via a batched RPC to avoid N+1 calls
      const results: Record<string, Record<string, number>> = {};
      const pollIds = (polls ?? []).map(p => p.id);
      if (pollIds.length > 0) {
        const { data: batchRes, error: batchErr } = await supabase.rpc('batch_poll_results', { target_polls: pollIds });
        if (batchErr) throw batchErr;
        for (const r of (batchRes ?? [])) {
          if (!results[r.poll_id]) results[r.poll_id] = {};
          results[r.poll_id][r.option_id] = r.votes;
        }
      }

      return (polls ?? []).map(p => {
        const opts = ((p.poll_options ?? []) as any[])
          .sort((a: any, b: any) => a.sort_order - b.sort_order);
        const isActive = p.is_active && (!p.expires_at || new Date(p.expires_at) > new Date());

        const options: PollOption[] = opts.map((o: any) => ({
          id: o.id,
          text: o.label,
          votes: results[p.id]?.[o.id] ?? 0,
        }));

        return {
          id: p.id,
          question: p.question_text,
          type: p.poll_type === 'general' ? 'anonymous' as const : 'actionable' as const,
          closesAt: p.expires_at ?? new Date(Date.now() + 7 * 86400000).toISOString(),
          status: isActive ? 'active' as const : 'closed' as const,
          options,
          createdAt: p.created_at,
          userVote: userVotes[p.id] ?? null,
        };
      });
    },
  });
}

// ── 6. Schedule (timetable) ──────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function useSchedule() {
  const { sectionId } = useAuthContext();
  return useQuery<ScheduleMap>({
    queryKey: ['schedule', sectionId],
    enabled: !!sectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timetable_slots')
        .select(`
          id, day_of_week, start_time, end_time, room, type, created_by,
          subjects:subject_id (code, name)
        `)
        .eq('section_id', sectionId!)
        .order('start_time');
      if (error) throw error;

      const map: ScheduleMap = {};
      for (const slot of data ?? []) {
        const day = DAY_NAMES[slot.day_of_week] ?? 'Mon';
        const subjectData = slot.subjects as any;
        const entry: ScheduleSlot = {
          id: slot.id,
          day,
          subject: subjectData?.name ?? 'Free Period',
          code: subjectData?.code ?? '',
          room: slot.room ?? '',
          teacher: '',
          type: slot.type.charAt(0).toUpperCase() + slot.type.slice(1),
          startTime: slot.start_time.slice(0, 5), // HH:MM
          endTime: slot.end_time.slice(0, 5),
        };
        if (!map[day]) map[day] = [];
        map[day].push(entry);
      }
      return map;
    },
  });
}

// ── 7. Attendance ────────────────────────────────────────────────────────────

export function useAttendance() {
  const { userId } = useAuthContext();
  return useQuery<{ subjects: AttendanceSubject[]; overall: number }>({
    queryKey: ['attendance', userId],
    enabled: !!userId,
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
        const subj = r.subjects as any;
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

      const overall = subjects.length > 0
        ? subjects.reduce((s, sub) => s + sub.percentage, 0) / subjects.length
        : 0;

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
  const { sectionId } = useAuthContext();
  return useQuery<SectionMember[]>({
    queryKey: ['members', sectionId],
    enabled: !!sectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, section_roll, university_roll, role, avatar_url')
        .eq('section_id', sectionId!)
        .order('section_roll');
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
