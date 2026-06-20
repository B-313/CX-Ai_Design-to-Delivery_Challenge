import { useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import { Check, Palette, Layout, Type } from "lucide-react";
import { toast } from "sonner";

const LAYOUTS = [
  { id: "hero", name: "Hero + Cards", desc: "Bold banner with feature grid", icon: "🏔️" },
  { id: "two-col", name: "Two Column", desc: "Content with sidebar", icon: "📰" },
  { id: "cards", name: "Card Grid", desc: "Feature highlights in tiles", icon: "🃏" },
  { id: "split", name: "Split", desc: "50/50 image and content", icon: "⬜" },
  { id: "article", name: "Article", desc: "Long-form editorial", icon: "📄" },
  { id: "minimal", name: "Minimal", desc: "Clean centred editorial", icon: "✨" },
];

const STYLES = [
  { id: "corporate", name: "Corporate", desc: "Professional Company Name blue" },
  { id: "warm", name: "Warm & Human", desc: "Patient-friendly, approachable" },
  { id: "clinical", name: "Clinical", desc: "Clean, data-driven, precise" },
  { id: "bold", name: "Bold Campaign", desc: "High-impact, vibrant" },
];

const DesignPickerPanel = () => {
  const ws = useWorkspace();
  const [selectedLayout, setSelectedLayout] = useState(ws.layout || "");
  const [selectedStyle, setSelectedStyle] = useState("corporate");

  const canProceed = selectedLayout && selectedStyle;

  const handleProceed = () => {
    if (!canProceed) return;
    ws.setLayout(selectedLayout);
    toast.success("Design selected - loading builder");
    ws.goToStep(2);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-up">
      <div className="bg-card border-b border-border px-5 py-2.5 flex items-center gap-3 flex-shrink-0">
        <span className="text-[13px] font-semibold text-pf-dark flex-1">Choose Your Design</span>
        <button
          onClick={handleProceed}
          disabled={!canProceed}
          className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-bold hover:bg-pf-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          Start Building <Check className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(198 76% 96%) 0%, hsl(210 33% 97%) 55%)" }}>
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Layout */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Layout className="w-4 h-4 text-primary" />
              <h3 className="font-serif text-lg text-pf-dark">Layout</h3>
              <span className="text-[11px] text-muted-foreground ml-1">Content auto-populates from your brief</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {LAYOUTS.map(l => (
                <button
                  key={l.id}
                  onClick={() => setSelectedLayout(l.id)}
                  className={cn(
                    "bg-card border-2 rounded-xl overflow-hidden transition-all shadow-pf hover:shadow-pf-md hover:-translate-y-0.5 text-left",
                    selectedLayout === l.id ? "border-primary shadow-[0_0_0_3px_hsla(200,100%,41%,0.18)]" : "border-border"
                  )}
                >
                  <div className="aspect-video bg-secondary flex items-center justify-center text-2xl">
                    {l.icon}
                  </div>
                  <div className="p-3 flex items-start gap-2">
                    {selectedLayout === l.id && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />}
                    <div>
                      <div className="text-xs font-bold text-foreground">{l.name}</div>
                      <div className="text-[11px] text-muted-foreground">{l.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Style */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-primary" />
              <h3 className="font-serif text-lg text-pf-dark">Style</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStyle(s.id)}
                  className={cn(
                    "bg-card border-2 rounded-xl p-4 text-left transition-all shadow-pf hover:shadow-pf-md",
                    selectedStyle === s.id ? "border-primary shadow-[0_0_0_3px_hsla(200,100%,41%,0.18)]" : "border-border"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {selectedStyle === s.id && <Check className="w-3.5 h-3.5 text-primary" />}
                    <span className="text-sm font-bold text-foreground">{s.name}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{s.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Review Summary */}
          {ws.reviewData && (
            <section className="bg-card border border-border rounded-xl p-5 shadow-pf">
              <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-3">AI Review Summary</div>
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(ws.reviewData.scores).map(([key, val]) => (
                  <div key={key} className="text-center">
                    <div className={cn(
                      "text-xl font-bold",
                      val >= 80 ? "text-success" : val >= 60 ? "text-warning" : "text-destructive"
                    )}>{val}</div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">
                      {key === "brandVoice" ? "Brand" : key}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default DesignPickerPanel;
