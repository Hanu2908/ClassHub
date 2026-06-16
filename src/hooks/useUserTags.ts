import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthContext } from './useAuthContext';



// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserTag {
  id: string;
  userId: string;
  tagText: string;
  expiresAt: string | null;
  createdAt: string;
}

/** Preset duration options for tag expiry */
export const TAG_DURATION_OPTIONS = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '∞ Permanent', days: null },
] as const;

export const MAX_TAG_LENGTH = 24;
export const MAX_ACTIVE_TAGS = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Client-side filter: keep only non-expired tags */
function filterActive(tags: UserTag[]): UserTag[] {
  const now = Date.now();
  return tags.filter(t => !t.expiresAt || new Date(t.expiresAt).getTime() > now);
}

/** Compute expires_at timestamp from a duration in days (null = permanent) */
export function computeExpiresAt(days: number | null): string | null {
  if (days === null) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** Human-readable remaining time for a tag with expiry */
export function tagTimeRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return 'expiring soon';
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Fetch active tags for a specific user (defaults to current user).
 * Client-side filters expired tags.
 */
export function useUserTags(userId?: string) {
  const { userId: currentUserId, sectionId, isAuthenticated } = useAuthContext();
  const targetUserId = userId ?? currentUserId;

  return useQuery<UserTag[]>({
    queryKey: ['user_tags', targetUserId],
    enabled: !!targetUserId && !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 2, // 2 minutes
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('user_tags')
        .select('id, user_id, tag_text, expires_at, created_at')
        .eq('user_id', targetUserId!)
        .eq('section_id', sectionId!)
        .order('created_at');

      if (error) throw error;
      const mapped: UserTag[] = (data as any[] ?? []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        tagText: row.tag_text,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      }));
      return filterActive(mapped);
    },
  });
}

/**
 * Fetch all distinct active tag texts in the section for autocomplete.
 * Returns deduplicated tag strings (preserving original casing of the first occurrence).
 */
export function useSectionTagPool() {
  const { sectionId, isAuthenticated } = useAuthContext();

  return useQuery<string[]>({
    queryKey: ['section_tag_pool', sectionId],
    enabled: !!sectionId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('user_tags')
        .select('tag_text, expires_at')
        .eq('section_id', sectionId!);

      if (error) throw error;

      // Client-side: filter expired + deduplicate case-insensitively
      const now = Date.now();
      const seen = new Map<string, string>(); // lower -> original
      for (const row of (data as any[]) ?? []) {
        if (row.expires_at && new Date(row.expires_at).getTime() <= now) continue;
        const lower = row.tag_text.toLowerCase();
        if (!seen.has(lower)) seen.set(lower, row.tag_text);
      }
      return Array.from(seen.values()).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      );
    },
  });
}

/**
 * Batch-fetch active tags for multiple users (member list, comments).
 * Returns a Record keyed by user_id.
 */
export function useUserTagsBatch(userIds: string[]) {
  const { sectionId, isAuthenticated } = useAuthContext();
  // Stable key: sort + join IDs
  const idsKey = [...userIds].sort().join(',');

  return useQuery<Record<string, UserTag[]>>({
    queryKey: ['user_tags_batch', sectionId, idsKey],
    enabled: !!sectionId && isAuthenticated && userIds.length > 0,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('user_tags')
        .select('id, user_id, tag_text, expires_at, created_at')
        .eq('section_id', sectionId!)
        .in('user_id', userIds);

      if (error) throw error;

      const result: Record<string, UserTag[]> = {};
      const now = Date.now();
      for (const row of (data as any[]) ?? []) {
        // Client-side expiry filter
        if (row.expires_at && new Date(row.expires_at).getTime() <= now) continue;
        const tag: UserTag = {
          id: row.id,
          userId: row.user_id,
          tagText: row.tag_text,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
        };
        if (!result[tag.userId]) result[tag.userId] = [];
        result[tag.userId].push(tag);
      }
      return result;
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Add a new tag for the current user */
export function useAddTag() {
  const qc = useQueryClient();
  const { userId, sectionId } = useAuthContext();

  return useMutation({
    mutationFn: async (input: { tagText: string; expiresAt: string | null }) => {
      if (!userId || !sectionId) throw new Error('Not authenticated');
      const trimmed = input.tagText.trim();
      if (!trimmed || trimmed.length > MAX_TAG_LENGTH) {
        throw new Error(`Tag must be 1–${MAX_TAG_LENGTH} characters`);
      }
      const { error } = await (supabase as any)
        .from('user_tags')
        .insert({
          user_id: userId,
          section_id: sectionId,
          tag_text: trimmed,
          expires_at: input.expiresAt,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user_tags', userId] });
      qc.invalidateQueries({ queryKey: ['section_tag_pool', sectionId] });
      qc.invalidateQueries({ queryKey: ['user_tags_batch'] });
    },
  });
}

/** Delete a tag by ID (self-delete or CR moderation) */
export function useDeleteTag() {
  const qc = useQueryClient();
  const { sectionId } = useAuthContext();

  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await (supabase as any)
        .from('user_tags')
        .delete()
        .eq('id', tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      // Broad invalidation since we may not know the tag owner
      qc.invalidateQueries({ queryKey: ['user_tags'] });
      qc.invalidateQueries({ queryKey: ['section_tag_pool', sectionId] });
      qc.invalidateQueries({ queryKey: ['user_tags_batch'] });
    },
  });
}
