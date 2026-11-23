// Supabase Edge Function: forwards a masked column profile to Gemini and
// returns the proposed mapping recipe. The Gemini key stays on the server
// (`supabase secrets set GEMINI_API_KEY=...`); the browser never sees it.
//
// The request body is the one web/src/ingest/gemini.ts builds with
// requestBody(profile): only column names, value kinds and masked examples.
// Supabase checks the caller's sign-in before this runs; only clinic admins
// should call it (checked below).

import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return new Response("Sign in first", { status: 401, headers: cors });
  const { data: roles } = await supabase.from("staff_members").select("role").eq("user_id", user.user.id).eq("role", "admin");
  if (!roles?.length) return new Response("Only clinic admins can import data", { status: 403, headers: cors });
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return new Response("GEMINI_API_KEY is not set on the server", { status: 503, headers: cors });

  const body = await req.json();
  // Accept only the shape the app sends: one text prompt and a JSON-schema answer.
  const allowed = { contents: body?.contents, generationConfig: body?.generationConfig };
  if (!Array.isArray(allowed.contents) || typeof allowed.generationConfig !== "object") return new Response("Bad request", { status: 400, headers: cors });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(allowed),
  });
  return new Response(await res.text(), { status: res.status, headers: { ...cors, "Content-Type": "application/json" } });
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
