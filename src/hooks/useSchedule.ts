import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type { ScheduleSlot, ScheduleMap } from '../store/appStore';
import type { Database } from '../types/database.types';
import { timetableSlotSchema } from '../lib/validation/timetable.schema';

type SlotType = Database['public']['Enums']['slot_type'];

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

type SubjectRelation = { code: string; name: string; semester?: number } | null;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Schedule Query ───────────────────────────────────────────────────────────

export function useSchedule() {
  const { sectionId, isAuthenticated } = useAuthContext();

  return useQuery<ScheduleMap>({
    queryKey: ['schedule', sectionId],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 3, // 3 minutes
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

// ── Delete Timetable Slot Mutation ───────────────────────────────────────────

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

// ── Clear Timetable Day Slots Mutation ───────────────────────────────────────

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

// ── Copy Timetable Day Slots Mutation ───────────────────────────────────────

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
