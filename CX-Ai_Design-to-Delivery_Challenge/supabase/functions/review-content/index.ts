import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { formatRagContext, retrievePharmaContext } from "../_shared/pharmaRag.ts";
import { requireApiKey } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = requireApiKey(req, corsHeaders);
  if (authError) return authError;

  try {
    const { brief, buildType, audience, country } = await req.json();
    if (!brief) return new Response(JSON.stringify({ error: "Brief required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    const briefText = typeof brief === "string"
      ? brief
      : Object.entries(brief).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n");

    const ragChunks = await retrievePharmaContext(`${briefText}\n${buildType || ""}\n${audience || ""}\n${country || ""}`);
    const ragContext = formatRagContext(ragChunks);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are a pharma content quality reviewer for a ${buildType || "webpage"} targeting ${audience || "patients"} in ${country || "Global"}.

Use this compliance and brand context to calibrate your review:
${ragContext}

=== SCORING RUBRIC (0-100 per dimension) ===

compliance (regulatory safety):
- 90-100: No absolute/unqualified claims, no self-diagnosis language, includes appropriate caveats, safe CTA language
- 70-89: Minor unqualified claims, generally safe language
- 50-69: Some absolute claims ("only", "always cures", "guaranteed"), missing caveats
- Below 50: Multiple unqualified efficacy claims, dangerous self-diagnosis CTAs, unsupported statistics

grammar (language quality):
- 90-100: Clear sentences, consistent tense, no errors, active voice, short paragraphs
- 70-89: Occasional passive voice or wordiness, minor errors
- 50-69: Unclear sentences, inconsistent tense, readability issues
- Below 50: Multiple grammar errors, very long run-on sentences, confusing structure

brandVoice (pharma brand standards):
- 90-100: Outcome-led headlines, patient-centred tone, plain language, no hype words, evidence-grounded
- 70-89: Mostly plain language, minor hype terms
- 50-69: Some hype ("revolutionary", "breakthrough"), disease-first rather than outcome-first framing
- Below 50: Heavy hype language, not patient-centred, corporate/promotional tone

accessibility (WCAG 2.1 AA / plain language):
- 90-100: Short sentences (<20 words avg), Grade 8 or below readability, avoids jargon, clear headings
- 70-89: Mostly readable, occasional long sentences or medical jargon
- 50-69: Frequent jargon, long complex sentences, poor heading structure
- Below 50: Inaccessible to intended audience, heavy medical terminology throughout

overallScore: weighted average - compliance 35%, grammar 20%, brandVoice 30%, accessibility 15%

For issues: only flag real problems. If a dimension scores 85+, report zero issues for it.

Call the review_content tool with your findings.`,
          },
          { role: "user", content: briefText },
        ],
        tools: [{
          type: "function",
          function: {
            name: "review_content",
            description: "Return structured review results",
            parameters: {
              type: "object",
              properties: {
                overallScore: { type: "number" },
                complianceIssues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      severity: { type: "string", enum: ["high", "medium", "low"] },
                      field: { type: "string" },
                      contentSnippet: { type: "string" },
                      issue: { type: "string" },
                      recommendation: { type: "string" },
                    },
                    required: ["id", "severity", "field", "contentSnippet", "issue", "recommendation"],
                    additionalProperties: false,
                  },
                },
                grammarIssues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      severity: { type: "string", enum: ["high", "medium", "low"] },
                      field: { type: "string" },
                      contentSnippet: { type: "string" },
                      issue: { type: "string" },
                      recommendation: { type: "string" },
                    },
                    required: ["id", "severity", "field", "contentSnippet", "issue", "recommendation"],
                    additionalProperties: false,
                  },
                },
                scores: {
                  type: "object",
                  properties: {
                    compliance: { type: "number" },
                    grammar: { type: "number" },
                    brandVoice: { type: "number" },
                    accessibility: { type: "number" },
                  },
                  required: ["compliance", "grammar", "brandVoice", "accessibility"],
                  additionalProperties: false,
                },
              },
              required: ["overallScore", "complianceIssues", "grammarIssues", "scores"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "review_content" } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Groq error:", response.status, text);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Review failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No structured response from AI");

    return new Response(toolCall.function.arguments, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("review-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
