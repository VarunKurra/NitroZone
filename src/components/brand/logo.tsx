import { cn } from "@/lib/utils";

/**
 * NitroZone mark: an "N" drawn as three crop rows over a prescription-grid tile,
 * with an amber nitrogen dot.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect width="32" height="32" rx="8" fill="#15653d" />
      <path d="M0 16h32M16 0v32" stroke="#ffffff" strokeOpacity="0.09" />
      <path d="M9.5 23V9.5L22.5 22.5V9" fill="none" stroke="#ffffff" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24.4" cy="7.6" r="2.6" fill="#f2b14a" />
    </svg>
  );
}

export function Logo({ className, wordmarkClassName }: { className?: string; wordmarkClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-7" />
      <span className={cn("font-display text-[1.15rem] font-bold tracking-[-0.02em] text-foreground", wordmarkClassName)}>
        Nitro<span className="text-primary">Zone</span>
      </span>
    </span>
  );
}
