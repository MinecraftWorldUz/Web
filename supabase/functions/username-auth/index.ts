// Supabase Edge Function: username-auth
// Deploy from Dashboard, with "Verify JWT" OFF for initial sign-ins.
// Never place a service role key in the GitHub website.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON = Deno.env.get("SUPABASE_ANON_KEY");
const ORIGIN = "https://minecraftworlduz.github.io";

if (!URL || !SECRET || !ANON) throw new Error("Missing Supabase environment secrets");
const config = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(URL, SECRET, config);
const response = (status: number, data: unknown) => new Response(JSON.stringify(data), {
  status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
    "Cache-Control": "no-store"
  }
});
async function rate(key: string, n: number, sec: number) {
  const { data, error } = await admin.rpc("mw_auth_limit", {
    p_key: key, p_limit: n, p_seconds: sec
  });
  if (error || typeof data !== "boolean") throw new Error("Rate limiter unavailable");
  return data;
}
async function lookup(username: string) {
  const { data, error } = await admin.rpc("mw_auth_lookup", {p_username: username});
  if (error) throw new Error("Account lookup failed");
  return data?.[0] ?? null;
}
Deno.serve(async (req) => {
  if (req.headers.get("origin") !== ORIGIN) return response(403, {error:"Origin not allowed"});
  if (req.method === "OPTIONS") return new Response(null, {
    status:204, headers:{
      "Access-Control-Allow-Origin":ORIGIN,
      "Access-Control-Allow-Methods":"POST, OPTIONS",
      "Access-Control-Allow-Headers":"content-type",
      "Vary":"Origin"
    }
  });
  if (req.method !== "POST") return response(405,{error:"POST only"});
  try {
    if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
      return response(415,{error:"JSON required"});
    const length = Number(req.headers.get("content-length")||0);
    if (length > 4096) return response(413,{error:"Request too large"});
    const body = await req.text();
    if (new TextEncoder().encode(body).length > 4096)
      return response(413,{error:"Request too large"});
    let input: Record<string,unknown>;
    try { input = JSON.parse(body); }
    catch { return response(400,{error:"Invalid JSON"}); }
    if (!input || typeof input!=="object" || Array.isArray(input))
      return response(400,{error:"Invalid request"});
    const action=input.action, username=typeof input.username==="string"?input.username.trim().toLowerCase():"";
    const password=input.password;
    if (!["signup","login"].includes(String(action)) || !/^[a-z0-9_]{3,20}$/.test(username))
      return response(400,{error:"Username 3–20: a–z, 0–9, _"});
    if (typeof password !== "string" || !password || new TextEncoder().encode(password).length>72 || password.includes("\0"))
      return response(400,{error:"Invalid password"});
    if (action==="signup" && [...password].length<12)
      return response(400,{error:"Password must have at least 12 characters"});
    if (!(await rate(action+":global",action==="signup"?20:120,action==="signup"?3600:60)) ||
        !(await rate(action+":"+username,action==="signup"?3:8,action==="signup"?3600:300)))
      return response(429,{error:"Too many attempts, try again later"});
    let account=await lookup(username);
    if (action==="signup") {
      if(username==="admin") return response(409,{error:"Admin username is reserved"});
      if(account) return response(409,{error:"Bu username band"});
      const {data,error}=await admin.auth.admin.createUser({
        email: crypto.randomUUID()+"@users.invalid",
        password,email_confirm:true,
        user_metadata:{username},
        app_metadata:{mw_username_auth:"true"}
      });
      if(error||!data.user) {
        if(await lookup(username)) return response(409,{error:"Bu username band"});
        return response(503,{error:"Akkaunt yaratib bo‘lmadi"});
      }
      account=await lookup(username);
      if(!account) return response(503,{error:"Akkaunt yaratildi. Kirishni qayta sinang"});
    }
    const auth=createClient(URL, ANON, config);
    // Mask account existence using the same general error.
    const email=account&&!account.blocked?account.internal_email:"00000000-0000-0000-0000-000000000000@users.invalid";
    const {data,error}=await auth.auth.signInWithPassword({email,password});
    if (error||!account||account.blocked||!data.session||data.user?.id!==account.user_id)
      return response(401,{error:"Username yoki parol noto‘g‘ri, yoki akkaunt cheklangan"});
    return response(200,{
      access_token:data.session.access_token,
      refresh_token:data.session.refresh_token
    });
  } catch {
    return response(503,{error:"Login serveri vaqtincha ishlamayapti"});
  }
});
