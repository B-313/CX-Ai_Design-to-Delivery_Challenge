import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { brief } = await req.json();

    if (!brief || typeof brief !== "string" || brief.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Brief text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

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
            content: "You are a Prompt Intelligence Engine for web design compliance. Analyze website briefs for compliance readiness. You must call the analyze_brief tool with your structured analysis.",
          },
          {
            role: "user",
            content: `Analyze this website brief for compliance issues, brand consistency, accessibility (WCAG 2.1 AA), regulatory requirements, and content quality:\n\n${brief}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_brief",
              description: "Return structured analysis of the website brief",
              parameters: {
                type: "object",
                properties: {
                  compliance_score: { type: "number", description: "Overall compliance score from 0-100" },
                  summary: { type: "string", description: "Brief 1-2 sentence summary of the analysis" },
                  issues: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string", enum: ["brand", "accessibility", "regulatory", "content", "technical"] },
                        severity: { type: "string", enum: ["high", "medium", "low"] },
                        title: { type: "string" },
                        description: { type: "string" },
                        fix: { type: "string" },
                      },
                      required: ["category", "severity", "title", "description", "fix"],
                      additionalProperties: false,
                    },
                  },
                  suggested_components: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        reason: { type: "string" },
                      },
                      required: ["name", "reason"],
                      additionalProperties: false,
                    },
                  },
                  compliant_rewrite: { type: "string", description: "Improved version of the brief addressing all compliance issues" },
                },
                required: ["compliance_score", "summary", "issues", "suggested_components", "compliant_rewrite"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_brief" } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Groq error:", response.status, text);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "AI did not return structured analysis" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(toolCall.function.arguments, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-brief error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
