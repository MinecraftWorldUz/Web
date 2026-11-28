/* Original procedural voxel landscapes: no external files or game UI. */
window.MWLandscapes=(()=>{
const palettes={"forest":["#83c9ed","#e4f7ff","#789b78","#63864c","#315e37","#416b39","#79513a"],"stone":["#92cdec","#e8f7ff","#869fa8","#8a9696","#53737b","#667b79","#6e6256"],"grass":["#75cbd8","#ddf9dc","#7fae82","#61a454","#24653d","#3b8c4c","#755342"],"oak":["#a2d7f7","#fff1ce","#a1b57a","#84ae52","#477e39","#659947","#795039"],"sunset":["#f69d89","#ffe8a8","#ae8290","#c79554","#6a7440","#8b9251","#795238"],"night":["#233964","#8abcc8","#3d5771","#426375","#235768","#327d8c","#354556"],"desert":["#80c5ec","#fff3ca","#c6a67b","#e3c080","#b68d55","#d8af6c","#876c50"],"nether":["#6d2638","#ff9c57","#794051","#a44936","#702b39","#9c3a33","#4f2b38"],"ocean":["#75c2ed","#e1fcff","#8cbfc3","#79ae93","#286c75","#58a3a9","#796c54"],"sky":["#a0d7f6","#fff9ef","#a0b9cc","#e6f1f5","#8ba9bc","#c9dce4","#7a8791"],"autumn":["#87b9dd","#e1e8db","#8a9e87","#b2a15a","#37765a","#528d59","#654e38"],"embers":["#6c263b","#ffb55e","#7f3f48","#ab583d","#702c38","#a34633","#5d3440"],"snow":["#91c7ed","#effaff","#a2b8ce","#e5f2fa","#83a5b5","#bfdae8","#657b89"],"portal":["#44305c","#c4a0e8","#75648e","#a494a5","#534067","#867097","#554462"],"fireflies":["#254c6a","#b3d4cf","#547c77","#638f65","#205c48","#3a7953","#604c3d"]};
const cache=new Map();
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}}
function svg(id){
 if(cache.has(id))return cache.get(id);
 const p=palettes[id]||palettes.forest, r=rng([...id].reduce((a,c)=>a*31+c.charCodeAt(0),19));
 const [sky,light,far,grass,dark,leaf,soil]=p;
 let out='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="'+sky+'"/><stop offset="1" stop-color="'+light+'"/></linearGradient><linearGradient id="f" x2="0" y2="1"><stop stop-color="'+light+'" stop-opacity=".22"/><stop offset="1" stop-color="'+sky+'" stop-opacity="0"/></linearGradient></defs><rect width="900" height="1200" fill="url(#s)"/>';
 const rect=(x,y,w,h,c,o=1)=>'<rect x="'+Math.round(x)+'" y="'+Math.round(y)+'" width="'+Math.round(w)+'" height="'+Math.round(h)+'" fill="'+c+'" opacity="'+o+'"/>';
 const poly=(points,c,o=1)=>'<polygon points="'+points.map(v=>v.map(Math.round).join(',')).join(' ')+'" fill="'+c+'" opacity="'+o+'"/>';
 out+=rect(665,120,93,93,light,.94);
 for(let i=0;i<8;i++){let x=r()*1050-100,y=90+r()*260;out+=rect(x,y,80+r()*120,17+r()*12,light,.62)+rect(x+23,y-14,75,14,light,.55);}
 for(let layer=0;layer<4;layer++){let y=480+layer*115,step=30+layer*10;let pts=[[0,1200],[0,y]];for(let x=0;x<=900;x+=step){let h=y+Math.sin(x/130+layer*2)*75+Math.sin(x/63+layer)*30+(r()-.5)*25;h=Math.round(h/step)*step;pts.push([x,h],[x+step,h]);}pts.push([900,1200]);out+=poly(pts,[far,far,dark,grass][layer],layer===0?.72:1);}
 function block(x,y,w,h,d,top,front,side){out+=poly([[x,y],[x+w,y],[x+w+d,y-d*.55],[x+d,y-d*.55]],top)+rect(x,y,w,h,front)+poly([[x+w,y],[x+w+d,y-d*.55],[x+w+d,y+h-d*.55],[x+w,y+h]],side);}
 for(let j=0;j<7;j++){let yy=785+j*68;for(let i=0;i<12;i++){let x=i*85-35+(j%2)*20;if(r()<.25)continue;let h=9+r()*24;block(x,yy+r()*21,65+r()*35,h,18,grass,dark,soil);}}
 if(['ocean','stone','sky','snow','desert','portal'].includes(id)){let water=id==='ocean';for(let i=0;i<18;i++){let x=r()*960-30,y=680+r()*500;block(x,y,36+r()*90,12+r()*30,15,water?'#9cdbe5':light,water?leaf:far,dark);}}
 function tree(x,y,k){let w=22*k,h=(100+r()*70)*k;block(x,y-h,w,h,10*k,soil,soil,dark);for(let j=0;j<4;j++){let ww=(120-j*20)*k;block(x+w/2-ww/2,y-h-20*k-j*29*k,ww,29*k,20*k,j%2?grass:leaf,leaf,dark);}}
 if(!['desert','portal','nether','embers','stone','ocean'].includes(id)){for(let i=0;i<13;i++){let x=r()*900,y=650+r()*280;tree(x,y,.4+(y-650)/330);}tree(80,1140,1.6);tree(770,1100,1.45);}
 if(['nether','embers','portal','desert'].includes(id)){for(let i=0;i<8;i++){let x=r()*900,y=700+r()*350;block(x,y-100,40+r()*45,100+r()*60,20,far,soil,dark);}}
 if(id==='ocean'){out+=poly([[0,850],[900,765],[900,1200],[0,1200]],'#438daa',.84);for(let i=0;i<65;i++){let x=r()*900,y=850+r()*350;out+=rect(x,y,15+r()*55,3,'#c0edf0',.42);}}
 for(let i=0;i<140;i++){let x=r()*900,y=850+r()*350;out+=rect(x,y,5+r()*13,3+r()*6,i%3===0?light:dark,.38);}
 out+='<rect width="900" height="1200" fill="url(#f)"/></svg>';
 const url='data:image/svg+xml,'+encodeURIComponent(out);cache.set(id,url);return url;
}
const installed=new Set();
let sheet=null;
function ensure(id){
 if(!Object.hasOwn(palettes,id)||installed.has(id))return;
 if(!sheet){sheet=document.createElement('style');document.head.append(sheet);}
 const rule='#app.mw11-chat-page #msgs[data-mw-theme="'+id+'"],.mw-theme-swatch[data-theme="'+id+'"]{background-image:linear-gradient(180deg,rgba(8,20,30,.08),rgba(8,20,30,.22)),url("'+svg(id)+'")!important;background-size:cover!important;background-position:center!important}';
 sheet.sheet.insertRule(rule,sheet.sheet.cssRules.length);installed.add(id);
}
function scan(node){
 if(node.nodeType!==1)return;
 const selector='#msgs[data-mw-theme],.mw-theme-swatch[data-theme]';
 if(node.matches(selector))ensure(node.dataset.mwTheme||node.dataset.theme);
 for(const item of node.querySelectorAll(selector))ensure(item.dataset.mwTheme||item.dataset.theme);
}
function install(){
 new MutationObserver(records=>{for(const record of records){if(record.type==='attributes')scan(record.target);else for(const node of record.addedNodes)scan(node);}}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-mw-theme','data-theme']});
 scan(document.body);
}
return {install,svg,ensure};
})();MWLandscapes.install();