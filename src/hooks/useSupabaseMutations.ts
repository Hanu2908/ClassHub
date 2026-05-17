import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';

// ── Helper ───────────────────────────────────────────────────────────────────

function useAuthContext() {
  const authUser = useAppStore(s => s.authUser);
  return {
    userId: authUser?.id ?? null,
    sectionId: authUser?.sectionId ?? null,
    role: authUser?.role ?? 'student',
  };
}

// ── Announcements ────────────────────────────────────────────────────────────

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  const { sectionId, userId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      message: string;
      priority: 'general' | 'critical';
      deadline?: string | null;
    }) => {
      const { error } = await supabase.from('announcements').insert({
        section_id: sectionId!,
        author_id: userId!,
        title: input.title,
        message_content: input.message,
        priority: input.priority,
        deadline_at: input.deadline ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

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

export function useAcknowledge() {
  const qc = useQueryClient();
  const { userId } = useAuthContext();
  return useMutation({
    mutationFn: async (announcementId: string) => {
      const { error } = await supabase.from('acknowledgments').insert({
        announcement_id: announcementId,
        user_id: userId!,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

// ── Assignments ──────────────────────────────────────────────────────────────

export function useCreateAssignment() {
  const qc = useQueryClient();
  const { sectionId, userId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      subjectId: string;
      dueDate: string;
      sets?: { label: string; description: string; rollStart: number; rollEnd: number; pdfUrl?: string | null }[];
    }) => {
      const { data: assignment, error } = await supabase
        .from('assignments')
        .insert({
          section_id: sectionId!,
          created_by: userId!,
          title: input.title,
          description: input.description ?? null,
          subject_id: input.subjectId,
          due_date: input.dueDate,
        })
        .select('id')
        .single();
      if (error) throw error;

      // Insert sets if provided
      if (input.sets && input.sets.length > 0) {
        const { error: setErr } = await supabase.from('assignment_sets').insert(
          input.sets.map(s => ({
            assignment_id: assignment.id,
            set_label: s.label,
            description: s.description,
            roll_start: s.rollStart,
            roll_end: s.rollEnd,
            pdf_url: s.pdfUrl ?? null,
          }))
        );
        if (setErr) throw setErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });
}

export function useSubmitAssignment() {
  const qc = useQueryClient();
  const { userId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: { assignmentId: string; link: string }) => {
      const { error } = await supabase.from('submissions').upsert({
        assignment_id: input.assignmentId,
        student_id: userId!,
        submission_link: input.link,
        status: 'submitted' as const,
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'assignment_id,student_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });
}

// ── Polls ────────────────────────────────────────────────────────────────────

export function useCreatePoll() {
  const qc = useQueryClient();
  const { sectionId, userId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      question: string;
      pollType: 'general' | 'actionable';
      expiresAt?: string | null;
      options: string[];
    }) => {
      const { data: poll, error } = await supabase
        .from('polls')
        .insert({
          section_id: sectionId!,
          created_by: userId!,
          question_text: input.question,
          poll_type: input.pollType,
          expires_at: input.expiresAt ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;

      const { error: optErr } = await supabase.from('poll_options').insert(
        input.options.map((label, i) => ({
          poll_id: poll.id,
          label,
          sort_order: i,
        }))
      );
      if (optErr) throw optErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['polls'] }),
  });
}

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

export function useVotePoll() {
  const qc = useQueryClient();
  const { userId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: { pollId: string; optionId: string }) => {
      const { error } = await supabase.from('votes').insert({
        poll_id: input.pollId,
        option_id: input.optionId,
        student_id: userId!,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['polls'] }),
  });
}

// ── Schedule (Timetable) ─────────────────────────────────────────────────────

export function useUpsertScheduleSlot() {
  const qc = useQueryClient();
  const { sectionId, userId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      subjectId: string | null;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      room?: string;
      type?: string;
    }) => {
      const row = {
        ...(input.id ? { id: input.id } : {}),
        section_id: sectionId!,
        subject_id: input.subjectId,
        day_of_week: input.dayOfWeek,
        start_time: input.startTime,
        end_time: input.endTime,
        room: input.room ?? null,
        type: (input.type?.toLowerCase() ?? 'lecture') as any,
        created_by: userId!,
      };
      const { error } = await supabase.from('timetable_slots').upsert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  });
}

export function useDeleteScheduleSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('timetable_slots').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  });
}

// ── Attendance ───────────────────────────────────────────────────────────────

export function useUpdateAttendance() {
  const qc = useQueryClient();
  const { userId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      subjectId: string;
      present: number;
      absent: number;
      od?: number;
      makeup?: number;
    }) => {
      const { error } = await supabase.from('attendance_records').upsert({
        user_id: userId!,
        subject_id: input.subjectId,
        present: input.present,
        absent: input.absent,
        od: input.od ?? 0,
        makeup: input.makeup ?? 0,
      }, { onConflict: 'user_id,subject_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  });
}

// ── Subjects ─────────────────────────────────────────────────────────────────

export function useCreateSubject() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      code: string;
      name: string;
      semester: number;
      accent?: string;
    }) => {
      const { error } = await supabase.from('subjects').insert({
        section_id: sectionId!,
        code: input.code,
        name: input.name,
        semester: input.semester,
        accent: input.accent ?? '#4A9EFF',
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
  });
}

export function useUpdateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      code?: string;
      name?: string;
      semester?: number;
      accent?: string;
    }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from('subjects').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
  });
}
