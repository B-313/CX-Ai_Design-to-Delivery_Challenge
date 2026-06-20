import { useState } from "react";
import { Info, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  description: string;
}

interface StepGuideProps {
  step: number;          // 1-indexed current step
  role: string;          // "Your role: ..."
  instruction: string;   // Main instruction sentence
  actions: string[];     // Bullet points of specific actions
  nextStep?: string;     // What happens after this step
  steps?: Step[];        // Optional progress breadcrumb
  variant?: "info" | "checkpoint" | "warning";
}

const VARIANT_STYLES = {
  info:       { bg: "bg-pf-mist border-pf-sky",     icon: "text-primary",     badge: "bg-primary/10 text-primary" },
  checkpoint: { bg: "bg-success/5 border-success/25", icon: "text-success",   badge: "bg-success/10 text-success" },
  warning:    { bg: "bg-warning-light border-warning/25", icon: "text-warning", badge: "bg-warning/10 text-warning" },
};

export function StepGuide({
  role,
  instruction,
  actions,
  nextStep,
  variant = "info",
}: StepGuideProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const s = VARIANT_STYLES[variant];

  return (
    <div className={cn("border rounded-lg p-4 mb-4 relative animate-fade-up", s.bg)}>
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-muted-foreground/40 hover:text-muted-foreground"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <Info className={cn("w-4 h-4 flex-shrink-0 mt-0.5", s.icon)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full", s.badge)}>
              Your role
            </span>
            <span className="text-[12px] font-semibold text-foreground">{role}</span>
          </div>

          <p className="text-[13px] text-foreground font-medium mb-2">{instruction}</p>

          <ul className="space-y-1 mb-2">
            {actions.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                <ChevronRight className="w-3 h-3 flex-shrink-0 mt-0.5 text-primary/60" />
                {a}
              </li>
            ))}
          </ul>

          {nextStep && (
            <p className="text-[11px] text-muted-foreground/70 italic border-t border-border/50 pt-2 mt-2">
              ↳ Next: {nextStep}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
