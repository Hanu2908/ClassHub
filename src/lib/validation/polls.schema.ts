import { z } from 'zod';

export const pollSchema = z.object({
  question: z.string().min(3),
  type: z.enum(['actionable', 'general']),
  options: z.array(z.string()).optional(),
}).superRefine((val, ctx) => {
  if (val.type === 'actionable') {
    if (!val.options || val.options.length < 2) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'actionable polls need at least 2 options' });
  }
});

export type Poll = z.infer<typeof pollSchema>;
