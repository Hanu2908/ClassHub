import { z } from 'zod';

export const timetableSlotSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  subjectId: z.string().uuid().nullable().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid start time format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid end time format'),
  room: z.string().nullable().optional(),
  type: z.enum(['lecture', 'tutorial', 'lab']).nullable().optional(),
  teacher: z.string().nullable().optional(),
});

export type TimetableSlot = z.infer<typeof timetableSlotSchema>;
