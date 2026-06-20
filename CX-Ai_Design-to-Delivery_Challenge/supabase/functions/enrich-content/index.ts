import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { retrievePharmaContext } from "../_shared/pharmaRag.ts";
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
    const { brief, buildType, audience, country, sourceContext } = await req.json();
    const sourceText = typeof sourceContext === "string" ? sourceContext.trim().slice(0, 12000) : "";

    if (!brief || typeof brief !== "object") {
      return new Response(JSON.stringify({ error: "Brief object required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    const sections: string[] = brief.contentSections || brief.keyMessages || [];

    // Always retrieve brand/tone chunks directly - don't rely on Jaccard to surface them
    // (Jaccard keyword overlap scores brand rules low for clinical queries)
    const BRAND_SOURCE_KEYWORDS = ["brand", "digital best practice", "substantiation"];
    const allRagChunks = await retrievePharmaContext(
      `${brief.goal || ""} ${brief.audience || ""} ${brief.toneAndStyle || ""} ${buildType || ""} ${country || ""} patient content`
    );
    // Also force-include brand guide chunks via a second direct query
    const brandQueryChunks = await retrievePharmaContext("brand guide patient plain language outcome headline cta");
    const allChunks = [...allRagChunks, ...brandQueryChunks];
    // Deduplicate by id
    const seenIds = new Set<string>();
    const ragChunks = allChunks.filter(c => { if (seenIds.has(c.id)) return false; seenIds.add(c.id); return true; });

    const brandChunks = ragChunks.filter(c =>
      BRAND_SOURCE_KEYWORDS.some(kw => c.source.toLowerCase().includes(kw))
    );
    const regulatoryChunks = ragChunks.filter(c => !brandChunks.includes(c));

    const brandRules = brandChunks.length > 0
      ? brandChunks.map(c => `• ${c.text}`).join("\n")
      : "• Use clear, evidence-based, patient-centred language.\n• Avoid hype, absolute claims, and unsupported certainty.\n• Headlines should be outcome-led and benefit-focused.";

    const regulatoryConstraints = regulatoryChunks.length > 0
      ? regulatoryChunks.map(c => `[${c.source}] ${c.text}`).join("\n")
      : "";

    const sectionList = sections
      .map((s: string, i: number) => `Section ${i + 1}: ${s}`)
      .join("\n");

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
            content: `You are a pharma web content writer. Your job is to write real, specific webpage copy and not placeholders.

=== BRAND WRITING RULES (apply these to every word you write) ===
${brandRules}

=== WRITING CONSTRAINTS ===
- Audience: ${brief.audience || audience || "patients"}
- Region: ${country || "Global"}
- Tone from brief: ${brief.toneAndStyle || "clear, plain language, patient-centred"}
- Target reading level: Grade 6-8 for patients, Grade 11-13 for HCPs
- Preferred CTAs: "Talk to your doctor", "Learn about your treatment options", "Find a specialist near you"
- Short paragraphs: 2-3 sentences max
- No hype words: "revolutionary", "breakthrough", "guaranteed", "best", "only", "transforming", "innovating"
- Every claim must be traceable to the brief information provided

=== TONE - AVOID THIS, WRITE THIS INSTEAD ===
Corporate / do NOT write like this:
- "We are committed to transforming patient care through innovation."
- "How we make care better for everyone."
- "Our science-driven approach redefines what's possible."
- "Empowering patients with next-generation solutions."
- "We partner with patients on their journey."

Patient-centred / write like this instead:
- "If you have been diagnosed with [condition], there are treatment options you can discuss with your doctor."
- "Clinical studies showed that [X]% of patients experienced [outcome] after [timeframe]."
- "Talk to your doctor about whether [treatment] may be right for you."
- "Understanding your options can help you and your doctor make a plan that fits your life."
- "[Condition] affects [X] people in [country]. Here is what you should know."

The difference: corporate copy is about the company. Patient copy is about the patient's situation and their next step.

${regulatoryConstraints ? `=== REGULATORY CONSTRAINTS ===\n${regulatoryConstraints}` : ""}`,
          },
          {
            role: "user",
            content: `Write webpage copy for the following project. Use ONLY information from the brief below - do not invent facts.

Project title: ${brief.projectTitle}
Goal: ${brief.goal}
Audience: ${brief.audience || audience}
Source information: ${brief.informationFromSources && !/no user-provided/i.test(brief.informationFromSources) ? brief.informationFromSources : "None provided"}
Inspiration notes: ${brief.inspiration || "None"}
${sourceText ? `\nUploaded source material (verbatim extract - use the concrete facts below):\n${sourceText}\n` : ""}
Sections to write:
${sectionList}

IMPORTANT: If the uploaded source material or source information contains specific factual details that the project calls for (for example fees, pricing, dates, opening hours, contact details, locations, or eligibility criteria), you MUST include those exact details in the most relevant section. Do not omit specifics the user supplied, and do not replace them with vague language.

Call the write_sections tool with your output.`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "write_sections",
            description: "Return written webpage copy for each content section",
            parameters: {
              type: "object",
              properties: {
                headline: {
                  type: "string",
                  description: "Hero headline - outcome-led, benefit-focused, 8-12 words, no hype",
                },
                subheadline: {
                  type: "string",
                  description: "1-2 sentence supporting statement, plain language, patient-centred",
                },
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Section heading" },
                      body: { type: "string", description: "2-3 sentences of written content, plain language, no hype, grounded in brief" },
                    },
                    required: ["title", "body"],
                    additionalProperties: false,
                  },
                },
                cta: {
                  type: "string",
                  description: "Call-to-action - must use safe language like 'Talk to your doctor' or 'Learn about your options'",
                },
              },
              required: ["headline", "subheadline", "sections", "cta"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "write_sections" } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Groq error:", response.status, text);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Content enrichment failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No structured response from AI");

    return new Response(toolCall.function.arguments, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("enrich-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
