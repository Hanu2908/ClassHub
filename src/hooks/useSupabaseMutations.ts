import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type { Database } from '../types/database.types';
import { enqueueAction } from '../lib/offlineSync';
import { assignmentSchema } from '../lib/validation/assignments.schema';
import { pollSchema } from '../lib/validation/polls.schema';
import { timetableSlotSchema } from '../lib/validation/timetable.schema';

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
      expiresAt?: string | null;
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
          expires_at: input.expiresAt ?? null,
        })
        .select('id')
        .single();

      if (error) throw error;

      if (data?.id) {
        try {
          const { data: pushData, error: funcError } = await supabase.functions.invoke('send-critical-announcement', {
            body: { announcementId: data.id },
          });
          if (funcError) {
            console.warn('Failed to broadcast critical announcement notification:', funcError);
          } else {
            console.log('Push notification result:', pushData);
          }
        } catch (err) {
          console.warn('Error invoking send-critical-announcement function:', err);
        }
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
      if (!navigator.onLine) {
        if (import.meta.env.DEV) {
          console.log('[OfflineSync] Network offline. Enqueuing acknowledgment.');
        }
        await enqueueAction('acknowledge', { announcementId, userId: userId! });
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((reg) => {
            if ('sync' in reg) {
              return (reg as any).sync.register('sync-offline-actions');
            }
          }).catch((err) => console.warn('[OfflineSync] Sync registration failed:', err));
        }
        return; // Optimistic success
      }

      try {
        const { error } = await supabase.from('acknowledgments').insert({
          announcement_id: announcementId,
          user_id: userId!,
        });
        if (error) {
          throw error;
        }
      } catch (err: any) {
        const isNetworkErr = err.message?.includes('Failed to fetch') || err.name === 'TypeError';
        if (isNetworkErr) {
          if (import.meta.env.DEV) {
            console.warn('[OfflineSync] Mutation failed due to network error. Enqueuing acknowledgment:', err);
          }
          await enqueueAction('acknowledge', { announcementId, userId: userId! });
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((reg) => {
              if ('sync' in reg) {
                return (reg as any).sync.register('sync-offline-actions');
              }
            }).catch((syncErr) => console.warn('[OfflineSync] Sync registration failed:', syncErr));
          }
          return; // Optimistic success
        }
        throw err;
      }
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
  const { sectionId, userId, role } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      subjectId: string;
      dueDate: string;
      sets?: { label: string; description: string; rollStart: number; rollEnd: number; pdfUrl?: string | null; pageNumbers?: string | null }[];
    }) => {
      // 1. Enforce strict CR authorization check
      if (role !== 'cr') {
        throw new Error('Unauthorized: Only Class Representatives can create assignments');
      }

      // 2. Enforce strict Zod schema validation
      const validated = assignmentSchema.parse({
        title: input.title.trim(),
        subjectId: input.subjectId,
        dueDate: input.dueDate,
        sets: input.sets ? input.sets.map(s => ({
          label: s.label,
          rollStart: s.rollStart,
          rollEnd: s.rollEnd,
          description: s.description,
          pdfUrl: s.pdfUrl ?? undefined,
        })) : undefined,
      });

      const { data: assignment, error } = await supabase
        .from('assignments')
        .insert({
          section_id: sectionId!,
          created_by: userId!,
          title: validated.title,
          description: input.description?.trim() ?? null,
          subject_id: validated.subjectId,
          due_date: new Date(validated.dueDate).toISOString(),
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

      // Trigger push notification broadcast to all section members
      if (sectionId) {
        try {
          await supabase.functions.invoke('send-custom-notification', {
            body: {
              title: `📝 New Assignment: ${validated.title}`,
              body: `A new assignment has been posted. Due: ${new Date(validated.dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`,
              sectionId: sectionId,
              skipDbInsert: true
            }
          });
        } catch (err) {
          console.warn('Failed to send push notification for new assignment:', err);
        }
      }

      return assignment.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });
}

export function useUpdateAssignment() {
  const qc = useQueryClient();
  const { sectionId, role } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      description?: string;
      subjectId: string;
      dueDate: string;
      sets?: { id?: string; label: string; description: string; rollStart: number; rollEnd: number; pdfUrl?: string | null; pageNumbers?: string | null }[];
      notifyClass?: boolean;
    }) => {
      // 1. Enforce strict CR authorization check
      if (role !== 'cr') {
        throw new Error('Unauthorized: Only Class Representatives can update assignments');
      }

      // 2. Enforce strict Zod schema validation
      const validated = assignmentSchema.parse({
        title: input.title.trim(),
        subjectId: input.subjectId,
        dueDate: input.dueDate,
        sets: input.sets ? input.sets.map(s => ({
          label: s.label,
          rollStart: s.rollStart,
          rollEnd: s.rollEnd,
          description: s.description,
          pdfUrl: s.pdfUrl ?? undefined,
        })) : undefined,
      });

      // 3. Update assignment
      const { error: assignmentErr } = await supabase
        .from('assignments')
        .update({
          title: validated.title,
          description: input.description?.trim() ?? null,
          subject_id: validated.subjectId,
          due_date: new Date(validated.dueDate).toISOString(),
        })
        .eq('id', input.id);
      if (assignmentErr) throw assignmentErr;

      // 4. Sync assignment sets
      const { data: existingSets, error: getSetsErr } = await supabase
        .from('assignment_sets')
        .select('id')
        .eq('assignment_id', input.id);
      if (getSetsErr) throw getSetsErr;

      const existingIds = (existingSets ?? []).map(s => s.id);

      if (input.sets && input.sets.length > 0) {
        const inputSetIds = input.sets.map(s => s.id).filter(Boolean) as string[];
        const idsToDelete = existingIds.filter(id => !inputSetIds.includes(id));
        if (idsToDelete.length > 0) {
          const { error: delErr } = await supabase
            .from('assignment_sets')
            .delete()
            .in('id', idsToDelete);
          if (delErr) throw delErr;
        }

        const setsToUpdate = input.sets.filter(s => s.id).map(s => ({
          id: s.id!,
          assignment_id: input.id,
          set_label: s.label,
          description: s.description,
          roll_start: s.rollStart,
          roll_end: s.rollEnd,
          pdf_url: s.pdfUrl ?? null,
          page_numbers: s.pageNumbers ?? null,
        }));

        const setsToInsert = input.sets.filter(s => !s.id).map(s => ({
          assignment_id: input.id,
          set_label: s.label,
          description: s.description,
          roll_start: s.rollStart,
          roll_end: s.rollEnd,
          pdf_url: s.pdfUrl ?? null,
          page_numbers: s.pageNumbers ?? null,
        }));

        if (setsToUpdate.length > 0) {
          const { error: updateErr } = await supabase
            .from('assignment_sets')
            .upsert(setsToUpdate);
          if (updateErr) throw updateErr;
        }

        if (setsToInsert.length > 0) {
          const { error: insertErr } = await supabase
            .from('assignment_sets')
            .insert(setsToInsert);
          if (insertErr) throw insertErr;
        }
      } else {
        if (existingIds.length > 0) {
          const { error: delErr } = await supabase
            .from('assignment_sets')
            .delete()
            .eq('assignment_id', input.id);
          if (delErr) throw delErr;
        }
      }

      // 5. Optional class push notifications
      if (input.notifyClass && sectionId) {
        try {
          const { data: pushData, error: funcError } = await supabase.functions.invoke('send-custom-notification', {
            body: {
              title: `Assignment Updated: ${validated.title}`,
              body: `The assignment details or deadline have been modified. Please review.`,
              sectionId: sectionId,
              skipDbInsert: true
            }
          });
          if (funcError) {
            console.warn('Failed to send class update push notifications:', funcError);
          } else {
            console.log('Custom update push notification sent:', pushData);
          }
        } catch (err) {
          console.warn('Error invoking send-custom-notification function:', err);
        }
      }

      return input.id;
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

/**
 * CR-only: toggle cr_verified flag on a student's submission.
 * This is independent of the student's own `status` field.
 * If no row exists yet (student hasn't self-submitted), creates one with cr_verified=true.
 */
export function useCRToggleSubmission() {
  const qc = useQueryClient();
  const { role } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      assignmentId: string;
      studentId: string;
      crVerified: boolean;
    }) => {
      // Enforce strict CR authorization check
      if (role !== 'cr') {
        throw new Error('Unauthorized: Only Class Representatives can verify submissions');
      }

      const { error } = await supabase
        .from('submissions')
        .upsert({
          assignment_id: input.assignmentId,
          student_id: input.studentId,
          cr_verified: input.crVerified,
        }, { onConflict: 'assignment_id,student_id', ignoreDuplicates: false });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['assignment_submissions', vars.assignmentId] });
    },
  });
}


// ── Polls ────────────────────────────────────────────────────────────────────

export function useCreatePoll() {
  const qc = useQueryClient();
  const { sectionId, userId, role } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      question: string;
      pollType: 'general' | 'actionable';
      expiresAt?: string | null;
      options: string[];
      allowMultiple: boolean;
    }) => {
      // 1. Enforce strict CR authorization check
      if (role !== 'cr') {
        throw new Error('Unauthorized: Only Class Representatives can create polls');
      }

      // 2. Validate input using Zod
      const validated = pollSchema.parse({
        question: input.question.trim(),
        type: input.pollType,
        options: input.options,
      });

      const { data: poll, error } = await supabase
        .from('polls')
        .insert({
          section_id: sectionId!,
          created_by: userId!,
          question_text: validated.question,
          poll_type: validated.type,
          expires_at: input.expiresAt ?? null,
          allow_multiple: input.allowMultiple,
        })
        .select('id')
        .single();
      if (error) throw error;

      const { error: optErr } = await supabase.from('poll_options').insert(
        (validated.options ?? []).map((label, i) => ({
          poll_id: poll.id,
          label: label.trim(),
          sort_order: i,
        }))
      );
      if (optErr) throw optErr;

      // Trigger push notification for new poll
      try {
        await supabase.functions.invoke('send-new-poll-notification', {
          body: { pollId: poll.id }
        });
      } catch (err) {
        console.warn('Failed to send push notification for new poll:', err);
      }
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
    mutationFn: async (input: {
      pollId: string;
      optionId: string;
      pollType: 'general' | 'anonymous' | 'actionable';
      allowMultiple: boolean;
      isSelected: boolean;
    }) => {
      const executeMutation = async () => {
        const isAnonymous = input.pollType === 'general' || input.pollType === 'anonymous';
        let token: string | null = null;
        if (isAnonymous) {
          const { data, error } = await supabase.rpc('calculate_anonymous_token', {
            user_id: userId!,
            poll_id: input.pollId
          });
          if (error) throw error;
          token = data;
        }

        if (input.allowMultiple) {
          if (input.isSelected) {
            const deleteQuery = supabase.from('votes').delete().eq('option_id', input.optionId);
            if (isAnonymous) {
              deleteQuery.eq('anonymous_token', token!);
            } else {
              deleteQuery.eq('student_id', userId!);
            }
            const { error } = await deleteQuery;
            if (error) throw error;
          } else {
            const { error } = await supabase.from('votes').insert({
              poll_id: input.pollId,
              option_id: input.optionId,
              student_id: isAnonymous ? null : userId!,
              anonymous_token: token,
            });
            if (error) throw error;
          }
        } else {
          const deleteQuery = supabase.from('votes').delete().eq('poll_id', input.pollId);
          if (isAnonymous) {
            deleteQuery.eq('anonymous_token', token!);
          } else {
            deleteQuery.eq('student_id', userId!);
          }
          const { error: delErr } = await deleteQuery;
          if (delErr) throw delErr;

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
      };

      if (!navigator.onLine) {
        if (import.meta.env.DEV) {
          console.log('[OfflineSync] Network offline. Enqueuing poll vote.');
        }
        await enqueueAction('vote', { ...input, userId: userId! });
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((reg) => {
            if ('sync' in reg) {
              return (reg as any).sync.register('sync-offline-actions');
            }
          }).catch((err) => console.warn('[OfflineSync] Sync registration failed:', err));
        }
        return; // Optimistic success
      }

      try {
        await executeMutation();
      } catch (err: any) {
        const isNetworkErr = err.message?.includes('Failed to fetch') || err.name === 'TypeError';
        if (isNetworkErr) {
          if (import.meta.env.DEV) {
            console.warn('[OfflineSync] Vote failed due to network error. Enqueuing vote:', err);
          }
          await enqueueAction('vote', { ...input, userId: userId! });
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((reg) => {
              if ('sync' in reg) {
                return (reg as any).sync.register('sync-offline-actions');
              }
            }).catch((syncErr) => console.warn('[OfflineSync] Sync registration failed:', syncErr));
          }
          return; // Optimistic success
        }
        throw err;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['polls'] }),
  });
}

// ── Schedule (Timetable) ─────────────────────────────────────────────────────

export function useUpsertScheduleSlot() {
  const qc = useQueryClient();
  const { sectionId, userId, role } = useAuthContext();
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
      // 1. Enforce strict CR authorization check
      if (role !== 'cr') {
        throw new Error('Unauthorized: Only Class Representatives can manage timetable slots');
      }

      // 2. Enforce Zod schema validation
      const validated = timetableSlotSchema.parse({
        dayOfWeek: input.dayOfWeek,
        subjectId: input.subjectId,
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room ?? undefined,
        type: input.type?.toLowerCase() as 'lecture' | 'tutorial' | 'lab' | undefined,
        teacher: input.teacher ?? undefined,
      });

      const row = {
        ...(input.id ? { id: input.id } : {}),
        section_id: sectionId!,
        subject_id: validated.subjectId ?? null,
        day_of_week: validated.dayOfWeek,
        start_time: validated.startTime,
        end_time: validated.endTime,
        room: validated.room ?? null,
        type: (validated.type ?? 'lecture') as SlotType,
        teacher: validated.teacher ?? null,
        created_by: userId!,
      };
      const { error } = await supabase.from('timetable_slots').upsert(row);
      if (error) throw error;

      // Trigger push notification broadcast
      if (sectionId) {
        const action = input.id ? 'Updated' : 'Added';
        try {
          await supabase.functions.invoke('send-custom-notification', {
            body: {
              title: `📅 Timetable ${action}`,
              body: `A class slot has been ${action.toLowerCase()} in the timetable.`,
              sectionId: sectionId,
              skipDbInsert: true
            }
          });
        } catch (err) {
          console.warn('Failed to send push notification for timetable change:', err);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  });
}

export function useDeleteScheduleSlot() {
  const qc = useQueryClient();
  const { role } = useAuthContext();
  return useMutation({
    mutationFn: async (id: string) => {
      // Enforce strict CR authorization check
      if (role !== 'cr') {
        throw new Error('Unauthorized: Only Class Representatives can delete timetable slots');
      }

      const { error } = await supabase.from('timetable_slots').delete().eq('id', id);
      if (error) throw error;

      const sectionId = (await supabase.auth.getUser()).data.user?.user_metadata?.sectionId;
      if (sectionId) {
        try {
          await supabase.functions.invoke('send-custom-notification', {
            body: {
              title: `❌ Timetable Updated`,
              body: `A class slot has been removed from the timetable.`,
              sectionId: sectionId,
              skipDbInsert: true
            }
          });
        } catch (err) {
          console.warn('Failed to send push notification for timetable change:', err);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  });
}

/** Clear all slots for a specific day in the section */
export function useClearDaySlots() {
  const qc = useQueryClient();
  const { sectionId, role } = useAuthContext();
  return useMutation({
    mutationFn: async (dayOfWeek: number) => {
      // Enforce strict CR authorization check
      if (role !== 'cr') {
        throw new Error('Unauthorized: Only Class Representatives can clear timetable slots');
      }

      if (!sectionId) throw new Error('No section');
      const { error } = await supabase
        .from('timetable_slots')
        .delete()
        .eq('section_id', sectionId)
        .eq('day_of_week', dayOfWeek);
      if (error) throw error;

      try {
        await supabase.functions.invoke('send-custom-notification', {
          body: {
            title: `❌ Timetable Cleared`,
            body: `All slots for a day have been cleared.`,
            sectionId: sectionId,
            skipDbInsert: true
          }
        });
      } catch (err) {
        console.warn('Failed to send push notification for timetable change:', err);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  });
}

/** Copy all slots from one day to another (replaces target day) */
export function useCopyDaySlots() {
  const qc = useQueryClient();
  const { sectionId, userId, role } = useAuthContext();
  return useMutation({
    mutationFn: async ({ fromDay, toDay }: { fromDay: number; toDay: number }) => {
      // Enforce strict CR authorization check
      if (role !== 'cr') {
        throw new Error('Unauthorized: Only Class Representatives can copy timetable slots');
      }

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

      try {
        await supabase.functions.invoke('send-custom-notification', {
          body: {
            title: `📅 Timetable Copied`,
            body: `Slots have been copied to another day in the timetable.`,
            sectionId: sectionId,
            skipDbInsert: true
          }
        });
      } catch (err) {
        console.warn('Failed to send push notification for timetable change:', err);
      }
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

export function useUpdateGlobalResource() {
  const qc = useQueryClient();
  const { userId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
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
    }) => {
      const { error } = await supabase
        .from('global_resources' as any)
        .update({
          subject_code: input.subjectCode,
          subject_name: input.subjectName,
          semester: input.semester,
          branch: input.branch,
          accent_color: input.accentColor,
          syllabus_url: input.syllabusUrl,
          notes_url: input.notesUrl,
          pyqs_url: input.pyqsUrl,
          practice_url: input.practiceUrl,
          lab_url: input.labUrl,
          updated_by: userId!,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', input.id);
      
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global_resources'] }),
  });
}

export function useCreateGlobalResource() {
  const qc = useQueryClient();
  const { userId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
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
    }) => {
      const { error } = await supabase
        .from('global_resources' as any)
        .insert({
          subject_code: input.subjectCode,
          subject_name: input.subjectName,
          semester: input.semester,
          branch: input.branch,
          accent_color: input.accentColor,
          syllabus_url: input.syllabusUrl,
          notes_url: input.notesUrl,
          pyqs_url: input.pyqsUrl,
          practice_url: input.practiceUrl,
          lab_url: input.labUrl,
          updated_by: userId!,
          updated_at: new Date().toISOString(),
        } as any);
      
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global_resources'] }),
  });
}

export function useDeleteGlobalResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('global_resources' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global_resources'] }),
  });
}

export function useCreateGlobalPYQ() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      semester: string;
      year: string;
      url: string;
      isLatest: boolean;
    }) => {
      const { error } = await supabase
        .from('global_pyqs' as any)
        .insert({
          semester: input.semester,
          year: input.year,
          url: input.url,
          is_latest: input.isLatest,
        } as any);
      
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global_pyqs'] }),
  });
}

export function useDeleteGlobalPYQ() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('global_pyqs' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global_pyqs'] }),
  });
}

// ── CR Management (ADR-018) ──────────────────────────────────────────────────

/** Transfer primary CR role to another section member. Caller must be primary CR. */
export function useTransferPrimaryCR() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: {
      newPrimaryId: string;
      oldCrAction: 'become_student' | 'become_co_cr';
    }) => {
      const { error } = await supabase.rpc('transfer_primary_cr', {
        new_primary_id: input.newPrimaryId,
        old_cr_action: input.oldCrAction,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['section_crs', sectionId] });
      qc.invalidateQueries({ queryKey: ['members', sectionId] });
      qc.invalidateQueries({ queryKey: ['cr_transfer_log', sectionId] });
      // Refresh the auth profile since the caller's role/rank changed
      useAppStore.getState().refreshProfile();
    },
  });
}

/** Promote a student to co-CR. Caller must be primary CR. */
export function usePromoteToCoCR() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase.rpc('promote_to_co_cr', {
        target_user_id: targetUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['section_crs', sectionId] });
      qc.invalidateQueries({ queryKey: ['members', sectionId] });
      qc.invalidateQueries({ queryKey: ['cr_transfer_log', sectionId] });
    },
  });
}

/** Remove a co-CR back to student. Caller must be primary CR. */
export function useDemoteCoCR() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase.rpc('demote_co_cr', {
        target_user_id: targetUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['section_crs', sectionId] });
      qc.invalidateQueries({ queryKey: ['members', sectionId] });
      qc.invalidateQueries({ queryKey: ['cr_transfer_log', sectionId] });
    },
  });
}

/** Resign as CR (co-CR only; primary must transfer first). */
export function useResignAsCR() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('resign_as_cr');
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['section_crs', sectionId] });
      qc.invalidateQueries({ queryKey: ['members', sectionId] });
      qc.invalidateQueries({ queryKey: ['cr_transfer_log', sectionId] });
      // Refresh the auth profile since the caller's role/rank changed
      useAppStore.getState().refreshProfile();
    },
  });
}
