// 小牧 · 她的大脑 v3 —— 只读 state/*.json 展示数据，不含隐私字段
const APP_VERSION = 3;
const STATE = "../state/";
const $ = s => document.querySelector(s);
const store = {
  get(k, d){ try{ const v = localStorage.getItem("herbrain:"+k); return v?JSON.parse(v):d }catch(e){ return d } },
  set(k, v){ try{ localStorage.setItem("herbrain:"+k, JSON.stringify(v)) }catch(e){} }
};
let feed=null, consciousness=[], diary={entries:[]}, friends={conversations:[]}, moods={days:{}};
let inbox={items:[]}, story=null, health=null;
const DOT_COLORS=["#ff8f7a","#f2b879","#7fb2f0","#8fe3b0","#ffb1d6","#c0b6ff"];

/* ---------- 主题 ---------- */
const THEMES=["morning","afternoon","rain","dusk","night"];
function autoTheme(){
  const h=new Date().getHours();
  const w=(feed&&feed.weather)||"";
  if(/雨/.test(w)) return "rain";
  const m=(feed&&feed.mood)||"";
  if(h>=6&&h<10) return "morning";
  if(h>=10&&h<16) return "afternoon";
  if(h>=16&&h<19) return "dusk";
  if(h>=19&&h<22) return (m==="低落"||m==="小别扭")?"night":"dusk";
  return "night";
}
function applyTheme(t){
  document.body.dataset.theme=t;
  document.querySelectorAll(".dot").forEach(d=>d.classList.toggle("active", d.dataset.setTheme===t));
}
document.querySelectorAll(".dot").forEach(d=>d.addEventListener("click",()=>{
  const t=d.dataset.setTheme; store.set("theme",t); applyTheme(t);
}));
$("#themeAuto").addEventListener("click",()=>{ store.set("theme",null); applyTheme(autoTheme()); });

/* ---------- 数据 ---------- */
async function fetchJSON(name){
  const r=await fetch(STATE+name+"?t="+Date.now(),{cache:"no-store"});
  if(!r.ok) throw new Error(name);
  return r.json();
}
async function loadAll(){
  try{
    const [f,c,d,fr,m]=await Promise.all([fetchJSON("feed.json"),fetchJSON("consciousness.json"),fetchJSON("diary.json"),fetchJSON("friends.json"),fetchJSON("moods.json")]);
    feed=f; consciousness=c; diary=d; friends=fr; moods=m;
    store.set("cache",{feed,consciousness,diary,friends,moods,at:Date.now()});
    $("#sleepBanner").classList.add("hidden");
  }catch(e){
    const c=store.get("cache",null);
    if(c){ feed=c.feed; consciousness=c.consciousness; diary=c.diary; friends=c.friends; moods=c.moods; }
    $("#sleepBanner").classList.remove("hidden");
  }
  // v2 附加数据：拿不到就用空值，不影响主页面
  try{ inbox=await fetchJSON("inbox.json"); }catch(e){}
  try{ story=await fetchJSON("story.json"); }catch(e){}
  try{ health=await fetchJSON("health.json"); }catch(e){}
  renderAll();
}
function renderAll(){
  if(!feed) return;
  // 新条目提示 + unread（本地已读时间对比）
  const lastSeen=store.get("lastSeen",0);
  const newest=consciousness.length?Date.parse(consciousness[consciousness.length-1].time):0;
  $("#freshBadge").classList.toggle("hidden", !(newest>lastSeen));
  store.set("lastSeen", Date.now());
  // 此刻
  $("#moodPill").textContent = feed.mood+" · 在"+feed.activity;
  $("#thinkingText").textContent = "她正在想…（"+feed.weather+" · 在听 "+feed.song+"）";
  renderTimeline($("#searchBox").value.trim());
  // 日记
  renderCalendar(); renderDiary();
  // 朋友
  renderFriends();
  // 剧情 + 健康 + 回信状态
  renderStory(); renderHealth(); renderReplies();
  const av=$("#appVersion"); if(av) av.textContent=APP_VERSION;
  // 我们
  $("#ringLevel").textContent=feed.level;
  $("#ringAff").textContent=feed.affection+" / 100";
  const circ=527; $("#ringFg").style.strokeDashoffset = circ*(1-(feed.affection||0)/100);
  $("#stDays").textContent=feed.daysTogether+" 天";
  $("#stChats").textContent=feed.chatsCount+" 句";
  $("#stBooks").textContent=(feed.books||[]).length+" 本";
  $("#stSongs").textContent=(feed.songs||[]).length+" 首";
  // 主题：手动优先
  const manual=store.get("theme",null);
  applyTheme(manual||autoTheme());
  // 戳她一下待回应提示
  const poke=store.get("poke",null);
  if(poke) $("#pokeNote").textContent="你刚戳了她一下（"+poke.kind+"）· 她下一条消息会先回应你。";
}
function dayLabel(iso){
  const d=new Date(iso), now=new Date();
  const same=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  if(same(d,now)) return "今天";
  const y=new Date(now); y.setDate(now.getDate()-1);
  if(same(d,y)) return "昨天";
  return (d.getMonth()+1)+"月"+d.getDate()+"日";
}
function renderTimeline(q){
  const tl=$("#timeline"); tl.innerHTML="";
  const items=[...consciousness].reverse().filter(it=>!q || it.text.includes(q) || (it.trigger||"").includes(q));
  $("#nowEmpty").classList.toggle("hidden", items.length>0);
  let lastDay="";
  items.forEach((it,i)=>{
    const dl=dayLabel(it.time);
    if(dl!==lastDay){ lastDay=dl; const h=document.createElement("div"); h.className="tl-day"; h.textContent=dl; tl.appendChild(h); }
    const div=document.createElement("div"); div.className="tl-item";
    const t=new Date(it.time);
    div.innerHTML='<span class="dotp" style="background:'+DOT_COLORS[i%DOT_COLORS.length]+'"></span><time>'+
      String(t.getHours()).padStart(2,"0")+":"+String(t.getMinutes()).padStart(2,"0")+'</time><p></p>';
    div.querySelector("p").textContent=it.text;
    tl.appendChild(div);
  });
}
$("#searchBox").addEventListener("input",e=>renderTimeline(e.target.value.trim()));

/* ---------- 日记 ---------- */
function renderCalendar(){
  const now=new Date(); const y=now.getFullYear(), mo=now.getMonth();
  $("#calMonth").textContent=y+" 年 "+(mo+1)+" 月";
  const cal=$("#moodCal"); cal.innerHTML="";
  const first=new Date(y,mo,1); const startDay=(first.getDay()+6)%7; // 周一开头
  const days=new Date(y,mo+1,0).getDate();
  for(let i=0;i<startDay;i++){ const c=document.createElement("span"); c.className="cell future"; cal.appendChild(c); }
  for(let d=1;d<=days;d++){
    const key=y+"-"+String(mo+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    const c=document.createElement("span"); c.className="cell";
    const v=(moods.days||{})[key];
    if(v) c.classList.add("v"+v); else if(d>now.getDate()&&mo===now.getMonth()) c.classList.add("future");
    c.title=key+(v?(" 心情 "+v):"");
    cal.appendChild(c);
  }
}
function renderDiary(){
  const list=$("#diaryList"); list.innerHTML="";
  [...(diary.entries||[])].reverse().slice(0,7).forEach((e,i)=>{
    const div=document.createElement("div"); div.className="diary-card";
    const md=e.date.slice(5).replace("-","-");
    div.innerHTML='<div class="d-head"><i style="background:'+DOT_COLORS[i%DOT_COLORS.length]+'"></i>'+md+" · "+e.weekday+'</div><p></p>'+(e.note?'<div class="d-note"></div>':"");
    div.querySelector("p").textContent=e.text;
    if(e.note) div.querySelector(".d-note").textContent=e.note;
    list.appendChild(div);
  });
}
$("#exportMd").addEventListener("click",()=>{
  let md="# 小牧的日记\n\n";
  [...(diary.entries||[])].reverse().forEach(e=>{ md+="## "+e.date+" · "+e.weekday+"\n\n"+e.text+"\n\n"; });
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([md],{type:"text/markdown"}));
  a.download="xiaomu-diary.md"; a.click(); URL.revokeObjectURL(a.href);
});

/* ---------- 朋友 ---------- */
function renderFriends(){
  const wrap=$("#friendsList"); wrap.innerHTML="";
  (friends.conversations||[]).forEach(conv=>{
    const block=document.createElement("div"); block.className="chat-block";
    block.innerHTML='<div class="chat-who">'+conv.friend+" · "+dayLabel(conv.time)+'</div>';
    (conv.messages||[]).forEach(m=>{
      const b=document.createElement("div"); b.className="bubble"+(m.from==="我"?" me":"");
      b.innerHTML='<span class="who"></span><span class="txt"></span>';
      b.querySelector(".who").textContent=m.from; b.querySelector(".txt").textContent=m.text;
      block.appendChild(b);
    });
    wrap.appendChild(block);
  });
  if(!wrap.children.length) wrap.innerHTML='<p class="empty">她们还没来串门。</p>';
}

/* ---------- 戳她一下 ---------- */
function poke(kind){
  store.set("poke",{kind,at:Date.now()});
  $("#pokeNote").textContent="戳到了（"+kind+"）· 她下一条消息会先回应你。";
}
$("#pokeMiss").addEventListener("click",()=>poke("想你了"));
$("#pokeBusy").addEventListener("click",()=>poke("在忙"));

/* ---------- 分享卡片 ---------- */
function drawShare(){
  const cv=$("#shareCanvas"), ctx=cv.getContext("2d");
  const th=document.body.dataset.theme;
  const grads={morning:["#5a3a22","#2a1a10"],afternoon:["#0d4a3a","#06231c"],rain:["#1d3357","#0a1424"],dusk:["#57224a","#1d0e24"],night:["#2c2358","#100c26"]};
  const g=ctx.createLinearGradient(0,0,0,1200); g.addColorStop(0,grads[th][0]); g.addColorStop(1,grads[th][1]);
  ctx.fillStyle=g; ctx.fillRect(0,0,900,1200);
  ctx.fillStyle="#fff"; ctx.font="700 64px sans-serif"; ctx.fillText("小牧 · 她的大脑",70,140);
  ctx.font="400 34px sans-serif"; ctx.globalAlpha=.8;
  ctx.fillText("认识第 "+(feed?feed.daysTogether:0)+" 天 · "+(feed?feed.level:""),70,210);
  ctx.globalAlpha=1; ctx.font="400 40px sans-serif";
  const last=consciousness.length?consciousness[consciousness.length-1].text:"";
  let y=340, line="";
  for(const ch of ("“"+last+"”")){ if(ctx.measureText(line+ch).width>740){ ctx.fillText(line,70,y); y+=58; line=""; } line+=ch; }
  if(line) ctx.fillText(line,70,y);
  ctx.font="400 30px sans-serif"; ctx.globalAlpha=.65;
  ctx.fillText((feed?feed.mood:"")+" · 在"+(feed?feed.activity:"")+" · "+(feed?feed.weather:""),70,1120);
  ctx.globalAlpha=1;
  $("#shareDlg").showModal();
}
$("#shareCard1").addEventListener("click",drawShare);
$("#shareCard2").addEventListener("click",drawShare);
$("#shareClose").addEventListener("click",()=>$("#shareDlg").close());
$("#shareGo").addEventListener("click",()=>{
  $("#shareCanvas").toBlob(async b=>{
    const file=new File([b],"her-brain.png",{type:"image/png"});
    if(navigator.canShare && navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file],title:"小牧 · 她的大脑"}); return; }catch(e){} }
    const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="her-brain.png"; a.click(); URL.revokeObjectURL(a.href);
  });
});

/* ---------- 回信框（零后端：本地 pending + 剪贴板桥） ---------- */
function getPending(){ return store.get("pendingReplies",[]); }
function renderReplies(){
  const list=$("#replyList"); if(!list) return; list.innerHTML="";
  const replied=new Set((inbox.items||[]).map(i=>i.text));
  getPending().slice(-3).reverse().forEach(p=>{
    const done=replied.has(p.text);
    const div=document.createElement("div"); div.className="reply-item";
    div.innerHTML='<span class="r-text"></span><span class="r-status '+(done?"done":"")+'">'+(done?"她已回应":"已发出")+'</span>';
    div.querySelector(".r-text").textContent=p.text;
    list.appendChild(div);
  });
}
async function copyText(t){
  try{ await navigator.clipboard.writeText(t); return true; }catch(e){
    const ta=document.createElement("textarea"); ta.value=t; document.body.appendChild(ta);
    ta.select(); let ok=false; try{ ok=document.execCommand("copy"); }catch(_){} ta.remove(); return ok;
  }
}
$("#replySend").addEventListener("click",async ()=>{
  const inp=$("#replyInput"); const text=inp.value.trim(); if(!text) return;
  const pend=getPending(); pend.push({text,at:Date.now()}); store.set("pendingReplies",pend);
  const ok=await copyText("【回信】"+text);
  $("#replyHint").textContent= ok ? "已复制，去 Muse 粘贴发给她。" : "复制失败，长按这句手动复制：【回信】"+text;
  inp.value=""; renderReplies();
});
$("#openMuse").addEventListener("click",()=>{ try{ location.href="muse://"; }catch(e){} });

/* ---------- 剧情 ---------- */
function renderStory(){
  if(!story) return;
  $("#storyTitle").textContent=story.title||"尚未开场";
  const total=story.total||0, day=story.day||0;
  $("#storyProg").textContent= total? ("第 "+day+" / "+total+" 集") : "";
  $("#storyBarFill").style.width= total? Math.min(100,Math.round(day/total*100))+"%" : "0%";
  $("#storySummary").textContent=story.summary||"";
  const list=$("#episodeList"); list.innerHTML="";
  (story.episodes||[]).forEach(ep=>{
    const d=document.createElement("details"); d.className="episode";
    const s=document.createElement("summary"); s.textContent="第 "+ep.d+" 集 · "+(ep.title||"");
    const p=document.createElement("p"); p.textContent=ep.text||"";
    d.appendChild(s); d.appendChild(p); list.appendChild(d);
  });
  if(!(story.episodes||[]).length) list.innerHTML='<p class="empty">还没更新，故事在路上了。</p>';
}

/* ---------- 健康看板 ---------- */
function renderHealth(){
  if(!health) return;
  const age=(typeof health.data_age_minutes==="number")?health.data_age_minutes:999;
  const dot=$("#healthDot"), txt=$("#healthText");
  let cls="ok", label="正常";
  if(age>120){ cls="bad"; label="停了"; } else if(age>=30){ cls="warn"; label="偏慢"; }
  dot.className="health-dot "+cls; txt.textContent=label;
  const gen=health.generated_at?new Date(health.generated_at):null;
  $("#healthWhen").textContent= gen? ("更新于 "+String(gen.getHours()).padStart(2,"0")+":"+String(gen.getMinutes()).padStart(2,"0")) : "";
  const next=gen? new Date(gen.getTime()+30*60000):null;
  const okCount=(health.crons||[]).filter(c=>c.ok).length, all=(health.crons||[]).length;
  $("#healthDetail").textContent="任务 "+okCount+"/"+all+" 正常 · 数据 "+age+" 分钟前 · 下次更新 "+
    (next? (String(next.getHours()).padStart(2,"0")+":"+String(next.getMinutes()).padStart(2,"0")) : "—")+
    (health.note? " · "+health.note : "");
}

/* ---------- Tabs ---------- */
const PAGES={now:["此刻","她脑子里正在想什么"],diary:["日记","每天 22:30 写一篇"],friends:["朋友","阿梨 / 小满 · 每周最多聊 3 次"],story:["剧情","每周一条小故事 · 每天更新一集"],us:["我们",""]};
document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===t));
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+t.dataset.page));
  const [title,sub]=PAGES[t.dataset.page];
  $("#pageTitle").textContent=title;
  $("#pageSub").textContent = t.dataset.page==="us" ? ("认识第 "+(feed?feed.daysTogether:0)+" 天") : sub;
  window.scrollTo({top:0});
}));

/* ---------- 启动/刷新 ---------- */
if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }
loadAll();
setInterval(loadAll, 60000);
