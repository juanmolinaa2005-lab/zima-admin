"use client";

import { useEffect } from "react";
import { applyTheme } from "@/lib/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyTheme();
  }, []);

  return <>{children}</>;
}
