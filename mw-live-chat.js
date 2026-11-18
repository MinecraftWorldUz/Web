/* Minecraft World — authenticated chat groups integration.
   This file is loaded only by production index.html and uses its existing DB, S, $, e, avatar, label, dialog, go helpers. */
window.MWChat=(()=>{
 const C={groups:[],last:{},preview:{},members:[],selected:[],selectedNames:new Map(),group:null,badges:new Set(),activeId:null,queryTimer:null,userId:null,channel:null,personQuery:'',memberQuery:'',personOffset:0,memberOffset:0};
 const escape=e,icon=ico;
 async function load(){
  if(!S.u||S.page!=='chat')return;
  const uid=S.u.id;
  if(C.userId!==uid){
   if(C.channel)DB.removeChannel(C.channel);
   C.userId=uid;C.groups=[];C.last={};C.preview={};
   C.channel=DB.channel('mw-groups-'+uid)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'mw_group_messages'},payload=>{
     if(S.u?.id!==uid)return;
     const g=payload.new.group_id;
     if(!C.groups.some(x=>x.id===g))return;
     C.last[g]=new Date(payload.new.created_at).getTime();
     C.preview[g]=String(payload.new.body||'').slice(0,65);
     renderGroups();
     if(S.page==='chat'&&S.chatId==='g:'+g&&payload.new.sender_id!==uid)openGroup(g).catch(console.warn);
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'mw_group_members',filter:`user_id=eq.${uid}`},()=>{
      if(S.u?.id!==uid)return;
      load().catch(console.warn);
    })
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'mw_group_members',filter:`user_id=eq.${uid}`},()=>{
      if(S.u?.id!==uid)return;
      load().catch(console.warn);
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'mw_group_join_requests'},payload=>{
      if(S.u?.id!==uid||!C.groups.some(g=>g.id===payload.new.group_id&&g.owner_id===uid))return;
      if(S.page==='chat')toast('Guruhga qo‘shilish so‘rovi keldi');
      load().catch(console.warn);
    }).subscribe();
  }
  const member=check(await DB.from('mw_group_members').select('group_id').eq('user_id',uid));
  const ids=member.map(m=>m.group_id);
  const [groups,recent,invites,worldRecent]=await Promise.all([
   ids.length?DB.from('mw_groups').select('*').in('id',ids):Promise.resolve({data:[],error:null}),
   ids.length?DB.from('mw_group_messages').select('group_id,body,created_at').in('group_id',ids).order('created_at',{ascending:false}).limit(150):Promise.resolve({data:[],error:null}),
   DB.from('mw_group_invitations').select('id',{count:'exact',head:true}).eq('recipient_id',uid).eq('status','pending'),
   DB.from('world_chat_messages').select('created_at').order('created_at',{ascending:false}).limit(1)
  ]);
  check(groups);check(recent);
  if(S.u?.id!==uid||S.page!=='chat')return;
  C.groups=groups.data;
  const badgeRows=ids.length?await DB.from('mw_group_badges').select('group_id').in('group_id',ids):{data:[],error:null};
  if(!badgeRows.error)C.badges=new Set((badgeRows.data||[]).map(row=>row.group_id));
  S.mwWorldTime=worldRecent.data?.[0]?new Date(worldRecent.data[0].created_at).getTime():0;
  C.last={};C.preview={};
  for(const m of recent.data)if(!C.last[m.group_id]){C.last[m.group_id]=new Date(m.created_at).getTime();C.preview[m.group_id]=String(m.body||'').slice(0,65)}
  renderGroups();
  const owned=C.groups.filter(g=>g.owner_id===uid).map(g=>g.id);
  const pending=owned.length?await DB.from('mw_group_join_requests')
    .select('id',{count:'exact',head:true}).in('group_id',owned).eq('status','pending'):null;
  if(pending?.error)throw pending.error;
  const requestCount=pending?.count||0;
  const bar=$('.chat-title');
  if(bar&&!$('#mwInviteButton')){
   bar.insertAdjacentHTML('beforeend','<button class="btn small ghost" id="mwInviteButton" data-mw="invites">Takliflar</button>');
  }
  const total=(invites.count||0)+requestCount;
  const badge=$('#mwInviteButton');if(badge){badge.hidden=!total;badge.textContent='Taklif va so‘rovlar'+(total?' ('+total+')':'');}
  if(S.chatId?.startsWith('g:'))await openGroup(S.chatId.slice(2));
 }
 function renderGroups(){
  const rows=$('#chatRows');
  if(!rows||S.page!=='chat')return;
  rows.querySelectorAll('.mw-group-item').forEach(node=>node.remove());
  for(const g of C.groups){
   const html='<button type="button" class="chat-peer mw-group-item '+(S.chatId==='g:'+g.id?'active':'')+'" data-mw="open" data-id="'+escape(g.id)+'">'+
    '<span class="account-avatar">'+(g.avatar_url?'<img class="av" src="'+escape(g.avatar_url)+'" alt="">':icon('users',25))+'</span>'+
    '<span class="peer-text"><b>'+escape(g.name)+(C.badges.has(g.id)?'<span class="mw-verified-chat" title="Tasdiqlangan guruh">✓</span>':'')+'</b><small>'+escape(C.preview[g.id]||('@'+(g.username||'maxfiy')))+'</small></span></button>';
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
  dialog(S.lang==='ru'?'Новое сообщение':S.lang==='en'?'New message':'Yangi xabar','<button class="btn" data-mw="new-group">'+icon('users',19)+' '+(S.lang==='ru'?'Создать группу':S.lang==='en'?'Create group':'Guruh yaratish')+'</button>'+
   '<div class="formgroup"><input class="field" id="mwPersonSearch" placeholder="'+(S.lang==='ru'?'Поиск всех публичных пользователей':S.lang==='en'?'Search public accounts':'Barcha ommaviy akkauntlarni qidirish')+'"></div>'+
   '<div id="mwPersonResults" class="mw-member-list"></div>'+
   '<h3 class="mw-public-groups-title">Ommaviy guruhlar</h3>'+
   '<div id="mwPublicGroups" class="mw-member-list"></div>');
  searchPeople('');
 }

 async function searchPeople(q,forGroup=false,append=false){
  if(!S.u)return;
  const term=String(q||'').trim().replace(/^@/,'').replace(/[%*,()]/g,'').slice(0,30);
  const target=$(forGroup?'#mwMemberResults':'#mwPersonResults');
  if(!target)return;
  const key=forGroup?'member':'person';
  if(!append){
    C[key+'Query']=term;
    C[key+'Offset']=0;
  }
  const offset=C[key+'Offset']||0;
  let req=DB.from('profiles').select('id,username,display_name,avatar_url')
     .neq('id',S.u.id).order('username',{ascending:true}).range(offset,offset+49);
  if(term)req=req.or('username.ilike.%'+term+'%,display_name.ilike.%'+term+'%');
  const all=check(await req);
  if(C[key+'Query']!==term||!target.isConnected)return;
  const settings=all.length?check(await DB.from('mw_chat_settings')
    .select('user_id,discoverable').in('user_id',all.map(p=>p.id))):[];
  const hidden=new Set(settings.filter(p=>p.discoverable===false).map(p=>p.user_id));
  const visible=all.filter(p=>!hidden.has(p.id)||(S.chatPeers||[]).includes(p.id));
  if(forGroup)C.members=append?[...C.members,...visible]:visible;
  const cards=forGroup?visible.map(memberPreview).join(''):
    visible.map(p=>'<button class="mw-member-option" data-act="chatStart" data-id="'+escape(p.id)+'">'+
    avatar(p)+'<span><b>'+escape(p.display_name||p.username)+'</b><small>@'+escape(p.username)+'</small></span></button>').join('');
  if(!append)target.innerHTML=cards;
  else{target.querySelector('.mw-people-more')?.remove();target.insertAdjacentHTML('beforeend',cards)}
  C[key+'Offset']=offset+all.length;
  if(all.length===50)target.insertAdjacentHTML('beforeend',
   '<button type="button" class="btn ghost mw-people-more" data-mw="more-people" data-kind="'+
      (forGroup?'members':'people')+'">Yana akkauntlarni ko‘rish</button>');
  if(!target.children.length)target.innerHTML='<p class="muted">Akkaunt topilmadi.</p>';
  if(!forGroup&&!append)await searchPublicGroups(term);
 }


 async function searchPublicGroups(q){
  const target=$('#mwPublicGroups');if(!target||!S.u)return;
  const term=String(q||'').trim().replace(/^@/,'').replace(/[%*,()]/g,'').slice(0,30);
  let req=DB.from('mw_groups').select('id,name,username,bio,avatar_url')
    .eq('visibility','public').order('created_at',{ascending:false}).limit(30);
  if(term)req=req.or('username.ilike.%'+term+'%,name.ilike.%'+term+'%');
  const groups=check(await req);
  if(!target.isConnected||String($('#mwPersonSearch')?.value||'').trim().replace(/^@/,'')!==term)return;
  target.innerHTML=groups.map(g=>'<button type="button" class="mw-member-option mw-public-group-item" data-mw="discover-group" data-id="'+escape(g.id)+'">'+
    (g.avatar_url?'<img class="mw-public-group-avatar" src="'+escape(g.avatar_url)+'" alt="">':icon('users',32))+
    '<span><b>'+escape(g.name)+'</b><small>@'+escape(g.username||'')+
    (g.bio?' · '+escape(g.bio.slice(0,55)):'')+'</small></span></button>').join('')||
   '<p class="muted">Ommaviy guruh topilmadi.</p>';
 }
 async function discoverGroup(id){
  if(!S.u)return;
  const group=check(await DB.from('mw_groups').select('id,name,username,bio,avatar_url,visibility')
    .eq('id',id).eq('visibility','public').single());
  const joined=check(await DB.from('mw_group_members').select('user_id').eq('group_id',id).eq('user_id',S.u.id).maybeSingle());
  const old=check(await DB.from('mw_group_join_requests').select('id,status')
    .eq('group_id',id).eq('requester_id',S.u.id).maybeSingle());
  dialog('Ommaviy guruh',
   '<div class="mw-group-top">'+
   (group.avatar_url?'<img class="av large" src="'+escape(group.avatar_url)+'" alt="">':icon('users',40))+
   '<div><h3>'+escape(group.name)+'</h3><p>@'+escape(group.username||'')+'</p></div></div>'+
   '<p>'+escape(group.bio||'')+'</p>'+
   (joined?'<button class="btn" data-mw="open" data-id="'+escape(id)+'">Guruhni ochish</button>':
    old?.status==='pending'?'<p class="mw-request-pending">Qo‘shilish so‘rovi yuborilgan, egasining javobi kutilmoqda</p>':
    '<button class="btn" data-mw="request-join" data-id="'+escape(id)+'">Qo‘shilish uchun so‘rov yuborish</button>'));
 }
 async function requestJoin(id){
  if(!S.u)return;
  const old=check(await DB.from('mw_group_join_requests').select('id,status')
    .eq('group_id',id).eq('requester_id',S.u.id).maybeSingle());
  if(old?.status==='pending'){toast('So‘rovingiz hali ko‘rib chiqilmoqda');return}
  if(old)check(await DB.from('mw_group_join_requests').delete().eq('id',old.id).eq('requester_id',S.u.id));
  check(await DB.from('mw_group_join_requests').insert({group_id:id,requester_id:S.u.id}));
  toast('Guruh egasiga qo‘shilish so‘rovi yuborildi');
  await discoverGroup(id);
 }

 function editGroup(g=null){
  C.group=g;C.selected=[];C.selectedNames=new Map();
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
   (g?'<button type="button" class="btn ghost" data-v11="theme-open" data-thread="g:'+escape(g.id)+'">Chat fonini tanlash</button>':'')+
   '<button class="btn" type="submit">Saqlash</button></form>');
  visibility();
  searchPeople('',true);
  if(g?.visibility!=='private')usernameStatus().catch(console.warn);
 }
 function visibility(){const w=$('#mwUsernameWrap');if(w)w.hidden=$('#mwGroupForm [name=visibility]:checked')?.value==='private'}

 async function usernameStatus(){
  const input=$('#mwGroupUsername'),output=$('#mwUsernameState');
  if(!input||!output||input.closest('[hidden]'))return;
  const value=input.value.trim().replace(/^@/,'').toLowerCase();
  if(!/^[a-z0-9_]{5,25}$/.test(value)){
    output.textContent='5–25 belgi: a-z, 0-9 yoki _';output.className='bad';return;
  }
  output.textContent='Tekshirilmoqda…';output.className='';
  const {data,error}=await DB.rpc('mw_username_available',{candidate:value,kind:'group',editing_group:C.group?.id||null});
  if(!output.isConnected||input.value.trim().replace(/^@/,'').toLowerCase()!==value)return;
  if(error){console.warn('Username check:',error);output.textContent='Tekshirib bo‘lmadi';output.className='bad';return}
  output.textContent=data?'Username bo‘sh':'Username band';
  output.className=data?'ok':'bad';
 }

 async function saveGroup(form){
  const d=new FormData(form),name=String(d.get('name')||'').trim(),vis=String(d.get('visibility')||'public');
  let username=vis==='public'?String(d.get('username')||'').trim().replace(/^@/,'').toLowerCase():null;
  if(!name)throw Error('Guruh nomini yozing');
  if(username&&!/^[a-z0-9_]{5,25}$/.test(username))throw Error('Username noto‘g‘ri');
  if(vis==='public'&&!username)throw Error('Username kerak');
  if(vis==='public'){
   const r=await DB.rpc('mw_username_available',{candidate:username,kind:'group',editing_group:C.group?.id||null});
   check(r);
   if(!r.data)throw Error('Username band');
  }
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
  let failed=0,requested=[],joinedNow=[];
  if(C.selected.length){
   const joined=check(await DB.from('mw_group_members').select('user_id').eq('group_id',group.id));
   const hasJoined=new Set(joined.map(m=>m.user_id));
   for(const recipient_id of C.selected){
    if(hasJoined.has(recipient_id))continue;
    try{
     const existing=check(await DB.from('mw_group_invitations').select('id,status')
       .eq('group_id',group.id).eq('recipient_id',recipient_id).maybeSingle());
     if(existing?.status==='pending'){requested.push(C.selectedNames.get(recipient_id)||recipient_id.slice(0,7));continue;}
     if(existing)check(await DB.from('mw_group_invitations').delete().eq('id',existing.id));
     const invitation=check(await DB.from('mw_group_invitations')
       .insert({group_id:group.id,sender_id:S.u.id,recipient_id})
       .select('status').single());
     const nick=C.selectedNames.get(recipient_id)||recipient_id.slice(0,7);
     if(invitation.status==='pending')requested.push(nick);
     else joinedNow.push(nick);
    }catch(err){console.warn('Guruh taklifi:',err);failed++}
   }
  }
  close();
  S.chatId='g:'+group.id;
  S.mw11MobileOpen=true;
  await load();
  await openGroup(group.id);
  if(requested.length)toast('@'+requested.slice(0,3).join(', @')+' — ruxsat so‘rovi yuborildi');
  else if(joinedNow.length)toast(joinedNow.length+' a’zo guruhga qo‘shildi');
  if(failed)toast(failed+' ta taklif yuborilmadi');
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
  area.innerHTML='<header class="chat-toolbar">'+
     '<span class="mw11-group-header-avatar">'+(g.avatar_url?'<img class="av" src="'+escape(g.avatar_url)+'" alt="">':icon('users',28))+'</span>'+
     '<button class="linkbtn mw11-head-name" data-mw="group-info" data-id="'+escape(id)+'"><strong>'+escape(g.name)+(C.badges.has(id)?'<span class="mw-verified-chat" title="Tasdiqlangan guruh">✓</span>':'')+'</strong><small>@'+escape(g.username||'maxfiy')+'</small></button>'+
     '<button type="button" class="mw11-chat-options-btn" data-v11="options" data-thread="g:'+escape(id)+'" aria-label="Guruh sozlamalari">'+icon('more-vertical',22)+'</button></header>'+
   '<div class="messages" id="msgs"></div><form class="chat-compose" id="mwGroupMessage" data-id="'+escape(id)+'">'+
   '<input class="field" name="body" maxlength="2000" placeholder="Xabar yozing..."><button class="btn" type="submit">'+icon('send',20)+'</button></form>';
  window.MWV11?.applyTheme?.('g:'+id).catch(console.warn);
  if(S.mw11MobileOpen)window.MWV11?.openMobileThread?.();
  renderGroups();
  const rows=check(await DB.from('mw_group_messages').select('id,sender_id,body,created_at,reply_to,edited_at,attachment_path,attachment_name,attachment_type').eq('group_id',id).order('created_at',{ascending:false}).limit(65));
  const people=await users(rows.map(m=>m.sender_id));
  if(S.chatId!=='g:'+id||!$('#msgs'))return;
  const ordered=rows.slice().reverse();
  $('#msgs').innerHTML=(window.MWV11?.dated?.(ordered,m=>groupBubble(m,people[m.sender_id],ordered))||
   ordered.map(m=>groupBubble(m,people[m.sender_id],ordered)).join(''))||'<p class="muted">Birinchi xabarni yuboring</p>';
  $('#msgs').scrollTop=$('#msgs').scrollHeight;
  window.MWV11?.afterRender?.(ordered,'group');
  window.MWV11?.addThreadSearch?.();
  window.MWV11?.markRead?.('g:'+id).catch(console.warn);
 }
 async function info(id){
  const group=check(await DB.from('mw_groups').select('*').eq('id',id).single());
  const members=check(await DB.from('mw_group_members').select('user_id').eq('group_id',id));
  const own=group.owner_id===S.u.id;
  const certified=!!check(await DB.from('mw_group_badges').select('group_id').eq('group_id',id).maybeSingle());
  const application=own&&!certified?check(await DB.from('mw_group_badge_requests').select('id,status')
    .eq('group_id',id).eq('status','pending').maybeSingle()):null;
  const pending=own?check(await DB.from('mw_group_join_requests')
    .select('id,requester_id').eq('group_id',id).eq('status','pending')):[];
  const map=await users([...members.map(x=>x.user_id),...pending.map(x=>x.requester_id)]);
  // Supabase RLS returns presence only for self and mutually following users.
  const presenceResult=members.length?await DB.from('mw_presence').select('user_id,last_seen_at')
    .in('user_id',members.map(x=>x.user_id)):{data:[],error:null};
  const times=new Map((presenceResult.data||[]).map(x=>[x.user_id,x.last_seen_at]));
  const presenceText=id=>{
    const date=times.get(id);if(!date)return '';
    const d=new Date(date),delta=Date.now()-d.getTime();
    if(!Number.isFinite(delta)||delta<0)return '';
    return delta<120000?' · 🟢 Onlayn':' · oxirgi onlayn '+d.toLocaleString('uz-UZ',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  };
  const membersHtml=members.map(m=>`<div class="mw-member-option mw11-member-manage">
      <button type="button" class="mw11-member-person" data-act="user" data-id="${escape(m.user_id)}">
        ${avatar(map[m.user_id])}
        <span>${label(map[m.user_id])} ${m.user_id===group.owner_id?' · Egasi':''}<small class="muted">${escape(presenceText(m.user_id))}</small></span>
      </button>
      ${own&&m.user_id!==group.owner_id?`<button type="button" class="mw11-kick" data-mw="kick" data-id="${escape(id)}"
        data-user="${escape(m.user_id)}" aria-label="A’zoni guruhdan chiqarish" title="Guruhdan chiqarish">${icon('x',18)}</button>`:''}
    </div>`).join('');
  dialog('Guruh ma’lumotlari',`
    <div class="mw-group-top">
      ${group.avatar_url?'<img class="av large" src="'+escape(group.avatar_url)+'" alt="">':icon('users',40)}
      <div><h3>${escape(group.name)} ${certified?'<span class="mw-verified-chat">✓</span>':''}</h3><p>@${escape(group.username||'maxfiy')}</p><p>${escape(group.bio||'')}</p></div>
    </div>
    <h3>A’zolar · ${members.length}</h3>
    <div class="mw-member-list">${membersHtml}</div>
    ${own&&pending.length?'<h3>Qo‘shilish so‘rovlari ('+pending.length+')</h3>'+
      '<div class="mw-member-list">'+pending.map(req=>'<div class="mw-invite-card">'+
      '<div class="mw-invite-person">'+avatar(map[req.requester_id])+
      '<strong>'+escape(map[req.requester_id]?.display_name||map[req.requester_id]?.username||'Foydalanuvchi')+'</strong></div>'+
      '<div class="buttons"><button class="btn" data-mw="review-join" data-id="'+escape(req.id)+'" data-status="accepted">Qabul qilish</button>'+
      '<button class="btn ghost" data-mw="review-join" data-id="'+escape(req.id)+'" data-status="declined">Rad etish</button></div></div>').join('')+'</div>':''}
    ${own||S.me?.is_admin?'<div class="buttons"><button class="btn ghost" data-v11="theme-open" data-thread="g:'+escape(id)+'">Chat fonini tanlash</button></div>':''}
    ${own&&!certified?'<div class="buttons">'+(application?'<span class="status">Ko‘k belgi arizasi tekshiruvda</span>':'<button class="btn ghost" data-mw="group-badge-apply" data-id="'+escape(id)+'">Guruh uchun ko‘k belgi arizasi</button>')+'</div>':''}
    <div class="buttons">${own?
      '<button class="btn" data-mw="edit-group" data-id="'+escape(id)+'">Tahrirlash / a’zo qo‘shish</button>'+
      '<button class="btn danger" data-mw="delete-group" data-id="'+escape(id)+'">Guruhni o‘chirish</button>':
      '<button class="btn danger" data-mw="leave-group" data-id="'+escape(id)+'">Guruhdan chiqish</button>'}
    </div>`);
 }


 async function invitations(){
  const uid=S.u.id;
  const [invites,owned]=await Promise.all([
    DB.from('mw_group_invitations').select('id,group_id,sender_id')
       .eq('recipient_id',uid).eq('status','pending'),
    DB.from('mw_groups').select('id,name').eq('owner_id',uid)
  ]);
  check(invites);check(owned);
  const ids=owned.data.map(g=>g.id);
  const requests=ids.length?check(await DB.from('mw_group_join_requests')
     .select('id,group_id,requester_id').in('group_id',ids).eq('status','pending')):[];
  const groupsToLookup=[...new Set(invites.data.map(i=>i.group_id))];
  const invitedGroups=groupsToLookup.length?check(await DB.from('mw_groups')
    .select('id,name').in('id',groupsToLookup)):[];
  const names=new Map([...owned.data,...invitedGroups].map(g=>[g.id,g.name]));
  const people=await users([...invites.data.map(i=>i.sender_id),...requests.map(r=>r.requester_id)]);
  dialog('Taklif va so‘rovlar',
    invites.data.map(i=>'<div class="mw-invite-card"><strong>'+escape(names.get(i.group_id)||'Guruh')+'</strong>'+
      '<p>'+escape(people[i.sender_id]?.display_name||people[i.sender_id]?.username||'Foydalanuvchi')+' sizni taklif qildi</p>'+
      '<div class="buttons"><button class="btn" data-mw="answer" data-id="'+escape(i.id)+'" data-status="accepted">Qabul qilish</button>'+
      '<button class="btn ghost" data-mw="answer" data-id="'+escape(i.id)+'" data-status="declined">Rad etish</button></div></div>').join('')+
    requests.map(r=>'<div class="mw-invite-card"><strong>'+escape(names.get(r.group_id)||'Guruh')+'</strong>'+
      '<p>'+escape(people[r.requester_id]?.display_name||people[r.requester_id]?.username||'Foydalanuvchi')+' guruhga qo‘shilmoqchi</p>'+
      '<div class="buttons"><button class="btn" data-mw="review-join" data-id="'+escape(r.id)+'" data-status="accepted">Qabul qilish</button>'+
      '<button class="btn ghost" data-mw="review-join" data-id="'+escape(r.id)+'" data-status="declined">Rad etish</button></div></div>').join('')+
    (!invites.data.length&&!requests.length?'<p class="muted">Hozircha taklif yoki so‘rov yo‘q.</p>':''));
 }

 async function worldInfo(){
  const pref=await worldPref();
  dialog('Umumiy chat','<h3>Umumiy chat</h3><p><strong>@umumiychat</strong></p>'+
   '<p>Minecraft World jamoasining umumiy suhbati. Bu suhbatga barcha yangi va eski akkauntlar avtomatik qo‘shiladi.</p>'+
   '<div class="mw11-info-actions"><button class="btn ghost" data-v11="theme-open" data-thread="world">Chat fonini tanlash</button><button class="btn ghost" data-mw="world-mute">'+(pref.muted?'Ovozni yoqish':'Ovozsiz qilish')+'</button>'+
   '<button class="btn danger" data-mw="world-leave">'+(pref.joined?'Guruhdan chiqish':'Qayta qo‘shilish')+'</button></div>');
 }
 async function action(button){
  const command=button.dataset.mw,id=button.dataset.id;
  if(command==='new-chat')newChat();
  else if(command==='new-group')editGroup();
  else if(command==='more-people')await searchPeople(button.dataset.kind==='members'?C.memberQuery:C.personQuery,button.dataset.kind==='members',true);
  else if(command==='discover-group')await discoverGroup(id);
  else if(command==='request-join')await requestJoin(id);
  else if(command==='review-join'){
   const row=check(await DB.from('mw_group_join_requests').update({status:button.dataset.status,decided_at:new Date().toISOString()})
     .eq('id',id).eq('status','pending').select('group_id').single());
   toast(button.dataset.status==='accepted'?'A’zo guruhga qo‘shildi':'So‘rov rad etildi');
   await info(row.group_id);
  }
  else if(command==='open'){S.mw11MobileOpen=true;await openGroup(id);}
  else if(command==='group-info')await info(id);
  else if(command==='edit-group'){
   const g=check(await DB.from('mw_groups').select('*').eq('id',id).single());
   if(g.owner_id!==S.u.id)throw Error('Faqat guruh egasi tahrirlay oladi');
   editGroup(g);
  }
  else if(command==='kick'){
   const targetId=button.dataset.user;
   const g=check(await DB.from('mw_groups').select('owner_id').eq('id',id).single());
   if(g.owner_id!==S.u.id||targetId===g.owner_id)throw Error('Faqat guruh egasi a’zoni chiqaradi');
   if(!confirm('Bu a’zoni guruhdan chiqarasizmi?'))return;
   const removed=check(await DB.from('mw_group_members').delete().eq('group_id',id)
     .eq('user_id',targetId).select('user_id'));
   if(!removed.length)throw Error('A’zoni chiqarib bo‘lmadi');
   toast('A’zo guruhdan chiqarildi');
   await info(id);
  }
  else if(command==='invites')await invitations();
  else if(command==='answer'){
   check(await DB.from('mw_group_invitations').update({status:button.dataset.status}).eq('id',id).eq('recipient_id',S.u.id));
   close();await load();
  }
  else if(command==='group-badge-apply'){
   const g=check(await DB.from('mw_groups').select('owner_id,name').eq('id',id).single());
   if(g.owner_id!==S.u.id)throw Error('Faqat guruh egasi ariza bera oladi');
   dialog('Guruh uchun ko‘k belgi','<form id="mwGroupBadgeForm" data-id="'+escape(id)+'">'+
    '<p>'+escape(g.name)+' uchun tasdiqlash so‘rovi</p>'+
    '<label>Guruh nima sababdan tasdiqlanishi kerak?</label>'+
    '<textarea class="field" name="reason" minlength="10" maxlength="800" required></textarea>'+
    '<button type="submit" class="btn">Ariza yuborish</button></form>');
  }
  else if(command==='world-info')await worldInfo();
  else if(command==='world-mute'){
   const pref=await worldPref();
   await worldUpdate({muted:!pref.muted});
   await worldInfo();
  }
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
  const visibility=$('#mwVisibilityStatus');
  if(visibility)visibility.textContent=row?.discoverable===false?'Maxfiy':'Ommaviy';
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
  const value=input.value.trim().replace(/^@/,'').toLowerCase();
  const status=$('#mwAccountNameCheck');if(!status)return;
  if(!/^[a-z0-9_]{3,20}$/.test(value)){
    status.textContent='3–20 belgi: a-z, 0-9 yoki _';status.className='mw-username-hint bad';return;
  }
  status.textContent='Tekshirilmoqda…';status.className='mw-username-hint';
  const {data,error}=await DB.rpc('mw_username_available',{candidate:value,kind:'profile'});
  if(!status.isConnected||input.value.trim().replace(/^@/,'').toLowerCase()!==value)return;
  if(error){console.warn(error);status.textContent='Tekshirib bo‘lmadi';status.className='mw-username-hint bad';return;}
  status.textContent=data?'Username bo‘sh':'Username band';
  status.className='mw-username-hint '+(data?'ok':'bad');
 }

 // Capture handles group actions before legacy catch-all click handler; no other features change.
 window.addEventListener('click',ev=>{
  let button=ev.target.closest('[data-mw]');
  if(!button)return;
  if(window.MWV11?.consumeLongPress?.()){ev.preventDefault();ev.stopImmediatePropagation();return;}
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
   if(ev.target.checked){
     const p=C.members.find(x=>x.id===id);
     if(p)C.selectedNames.set(id,p.username);
   }else C.selectedNames.delete(id);
   C.selected=ev.target.checked?[...new Set([...C.selected,id])]:C.selected.filter(x=>x!==id);
   if($('#mwSelectedCount'))$('#mwSelectedCount').textContent=C.selected.length+' kishi tanlandi';
  }
  if(ev.target.closest('#mwGroupForm')&&ev.target.name==='visibility'){
    visibility();if(ev.target.value==='public')usernameStatus().catch(console.warn);
  }
  if(ev.target.id==='mwPublicProfile'){
    const label=$('#mwVisibilityStatus');
    if(label)label.textContent=ev.target.checked?'Ommaviy':'Maxfiy';
  }
  if(ev.target.closest('.mw-avatar-button')&&ev.target.files?.[0]){
   const reader=new FileReader();reader.onload=()=>{
    const l=ev.target.closest('.mw-avatar-button');
    l.querySelector('img')?.remove();
    l.insertAdjacentHTML('afterbegin','<img src="'+reader.result+'" alt="">');
   };reader.readAsDataURL(ev.target.files[0]);
  }
 });
 window.addEventListener('submit',async ev=>{
  const f=ev.target;if(!['mwGroupForm','mwGroupMessage','mwGroupBadgeForm'].includes(f.id))return;
  ev.preventDefault();ev.stopImmediatePropagation();
  const btn=f.querySelector('[type="submit"]');if(btn)btn.disabled=true;
  try{
   if(f.id==='mwGroupForm')await saveGroup(f);
   else if(f.id==='mwGroupBadgeForm'){
    const group_id=f.dataset.id,reason=String(new FormData(f).get('reason')||'').trim();
    check(await DB.from('mw_group_badge_requests').insert({group_id,requester_id:S.u.id,reason}));
    toast('Ko‘k belgi arizasi yuborildi');await info(group_id);
   }else{
    const text=String(new FormData(f).get('body')||'').trim();
    const files=window.MWV11?.selectedAttachments?.(f)||[];
    if(!text&&!files.length)return;
    let lastBody=text;
    for(const [i,file] of (files.length?files:[null]).entries()){
      const media=file?await window.MWV11.uploadAttachment(f,'group',f.dataset.id,file):{};
      const body=(i===0&&text)||(media.attachment_type==='image'?'🖼 Rasm':'📎 '+(media.attachment_name||'Fayl'));
      check(await DB.from('mw_group_messages').insert({group_id:f.dataset.id,sender_id:S.u.id,body,...media,
        reply_to:i===0?(window.MWV11?.replyId?.('group','g:'+f.dataset.id)||null):null}));
      lastBody=body;
    }
    f.reset();window.MWV11?.clearAttachment?.(f);window.MWV11?.clearReply?.();
    C.last[f.dataset.id]=Date.now();C.preview[f.dataset.id]='Siz: '+lastBody.slice(0,65);await openGroup(f.dataset.id);
    window.mwMaybeExpireImages?.().catch(console.warn);
   }
  }catch(err){console.error(err);toast(err.code==='23505'?'Username band':err.message)}
  finally{if(btn)btn.disabled=false}
 },true);
 return {load,renderGroups,openGroup,worldInfo,loadProfileSettings,saveProfileSettings,groups:()=>C.groups,activity:id=>C.last[id]||0};
})();
