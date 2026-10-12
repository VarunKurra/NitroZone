import { ViewTransition } from "react";

/**
 * Soft fade-and-rise between pages (React <ViewTransition> + the browser View Transitions API).
 * Browsers without support simply switch pages instantly. Disabled for reduced motion in CSS.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}
