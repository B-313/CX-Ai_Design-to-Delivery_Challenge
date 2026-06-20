import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  empNumber: string;
  department: string;
  country: string;
}

export interface PrelimData {
  buildType: string | null;
  audience: string | null;
}

export interface PIEResult {
  pie_score: number;
  pie_grade: string;
  pie_interpretation: string;
  breakdown: { compliance: number; tone: number; audience: number; readability: number };
  audience: { audience: string; confidence: number; flag_for_review: boolean; flag_reason?: string };
  jurisdiction: { body: string; framework: string; notes: string; gdpr: boolean; country_detected: string };
  risk: { risk_score: number; level: string; triggers: string[]; recommendations: string[] };
  tone: { tone_score: number; label: string; inject_guidance: boolean };
  readability: { predicted_grade: number; target_grade: number; target_label: string; inject_simplify: boolean; guidance: string };
  enriched_prompt: string;
  sensemaker?: {
    interpreted_goal: string;
    inferred_audience: string;
    inferred_context: string;
    ambiguities: string[];
    clarified_brief: string;
    confidence: number;
  } | null;
}

export interface BriefData {
  projectTitle: string;
  goal: string;
  audience: string;
  keyMessages: string[];
  contentSections: string[];
  toneAndStyle: string;
  informationFromSources: string;
  inspiration?: string;
}

export interface EnrichedBlock {
  name: string;
  fields: { label: string; value: string; heading?: boolean; image?: boolean }[];
}

export interface WorkspaceMaterial {
  id: string;
  name: string;
  type: "document" | "link" | "image";
  source: string;
  stage: "ideation" | "builder";
}

export interface ReviewIssue {
  id: string;
  severity: "high" | "medium" | "low";
  field: string;
  contentSnippet: string;
  issue: string;
  recommendation: string;
}

export interface ReviewData {
  overallScore: number;
  complianceIssues: ReviewIssue[];
  grammarIssues: ReviewIssue[];
  scores: { compliance: number; grammar: number; brandVoice: number; accessibility: number };
}

interface WorkspaceState {
  step: number;
  maxStep: number;
  user: UserData | null;
  prelim: PrelimData;
  pieResult: PIEResult | null;
  pieApproved: boolean;
  briefs: { time: string; data: BriefData; prompt: string }[];
  currentBrief: BriefData | null;
  layout: string | null;
  reviewData: ReviewData | null;
  reviewDecisions: Record<string, "approved" | "declined">;
  submitted: boolean;
  loading: boolean;
  activeAgent: number | null;
  notes: string;
  materials: WorkspaceMaterial[];
  enrichedBlocks: EnrichedBlock[];
  sourceText: string;
}

interface WorkspaceContextValue extends WorkspaceState {
  goToStep: (step: number) => void;
  setUser: (user: UserData) => void;
  setPrelim: (prelim: PrelimData) => void;
  setPieResult: (result: PIEResult) => void;
  approvePie: () => void;
  setCurrentBrief: (brief: BriefData) => void;
  addBriefVersion: (prompt: string, data: BriefData) => void;
  setLayout: (layout: string) => void;
  setReviewData: (data: ReviewData) => void;
  setReviewDecision: (id: string, decision: "approved" | "declined") => void;
  setSubmitted: () => void;
  setLoading: (loading: boolean) => void;
  setActiveAgent: (agent: number | null) => void;
  setNotes: (notes: string) => void;
  addMaterial: (material: Omit<WorkspaceMaterial, "id">) => string;
  removeMaterial: (id: string) => void;
  setEnrichedBlocks: (blocks: EnrichedBlock[]) => void;
  setSourceText: (text: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const WORKSPACE_BOOTSTRAP_KEY = "workspace_bootstrap_state_v1";

const createDefaultState = (): WorkspaceState => ({
  step: 0,
  maxStep: 0,
  user: null,
  prelim: { buildType: null, audience: null },
  pieResult: null,
  pieApproved: false,
  briefs: [],
  currentBrief: null,
  layout: null,
  reviewData: null,
  reviewDecisions: {},
  submitted: false,
  loading: false,
  activeAgent: null,
  notes: "",
  materials: [],
  enrichedBlocks: [],
  sourceText: "",
});

const createInitialState = (): WorkspaceState => {
  const defaults = createDefaultState();

  if (typeof window === "undefined") {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(WORKSPACE_BOOTSTRAP_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<WorkspaceState>;
    if (!parsed || typeof parsed !== "object") return defaults;

    return {
      ...defaults,
      ...parsed,
      prelim: {
        ...defaults.prelim,
        ...(parsed.prelim || {}),
      },
      reviewDecisions: parsed.reviewDecisions || {},
      materials: Array.isArray(parsed.materials) ? parsed.materials : [],
      enrichedBlocks: Array.isArray(parsed.enrichedBlocks) ? parsed.enrichedBlocks : [],
      briefs: Array.isArray(parsed.briefs) ? parsed.briefs : [],
    };
  } catch {
    return defaults;
  }
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(createInitialState);

  const goToStep = useCallback((step: number) => {
    setState(s => ({
      ...s,
      step,
      maxStep: Math.max(s.maxStep, step),
    }));
  }, []);

  const setUser = useCallback((user: UserData) => {
    setState(s => ({ ...s, user }));
  }, []);

  const setPrelim = useCallback((prelim: PrelimData) => {
    setState(s => ({ ...s, prelim }));
  }, []);

  const setPieResult = useCallback((pieResult: PIEResult) => {
    setState(s => ({ ...s, pieResult }));
  }, []);

  const approvePie = useCallback(() => {
    setState(s => ({ ...s, pieApproved: true }));
  }, []);

  const setCurrentBrief = useCallback((currentBrief: BriefData) => {
    setState(s => ({ ...s, currentBrief }));
  }, []);

  const addBriefVersion = useCallback((prompt: string, data: BriefData) => {
    setState(s => ({
      ...s,
      briefs: [...s.briefs, { time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), data, prompt }],
    }));
  }, []);

  const setLayout = useCallback((layout: string) => {
    setState(s => ({ ...s, layout }));
  }, []);

  const setReviewData = useCallback((reviewData: ReviewData) => {
    setState(s => ({ ...s, reviewData }));
  }, []);

  const setReviewDecision = useCallback((id: string, decision: "approved" | "declined") => {
    setState(s => ({ ...s, reviewDecisions: { ...s.reviewDecisions, [id]: decision } }));
  }, []);

  const setSubmitted = useCallback(() => {
    setState(s => ({ ...s, submitted: true }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState(s => ({ ...s, loading }));
  }, []);

  const setActiveAgent = useCallback((activeAgent: number | null) => {
    setState(s => ({ ...s, activeAgent }));
  }, []);

  const setNotes = useCallback((notes: string) => {
    setState(s => ({ ...s, notes }));
  }, []);

  const addMaterial = useCallback((material: Omit<WorkspaceMaterial, "id">) => {
    const id = `material-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setState(s => ({ ...s, materials: [...s.materials, { ...material, id }] }));
    return id;
  }, []);

  const removeMaterial = useCallback((id: string) => {
    setState(s => ({ ...s, materials: s.materials.filter(m => m.id !== id) }));
  }, []);

  const setEnrichedBlocks = useCallback((enrichedBlocks: EnrichedBlock[]) => {
    setState(s => ({ ...s, enrichedBlocks }));
  }, []);

  const setSourceText = useCallback((sourceText: string) => {
    setState(s => ({ ...s, sourceText }));
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        ...state,
        goToStep, setUser, setPrelim, setPieResult, approvePie,
        setCurrentBrief, addBriefVersion, setLayout, setReviewData,
        setReviewDecision, setSubmitted, setLoading, setActiveAgent, setNotes,
        addMaterial, removeMaterial, setEnrichedBlocks, setSourceText,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
