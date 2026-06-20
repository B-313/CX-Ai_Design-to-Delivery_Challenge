import { useState } from "react";
import { motion } from "framer-motion";
import { Terminal, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import BriefInput from "@/components/BriefInput";
import AnalysisResults from "@/components/AnalysisResults";
import { analyzeBrief } from "@/lib/api";
import type { BriefAnalysis } from "@/types/analysis";

const Engine = () => {
  const [analysis, setAnalysis] = useState<BriefAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (brief: string) => {
    setIsLoading(true);
    setAnalysis(null);
    try {
      const result = await analyzeBrief(brief);
      setAnalysis(result);
    } catch (err: any) {
      toast.error(err.message || "Analysis failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <Terminal className="w-5 h-5 text-primary" />
              <span className="font-bold text-foreground tracking-tight">Accelerator</span>
              <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">Engine</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6">
        {!analysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <h1 className="text-3xl md:text-5xl font-bold mb-3">
              Prompt <span className="text-gradient-primary">Intelligence Engine</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Paste a website brief. Get compliance analysis, component recommendations, and a ready-to-use rewrite.
            </p>
          </motion.div>
        )}

        {!analysis && <BriefInput onSubmit={handleSubmit} isLoading={isLoading} />}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mt-16"
          >
            <div className="inline-flex items-center gap-3 rounded-xl border border-border bg-card px-6 py-4">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-sm font-mono text-muted-foreground">Analyzing brief for compliance...</span>
            </div>
          </motion.div>
        )}

        {analysis && (
          <AnalysisResults
            analysis={analysis}
            onReset={() => setAnalysis(null)}
          />
        )}
      </main>
    </div>
  );
};

export default Engine;
