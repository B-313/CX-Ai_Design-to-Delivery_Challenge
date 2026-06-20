import { useState } from "react";
import { Send, Loader2 } from "lucide-react";

interface BriefInputProps {
  onSubmit: (brief: string) => void;
  isLoading: boolean;
}

const BriefInput = ({ onSubmit, isLoading }: BriefInputProps) => {
  const [brief, setBrief] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (brief.trim() && !isLoading) {
      onSubmit(brief.trim());
    }
  };

  const examples = [
    "Build a product landing page for a new health supplement with testimonials, pricing, and a signup form",
    "Create a patient portal homepage with appointment booking, medication tracker, and doctor directory",
    "Design a corporate careers page with job listings, company culture section, and application form",
  ];

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Paste your website brief or describe what you want to build..."
            className="w-full min-h-[180px] rounded-xl border border-border bg-card text-foreground p-5 pr-14 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:shadow-[var(--glow-primary)] resize-y transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!brief.trim() || isLoading}
            className="absolute bottom-4 right-4 p-3 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 hover:shadow-[var(--glow-primary)] transition-all disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>

      {!isLoading && !brief && (
        <div className="mt-6">
          <p className="text-xs font-mono text-muted-foreground mb-3 uppercase tracking-wider">Try an example</p>
          <div className="flex flex-col gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => setBrief(ex)}
                className="text-left text-sm text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 rounded-lg px-4 py-3 transition-colors border border-transparent hover:border-border"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BriefInput;
