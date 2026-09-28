"use client";

import { useCallback, useEffect, useState } from "react";
import {
  emptyWorkspace,
  loadWorkspace,
  saveWorkspace,
  type BusinessWorkspace,
} from "@/lib/business/workspace-store";

export function useBusinessWorkspace(userKey: string) {
  const [workspace, setWorkspace] = useState<BusinessWorkspace>(emptyWorkspace);

  useEffect(() => {
    setWorkspace(loadWorkspace(userKey));
  }, [userKey]);

  const update = useCallback(
    (next: BusinessWorkspace | ((prev: BusinessWorkspace) => BusinessWorkspace)) => {
      setWorkspace((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        saveWorkspace(userKey, value);
        return value;
      });
    },
    [userKey]
  );

  return [workspace, update] as const;
}
