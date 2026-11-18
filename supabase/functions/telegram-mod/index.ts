import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.81.0";

// Telegram Mini App delivery. Public endpoint, but Telegram HMAC auth is mandatory.
// Bot token is read server-side from encrypted Postgres Vault via a service-role-only RPC.
// NEVER put Telegram token or Supabase secret/service keys in GitHub Pages.
const ORIGIN="https://minecraftworlduz.github.io";
const MAX_FILE_BYTES=49*1024*1024;
const SITE_OWNER="2ea37f4b-aa38-4328-a07f-ea1b31879996";
const SITE_MOD_RE=/^site-mods\/(?:mw-explorer-recipes\.mcaddon|mixed-v1\/[a-z0-9-]+\.(?:mcaddon|mcpack|zip))$/;
const RAW_REPO="https://raw.githubusercontent.com/MinecraftWorldUz/Web/main/";
const MAX_INIT_AGE_SECONDS=12*60*60;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body:Record<string,unknown>,status=200){
  return new Response(JSON.stringify(body),{status,headers:{
    "content-type":"application/json; charset=utf-8",
    "access-control-allow-origin":ORIGIN,
    "cache-control":"no-store",
    "vary":"Origin",
  }});
}
function bytesToHex(buf:ArrayBuffer){
  return Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function hmac(key:Uint8Array,data:string):Promise<ArrayBuffer>{
  const k=await crypto.subtle.importKey("raw",key,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return await crypto.subtle.sign("HMAC",k,new TextEncoder().encode(data));
}
async function validatedTelegramUser(initData:string,token:string):Promise<number|null>{
  if(!initData||initData.length>8192)return null;
  const params=new URLSearchParams(initData);
  const keys=new Set<string>();
  for(const [name] of params){
    if(keys.has(name))return null;
    keys.add(name);
  }
  const expected=params.get("hash")||"";
  if(!/^[a-f0-9]{64}$/i.test(expected))return null;
  const now=Math.floor(Date.now()/1000);
  const authDate=Number(params.get("auth_date"));
  if(!Number.isSafeInteger(authDate)||authDate>now+120||now-authDate>MAX_INIT_AGE_SECONDS)return null;
  const checkString=[...params.entries()]
    .filter(([name])=>name!=="hash")
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([name,value])=>name+"="+value).join("\n");
  const secret=new Uint8Array(await hmac(new TextEncoder().encode("WebAppData"),token));
  const actual=bytesToHex(await hmac(secret,checkString));
  let diff=0;
  for(let i=0;i<64;i++)diff|=actual.charCodeAt(i)^expected.toLowerCase().charCodeAt(i);
  if(diff!==0)return null;
  try {
    const user=JSON.parse(params.get("user")||"null");
    const id=Number(user?.id);
    return Number.isSafeInteger(id)&&id>0&&!user?.is_bot?id:null;
  }catch{return null;}
}
function getServerKey():string{
  const all=Deno.env.get("SUPABASE_SECRET_KEYS")||"{}";
  let secret="";
  try{
    const dict=JSON.parse(all);
    secret=typeof dict.default==="string"?dict.default:"";
  }catch{/* legacy key fallback */}
  return secret||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
}
function fileName(title:string,path:string):string{
  const extension=path.split(".").pop()?.toLowerCase()||"zip";
  const safeExt=/^(mcpack|mcaddon|mcworld|zip|jar|rar|7z|json|schematic|litematic|mcstructure)$/.test(extension)?extension:"zip";
  const clean=title.normalize("NFKD").replace(/[^a-zA-Z0-9._ -]/g,"")
    .trim().replace(/\s+/g,"-").slice(0,75)||"Minecraft-World-Mod";
  return clean+"."+safeExt;
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{
    "access-control-allow-origin":ORIGIN,
    "access-control-allow-methods":"POST, OPTIONS",
    "access-control-allow-headers":"content-type, apikey, authorization",
    "access-control-max-age":"86400",
    "vary":"Origin",
  }});
  if(req.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
  if(req.headers.get("origin")!==ORIGIN)return json({ok:false,error:"Not allowed"},403);
  let body:Record<string,unknown>;
  try{
    if(Number(req.headers.get("content-length")||0)>10000)return json({ok:false,error:"Request too large"},413);
    body=await req.json();
  }catch{return json({ok:false,error:"Invalid request"},400);}
  const initData=typeof body.initData==="string"?body.initData:"";
  const modId=typeof body.modId==="string"?body.modId:"";
  if(!UUID.test(modId))return json({ok:false,error:"Mod ID xato."},400);
  const url=Deno.env.get("SUPABASE_URL")||"";
  const key=getServerKey();
  if(!url||!key)return json({ok:false,error:"Server sozlamalari yetishmayapti."},503);
  try{
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:botToken,error:tokenError}=await db.rpc("telegram_bot_token_for_service");
    if(tokenError||typeof botToken!=="string"||!botToken){
      console.error("Telegram bot token unavailable:",tokenError?.message||"not configured");
      return json({ok:false,error:"Telegram bot sozlamalari mavjud emas."},503);
    }
    const tgUserId=await validatedTelegramUser(initData,botToken);
    if(!tgUserId)return json({ok:false,error:"Telegram sessiyasi eskirgan. Botdan saytni qayta oching."},401);
    const {data:mod,error:modErr}=await db.from("mods")
      .select("id,title,author_id,file_path,status").eq("id",modId).eq("status","approved").single();
    if(modErr||!mod?.file_path)return json({ok:false,error:"Mod topilmadi yoki hali tasdiqlanmagan."},404);
    const {data:canSend,error:quotaErr}=await db.rpc("claim_telegram_send",{p_telegram_user_id:tgUserId});
    if(quotaErr){
      console.error("Telegram quota RPC:",quotaErr.message);
      return json({ok:false,error:"Serverda vaqtinchalik xatolik."},503);
    }
    if(!canSend)return json({ok:false,error:"Bir daqiqada 3 tagacha fayl yuborish mumkin."},429);
    let blob:Blob|null=null;
    const path=String(mod.file_path);
    if(mod.author_id===SITE_OWNER && path.startsWith(SITE_OWNER+"/") &&
       SITE_MOD_RE.test(path.slice(SITE_OWNER.length+1))){
      const rel=path.slice(SITE_OWNER.length+1);
      const github=await fetch(RAW_REPO+rel,{method:"GET",
        headers:{"Accept":"application/octet-stream"},signal:AbortSignal.timeout(26000)});
      if(!github.ok)return json({ok:false,error:"Mod fayli GitHub’da topilmadi."},404);
      if(Number(github.headers.get("content-length")||"0")>MAX_FILE_BYTES)
        return json({ok:false,error:"Mod Telegram cheklovidan katta."},413);
      if((github.headers.get("content-type")||"").includes("text/html"))
        return json({ok:false,error:"Mod arxivi topilmadi."},404);
      blob=await github.blob();
      const magic=new Uint8Array(await blob.slice(0,4).arrayBuffer());
      if(magic[0]!==80||magic[1]!==75||magic[2]!==3||magic[3]!==4)
        return json({ok:false,error:"Mod arxivi noto‘g‘ri."},422);
    }else{
      const res=await db.storage.from("mod-files").download(path);
      if(res.error||!res.data)
        return json({ok:false,error:"Mod faylini o‘qib bo‘lmadi."},404);
      blob=res.data;
    }
    if(blob.size>MAX_FILE_BYTES)return json({ok:false,error:"Fayl Telegram Bot API uchun juda katta (50 MB dan ortiq). Oddiy brauzerdan yuklab oling."},413);
    if(blob.size===0)return json({ok:false,error:"Mod fayli bo‘sh."},422);
    const form=new FormData();
    form.append("chat_id",String(tgUserId));
    form.append("caption","🎮 "+String(mod.title).slice(0,650)+"\nMinecraft World");
    form.append("document",blob,fileName(mod.title,mod.file_path));
    const sent=await fetch("https://api.telegram.org/bot"+botToken+"/sendDocument",{
      method:"POST",body:form,signal:AbortSignal.timeout(60000),
    });
    const telegram=await sent.json().catch(()=>({ok:false,description:"Telegram response error"}));
    if(!sent.ok||!telegram.ok){
      const desc=String(telegram.description||"");
      console.error("Telegram delivery:",sent.status,desc.slice(0,200));
      if(sent.status===403||/chat not found|bot was blocked/i.test(desc))
        return json({ok:false,error:"Botning shaxsiy chatiga kirib /start bosing, keyin yana urinib ko‘ring."},403);
      if(sent.status===429)return json({ok:false,error:"Telegram cheklovi. Birozdan keyin urinib ko‘ring."},429);
      return json({ok:false,error:"Telegramga yuborib bo‘lmadi. Botni /start orqali ishga tushiring."},502);
    }
    // Increase site download count only after Telegram accepted the document.
    const countResult=await db.rpc("register_download",{p_mod:modId});
    if(countResult.error)console.error("Download count update:",countResult.error.message);
    return json({ok:true,message:"Mod fayli Telegram chatingizga yuborildi.",file_name:fileName(mod.title,mod.file_path)});
  }catch(error){
    console.error("Telegram mod delivery error:",String(error).slice(0,250));
    return json({ok:false,error:"Yuborishda xatolik yuz berdi. Qayta urinib ko‘ring."},500);
  }
});
