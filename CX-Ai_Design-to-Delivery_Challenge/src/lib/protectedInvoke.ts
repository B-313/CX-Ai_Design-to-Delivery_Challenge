import { supabase } from "@/integrations/supabase/client";

function getApiKey() {
  const sessionKey = sessionStorage.getItem("api_key");
  if (sessionKey) return sessionKey;
  return localStorage.getItem("api_key");
}

export function saveApiKey(key: string, persist = false) {
  const normalized = key.trim();
  if (!normalized) {
    sessionStorage.removeItem("api_key");
    localStorage.removeItem("api_key");
    return;
  }
  sessionStorage.setItem("api_key", normalized);
  if (persist) {
    localStorage.setItem("api_key", normalized);
  } else {
    localStorage.removeItem("api_key");
  }
}

export async function invokeProtectedFunction<TBody extends Record<string, unknown>, TResponse = unknown>(
  functionName: string,
  body: TBody,
): Promise<{ data: TResponse | null; error: Error | null }> {
  const apiKey = getApiKey();
  const headers: Record<string, string> = {};
  
  // Include API key if user provided one
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers,
  });

  return { data: (data as TResponse) ?? null, error };
}
