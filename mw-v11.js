/* Minecraft World v1.1 — authenticated messenger UI extensions.
   Message permissions are enforced by Supabase RLS, not by this script. */
window.MWV11=(()=>{
  const V={rows:new Map(),prefs:new Map(),reply:null,filter:'all',search:'',activeMessage:null,loadedFor:null,longPressTimer:null,longPressTriggered:false};
  const esc=e;
  const messages={
    uz:{all:'Barchasi',unread:'O‘qilmagan',archive:'Arxiv',search:'Chat yoki @username qidirish',reply:'Javob berish',edit:'Tahrirlash',remove:'O‘chirish',copy:'Nusxalash',forward:'Uzatish',reaction:'Reaksiya',save:'Saqlash',pinned:'Mahkamlangan',pin:'Mahkamlash',unpin:'Mahkamlashni olib tashlash',mute:'Ovozsiz',unmute:'Ovozni yoqish',arch:'Arxivlash',unarch:'Arxivdan chiqarish',deleteAsk:'Xabarni o‘chirasizmi?',confirm:'Saqlash',replying:'Javob',searchMsg:'Xabar ichidan qidirish',empty:'Hozircha hech narsa topilmadi',newMsg:'Yangi xabar',noReply:'Xabar',self:'Siz'},
    ru:{all:'Все',unread:'Непрочитанные',archive:'Архив',search:'Поиск чатов или @username',reply:'Ответить',edit:'Изменить',remove:'Удалить',copy:'Копировать',forward:'Переслать',reaction:'Реакция',save:'Сохранить',pinned:'Закреплено',pin:'Закрепить',unpin:'Открепить',mute:'Без звука',unmute:'Включить звук',arch:'В архив',unarch:'Из архива',deleteAsk:'Удалить сообщение?',confirm:'Сохранить',replying:'Ответ',searchMsg:'Поиск в сообщениях',empty:'Ничего не найдено',newMsg:'Новое сообщение',noReply:'Сообщение',self:'Вы'},
    en:{all:'All',unread:'Unread',archive:'Archive',search:'Search chats or @username',reply:'Reply',edit:'Edit',remove:'Delete',copy:'Copy',forward:'Forward',reaction:'React',save:'Save',pinned:'Pinned',pin:'Pin',unpin:'Unpin',mute:'Mute',unmute:'Unmute',arch:'Archive',unarch:'Unarchive',deleteAsk:'Delete this message?',confirm:'Save',replying:'Reply',searchMsg:'Find messages',empty:'Nothing found',newMsg:'New message',noReply:'Message',self:'You'}
  };
  const T=k=>(messages[S.lang]||messages.uz)[k]||messages.uz[k]||k;
  const scopeKey=scope=>scope==='world'?'world':scope==='group'?S.chatId:'u:'+S.chatId;
  const rxKey=(scope,id)=>scope+':'+id;
  const authUser=()=>S.u?.id;
  const author=(m,scope)=>scope==='world'?m.author_id:m.sender_id;
  const isMine=(m,scope)=>!!authUser()&&author(m,scope)===authUser();
  function bubble(m,scope,rows=[]){
    const mine=isMine(m,scope),id=m.id;
    if(!id)return chatBubble(m.body,mine,chatTime(m.created_at));
    V.rows.set(rxKey(scope,id),m);
    const reply=rows.find(row=>row.id===m.reply_to);
    const quote=m.reply_to?'<div class="mw11-quote">'+esc((reply?.body||T('noReply')).slice(0,130))+'</div>':'';
    return '<div class="bubble '+(mine?'mine':'')+' mw11-bubble" tabindex="0" role="button" aria-label="Xabar amallari" data-v11-msg="'+esc(id)+'" data-v11-scope="'+scope+'">'+
      quote+'<div class="bubble-body">'+esc(m.body||'')+'</div>'+
      '<div class="mw11-footer"><small>'+esc(chatTime(m.created_at))+(m.edited_at?' · ✎':'')+(mine?' ✓':'')+'</small></div>'+
      '<div class="mw11-reaction-list" data-v11-reactions="'+esc(id)+'"></div></div>';
  }
  function afterRender(rows,scope){
    if(!rows?.length)return;
    for(const m of rows)if(m.id)V.rows.set(rxKey(scope,m.id),m);
    const ids=rows.map(m=>m.id).filter(Boolean);
    if(!ids.length)return;
    DB.from('mw_message_reactions').select('message_id,user_id,emoji').eq('scope',scope).in('message_id',ids).then(({data,error})=>{
      if(error){console.warn('Reactions:',error.message);return}
      const map=new Map();
      for(const row of data||[]){
        const k=row.message_id+':'+row.emoji;
        const v=map.get(k)||{emoji:row.emoji,id:row.message_id,count:0,mine:false};
        v.count++;if(row.user_id===authUser())v.mine=true;map.set(k,v);
      }
      for(const id of ids){
        const container=document.querySelector('.mw11-bubble[data-v11-msg="'+id+'"] [data-v11-reactions="'+id+'"]');
        if(!container)continue;
        const chips=[...map.values()].filter(x=>x.id===id);
        container.innerHTML=chips.map(c=>'<button type="button" class="mw11-react-chip '+(c.mine?'mine':'')+'" data-v11="react" data-scope="'+scope+'" data-id="'+esc(id)+'" data-emoji="'+esc(c.emoji)+'">'+esc(c.emoji)+' '+c.count+'</button>').join('');
      }
    }).catch(console.warn);
  }
  function replyId(scope,thread){
    return V.reply?.scope===scope&&V.reply.thread===thread?V.reply.id:null;
  }
  function clearReply(){
    V.reply=null;
    const node=document.getElementById('mw11ReplyBar');
    if(node)node.remove();
  }
  function replyTo(m,scope){
    V.reply={scope,id:m.id,body:m.body||'',thread:scopeKey(scope)};
    close();
    const form=document.querySelector('#conversation .chat-compose');
    if(!form)return;
    document.getElementById('mw11ReplyBar')?.remove();
    form.insertAdjacentHTML('afterbegin','<div class="mw11-reply-bar" id="mw11ReplyBar">'+
      '<span><strong>'+T('replying')+'</strong><small>'+esc(V.reply.body.slice(0,150))+'</small></span>'+
      '<button type="button" data-v11="clear-reply" aria-label="Bekor qilish">×</button></div>');
    form.querySelector('input[name="body"]')?.focus();
  }
  async function loadPrefs(){
    if(!authUser())return;
    const uid=authUser();
    if(V.loadedFor&&V.loadedFor!==uid){V.rows.clear();V.reply=null;V.prefs.clear();V.filter='all';V.search='';}
    const r=await DB.from('mw_chat_preferences').select('thread_key,muted,pinned,archived,last_read_at').eq('user_id',uid);
    if(r.error){console.warn(r.error);return}
    if(uid!==authUser())return;
    V.prefs=new Map((r.data||[]).map(x=>[x.thread_key,x]));
    V.loadedFor=uid;
    decorateInbox();
  }
  function getPref(thread){return V.prefs.get(thread)||{thread_key:thread,pinned:false,muted:false,archived:false,last_read_at:null}}
  function isMuted(thread){return !!getPref(thread).muted}
  async function changePref(thread,field){
    if(!authUser())return;
    const pref=getPref(thread),next={...pref,[field]:!pref[field]};
    const save={user_id:authUser(),thread_key:thread,muted:!!next.muted,pinned:!!next.pinned,archived:!!next.archived,
      last_read_at:next.last_read_at||null,updated_at:new Date().toISOString()};
    const r=await DB.from('mw_chat_preferences').upsert(save,{onConflict:'user_id,thread_key'});
    if(r.error)throw r.error;
    V.prefs.set(thread,next);close();chatRows();decorateInbox();
  }
  async function markRead(thread){
    if(!authUser())return;
    const pref=getPref(thread),value={user_id:authUser(),thread_key:thread,muted:!!pref.muted,
      pinned:!!pref.pinned,archived:!!pref.archived,last_read_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    V.prefs.set(thread,value);
    const r=await DB.from('mw_chat_preferences').upsert(value,{onConflict:'user_id,thread_key'});
    if(r.error)console.warn('Mark read:',r.error.message);
    decorateInbox();
  }
  function decorateInbox(){
    const rows=document.getElementById('chatRows');
    if(!rows||S.page!=='chat')return;
    const title=document.querySelector('.chat-title');
    if(title&&!document.getElementById('mw11SavedOpen')){
      title.insertAdjacentHTML('beforeend','<button type="button" class="btn small ghost" id="mw11SavedOpen" data-v11="saved-open">'+ico('bookmark',17)+' '+T('save')+'</button>');
    }
    if(title&&!document.getElementById('mw11InboxControls')){
      title.insertAdjacentHTML('afterend','<div class="mw11-inbox-controls" id="mw11InboxControls">'+
        '<input type="search" id="mw11InboxSearch" class="field" placeholder="'+T('search')+'" value="'+esc(V.search)+'">'+
        '<div class="mw11-tabs">'+['all','unread','archive'].map(k=>'<button type="button" data-v11="filter" data-filter="'+k+'" class="'+(V.filter===k?'active':'')+'">'+T(k)+'</button>').join('')+'</div></div>');
    }
    const list=[...rows.querySelectorAll('.chat-peer')];
    const activity=p=>{
      const id=p.dataset.id||'';
      const key=p.classList.contains('mw-group-item')?'g:'+id:id==='world'?'world':'u:'+id;
      if(key==='world')return S.mwWorldTime||0;
      if(key.startsWith('g:'))return window.MWChat?.activity?.(id)||0;
      return S.mwDirectTimes?.[id]||0;
    };
    const keyOf=p=>{
      const id=p.dataset.id;
      return p.classList.contains('mw-group-item')?'g:'+id:id==='world'?'world':'u:'+id;
    };
    list.sort((a,b)=>Number(getPref(keyOf(b)).pinned)-Number(getPref(keyOf(a)).pinned)||activity(b)-activity(a));
    for(const p of list){
      const thread=keyOf(p),pref=getPref(thread);
      const label=(p.textContent||'').toLowerCase();
      const unread=!!p.querySelector('.chat-unread')||
        (thread.startsWith('g:')&&activity(p)>new Date(pref.last_read_at||'1970-01-01').getTime());
      p.hidden=(!((V.filter==='archive')===!!pref.archived))||
        (V.filter==='unread'&&!unread)||
        (V.search&&!label.includes(V.search.toLowerCase()));
      const old=p.querySelector('.mw11-chat-options');if(old)old.remove();
      p.dataset.mw11Thread=thread;
      p.title='Chatni ochish · Sozlamalar uchun bosib turing';
      let flag=p.querySelector('.mw11-chat-flag');if(flag)flag.remove();
      if(pref.pinned||pref.muted){
        p.insertAdjacentHTML('beforeend','<span class="mw11-chat-flag">'+(pref.pinned?'📌':'')+(pref.muted?'🔕':'')+'</span>');
      }
      rows.append(p);
    }
    let empty=document.getElementById('mw11NoResults');
    if(!empty){rows.insertAdjacentHTML('beforeend','<p class="muted mw11-no-results" id="mw11NoResults">'+T('empty')+'</p>');empty=document.getElementById('mw11NoResults')}
    if(empty)empty.hidden=list.some(p=>!p.hidden);
  }
  async function fetchMessage(scope,id){
    const existing=V.rows.get(rxKey(scope,id));if(existing)return existing;
    const table=scope==='group'?'mw_group_messages':scope==='world'?'world_chat_messages':'messages';
    const res=await DB.from(table).select('*').eq('id',id).maybeSingle();
    if(res.error)throw res.error;
    if(res.data)V.rows.set(rxKey(scope,id),res.data);
    return res.data;
  }
  async function menu(scope,id){
    const m=await fetchMessage(scope,id);if(!m)return;
    V.activeMessage={scope,id};
    const own=isMine(m,scope),emoji=['👍','❤️','😂','🔥','👏','😮','🎉','😢'];
    dialog(S.lang==='ru'?'Действия с сообщением':S.lang==='en'?'Message actions':'Xabar amallari','<div class="mw11-menu-text">'+esc(m.body||'')+'</div>'+
      '<div class="mw11-emoji-row">'+emoji.map(em=>'<button type="button" data-v11="react" data-id="'+esc(id)+'" data-scope="'+scope+'" data-emoji="'+em+'">'+em+'</button>').join('')+'</div>'+
      '<div class="mw11-actions">'+
      '<button data-v11="reply" data-id="'+esc(id)+'" data-scope="'+scope+'">'+ico('chat',18)+' '+T('reply')+'</button>'+
      '<button data-v11="copy" data-id="'+esc(id)+'" data-scope="'+scope+'">'+ico('bookmark',18)+' '+T('copy')+'</button>'+
      '<button data-v11="forward" data-id="'+esc(id)+'" data-scope="'+scope+'">'+ico('send',18)+' '+T('forward')+'</button>'+
      '<button data-v11="save" data-id="'+esc(id)+'" data-scope="'+scope+'">'+ico('bookmark',18)+' '+T('save')+'</button>'+
      (own?'<button data-v11="edit" data-id="'+esc(id)+'" data-scope="'+scope+'">'+ico('settings',18)+' '+T('edit')+'</button>'+
        '<button class="danger-text" data-v11="delete" data-id="'+esc(id)+'" data-scope="'+scope+'">'+ico('x',18)+' '+T('remove')+'</button>':'')+'</div>');
  }
  function editForm(scope,id,m){
    dialog(T('edit'),'<form id="mw11EditMessage" data-scope="'+scope+'" data-id="'+esc(id)+'">'+
      '<textarea class="field" name="body" maxlength="2000" required rows="4">'+esc(m.body||'')+'</textarea>'+
      '<button class="btn" type="submit">'+T('confirm')+'</button></form>');
  }
  async function saveEdit(form){
    const scope=form.dataset.scope,id=form.dataset.id,body=String(new FormData(form).get('body')||'').trim();
    if(!body||body.length>2000)throw Error('Xabar 1–2000 belgi bo‘lishi kerak');
    const table=scope==='group'?'mw_group_messages':scope==='world'?'world_chat_messages':'messages';
    const col=scope==='world'?'author_id':'sender_id';
    const r=await DB.from(table).update({body,edited_at:new Date().toISOString()}).eq('id',id).eq(col,authUser()).select('id');
    if(r.error)throw r.error;
    if(!r.data?.length)throw Error('Xabarni faqat muallif tahrirlay oladi');
    V.rows.delete(rxKey(scope,id));
    close();await refreshThread();
  }
  async function deleteMessage(scope,id){
    if(!confirm(T('deleteAsk')))return;
    const table=scope==='group'?'mw_group_messages':scope==='world'?'world_chat_messages':'messages';
    const col=scope==='world'?'author_id':'sender_id';
    const r=await DB.from(table).delete().eq('id',id).eq(col,authUser()).select('id');
    if(r.error)throw r.error;
    if(!r.data?.length)throw Error('Bu xabarni o‘chirishga ruxsat yo‘q');
    V.rows.delete(rxKey(scope,id));
    close();await refreshThread();
  }
  async function react(scope,id,emoji){
    const base=DB.from('mw_message_reactions');
    const prev=await base.select('emoji').eq('scope',scope).eq('message_id',id).eq('user_id',authUser()).maybeSingle();
    if(prev.error)throw prev.error;
    let res;
    if(prev.data?.emoji===emoji){
      res=await DB.from('mw_message_reactions').delete().eq('scope',scope).eq('message_id',id).eq('user_id',authUser());
    }else if(prev.data){
      res=await DB.from('mw_message_reactions').update({emoji}).eq('scope',scope).eq('message_id',id).eq('user_id',authUser());
    }else{
      res=await DB.from('mw_message_reactions').insert({scope,message_id:id,user_id:authUser(),emoji});
    }
    if(res.error)throw res.error;
    close();const row=V.rows.get(rxKey(scope,id));if(row)afterRender([row],scope);
  }

  async function saveMessage(scope,id){
    const m=await fetchMessage(scope,id);
    if(!m)throw Error('Xabar topilmadi');
    const r=await DB.from('mw_saved_messages').insert({user_id:authUser(),scope,message_id:id,body_snapshot:m.body||''});
    if(r.error&&r.error.code!=='23505')throw r.error;
    close();toast(r.error?.code==='23505'?'Bu xabar avval saqlangan':'Xabar saqlandi');
  }
  async function savedMessages(){
    if(!authUser())return;
    const r=await DB.from('mw_saved_messages').select('id,scope,message_id,body_snapshot,created_at').eq('user_id',authUser()).order('created_at',{ascending:false}).limit(100);
    if(r.error)throw r.error;
    dialog(T('save'),'<div class="mw11-saved-list">'+(r.data||[]).map(row=>
      '<div class="mw11-saved-item"><span><small>'+esc(row.scope==='dm'?'Shaxsiy':row.scope==='group'?'Guruh':'Umumiy')+' · '+esc(new Date(row.created_at).toLocaleDateString())+'</small>'+
      '<strong>'+esc(row.body_snapshot||'')+'</strong></span>'+
      '<button data-v11="saved-delete" data-id="'+esc(row.id)+'" title="'+T('remove')+'">'+ico('x',17)+'</button></div>').join('')+
      (r.data?.length?'':'<p class="muted">'+T('empty')+'</p>')+'</div>');
  }
  async function deleteSaved(id){
    const res=await DB.from('mw_saved_messages').delete().eq('user_id',authUser()).eq('id',id);
    if(res.error)throw res.error;
    await savedMessages();
  }

  async function refreshThread(){
    if(S.page!=='chat')return;
    if(S.chatId?.startsWith('g:'))await window.MWChat?.openGroup?.(S.chatId.slice(2));
    else if(S.chatId==='world')await worldConversation();
    else if(S.chatId)await conversation(S.chatId);
  }
  async function forwardMenu(scope,id){
    const m=await fetchMessage(scope,id);if(!m)return;
    V.activeMessage={scope,id};
    const directs=(S.chatPeers||[]).filter(x=>x!==authUser());
    const groups=window.MWChat?.groups?.()||[];
    dialog(T('forward'),'<div class="mw11-actions">'+
      '<button data-v11="forward-send" data-dest="world">'+ico('globe',17)+' Umumiy chat</button>'+
      directs.map(x=>'<button data-v11="forward-send" data-dest="u:'+esc(x)+'">'+ico('user',17)+' '+esc(S.chatUsers?.[x]?.display_name||S.chatUsers?.[x]?.username||x.slice(0,8))+'</button>').join('')+
      groups.map(x=>'<button data-v11="forward-send" data-dest="g:'+esc(x.id)+'">'+ico('users',17)+' '+esc(x.name)+'</button>').join('')+'</div>');
  }
  async function forwardTo(dest){
    const ref=V.activeMessage,m=ref?await fetchMessage(ref.scope,ref.id):null;
    if(!m||!m.body)throw Error('Xabar topilmadi');
    const body='↪ '+m.body.slice(0,1998);
    let r;
    if(dest==='world')r=await DB.from('world_chat_messages').insert({author_id:authUser(),body});
    else if(dest.startsWith('g:'))r=await DB.from('mw_group_messages').insert({group_id:dest.slice(2),sender_id:authUser(),body});
    else r=await DB.from('messages').insert({sender_id:authUser(),recipient_id:dest.slice(2),body});
    if(r.error)throw r.error;
    close();
    S.chatId=dest.startsWith('u:')?dest.slice(2):dest;
    await go('chat');
  }
  function chatOptions(thread){
    const pref=getPref(thread);
    dialog('Chat', '<div class="mw11-actions">'+
      '<button data-v11="pref" data-thread="'+esc(thread)+'" data-field="pinned">'+ico('bookmark',18)+' '+T(pref.pinned?'unpin':'pin')+'</button>'+
      '<button data-v11="pref" data-thread="'+esc(thread)+'" data-field="muted">'+ico('bell',18)+' '+T(pref.muted?'unmute':'mute')+'</button>'+
      '<button data-v11="pref" data-thread="'+esc(thread)+'" data-field="archived">'+ico('folder',18)+' '+T(pref.archived?'unarch':'arch')+'</button></div>');
  }
  function handle(e){
    if(V.longPressTriggered){V.longPressTriggered=false;e.preventDefault();e.stopImmediatePropagation();return}
    const a=e.target.closest('[data-v11]');
    if(!a){
      const bubble=e.target.closest('.mw11-bubble[data-v11-msg]');
      if(bubble&&!e.target.closest('.mw11-react-chip')){
        e.preventDefault();e.stopImmediatePropagation();
        menu(bubble.dataset.v11Scope,bubble.dataset.v11Msg).catch(err=>toast(err.message));
      }
      return;
    }
    e.preventDefault();e.stopImmediatePropagation();
    const act=a.dataset.v11,scope=a.dataset.scope,id=a.dataset.id;
    const run=async()=>{
      if(act==='back-thread')return backMobileThread();
      if(act==='search-toggle'){
        const header=document.querySelector('#conversation .chat-toolbar');
        if(!header)return;
        const old=document.getElementById('mw11ChatSearch');
        if(old){old.closest('.mw11-thread-search')?.remove();document.querySelectorAll('#msgs [data-v11-msg]').forEach(n=>n.style.display='');return}
        header.insertAdjacentHTML('afterend','<div class="mw11-thread-search"><input id="mw11ChatSearch" class="field" placeholder="'+T('searchMsg')+'"></div>');
        document.getElementById('mw11ChatSearch')?.focus();
        return;
      }
      if(act==='saved-open')return savedMessages();
      if(act==='saved-delete')return deleteSaved(id);
      if(act==='menu')return menu(scope,id);
      if(act==='options')return chatOptions(a.dataset.thread);
      if(act==='filter'){V.filter=a.dataset.filter;document.querySelectorAll('.mw11-tabs button').forEach(x=>x.classList.toggle('active',x.dataset.filter===V.filter));return decorateInbox()}
      if(act==='clear-reply'){clearReply();return}
      if(act==='pref')return changePref(a.dataset.thread,a.dataset.field);
      if(act==='react')return react(scope,id,a.dataset.emoji);
      const m=scope&&id?await fetchMessage(scope,id):null;
      if(act==='reply'&&m)return replyTo(m,scope);
      if(act==='edit'&&m&&isMine(m,scope))return editForm(scope,id,m);
      if(act==='delete'&&m&&isMine(m,scope))return deleteMessage(scope,id);
      if(act==='copy'&&m){await navigator.clipboard.writeText(m.body||'');close();toast(T('copy'));return}
      if(act==='forward')return forwardMenu(scope,id);
      if(act==='save'&&m)return saveMessage(scope,id);
      if(act==='forward-send')return forwardTo(a.dataset.dest);
    };
    run().catch(err=>{console.error('MWV11:',err);toast(err.message||'Xatolik')});
  }
  // Telegram-like press-and-hold: per-chat settings without intrusive dots.
  let pressX=0,pressY=0;
  window.addEventListener('pointerdown',ev=>{
    const node=ev.target.closest('#chatRows .chat-peer[data-mw11-thread]');
    if(!node||ev.pointerType==='mouse')return;
    pressX=ev.clientX;pressY=ev.clientY;
    clearTimeout(V.longPressTimer);
    V.longPressTimer=setTimeout(()=>{
      V.longPressTriggered=true;
      chatOptions(node.dataset.mw11Thread);
    },540);
  },true);
  window.addEventListener('pointermove',ev=>{
    if(Math.abs(ev.clientX-pressX)>12||Math.abs(ev.clientY-pressY)>12)clearTimeout(V.longPressTimer);
  },true);
  for(const name of ['pointerup','pointercancel','scroll'])
    window.addEventListener(name,()=>clearTimeout(V.longPressTimer),true);
  window.addEventListener('contextmenu',ev=>{
    const bubble=ev.target.closest('.mw11-bubble[data-v11-msg]');
    const chat=ev.target.closest('#chatRows .chat-peer[data-mw11-thread]');
    if(!bubble&&!chat)return;
    ev.preventDefault();ev.stopImmediatePropagation();
    if(bubble)menu(bubble.dataset.v11Scope,bubble.dataset.v11Msg).catch(err=>toast(err.message));
    else chatOptions(chat.dataset.mw11Thread);
  },true);
  window.addEventListener('click',handle,true);
  window.addEventListener('keydown',event=>{
    if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-v11="options"]'))handle(event);
  },true);
  window.addEventListener('input',event=>{
    if(event.target.id==='mw11InboxSearch'){V.search=event.target.value;decorateInbox()}
    if(event.target.id==='mw11ChatSearch'){
      const value=event.target.value.toLowerCase();
      document.querySelectorAll('#msgs [data-v11-msg]').forEach(node=>{
        node.style.display=node.textContent.toLowerCase().includes(value)?'':'none';
      });
    }
  },true);
  window.addEventListener('submit',event=>{
    const form=event.target;if(form.id!=='mw11EditMessage')return;
    event.preventDefault();event.stopImmediatePropagation();
    const btn=form.querySelector('[type="submit"]');if(btn)btn.disabled=true;
    saveEdit(form).catch(err=>{console.error(err);toast(err.message)}).finally(()=>{if(btn)btn.disabled=false});
  },true);
  function addThreadSearch(){
    const bar=document.querySelector('#conversation .chat-toolbar');
    if(!bar||document.getElementById('mw11SearchToggle'))return;
    bar.insertAdjacentHTML('beforeend','<button type="button" id="mw11SearchToggle" data-v11="search-toggle" aria-label="'+T('searchMsg')+'">'+ico('search',18)+'</button>');
  }

  // Mobile split-view navigation follows the original V1.1 test design.
  function resetMobileThread(){
    S.mw11MobileOpen=false;
    document.body.classList.remove('mw11-thread-mode');
    document.querySelector('#app')?.classList.remove('mw11-mobile-thread-open');
  }
  function prepareChatScreen(){
    document.querySelector('#app')?.classList.add('mw11-chat-page');
    const mobile=window.matchMedia('(max-width:760px)').matches;
    if(!mobile){document.body.classList.remove('mw11-thread-mode');return}
    document.body.classList.toggle('mw11-thread-mode',!!S.mw11MobileOpen);
    document.querySelector('#app')?.classList.toggle('mw11-mobile-thread-open',!!S.mw11MobileOpen);
    if(!S.mw11MobileOpen){
      const container=document.querySelector('#app');
      if(container)container.scrollIntoView({block:'start'});
    }
  }
  function openMobileThread(){
    S.mw11MobileOpen=true;
    if(!window.matchMedia('(max-width:760px)').matches)return;
    document.querySelector('#app')?.classList.add('mw11-chat-page','mw11-mobile-thread-open');
    document.body.classList.add('mw11-thread-mode');
    const toolbar=document.querySelector('#conversation .chat-toolbar');
    if(toolbar&&!toolbar.querySelector('[data-v11="back-thread"]')){
      toolbar.insertAdjacentHTML('afterbegin','<button type="button" class="mw11-back-thread" data-v11="back-thread" aria-label="Orqaga">'+
        ico('back',24)+'</button>');
    }
    document.querySelector('#conversation .messages')?.scrollTo?.({top:100000,behavior:'instant'});
  }
  function backMobileThread(){
    S.mw11MobileOpen=false;
    document.body.classList.remove('mw11-thread-mode');
    document.querySelector('#app')?.classList.remove('mw11-mobile-thread-open');
    clearReply();
    if(S.page==='chat'){
      document.querySelector('#mw11InboxSearch')?.focus?.({preventScroll:true});
      document.activeElement?.blur?.();
    }
  }

  return {bubble,afterRender,replyId,clearReply,loadPrefs,markRead,isMuted,decorateInbox,addThreadSearch,resetMobileThread,prepareChatScreen,openMobileThread,backMobileThread};
})();
