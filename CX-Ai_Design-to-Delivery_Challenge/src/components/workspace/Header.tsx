import { useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import { X, Save } from "lucide-react";
import { toast } from "sonner";

const PCTS = [0, 18, 36, 58, 82, 100];
const STEPS = ["Register", "Ideation", "Brief", "Enriched Content", "Review", "Submit"];

const Header = () => {
  const {
    step,
    user,
    submitted,
    goToStep,
    reviewData,
    reviewDecisions,
    pieApproved,
    currentBrief,
    layout,
    materials,
    removeMaterial,
  } = useWorkspace();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!user) return;
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, [user]);

  const dateText = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(now);

  const timeText = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);

  const allReviewIssues = reviewData ? [...reviewData.complianceIssues, ...reviewData.grammarIssues] : [];
  const allDecided = allReviewIssues.length > 0 && allReviewIssues.every(i => Boolean(reviewDecisions[i.id]));
  const reviewPassed = (reviewData?.overallScore || 0) >= 70 && allDecided;

  const completion = [
    Boolean(user),
    Boolean(currentBrief),
    Boolean(pieApproved && currentBrief),
    Boolean(layout && currentBrief),
    Boolean(reviewPassed),
    Boolean(submitted),
  ];

  const canEnter = (idx: number) => {
    if (submitted) return false;
    if (idx === 0) return !user;
    if (idx === 4) return completion[3]; // always allow Review if Builder is available
    return completion[idx - 1];
  };

  const handleNav = (idx: number) => {
    if (submitted) return;
    if (!canEnter(idx) && idx !== step) return;
    goToStep(idx);
  };

  const showWorkspaceChrome = step > 0 && Boolean(user);

  const saveProject = () => {
    const data = {
      savedAt: new Date().toISOString(),
      projectTitle: currentBrief?.projectTitle || "Untitled Project",
      user: user ? { firstName: user.firstName, lastName: user.lastName, email: user.email, country: user.country } : null,
      currentBrief,
      materials,
      step,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-${(currentBrief?.projectTitle || "draft").replace(/[^a-z0-9]/gi, "-").slice(0, 40)}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Project saved");
  };

  return (
    <>
      <header className="min-h-[44px] flex-shrink-0 bg-card border-b border-border flex items-center px-3 py-1 gap-2.5 z-50">
        <span className="font-serif text-[16px] text-pf-dark tracking-wide leading-none">Company Name</span>
        <div className="w-px h-[14px] bg-border" />
        <span className="text-[11px] font-medium text-muted-foreground tracking-wide whitespace-nowrap max-md:hidden">
          CXI+AI Project <span className="text-pf-dark font-semibold">· Prompt Intelligence Engine</span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="bg-pf-mist border border-pf-sky rounded-full px-2 py-0.5 text-[10px] font-semibold text-pf-dark whitespace-nowrap">
            Unpublished Work For Hackathon
          </span>
          {user && (
            <>
              {currentBrief && (
                <button
                  onClick={saveProject}
                  className="flex items-center gap-1 bg-secondary border border-border rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-pf-dark hover:border-primary hover:text-primary transition-colors"
                  title="Save project snapshot as JSON"
                >
                  <Save className="w-3 h-3" /> Save
                </button>
              )}
              <div className="flex items-center gap-1.5 bg-secondary border border-border rounded-full py-0.5 px-2">
              <div className="w-[24px] h-[24px] rounded-full bg-pf-dark text-white text-[10px] font-bold flex items-center justify-center">
                {(user.firstName[0] + user.lastName[0]).toUpperCase()}
              </div>
              <div className="leading-tight">
                <div className="text-[11px] font-semibold text-pf-dark">
                  Welcome to your workspace {user.firstName}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {dateText} · {timeText}
                </div>
              </div>
              </div>
            </>
          )}
        </div>
      </header>

      {showWorkspaceChrome && (
        <div className="flex-shrink-0 bg-card border-b border-border/80 px-3 py-0.5 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <div className="flex items-center gap-1.5 pr-1.5">
            <div className="w-[74px] h-[4px] bg-muted rounded-full overflow-hidden border border-border">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${PCTS[step]}%`,
                  background: "linear-gradient(90deg, #DC2626 0%, #F59E0B 33%, #84CC16 66%, #059669 100%)",
                }}
              />
            </div>
            <span className="text-[10px] font-bold text-pf-dark whitespace-nowrap">{PCTS[step]}%</span>
          </div>

          <div className="flex items-center gap-1 bg-secondary/60 border border-border rounded-full px-1 py-0.5">
            {STEPS.map((label, idx) => {
              const isActive = idx === step;
              const isLocked = !canEnter(idx) && !isActive;

              return (
                <button
                  key={label}
                  onClick={() => handleNav(idx)}
                  disabled={isLocked || submitted}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors justify-center whitespace-nowrap",
                    isActive && "border-primary bg-primary/10 text-pf-dark",
                    !isActive && !isLocked && "border-transparent bg-card text-muted-foreground hover:border-primary/40 hover:text-primary",
                    isLocked && "opacity-40 cursor-not-allowed border-transparent text-muted-foreground/70"
                  )}
                >
                  <span className="text-[10px] font-extrabold leading-none">{idx + 1}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="w-px h-4 bg-border mx-0.5" />
          <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground/70">Materials</span>
          <div className="flex items-center gap-1 overflow-x-auto max-w-[calc(100vw-620px)]">
            {materials.length === 0 ? (
              <span className="text-[10px] text-muted-foreground/60">No uploaded materials</span>
            ) : materials.map((m) => (
              <div key={m.id} className="flex items-center gap-1 bg-secondary border border-border rounded-full pl-1.5 pr-1 py-0.5">
                <span className="text-[9px] font-semibold text-foreground truncate max-w-[160px]" title={m.source}>{m.name}</span>
                <button
                  onClick={() => removeMaterial(m.id)}
                  className="text-muted-foreground hover:text-destructive p-0.5"
                  title="Remove material"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </>
  );
};

export default Header;
