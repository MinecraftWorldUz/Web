/* Minecraft World — authenticated chat groups integration.
   This file is loaded only by production index.html and uses its existing DB, S, $, e, avatar, label, dialog, go helpers. */
window.MWChat=(()=>{
 const C={groups:[],last:{},members:[],selected:[],group:null,activeId:null,queryTimer:null,userId:null,channel:null};
 const escape=e,icon=ico;
 async function load(){
  if(!S.u||S.page!=='chat')return;
  const uid=S.u.id;
  if(C.userId!==uid){
   if(C.channel)DB.removeChannel(C.channel);
   C.userId=uid;C.groups=[];C.last={};
   C.channel=DB.channel('mw-groups-'+uid)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'mw_group_messages'},payload=>{
     if(S.u?.id!==uid)return;
     const g=payload.new.group_id;
     if(!C.groups.some(x=>x.id===g))return;
     C.last[g]=new Date(payload.new.created_at).getTime();
     renderGroups();
     if(S.page==='chat'&&S.chatId==='g:'+g&&payload.new.sender_id!==uid)openGroup(g).catch(console.warn);
    }).subscribe();
  }
  const member=check(await DB.from('mw_group_members').select('group_id').eq('user_id',uid));
  const ids=member.map(m=>m.group_id);
  const [groups,recent,invites,worldRecent]=await Promise.all([
   ids.length?DB.from('mw_groups').select('*').in('id',ids):Promise.resolve({data:[],error:null}),
   ids.length?DB.from('mw_group_messages').select('group_id,created_at').in('group_id',ids).order('created_at',{ascending:false}).limit(150):Promise.resolve({data:[],error:null}),
   DB.from('mw_group_invitations').select('id',{count:'exact',head:true}).eq('recipient_id',uid).eq('status','pending'),
   DB.from('world_chat_messages').select('created_at').order('created_at',{ascending:false}).limit(1)
  ]);
  check(groups);check(recent);
  if(S.u?.id!==uid||S.page!=='chat')return;
  C.groups=groups.data;
  S.mwWorldTime=worldRecent.data?.[0]?new Date(worldRecent.data[0].created_at).getTime():0;
  C.last={};
  for(const m of recent.data)if(!C.last[m.group_id])C.last[m.group_id]=new Date(m.created_at).getTime();
  renderGroups();
  const bar=$('.chat-title');
  if(bar&&!$('#mwInviteButton')){
   bar.insertAdjacentHTML('beforeend','<button class="btn small ghost" id="mwInviteButton" data-mw="invites">Takliflar</button>');
  }
  const badge=$('#mwInviteButton');if(badge)badge.textContent='Takliflar'+(invites.count?' ('+invites.count+')':'');
  if(S.chatId?.startsWith('g:'))await openGroup(S.chatId.slice(2));
 }
 function renderGroups(){
  const rows=$('#chatRows');
  if(!rows||S.page!=='chat')return;
  rows.querySelectorAll('.mw-group-item').forEach(node=>node.remove());
  for(const g of C.groups){
   const html='<button type="button" class="chat-peer mw-group-item '+(S.chatId==='g:'+g.id?'active':'')+'" data-mw="open" data-id="'+escape(g.id)+'">'+
    '<span class="account-avatar">'+(g.avatar_url?'<img class="av" src="'+escape(g.avatar_url)+'" alt="">':icon('users',25))+'</span>'+
    '<span class="peer-text"><b>'+escape(g.name)+'</b><small>@'+escape(g.username||'maxfiy')+'</small></span></button>';
   rows.insertAdjacentHTML('beforeend',html);
  }
  // Keep world, direct and group threads together; newest activity first.
  const entries=[...rows.querySelectorAll('.chat-peer')];
  entries.sort((a,b)=>{
   const date=x=>x.classList.contains('mw-group-item')?(C.last[x.dataset.id]||0):
    x.dataset.id==='world'?S.mwWorldTime||0:S.mwDirectTimes?.[x.dataset.id]||0;
   return date(b)-date(a);
  });
  entries.forEach(node=>rows.append(node));
  window.MWV11?.decorateInbox?.();
 }
 const memberPreview=p=>'<label class="mw-member-option">'+avatar(p)+'<span><b>'+escape(p.display_name||p.username)+'</b><small>@'+escape(p.username)+'</small></span>'+
  '<input type="checkbox" class="mw-check-member" value="'+escape(p.id)+'" '+(C.selected.includes(p.id)?'checked':'')+'></label>';
 function newChat(){
  if(!S.u)return;
  dialog('Yangi xabar','<button class="btn" data-mw="new-group">'+icon('users',19)+' Guruh yaratish</button>'+
   '<div class="formgroup"><input class="field" id="mwPersonSearch" placeholder="Barcha ommaviy akkauntlardan qidirish"></div>'+
   '<div id="mwPersonResults" class="mw-member-list"></div>');
  searchPeople('');
 }
 async function searchPeople(q,forGroup=false){
  if(!S.u)return;
  const term=String(q||'').trim().replace(/^@/,'').replace(/[%*,()]/g,'').slice(0,30);
  let req=DB.from('profiles').select('id,username,display_name,avatar_url').neq('id',S.u.id).limit(35);
  if(term)req=req.or('username.ilike.%'+term+'%,display_name.ilike.%'+term+'%');
  const all=check(await req);
  const settings=all.length?await DB.from('mw_chat_settings').select('user_id,discoverable').in('user_id',all.map(p=>p.id)):({data:[]});
  const hidden=new Set((settings.data||[]).filter(p=>p.discoverable===false).map(p=>p.user_id));
  const filtered=all.filter(p=>!hidden.has(p.id));
  const target=$(forGroup?'#mwMemberResults':'#mwPersonResults');
  if(!target)return;
  if(forGroup){
   C.members=filtered;
   target.innerHTML=filtered.map(memberPreview).join('')||'<p class="muted">Topilmadi</p>';
  }else{
   target.innerHTML=filtered.map(p=>'<button class="mw-member-option" data-act="chatStart" data-id="'+escape(p.id)+'">'+avatar(p)+
    '<span><b>'+escape(p.display_name||p.username)+'</b><small>@'+escape(p.username)+'</small></span></button>').join('')||'<p class="muted">Topilmadi</p>';
  }
 }
 function editGroup(g=null){
  C.group=g;C.selected=[];
  dialog(g?'Guruhni tahrirlash':'Guruh yaratish','<form id="mwGroupForm" data-id="'+escape(g?.id||'')+'">'+
   '<div class="mw-group-top"><label class="mw-avatar-button">'+(g?.avatar_url?'<img src="'+escape(g.avatar_url)+'" alt="">':icon('users',38))+
   '<span>＋</span><input type="file" name="avatar" accept="image/png,image/jpeg,image/webp"></label>'+
   '<div class="formgroup"><label>Guruh nomi</label><input class="field" name="name" value="'+escape(g?.name||'')+'" maxlength="48" required></div></div>'+
   '<div class="formgroup"><label>Bio</label><textarea class="field" name="bio" maxlength="280">'+escape(g?.bio||'')+'</textarea></div>'+
   '<div class="formgroup"><label>Guruh turi</label><label class="mw-switch-row"><input type="radio" name="visibility" value="public" '+(g?.visibility==='private'?'':'checked')+'> Ommaviy</label>'+
   '<label class="mw-switch-row"><input type="radio" name="visibility" value="private" '+(g?.visibility==='private'?'checked':'')+'> Maxfiy</label></div>'+
   '<div id="mwUsernameWrap" class="formgroup"><label>Guruh username</label><input class="field" id="mwGroupUsername" name="username" maxlength="25" value="'+escape(g?.username||'')+'" placeholder="minecraft_team"><small id="mwUsernameState"></small></div>'+
   '<div class="formgroup"><label>Guruhga odam qo‘shish</label><input class="field" id="mwMemberSearch" placeholder="Ism yoki @username">'+
   '<div id="mwMemberResults" class="mw-member-list"></div><small id="mwSelectedCount"></small></div>'+
   '<button class="btn" type="submit">Saqlash</button></form>');
  visibility();
  searchPeople('',true);
 }
 function visibility(){const w=$('#mwUsernameWrap');if(w)w.hidden=$('#mwGroupForm [name=visibility]:checked')?.value==='private'}
 async function usernameStatus(){
  const input=$('#mwGroupUsername'),output=$('#mwUsernameState');
  if(!input||!output)return;
  const value=input.value.trim().replace(/^@/,'').toLowerCase();
  if(!/^[a-z0-9_]{5,25}$/.test(value)){output.textContent='5–25 ta a-z, 0-9, _';output.className='bad';return}
  const [p,g]=await Promise.all([
   DB.from('profiles').select('id').eq('username',value).limit(1),
   DB.from('mw_groups').select('id').eq('username',value).limit(1)
  ]);
  if(!output.isConnected||input.value.toLowerCase()!==value)return;
  const taken=!!p.data?.length||(g.data||[]).some(x=>x.id!==C.group?.id);
  output.textContent=taken?'Username band':'Username bo‘sh';output.className=taken?'bad':'ok';
 }
 async function saveGroup(form){
  const d=new FormData(form),name=String(d.get('name')||'').trim(),vis=String(d.get('visibility')||'public');
  let username=vis==='public'?String(d.get('username')||'').trim().replace(/^@/,'').toLowerCase():null;
  if(!name)throw Error('Guruh nomini yozing');
  if(username&&!/^[a-z0-9_]{5,25}$/.test(username))throw Error('Username noto‘g‘ri');
  if(vis==='public'&&!username)throw Error('Username kerak');
  let avatar_url=C.group?.avatar_url||null;
  const file=d.get('avatar');
  if(file?.size){
   const path=await upload('avatars',file,2097152,['image/jpeg','image/png','image/webp']);
   avatar_url=DB.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  }
  const values={name,username,visibility:vis,bio:String(d.get('bio')||'').trim(),avatar_url};
  let group;
  if(C.group)group=check(await DB.from('mw_groups').update(values).eq('id',C.group.id).eq('owner_id',S.u.id).select('*').single());
  else group=check(await DB.from('mw_groups').insert({...values,owner_id:S.u.id}).select('*').single());
  let failed=0;
  for(const recipient_id of C.selected){
   const result=await DB.from('mw_group_invitations').insert({group_id:group.id,sender_id:S.u.id,recipient_id});
   if(result.error&&result.error.code!=='23505')failed++;
  }
  close();
  S.chatId='g:'+group.id;
  await load();
  await openGroup(group.id);
  if(failed)toast('Ba’zi takliflar yuborilmadi');
 }
 const groupBubble=(m,p,rows)=>'<div class="mw11-group-message">'+
   (m.sender_id!==S.u.id?'<span class="mw11-group-sender">'+escape(p?.display_name||p?.username||'Ishtirokchi')+'</span>':'')+
   (window.MWV11?.bubble?.(m,'group',rows)||'<div class="bubble">'+escape(m.body)+'</div>')+'</div>';
 async function openGroup(id){
  if(!S.u||S.page!=='chat')return;
  const g=check(await DB.from('mw_groups').select('*').eq('id',id).single());
  const member=check(await DB.from('mw_group_members').select('user_id').eq('group_id',id).eq('user_id',S.u.id).maybeSingle());
  if(!member)throw Error('Bu guruhga a’zo emassiz');
  S.chatId='g:'+id;C.activeId=id;
  const area=$('#conversation');if(!area)return;
  area.innerHTML='<header class="chat-toolbar"><button class="linkbtn" data-mw="group-info" data-id="'+escape(id)+'">'+icon('users',24)+' '+escape(g.name)+'</button></header>'+
   '<div class="messages" id="msgs"></div><form class="chat-compose" id="mwGroupMessage" data-id="'+escape(id)+'">'+
   '<input class="field" name="body" maxlength="2000" placeholder="Xabar yozing..." required><button class="btn" type="submit">'+icon('send',20)+'</button></form>';
  renderGroups();
  const rows=check(await DB.from('mw_group_messages').select('id,sender_id,body,created_at,reply_to,edited_at').eq('group_id',id).order('created_at',{ascending:false}).limit(65));
  const people=await users(rows.map(m=>m.sender_id));
  if(S.chatId!=='g:'+id||!$('#msgs'))return;
  const ordered=rows.slice().reverse();
  $('#msgs').innerHTML=ordered.map(m=>groupBubble(m,people[m.sender_id],ordered)).join('')||'<p class="muted">Birinchi xabarni yuboring</p>';
  $('#msgs').scrollTop=$('#msgs').scrollHeight;
  window.MWV11?.afterRender?.(ordered,'group');
  window.MWV11?.addThreadSearch?.();
  window.MWV11?.markRead?.('g:'+id).catch(console.warn);
 }
 async function info(id){
  const group=check(await DB.from('mw_groups').select('*').eq('id',id).single());
  const members=check(await DB.from('mw_group_members').select('user_id').eq('group_id',id));
  const map=await users(members.map(x=>x.user_id));
  dialog('Guruh ma’lumotlari','<div class="mw-group-top">'+(group.avatar_url?'<img class="av large" src="'+escape(group.avatar_url)+'" alt="">':icon('users',40))+
   '<div><h3>'+escape(group.name)+'</h3><p>@'+escape(group.username||'maxfiy')+'</p><p>'+escape(group.bio||'')+'</p></div></div>'+
   '<h3>A’zolar · '+members.length+'</h3><div class="mw-member-list">'+members.map(m=>'<button class="mw-member-option" data-act="user" data-id="'+escape(m.user_id)+'">'+
   avatar(map[m.user_id])+'<span>'+label(map[m.user_id])+(m.user_id===group.owner_id?' · Egasi':'')+'</span></button>').join('')+'</div>'+
   '<div class="buttons">'+(group.owner_id===S.u.id?'<button class="btn" data-mw="edit-group" data-id="'+escape(id)+'">Tahrirlash / a’zo qo‘shish</button>'+
   '<button class="btn danger" data-mw="delete-group" data-id="'+escape(id)+'">Guruhni o‘chirish</button>':
   '<button class="btn danger" data-mw="leave-group" data-id="'+escape(id)+'">Guruhdan chiqish</button>')+'</div>');
 }
 async function invitations(){
  const invites=check(await DB.from('mw_group_invitations').select('id,group_id,sender_id').eq('recipient_id',S.u.id).eq('status','pending'));
  const groupIds=invites.map(i=>i.group_id);
  const groups=groupIds.length?check(await DB.from('mw_groups').select('id,name').in('id',groupIds)):[];
  const names=Object.fromEntries(groups.map(g=>[g.id,g.name]));
  dialog('Guruh takliflari',invites.map(i=>'<div class="item"><b>'+escape(names[i.group_id]||'Guruh')+'</b>'+
   '<div class="buttons"><button class="btn" data-mw="answer" data-id="'+escape(i.id)+'" data-status="accepted">Qabul qilish</button>'+
   '<button class="btn ghost" data-mw="answer" data-id="'+escape(i.id)+'" data-status="declined">Rad etish</button></div></div>').join('')||'<p class="muted">Hozircha taklif yo‘q.</p>');
 }
 async function worldInfo(){
  const pref=await worldPref();
  dialog('Umumiy chat','<h3>Umumiy chat</h3><p>Bu suhbatga barcha yangi va eski akkauntlar avtomatik qo‘shiladi.</p>'+
   '<button class="btn danger" data-mw="world-leave">'+(pref.joined?'Guruhdan chiqish':'Qayta qo‘shilish')+'</button>');
 }
 async function action(button){
  const command=button.dataset.mw,id=button.dataset.id;
  if(command==='new-chat')newChat();
  else if(command==='new-group')editGroup();
  else if(command==='open')await openGroup(id);
  else if(command==='group-info')await info(id);
  else if(command==='edit-group'){
   const g=check(await DB.from('mw_groups').select('*').eq('id',id).single());
   if(g.owner_id!==S.u.id)throw Error('Faqat guruh egasi tahrirlay oladi');
   editGroup(g);
  }
  else if(command==='invites')await invitations();
  else if(command==='answer'){
   check(await DB.from('mw_group_invitations').update({status:button.dataset.status}).eq('id',id).eq('recipient_id',S.u.id));
   close();await load();
  }
  else if(command==='world-info')await worldInfo();
  else if(command==='world-leave'){
   const pref=await worldPref();
   if(pref.joined){if(!confirm('Umumiy chatdan chiqmoqchimisiz?'))return;
    if(!confirm('Tasdiqlang: umumiy chatdan chiqasiz.'))return;}
   await worldUpdate({joined:!pref.joined});close();await go('chat');
  }
  else if(command==='leave-group'){
   if(!confirm('Guruhdan chiqmoqchimisiz?'))return;
   if(!confirm('Tasdiqlang: guruhdan chiqasiz.'))return;
   check(await DB.from('mw_group_members').delete().eq('group_id',id).eq('user_id',S.u.id));
   close();S.chatId='world';await go('chat');
  }
  else if(command==='delete-group'){
   if(!confirm('Guruhni barcha xabarlari bilan o‘chirasizmi?'))return;
   check(await DB.from('mw_groups').delete().eq('id',id).eq('owner_id',S.u.id));
   close();S.chatId='world';await go('chat');
  }
  else if(command==='edit-message'){
   const prev=check(await DB.from('mw_group_messages').select('body').eq('id',id).single());
   const body=prompt('Xabarni tahrirlash',prev.body);
   if(body===null)return;if(!body.trim())throw Error('Bo‘sh xabar');
   check(await DB.from('mw_group_messages').update({body:body.trim(),edited_at:new Date().toISOString()}).eq('id',id).eq('sender_id',S.u.id));
   await openGroup(C.activeId);
  }
  else if(command==='delete-message'){
   if(!confirm('Xabarni o‘chirasizmi?'))return;
   check(await DB.from('mw_group_messages').delete().eq('id',id).eq('sender_id',S.u.id));
   await openGroup(C.activeId);
  }
 }

 async function loadProfileSettings(){
  if(!S.u)return;
  const row=check(await DB.from('mw_chat_settings').select('discoverable,require_group_approval').eq('user_id',S.u.id).maybeSingle());
  if($('#mwPublicProfile'))$('#mwPublicProfile').checked=row?.discoverable!==false;
  if($('#mwInviteApproval'))$('#mwInviteApproval').checked=row?.require_group_approval!==false;
 }
 async function saveProfileSettings(){
  if(!S.u)return;
  const pub=$('#mwPublicProfile'),approval=$('#mwInviteApproval');
  if(!pub||!approval)return;
  check(await DB.from('mw_chat_settings').upsert({
   user_id:S.u.id,discoverable:pub.checked,require_group_approval:approval.checked
  }));
 }
 async function checkAccountUsername(input){
  if(!S.u||!input)return;
  const value=input.value.trim().toLowerCase(),id='mwAccountNameCheck';
  let status=$('#'+id);
  if(!status){input.insertAdjacentHTML('afterend','<small id="'+id+'"></small>');status=$('#'+id)}
  if(!/^[a-z0-9_]{3,20}$/.test(value)){status.textContent='Username 3–20 belgi';return}
  const [p,g]=await Promise.all([
   DB.from('profiles').select('id').eq('username',value),
   DB.from('mw_groups').select('id').eq('username',value)
  ]);
  if(!status?.isConnected||input.value.trim().toLowerCase()!==value)return;
  status.textContent=(p.data||[]).some(x=>x.id!==S.u.id)||(g.data||[]).length?'Username band':'Username bo‘sh';
 }

 // Capture handles group actions before legacy catch-all click handler; no other features change.
 window.addEventListener('click',ev=>{
  let button=ev.target.closest('[data-mw]');
  if(!button)return;
  ev.preventDefault();ev.stopImmediatePropagation();
  action(button).catch(err=>{console.error(err);toast(err.code==='23505'?'Username band':err.message)});
 },true);
 window.addEventListener('click',ev=>{
  const old=ev.target.closest('[data-act="chooseChat"]');
  if(!old)return;
  ev.preventDefault();ev.stopImmediatePropagation();newChat();
 },true);
 window.addEventListener('input',ev=>{
  const id=ev.target.id;
  if(id==='mwMemberSearch'||id==='mwPersonSearch'){
   clearTimeout(C.queryTimer);
   C.queryTimer=setTimeout(()=>searchPeople(ev.target.value,id==='mwMemberSearch').catch(err=>toast(err.message)),190);
  }
  if(id==='mwGroupUsername'){clearTimeout(C.nickTimer);C.nickTimer=setTimeout(()=>usernameStatus().catch(console.warn),200)}
  if(ev.target.closest('#editProfileForm')&&ev.target.name==='username'){clearTimeout(C.profileTimer);C.profileTimer=setTimeout(()=>checkAccountUsername(ev.target).catch(console.warn),230)}
 });
 window.addEventListener('change',ev=>{
  if(ev.target.matches('.mw-check-member')){
   const id=ev.target.value;
   C.selected=ev.target.checked?[...new Set([...C.selected,id])]:C.selected.filter(x=>x!==id);
   if($('#mwSelectedCount'))$('#mwSelectedCount').textContent=C.selected.length+' kishi tanlandi';
  }
  if(ev.target.closest('#mwGroupForm')&&ev.target.name==='visibility')visibility();
  if(ev.target.closest('.mw-avatar-button')&&ev.target.files?.[0]){
   const reader=new FileReader();reader.onload=()=>{
    const l=ev.target.closest('.mw-avatar-button');
    l.querySelector('img')?.remove();
    l.insertAdjacentHTML('afterbegin','<img src="'+reader.result+'" alt="">');
   };reader.readAsDataURL(ev.target.files[0]);
  }
 });
 window.addEventListener('submit',async ev=>{
  const f=ev.target;if(f.id!=='mwGroupForm'&&f.id!=='mwGroupMessage')return;
  ev.preventDefault();ev.stopImmediatePropagation();
  const btn=f.querySelector('[type="submit"]');if(btn)btn.disabled=true;
  try{
   if(f.id==='mwGroupForm')await saveGroup(f);
   else{
    const body=String(new FormData(f).get('body')||'').trim();if(!body)return;
    check(await DB.from('mw_group_messages').insert({group_id:f.dataset.id,sender_id:S.u.id,body,reply_to:window.MWV11?.replyId?.('group','g:'+f.dataset.id)||null}));
    f.reset();window.MWV11?.clearReply?.();await openGroup(f.dataset.id);
   }
  }catch(err){console.error(err);toast(err.code==='23505'?'Username band':err.message)}
  finally{if(btn)btn.disabled=false}
 },true);
 return {load,renderGroups,openGroup,worldInfo,loadProfileSettings,saveProfileSettings,groups:()=>C.groups,activity:id=>C.last[id]||0};
})();
