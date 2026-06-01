import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import type { Assignment, AssignmentSet } from '../store/appStore';
import { assignmentSchema } from '../lib/validation/assignments.schema';

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
type AssignmentSetRelation = {
  id: string;
  set_label: string;
  description: string;
  pdf_url: string | null;
  roll_start: number;
  roll_end: number;
  page_numbers: string | null;
};

interface AttachmentRow {
  id: string;
  filename: string;
  file_size: number;
  file_type: string;
  storage_path: string;
}

// ── Assignments Query ────────────────────────────────────────────────────────

export function useAssignments(opts?: { page?: number; limit?: number }) {
  const { sectionId, userId, isAuthenticated } = useAuthContext();
  const page = opts?.page ?? 0;
  const limit = opts?.limit ?? 100;
  return useQuery<Assignment[]>({
    queryKey: ['assignments', sectionId, userId, page, limit],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      try {
        const from = page * limit;
        const to = (page + 1) * limit - 1;
        const assignmentsQuery = supabase
          .from('assignments')
          .select(`
            id, title, subject_id, due_date, description, created_at,
            subjects:subject_id (code, name),
            assignment_sets (id, set_label, description, pdf_url, roll_start, roll_end, page_numbers),
            attachments (id, filename, file_size, file_type, storage_path)
          `)
          .eq('section_id', sectionId!)
          .order('created_at', { ascending: false })
          .range(from, to);

        const submissionQuery = userId
          ? supabase
              .from('submissions')
              .select('assignment_id, submission_link, status, cr_verified')
              .eq('student_id', userId)
          : Promise.resolve({ data: [], error: null });

        const [{ data: assigns, error }, { data: subs, error: subErr }] = await Promise.all([
          assignmentsQuery,
          submissionQuery,
        ] as const);

        if (error) throw error;
        if (subErr) throw subErr;

        const userSubs: Record<string, { link: string | null; status: string; crVerified: boolean }> = {};
        for (const s of subs ?? []) {
          userSubs[s.assignment_id] = { link: s.submission_link, status: s.status, crVerified: s.cr_verified ?? false };
        }

        const result = (assigns ?? []).map(a => {
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
            subjectId: a.subject_id,
            dueDate: a.due_date,
            description: a.description ?? '',
            status: (sub?.status ?? 'pending') as 'pending' | 'submitted',
            pdfUrl: null,
            hasSets: sets.length > 0,
            sets,
            submittedLink: sub?.link ?? null,
            crVerified: sub?.crVerified ?? false,
            createdAt: a.created_at,
            attachments: ((a.attachments as unknown as AttachmentRow[]) ?? []).map((att) => ({
              id: att.id,
              filename: att.filename,
              fileSize: att.file_size,
              fileType: att.file_type,
              storagePath: att.storage_path,
            })),
          };
        });

        useAppStore.getState().setOfflineCache('assignments', result);
        return result;
      } catch (err) {
        console.error('[useAssignments] Query failed, returning offline cache:', err);
        const cached = useAppStore.getState().offlineCache?.assignments;
        if (cached) return cached;
        throw err;
      }
    },
  });
}

// ── Assignment Submissions Query (CR-only) ───────────────────────────────────

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  submissionLink: string | null;
  status: 'pending' | 'submitted';
  submittedAt: string | null;
  nudgeSent: boolean;
  crVerified: boolean;
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
        .select('id, assignment_id, student_id, submission_link, status, submitted_at, nudge_sent, cr_verified')
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
        crVerified: s.cr_verified ?? false,
      }));
    },
  });
}

// ── Create Assignment Mutation ───────────────────────────────────────────────

let isCreatingAssignment = false;

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
      if (isCreatingAssignment) {
        console.warn('Assignment creation already in flight. Ignoring duplicate request.');
        return;
      }
      isCreatingAssignment = true;
      try {
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
      } finally {
        isCreatingAssignment = false;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });
}

// ── Update Assignment Mutation ───────────────────────────────────────────────

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

// ── Delete Assignment Mutation ───────────────────────────────────────────────

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

// ── Submit Assignment Mutation ───────────────────────────────────────────────

const inFlightSubmissions = new Set<string>();

export function useSubmitAssignment() {
  const qc = useQueryClient();
  const { userId } = useAuthContext();
  return useMutation({
    mutationFn: async (input: { assignmentId: string; link: string }) => {
      const key = `${input.assignmentId}-${userId}`;
      if (inFlightSubmissions.has(key)) {
        console.warn('Submission already in flight. Ignoring duplicate request.');
        return;
      }
      inFlightSubmissions.add(key);
      try {
        const { error } = await supabase.from('submissions').upsert({
          assignment_id: input.assignmentId,
          student_id: userId!,
          submission_link: input.link,
          status: 'submitted' as const,
          submitted_at: new Date().toISOString(),
        }, { onConflict: 'assignment_id,student_id' });
        if (error) throw error;
      } finally {
        inFlightSubmissions.delete(key);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });
}

// ── CR Toggle Submission Verification ────────────────────────────────────────

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
