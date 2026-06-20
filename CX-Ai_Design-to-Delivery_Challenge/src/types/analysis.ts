export interface AnalysisIssue {
  category: "brand" | "accessibility" | "regulatory" | "content" | "technical";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  fix: string;
}

export interface SuggestedComponent {
  name: string;
  reason: string;
}

export interface BriefAnalysis {
  compliance_score: number;
  summary: string;
  issues: AnalysisIssue[];
  suggested_components: SuggestedComponent[];
  compliant_rewrite: string;
}
