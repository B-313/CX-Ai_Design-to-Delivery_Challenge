import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { formatRagContext, retrievePharmaContext } from "../_shared/pharmaRag.ts";
import { requireApiKey } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const JURISDICTION_MAP: Record<string, { body: string; framework: string; notes: string; gdpr: boolean }> = {
  "united kingdom": { body: "MHRA", framework: "Human Medicines Regulations 2012 + ABPI Code", notes: "Post-Brexit UK rules.", gdpr: true },
  "uk": { body: "MHRA", framework: "Human Medicines Regulations 2012 + ABPI Code", notes: "Post-Brexit UK rules.", gdpr: true },
  "eu": { body: "EMA", framework: "Directive 2001/83/EC", notes: "EU-wide medicinal promotion requirements.", gdpr: true },
  "germany": { body: "EMA + BfArM", framework: "Directive 2001/83/EC + AMG", notes: "HWG for pharma advertising.", gdpr: true },
  "france": { body: "EMA + ANSM", framework: "Directive 2001/83/EC + CSP", notes: "ANSM oversees French pharma.", gdpr: true },
  "spain": { body: "EMA + AEMPS", framework: "Directive 2001/83/EC + RD 1345/2007", notes: "AEMPS is Spanish regulator.", gdpr: true },
  "italy": { body: "EMA + AIFA", framework: "Directive 2001/83/EC + Decree 219/2006", notes: "AIFA governs Italian pharma.", gdpr: true },
  "united states": { body: "FDA", framework: "21 CFR Parts 201, 202", notes: "FDA requires fair balance.", gdpr: false },
  "usa": { body: "FDA", framework: "21 CFR Parts 201, 202", notes: "FDA oversight.", gdpr: false },
  "australia": { body: "TGA", framework: "Therapeutic Goods Advertising Code 2021", notes: "Strict health claims.", gdpr: false },
  "canada": { body: "Health Canada", framework: "Food and Drugs Act", notes: "No branded DTC for prescription drugs.", gdpr: false },
  "japan": { body: "PMDA", framework: "PMD Act 2014", notes: "PMDA + JPMA code.", gdpr: false },
  "global": { body: "WCAG 2.1 AA + GDPR", framework: "Safe global defaults", notes: "No specific country.", gdpr: true },
};

const HIGH_RISK = ["drug", "medicine", "medication", "pharmaceutical", "prescription", "clinical trial", "efficacy", "oncology", "cancer", "chemotherapy", "immunotherapy", "vaccine", "adverse event", "side effect", "contraindication", "dosage", "cure", "guaranteed"];
const MEDIUM_RISK = ["patient", "disease", "condition", "symptom", "treatment", "therapy", "healthcare", "medical", "clinical", "doctor", "physician", "prevention"];
const LOW_RISK = ["health", "wellness", "information", "resource", "support", "awareness", "education"];

const AUDIENCE_TARGETS: Record<string, { target: number; max: number; label: string }> = {
  patients: { target: 7, max: 8, label: "Plain language (Grade 7-8)" },
  "healthcare providers": { target: 11, max: 13, label: "Professional clinical (Grade 11-13)" },
  "channel partners": { target: 10, max: 11, label: "Business professional (Grade 10-11)" },
  "internal teams": { target: 10, max: 12, label: "Corporate professional (Grade 10-12)" },
};

const BRAND_VOICE_POSITIVE = ["patient", "evidence", "clinical", "science", "safe", "clear", "accessible", "compliant", "approved", "trust"];
const BRAND_VOICE_NEGATIVE = ["cheap", "best", "only", "guaranteed", "cure", "miracle", "revolutionary"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGroqWithRetry(payload: Record<string, unknown>, apiKey: string, attempts = 3) {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) return response;
      if (response.status === 429 || response.status >= 500) {
        if (attempt < attempts) { await sleep(attempt * 700); continue; }
      }
      const text = await response.text();
      throw new Error(`Groq error (${response.status}): ${text.slice(0, 300)}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
      if (attempt < attempts) await sleep(attempt * 700);
    }
  }
  throw lastError ?? new Error("Groq request failed");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word match so "grape" doesn't trigger "rape", "us" doesn't match
// "industry", etc. (the Scunthorpe problem).
function containsWord(text: string, term: string): boolean {
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(term)}(?![a-z0-9])`, "i").test(text);
}

function detectJurisdiction(brief: string, country: string) {
  const search = (brief + " " + country).toLowerCase().replace(/[^\w\s]/g, " ");
  let matched = null;
  let maxLen = 0;
  for (const key of Object.keys(JURISDICTION_MAP)) {
    if (containsWord(search, key) && key.length > maxLen) { matched = key; maxLen = key.length; }
  }
  if (matched) return { ...JURISDICTION_MAP[matched], country_detected: matched };
  return { body: "WCAG 2.1 AA + GDPR", framework: "Safe global defaults", notes: "No country detected.", gdpr: true, country_detected: null };
}

function scoreRisk(brief: string, jurisdiction: { body: string; gdpr: boolean }) {
  const text = brief.toLowerCase().replace(/[^\w\s]/g, " ");
  const highHits = HIGH_RISK.filter(t => containsWord(text, t));
  const medHits = MEDIUM_RISK.filter(t => containsWord(text, t));
  const lowHits = LOW_RISK.filter(t => containsWord(text, t));
  let score = Math.min(1, highHits.length * 0.20 + medHits.length * 0.08 + lowHits.length * 0.03);
  if (jurisdiction.body.includes("FDA")) score = Math.min(1, score * 1.15);
  else if (jurisdiction.body.includes("EMA") || jurisdiction.body.includes("MHRA")) score = Math.min(1, score * 1.10);
  score = Math.round(score * 1000) / 1000;
  const level = score >= 0.75 ? "HIGH" : score >= 0.4 ? "MEDIUM" : "LOW";
  const recs: string[] = [];
  if (level === "HIGH") {
    recs.push("Do NOT make unsubstantiated efficacy or safety claims");
    recs.push("Include a regulatory disclaimer");
    recs.push("Flag for Medical Affairs review before generation");
  } else if (level === "MEDIUM") {
    recs.push("Add a general medical disclaimer");
    recs.push("Ensure health claims are supported by references");
  } else {
    recs.push("Standard brand compliance check applies");
  }
  if (jurisdiction.gdpr) recs.push("GDPR: Cookie consent banner required");
  if (jurisdiction.body.includes("FDA")) recs.push("FDA fair balance: present risks with equal prominence to benefits");
  recs.push("Include patient safety language such as 'Talk to your doctor'");
  return { risk_score: score, level, triggers: highHits, medium_triggers: medHits, recommendations: recs };
}

function analyseTone(brief: string) {
  const t = brief.toLowerCase();
  const neg = BRAND_VOICE_NEGATIVE.filter(w => containsWord(t, w)).length;
  const pos = BRAND_VOICE_POSITIVE.filter(w => containsWord(t, w)).length;
  const score = Math.round(Math.max(0.3, Math.min(0.9, 0.6 + pos * 0.05 - neg * 0.1)) * 1000) / 1000;
  return { tone_score: score, inject_guidance: score < 0.65, label: score >= 0.70 ? "on-brand" : score >= 0.50 ? "borderline" : "off-brand" };
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:e)$/, "").match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function predictReadability(brief: string, audience: string) {
  // Split on sentence punctuation AND newlines so bullet/list briefs aren't
  // treated as one giant run-on sentence.
  const sentences = brief.split(/[.!?\n]+/).filter(s => s.trim());
  const words = brief.split(/\s+/).filter(Boolean);
  const wordCount = Math.max(words.length, 1);
  const avgSentLen = wordCount / Math.max(sentences.length, 1);
  // Flesch-Kincaid uses syllables-per-word, not characters-per-word.
  const syllablesPerWord = words.reduce((s, w) => s + countSyllables(w), 0) / wordCount;
  const predicted = Math.round(Math.max(1, Math.min(20, 0.39 * avgSentLen + 11.8 * syllablesPerWord - 15.59)) * 10) / 10;
  const targets = AUDIENCE_TARGETS[audience.toLowerCase()] || AUDIENCE_TARGETS.patients;
  const inject = predicted > targets.max;
  return {
    predicted_grade: predicted, target_grade: targets.target, target_label: targets.label, inject_simplify: inject,
    guidance: inject ? `Simplify to Grade ${targets.target}: shorter sentences, replace polysyllabic words.` : `Readability appropriate for ${audience} (Grade ${predicted} vs target ${targets.target})`,
  };
}

function calculateScore(audience: { confidence: number }, risk: { risk_score: number }, tone: { tone_score: number }, readability: { predicted_grade: number; target_grade: number }) {
  const compliance = Math.round((1 - risk.risk_score) * 100);
  const toneScore = Math.round(tone.tone_score * 100);
  const audienceScore = Math.round(audience.confidence * 100);
  // Clinical/pharma briefs read at a higher grade because of unavoidable medical
  // vocabulary, so score the gap against the audience max (target + 1) with a
  // gentle slope and a sensible floor. Necessary terminology should not tank the
  // score; the simplify guidance already flags where to ease the reading level.
  const readabilityMax = readability.target_grade + 1;
  const gap = Math.max(0, readability.predicted_grade - readabilityMax);
  const readScore = Math.max(50, Math.round(100 - gap * 5));
  const pie = Math.round(compliance * 0.40 + toneScore * 0.30 + audienceScore * 0.20 + readScore * 0.10);
  const grade = pie >= 90 ? "A" : pie >= 75 ? "B" : pie >= 60 ? "C" : "D";
  const interp = pie >= 90 ? "Ready - strong signal quality" : pie >= 75 ? "Proceed - minor enrichments applied" : pie >= 60 ? "Caution - review recommendations" : "High risk - human review needed";
  return { pie_score: pie, pie_grade: grade, pie_interpretation: interp, breakdown: { compliance, tone: toneScore, audience: audienceScore, readability: readScore } };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = requireApiKey(req, corsHeaders);
  if (authError) return authError;

  try {
    const { brief, country, audience: audHint, buildType } = await req.json();
    if (!brief) return new Response(JSON.stringify({ error: "Brief required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    // ── Sensemaker: interpret ambiguous brief into clear intent ──
    const sensemakerResponse = await callGroqWithRetry({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a Sensemaker for a pharma/healthcare web platform. Your job is to read a user's brief - which may be vague, incomplete, or ambiguous - and extract clear, structured intent. Call the sensemaker tool.",
        },
        {
          role: "user",
          content: `Brief: "${brief}"\nCountry hint: "${country || "not specified"}"\nBuild type hint: "${buildType || "not specified"}"`,
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "sensemaker",
          description: "Extract clear intent from an ambiguous brief",
          parameters: {
            type: "object",
            properties: {
              interpreted_goal: { type: "string", description: "One clear sentence: what is this brief actually trying to achieve?" },
              inferred_audience: { type: "string", description: "Who this is most likely for, based on the content" },
              inferred_context: { type: "string", description: "Product, disease area, or topic being referenced, even if not named explicitly" },
              ambiguities: { type: "array", items: { type: "string" }, description: "List of things that are unclear or missing from the brief" },
              clarified_brief: { type: "string", description: "A rewritten version of the brief with gaps filled and intent made explicit" },
              confidence: { type: "number", description: "0 to 1 - how confident the interpretation is" },
            },
            required: ["interpreted_goal", "inferred_audience", "inferred_context", "ambiguities", "clarified_brief", "confidence"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "sensemaker" } },
    }, GROQ_API_KEY);

    let sensemaker = null;
    if (sensemakerResponse.ok) {
      const smData = await sensemakerResponse.json();
      const smTool = smData.choices?.[0]?.message?.tool_calls?.[0];
      if (smTool?.function?.arguments) {
        sensemaker = JSON.parse(smTool.function.arguments);
      }
    }

    // Use clarified brief downstream if Sensemaker succeeded
    const effectiveBrief = sensemaker?.clarified_brief || brief;

    const audResponse = await callGroqWithRetry({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "Classify the target audience for a pharma/healthcare website brief. Call the classify_audience tool." },
        { role: "user", content: `Brief: "${effectiveBrief}"\nUser audience hint: "${audHint || "none"}"` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "classify_audience",
          description: "Classify the target audience",
          parameters: {
            type: "object",
            properties: {
              audience: { type: "string", enum: ["patients", "healthcare providers", "channel partners", "internal teams"] },
              confidence: { type: "number", description: "0 to 1" },
              flag_for_review: { type: "boolean" },
              flag_reason: { type: "string" },
            },
            required: ["audience", "confidence", "flag_for_review"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "classify_audience" } },
    }, GROQ_API_KEY);

    if (!audResponse.ok) {
      if (audResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Audience classification failed");
    }

    const audData = await audResponse.json();
    const audTool = audData.choices?.[0]?.message?.tool_calls?.[0];
    if (!audTool?.function?.arguments) throw new Error("Audience classification did not return a structured response");
    const audienceResult = JSON.parse(audTool.function.arguments);

    const jurisdiction = detectJurisdiction(effectiveBrief, country || "");
    const risk = scoreRisk(effectiveBrief, jurisdiction);
    const tone = analyseTone(effectiveBrief);
    const readability = predictReadability(effectiveBrief, audienceResult.audience);
    const scoring = calculateScore(audienceResult, risk, tone, readability);

    const ragChunks = await retrievePharmaContext(`${effectiveBrief}\n${buildType || ""}\n${country || ""}\n${audHint || ""}`);
    if (!ragChunks || ragChunks.length === 0) throw new Error("RAG retrieval failed");
    const ragContext = formatRagContext(ragChunks);

    const enriched_prompt = JSON.stringify({
      role: "Senior web strategist",
      project_context: { buildType: buildType || null, country: country || null },
      pie_output: {
        audience: audienceResult,
        jurisdiction: { body: jurisdiction.body, framework: jurisdiction.framework, gdpr: jurisdiction.gdpr },
        risk: { level: risk.level, risk_score: risk.risk_score, triggers: risk.triggers, recommendations: risk.recommendations },
        tone: { label: tone.label, tone_score: tone.tone_score, inject_guidance: tone.inject_guidance },
        readability: { predicted_grade: readability.predicted_grade, target_grade: readability.target_grade, guidance: readability.guidance },
      },
      brand_rag_context: ragContext,
      user_request: brief,
    }, null, 2);

    return new Response(JSON.stringify({
      ...scoring, audience: audienceResult, jurisdiction, risk, tone, readability, rag_context: ragContext, enriched_prompt, sensemaker,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("pie-classify error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
