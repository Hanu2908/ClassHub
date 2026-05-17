import { z } from 'zod';

export const timetableSlotSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  subjectId: z.string().uuid(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string(),
  type: z.enum(['lecture', 'tutorial', 'lab']),
});

export type TimetableSlot = z.infer<typeof timetableSlotSchema>;
