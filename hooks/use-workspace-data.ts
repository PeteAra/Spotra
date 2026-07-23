"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSlotsForMonth } from "@/features/slots/actions";
import { getWorkspaceBySlug } from "@/features/workspace/actions";
import { listMembers, getMemberHistory } from "@/features/members/actions";
import { monthKey } from "@/lib/utils/dates";

export function useWorkspace(slug: string, enabled = true) {
  return useQuery({
    queryKey: ["workspace", slug],
    enabled,
    queryFn: async () => {
      const result = await getWorkspaceBySlug(slug);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useSlots(workspaceId: string | undefined, month: Date) {
  const key = monthKey(month);
  return useQuery({
    queryKey: ["slots", workspaceId, key],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const result = await getSlotsForMonth({
        workspaceId: workspaceId!,
        monthKey: key,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useInvalidateSlots(workspaceId: string | undefined, month: Date) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: ["slots", workspaceId, monthKey(month)],
    });
}

export function useMembers(workspaceId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["members", workspaceId],
    enabled: Boolean(workspaceId) && enabled,
    queryFn: async () => {
      const result = await listMembers(workspaceId!);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useMemberHistory(
  workspaceId: string | undefined,
  accountId: string | undefined,
) {
  return useQuery({
    queryKey: ["member-history", workspaceId, accountId],
    enabled: Boolean(workspaceId && accountId),
    queryFn: async () => {
      const result = await getMemberHistory({
        workspaceId: workspaceId!,
        accountId: accountId!,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useActionMutation<TArgs, TData>(
  action: (args: TArgs) => Promise<{ ok: true; data: TData } | { ok: false; error: string }>,
  onSuccess?: (data: TData) => void,
) {
  return useMutation({
    mutationFn: async (args: TArgs) => {
      const result = await action(args);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess,
  });
}
