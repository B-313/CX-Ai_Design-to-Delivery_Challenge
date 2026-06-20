import { useWorkspace } from "@/contexts/WorkspaceContext";
import BriefAccordion from "./BriefAccordion";
import { Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

const BriefDisplayPanel = () => {
  const ws = useWorkspace();
  const { currentBrief, goToStep, approvePie, setCurrentBrief, pieResult, materials } = ws;

  const extractSourceCount = (text: string): number | null => {
    if (!text) return null;
    if (/no external documents or links supplied|no user-provided documents or links supplied|prompt and ideation inputs only/i.test(text)) {
      return 0;
    }
    const listed = text.match(/User-provided documents\/links:\s*([^\n]+)/i);
    if (!listed?.[1]) return null;
    return listed[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean).length;
  };

  const materialCount = materials.length;
  const derivedSourceCount = extractSourceCount(currentBrief.informationFromSources || "");
  const sourceCount = derivedSourceCount === null ? materialCount : derivedSourceCount;
  const sourceValue = sourceCount > 0 ? `${sourceCount} source${sourceCount === 1 ? "" : "s"} absorbed` : "Prompt-led brief";
  const sourceDetail = currentBrief.informationFromSources || "No source summary available.";
  const enrichmentDetail = currentBrief.inspiration || "Prompt intelligence applied audience, compliance, and structure refinement.";
  const audienceLabel = pieResult?.audience?.audience || ws.prelim.audience || "Not detected";
  const jurisdictionLabel = pieResult?.jurisdiction?.body || "Global default safeguards";
  const readabilityLabel = pieResult
    ? `Grade ${pieResult.readability.predicted_grade} to target ${pieResult.readability.target_grade}`
    : "Audience readability guidance pending";
  const guardrailLabel = pieResult
    ? `${pieResult.risk.level} risk with ${pieResult.risk.recommendations.length} guardrail${pieResult.risk.recommendations.length === 1 ? "" : "s"}`
    : "Default guardrails applied";

  const handleApprove = () => {
    approvePie();
    // Keep the ideation draft so navigating back to step 1 restores the
    // user's prompt, questionnaire answers, and uploaded materials.
    toast.success("Brief approved - choose your design");
    goToStep(3);
  };

  if (!currentBrief) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 animate-fade-up">
        <div className="max-w-md text-center">
          <p className="text-[13px] text-muted-foreground mb-4">
            No brief generated yet. Go back to Ideation to create one.
          </p>
          <button
            onClick={() => goToStep(1)}
            className="flex items-center gap-1.5 mx-auto text-xs font-semibold text-primary hover:text-pf-dark"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Ideation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto animate-fade-up">
      {/* Top bar */}
      <div className="bg-card border-b border-border px-5 py-2 flex items-center gap-2.5">
        <button
          onClick={() => goToStep(1)}
          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary mr-2"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Ideation
        </button>
        <div className="text-[13px] font-semibold text-pf-dark flex-1">Generated Brief</div>
        <button
          onClick={handleApprove}
          className="bg-success text-success-foreground rounded-md px-4 py-1.5 text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          <Check className="w-3 h-3" /> Approve Brief →
        </button>
      </div>

      {/* Summary banner */}
      <div className="bg-pf-mist border-b border-pf-sky px-6 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-pf-dark/70 mb-0.5">
            Prompt Intelligence Generated Content from What You Provided
          </div>
          <p className="text-[13px] text-foreground leading-relaxed">
            <span className="font-semibold">{currentBrief.projectTitle}</span> - {currentBrief.goal}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Prompt intelligence converted your raw ideas, links, and files into a brief shaped by audience, jurisdiction, readability, and risk guardrails.
          </p>
        </div>
      </div>

      <div className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <EnrichmentCard
              title="Source Inputs"
              value={sourceValue}
              detail={sourceDetail}
            />
            <EnrichmentCard
              title="Audience Framing"
              value={toTitleCase(audienceLabel)}
              detail={pieResult?.audience?.flag_for_review ? "Audience confidence was flagged for human review." : "Brief language and structure were tuned to the detected audience."}
            />
            <EnrichmentCard
              title="Intelligence Added"
              value="Enrichment layer applied"
              detail={enrichmentDetail}
            />
            <EnrichmentCard
              title="Guardrails Applied"
              value={guardrailLabel}
              detail={pieResult?.risk?.recommendations?.slice(0, 2).join(" ") || "Standard Company Name compliance guardrails applied."}
            />
            <EnrichmentCard
              title="Delivery Fit"
              value={jurisdictionLabel}
              detail={pieResult ? `${readabilityLabel}. Tone: ${pieResult.tone.label}.` : readabilityLabel}
            />
          </div>
        </div>
      </div>

      {/* Editable accordion */}
      <div>
        <BriefAccordion brief={currentBrief} onUpdate={setCurrentBrief} />
      </div>

      {/* Footer */}
      <div className="bg-card border-t border-border px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => goToStep(1)}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Ideation
        </button>
        <button
          onClick={handleApprove}
          className="bg-success text-success-foreground rounded-md px-5 py-2 text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          <Check className="w-3 h-3" /> Approve Brief →
        </button>
      </div>
    </div>
  );
};

function EnrichmentCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3.5">
      <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground/75">{title}</div>
      <div className="mb-1.5 text-[14px] font-semibold text-pf-dark">{value}</div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default BriefDisplayPanel;
