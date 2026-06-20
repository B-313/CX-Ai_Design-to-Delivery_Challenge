import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Register", num: 1 },
  { label: "Ideation", num: 2 },
  { label: "Brief", num: 3 },
  { label: "Enriched Content", num: 4 },
  { label: "Review", num: 5 },
  { label: "Submit", num: 6 },
];

const LeftSidebar = () => {
  const {
    step,
    submitted,
    goToStep,
    notes,
    setNotes,
    reviewData,
    reviewDecisions,
    user,
    prelim,
    pieApproved,
    currentBrief,
    layout,
    materials,
    removeMaterial,
  } = useWorkspace();

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
    if (idx === 0) return true;
    return completion[idx - 1];
  };

  const handleNav = (idx: number) => {
    if (submitted) return;
    if (!canEnter(idx) && idx !== step) return;
    goToStep(idx);
  };

  return (
    <aside className="w-[190px] flex-shrink-0 bg-card border-r border-border flex flex-col overflow-hidden">

      <div className="flex-1 p-2 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70 px-1.5 mb-2">Workflow</div>
        {STEPS.map((s, i) => {
          const isDone = completion[i] || (i === 5 && submitted);
          const isActive = i === step;
          const isLocked = !canEnter(i) && !isActive;

          return (
            <button
              key={i}
              onClick={() => handleNav(i)}
              disabled={isLocked || submitted}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-2 rounded-md text-[13px] font-medium transition-all mb-1 relative select-none text-left",
                isActive && "bg-primary/10 text-pf-dark font-semibold",
                isDone && !isActive && "text-foreground",
                !isActive && !isDone && !isLocked && "text-muted-foreground hover:bg-secondary hover:text-foreground",
                isLocked && "opacity-35 cursor-not-allowed text-muted-foreground/60"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-[20%] bottom-[20%] w-[2px] rounded-r bg-primary" />
              )}
              <div
                className={cn(
                  "w-[18px] h-[18px] rounded-full border-[1.5px] text-[9px] font-extrabold flex items-center justify-center flex-shrink-0 transition-all",
                  isActive && "bg-primary border-primary text-primary-foreground",
                  isDone && !isActive && "bg-success border-success text-success-foreground",
                  !isActive && !isDone && "border-border text-muted-foreground"
                )}
              >
                {isDone && !isActive ? "✓" : s.num}
              </div>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {submitted && (
        <div className="bg-success-light border-t border-success/20 p-3">
          <div className="text-[12px] font-bold text-success mb-1">Submitted</div>
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            Your project is with the IT review team.
          </div>
        </div>
      )}

      <div className="border-t border-border p-2.5 flex-shrink-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5">Materials</div>
        <div className="max-h-24 overflow-y-auto mb-2 space-y-1">
          {materials.length === 0 ? (
            <div className="text-[11px] text-muted-foreground/60">No uploaded materials</div>
          ) : materials.map(m => (
            <div key={m.id} className="flex items-center gap-1 bg-secondary border border-border rounded px-1.5 py-1">
              <span className="text-[11px] font-semibold text-foreground truncate flex-1" title={m.source}>{m.name}</span>
              <button
                onClick={() => removeMaterial(m.id)}
                className="text-[10px] text-muted-foreground hover:text-destructive"
                title="Remove"
              >
                x
              </button>
            </div>
          ))}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">Notes</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Jot notes…"
          className="w-full h-32 text-[12px] bg-secondary border border-border rounded-md p-2 resize-none outline-none focus:border-primary transition-colors text-foreground placeholder:text-muted-foreground/60"
        />
      </div>
    </aside>
  );
};

export default LeftSidebar;
