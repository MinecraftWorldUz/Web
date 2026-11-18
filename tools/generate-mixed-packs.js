
/* Reproducible original Minecraft World compact content collection. No external assets. */
const MW_BATCH=(()=>{
function bytes(s){let a=[];for(let c of s){let n=c.codePointAt(0);if(n<128)a.push(n);else if(n<2048)a.push(192|n>>6,128|n&63);else if(n<65536)a.push(224|n>>12,128|n>>6&63,128|n&63);else a.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|n&63)}return a}
function s16(a,n){a.push(n&255,n>>8&255)}function s32(a,n){a.push(n&255,n>>8&255,n>>16&255,n>>24&255)}function big(a,n){a.push(n>>24&255,n>>16&255,n>>8&255,n&255)}
function crc(a){let c=-1;for(let x of a){c^=x;for(let k=0;k<8;k++)c=c>>>1^(-(c&1)&0xedb88320)}return(c^-1)>>>0}
function zip(files){let a=[],c=[];for(let f of files){let name=bytes(f.name),data=f.data,off=a.length,checksum=crc(data);s32(a,0x04034b50);s16(a,20);s16(a,2048);s16(a,0);s16(a,0);s16(a,33);s32(a,checksum);s32(a,data.length);s32(a,data.length);s16(a,name.length);s16(a,0);a.push(...name,...data);s32(c,0x02014b50);s16(c,20);s16(c,20);s16(c,2048);s16(c,0);s16(c,0);s16(c,33);s32(c,checksum);s32(c,data.length);s32(c,data.length);s16(c,name.length);s16(c,0);s16(c,0);s16(c,0);s16(c,0);s32(c,0);s32(c,off);c.push(...name)}let off=a.length;a.push(...c);s32(a,0x06054b50);s16(a,0);s16(a,0);s16(a,files.length);s16(a,files.length);s32(a,c.length);s32(a,off);s16(a,0);return a}
function png(w,h,fn){let raw=[];for(let y=0;y<h;y++){raw.push(0);for(let x=0;x<w;x++)raw.push(...fn(x,y))}let z=[120,1,1];s16(z,raw.length);s16(z,65535-raw.length);z.push(...raw);let a=1,b=0;for(let n of raw){a=(a+n)%65521;b=(b+a)%65521}big(z,((b<<16)|a)>>>0);let out=[137,80,78,71,13,10,26,10];function chunk(name,data){big(out,data.length);let v=[...bytes(name),...data];out.push(...v);big(out,crc(v))}let hdata=[];big(hdata,w);big(hdata,h);hdata.push(8,6,0,0,0);chunk("IHDR",hdata);chunk("IDAT",z);chunk("IEND",[]);return out}
function rgb(s){return[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16),255]}
function icon(p){let cs=p.map(rgb);return png(32,32,(x,y)=>{let d=Math.abs(x-15.5)+Math.abs(y-15.5);return cs[d>22?0:d>17?2:(x+y)%7===0?3:1]})}
function uid(i,k){return (0x92714000+i*97+k*211>>>0).toString(16)+"-a17c-4"+(0x100+i+k).toString(16)+"-8b"+(i+k).toString(16).padStart(2,"0")+"-"+(0xabc07000+i*239>>>0).toString(16)+(0x1120+k).toString(16)}
function manifest(i,title,kind,v){if(kind==="skin")return{format_version:1,header:{name:"pack.name",version:[1,0,0],uuid:uid(i,1)},modules:[{type:"skin_pack",uuid:uid(i,2),version:[1,0,0]}]};let min=v.includes("26.")?[1,26,0]:[1,+v.match(/\.(\d+)/)[1],0];return{format_version:2,header:{name:"MW "+title,description:"Minecraft World original pack",version:[1,0,0],uuid:uid(i,1),min_engine_version:min},modules:[{type:kind,uuid:uid(i,2),version:[1,0,0]}]}}
function J(n,o){return{name:n,data:bytes(JSON.stringify(o)+"\n")}}function T(n,s){return{name:n,data:bytes(s)}}
function skin(p,seed){let cs=p.map(rgb),px=Array.from({length:4096},()=>[0,0,0,0]);function rect(x,y,w,h,i){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)px[yy*64+xx]=cs[i]}let parts=[[8,0,8,8,0],[0,8,8,8,0],[8,8,8,8,1],[16,8,8,8,0],[24,8,8,8,0],[20,16,8,4,2],[16,20,4,12,2],[20,20,8,12,2],[28,20,4,12,2],[32,20,8,12,2],[4,16,4,4,3],[0,20,4,12,3],[4,20,4,12,3],[8,20,4,12,3],[12,20,4,12,3],[44,16,4,4,3],[40,20,4,12,3],[44,20,4,12,3],[48,20,4,12,3],[52,20,4,12,3],[4,32,4,4,3],[0,36,4,12,3],[4,36,4,12,3],[8,36,4,12,3],[12,36,4,12,3],[36,48,4,4,3],[32,52,4,12,3],[36,52,4,12,3],[40,52,4,12,3],[44,52,4,12,3]];for(let [x,y,w,h,i] of parts)rect(x,y,w,h,i);rect(9,11,2,1,4);rect(13,11,2,1,4);rect(10,14,4,1,5);rect(21,22,6,2,1);rect(23,26,2,2,4);for(let k=0;k<5;k++)rect(4,22+2*k,1,1,seed%2?4:1);return png(64,64,(x,y)=>px[y*64+x])}
function item(p,name,seed){let cs=p.map(rgb);return png(16,16,(x,y)=>{let dx=Math.abs(x-7.5),dy=Math.abs(y-7.5);if(name==="apple"?dx*dx/40+dy*dy/36>1:dx+dy*.9>7.6)return[0,0,0,0];return cs[(x*3+y+seed)%7===0?3:y<7?2:1]})}
function svg(name,category,version,p){return '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><defs><linearGradient id="g"><stop stop-color="'+p[0]+'"/><stop offset="1" stop-color="'+p[1]+'"/></linearGradient></defs><rect width="960" height="540" fill="url(#g)"/><rect x="30" y="30" width="900" height="480" fill="none" stroke="'+p[3]+'" stroke-width="5"/><rect x="80" y="140" width="220" height="220" rx="23" fill="'+p[2]+'"/><text x="190" y="284" fill="white" text-anchor="middle" font-size="105">◆</text><text x="340" y="150" fill="#fff" font-family="sans-serif" font-size="31">MINECRAFT WORLD</text><text x="340" y="229" fill="#fff" font-family="sans-serif" font-weight="bold" font-size="43" textLength="550" lengthAdjust="spacingAndGlyphs">'+name+'</text><text x="340" y="312" fill="#fff" font-family="sans-serif" font-size="29">'+category.toUpperCase()+'</text><text x="340" y="399" fill="#fff" font-family="sans-serif" font-size="26">'+version+'</text><text x="340" y="451" fill="#fff" font-family="sans-serif" font-size="22">Original compact edition</text></svg>'}
function build(){
let out=[];
function push(id,en,title,version,category,palette,ext,files,description){let buf=zip(files);if(buf.length>=60000)throw Error("Size "+id);let root="site-mods/mixed-v1/"+id;out.push({slug:id,en,title,version,category,description,ext,path:root+"."+ext,cover:root+".svg",bytes:buf.length,assets:[{path:root+"."+ext,bytes:buf},{path:root+".svg",bytes:bytes(svg(en,category,version,palette))}]})}
let S=[
["emerald-ranger","Zumrad qo‘riqchisi","Emerald Ranger","Bedrock 1.14.0",["#293b2b","#679c59","#3d5d47","#c3dc8c","#f0ca82","#1b2820"]],
["desert-mapper","Sahro xaritachisi","Desert Mapper","Bedrock 1.18.0",["#4b3727","#c0955c","#87643b","#eed198","#ead4b0","#252b25"]],
["moon-gardener","Oy bog‘boni","Moon Gardener","Bedrock 1.21.0",["#242941","#7982b9","#505988","#c7bbe5","#efdfeb","#192239"]],
["copper-builder","Mis ustasi","Copper Builder","Bedrock 26.0",["#293d39","#a97b53","#568679","#d4b57c","#edd4ad","#26332b"]]
];
S.forEach((v,i)=>{let [slug,uz,en,ver,p]=v,key="mw_"+slug.replace(/-/g,""),files=[J("manifest.json",manifest(101+i,en,"skin",ver)),J("skins.json",{serialize_name:key,localization_name:key,skins:[{localization_name:"hero",geometry:"geometry.humanoid.custom",texture:"skin.png",type:"free"}]}),{name:"skin.png",data:skin(p,i)},{name:"pack_icon.png",data:icon(p)},T("texts/en_US.lang","skinpack."+key+"="+en+"\nskin."+key+".hero="+en+"\n"),T("texts/languages.json",'["en_US"]\n')];push("skin-"+slug,en,uz,ver,"skin",p,"mcpack",files,en+": 64×64 original Minecraft Bedrock skini.")});
let R=[
["cosmic-crystals","Kosmik kristallar","Cosmic Crystals","Bedrock 1.14.0",["#202541","#5f5da0","#9497df","#dddfff"]],
["forest-gems","O‘rmon javohirlari","Forest Gems","Bedrock 1.18.0",["#20372c","#4b8153","#87bc76","#d9feb9"]],
["sunset-pearls","Quyosh botishi","Sunset Pearls","Bedrock 1.21.0",["#472b3a","#ac586d","#eb9a77","#ffdfab"]],
["frost-diamonds","Muz olmoslari","Frost Diamonds","Bedrock 26.0",["#254357","#598cac","#9ccce0","#ebfaff"]]
];
R.forEach((v,i)=>{let [slug,uz,en,ver,p]=v,files=[J("manifest.json",manifest(201+i,en,"resources",ver)),{name:"pack_icon.png",data:icon(p)}];["apple","diamond","emerald"].forEach(name=>files.push({name:"textures/items/"+name+".png",data:item(p,name,i)}));push("texture-"+slug,en,uz,ver,i%2?"resource":"texture",p,"mcpack",files,en+": olma, olmos va zumrad uchun 3 ta original 16×16 tekstura.")});
let B=[
["forest-kit","O‘rmon to‘plami","Forest Kit","Bedrock 1.14.0","survival",["oak_sapling","bone_meal","dirt","water_bucket"]],
["ocean-travel","Okean sayohati","Ocean Travel","Bedrock 1.18.0","adventure",["boat","fishing_rod","cooked_salmon","map"]],
["builder-studio","Quruvchi studiyasi","Builder Studio","Bedrock 1.21.0","building",["scaffolding","stone_bricks","glass","lantern"]],
["redstone-lab","Redstone laboratoriyasi","Redstone Lab","Bedrock 26.0","technology",["redstone","lever","repeater","piston"]]
];
B.forEach((v,i)=>{let [slug,uz,en,ver,cat,items]=v,p=R[i][4],ns="mw_"+slug.replace(/-/g,"_"),files=[J("manifest.json",manifest(301+i,en,"data",ver)),{name:"pack_icon.png",data:icon(p)}];files.push(T("functions/"+ns+"/starter.mcfunction",items.map((item,j)=>"give @s "+item+" "+(16-j*3)).join("\n")+"\n"));items.forEach((item,j)=>files.push(T("functions/"+ns+"/"+item+".mcfunction","give @s "+item+" "+(j+5)+"\n")));push("behavior-"+slug,en,uz,ver,cat,p,"mcpack",files,en+": Bedrock Behavior pack, /function "+ns+"/starter bilan 4 buyum to‘plami. Cheats kerak.")});
let D=[
["cave-lights","G‘or yoritgichi","Cave Lights","Java 1.14",4,["torch","ladder","bread","stone_pickaxe"]],
["hill-hiker","Tog‘ sayyohi","Hill Hiker","Java 1.16.5",6,["compass","map","bread","leather_boots"]],
["meadow-picnic","Yaylov sayli","Meadow Picnic","Java 1.19.2",10,["bread","honey_bottle","dandelion","oak_sapling"]],
["base-decor","Baza bezaklari","Base Decor","Java 1.20.1",15,["painting","item_frame","lantern","flower_pot"]]
];
D.forEach((v,i)=>{let [slug,uz,en,ver,fmt,items]=v,p=S[i][4].slice(0,4),ns="mw_"+slug.replace(/-/g,"_"),files=[J("pack.mcmeta",{pack:{pack_format:fmt,description:"Minecraft World | "+en}}),{name:"pack.png",data:icon(p)}];files.push(T("data/"+ns+"/functions/starter.mcfunction",items.map((item,j)=>"give @s minecraft:"+item+" "+(16-j*3)).join("\n")+"\n"));items.forEach((item,j)=>files.push(T("data/"+ns+"/functions/"+item+".mcfunction","give @s minecraft:"+item+" "+(4+j)+"\n")));push("java-"+slug,en,uz,ver,i%2?"tools":"mod",p,"zip",files,en+": Java datapack. Dunyo/datapacks papkasiga joylang, /reload va /function "+ns+":starter. Cheats kerak.")});
return out;
}
return {build};
})();
