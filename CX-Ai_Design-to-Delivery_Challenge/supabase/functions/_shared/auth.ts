declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

export function getApiKey(req: Request): string | null {
  // Check for user-provided API key
  const userKey = req.headers.get("x-api-key")?.trim();
  if (userKey) {
    return userKey;
  }
  return null;
}

export function requireApiKey(req: Request, corsHeaders: Record<string, string>) {
  // If user provided an API key, validate it
  const provided = req.headers.get("x-api-key")?.trim();
  if (!provided) {
    // No API key provided is acceptable; functions can use default/demo mode
    return null;
  }

  // Optional: Validate against a list of valid keys if available
  const validKeys = Deno.env.get("valid_api_keys");
  if (validKeys) {
    const keys = validKeys.split(",").map(k => k.trim());
    if (!keys.includes(provided)) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return null;
}
