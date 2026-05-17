import { z } from 'zod';

export const joinHubSchema = z.object({
  hubCode: z.string().regex(/^P\d[A-Z0-9]{4,}$/i),
  classRoll: z.string().regex(/^\d{2}$/),
  universityRoll: z.string().min(5),
});

export type JoinHub = z.infer<typeof joinHubSchema>;
