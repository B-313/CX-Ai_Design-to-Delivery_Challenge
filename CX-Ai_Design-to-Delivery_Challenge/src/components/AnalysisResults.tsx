import { motion } from "framer-motion";
import type { BriefAnalysis } from "@/types/analysis";
import ComplianceScore from "./ComplianceScore";
import IssuesList from "./IssuesList";
import ComponentSuggestions from "./ComponentSuggestions";
import CompliantRewrite from "./CompliantRewrite";

interface AnalysisResultsProps {
  analysis: BriefAnalysis;
  onReset: () => void;
}

const AnalysisResults = ({ analysis, onReset }: AnalysisResultsProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-5xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Analysis Complete</h2>
          <p className="text-sm text-muted-foreground mt-1">{analysis.summary}</p>
        </div>
        <button
          onClick={onReset}
          className="px-5 py-2.5 rounded-lg border border-border text-sm text-foreground hover:bg-secondary transition-colors"
        >
          New Analysis
        </button>
      </div>

      {/* Score + Issues overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ComplianceScore score={analysis.compliance_score} issues={analysis.issues} />
        <div className="lg:col-span-2">
          <IssuesList issues={analysis.issues} />
        </div>
      </div>

      {/* Components + Rewrite */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ComponentSuggestions components={analysis.suggested_components} />
        <CompliantRewrite rewrite={analysis.compliant_rewrite} />
      </div>
    </motion.div>
  );
};

export default AnalysisResults;
