import webpush from "npm:web-push@3.6.7";
import {createClient} from "npm:@supabase/supabase-js@2.49.8";

const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
Deno.serve(async req=>{
  const token=req.headers.get("X-MW-Dispatch");
  if(req.method!=="POST"||!token)return new Response(null,{status:403});
  const {data:keys,error}=await db.rpc("mw_push_credentials");
  if(error||!keys||token!==keys.mw_push_dispatch)return new Response(null,{status:403});
  const {id}=await req.json();
  const {data:n,error:noticeError}=await db.from("notifications").select("id,user_id,actor_id,kind,title,body").eq("id",id).single();
  if(noticeError||!n)return new Response(null,{status:404});
  if(n.kind==="message"&&n.actor_id){
    const {data:pref,error:prefError}=await db.from("mw_chat_preferences").select("muted").eq("user_id",n.user_id).eq("thread_key","u:"+n.actor_id).maybeSingle();
    if(prefError)return new Response(null,{status:503});
    if(pref?.muted)return new Response(null,{status:204});
  }
  const {data:devices,error:deviceError}=await db.from("mw_push_devices").select("*").eq("user_id",n.user_id);
  if(deviceError)return new Response(null,{status:503});
  const {data:actor}=n.actor_id?await db.from("profiles").select("username").eq("id",n.actor_id).maybeSingle():{data:null};
  const payload=JSON.stringify({id:n.id,user:n.user_id,kind:n.kind,title:n.title,body:n.kind==="follow"&&actor?"@"+actor.username+" sizga obuna bo‘ldi.":String(n.body||"").slice(0,180),actor:n.actor_id});
  const results=await Promise.allSettled((devices||[]).map(async d=>{
    try{
      await webpush.sendNotification({endpoint:d.endpoint,keys:{auth:d.auth,p256dh:d.p256dh}},payload,{
        TTL:3600,vapidDetails:{subject:"https://minecraftworlduz.github.io/Web/",publicKey:keys.mw_push_public,privateKey:keys.mw_push_private}
      });
    }catch(err){
      if(err.statusCode===410||err.statusCode===404){
        await db.from("mw_push_devices").delete().eq("user_id",n.user_id).eq("endpoint",d.endpoint);
      }else throw err;
    }
  }));
  return new Response(null,{status:results.some(r=>r.status==="rejected")?502:204});
});
