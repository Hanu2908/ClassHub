import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type { Database } from '../types/database.types';

type SlotType = Database['public']['Enums']['slot_type'];
type SubjectIdCode = { id: string; code: string };
type AttendanceUpsertRow = Database['public']['Tables']['attendance_records']['Insert'];

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
      const { data, error } = await supabase
        .from('announcements')
        .insert({
          section_id: sectionId!,
          author_id: userId!,
          title: input.title,
          message_content: input.message,
          priority: input.priority,
          deadline_at: input.deadline ?? null,
        })
        .select('id')
        .single();

      if (error) throw error;

      if (input.priority === 'critical' && data?.id) {
        supabase.functions.invoke('send-critical-announcement', {
          body: { announcementId: data.id },
        }).then(({ data, error: funcError }) => {
          if (funcError) {
            console.warn('Failed to broadcast critical announcement notification:', funcError);
          } else {
            console.log('Push notification result:', data);
          }
        }).catch((err) => {
          console.warn('Error invoking send-critical-announcement function:', err);
        });
      }

      return data?.id;
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['section_acknowledgments'] });
    },
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
      sets?: { label: string; description: string; rollStart: number; rollEnd: number; pdfUrl?: string | null; pageNumbers?: string | null }[];
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
            page_numbers: s.pageNumbers ?? null,
          }))
        );
        if (setErr) throw setErr;
      }

      return assignment.id;
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
      allowMultiple: boolean;
    }) => {
      const { data: poll, error } = await supabase
        .from('polls')
        .insert({
          section_id: sectionId!,
          created_by: userId!,
          question_text: input.question,
          poll_type: input.pollType,
          expires_at: input.expiresAt ?? null,
          allow_multiple: input.allowMultiple,
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

import { generateAnonymousToken } from '../lib/utils';

export function useVotePoll() {
  const qc = useQueryClient();
  const { userId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      pollId: string;
      optionId: string;
      pollType: 'general' | 'anonymous' | 'actionable';
      allowMultiple: boolean;
      isSelected: boolean;
    }) => {
      const isAnonymous = input.pollType === 'general' || input.pollType === 'anonymous';
      const token = isAnonymous ? generateAnonymousToken(userId!, input.pollId) : null;

      if (input.allowMultiple) {
        // Multi-select poll: toggle option
        if (input.isSelected) {
          // Toggle OFF: delete the specific vote for this option
          const deleteQuery = supabase.from('votes').delete().eq('option_id', input.optionId);
          if (isAnonymous) {
            deleteQuery.eq('anonymous_token', token!);
          } else {
            deleteQuery.eq('student_id', userId!);
          }
          const { error } = await deleteQuery;
          if (error) throw error;
        } else {
          // Toggle ON: insert the vote for this option
          const { error } = await supabase.from('votes').insert({
            poll_id: input.pollId,
            option_id: input.optionId,
            student_id: isAnonymous ? null : userId!,
            anonymous_token: token,
          });
          if (error) throw error;
        }
      } else {
        // Single-select poll: change or cast vote
        // First delete any existing vote on this poll for this user
        const deleteQuery = supabase.from('votes').delete().eq('poll_id', input.pollId);
        if (isAnonymous) {
          deleteQuery.eq('anonymous_token', token!);
        } else {
          deleteQuery.eq('student_id', userId!);
        }
        const { error: delErr } = await deleteQuery;
        if (delErr) throw delErr;

        // If they were toggling OFF the already selected option, we are done.
        // If they clicked a DIFFERENT option (isSelected was false), we insert the new vote.
        if (!input.isSelected) {
          const { error } = await supabase.from('votes').insert({
            poll_id: input.pollId,
            option_id: input.optionId,
            student_id: isAnonymous ? null : userId!,
            anonymous_token: token,
          });
          if (error) throw error;
        }
      }
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
      teacher?: string;
    }) => {
      const row = {
        ...(input.id ? { id: input.id } : {}),
        section_id: sectionId!,
        subject_id: input.subjectId,
        day_of_week: input.dayOfWeek,
        start_time: input.startTime,
        end_time: input.endTime,
        room: input.room ?? null,
        type: (input.type?.toLowerCase() ?? 'lecture') as SlotType,
        teacher: input.teacher ?? null,
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

/** Clear all slots for a specific day in the section */
export function useClearDaySlots() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  return useMutation({
    mutationFn: async (dayOfWeek: number) => {
      if (!sectionId) throw new Error('No section');
      const { error } = await supabase
        .from('timetable_slots')
        .delete()
        .eq('section_id', sectionId)
        .eq('day_of_week', dayOfWeek);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  });
}

/** Copy all slots from one day to another (replaces target day) */
export function useCopyDaySlots() {
  const qc = useQueryClient();
  const { sectionId, userId } = useAuthContext();
  return useMutation({
    mutationFn: async ({ fromDay, toDay }: { fromDay: number; toDay: number }) => {
      if (!sectionId) throw new Error('No section');
      // 1. Fetch source day slots
      const { data: source, error: fetchErr } = await supabase
        .from('timetable_slots')
        .select('subject_id, start_time, end_time, room, type, teacher')
        .eq('section_id', sectionId)
        .eq('day_of_week', fromDay);
      if (fetchErr) throw fetchErr;
      if (!source || source.length === 0) throw new Error('No slots to copy');

      // 2. Delete target day
      const { error: delErr } = await supabase
        .from('timetable_slots')
        .delete()
        .eq('section_id', sectionId)
        .eq('day_of_week', toDay);
      if (delErr) throw delErr;

      // 3. Insert copies
      const copies = source.map(s => ({
        section_id: sectionId!,
        subject_id: s.subject_id,
        day_of_week: toDay,
        start_time: s.start_time,
        end_time: s.end_time,
        room: s.room,
        type: s.type,
        teacher: s.teacher,
        created_by: userId!,
      }));
      const { error: insErr } = await supabase.from('timetable_slots').insert(copies);
      if (insErr) throw insErr;
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

// Ensure subjects exist for the given codes; create missing ones and return a mapping code -> id
export function useEnsureSubjects() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  return useMutation({
    mutationFn: async (items: Array<{ code: string; name?: string; semester?: number; accent?: string }>) => {
      if (!sectionId) throw new Error('Missing section context');
      const codes = Array.from(new Set(items.map(i => i.code).filter(Boolean)));
      if (codes.length === 0) return {} as Record<string, string>;

      const { data: existing, error: existingErr } = await supabase.from('subjects').select('id,code').in('code', codes).eq('section_id', sectionId);
      if (existingErr) throw existingErr;

      const existingMap = new Map<string, string>();
      (existing ?? []).forEach((s: SubjectIdCode) => existingMap.set(s.code, s.id));

      const missing = items
        .filter(i => i.code && !existingMap.has(i.code))
        .map(i => ({ section_id: sectionId!, code: i.code, name: i.name ?? i.code, semester: i.semester ?? 1, accent: i.accent ?? '#4A9EFF' }));

      let inserted: SubjectIdCode[] = [];
      if (missing.length > 0) {
        const { data: ins, error: insErr } = await supabase.from('subjects').insert(missing).select('id,code');
        if (insErr) throw insErr;
        inserted = ins ?? [];
      }

      const mapping: Record<string, string> = {};
      (existing ?? []).forEach((s: SubjectIdCode) => mapping[s.code] = s.id);
      inserted.forEach(s => mapping[s.code] = s.id);
      return mapping;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
  });
}

// Bulk import attendance parsed from ERP text. Accepts parsed subjects with `code` or `subjectId`, `present`, `absent`, `od?`, `makeup?`.
export function useBulkUpsertAttendance() {
  const qc = useQueryClient();
  const { userId, sectionId } = useAuthContext();
  return useMutation({
    mutationFn: async (items: Array<{ code?: string; subjectId?: string; present: number; absent: number; od?: number; makeup?: number }>) => {
      if (!userId) throw new Error('Not authenticated');
      if (!sectionId) throw new Error('Missing section context');

      // For items that already include subjectId, use them; otherwise resolve codes
      const rows: AttendanceUpsertRow[] = [];
      const itemsNeedingCode = items.filter(i => !i.subjectId && i.code).map(i => i as { code: string; present: number; absent: number; od?: number; makeup?: number });

      if (itemsNeedingCode.length > 0) {
        const codes = Array.from(new Set(itemsNeedingCode.map(i => i.code)));
        const { data: subjects, error: subjErr } = await supabase.from('subjects').select('id,code').in('code', codes).eq('section_id', sectionId);
        if (subjErr) throw subjErr;
        const codeToId = new Map<string, string>();
        (subjects ?? []).forEach((s: SubjectIdCode) => codeToId.set(s.code, s.id));

        itemsNeedingCode.forEach(i => {
          const sid = codeToId.get(i.code) ?? null;
          if (sid) rows.push({ user_id: userId, subject_id: sid, present: i.present, absent: i.absent, od: i.od ?? 0, makeup: i.makeup ?? 0 });
        });
      }

      // Items that already had subjectId
      items.forEach(i => {
        if (!i.subjectId) return;
        rows.push({ user_id: userId, subject_id: i.subjectId, present: i.present, absent: i.absent, od: i.od ?? 0, makeup: i.makeup ?? 0 });
      });

      if (rows.length === 0) throw new Error('No matching subjects found for import');

      const { error } = await supabase.from('attendance_records').upsert(rows, { onConflict: 'user_id,subject_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  });
}

export function useUpdateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase.from('subjects').update({ name: input.name }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}
