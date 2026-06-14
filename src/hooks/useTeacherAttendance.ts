import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type { Database } from '../types/database.types';

type AttendanceSession = Database['public']['Tables']['attendance_sessions']['Row'];
type StudentSessionAttendance = Database['public']['Tables']['student_session_attendance']['Row'];

interface SessionWithDetails extends AttendanceSession {
  present_count: number;
  absent_count: number;
  od_count: number;
  makeup_count: number;
}

// ── 1. Fetch Teacher Sessions ────────────────────────────────────────────────
export function useTeacherSessions(sectionId: string, subjectId: string) {
  return useQuery<SessionWithDetails[]>({
    queryKey: ['teacher-sessions', sectionId, subjectId],
    enabled: !!sectionId && !!subjectId,
    queryFn: async () => {
      // 1. Fetch sessions
      const { data: sessions, error: sessionErr } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('section_id', sectionId)
        .eq('subject_id', subjectId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (sessionErr) throw sessionErr;
      if (!sessions || sessions.length === 0) return [];

      const sessionIds = sessions.map(s => s.id);

      // 2. Fetch counts grouped by status
      const { data: counts, error: countErr } = await supabase
        .from('student_session_attendance')
        .select('session_id, status')
        .in('session_id', sessionIds);

      if (countErr) throw countErr;

      const countsMap = new Map<string, { present: number; absent: number; od: number; makeup: number }>();
      sessions.forEach(s => countsMap.set(s.id, { present: 0, absent: 0, od: 0, makeup: 0 }));

      (counts || []).forEach(c => {
        const current = countsMap.get(c.session_id);
        if (current) {
          if (c.status === 'present') current.present++;
          else if (c.status === 'absent') current.absent++;
          else if (c.status === 'od') current.od++;
          else if (c.status === 'makeup') current.makeup++;
        }
      });

      return sessions.map(s => {
        const stats = countsMap.get(s.id) || { present: 0, absent: 0, od: 0, makeup: 0 };
        return {
          ...s,
          present_count: stats.present,
          absent_count: stats.absent,
          od_count: stats.od,
          makeup_count: stats.makeup,
        };
      });
    },
  });
}

// ── 2. Fetch Session Details (Student list with their marked status) ─────────
export interface SessionStudentDetail {
  student_id: string;
  name: string;
  section_roll: string | null;
  avatar_url: string | null;
  status: 'present' | 'absent' | 'od' | 'makeup';
}

export function useSessionDetails(sessionId: string, sectionId: string) {
  return useQuery<SessionStudentDetail[]>({
    queryKey: ['session-details', sessionId],
    enabled: !!sessionId && !!sectionId,
    queryFn: async () => {
      // 1. Fetch section students
      const { data: students, error: studentErr } = await supabase
        .from('users')
        .select('id, name, section_roll, avatar_url')
        .eq('section_id', sectionId)
        .order('section_roll', { ascending: true });

      if (studentErr) throw studentErr;

      // 2. Fetch session attendance markings
      const { data: markings, error: markingErr } = await supabase
        .from('student_session_attendance')
        .select('student_id, status')
        .eq('session_id', sessionId);

      if (markingErr) throw markingErr;

      const markingMap = new Map<string, 'present' | 'absent' | 'od' | 'makeup'>();
      (markings || []).forEach(m => {
        markingMap.set(m.student_id, m.status as any);
      });

      return (students || []).map(s => ({
        student_id: s.id,
        name: s.name,
        section_roll: s.section_roll,
        avatar_url: s.avatar_url,
        status: markingMap.get(s.id) || 'present', // Defaults to present if somehow missing
      }));
    },
  });
}

// ── 3. Log Attendance Mutation (Create Session + Statuses) ───────────────────
interface LogAttendanceInput {
  sessionId: string; // Client-generated UUID for idempotency
  sectionId: string;
  subjectId: string;
  date: string;
  timetableSlotId: string | null;
  targetBatch: string | null;
  lectureCount: number;
  markings: Array<{ studentId: string; status: 'present' | 'absent' | 'od' | 'makeup' }>;
}

export function useLogAttendanceMutation() {
  const qc = useQueryClient();
  const authUser = useAppStore(s => s.authUser);

  return useMutation({
    mutationFn: async (input: LogAttendanceInput) => {
      // 1. Create Session
      const { error: sessionErr } = await supabase
        .from('attendance_sessions')
        .insert({
          id: input.sessionId,
          section_id: input.sectionId,
          subject_id: input.subjectId,
          teacher_id: authUser?.id || null,
          date: input.date,
          timetable_slot_id: input.timetableSlotId || null,
          target_batch: input.targetBatch || null,
          lecture_count: input.lectureCount,
        });

      if (sessionErr) throw sessionErr;

      // 2. Bulk Insert Statuses
      const statusRows = input.markings.map(m => ({
        session_id: input.sessionId,
        student_id: m.studentId,
        status: m.status,
      }));

      const { error: statusErr } = await supabase
        .from('student_session_attendance')
        .insert(statusRows);

      if (statusErr) {
        // Cleanup session row on status insert failure to prevent orphan sessions
        await supabase.from('attendance_sessions').delete().eq('id', input.sessionId);
        throw statusErr;
      }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['teacher-sessions', variables.sectionId, variables.subjectId] });
      qc.invalidateQueries({ queryKey: ['section-attendance', variables.sectionId, variables.subjectId] });
      // Invalidate global aggregate queries
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['counsellor-remarks'] });
      qc.invalidateQueries({ queryKey: ['counsellor-batch-students'] });
      qc.invalidateQueries({ queryKey: ['batch-students-attendance'] });
    },
  });
}

// ── 4. Update Attendance Session (Status Overrides) ─────────────────────────
interface UpdateAttendanceInput {
  sessionId: string;
  sectionId: string;
  subjectId: string;
  updates: Array<{ studentId: string; status: 'present' | 'absent' | 'od' | 'makeup' }>;
}

export function useUpdateSessionMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateAttendanceInput) => {
      const upsertRows = input.updates.map(u => ({
        session_id: input.sessionId,
        student_id: u.studentId,
        status: u.status,
      }));

      const { error } = await supabase
        .from('student_session_attendance')
        .upsert(upsertRows, { onConflict: 'session_id,student_id' });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['teacher-sessions', variables.sectionId, variables.subjectId] });
      qc.invalidateQueries({ queryKey: ['session-details', variables.sessionId] });
      qc.invalidateQueries({ queryKey: ['section-attendance', variables.sectionId, variables.subjectId] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['counsellor-remarks'] });
      qc.invalidateQueries({ queryKey: ['counsellor-batch-students'] });
      qc.invalidateQueries({ queryKey: ['batch-students-attendance'] });
    },
  });
}

// ── 5. Delete Attendance Session ─────────────────────────────────────────────
interface DeleteAttendanceInput {
  sessionId: string;
  sectionId: string;
  subjectId: string;
}

export function useDeleteSessionMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: DeleteAttendanceInput) => {
      const { error } = await supabase
        .from('attendance_sessions')
        .delete()
        .eq('id', input.sessionId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['teacher-sessions', variables.sectionId, variables.subjectId] });
      qc.invalidateQueries({ queryKey: ['section-attendance', variables.sectionId, variables.subjectId] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['counsellor-remarks'] });
      qc.invalidateQueries({ queryKey: ['counsellor-batch-students'] });
      qc.invalidateQueries({ queryKey: ['batch-students-attendance'] });
    },
  });
}

// ── 6. Create Cancel Class Flash Announcement Mutation ───────────────────────
interface CancelClassInput {
  sectionId: string;
  subjectCode: string;
  subjectName: string;
  dateStr: string;
  slotLabel: string;
  targetBatch: string | null;
}

export function useCancelClassMutation() {
  const qc = useQueryClient();
  const authUser = useAppStore(s => s.authUser);

  return useMutation({
    mutationFn: async (input: CancelClassInput) => {
      if (!authUser?.id) throw new Error('Not authenticated');

      const batchSuffix = input.targetBatch ? ` (Batch ${input.targetBatch})` : '';
      const announcementTitle = `Class Cancelled: ${input.subjectCode} ${batchSuffix} 🚨`;
      const announcementBody = `The scheduled ${input.subjectName} class for ${input.dateStr} during ${input.slotLabel} has been cancelled. Please do not proceed to the lecture hall.`;

      // Set expiry to 6 hours from now
      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from('announcements')
        .insert({
          section_id: input.sectionId,
          author_id: authUser.id,
          title: announcementTitle,
          message_content: announcementBody,
          priority: 'critical',
          target_batch: input.targetBatch || null,
          expires_at: expiresAt,
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['announcements', variables.sectionId] });
    },
  });
}
