"use client";

import { useQuery } from "@tanstack/react-query";
import { getWorkspace } from "@/lib/api/workspace";

export function useWorkspace() {
  return useQuery({
    queryKey: ["workspace"],
    queryFn: getWorkspace,
    staleTime: 5 * 60_000,
  });
}