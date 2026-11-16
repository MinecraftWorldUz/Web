/* Minecraft World: authenticated Instagram-style posts for existing profile page */
window.MWSocial=(()=>{
 const escape=e;
 let currentProfile=null,currentPost=null;
 async function renderProfile(id){
  currentProfile=id;
  if(!S.u||S.page!=='profile'||S.profileId!==id)return;
  const host=$('#mwSocialSection');if(!host)return;
  const r=DB.from('mw_social_posts').select('id,author_id,body,image_url,created_at').eq('author_id',id)
    .order('created_at',{ascending:false}).limit(80);
  const result=check(await r);
  if(S.page!=='profile'||S.profileId!==id||!host.isConnected)return;
  const countEl=$('#mwSocialPostCount');
  if(countEl)countEl.textContent=String(result.length);
  const addButton=S.u.id===id?'<button class="btn small" data-social="new">'+ico('plus',16)+' Yangi post</button>':'';
  host.innerHTML='<div class="bar mw-social-heading"><h2>Postlar</h2>'+addButton+'</div>'+
    (result.length?
      '<div class="mw-social-grid">'+result.map(p=>
        '<button type="button" class="mw-social-tile" data-social="open" data-id="'+escape(p.id)+'">'+
        (p.image_url?'<img loading="lazy" src="'+escape(p.image_url)+'" alt="">':
          '<div class="mw-social-text">'+escape(p.body.slice(0,90))+'</div>')+
        '</button>').join('')+'</div>':
      '<div class="mw-social-empty"><span class="empty-icon">▧</span>'+
      '<h3>Hozircha postlar yo‘q</h3>'+
      '<p>Rasm yoki matn bilan ilk postingizni ulashing.</p></div>');
 }
 function newPost(){
  dialog('Yangi post','<form id="mwSocialPostForm">'+
   '<label class="mw-social-photo">'+ico('upload',29)+' Rasm qo‘shish (ixtiyoriy)'+
    '<input type="file" name="image" accept="image/png,image/jpeg,image/webp"></label>'+
   '<div class="mw-social-preview" id="mwSocialPreview"></div>'+
   '<div class="formgroup"><label>Izoh</label><textarea class="field" name="body" maxlength="1500" placeholder="Nimalar bilan bo‘lishmoqchisiz?"></textarea></div>'+
   '<button type="submit" class="btn">Postni joylash</button></form>');
 }
 async function savePost(form){
  if(!S.u)return;
  const fd=new FormData(form),body=String(fd.get('body')||'').trim(),file=fd.get('image');
  let image_url=null;
  if(file?.size){
   if(file.size>2097152||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Rasm 2 MB dan oshmasin (JPEG, PNG, WebP)');
   const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
   const path=S.u.id+'/'+crypto.randomUUID()+'.'+ext;
   const uploadResult=await DB.storage.from('mw-social').upload(path,file,{contentType:file.type,upsert:false});
   check(uploadResult);
   image_url=DB.storage.from('mw-social').getPublicUrl(path).data.publicUrl;
  }
  if(!body&&!image_url)throw Error('Rasm yoki matn kerak');
  check(await DB.from('mw_social_posts').insert({author_id:S.u.id,body,image_url}));
  close();if(S.page==='profile')await renderProfile(S.profileId);
  toast('Post joylandi');
 }
 async function openPost(id){
  if(!S.u)return;
  currentPost=id;
  const post=check(await DB.from('mw_social_posts').select('*').eq('id',id).single());
  const [likes,comments]=await Promise.all([
   DB.from('mw_social_likes').select('user_id').eq('post_id',id),
   DB.from('mw_social_comments').select('id,author_id,body,created_at').eq('post_id',id).order('created_at',{ascending:true}).limit(100)
  ]);
  check(likes);check(comments);
  const usersById=await users([post.author_id,...comments.data.map(x=>x.author_id)]);
  dialog('Post','<div class="mw-post-owner">'+avatar(usersById[post.author_id])+
   '<b>'+escape(usersById[post.author_id]?.display_name||usersById[post.author_id]?.username||'Profil')+'</b></div>'+
   (post.image_url?'<img class="mw-post-image" src="'+escape(post.image_url)+'" alt="">':'')+
   '<p class="wrap">'+escape(post.body)+'</p><div class="buttons">'+
   '<button class="btn ghost" data-social="like" data-id="'+escape(id)+'">'+
    (likes.data.some(x=>x.user_id===S.u.id)?'❤️':'♡')+' '+likes.data.length+'</button>'+
   (S.u.id===post.author_id?'<button class="btn danger" data-social="delete" data-id="'+escape(id)+'">O‘chirish</button>':'')+'</div>'+
   '<h3>Izohlar ('+comments.data.length+')</h3><div class="mw-comments">'+comments.data.map(c=>'<div class="mw-comment"><b>'+
    escape(usersById[c.author_id]?.display_name||usersById[c.author_id]?.username||'Foydalanuvchi')+'</b> '+escape(c.body)+'</div>').join('')+'</div>'+
   '<form id="mwSocialCommentForm" data-id="'+escape(id)+'"><div class="chat-compose"><input class="field" name="body" maxlength="500" placeholder="Izoh yozing..." required>'+
   '<button type="submit" class="btn">'+ico('send',18)+'</button></div></form>');
 }
 async function toggleLike(id){
  const prev=check(await DB.from('mw_social_likes').select('user_id').eq('post_id',id).eq('user_id',S.u.id).maybeSingle());
  if(prev)check(await DB.from('mw_social_likes').delete().eq('post_id',id).eq('user_id',S.u.id));
  else check(await DB.from('mw_social_likes').insert({post_id:id,user_id:S.u.id}));
  await openPost(id);
 }
 async function addComment(form){
  const body=String(new FormData(form).get('body')||'').trim();
  if(!body)return;
  check(await DB.from('mw_social_comments').insert({post_id:form.dataset.id,author_id:S.u.id,body}));
  await openPost(form.dataset.id);
 }
 async function removePost(id){
  if(!confirm('Post o‘chirilsinmi?'))return;
  check(await DB.from('mw_social_posts').delete().eq('id',id).eq('author_id',S.u.id));
  close();if(S.page==='profile')await renderProfile(S.profileId);
 }
 window.addEventListener('click',ev=>{
  const el=ev.target.closest('[data-social]');if(!el)return;
  ev.preventDefault();ev.stopImmediatePropagation();
  const kind=el.dataset.social,id=el.dataset.id;
  (kind==='new'?Promise.resolve(newPost()):
   kind==='open'?openPost(id):
   kind==='like'?toggleLike(id):
   kind==='delete'?removePost(id):Promise.resolve()).catch(err=>{console.error(err);toast(err.message)});
 },true);
 window.addEventListener('submit',ev=>{
  const form=ev.target;if(!['mwSocialPostForm','mwSocialCommentForm'].includes(form.id))return;
  ev.preventDefault();ev.stopImmediatePropagation();
  const btn=form.querySelector('[type="submit"]');if(btn)btn.disabled=true;
  (form.id==='mwSocialPostForm'?savePost(form):addComment(form)).catch(err=>{console.error(err);toast(err.message)}).finally(()=>{if(btn)btn.disabled=false});
 },true);
 window.addEventListener('change',ev=>{
  if(ev.target.closest('.mw-social-photo')&&ev.target.files?.[0]){
   const reader=new FileReader();reader.onload=()=>{const el=$('#mwSocialPreview');if(el)el.innerHTML='<img src="'+reader.result+'" alt="">';};reader.readAsDataURL(ev.target.files[0]);
  }
 });
 return {renderProfile};
})();
