import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store/appStore";
import { toast } from 'sonner';
import { subscribeToAnnouncementQA } from "../lib/realtimeBroker";

// Helper to access auth context from Zustand appStore
function useAuthContext() {
  const authUser = useAppStore((s) => s.authUser);
  const session = useAppStore((s) => s.session);
  const isDemo = authUser?.sectionId === "demo-section";
  const isAuthenticated = !!session || isDemo;
  return {
    userId: authUser?.id ?? null,
    sectionId: authUser?.sectionId ?? null,
    role: authUser?.role ?? "student",
    isAuthenticated,
  };
}

export interface QAReaction {
  id: string;
  announcementId: string;
  userId: string;
  emoji: string;
  userName: string;
}

export interface QAComment {
  id: string;
  announcementId: string;
  authorId: string;
  content: string;
  isVerified: boolean;
  createdAt: string;
  editedAt: string | null;
  authorName: string;
  authorRoll: string | null;
  authorRole: "student" | "cr";
}

// ── 1. Realtime Subscriptions Hook ──────────────────────────────────────────

export function useAnnouncementQARealtime(announcementId: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!announcementId) return;

    const unsubscribe = subscribeToAnnouncementQA(announcementId, {
      onReaction: () =>
        qc.invalidateQueries({
          queryKey: ["announcement_reactions", announcementId],
        }),
      onComment: () =>
        qc.invalidateQueries({
          queryKey: ["announcement_comments", announcementId],
        }),
    });

    return unsubscribe;
  }, [announcementId, qc]);
}

// ── 2. Queries ───────────────────────────────────────────────────────────────

export function useAnnouncementReactions(announcementId: string) {
  const { isAuthenticated } = useAuthContext();
  return useQuery<QAReaction[]>({
    queryKey: ["announcement_reactions", announcementId],
    enabled: !!announcementId && isAuthenticated,
    staleTime: 1000 * 30, // 30 seconds
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcement_reactions" as any)
        .select(
          `
          id,
          announcement_id,
          user_id,
          emoji,
          users (name)
        `,
        )
        .eq("announcement_id", announcementId);

      if (error) throw error;

      return (data ?? []).map((r: any) => ({
        id: r.id,
        announcementId: r.announcement_id,
        userId: r.user_id,
        emoji: r.emoji,
        userName: r.users?.name ?? "Unknown Student",
      }));
    },
  });
}

export function useAnnouncementComments(announcementId: string) {
  const { isAuthenticated } = useAuthContext();
  return useQuery<QAComment[]>({
    queryKey: ["announcement_comments", announcementId],
    enabled: !!announcementId && isAuthenticated,
    staleTime: 1000 * 30, // 30 seconds
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcement_comments" as any)
        .select(
          `
          id,
          announcement_id,
          author_id,
          content,
          is_verified,
          created_at,
          edited_at,
          users (name, section_roll, role)
        `,
        )
        .eq("announcement_id", announcementId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((c: any) => ({
        id: c.id,
        announcementId: c.announcement_id,
        authorId: c.author_id,
        content: c.content,
        isVerified: c.is_verified,
        createdAt: c.created_at,
        editedAt: c.edited_at ?? null,
        authorName: c.users?.name ?? "Unknown Student",
        authorRoll: c.users?.section_roll ?? null,
        authorRole: (c.users?.role as "student" | "cr") ?? "student",
      }));
    },
  });
}

export function useAnnouncementMuteStatus(announcementId: string) {
  const { userId, isAuthenticated } = useAuthContext();
  return useQuery<boolean>({
    queryKey: ["announcement_mute", announcementId, userId],
    enabled: !!announcementId && !!userId && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcement_thread_mutes" as any)
        .select("id")
        .eq("announcement_id", announcementId)
        .eq("user_id", userId!)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
  });
}

// ── 3. Mutations ─────────────────────────────────────────────────────────────

// Input type for the toggle mutation — caller resolves current state before mutating
export interface ToggleReactionInput {
  emoji: string;
  existingReaction: QAReaction | null; // null = no current reaction
}

export function useToggleReaction(announcementId: string) {
  const qc = useQueryClient();
  const { userId } = useAuthContext();

  return useMutation({
    mutationFn: async ({ emoji }: ToggleReactionInput) => {
      if (!userId) throw new Error("Not authenticated");

      // Fetch the actual current reaction from database to bypass any optimistic cache pollution
      const { data: rawDbReaction, error: fetchError } = await supabase
        .from("announcement_reactions" as any)
        .select("id, emoji")
        .eq("announcement_id", announcementId)
        .eq("user_id", userId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const dbReaction = rawDbReaction as unknown as { id: string; emoji: string } | null;

      if (dbReaction) {
        if (dbReaction.emoji === emoji) {
          // Same emoji → retract
          const { error } = await supabase
            .from("announcement_reactions" as any)
            .delete()
            .eq("id", dbReaction.id);
          if (error) throw error;
          return { action: "retract" as const, emoji };
        } else {
          // Different emoji → delete old, insert new
          const { error: deleteErr } = await supabase
            .from("announcement_reactions" as any)
            .delete()
            .eq("id", dbReaction.id);
          if (deleteErr) throw deleteErr;

          const { error: insertErr } = await supabase
            .from("announcement_reactions" as any)
            .insert({
              announcement_id: announcementId,
              user_id: userId,
              emoji,
            });
          if (insertErr) throw insertErr;
          return { action: "swap" as const, emoji };
        }
      } else {
        // No existing reaction → insert
        const { error } = await supabase
          .from("announcement_reactions" as any)
          .insert({ announcement_id: announcementId, user_id: userId, emoji });
        if (error) throw error;
        return { action: "add" as const, emoji };
      }
    },
    // Optimistic UI — runs BEFORE mutationFn, but we read cache here BEFORE we change it
    onMutate: async ({ emoji, existingReaction }: ToggleReactionInput) => {
      await qc.cancelQueries({
        queryKey: ["announcement_reactions", announcementId],
      });
      const previousReactions =
        qc.getQueryData<QAReaction[]>([
          "announcement_reactions",
          announcementId,
        ]) ?? [];

      let nextReactions = [...previousReactions];

      if (existingReaction) {
        if (existingReaction.emoji === emoji) {
          nextReactions = nextReactions.filter(
            (r) => r.id !== existingReaction.id,
          );
        } else {
          nextReactions = nextReactions.map((r) =>
            r.id === existingReaction.id ? { ...r, emoji } : r,
          );
        }
      } else {
        nextReactions.push({
          id: "temp-id-" + Math.random(),
          announcementId,
          userId: userId!,
          emoji,
          userName: "You",
        });
      }

      qc.setQueryData(
        ["announcement_reactions", announcementId],
        nextReactions,
      );
      return { previousReactions };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previousReactions) {
        qc.setQueryData(
          ["announcement_reactions", announcementId],
          context.previousReactions,
        );
      }
      toast.error("Failed to save reaction");
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["announcement_reactions", announcementId],
      });
    },
  });
}

export function useAddComment(announcementId: string) {
  const qc = useQueryClient();
  const { userId } = useAuthContext();

  return useMutation({
    mutationFn: async (content: string) => {
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("announcement_comments" as any)
        .insert({
          announcement_id: announcementId,
          author_id: userId,
          content: content.trim(),
          is_verified: false,
        })
        .select("id")
        .single();

      if (error) throw error;
      return (data as any).id;
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["announcement_comments", announcementId],
      });
    },
    onError: () => {
      toast.error("Failed to post question");
    },
  });
}

export function useDeleteComment(announcementId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("announcement_comments" as any)
        .delete()
        .eq("id", commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["announcement_comments", announcementId],
      });
      toast.success("Comment deleted successfully");
    },
    onError: (err: any) => {
      const isLockout =
        err.message?.includes("Verified Lockout") ||
        err.code === "42501" ||
        err.status === 401;
      if (isLockout) {
        toast.error("Cannot delete verified comments");
      } else {
        toast.error("Failed to delete comment");
      }
    },
  });
}

export function useEditComment(announcementId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commentId,
      content,
    }: {
      commentId: string;
      content: string;
    }) => {
      const { error } = await supabase
        .from("announcement_comments" as any)
        .update({ content: content.trim() })
        .eq("id", commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["announcement_comments", announcementId],
      });
      toast.success("Comment updated successfully");
    },
    onError: (err: any) => {
      const isLockout =
        err.message?.includes("Verified Lockout") ||
        err.code === "42501" ||
        err.status === 401;
      if (isLockout) {
        toast.error("Cannot edit verified or expired comments");
      } else {
        toast.error("Failed to update comment");
      }
    },
  });
}

export function useToggleVerifyComment(announcementId: string) {
  const qc = useQueryClient();
  const { role } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      commentId,
      isVerified,
    }: {
      commentId: string;
      isVerified: boolean;
    }) => {
      if (role !== "cr")
        throw new Error("Unauthorized: Only CRs can verify answers");

      const { error } = await supabase
        .from("announcement_comments" as any)
        .update({ is_verified: isVerified })
        .eq("id", commentId);

      if (error) throw error;
    },
    // Optimistic UI update
    onMutate: async ({ commentId, isVerified }) => {
      await qc.cancelQueries({
        queryKey: ["announcement_comments", announcementId],
      });
      const previousComments =
        qc.getQueryData<QAComment[]>([
          "announcement_comments",
          announcementId,
        ]) ?? [];

      const nextComments = previousComments.map((c) =>
        c.id === commentId ? { ...c, isVerified } : c,
      );

      qc.setQueryData(["announcement_comments", announcementId], nextComments);
      return { previousComments };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previousComments) {
        qc.setQueryData(
          ["announcement_comments", announcementId],
          context.previousComments,
        );
      }
      toast.error("Failed to update verification status");
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["announcement_comments", announcementId],
      });
      toast.success(
        vars.isVerified ? "Answer marked as verified!" : "Answer unverified",
      );
    },
  });
}

export function useToggleThreadMute(announcementId: string) {
  const qc = useQueryClient();
  const { userId } = useAuthContext();

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not authenticated");

      const isMuted =
        qc.getQueryData<boolean>([
          "announcement_mute",
          announcementId,
          userId,
        ]) ?? false;

      if (isMuted) {
        const { error } = await supabase
          .from("announcement_thread_mutes" as any)
          .delete()
          .eq("announcement_id", announcementId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("announcement_thread_mutes" as any)
          .insert({
            announcement_id: announcementId,
            user_id: userId,
          });
        if (error) throw error;
      }
    },
    // Optimistic UI updates
    onMutate: async () => {
      await qc.cancelQueries({
        queryKey: ["announcement_mute", announcementId, userId],
      });
      const previousStatus =
        qc.getQueryData<boolean>([
          "announcement_mute",
          announcementId,
          userId,
        ]) ?? false;

      qc.setQueryData(
        ["announcement_mute", announcementId, userId],
        !previousStatus,
      );
      return { previousStatus };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.previousStatus !== undefined) {
        qc.setQueryData(
          ["announcement_mute", announcementId, userId],
          context.previousStatus,
        );
      }
      toast.error("Failed to toggle mute state");
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["announcement_mute", announcementId, userId],
      });
    },
  });
}
