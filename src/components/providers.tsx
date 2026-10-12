"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      {/* "user" = respect the OS reduced-motion setting everywhere */}
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={150}>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
