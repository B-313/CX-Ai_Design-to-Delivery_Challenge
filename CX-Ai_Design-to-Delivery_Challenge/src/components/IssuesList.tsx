import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, AlertCircle, Info } from "lucide-react";
import type { AnalysisIssue } from "@/types/analysis";

interface IssuesListProps {
  issues: AnalysisIssue[];
}

const severityConfig = {
  high: { icon: AlertTriangle, color: "text-[hsl(0,70%,55%)]", bg: "bg-[hsl(0,70%,55%)/0.1]", border: "border-[hsl(0,70%,55%)/0.2]" },
  medium: { icon: AlertCircle, color: "text-[hsl(45,100%,60%)]", bg: "bg-[hsl(45,100%,60%)/0.1]", border: "border-[hsl(45,100%,60%)/0.2]" },
  low: { icon: Info, color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border" },
};

const categoryLabels: Record<string, string> = {
  brand: "Brand",
  accessibility: "A11y",
  regulatory: "Regulatory",
  content: "Content",
  technical: "Technical",
};

const IssuesList = ({ issues }: IssuesListProps) => {
  const [expanded, setExpanded] = useState<number | null>(null);

  const sorted = [...issues].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
        Issues Found ({issues.length})
      </p>

      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
        {sorted.map((issue, i) => {
          const config = severityConfig[issue.severity];
          const Icon = config.icon;
          const isOpen = expanded === i;

          return (
            <div key={i} className={`rounded-lg border ${config.border} ${config.bg} overflow-hidden`}>
              <button
                onClick={() => setExpanded(isOpen ? null : i)}
                className="w-full flex items-center gap-3 p-3 text-left"
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${config.color}`} />
                <span className="text-sm text-foreground flex-1">{issue.title}</span>
                <span className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
                  {categoryLabels[issue.category]}
                </span>
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {isOpen && (
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-xs text-muted-foreground">{issue.description}</p>
                  <div className="rounded-md bg-background/50 p-2.5">
                    <p className="text-xs font-mono text-primary">
                      <span className="text-muted-foreground">Fix → </span>
                      {issue.fix}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IssuesList;
