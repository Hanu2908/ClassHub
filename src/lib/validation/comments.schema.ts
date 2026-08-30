import { z } from 'zod';

// Mirrors the database constraint on announcement_comments.content
// (VARCHAR(500) NOT NULL CHECK (char_length(content) >= 1)) — see
// supabase/migrations/20260528000000_announcements_reactions_and_qa.sql.
export const MAX_COMMENT_LENGTH = 500;

export const commentContentSchema = z
  .string()
  .trim()
  .min(1, 'Comment cannot be empty')
  .max(MAX_COMMENT_LENGTH, `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);

export type CommentContent = z.infer<typeof commentContentSchema>;

export const commentSchema = z.object({
  content: commentContentSchema,
});

export type CommentInput = z.infer<typeof commentSchema>;
