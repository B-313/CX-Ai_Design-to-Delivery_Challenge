import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { formatRagContext, retrievePharmaContext } from "../_shared/pharmaRag.ts";
import { requireApiKey } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = requireApiKey(req, corsHeaders);
  if (authError) return authError;

  try {
    const { enrichedPrompt, pieContext, buildType, audience, country, rawPrompt, ideationAnswers, sourceContext } = await req.json();

    if (!enrichedPrompt) return new Response(JSON.stringify({ error: "Enriched prompt required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!pieContext || typeof pieContext !== "object") return new Response(JSON.stringify({ error: "PIE context required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    const questionnaireAnswers = (ideationAnswers && typeof ideationAnswers === "object" && !Array.isArray(ideationAnswers)) ? ideationAnswers as Record<string, unknown> : {};
    const sources = Array.isArray(sourceContext) ? sourceContext : [];

    const ragChunks = await retrievePharmaContext(`${enrichedPrompt}\n${JSON.stringify(questionnaireAnswers)}\n${buildType || ""}\n${audience || ""}\n${country || ""}`);
    if (!ragChunks || ragChunks.length === 0) throw new Error("RAG retrieval failed");
    const ragContext = formatRagContext(ragChunks);

    const sourceSummary = sources.length > 0
      ? sources.slice(0, 6).map((s: { name?: string; source?: string; url?: string; excerpt?: string; sourceType?: string }, i: number) =>
          `Source ${i + 1}: ${s.name || "Unnamed"}\n${s.sourceType === "link" ? `URL: ${s.url || ""}` : `File: ${s.source || ""}`}\nExcerpt: ${(s.excerpt || "").slice(0, 1000)}`
        ).join("\n\n")
      : "No user-provided sources supplied";

    const answerSummary = Object.entries(questionnaireAnswers).length > 0
      ? Object.entries(questionnaireAnswers)
          .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : Boolean(v)))
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
          .join("\n")
      : "No questionnaire answers supplied";

    const tools = [{
      type: "function",
      function: {
        name: "generate_brief",
        description: "Generate a structured website brief",
        parameters: {
          type: "object",
          properties: {
            projectTitle: { type: "string" },
            goal: { type: "string" },
            audience: { type: "string" },
            contentSections: { type: "array", items: { type: "string" }, description: "4-6 items, each as 'Section title - short purpose'" },
            toneAndStyle: { type: "string", description: "Voice and readability guidance only" },
            informationFromSources: { type: "string", description: "Summary of user-provided documents/links only" },
            inspiration: { type: "string", description: "How PIE and RAG context shaped the brief" },
          },
          required: ["projectTitle", "goal", "audience", "contentSections", "toneAndStyle", "informationFromSources", "inspiration"],
          additionalProperties: false,
        },
      },
    }];

    const userMessage = `Generate a content brief for a ${buildType || "webpage"} targeting ${audience || "patients"} in ${country || "Global"}.

=== RAW PROMPT ===
${rawPrompt || enrichedPrompt}

=== QUESTIONNAIRE ANSWERS ===
${answerSummary}

=== PIE ANALYSIS ===
${JSON.stringify(pieContext, null, 2)}

=== PHARMACEUTICAL COMPANY RAG CONTEXT ===
${ragContext}

=== USER SOURCES ===
${sourceSummary}

Rules: contentSections must be 4-6 items each as "Section title - short purpose". Do not invent claims not present in the inputs. If the raw prompt or user sources explicitly ask for specific content (for example fees, pricing, opening hours, contact details, locations, or eligibility), you MUST dedicate a section to it and carry the exact details into informationFromSources. Never drop a specific the user explicitly requested.`;

    let parsed: Record<string, unknown> | null = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await callGroqWithRetry({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are a web briefing engine. Generate a specific, grounded content brief. Call the generate_brief tool." },
          { role: "user", content: userMessage },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "generate_brief" } },
      }, GROQ_API_KEY);

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("Brief generation failed");
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) throw new Error("No structured response from AI");

      const candidate = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      const sections = Array.isArray(candidate.contentSections) ? candidate.contentSections : [];
      if (sections.length >= 4 && sections.length <= 6) { parsed = candidate; break; }
      if (attempt === 2) parsed = candidate;
    }

    if (!parsed) throw new Error("Failed to generate brief");
    if (Array.isArray(parsed.contentSections)) parsed.keyMessages = parsed.contentSections;

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-brief error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
