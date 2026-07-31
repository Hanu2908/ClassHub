import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';

export interface RosterStudent {
  id: string;
  name: string;
  classRoll: string | null;
  universityRoll: string | null;
  subBatch: '1' | '2' | null;
  avatarUrl: string | null;
}

export interface CRAttendanceMarking {
  studentId: string;
  status: 'present' | 'absent' | 'od' | 'makeup';
}

export interface LogCRAttendanceInput {
  sessionId: string;
  sectionId: string;
  subjectId: string;
  date: string;
  timetableSlotId?: string | null;
  targetBatch?: '1' | '2' | null;
  lectureCount: number;
  markings: CRAttendanceMarking[];
}

/**
 * Helper function to parse roll number string into an integer for accurate roll sorting
 */
export const getRollNumber = (roll: string | null | undefined): number => {
  if (!roll) return 9999;
  const cleaned = roll.replace(/[^0-9]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 9999 : num;
};

/**
 * Fetch section student roster sorted by class roll number
 */
export function useSectionRosterForAttendance(sectionId?: string | null) {
  const authUser = useAppStore(s => s.authUser);
  const targetSectionId = sectionId || authUser?.sectionId;

  return useQuery<RosterStudent[]>({
    queryKey: ['cr-section-roster', targetSectionId],
    enabled: !!targetSectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, section_roll, university_roll, sub_batch, avatar_url, role')
        .eq('section_id', targetSectionId!)
        .neq('role', 'teacher');

      if (error) throw error;

      const roster: RosterStudent[] = (data || []).map((u: any) => ({
        id: u.id,
        name: u.name || 'Unknown Student',
        classRoll: u.section_roll || null,
        universityRoll: u.university_roll || null,
        subBatch: u.sub_batch as '1' | '2' | null,
        avatarUrl: u.avatar_url || null,
      }));

      // Sort by class roll number ascending
      return roster.sort((a, b) => {
        const rA = getRollNumber(a.classRoll);
        const rB = getRollNumber(b.classRoll);
        if (rA !== rB) return rA - rB;
        return a.name.localeCompare(b.name);
      });
    },
  });
}

/**
 * Mutation to log CR attendance register session
 */
export function useLogCRAttendanceMutation() {
  const qc = useQueryClient();
  const authUser = useAppStore(s => s.authUser);

  return useMutation({
    mutationFn: async (input: LogCRAttendanceInput) => {
      if (!authUser?.id) throw new Error('Not authenticated');

      // 1. Create Session
      const { error: sessionErr } = await supabase
        .from('attendance_sessions' as any)
        .insert({
          id: input.sessionId,
          section_id: input.sectionId,
          subject_id: input.subjectId,
          teacher_id: authUser.id,
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
        .from('student_session_attendance' as any)
        .insert(statusRows);

      if (statusErr) {
        // Rollback session creation if status insertion fails
        await supabase.from('attendance_sessions' as any).delete().eq('id', input.sessionId);
        throw statusErr;
      }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['teacher-sessions', variables.sectionId, variables.subjectId] });
      qc.invalidateQueries({ queryKey: ['section-attendance'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['counsellor-remarks'] });
      qc.invalidateQueries({ queryKey: ['batch-students-attendance'] });
    },
  });
}
