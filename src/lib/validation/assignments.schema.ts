import { z } from 'zod';
import { hasOverlappingRanges } from '../utils/rolls';

const SetSchema = z.object({
  label: z.string(),
  rollStart: z.number(),
  rollEnd: z.number(),
  description: z.string().optional(),
  pdfUrl: z.string().optional(),
});

export const assignmentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  subjectId: z.string().uuid(),
  dueDate: z.string(),
  sets: z.array(SetSchema).optional(),
}).refine(data => !data.sets || data.sets.length === 0 || !hasOverlappingRanges(data.sets.map(s => ({ rollStart: s.rollStart, rollEnd: s.rollEnd }))), {
  message: 'Assignment sets must not overlap',
  path: ['sets'],
});

export type Assignment = z.infer<typeof assignmentSchema>;
