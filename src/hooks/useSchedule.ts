import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type { ScheduleSlot, ScheduleMap } from '../store/appStore';
import type { Database } from '../types/database.types';
import { timetableSlotSchema } from '../lib/validation/timetable.schema';
import { useAuthContext } from './useAuthContext';

type SlotType = Database['public']['Enums']['slot_type'];

// ── Helper: current user context ─────────────────────────────────────────────



type SubjectRelation = { code: string; name: string; semester?: number } | null;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Schedule Query ───────────────────────────────────────────────────────────

export function useSchedule(opts?: { sectionId?: string }) {
  const auth = useAuthContext();
  const sectionId = opts?.sectionId ?? auth.sectionId;
  const isDemo = sectionId === 'demo-section';
  const isAuthenticated = auth.isAuthenticated || isDemo;

  return useQuery<ScheduleMap>({
    queryKey: ['schedule', sectionId],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 3, // 3 minutes
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('timetable_slots')
          .select(`
            id, day_of_week, start_time, end_time, room, type, teacher, created_by, subject_id, target_batch,
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
            subjectId: slot.subject_id ?? undefined,
            targetBatch: slot.target_batch ?? null,
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

// ── Upsert Timetable Slot Mutation ───────────────────────────────────────────

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
      targetBatch?: string | null;
      sectionId?: string;
      publishNotice?: boolean;
      noticeTitle?: string;
      noticeBody?: string;
      priority?: 'general' | 'critical';
    }) => {
      // 1. Enforce strict CR/Teacher authorization check
      if (role !== 'cr' && role !== 'teacher') {
        throw new Error('Unauthorized: Only Class Representatives and Teachers can manage timetable slots');
      }

      const targetSectionId = input.sectionId ?? sectionId;

      // 2. Enforce Zod schema validation
      const validated = timetableSlotSchema.parse({
        dayOfWeek: input.dayOfWeek,
        subjectId: input.subjectId,
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room ?? undefined,
        type: input.type?.toLowerCase() as 'lecture' | 'tutorial' | 'lab' | undefined,
        teacher: input.teacher ?? undefined,
        targetBatch: input.targetBatch ?? undefined,
      });

      const row = {
        ...(input.id ? { id: input.id } : {}),
        section_id: targetSectionId!,
        subject_id: validated.subjectId ?? null,
        day_of_week: validated.dayOfWeek,
        start_time: validated.startTime,
        end_time: validated.endTime,
        room: validated.room ?? null,
        type: (validated.type ?? 'lecture') as SlotType,
        teacher: validated.teacher ?? null,
        target_batch: validated.targetBatch ?? null,
        created_by: userId!,
      };
      const { error } = await supabase.from('timetable_slots').upsert(row);
      if (error) throw error;

      // Publish Announcement Notice if selected
      if (input.publishNotice && input.noticeTitle && input.noticeBody) {
        try {
          const { data: annData, error: annErr } = await supabase
            .from('announcements')
            .insert({
              section_id: targetSectionId!,
              author_id: userId!,
              title: input.noticeTitle,
              message_content: input.noticeBody,
              priority: input.priority ?? 'general',
              target_batch: input.targetBatch ?? null,
            })
            .select('id')
            .single();

          if (annErr) throw annErr;

          // If critical notice, trigger push broadcast
          if (input.priority === 'critical' && annData?.id) {
            await supabase.functions.invoke('send-critical-announcement', {
              body: { announcementId: annData.id },
            });
          }
        } catch (err) {
          console.warn('Failed to publish announcement for timetable change:', err);
        }
      } else if (targetSectionId) {
        // Fallback to standard push notification broadcast
        const action = input.id ? 'Updated' : 'Added';
        try {
          await supabase.functions.invoke('send-custom-notification', {
            body: {
              title: `📅 Timetable ${action}`,
              body: `A class slot has been ${action.toLowerCase()} in the timetable.`,
              sectionId: targetSectionId,
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

// ── Delete Timetable Slot Mutation ───────────────────────────────────────────

export function useDeleteScheduleSlot() {
  const qc = useQueryClient();
  const { role, userId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: string | {
      id: string;
      publishNotice?: boolean;
      noticeTitle?: string;
      noticeBody?: string;
      sectionId?: string;
      priority?: 'general' | 'critical';
    }) => {
      // Enforce strict CR/Teacher authorization check
      if (role !== 'cr' && role !== 'teacher') {
        throw new Error('Unauthorized: Only Class Representatives and Teachers can delete timetable slots');
      }

      const id = typeof input === 'string' ? input : input.id;
      const publishNotice = typeof input === 'string' ? false : !!input.publishNotice;
      const noticeTitle = typeof input === 'string' ? undefined : input.noticeTitle;
      const noticeBody = typeof input === 'string' ? undefined : input.noticeBody;
      const inputSectionId = typeof input === 'string' ? undefined : input.sectionId;
      const priority = typeof input === 'string' ? 'general' : (input.priority ?? 'general');

      const { error } = await supabase.from('timetable_slots').delete().eq('id', id);
      if (error) throw error;

      // Get sectionId
      let targetSectionId = inputSectionId;
      if (!targetSectionId) {
        const userRes = await supabase.auth.getUser();
        targetSectionId = userRes.data.user?.user_metadata?.sectionId;
      }

      if (targetSectionId) {
        if (publishNotice && noticeTitle && noticeBody) {
          try {
            const { data: annData, error: annErr } = await supabase
              .from('announcements')
              .insert({
                section_id: targetSectionId,
                author_id: userId!,
                title: noticeTitle,
                message_content: noticeBody,
                priority: priority,
              })
              .select('id')
              .single();

            if (annErr) throw annErr;

            if (priority === 'critical' && annData?.id) {
              await supabase.functions.invoke('send-critical-announcement', {
                body: { announcementId: annData.id },
              });
            }
          } catch (err) {
            console.warn('Failed to publish cancellation announcement:', err);
          }
        } else {
          try {
            await supabase.functions.invoke('send-custom-notification', {
              body: {
                title: `❌ Timetable Updated`,
                body: `A class slot has been removed from the timetable.`,
                sectionId: targetSectionId,
                skipDbInsert: true
              }
            });
          } catch (err) {
            console.warn('Failed to send push notification for timetable change:', err);
          }
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  });
}

// ── Clear Timetable Day Slots Mutation ───────────────────────────────────────

export function useClearDaySlots(opts?: { sectionId?: string }) {
  const qc = useQueryClient();
  const auth = useAuthContext();
  const sectionId = opts?.sectionId ?? auth.sectionId;
  const role = auth.role;

  return useMutation({
    mutationFn: async (dayOfWeek: number) => {
      // Enforce strict CR/Teacher authorization check
      if (role !== 'cr' && role !== 'teacher') {
        throw new Error('Unauthorized: Only Class Representatives and Teachers can clear timetable slots');
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

// ── Copy Timetable Day Slots Mutation ───────────────────────────────────────

export function useCopyDaySlots(opts?: { sectionId?: string }) {
  const qc = useQueryClient();
  const auth = useAuthContext();
  const sectionId = opts?.sectionId ?? auth.sectionId;
  const userId = auth.userId;
  const role = auth.role;

  return useMutation({
    mutationFn: async ({ fromDay, toDay }: { fromDay: number; toDay: number }) => {
      // Enforce strict CR/Teacher authorization check
      if (role !== 'cr' && role !== 'teacher') {
        throw new Error('Unauthorized: Only Class Representatives and Teachers can copy timetable slots');
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
