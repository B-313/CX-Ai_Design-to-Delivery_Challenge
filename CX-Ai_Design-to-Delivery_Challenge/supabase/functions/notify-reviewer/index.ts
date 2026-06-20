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
    const body = await req.json();
    const reviewerEmail = Deno.env.get("REVIEWER_EMAIL");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!reviewerEmail || !resendApiKey) {
      return new Response(
        JSON.stringify({
          queued: true,
          simulated: true,
          message: "Reviewer notification simulated. Set REVIEWER_EMAIL and RESEND_API_KEY to enable email delivery.",
          payload: body,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Company Name Portal <no-reply@resend.dev>",
        to: [reviewerEmail],
        subject: `New Portal Submission: ${body?.projectTitle || "Untitled Project"}`,
        html: `
          <h2>New Portal Submission</h2>
          <p><strong>Submitted By:</strong> ${body?.submitter || "Unknown"}</p>
          <p><strong>Email:</strong> ${body?.submitterEmail || "Unknown"}</p>
          <p><strong>Country:</strong> ${body?.country || "Unknown"}</p>
          <p><strong>Build Type:</strong> ${body?.buildType || "Unknown"}</p>
          <p><strong>Review Score:</strong> ${body?.score || "N/A"}</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const err = await emailResponse.text();
      throw new Error(`Email send failed: ${err}`);
    }

    const result = await emailResponse.json();
    return new Response(JSON.stringify({ queued: true, simulated: false, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown notification error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
