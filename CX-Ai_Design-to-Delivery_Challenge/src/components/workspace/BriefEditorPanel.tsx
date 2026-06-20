import { useEffect, useState, useRef } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { evaluateMaterialSafety } from "@/lib/materialSafety";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { BriefData, PIEResult } from "@/contexts/WorkspaceContext";
import { Upload, FileText, Link2, X, Send, Check, ChevronRight, AlertTriangle } from "lucide-react";
import { appendAuditEvent } from "@/lib/audit";
import { invokeProtectedFunction } from "@/lib/protectedInvoke";
import { StepGuide } from "./StepGuide";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/* ── Lego-style question blocks ── */
const QUESTIONS: {
  key: string;
  question: string;
  subtitle?: string;
  options?: string[];
  dropdown?: boolean;
  multiSelect?: boolean;
  freeText?: boolean;
  placeholder?: string;
  allowOther?: boolean;
}[] = [
  {
    key: "buildType",
    question: "What are you building?",
    subtitle: "Choose one to shape layout and page planning",
    options: ["Website", "Webpage", "Landing Page", "Microsite"],
  },
  {
    key: "audience",
    question: "Who is the primary audience?",
    subtitle: "Select the primary audience for this content",
    options: ["Patients", "Healthcare Providers (HCPs)", "Internal Teams", "Channel Partners", "Vendors"],
    freeText: false,
    placeholder: "",
    allowOther: false,
  },
  {
    key: "websitePages",
    question: "If this is a website, what page sections do you need?",
    subtitle: "Pick page options (Page 1, Page 2, etc.) and optionally add custom names below",
    options: ["Page 1", "Page 2", "Page 3", "Page 4", "Page 5", "Page 6"],
    multiSelect: true,
    freeText: true,
    placeholder: "Optional custom page names\nHome\nAbout\nContact",
  },
  {
    key: "websiteLayout",
    question: "If this is a website, which layout style do you prefer?",
    subtitle: "Choose a Canva/Google Sites style to preconfigure Enriched Content",
    options: ["Hero + Cards", "Two Column", "Card Grid", "Split", "Article", "Minimal"],
  },
  {
    key: "region",
    question: "Region",
    subtitle: "Select the target market/region (this can differ from your office location)",
    dropdown: true,
    options: [
      "Global",
      "United Kingdom",
      "United States",
      "Germany",
      "France",
      "Spain",
      "Italy",
      "Netherlands",
      "Australia",
      "Japan",
      "China",
      "India",
      "Brazil",
      "South Africa",
      "UAE",
      "Singapore",
    ],
  },
  {
    key: "themesTopics",
    question: "What are the themes/topics covered?",
    subtitle: "List key topics, one per line - these will be used to create sections for your page",
    freeText: true,
    placeholder: "Topic 1\nTopic 2\nTopic 3",
  },
  {
    key: "specificProduct",
    question: "Are you talking about a specific product, drug, or therapy?",
    subtitle: "This powers risk scoring",
    options: ["No", "Yes"],
  },
  {
    key: "productName",
    question: "What is the product, drug, or therapy name?",
    subtitle: "Only required when you selected Yes",
    freeText: true,
    placeholder: "e.g. New oncology drug XYZ-123",
  },
  {
    key: "evidenceAndDisclaimers",
    question: "Will your content contain Clinical, Research or Regulatory data / Disclaimers, or metrics to support the information?",
    subtitle: "Paste them here if not already uploaded",
    freeText: true,
    placeholder: "Describe all clinical/research/regulatory data, disclaimers, or metrics that will be used",
  },
];

type QAnswers = Record<string, string | string[]>;

type GenerationInput = {
  userRawPrompt: string;
  questionnaireAnswers: Record<string, string | string[]>;
  documents: { name: string; source: string; excerpt: string }[];
  links: { name: string; url: string; excerpt: string }[];
};

const QUESTION_LABELS = Object.fromEntries(QUESTIONS.map(q => [q.key, q.question]));

const hasValue = (val: string | string[] | undefined) => {
  if (Array.isArray(val)) return val.length > 0;
  return typeof val === "string" ? val.trim().length > 0 : false;
};

const BRIEF_DRAFT_KEY = "company_name_brief_editor_draft_v1";

type UploadedSource = { id: string; name: string; content: string; materialId: string; source: string; sourceType: "document" | "link" };

const getFileExtension = (name: string) => {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() || "" : "";
};

const isPlainTextExtension = (ext: string) => ["txt", "csv", "md", "json", "tsv"].includes(ext);

const extractTextFromPdf = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const chunks: string[] = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => (typeof item?.str === "string" ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) chunks.push(pageText);
  }

  return chunks.join("\n").trim();
};

const extractTextFromDocx = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return (result.value || "").replace(/\s+\n/g, "\n").trim();
};

const extractDocumentText = async (file: File) => {
  const ext = getFileExtension(file.name);
  if (isPlainTextExtension(ext)) return (await file.text()).trim();
  if (ext === "pdf") return extractTextFromPdf(file);
  if (ext === "docx") return extractTextFromDocx(file);
  return "";
};

const normalizeLayoutChoice = (choice?: string | string[]) => {
  const val = Array.isArray(choice) ? choice[0] : choice;
  switch ((val || "").toLowerCase()) {
    case "hero + cards":
      return "hero";
    case "two column":
      return "two-col";
    case "card grid":
      return "cards";
    case "split":
      return "split";
    case "article":
      return "article";
    case "minimal":
      return "minimal";
    default:
      return null;
  }
};

const toTitleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const sanitizeSectionTitle = (value: string) =>
  toTitleCase(
    value
      .replace(/^[-*•\s]+/, "")
      .replace(/["'`]/g, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 70)
  );

const extractListLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildFallbackPieResult(briefText: string, answerSet: QAnswers, countryHint: string, audienceHint: string): PIEResult {
  const audience = audienceHint || "patients";
  const country = countryHint || "Global";
  const riskTriggers = ["drug", "clinical", "treatment"].filter(k => briefText.toLowerCase().includes(k));
  const riskScore = riskTriggers.length > 0 ? 0.62 : 0.34;
  const pieScore = riskScore > 0.6 ? 72 : 84;

  return {
    pie_score: pieScore,
    pie_grade: pieScore >= 90 ? "A" : pieScore >= 75 ? "B" : pieScore >= 60 ? "C" : "D",
    pie_interpretation: "Fallback PIE used due to temporary classifier outage",
    breakdown: {
      compliance: Math.max(40, Math.round((1 - riskScore) * 100)),
      tone: 78,
      audience: 74,
      readability: 76,
    },
    audience: { audience, confidence: 0.6, flag_for_review: true, flag_reason: "Fallback audience classifier" },
    jurisdiction: { body: "WCAG 2.1 AA + GDPR", framework: "Fallback global baseline", notes: "Classifier unavailable", gdpr: true, country_detected: country },
    risk: { risk_score: riskScore, level: riskScore >= 0.75 ? "HIGH" : riskScore >= 0.4 ? "MEDIUM" : "LOW", triggers: riskTriggers, recommendations: ["Review and validate claims before publishing"] },
    tone: { tone_score: 0.78, label: "borderline", inject_guidance: false },
    readability: { predicted_grade: 9, target_grade: audience.toLowerCase().includes("patient") ? 8 : 11, target_label: "Fallback", inject_simplify: false, guidance: "Fallback readability" },
    enriched_prompt: JSON.stringify({
      role: "Senior Pharmaceutical Company digital strategist",
      project_context: {
        buildType: (answerSet.buildType as string) || "Webpage",
        audience,
        country,
      },
      pie_output: {
        audience,
        riskLevel: riskScore >= 0.75 ? "HIGH" : riskScore >= 0.4 ? "MEDIUM" : "LOW",
        readabilityTarget: audience.toLowerCase().includes("patient") ? "Grade 8" : "Grade 11",
      },
      generation_rules: [
        "Return valid JSON only.",
        "Ground all fields in the user prompt, questionnaire answers, and uploaded materials.",
        "Tone, style, and colours are applied automatically from branding downstream.",
      ],
      user_request: briefText,
    }, null, 2),
  };
}

const BriefEditorPanel = () => {
  const ws = useWorkspace();
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"input" | "questions" | "checking" | "brief" | "reviewing">("input");
  const [questionQueue, setQuestionQueue] = useState<number[]>([]);
  const [qPos, setQPos] = useState(0);
  const [answers, setAnswers] = useState<QAnswers>({});
  const [freeAnswer, setFreeAnswer] = useState("");
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedSource[]>([]);
  const [webpageLink, setWebpageLink] = useState("");
  const [webpageLinkName, setWebpageLinkName] = useState("");
  const [censorWarning, setCensorWarning] = useState<string | null>(null);
  const [uploadTermsAccepted, setUploadTermsAccepted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BRIEF_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (typeof draft.prompt === "string") setPrompt(draft.prompt);
      if (draft.answers && typeof draft.answers === "object") setAnswers(draft.answers);
      if (Array.isArray(draft.uploadedFiles)) setUploadedFiles(draft.uploadedFiles.slice(0, 6));
      if (typeof draft.webpageLink === "string") setWebpageLink(draft.webpageLink);
      if (typeof draft.webpageLinkName === "string") setWebpageLinkName(draft.webpageLinkName);
      if (Array.isArray(draft.questionQueue)) setQuestionQueue(draft.questionQueue);
      if (typeof draft.qPos === "number") setQPos(Math.max(0, draft.qPos));
      if (draft.phase && draft.phase !== "checking") setPhase(draft.phase === "questions" ? "input" : draft.phase);
    } catch {
      // Ignore malformed local draft.
    }
  }, []);

  useEffect(() => {
    const payload = {
      prompt,
      phase,
      answers,
      questionQueue,
      qPos,
      uploadedFiles,
      webpageLink,
      webpageLinkName,
    };
    localStorage.setItem(BRIEF_DRAFT_KEY, JSON.stringify(payload));
  }, [prompt, phase, answers, questionQueue, qPos, uploadedFiles, webpageLink, webpageLinkName]);

  useEffect(() => {
    const qIndex = questionQueue[qPos];
    if (qIndex === undefined) return;
    const q = QUESTIONS[qIndex];
    if (!q?.freeText) return;
    const existing = answers[q.key];
    if (typeof existing === "string") {
      setFreeAnswer(existing);
    }
  }, [qPos, questionQueue, answers]);

  useEffect(() => {
    if (phase === "questions" && questionQueue.length === 0) {
      setPhase("input");
    }
  }, [phase, questionQueue.length]);

  const confirmMaterialGuideline = () => {
    if (!uploadTermsAccepted) {
      toast.warning("Please accept the material upload terms before uploading.");
      return false;
    }
    return true;
  };

  const runSafetyAgentCheck = (textToScan: string) => {
    const scan = evaluateMaterialSafety(textToScan);
    if (scan.status === "blocked") {
      toast.error(`Safety Agent blocked this material: ${scan.triggers.slice(0, 3).join(", ") || "policy violation"}`);
      return false;
    }
    if (scan.status === "review") {
      const proceed = window.confirm(`Safety Agent flagged this material for review (${scan.triggers.join(", ") || "sensitive terms"}). Continue?`);
      if (!proceed) {
        toast.warning("Material skipped after Safety Agent review");
        return false;
      }
    }
    return true;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} too large (max 5MB)`); continue; }
      if (!confirmMaterialGuideline()) {
        continue;
      }
      const customName = file.name.replace(/\.[^/.]+$/, "") || file.name;
      try {
        const ext = getFileExtension(file.name);
        const rawText = await extractDocumentText(file);
        const hasExtractedText = rawText.length > 0;
        const extractedText = hasExtractedText
          ? rawText.slice(0, 8000)
          : `Binary document uploaded (${ext.toUpperCase()}): ${file.name}. Text extraction unavailable in browser; use filename and user prompt context.`;
        if (!runSafetyAgentCheck(`${customName}\n${file.name}\n${rawText.slice(0, 5000)}`)) {
          continue;
        }
        const materialId = ws.addMaterial({
          name: customName,
          type: "document",
          source: file.name,
          stage: "ideation",
        });
        setUploadedFiles(prev => [...prev, { id: String(Date.now()) + Math.random().toString(36).slice(2, 5), name: customName, content: extractedText, materialId, source: file.name, sourceType: "document" }]);
        toast.success(hasExtractedText ? `Uploaded: ${customName}` : `Uploaded ${customName} (metadata mode for ${ext.toUpperCase()})`);
      } catch { toast.error(`Could not read file`); }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setUploadedFiles(prev => {
      const item = prev[idx];
      if (item) ws.removeMaterial(item.materialId);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const addWebpageLink = async () => {
    const url = webpageLink.trim();
    const name = webpageLinkName.trim();
    if (!url || !name) return;
    if (!/^https?:\/\//i.test(url)) {
      toast.warning("Use a valid link starting with http:// or https://");
      return;
    }
    if (!confirmMaterialGuideline()) {
      toast.warning("Link not added (guideline confirmation not provided)");
      return;
    }
    if (!runSafetyAgentCheck(`${name}\n${url}`)) {
      return;
    }
    const materialId = ws.addMaterial({
      name,
      type: "link",
      source: url,
      stage: "ideation",
    });
    // Fetch real page content via Jina Reader (free, no API key required)
    let content = `Webpage link: ${url}`;
    const tid = toast.loading(`Reading ${name}…`);
    try {
      const res = await fetch(`https://r.jina.ai/${url}`, {
        headers: { Accept: "text/plain", "X-Return-Format": "text" },
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const text = await res.text();
        if (text.length > 100) content = text.slice(0, 8000);
      }
    } catch { /* fallback to URL string */ }
    toast.dismiss(tid);
    setUploadedFiles(prev => [...prev, { id: String(Date.now()) + Math.random().toString(36).slice(2, 5), name, content, materialId, source: url, sourceType: "link" }]);
    setWebpageLink("");
    setWebpageLinkName("");
    toast.success(
      content.startsWith("Webpage link:")
        ? `Link "${name}" added - URL saved for brief context`
        : `"${name}" added - ${Math.ceil(content.length / 100) / 10}K chars extracted from page`
    );
  };

  const getAnswerString = (key: string) => typeof answers[key] === "string" ? String(answers[key]) : "";

  const getAnswerArray = (key: string) => Array.isArray(answers[key]) ? answers[key] as string[] : [];

  const setAnswerValue = (key: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const toggleMultiAnswer = (key: string, value: string) => {
    setAnswers(prev => {
      const current = Array.isArray(prev[key]) ? prev[key] as string[] : [];
      return {
        ...prev,
        [key]: current.includes(value) ? current.filter(item => item !== value) : [...current, value],
      };
    });
  };

  const normalizeAnswerSet = (answerSet: QAnswers): QAnswers => {
    const normalized: QAnswers = {};
    const buildType = typeof answerSet.buildType === "string" ? answerSet.buildType : "";
    const audienceChoice = typeof answerSet.audience === "string" ? answerSet.audience : "";
    const audienceOther = typeof answerSet.audienceOther === "string" ? answerSet.audienceOther.trim() : "";
    const websitePages = Array.isArray(answerSet.websitePages) ? answerSet.websitePages : [];
    const websitePagesOther = typeof answerSet.websitePagesOther === "string" ? answerSet.websitePagesOther : "";

    QUESTIONS.forEach((question) => {
      const rawValue = answerSet[question.key];

      if (question.key === "audience") {
        if (audienceChoice) normalized.audience = audienceChoice;
        return;
      }

      if (question.key === "websitePages") {
        if (buildType !== "Website") return;
        const customPages = extractListLines(websitePagesOther)
          .map(sanitizeSectionTitle)
          .filter(Boolean);
        const mergedPages = [...websitePages, ...customPages]
          .filter(Boolean)
          .filter((value, idx, all) => all.findIndex(item => item.toLowerCase() === value.toLowerCase()) === idx);
        if (mergedPages.length > 0) normalized.websitePages = mergedPages;
        return;
      }

      if (question.key === "websiteLayout") return;
      if (question.key === "productName" && answerSet.specificProduct !== "Yes") return;

      if (hasValue(rawValue)) normalized[question.key] = rawValue;
    });

    return normalized;
  };

  const buildGenerationInput = (answerSet: QAnswers): GenerationInput => {
    const normalizedAnswers = normalizeAnswerSet(answerSet);

    return {
      userRawPrompt: prompt.trim(),
      questionnaireAnswers: Object.fromEntries(
        Object.entries(normalizedAnswers)
          .filter(([key, value]) => QUESTION_LABELS[key] && hasValue(value))
          .map(([key, value]) => [QUESTION_LABELS[key], value])
      ),
      documents: uploadedFiles
        .filter(file => file.sourceType === "document")
        .map(file => ({
          name: file.name,
          source: file.source,
          excerpt: file.content.slice(0, 3000),
        })),
      links: uploadedFiles
        .filter(file => file.sourceType === "link")
        .map(file => ({
          name: file.name,
          url: file.source,
          excerpt: file.content.slice(0, 3000),
        })),
    };
  };

  const invokeProtectedWithRetry = async <TBody extends Record<string, unknown>, TResponse>(
    functionName: string,
    body: TBody,
    attempts = 3,
  ): Promise<TResponse> => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const { data, error } = await invokeProtectedFunction<TBody, TResponse>(functionName, body);
        if (error) throw error;
        const payload = data as any;
        if (payload?.error) {
          throw new Error(typeof payload.error === "string" ? payload.error : "Protected function failed");
        }
        if (!data) throw new Error("Empty response from protected function");
        return data;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Unknown protected invocation error");
        if (attempt < attempts) {
          await wait(attempt * 700);
        }
      }
    }

    throw lastError ?? new Error("Protected invocation failed");
  };

  const getSeedAnswers = (): QAnswers => ({});

  const getMissingQuestionQueue = (seed: QAnswers) =>
    QUESTIONS
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => {
        if (q.key === "websitePages") {
          const bt = seed.buildType;
          return bt === "Website";
        }
        if (q.key === "websiteLayout") {
          const bt = seed.buildType;
          return bt === "Website";
        }
        if (q.key === "productName") {
          const productFlag = seed.specificProduct;
          return productFlag === "Yes";
        }
        return true;
      })
      .filter(({ q }) => !hasValue(seed[q.key]))
      .map(({ idx }) => idx);

  const handleStartQuestions = () => {
    if (!prompt.trim() && uploadedFiles.length === 0) return;

    const normalizedAnswers = normalizeAnswerSet(answers);
    toast.success("Generating your brief");
    runCensorCheck(normalizedAnswers);
  };

  const answerOption = (val: string) => {
    const q = currentQ;
    if (!q) return;
    if (q.multiSelect) {
      setMultiSelected(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
    } else {
      const nextAnswers = { ...answers, [q.key]: val };
      setAnswers(nextAnswers);
      advanceQuestion(nextAnswers);
    }
  };

  const confirmMultiSelect = () => {
    const q = currentQ;
    if (!q) return;
    const nextAnswers = { ...answers, [q.key]: multiSelected };
    setAnswers(nextAnswers);

    // If this multi-select question also has an optional free text box,
    // keep user on current question to add custom input before advancing.
    if (q.freeText) {
      return;
    }

    setMultiSelected([]);
    advanceQuestion(nextAnswers);
  };

  const submitFreeText = () => {
    const q = currentQ;
    if (!q) return;
    let nextValue: string | string[] = freeAnswer;
    if (q.multiSelect) {
      const custom = freeAnswer.trim();
      nextValue = custom
        ? [...multiSelected, custom]
        : [...multiSelected];
    }
    const nextAnswers = { ...answers, [q.key]: nextValue };
    setAnswers(nextAnswers);
    setFreeAnswer("");
    setMultiSelected([]);
    advanceQuestion(nextAnswers);
  };

  const submitDropdownAnswer = () => {
    const q = currentQ;
    if (!q || !q.dropdown) return;
    const selected = String(answers[q.key] || "").trim();
    if (!selected) return;
    const nextAnswers = { ...answers, [q.key]: selected };
    setAnswers(nextAnswers);
    advanceQuestion(nextAnswers);
  };

  const skipQuestion = () => advanceQuestion();

  const goToPreviousQuestion = () => {
    if (qPos <= 0) return;
    setQPos(prev => prev - 1);
  };

  const editQuestions = () => {
    const currentAnswers = { ...answers };
    const queue = QUESTIONS
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => q.key !== "websitePages" || currentAnswers.buildType === "Website")
      .filter(({ q }) => q.key !== "websiteLayout" || currentAnswers.buildType === "Website")
      .filter(({ q }) => q.key !== "productName" || currentAnswers.specificProduct === "Yes")
      .map(({ idx }) => idx);
    setQuestionQueue(queue);
    setQPos(0);
    setPhase("questions");
  };

  const buildFallbackBrief = (answerSet: QAnswers): BriefData => {
    const normalizedAnswers = normalizeAnswerSet(answerSet);
    const buildType = (normalizedAnswers.buildType as string) || ws.prelim.buildType || "Webpage";
    const aud = Array.isArray(normalizedAnswers.audience) ? normalizedAnswers.audience[0] : (normalizedAnswers.audience as string) || ws.prelim.audience || "Audience";
    const region = (normalizedAnswers.region as string) || ws.user?.country || "Global";
    const section = "Main Page";
    const themes = extractListLines(String(normalizedAnswers.themesTopics || "")).slice(0, 8);
    const selectedPageOptions = Array.isArray(normalizedAnswers.websitePages)
      ? normalizedAnswers.websitePages.map(v => String(v).trim()).filter(Boolean)
      : [];
    const fileNames = uploadedFiles.map(f => `${f.name} (${f.sourceType})`).join(", ");
    const regulatory = String(normalizedAnswers.evidenceAndDisclaimers || "").trim();
    const promptLines = extractListLines(prompt);
    const explicitRequirements = promptLines
      .filter((line) => /^[-*•]/.test(line) || /:\s/.test(line))
      .map((line) => line.replace(/^[-*•\s]+/, "").trim())
      .filter((line) => line.length > 8)
      .slice(0, 12);
    const projectSeed = prompt || "Clear, compliant communication for the target audience.";
    const sourceAnchors = [...themes, ...explicitRequirements].slice(0, 10);

    const inferredSections = sourceAnchors
      .map((line) => sanitizeSectionTitle(line))
      .filter(Boolean)
      .filter((line, idx, arr) => arr.findIndex((x) => x.toLowerCase() === line.toLowerCase()) === idx)
      .slice(0, 6);

    const bestSections = inferredSections.length > 0
      ? inferredSections
      : [
          "Condition Overview and Support Goals",
          "Treatment Journey and Week-by-Week Expectations",
          "MHRA-Approved Safety and Side Effect Guidance",
          "Daily Diary and Downloadable Resources",
          "Patient Stories and UK Support Services",
          "Help, Helpline, and Next Steps",
        ];

    return {
      projectTitle: `${buildType}: ${section}`,
      goal: `Create a practical patient-support hub for ${aud} in ${region} with clear MHRA-aligned guidance, weekly treatment clarity, and actionable support resources.`,
      audience: `${aud} in ${region}. Keep language clear, specific, and compliant for this audience type.`,
      keyMessages: bestSections,
      contentSections: bestSections,
      toneAndStyle: "Clear, concise, and compliant Company Name tone. Avoid promotional exaggeration; keep user-first language.",
      informationFromSources: [
        fileNames ? `User-provided documents/links: ${fileNames}` : "No supporting documents or links were uploaded; brief is grounded in prompt and ideation inputs only.",
        regulatory ? `Regulatory/clinical inputs: ${regulatory}` : "No regulatory/clinical evidence block provided.",
      ].join("\n"),
      inspiration: [
        `Prompt intelligence refinement: audience tuned for ${aud} in ${region}.`,
        regulatory ? "Applied guardrails for regulated medical content and approved-claim discipline." : "Applied standard Company Name compliance framing.",
        "Structured the brief for a clear, scannable website journey.",
      ].join(" "),
    };
  };

  const advanceQuestion = (nextAnswers: QAnswers = answers) => {
    if (qPos < questionQueue.length - 1) {
      setQPos(qPos + 1);
      setFreeAnswer("");
      setMultiSelected([]);
    } else {
      runCensorCheck(nextAnswers);
    }
  };

  const buildFullPrompt = (answerSet: QAnswers) => {
    return JSON.stringify(buildGenerationInput(answerSet), null, 2);
  };

  /* ── Silent censorship check (PIE) ── */
  const runCensorCheck = async (answerSet: QAnswers = answers) => {
    const normalizedAnswers = normalizeAnswerSet(answerSet);
    setPhase("checking");
    ws.setLoading(true);
    setCensorWarning(null);

    try {
      const fullPrompt = buildFullPrompt(normalizedAnswers);
      const audience = Array.isArray(normalizedAnswers.audience) ? normalizedAnswers.audience[0] : (normalizedAnswers.audience as string) || "";
      const pieResult = await Promise.race([
        invokeProtectedWithRetry<Record<string, unknown>, PIEResult>("pie-classify", {
            brief: fullPrompt,
            country: (normalizedAnswers.region as string) || ws.user?.country || "",
            audience,
            buildType: (normalizedAnswers.buildType as string) || "",
          }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("PIE classification timeout after retries")), 18000)),
      ]);

      ws.setPieResult(pieResult);
      ws.setPrelim({ buildType: (normalizedAnswers.buildType as string) || null, audience: audience || null });
      appendAuditEvent({
        eventType: "pie_run",
        actor: ws.user?.email || "unknown-user",
        details: {
          pie_score: pieResult.pie_score,
          pie_grade: pieResult.pie_grade,
          audience: pieResult.audience?.audience,
          jurisdiction: pieResult.jurisdiction?.body,
          risk_level: pieResult.risk?.level,
          country: (normalizedAnswers.region as string) || ws.user?.country || "",
          buildType: (normalizedAnswers.buildType as string) || "",
        },
      });

      // Ideation only runs censorship checks in the background; flags are handled in Builder final checks.
      await generateBrief(pieResult, normalizedAnswers);
    } catch (err: any) {
      toast.error(err.message || "PIE classification failed");
      setPhase("input");
    } finally {
      ws.setLoading(false);
    }
  };

  /* ── Generate structured brief ── */
  const generateBrief = async (pieResult: PIEResult, answerSet: QAnswers = answers) => {
    ws.setActiveAgent(2);
    try {
      const normalizedAnswers = normalizeAnswerSet(answerSet);
      const generationInput = buildGenerationInput(normalizedAnswers);

      // Persist the actual uploaded source text (with the user's requested
      // specifics like fees) so the downstream enrichment step can use it too,
      // not just the brief's summary.
      const combinedSourceText = uploadedFiles
        .map(f => `# ${f.name} (${f.sourceType})\n${(f.content || "").slice(0, 4000)}`)
        .join("\n\n")
        .slice(0, 12000);
      ws.setSourceText(combinedSourceText);

      const brief = await Promise.race([
        invokeProtectedWithRetry<Record<string, unknown>, BriefData>("generate-brief", {
            enrichedPrompt: pieResult.enriched_prompt,
            pieContext: {
              audience: pieResult.audience,
              jurisdiction: pieResult.jurisdiction,
              risk: pieResult.risk,
              tone: pieResult.tone,
              readability: pieResult.readability,
              breakdown: pieResult.breakdown,
              score: {
                pie_score: pieResult.pie_score,
                pie_grade: pieResult.pie_grade,
                interpretation: pieResult.pie_interpretation,
              },
            },
            generationInput,
            rawPrompt: prompt,
            fullPrompt: buildFullPrompt(normalizedAnswers),
            ideationAnswers: normalizedAnswers,
            sourceContext: uploadedFiles.map(f => ({
              name: f.name,
              sourceType: f.sourceType,
              source: f.source,
              excerpt: f.content.slice(0, 3000),
            })),
            buildType: (normalizedAnswers.buildType as string) || ws.prelim.buildType,
            audience: Array.isArray(normalizedAnswers.audience) ? normalizedAnswers.audience[0] : (normalizedAnswers.audience as string) || ws.prelim.audience,
            country: (normalizedAnswers.region as string) || ws.user?.country,
          }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Brief generation timeout after retries")), 35000)),
      ]);

      if (!brief) throw new Error("Brief generation failed");
      const fileNameList = uploadedFiles.map(f => `${f.name} (${f.sourceType})`).join(", ");
      const existingSources = brief.informationFromSources || brief.inspiration || "";
      const normalizedBrief: BriefData = {
        ...brief,
        keyMessages: Array.isArray(brief.contentSections) && brief.contentSections.length > 0
          ? brief.contentSections
          : (Array.isArray(brief.keyMessages) ? brief.keyMessages : []),
        contentSections: Array.isArray(brief.contentSections) && brief.contentSections.length > 0
          ? brief.contentSections
          : (Array.isArray(brief.keyMessages) ? brief.keyMessages : []),
        toneAndStyle: brief.toneAndStyle || "Clear, concise, and compliant Company Name tone. Avoid promotional exaggeration; keep user-first language.",
        informationFromSources: (/user-provided documents/i.test(existingSources))
          ? existingSources
          : fileNameList
            ? `User-provided documents/links: ${fileNameList}${existingSources && !existingSources.match(/No supporting documents/i) ? `\n${existingSources}` : ""}`
            : (existingSources || "No source summary was generated."),
      };

      ws.setCurrentBrief(normalizedBrief);
      ws.addBriefVersion(prompt, normalizedBrief);
      appendAuditEvent({
        eventType: "brief_generated",
        actor: ws.user?.email || "unknown-user",
        details: {
          projectTitle: normalizedBrief.projectTitle,
          audience: (normalizedAnswers.audience as string) || ws.prelim.audience,
          buildType: (normalizedAnswers.buildType as string) || ws.prelim.buildType,
        },
      });
      ws.goToStep(2);
    } catch (err: any) {
      toast.error(err.message || "Brief generation failed");
      setPhase("input");
    } finally {
      ws.setActiveAgent(null);
    }
  };

  const currentQuestionIndex = questionQueue[qPos] ?? 0;
  const currentQ = QUESTIONS[currentQuestionIndex];
  const progressPct = phase === "questions"
    ? ((qPos + 1) / Math.max(1, questionQueue.length)) * 100
    : phase === "brief"
      ? 100
      : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-up">
      {/* Top bar */}
      <div className="bg-card border-b border-border px-4 py-1.5 flex items-center gap-2.5 flex-shrink-0">
        <div className="text-[13px] font-semibold text-pf-dark flex-1">Share your ideas</div>
      </div>

      <div className="flex-1 overflow-y-auto bg-card">
        {/* ── Phase: Input ── */}
        {phase === "input" && (
          <div className="py-8 px-6 max-w-6xl mx-auto">
            <h3 className="font-serif text-xl text-pf-dark mb-1">Describe your project</h3>
            <p className="text-[13px] text-muted-foreground mb-5">
              Start with project context and add supporting content. Use this form to define the content intent, audience, evidence, and structure.
            </p>
            <StepGuide
              step={1}
              role="Content owner / requester"
              instruction="Tell the AI what you want to build. The more context you provide, the better the output - think of this as your creative brief."
              actions={[
                "Type your prompt describing the goal, topics, and any key data points",
                "Upload supporting PDFs, documents, or images (max 8 MB each)",
                "Paste a link to an existing webpage you want to reference or update",
                "Fill in the Ideation form to set audience, region, tone, and page structure",
              ]}
              nextStep="The AI will analyse your brief, score its quality, and present findings for your review before generating any content."
              variant="info"
            />

            {/* Censor warning */}
            {censorWarning && (
              <div className="bg-destructive/8 border-[1.5px] border-destructive/30 rounded-lg p-3.5 mb-4 flex items-start gap-2.5 animate-fade-up">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-destructive mb-0.5">Content flagged</div>
                  <div className="text-[12px] text-destructive/80">{censorWarning}</div>
                </div>
                <button onClick={() => setCensorWarning(null)} className="ml-auto text-destructive/50 hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            <div className="space-y-6 max-w-4xl">
              {/* ── Step 1: Ideation form ── */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-pf">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-[12px] font-extrabold flex items-center justify-center flex-shrink-0">1</div>
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground leading-none">Step 1</div>
                    <h4 className="font-serif text-lg text-pf-dark leading-tight">Ideation form</h4>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-[12px] font-semibold text-pf-dark mb-2">Who is the primary audience?</div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(QUESTIONS.find(q => q.key === "audience")?.options || []).map((option) => {
                        const selected = getAnswerString("audience") === option;
                        return (
                          <button
                            key={option}
                            onClick={() => setAnswerValue("audience", option)}
                            className={cn(
                              "px-3 py-2 rounded-lg border text-[12px] font-semibold transition-colors",
                              selected ? "bg-primary border-primary text-primary-foreground" : "bg-secondary border-border text-foreground hover:border-primary"
                            )}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {getAnswerString("buildType") === "Website" && (
                    <div>
                      <div>
                        <div className="text-[12px] font-semibold text-pf-dark mb-2">Website pages</div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {(QUESTIONS.find(q => q.key === "websitePages")?.options || []).map((option) => {
                            const selected = getAnswerArray("websitePages").includes(option);
                            return (
                              <button
                                key={option}
                                onClick={() => toggleMultiAnswer("websitePages", option)}
                                className={cn(
                                  "px-3 py-2 rounded-lg border text-[12px] font-semibold transition-colors",
                                  selected ? "bg-primary border-primary text-primary-foreground" : "bg-secondary border-border text-foreground hover:border-primary"
                                )}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                        <textarea
                          value={getAnswerString("websitePagesOther")}
                          onChange={e => setAnswerValue("websitePagesOther", e.target.value)}
                          placeholder="Optional custom page names&#10;Home&#10;About&#10;Contact"
                          className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-[12px] outline-none focus:border-primary min-h-[88px] resize-none"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-[12px] font-semibold text-pf-dark mb-2">Region</div>
                    <select
                      value={getAnswerString("region")}
                      onChange={e => setAnswerValue("region", e.target.value)}
                      className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-[12px] outline-none focus:border-primary"
                    >
                      <option value="">Select target region…</option>
                      {(QUESTIONS.find(q => q.key === "region")?.options || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="text-[12px] font-semibold text-pf-dark mb-2">Specific product, drug, or therapy?</div>
                    <div className="flex gap-2">
                      {["No", "Yes"].map((option) => {
                        const selected = getAnswerString("specificProduct") === option;
                        return (
                          <button
                            key={option}
                            onClick={() => setAnswerValue("specificProduct", option)}
                            className={cn(
                              "px-3 py-2 rounded-lg border text-[12px] font-semibold transition-colors",
                              selected ? "bg-primary border-primary text-primary-foreground" : "bg-secondary border-border text-foreground hover:border-primary"
                            )}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {getAnswerString("specificProduct") === "Yes" && (
                    <div>
                      <div className="text-[12px] font-semibold text-pf-dark mb-2">Product / therapy name</div>
                      <textarea
                        value={getAnswerString("productName")}
                        onChange={e => setAnswerValue("productName", e.target.value)}
                        placeholder="e.g. New oncology drug XYZ-123"
                        className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-[12px] outline-none focus:border-primary min-h-[72px] resize-none"
                      />
                    </div>
                  )}

                </div>
              </div>

              {/* ── Step 2: Prompt Bar ── */}
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-[12px] font-extrabold flex items-center justify-center flex-shrink-0">2</div>
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground leading-none">Step 2</div>
                    <h4 className="font-serif text-lg text-pf-dark leading-tight">Prompt Bar</h4>
                  </div>
                </div>
                <div className="bg-secondary border-[1.5px] border-border rounded-lg p-3 focus-within:border-primary focus-within:bg-card transition-all">
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder={"What are you building?  What are the core themes and topics? Input relevant clinical, research, regulatory data, disclaimers, or metrics."}
                    className="w-full bg-transparent border-none outline-none text-[13px] text-foreground resize-none min-h-[220px] max-h-[320px] leading-relaxed"
                  />
                  <span className="text-[11px] text-muted-foreground/50">
                    {uploadedFiles.length > 0 ? `${uploadedFiles.length} source item(s) attached` : "Add documents, links, and questionnaire context for a more specific brief"}
                  </span>
                </div>
              </div>

              {/* ── Optional Step: Materials and Link ── */}
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-full bg-pf-sky text-pf-dark text-[15px] font-extrabold flex items-center justify-center flex-shrink-0">+</div>
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground leading-none">Optional Step</div>
                    <h4 className="font-serif text-lg text-pf-dark leading-tight">Materials and Link</h4>
                  </div>
                </div>

                {/* Upload Terms */}
                <div className="mb-3 border border-border rounded-lg p-4 bg-secondary/40">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="upload-terms"
                      checked={uploadTermsAccepted}
                      onChange={e => setUploadTermsAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0 cursor-pointer"
                    />
                    <label htmlFor="upload-terms" className="text-[12px] text-muted-foreground leading-relaxed cursor-pointer">
                      <span className="font-semibold text-foreground block mb-0.5">Material Upload Agreement</span>
                      By uploading materials, I confirm that the content is approved for professional use, complies with applicable data privacy regulations (including GDPR), does not contain personally identifiable information without consent, and adheres to Company Name’s intellectual property and compliance guidelines. I take responsibility for ensuring all uploaded materials are accurate and fit for purpose.
                    </label>
                  </div>
                </div>

                <input ref={fileInputRef} type="file" multiple accept=".ppt,.pptx,.pdf,.csv,.doc,.docx,.txt" onChange={handleFileUpload} className="hidden" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  {/* Materials upload */}
                  <div
                    onClick={() => uploadTermsAccepted ? fileInputRef.current?.click() : toast.warning("Please accept the Material Upload Agreement above before uploading.")}
                    className={cn(
                      "border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:bg-pf-mist/50 transition-all h-full flex flex-col justify-center",
                      !uploadTermsAccepted && "opacity-50"
                    )}
                  >
                    <Upload className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
                    <div className="text-xs font-semibold text-muted-foreground">Upload supporting documents</div>
                    <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                      Allowed formats: PPT/PPTX, PDF, CSV, DOC/DOCX, TXT - max 5MB per file. No images in Ideation. Text extraction supports TXT/CSV/PDF/DOCX; unsupported files fall back to metadata mode. Please note that scanned or image-only PDFs contain no selectable text, so their content cannot be read; kindly upload a text-based document to ensure your details are captured.
                    </div>
                  </div>

                  {/* Add existing webpage link */}
                  <div className="border border-border rounded-lg p-3 bg-secondary/40">
                    <div className="text-[11px] font-semibold text-muted-foreground mb-2">Add existing webpage link</div>
                    <div className="grid grid-cols-1 gap-2">
                      <input
                        value={webpageLinkName}
                        onChange={e => setWebpageLinkName(e.target.value)}
                        placeholder="Link name (required)"
                        className="w-full bg-card border border-border rounded-md px-3 py-2 text-[12px] outline-none focus:border-primary"
                      />
                      <div className="flex gap-2">
                        <input
                          value={webpageLink}
                          onChange={e => setWebpageLink(e.target.value)}
                          placeholder="https://existing-site/page"
                          className="flex-1 bg-card border border-border rounded-md px-3 py-2 text-[12px] outline-none focus:border-primary"
                        />
                        <button
                          onClick={addWebpageLink}
                          disabled={!webpageLink.trim() || !webpageLinkName.trim() || !uploadTermsAccepted}
                          className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-[11px] font-semibold disabled:opacity-40"
                        >
                          <Link2 className="w-3 h-3 inline mr-1" /> Add Link
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {uploadedFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-pf-mist border border-pf-sky rounded-full px-3 py-1">
                        {f.sourceType === "document" ? <FileText className="w-3 h-3 text-primary" /> : <Link2 className="w-3 h-3 text-primary" />}
                        <span className="text-[11px] font-medium text-pf-dark">{f.name}</span>
                        <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 border-t border-border pt-4 flex items-center justify-end">
              <button
                onClick={handleStartQuestions}
                disabled={!prompt.trim() && uploadedFiles.length === 0}
                className="bg-primary text-primary-foreground rounded-md px-5 py-2 text-xs font-semibold hover:bg-pf-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Send className="w-3 h-3" /> Generate Brief
              </button>
            </div>
          </div>
        )}

        {/* ── Phase: Lego Questions ── */}
        {phase === "questions" && currentQ && (
          <div className="py-10 px-8 max-w-2xl mx-auto animate-fade-up">
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-8">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-[11px] font-bold text-muted-foreground">{qPos + 1}/{questionQueue.length}</span>
            </div>

            {/* Question card */}
            <div className="bg-card border border-border rounded-xl p-8 shadow-pf mb-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground text-sm font-extrabold flex items-center justify-center flex-shrink-0">
                  {qPos + 1}
                </div>
                <h3 className="font-serif text-lg text-pf-dark">{currentQ.question}</h3>
              </div>
              {currentQ.subtitle && (
                <p className="text-[12px] text-muted-foreground ml-12 mb-4">{currentQ.subtitle}</p>
              )}

              {/* Options (chips) */}
              {currentQ.dropdown && currentQ.options && (
                <div className="ml-12 mb-4">
                  <select
                    value={String(answers[currentQ.key] || "")}
                    onChange={e => setAnswers(prev => ({ ...prev, [currentQ.key]: e.target.value }))}
                    className="w-full bg-secondary border-[1.5px] border-border rounded-lg p-3 text-sm text-foreground outline-none focus:border-primary transition-colors"
                  >
                    <option value="">Select target region…</option>
                    {currentQ.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <button
                    onClick={submitDropdownAnswer}
                    disabled={!String(answers[currentQ.key] || "").trim()}
                    className="mt-2 bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5"
                  >
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {currentQ.options && !currentQ.dropdown && (
                <div className="flex flex-wrap gap-3 mb-6 ml-12">
                  {currentQ.options.map(opt => {
                    const isSelected = currentQ.multiSelect
                      ? multiSelected.includes(opt)
                      : answers[currentQ.key] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => answerOption(opt)}
                        className={cn(
                          "px-5 py-3 rounded-lg border-[1.5px] text-sm font-medium transition-all",
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground shadow-sm"
                            : "bg-card border-border text-foreground hover:border-primary hover:text-primary"
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 inline mr-1.5" />}
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Multi-select confirm */}
              {currentQ.multiSelect && multiSelected.length > 0 && (
                <div className="ml-12">
                  <button
                    onClick={confirmMultiSelect}
                    className="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5"
                  >
                    Confirm ({multiSelected.length} selected) <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Free text */}
              {currentQ.freeText && (
                <div className="ml-12">
                  <textarea
                    value={freeAnswer}
                    onChange={e => setFreeAnswer(e.target.value)}
                    placeholder={currentQ.placeholder || "Type your answer…"}
                    className="w-full bg-secondary border-[1.5px] border-border rounded-lg p-4 text-sm text-foreground resize-none min-h-[140px] outline-none focus:border-primary transition-colors"
                  />
                  <button
                    onClick={submitFreeText}
                    disabled={!freeAnswer.trim()}
                    className="mt-2 bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5"
                  >
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-1">
              <div className="flex gap-3">
                <button
                  onClick={() => setPhase("input")}
                  className="text-xs font-semibold text-muted-foreground hover:text-primary"
                >
                  Back to prompt writing
                </button>
                <button
                  onClick={goToPreviousQuestion}
                  disabled={qPos === 0}
                  className="text-xs font-semibold text-muted-foreground hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Back to previous question
                </button>
              </div>
              <button
                onClick={skipQuestion}
                className="text-xs font-semibold text-muted-foreground hover:text-primary"
              >
                Skip this question
              </button>
            </div>
          </div>
        )}

        {/* ── Phase: Checking (loading) ── */}
        {phase === "checking" && (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center animate-fade-up">
              <div className="inline-flex items-center gap-3 bg-pf-mist border border-pf-sky rounded-xl px-6 py-5 shadow-pf">
                <div className="flex gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <div>
                  <div className="text-sm text-pf-dark font-semibold">Preparing your brief…</div>
                  <div className="text-[11px] text-muted-foreground">Checking content quality and generating structure</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default BriefEditorPanel;
