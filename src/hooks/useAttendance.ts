import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type { AttendanceSubject } from '../store/appStore';
import type { Database } from '../types/database.types';
import type { Json } from '../types/database.types';
import { useAuthContext } from './useAuthContext';

type AttendanceUpsertRow = Database['public']['Tables']['attendance_records']['Insert'];
type SubjectIdCode = { id: string; code: string };



type SubjectRelation = { code: string; name: string; semester?: number } | null;

import { getOverallDayOfWeekRates, type AttendanceInsights } from '../lib/utils/attendance';

type AttendanceQueryResult = {
  subjects: AttendanceSubject[];
  overall: number;
  lastUpdated: string | null;
  dayOfWeekRates?: Record<string, number>;
};

const DEMO_ATTENDANCE: AttendanceQueryResult = {
  subjects: [
    { code: '2FY2-01', name: 'Engineering Physics', type: 'Lecture', present: 22, absent: 3, total: 25, percentage: 88, canSkip: 4, needToAttend: 0 },
    { code: '2FY2-02', name: 'Engineering Mathematics II', type: 'Lecture', present: 18, absent: 6, total: 24, percentage: 75, canSkip: 0, needToAttend: 0 },
    { code: '2FY2-03', name: 'Engineering Chemistry', type: 'Lecture', present: 19, absent: 4, total: 23, percentage: 82.6, canSkip: 2, needToAttend: 0 },
    { code: '2FY3-04', name: 'Basic Electrical Engineering', type: 'Lecture', present: 14, absent: 6, total: 20, percentage: 70, canSkip: 0, needToAttend: 4 },
    { code: '2FY3-05', name: 'Basic Mechanical Engineering', type: 'Lecture', present: 20, absent: 2, total: 22, percentage: 90.9, canSkip: 4, needToAttend: 0 },
  ],
  overall: 81.3,
  lastUpdated: new Date().toISOString(),
};

export function useAttendance(opts?: { placeholder?: boolean }) {
  const { userId, sectionId, isAuthenticated } = useAuthContext();
  const isDemo = userId === 'demo-user-id' || sectionId === 'demo-section';
  return useQuery<AttendanceQueryResult>({
    queryKey: ['attendance', userId],
    enabled: !!userId && (isAuthenticated || isDemo),
    staleTime: 1000 * 60 * 5, // 5 minutes
    placeholderData: opts?.placeholder
      ? () => useAppStore.getState().offlineCache?.attendance
      : undefined,
    queryFn: async () => {
      if (isDemo) return DEMO_ATTENDANCE;
      try {
        const { data, error } = await supabase
          .from('attendance_records')
          .select(`
            present, od, makeup, absent, percentage, updated_at, insights,
            subjects:subject_id (code, name, semester)
          `)
          .eq('user_id', userId!);
        if (error) throw error;

        const insightsMap = new Map<string, AttendanceInsights>();

        const subjects: AttendanceSubject[] = (data ?? []).map(r => {
          const subj = r.subjects as SubjectRelation;
          const total = r.present + r.od + r.absent;
          const attended = r.present + r.od + r.makeup;
          const pct = r.percentage ?? (total > 0 ? (attended / total) * 100 : 0);
          // canSkip: how many more can skip while staying >= 75%
          const canSkip = total > 0 ? Math.floor((attended - 0.75 * total) / 0.75) : 0;
          // needToAttend: how many more to reach 75%
          const need = total > 0 ? Math.max(0, Math.ceil((0.75 * total - attended) / 0.25)) : 0;

          const rawInsights = r.insights as unknown as AttendanceInsights | null;
          if (rawInsights && subj?.code) {
            insightsMap.set(subj.code, rawInsights);
          }

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
            insights: rawInsights,
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

        const dayOfWeekRates = insightsMap.size > 0 ? getOverallDayOfWeekRates(insightsMap) : undefined;

        const result: AttendanceQueryResult = { subjects, overall, lastUpdated: maxUpdatedAt, dayOfWeekRates };
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

// ── Bulk Upsert Attendance Mutation ──────────────────────────────────────────

export function useBulkUpsertAttendance() {
  const qc = useQueryClient();
  const { userId, sectionId } = useAuthContext();
  return useMutation({
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: ['attendance', userId] });
      const previousAttendance = qc.getQueryData(['attendance', userId]);
      const nowIso = new Date().toISOString();

      qc.setQueryData(['attendance', userId], (old: any) => {
        const existingSubjects = old?.subjects ?? [];
        const codeMap = new Map(items.map(item => [item.code, item]));

        const updatedSubjects = existingSubjects.map((sub: any) => {
          const match = codeMap.get(sub.code);
          if (!match) return sub;
          codeMap.delete(sub.code);

          const present = (match.present ?? 0) + (match.od ?? 0) + (match.makeup ?? 0);
          const absent = match.absent ?? 0;
          const total = (match.present ?? 0) + (match.od ?? 0) + absent;
          
          const percentage = total > 0 ? (present / total) * 100 : 0;
          const canSkip = total > 0 ? Math.floor((present - 0.75 * total) / 0.75) : 0;
          const needToAttend = total > 0 ? Math.max(0, Math.ceil((0.75 * total - present) / 0.25)) : 0;

          return {
            ...sub,
            present,
            absent,
            total,
            percentage,
            canSkip: Math.max(0, canSkip),
            needToAttend
          };
        });

        codeMap.forEach((match, code) => {
          if (!code) return;
          const present = (match.present ?? 0) + (match.od ?? 0) + (match.makeup ?? 0);
          const absent = match.absent ?? 0;
          const total = (match.present ?? 0) + (match.od ?? 0) + absent;
          const percentage = total > 0 ? (present / total) * 100 : 0;
          const canSkip = total > 0 ? Math.floor((present - 0.75 * total) / 0.75) : 0;
          const needToAttend = total > 0 ? Math.max(0, Math.ceil((0.75 * total - present) / 0.25)) : 0;

          updatedSubjects.push({
            code,
            name: code,
            type: 'Lecture',
            present,
            absent,
            total,
            percentage,
            canSkip: Math.max(0, canSkip),
            needToAttend,
            semester: 1,
          });
        });

        const totalPresent = updatedSubjects.reduce((sum: number, s: any) => sum + s.present, 0);
        const totalHeld = updatedSubjects.reduce((sum: number, s: any) => sum + s.total, 0);
        const overall = totalHeld > 0 ? (totalPresent / totalHeld) * 100 : 0;

        const optimisticResult = {
          subjects: updatedSubjects,
          overall,
          lastUpdated: nowIso
        };
        useAppStore.getState().setOfflineCache('attendance', optimisticResult);
        return optimisticResult;
      });

      return { previousAttendance };
    },
    mutationFn: async (items: Array<{ code?: string; subjectId?: string; present: number; absent: number; od?: number; makeup?: number; insights?: Record<string, unknown> | null }>) => {
      const isDemo = userId === 'demo-user-id' || sectionId === 'demo-section';
      if (isDemo) return;

      if (!userId) throw new Error('Not authenticated');
      if (!sectionId) throw new Error('Missing section context');

      const nowIso = new Date().toISOString();
      const rows: AttendanceUpsertRow[] = [];
      const itemsNeedingCode = items.filter(i => !i.subjectId && i.code).map(i => i as { code: string; present: number; absent: number; od?: number; makeup?: number; insights?: Record<string, unknown> | null });

      if (itemsNeedingCode.length > 0) {
        const codes = Array.from(new Set(itemsNeedingCode.map(i => i.code)));
        const { data: subjects, error: subjErr } = await supabase.from('subjects').select('id,code').in('code', codes).eq('section_id', sectionId);
        if (subjErr) throw subjErr;
        const codeToId = new Map<string, string>();
        (subjects ?? []).forEach((s: SubjectIdCode) => codeToId.set(s.code, s.id));

        itemsNeedingCode.forEach(i => {
          const sid = codeToId.get(i.code) ?? null;
          if (sid) rows.push({
            user_id: userId,
            subject_id: sid,
            present: i.present,
            absent: i.absent,
            od: i.od ?? 0,
            makeup: i.makeup ?? 0,
            updated_at: nowIso,
            ...(i.insights != null ? { insights: i.insights as unknown as Json } : {})
          });
        });
      }

      items.forEach(i => {
        if (!i.subjectId) return;
        rows.push({
          user_id: userId,
          subject_id: i.subjectId,
          present: i.present,
          absent: i.absent,
          od: i.od ?? 0,
          makeup: i.makeup ?? 0,
          updated_at: nowIso,
          ...(i.insights != null ? { insights: i.insights as unknown as Json } : {})
        });
      });

      if (rows.length === 0) throw new Error('No matching subjects found for import');

      const { error } = await supabase.from('attendance_records').upsert(rows, { onConflict: 'user_id,subject_id' });
      if (error) throw error;
    },
    onError: (_err, _items, context) => {
      if (context?.previousAttendance) {
        qc.setQueryData(['attendance', userId], context.previousAttendance);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['attendance', userId] });
    },
  });
}

// ── Update Subject (Name) Mutation ───────────────────────────────────────────

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
