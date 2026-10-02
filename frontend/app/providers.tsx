"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="prs-theme"
    >
      {children}
    </ThemeProvider>
  );
}
