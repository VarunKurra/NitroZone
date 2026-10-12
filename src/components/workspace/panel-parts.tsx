import { cn } from "@/lib/utils";

export function StepHeader({ index, title, description }: { index: number; title: string; description: string }) {
  return (
    <div>
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary">Step {index} of 4</p>
      <h2 className="mt-1.5 font-display text-[1.6rem] font-bold leading-tight tracking-[-0.02em]">{title}</h2>
      <p className="mt-1.5 text-[0.92rem] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

export function PanelSection({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-2.5", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
