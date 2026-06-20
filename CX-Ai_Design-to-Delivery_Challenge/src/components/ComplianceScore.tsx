import { motion } from "framer-motion";
import type { AnalysisIssue } from "@/types/analysis";

interface ComplianceScoreProps {
  score: number;
  issues: AnalysisIssue[];
}

const ComplianceScore = ({ score, issues }: ComplianceScoreProps) => {
  const high = issues.filter((i) => i.severity === "high").length;
  const medium = issues.filter((i) => i.severity === "medium").length;
  const low = issues.filter((i) => i.severity === "low").length;

  const scoreColor =
    score >= 80 ? "text-[hsl(140,70%,50%)]" : score >= 50 ? "text-[hsl(45,100%,60%)]" : "text-[hsl(0,70%,55%)]";

  const ringColor =
    score >= 80 ? "hsl(140,70%,50%)" : score >= 50 ? "hsl(45,100%,60%)" : "hsl(0,70%,55%)";

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center">
      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Compliance Score</p>

      <div className="relative w-32 h-32 mb-4">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" stroke="hsl(220,14%,16%)" strokeWidth="8" fill="none" />
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            stroke={ringColor}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-bold font-mono ${scoreColor}`}>{score}</span>
        </div>
      </div>

      <div className="flex gap-4 text-xs font-mono">
        {high > 0 && (
          <span className="text-[hsl(0,70%,55%)]">
            {high} high
          </span>
        )}
        {medium > 0 && (
          <span className="text-[hsl(45,100%,60%)]">
            {medium} med
          </span>
        )}
        {low > 0 && (
          <span className="text-muted-foreground">
            {low} low
          </span>
        )}
      </div>
    </div>
  );
};

export default ComplianceScore;
