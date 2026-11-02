// Turns words into meaning vectors with Supabase's built-in gte-small model.
//
//   POST { point_id }  -> embeds that point (must belong to the caller), stores it,
//                         and moves a brand-new tree next to similar trees.
//   POST { query }     -> embeds the search words and returns the caller's closest points.
//
// Every request must carry a signed-in user's access token (anonymous users count).
// Reads go through the caller's own token so row level security decides what they
// can touch; only the embedding write and tree placement use the service role.

import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const model = new Supabase.ai.Session("gte-small");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
const PUBLIC_KEY = Deno.env.get("SUPABASE_ANON_KEY") ??
  JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default;

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "http://localhost:5173,http://127.0.0.1:5173")
  .split(",").map((o) => o.trim()).filter(Boolean);

const MAX_QUERY = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cors(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

async function embed(text: string): Promise<number[]> {
  const out = await model.run(text, { mean_pool: true, normalize: true });
  return Array.from(out as number[]);
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get("Origin")), "Content-Type": "application/json" };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, { error: "Use POST" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Not signed in" });

  const asUser = createClient(SUPABASE_URL, PUBLIC_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await asUser.auth.getUser(token);
  if (authError || !auth?.user) return reply(401, { error: "Not signed in" });

  let body: { point_id?: unknown; query?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "Bad request" });
  }

  try {
    if (typeof body.query === "string") {
      const query = body.query.trim().slice(0, MAX_QUERY);
      if (!query) return reply(200, { matches: [] });
      const vector = await embed(query);
      const { data, error } = await asUser.rpc("match_points", {
        q: JSON.stringify(vector),
        n: 12,
      });
      if (error) throw error;
      return reply(200, { matches: data });
    }

    if (typeof body.point_id === "string" && UUID.test(body.point_id)) {
      // RLS guarantees this only finds the caller's own point.
      const { data: point, error } = await asUser
        .from("points")
        .select("id, argument_id, text")
        .eq("id", body.point_id)
        .maybeSingle();
      if (error) throw error;
      if (!point) return reply(404, { error: "Point not found" });

      const vector = await embed(point.text);
      const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: writeError } = await admin
        .from("points")
        .update({ embedding: JSON.stringify(vector) })
        .eq("id", point.id)
        .eq("user_id", auth.user.id);
      if (writeError) throw writeError;

      const { error: placeError } = await admin.rpc("place_argument", { arg: point.argument_id });
      if (placeError) throw placeError;

      const { data: tree } = await asUser
        .from("arguments")
        .select("id, x, z, placed_by_meaning")
        .eq("id", point.argument_id)
        .maybeSingle();
      return reply(200, { ok: true, tree });
    }

    return reply(400, { error: "Send point_id or query" });
  } catch (e) {
    console.error(e);
    return reply(500, { error: "Something went wrong" });
  }
});
