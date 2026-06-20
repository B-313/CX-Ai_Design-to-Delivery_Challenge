import { Blocks } from "lucide-react";
import type { SuggestedComponent } from "@/types/analysis";

interface ComponentSuggestionsProps {
  components: SuggestedComponent[];
}

const ComponentSuggestions = ({ components }: ComponentSuggestionsProps) => {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
        Suggested Components
      </p>

      <div className="space-y-3">
        {components.map((comp, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
            <Blocks className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">{comp.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{comp.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComponentSuggestions;
