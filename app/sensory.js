// 小牧 · 她的大脑 v3 感官层 —— 纯前端附加层，不改数据逻辑，只读 DOM 状态
// 四项：Canvas 活人像 / 独白朗读（speechSynthesis）/ 环境音（Web Audio 合成）/ 打字节奏
(function(){
"use strict";
const $ = s => document.querySelector(s);
const store = {
  get(k, d){ try{ const v = localStorage.getItem("herbrain:"+k); return v?JSON.parse(v):d }catch(e){ return d } },
  set(k, v){ try{ localStorage.setItem("herbrain:"+k, JSON.stringify(v)) }catch(e){} }
};
const REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const rnd = (a,b)=>a+Math.random()*(b-a);

/* ---------- 共享状态：从页面读她的 mood / 活动 / 天气（只读） ---------- */
const sense = { mood:"平静", activity:"", weather:"" };
function pollState(){
  const pill = $("#moodPill");
  if(pill){
    const t = pill.textContent || "";
    const parts = t.split(" · 在");
    if(parts[0]) sense.mood = parts[0].trim();
    if(parts[1]) sense.activity = parts[1].trim();
  }
  const th = $("#thinkingText");
  if(th){
    const m = /（([^·]+)·/.exec(th.textContent||"");
    if(m) sense.weather = m[1].trim();
  }
}
pollState();
setInterval(pollState, 2000);

/* ================= 一、Canvas 活人像 ================= */
const HAIR = "#503527", HAIR2 = "#6b4a34", SKIN = "#ffd9bd", SKIN_SH = "#f7c9a4";
function moodKind(){
  const m = sense.mood || "";
  if(/困|累|睡|疲/.test(m)) return "sleepy";
  if(/低落|别扭|难过|伤心|委屈|生气/.test(m)) return "sad";
  if(/开心|高兴|黏人|兴奋|快乐|幸福/.test(m)) return "happy";
  return "calm";
}
const face = { blinkAt: performance.now()+rnd(1500,4000), blinkT0: 0 };
function eyeOpenFactor(now){
  // 眨眼：1.5–4 秒随机一次，闭眼全程约 150ms
  if(!face.blinkT0 && now >= face.blinkAt) face.blinkT0 = now;
  if(face.blinkT0){
    const dt = now - face.blinkT0;
    if(dt >= 150){ face.blinkT0 = 0; face.blinkAt = now + rnd(1500,4000); return 1; }
    const p = dt/150; return Math.abs(p*2-1)*0.92 + 0.08; // 1→0.08→1
  }
  return 1;
}
function drawFace(now){
  const cv = $("#herFace"); if(!cv) return;
  const ctx = cv.getContext("2d"); if(!ctx) return;
  const kind = moodKind();
  const breath = REDUCED ? 0 : Math.sin(now/1150)*2.4;
  const cx = 120, cy = 124 + breath;
  ctx.clearRect(0,0,240,240);
  // 后发
  ctx.fillStyle = HAIR;
  ctx.beginPath(); ctx.arc(cx, cy-4, 88, 0, Math.PI*2); ctx.fill();
  // 脸
  ctx.fillStyle = SKIN;
  ctx.beginPath(); ctx.arc(cx, cy+4, 70, 0, Math.PI*2); ctx.fill();
  // 两侧垂发（发型保持稳定：深棕齐肩波波头）
  ctx.fillStyle = HAIR;
  [cx-84, cx+62].forEach(x=>{
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x, cy-30, 22, 108, 11); else ctx.rect(x, cy-30, 22, 108);
    ctx.fill();
  });
  // 刘海：盖住额头上部，波浪下沿
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy+4, 70, 0, Math.PI*2); ctx.clip();
  ctx.fillStyle = HAIR;
  ctx.beginPath();
  ctx.moveTo(cx-72, cy-66);
  ctx.lineTo(cx+72, cy-66);
  ctx.lineTo(cx+72, cy-26);
  ctx.quadraticCurveTo(cx+36, cy-40, cx, cy-24);
  ctx.quadraticCurveTo(cx-36, cy-40, cx-72, cy-26);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // 发夹（固定小物：粉色圆点）
  ctx.fillStyle = "#ff9fb8";
  ctx.beginPath(); ctx.arc(cx+52, cy-38+breath*0.4, 6, 0, Math.PI*2); ctx.fill();
  // 腮红
  ctx.fillStyle = "rgba(255,118,132,.45)";
  [cx-42, cx+42].forEach(x=>{
    ctx.beginPath(); ctx.ellipse(x, cy+26, 11, 6.5, 0, 0, Math.PI*2); ctx.fill();
  });
  // 眉毛
  ctx.strokeStyle = HAIR2; ctx.lineWidth = 3.4; ctx.lineCap = "round";
  const browY = cy-16;
  [-30, 30].forEach((dx,i)=>{
    ctx.beginPath();
    if(kind==="sad"){ // 内侧上挑（八字眉）
      if(i===0){ ctx.moveTo(cx+dx-11, browY+3); ctx.lineTo(cx+dx+11, browY-3); }
      else { ctx.moveTo(cx+dx-11, browY-3); ctx.lineTo(cx+dx+11, browY+3); }
    } else {
      ctx.arc(cx+dx, browY+4, 11, Math.PI*1.15, Math.PI*1.85);
    }
    ctx.stroke();
  });
  // 眼睛
  const open = eyeOpenFactor(now);
  const baseOpen = kind==="sleepy" ? 0.34 : 1;
  const ef = Math.max(0.05, Math.min(1, baseOpen * open));
  const eyeY = cy+8;
  [-30, 30].forEach(dx=>{
    const ex = cx+dx;
    if(kind==="happy" && open > 0.6){
      // 笑眼：上弯弧
      ctx.strokeStyle = "#3a2a22"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(ex, eyeY+5, 9, Math.PI*1.08, Math.PI*1.92); ctx.stroke();
    } else if(ef < 0.45){
      // 半闭/眨眼：睫毛线
      ctx.strokeStyle = "#3a2a22"; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.arc(ex, eyeY-2, 9, Math.PI*0.15, Math.PI*0.85); ctx.stroke();
    } else {
      ctx.fillStyle = "#3a2a22";
      ctx.beginPath(); ctx.ellipse(ex, eyeY, 7, 9.5*ef, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(ex+2.4, eyeY-3.4, 2.3, 0, Math.PI*2); ctx.fill();
    }
  });
  // 嘴
  const my = cy+36;
  ctx.strokeStyle = "#c46a52"; ctx.fillStyle = "#c46a52"; ctx.lineWidth = 3.4;
  if(kind==="happy"){
    ctx.beginPath(); ctx.arc(cx, my-2, 10, Math.PI*0.08, Math.PI*0.92); ctx.closePath(); ctx.fill();
  } else if(kind==="sad"){
    ctx.beginPath(); ctx.arc(cx, my+9, 8, Math.PI*1.15, Math.PI*1.85); ctx.stroke();
  } else if(kind==="sleepy"){
    ctx.beginPath(); ctx.arc(cx, my+2, 3.6, 0, Math.PI*2); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, my-1, 7, Math.PI*0.15, Math.PI*0.85); ctx.stroke();
  }
  // 脖子/衣领一点点（稳定肤色与造型收尾）
  ctx.fillStyle = SKIN_SH;
  ctx.beginPath(); ctx.ellipse(cx, cy+76, 16, 7, 0, 0, Math.PI); ctx.fill();
}
(function initFace(){
  const cv = $("#herFace"); if(!cv) return;
  if(REDUCED){
    drawFace(performance.now());
    let lastKind = moodKind();
    setInterval(()=>{ const k = moodKind(); if(k!==lastKind){ lastKind = k; drawFace(performance.now()); } }, 2000);
    return;
  }
  let running = true;
  const loop = (t)=>{ if(running) drawFace(t); if(!document.hidden) requestAnimationFrame(loop); else setTimeout(()=>requestAnimationFrame(loop), 400); };
  requestAnimationFrame(loop);
  document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) requestAnimationFrame(loop); });
})();

/* ================= 二、开口说话 ================= */
let zhVoice = null;
function pickVoice(){
  try{
    const vs = speechSynthesis.getVoices().filter(v => /^zh/i.test(v.lang||""));
    if(!vs.length) return;
    zhVoice = vs.find(v => /xiaoxiao|xiaoyi|tingting|ting-ting|mei-?jia|yunjian|huihui|女/i.test(v.name)) || vs[0];
  }catch(e){}
}
if("speechSynthesis" in window){ pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function isWhisperTime(){ const h = new Date().getHours(); return h >= 22 || h < 7; }
function speak(text){
  if(!("speechSynthesis" in window) || !text) return;
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    if(zhVoice) u.voice = zhVoice;
    if(isWhisperTime()){ u.rate = 0.9; u.volume = 0.5; } else { u.rate = 1.0; u.volume = 1.0; }
    u.pitch = 1.12;
    speechSynthesis.speak(u);
  }catch(e){}
}
const ttsAutoEl = $("#ttsAuto");
if(ttsAutoEl){
  ttsAutoEl.checked = !!store.get("senseTtsAuto", false);
  ttsAutoEl.addEventListener("change", ()=>{ store.set("senseTtsAuto", ttsAutoEl.checked); if(!ttsAutoEl.checked && "speechSynthesis" in window) speechSynthesis.cancel(); });
}
function ttsAutoOn(){ return !!(ttsAutoEl && ttsAutoEl.checked); }

/* ================= 四、打字节奏 + 喇叭按钮（时间线观察） ================= */
const tl = $("#timeline");
const seen = new Set();
let firstSnapshot = true;
let typingBusy = false;
function sigOf(item){
  const t = item.querySelector("time"), p = item.querySelector("p");
  return (t ? t.textContent : "") + "|" + (p ? p.textContent : "");
}
function decorate(item){
  const p = item.querySelector("p"); if(!p) return;
  if(item.querySelector(".speak-btn")) return;
  const btn = document.createElement("button");
  btn.className = "speak-btn"; btn.type = "button"; btn.textContent = "🔊"; btn.title = "让她念这一条";
  btn.addEventListener("click", ()=>speak(p.textContent));
  item.appendChild(btn);
}
function typeItem(item, done){
  const p = item.querySelector("p"); if(!p){ done && done(); return; }
  const full = p.textContent;
  const hint = document.createElement("div");
  hint.className = "typing-hint"; hint.textContent = "小牧正在输入…";
  item.appendChild(hint);
  p.textContent = "";
  const wait = rnd(800, 2000);
  setTimeout(()=>{
    hint.remove();
    if(!item.isConnected){ done && done(); return; }
    // 偶尔拆两条：长句约 30% 概率，前半打完停 0.6 秒，后半另起一段
    const splitAt = (full.length >= 14 && Math.random() < 0.3) ? Math.floor(full.length*rnd(0.38,0.55)) : -1;
    let i = 0, target = p, paused = false;
    const parts = splitAt > 0 ? [full.slice(0, splitAt), full.slice(splitAt)] : [full];
    let part = 0;
    const tick = ()=>{
      if(!item.isConnected){ done && done(); return; }
      if(paused) return;
      if(i < parts[part].length){
        target.textContent += parts[part][i++];
        setTimeout(tick, rnd(35, 60));
      } else if(part < parts.length-1){
        part++; i = 0; paused = true;
        const p2 = document.createElement("p"); p2.className = "tl-cont"; item.appendChild(p2); target = p2;
        setTimeout(()=>{ paused = false; tick(); }, 600);
      } else {
        decorate(item);
        done && done(full);
      }
    };
    tick();
  }, wait);
}
function scanTimeline(){
  if(!tl) return;
  const items = [...tl.querySelectorAll(".tl-item")];
  const searching = ($("#searchBox") && $("#searchBox").value.trim().length > 0);
  const fresh = [];
  items.forEach(it => {
    const s = sigOf(it);
    if(!seen.has(s)){ seen.add(s); if(!firstSnapshot && !searching && !REDUCED) fresh.push(it); }
  });
  const wasFirst = firstSnapshot; firstSnapshot = false;
  items.forEach(it => { if(!fresh.includes(it)) decorate(it); });
  if(wasFirst || !fresh.length) return;
  // 只给最新的一条做打字节奏（fresh[0] 是列表最上方=最新）
  const newest = fresh[0];
  fresh.slice(1).forEach(it => decorate(it));
  if(typingBusy){ decorate(newest); return; }
  typingBusy = true;
  typeItem(newest, (full)=>{
    typingBusy = false;
    if(full && ttsAutoOn()) speak(full);
  });
}
if(tl){
  const mo = new MutationObserver(()=>{ setTimeout(scanTimeline, 30); });
  mo.observe(tl, { childList: true });
  setTimeout(scanTimeline, 300);
}

/* ================= 三、环境音（Web Audio 合成） ================= */
const ambEl = $("#ambOn");
let AC = null, master = null, sceneNodes = [], sceneName = "", puffTimer = null;
function noiseBuffer(ctx){
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
  return buf;
}
function currentScene(){
  if(/雨/.test(sense.weather)) return "rain";
  const h = new Date().getHours();
  if(h >= 23 || h < 5) return "night";
  if(/读|书|看/.test(sense.activity)) return "reading";
  return "none";
}
function clearScene(){
  sceneNodes.forEach(n => { try{ n.stop && n.stop(); }catch(e){} try{ n.disconnect(); }catch(e){} });
  sceneNodes = [];
  if(puffTimer){ clearTimeout(puffTimer); puffTimer = null; }
}
function buildScene(name){
  clearScene(); sceneName = name;
  if(!AC || name === "none") return;
  if(name === "rain" || name === "night"){
    const src = AC.createBufferSource(); src.buffer = noiseBuffer(AC); src.loop = true;
    const f = AC.createBiquadFilter();
    if(name === "rain"){ f.type = "bandpass"; f.frequency.value = 1200; f.Q.value = 0.55; }
    else { f.type = "lowpass"; f.frequency.value = 420; }
    const g = AC.createGain(); g.gain.value = name === "rain" ? 0.9 : 0.55;
    src.connect(f); f.connect(g); g.connect(master); src.start();
    sceneNodes = [src, f, g];
  }
  if(name === "reading"){
    // 极轻翻页感：每 3.5–8 秒一次短促的滤波噪声拂过
    const puff = ()=>{
      if(sceneName !== "reading" || !AC) return;
      const t = AC.currentTime;
      const src = AC.createBufferSource(); src.buffer = noiseBuffer(AC);
      const f = AC.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.1;
      f.frequency.setValueAtTime(500, t);
      f.frequency.exponentialRampToValueAtTime(1900, t+0.16);
      f.frequency.exponentialRampToValueAtTime(700, t+0.34);
      const g = AC.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t+0.1);
      g.gain.linearRampToValueAtTime(0, t+0.36);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t); src.stop(t+0.4);
      puffTimer = setTimeout(puff, rnd(3500, 8000));
    };
    puffTimer = setTimeout(puff, rnd(1200, 3000));
  }
}
function ambStart(){
  try{
    if(!AC){
      const Ctor = window.AudioContext || window.webkitAudioContext; if(!Ctor) return;
      AC = new Ctor();
      master = AC.createGain(); master.gain.value = 0.05; master.connect(AC.destination);
    }
    if(AC.state === "suspended") AC.resume();
    buildScene(currentScene());
  }catch(e){}
}
function ambStop(){
  clearScene(); sceneName = "";
  if(AC){ try{ AC.suspend(); }catch(e){} }
}
if(ambEl){
  ambEl.checked = !!store.get("senseAmbient", false);
  ambEl.addEventListener("change", ()=>{
    store.set("senseAmbient", ambEl.checked);
    if(ambEl.checked) ambStart(); else ambStop();
  });
  // iOS：开关状态记住，但音频只在首次点击后激活
  if(ambEl.checked){
    const arm = ()=>{ ambStart(); window.removeEventListener("pointerdown", arm); };
    window.addEventListener("pointerdown", arm);
  }
  setInterval(()=>{ if(ambEl.checked && AC && AC.state === "running"){ const s = currentScene(); if(s !== sceneName) buildScene(s); } }, 15000);
}
})();
