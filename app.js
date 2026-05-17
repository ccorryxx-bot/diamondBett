// ============================================================
// GLOBAL SCOPE — Supabase + State
// ============================================================
const _SUPA_URL = "https://xjqrwcsxiaybpztzestb.supabase.co";
const _SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqcXJ3Y3N4aWF5YnB6dHplc3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzQxMDksImV4cCI6MjA5NDM1MDEwOX0.Kn5sLOTBdNtlooaH-q8ml0cOEswMlgMTSP7GFe7mbxg";

let supabase = null;
let currentUserId = null, currentAgentId = null, availableSpins = 0;

// Deposit/Withdraw state
let _dMethod = null, _dAmt = 0, _dBonus = true, _cdTimer = null;
let _linked = null, _curProv = null;
window._depMethods = [];

// ============================================================
// GLOBAL HELPERS
// ============================================================
function switchTab(tab){
  document.getElementById('registerForm').style.display = tab==='register'?'block':'none';
  document.getElementById('loginForm').style.display    = tab==='login'?'block':'none';
  document.getElementById('tabRegister').classList.toggle('active',tab==='register');
  document.getElementById('tabLogin').classList.toggle('active',tab==='login');
}
function toggleEye(id,btn){
  const inp=document.getElementById(id);
  inp.type=inp.type==='password'?'text':'password';
  btn.style.color=inp.type==='text'?'#f5c518':'rgba(255,255,255,.5)';
}
function shareVia(platform){
  const link=document.getElementById('agentShareLinkInput')?.value;
  if(!link||link==='—')return gToast('Login ဝင်ပြီးမှ Share လုပ်ပါ');
  const text=encodeURIComponent(`Diamond-BETT မှ ဖိတ်ကြားပါသည်! ${link}`);
  const urls={
    telegram:`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`,
    viber:`viber://forward?text=${text}`,
    facebook:`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    whatsapp:`https://wa.me/?text=${text}`
  };
  if(urls[platform])window.open(urls[platform],'_blank');
}
function fmt(v,d=2){const n=parseFloat(v);return isNaN(n)?'0.00':n.toFixed(d);}
function setEl(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}
function maskNum(n){if(!n||n.length<4)return n;return '****'+n.slice(-4);}

// ============================================================
// TOAST
// ============================================================
function gToast(msg,type='normal'){
  const t=document.getElementById('gToast');
  if(!t)return;
  t.textContent=msg;
  t.className=type==='success'?'show success':'show';
  clearTimeout(window._gt);
  window._gt=setTimeout(()=>t.classList.remove('show','success'),type==='success'?4000:2500);
}

// ============================================================
// SVG LOGOS
// ============================================================
function kbzSvg(sz=40){
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#003087"/><rect x="4" y="4" width="40" height="40" rx="9" fill="#0a3fa0" opacity=".4"/><text x="24" y="21" text-anchor="middle" fill="white" font-size="10.5" font-weight="900" letter-spacing="1" font-family="'Segoe UI',Arial,sans-serif">KBZ</text><text x="24" y="31" text-anchor="middle" fill="#FFD700" font-size="9.5" font-weight="700" font-family="'Segoe UI',Arial,sans-serif">Pay</text><rect x="13" y="35" width="22" height="2.5" rx="1.25" fill="#FFD700" opacity=".6"/></svg>`;
}
function waveSvg(sz=40){
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#FFAB00"/><circle cx="24" cy="21" r="12" fill="none" stroke="#0091D0" stroke-width="4.5"/><path d="M12 21 Q18 13 24 21 Q30 29 36 21" fill="none" stroke="#0091D0" stroke-width="4" stroke-linecap="round"/><text x="24" y="41" text-anchor="middle" fill="#003087" font-size="8" font-weight="900" font-family="'Segoe UI',Arial,sans-serif">Wave</text></svg>`;
}
function getProvSvg(provName,sz=40){
  return provName.toLowerCase().includes('kbz')?kbzSvg(sz):waveSvg(sz);
}

// ============================================================
// DEPOSIT — Open
// ============================================================
function openDepositModal(){
  if(!currentUserId){document.getElementById('authModal').classList.add('active');switchTab('login');return;}
  document.getElementById('depositModal').classList.add('open');
  document.getElementById('depStep1').style.display='block';
  document.getElementById('depStep2').style.display='none';
  document.getElementById('depBalShow').textContent=document.getElementById('statBalance')?.textContent||'0.00';
  fetchDepMethods();
}

async function fetchDepMethods(){
  const grid=document.getElementById('depMethodGrid');
  grid.innerHTML='<div style="grid-column:span 2;padding:20px;text-align:center;"><div class="md-spin" style="margin:0 auto;"></div></div>';
  const{data,error}=await supabase.from('payment_methods').select('id,provider_name,account_name,account_number,is_recommended').eq('is_active',true);
  if(error||!data||!data.length){grid.innerHTML='<div style="grid-column:span 2;text-align:center;color:#555;font-size:12px;padding:20px;">ငွေသွင်းနည်းလမ်း မရှိသေးပါ</div>';return;}
  window._depMethods=data;
  grid.innerHTML=data.map((m,i)=>`
    <div class="pm-card" onclick="pickMethod(this,${i})">
      ${m.is_recommended?'<div class="pm-badge">ဦးစားပေး</div>':''}
      <div class="pm-logo">${getProvSvg(m.provider_name,40)}</div>
      <div class="pm-info"><div class="pm-name">${m.provider_name}</div><div class="pm-num">${maskNum(m.account_number)}</div></div>
      <span class="pm-check">✓</span>
    </div>
  `).join('');
}

function pickMethod(el,idx){
  _dMethod=window._depMethods[idx];
  document.querySelectorAll('#depMethodGrid .pm-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
}

function pickAmt(el,amt){
  _dAmt=amt;
  document.querySelectorAll('.amt-btn').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('depAmtInput').value=amt;
  updatePreview();
}

function onAmtType(val){
  _dAmt=parseFloat(val)||0;
  document.querySelectorAll('.amt-btn').forEach(b=>b.classList.remove('selected'));
  updatePreview();
}

function pickBonus(yes){
  _dBonus=yes;
  document.getElementById('bOptYes').classList.toggle('selected',yes);
  document.getElementById('bOptNo').classList.toggle('selected',!yes);
  document.getElementById('depPreview').style.display=yes?'block':'none';
  updatePreview();
}

function updatePreview(){
  const bonus=_dBonus?_dAmt:0;
  setEl('pvDep',_dAmt.toLocaleString()+' ကျပ်');
  setEl('pvBonus','+ '+bonus.toLocaleString()+' ကျပ်');
  setEl('pvTotal',(_dAmt+bonus).toLocaleString()+' ကျပ်');
}

function goStep2(){
  if(!_dMethod)return gToast('💳 ငွေပေးချေနည်းလမ်း ရွေးပါ');
  if(!_dAmt||_dAmt<3000)return gToast('💵 အနည်းဆုံး 3,000 ကျပ် ထည့်ပါ');
  document.getElementById('depStep1').style.display='none';
  document.getElementById('depStep2').style.display='block';
  document.getElementById('dep2Logo').innerHTML=getProvSvg(_dMethod.provider_name,40);
  setEl('dep2Name',_dMethod.provider_name);
  setEl('dep2Phone',_dMethod.account_number);
  setEl('dep2Amt',_dAmt.toLocaleString()+' ကျပ်');
  const ord='DEP-'+Date.now().toString().slice(-8);
  window._depOrd=ord;
  setEl('dep2Order',ord);
  document.querySelectorAll('.slip-box').forEach(b=>b.value='');
  startCd(30*60);
}

function startCd(sec){
  clearInterval(_cdTimer);
  const el=document.getElementById('depCd');
  let rem=sec;
  const tick=()=>{
    const m=Math.floor(rem/60),s=rem%60;
    el.textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    if(rem<=0){clearInterval(_cdTimer);el.closest('.countdown-badge').style.background='#444';}
    rem--;
  };
  tick();_cdTimer=setInterval(tick,1000);
}

function slipMove(el,idx){
  const boxes=document.querySelectorAll('.slip-box');
  if(el.value&&idx<boxes.length-1)boxes[idx+1].focus();
}

function cpText(id){navigator.clipboard.writeText(document.getElementById(id).textContent).then(()=>gToast('ကော်ပီ ✅'));}
function cpVal(val){if(!val)return;navigator.clipboard.writeText(String(val)).then(()=>gToast('ကော်ပီ ✅'));}

async function submitSlip(){
  const boxes=document.querySelectorAll('.slip-box');
  const slip=Array.from(boxes).map(b=>b.value.trim()).join('');
  if(slip.length<5)return gToast('📝 Slip ၅ လုံး ထည့်ပါ');
  const btn=document.getElementById('dep2Btn');
  btn.disabled=true;btn.textContent='⏳ တင်နေသည်...';
  try{
    const{error}=await supabase.from('transactions').insert([{user_id:currentUserId,type:'deposit',amount:_dAmt,payment_method:_dMethod.provider_name,payment_details:slip,bonus_opted:_dBonus,status:'pending',reference:window._depOrd||null}]);
    if(error)throw error;
    clearInterval(_cdTimer);
    document.getElementById('depositModal').classList.remove('open');
    gToast('🎉 ငွေသွင်း အောင်မြင်ပါသည်!\nမိနစ် 5–10 အတွင်း Wallet ထဲ ရောက်ပါမည်','success');
  }catch(e){
    gToast('❌ '+(e.message||'ထပ်စမ်းပါ'));
    btn.disabled=false;btn.textContent='✅ ငွေသွင်းပြီး အတည်ပြုမည်';
  }
}

// ============================================================
// WITHDRAW — Open
// ============================================================
function openWithdrawModal(){
  if(!currentUserId){document.getElementById('authModal').classList.add('active');switchTab('login');return;}
  document.getElementById('withdrawModal').classList.add('open');
  const bal=document.getElementById('statBalance')?.textContent||'0.00';
  setEl('wdBalShow',bal);setEl('wdBalAmt',bal+' ကျပ်');
  initLinked();
  switchWdTab('wd',document.querySelectorAll('.wd-tab')[0]);
}

function switchWdTab(tab,el){
  document.querySelectorAll('.wd-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.wd-content').forEach(c=>c.classList.remove('active'));
  if(el)el.classList.add('active');
  const c=document.getElementById('wdTab-'+tab);
  if(c)c.classList.add('active');
  if(tab==='hist')loadTxHistory();
}

// ============================================================
// LINKED ACCOUNT
// ============================================================
function initLinked(){
  const s=localStorage.getItem('db_linked');
  if(s){_linked=JSON.parse(s);renderLinked();}
}

function renderLinked(){
  if(!_linked)return;
  document.getElementById('wdNoAcct').style.display='none';
  document.getElementById('wdHasAcct').style.display='block';
  document.getElementById('wdLinkedLogo').innerHTML=getProvSvg(_linked.provider,40);
  setEl('wdLinkedName',(_linked.provider==='kbz'?'KBZ Pay':'Wave Money')+' · '+_linked.name);
  setEl('wdLinkedNum',maskNum(_linked.number));
  updateLinkTab();
}

function updateLinkTab(){
  if(!_linked)return;
  const isKbz=_linked.provider==='kbz';
  const itemId=isKbz?'kbzItem':'waveItem';
  const txtId=isKbz?'kbzLinkedTxt':'waveLinkedTxt';
  const btnId=isKbz?'kbzLinkBtn':'waveLinkBtn';
  const otherBtnId=isKbz?'waveLinkBtn':'kbzLinkBtn';
  document.getElementById(itemId).classList.add('linked');
  setEl(txtId,_linked.name+' · '+maskNum(_linked.number));
  const btn=document.getElementById(btnId);
  btn.textContent='✓ ချိတ်ပြီး';btn.classList.add('linked');btn.disabled=true;
  if(!document.querySelector('#'+itemId+' .acct-linked-badge')){
    const badge=document.createElement('div');badge.className='acct-linked-badge';badge.textContent='✓ ချိတ်ပြီး';
    document.getElementById(itemId).prepend(badge);
  }
  const otherBtn=document.getElementById(otherBtnId);
  otherBtn.disabled=true;otherBtn.style.opacity='.35';
}

function openSheet(prov){
  if(_linked){gToast('⚠️ အကောင် ချိတ်ပြီးသားဖြစ်၍ မပြောင်းနိုင်ပါ');return;}
  _curProv=prov;
  document.getElementById('acctSheet').classList.add('open');
  setEl('sheetTitle',(prov==='kbz'?'💙 KBZ Pay':'💛 Wave Money')+' ချိတ်ဆောင်ရန်');
  document.getElementById('sheetProvIcon').innerHTML=getProvSvg(prov,24);
  document.getElementById('lnkName').value='';
  document.getElementById('lnkNum').value='';
}

function closeSheet(){document.getElementById('acctSheet').classList.remove('open');}

async function doPaste(id){
  try{const t=await navigator.clipboard.readText();document.getElementById(id).value=t;}catch{}
}

async function confirmLink(){
  const name=document.getElementById('lnkName').value.trim();
  const num=document.getElementById('lnkNum').value.trim();
  if(!name)return gToast('နာမည် ထည့်ပါ');
  if(!num||num.length<9)return gToast('ဖုန်းနံပါတ် မှန်ကန်စွာ ထည့်ပါ');
  _linked={provider:_curProv,name,number:num};
  localStorage.setItem('db_linked',JSON.stringify(_linked));
  if(currentUserId){supabase.from('users').update({withdrawal_method:_curProv==='kbz'?'KBZ Pay':'Wave Money',withdrawal_account:num,withdrawal_name:name}).eq('id',currentUserId).then(()=>{});}
  closeSheet();renderLinked();updateLinkTab();
  gToast('✅ အကောင် ချိတ်ဆောင်ပြီးပါပြီ!','success');
}

// ============================================================
// WITHDRAW REQUEST
// ============================================================
async function doWithdraw(){
  if(!currentUserId||!_linked)return;
  const amount=parseFloat(document.getElementById('wdAmtInput').value);
  if(!amount||amount<=0)return gToast('💵 ပမာဏ ထည့်ပါ');
  const btn=document.getElementById('wdSubmitBtn');
  btn.disabled=true;btn.textContent='⏳ စစ်ဆေးနေသည်...';
  try{
    const[uRes,sRes]=await Promise.all([
      supabase.from('users').select('balance,remaining_turnover').eq('id',currentUserId).single(),
      supabase.from('site_settings').select('min_withdrawal,max_withdrawal').eq('id',1).single()
    ]);
    if(uRes.error||sRes.error)throw new Error('ဒေတာ ဆွဲမရပါ');
    const tv=parseFloat(uRes.data?.remaining_turnover||0);
    const bal=parseFloat(uRes.data?.balance||0);
    const min=parseFloat(sRes.data?.min_withdrawal||10000);
    const max=parseFloat(sRes.data?.max_withdrawal||1000000);
    if(tv>0){
      setEl('tvAmtVal',tv.toLocaleString());
      document.getElementById('tvModal').classList.add('open');
      document.getElementById('wdTvBar').style.display='block';
      setEl('wdTvAmt',tv.toLocaleString()+' ကျပ်');
      resetWdBtn();return;
    }
    if(amount<min){gToast(`❌ အနည်းဆုံး ${min.toLocaleString()} ကျပ်`);resetWdBtn();return;}
    if(amount>max){gToast(`❌ အများဆုံး ${max.toLocaleString()} ကျပ်`);resetWdBtn();return;}
    if(amount>bal){gToast('❌ Balance မလုံလောက်ပါ');resetWdBtn();return;}
    const{error:txErr}=await supabase.from('transactions').insert([{user_id:currentUserId,type:'withdrawal',amount,payment_method:_linked.provider==='kbz'?'KBZ Pay':'Wave Money',payment_details:_linked.number,status:'pending'}]);
    if(txErr)throw txErr;
    document.getElementById('withdrawModal').classList.remove('open');
    gToast('🎉 ငွေထုတ်တောင်းဆိုမှု အောင်မြင်ပါသည်!\nဒိုင်မှ မိနစ် ၃၀ အတွင်း ဆက်သွယ်ပါမည်','success');
  }catch(e){gToast('❌ '+(e.message||'ထပ်စမ်းပါ'));resetWdBtn();}
}

function resetWdBtn(){
  const btn=document.getElementById('wdSubmitBtn');
  btn.disabled=false;btn.textContent='🏦 ငွေထုတ်တောင်းဆိုမည်';
}

// ============================================================
// TRANSACTION HISTORY
// ============================================================
async function loadTxHistory(){
  if(!currentUserId)return;
  const{data,error}=await supabase.from('transactions').select('*').eq('user_id',currentUserId).order('created_at',{ascending:false}).limit(25);
  const list=document.getElementById('txList');
  const empty=document.getElementById('txEmpty');
  if(error||!data||!data.length){empty.style.display='flex';return;}
  empty.style.display='none';
  list.innerHTML=data.map(tx=>{
    const isDep=tx.type==='deposit';
    const date=new Date(tx.created_at).toLocaleDateString('en-GB');
    const sc=tx.status==='approved'?'approved':tx.status==='rejected'?'rejected':'pending';
    const stxt=sc==='approved'?'✅ အတည်ပြုပြီး':sc==='rejected'?'❌ ငြင်းပယ်ပြီး':'⏳ စောင့်ဆိုင်း';
    const color=isDep?'#22c55e':'#ef4444';
    return `<div class="tx-item">
      <div class="tx-ico ${isDep?'dep':'wd'}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5">${isDep?'<path d="M12 5v14M5 12l7 7 7-7"/>':'<path d="M12 19V5M5 12l7-7 7 7"/>'}</svg></div>
      <div class="tx-info"><div class="tx-type">${isDep?'💰 ငွေသွင်း':'🏦 ငွေထုတ်'}</div><div class="tx-date">${date} · ${tx.payment_method||'—'}</div><div class="tx-badge ${sc}">${stxt}</div></div>
      <div class="tx-amount" style="color:${color}">${isDep?'+':'-'}${parseFloat(tx.amount).toLocaleString()}<div style="font-size:9px;color:#555;font-weight:400;margin-top:2px;">ကျပ်</div></div>
    </div>`;
  }).join('');
}

// ============================================================
// DOM READY
// ============================================================
document.addEventListener("DOMContentLoaded", ()=>{

  if(!window.supabase){
    console.error("Supabase CDN not loaded");
    gToast("Supabase load failed");
    return;
  }

  supabase = window.supabase.createClient(_SUPA_URL, _SUPA_KEY);

  // Banner
  (function(){
    let cur=0,tmr=null;
    const track=document.getElementById("bannerTrack");
    const dots=document.querySelectorAll("#bannerDots .dot");
    const wrap=document.getElementById("bannerWrap");
    if(!track)return;
    const update=()=>{track.style.transform=`translateX(-${cur*100}%)`;dots.forEach((d,i)=>d.classList.toggle("active",i===cur));};
    const go=n=>{cur=((n%3)+3)%3;update();};
    const start=()=>{clearInterval(tmr);tmr=setInterval(()=>go(cur+1),4000);};
    dots.forEach(d=>d.addEventListener("click",()=>{go(+d.dataset.i);start();}));
    let sx=0;
    wrap.addEventListener("touchstart",e=>{sx=e.touches[0].clientX;},{passive:true});
    wrap.addEventListener("touchend",e=>{const d=sx-e.changedTouches[0].clientX;if(Math.abs(d)>40)go(d>0?cur+1:cur-1);start();},{passive:true});
    update();start();
  })();

  // Navigation
  function showPage(nav){
    document.querySelectorAll('.page-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('topArea').style.display='';
    if(nav==='home'){document.getElementById('homePage').classList.add('active');}
    else if(nav==='tasks'){document.getElementById('topArea').style.display='none';document.getElementById('tasksPage').classList.add('active');if(currentUserId&&availableSpins>0)document.getElementById('spinBtn').disabled=false;}
    else if(nav==='agent'){document.getElementById('topArea').style.display='none';document.getElementById('agentPage').classList.add('active');}
    else if(nav==='cs'){document.getElementById('csPage').classList.add('active');}
    else if(nav==='account'){document.getElementById('accountPage').classList.add('active');}
  }
  showPage('home');
  document.querySelector('.bnav-btn[data-nav="home"]').classList.add('active');
  document.querySelectorAll(".bnav-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".bnav-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      showPage(btn.dataset.nav);
    });
  });
  document.querySelectorAll(".cat-item").forEach(item=>{
    item.addEventListener("click",()=>{document.querySelectorAll(".cat-item").forEach(el=>el.classList.remove("active"));item.classList.add("active");});
  });
  document.getElementById("langBtn").addEventListener("click",()=>{
    const isEn=document.getElementById('langLabel').textContent==='မြန်မာ';
    setEl('langLabel',isEn?'EN':'မြန်မာ');
  });

  // Games
  async function loadGamesFromDB(){
    const{data:games,error}=await supabase.from('games').select('*');
    const grid=document.getElementById('gameGrid');
    if(!grid)return;
    if(error||!games||games.length===0){grid.innerHTML=`<div style="color:var(--muted);font-size:12px;padding:20px;grid-column:span 3;text-align:center;">Games loading...</div>`;return;}
    grid.innerHTML="";
    games.forEach((g,idx)=>{
      const hue=(idx*37)%360;
      const hasImg=g.image_url&&!g.image_url.includes('placehold');
      grid.innerHTML+=`<div class="game-card" onclick="alert('Launch ${g.name}')">
        ${hasImg?`<img src="${g.image_url}" class="gc-bg" onerror="this.style.display='none'">`:`<div class="gc-bg" style="background:linear-gradient(145deg,hsl(${hue},60%,30%),hsl(${hue+20},70%,20%));"></div><div class="gc-char"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="3"/></svg></div>`}
        <div class="gc-label"><span>${g.name}</span></div></div>`;
    });
  }
  loadGamesFromDB();

  // Agent level modal data
  const agentLevels=[
    {lv:1,req:0},{lv:2,req:100},{lv:3,req:300},{lv:4,req:500},
    {lv:5,req:800},{lv:6,req:1000},{lv:7,req:10000},{lv:8,req:30000},
    {lv:9,req:50000},{lv:10,req:80000},{lv:11,req:100000},{lv:12,req:1000000},
    {lv:13,req:3000000},{lv:14,req:5000000},{lv:15,req:8000000},
    {lv:16,req:10000000},{lv:17,req:100000000},{lv:18,req:300000000},
    {lv:19,req:500000000},{lv:20,req:800000000},
  ];
  function getLevelColor(lv){
    if(lv<=2)return{a:'#CD7F32',b:'#8B4513'};if(lv<=4)return{a:'#A8A9AD',b:'#606060'};
    if(lv<=6)return{a:'#FFD700',b:'#B8860B'};if(lv<=8)return{a:'#4169E1',b:'#1E3A8A'};
    if(lv<=10)return{a:'#A855F7',b:'#6B21A8'};if(lv<=14)return{a:'#F97316',b:'#C2410C'};
    if(lv<=16)return{a:'#06B6D4',b:'#0E7490'};if(lv<=18)return{a:'#C084FC',b:'#7E22CE'};
    return{a:'#EF4444',b:'#991B1B'};
  }
  function buildLevelModal(){
    const body=document.getElementById('levelModalBody');
    const userLv=parseInt(document.getElementById('userLevelNum').textContent)||1;
    body.innerHTML=agentLevels.map(({lv,req})=>{
      const{a,b}=getLevelColor(lv);const isCurrent=lv===userLv;
      const svg=`<svg width="36" height="36" viewBox="0 0 36 36"><defs><linearGradient id="g${lv}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient></defs><polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="url(#g${lv})" opacity=".25" stroke="${a}" stroke-width="1.5"/><polygon points="18,6 28,12 28,24 18,30 8,24 8,12" fill="url(#g${lv})" opacity=".6"/><text x="18" y="22" text-anchor="middle" fill="white" font-size="${lv>=10?9:11}" font-weight="900" font-family="sans-serif">${lv}</text></svg>`;
      return `<div class="level-row${isCurrent?' current-level':''}"><div class="level-badge-icon">${svg}</div><div class="level-row-name" style="color:${isCurrent?'var(--accent)':'#fff'}">LV${lv}${isCurrent?' ✓':''}</div><div class="level-row-req" style="color:${a}">${req===0?'0.00':req.toLocaleString()+'.00'}</div></div>`;
    }).join('');
  }
  document.getElementById('levelBtn').addEventListener('click',()=>{buildLevelModal();document.getElementById('levelModal').classList.add('show');});
  document.getElementById('levelModalClose').addEventListener('click',()=>{document.getElementById('levelModal').classList.remove('show');});
  document.getElementById('levelModal').addEventListener('click',e=>{if(e.target===document.getElementById('levelModal'))document.getElementById('levelModal').classList.remove('show');});

  // Dashboard stats
  async function loadDashboardStats(userId){
    const{data,error}=await supabase.from('agent_dashboard_stats').select('today_commission,direct_members,received,bonus,yesterday_commission,salary').eq('agent_id',userId).eq('period','today').single();
    if(error||!data)return;
    setEl('statCommission',fmt(data.today_commission));
    setEl('statInvited',data.direct_members??0);
    setEl('walletReceived',fmt(data.received));
    setEl('walletBonus',fmt(data.bonus));
    setEl('walletYesterday',fmt(data.yesterday_commission));
    setEl('walletSalary',fmt(data.salary));
    const ticker=document.getElementById('agentTickerText');
    if(ticker){const t=` &rsaquo; Agent ကော်မရှင်: ${fmt(data.today_commission)} &nbsp;&nbsp;&nbsp; &rsaquo; Diamond-BETT Affiliate &nbsp;&nbsp;&nbsp;`;ticker.innerHTML=t+t;}
  }

  // My Data tab
  async function loadMyData(agentId,period='today'){
    const loading=document.getElementById('mdLoading');
    if(loading)loading.style.display='flex';
    const{data,error}=await supabase.from('agent_dashboard_stats').select('*').eq('agent_id',agentId).eq('period',period).single();
    if(loading)loading.style.display='none';
    if(error||!data)return;
    const map={
      'md-total-commission':fmt(data.total_commission),'md-direct-bet':fmt(data.direct_bet_amount),'md-sub-bet':fmt(data.sub_bet_amount),
      'md-total-members':data.total_members??0,'md-direct-members':data.direct_members??0,'md-sub-members':data.sub_members??0,
      'md-direct-performance':fmt(data.direct_performance),'md-sub-performance':fmt(data.sub_performance),'md-total-performance':fmt(data.total_performance),
      'md-direct-savings':fmt(data.direct_savings),'md-direct-withdraw':fmt(data.direct_withdraw_savings),'md-direct-total-savings':fmt(data.direct_total_savings),
      'md-effective-bets':fmt(data.effective_bets),'md-level-savings':fmt(data.level_savings),
      'md-direct-commission':fmt(data.direct_commission),'md-sub-commission':fmt(data.sub_commission),'md-total-commission2':fmt(data.total_commission),
      'md-bonus':fmt(data.bonus),'md-received':fmt(data.received),'md-salary':fmt(data.salary),
      'md-promo-savings':fmt(data.promotion_savings),'md-achievement-savings':fmt(data.achievement_savings),
      'md-direct-income-commission':fmt(data.direct_commission),'md-sub-income-commission':fmt(data.sub_commission),'md-total-income-commission':fmt(data.total_commission),
    };
    Object.entries(map).forEach(([id,val])=>setEl(id,val));
  }

  document.getElementById('timePills')?.addEventListener('click',e=>{
    const pill=e.target.closest('.time-pill');
    if(!pill||!currentAgentId)return;
    document.querySelectorAll('.time-pill').forEach(p=>p.classList.remove('active'));
    pill.classList.add('active');
    loadMyData(currentAgentId,pill.dataset.period);
  });

  // Downline
  const dlBackdrop=document.getElementById('dlBackdrop');
  const dlDateModal=document.getElementById('dlDateModal');
  const openDl=()=>{dlBackdrop.classList.add('show');dlDateModal.classList.add('show');};
  const closeDl=()=>{dlBackdrop.classList.remove('show');dlDateModal.classList.remove('show');};
  const closeRole=()=>{document.getElementById('dlRoleDropdown').style.display='none';};
  document.getElementById('dlDateBtn').addEventListener('click',openDl);
  document.getElementById('dlDateCancel').addEventListener('click',closeDl);
  dlBackdrop.addEventListener('click',()=>{closeDl();closeRole();});
  document.getElementById('dlDateConfirm').addEventListener('click',()=>{
    const ap=dlDateModal.querySelector('.dl-period-btn.active');
    if(ap)setEl('dlDateLabel',ap.textContent);closeDl();loadDownline();
  });
  dlDateModal.querySelectorAll('.dl-period-btn').forEach(btn=>{btn.addEventListener('click',()=>{dlDateModal.querySelectorAll('.dl-period-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');});});
  (function(){
    const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1,d=now.getDate();
    ['dlStartYear','dlEndYear'].forEach(id=>{const s=document.getElementById(id);for(let yr=y-2;yr<=y;yr++){const o=document.createElement('option');o.value=yr;o.textContent=yr;if(yr===y)o.selected=true;s.appendChild(o);}});
    ['dlStartMonth','dlEndMonth'].forEach(id=>{const s=document.getElementById(id);for(let mo=1;mo<=12;mo++){const o=document.createElement('option');o.value=String(mo).padStart(2,'0');o.textContent=String(mo).padStart(2,'0');if(mo===m)o.selected=true;s.appendChild(o);}});
    ['dlStartDay','dlEndDay'].forEach(id=>{const s=document.getElementById(id);for(let dy=1;dy<=31;dy++){const o=document.createElement('option');o.value=String(dy).padStart(2,'0');o.textContent=String(dy).padStart(2,'0');if(dy===d)o.selected=true;s.appendChild(o);}});
  })();
  document.getElementById('dlRoleBtn').addEventListener('click',e=>{e.stopPropagation();const dd=document.getElementById('dlRoleDropdown');dd.style.display=dd.style.display==='block'?'none':'block';});
  document.getElementById('dlRoleDropdown').querySelectorAll('.dl-role-option').forEach(opt=>{opt.addEventListener('click',()=>{document.getElementById('dlRoleDropdown').querySelectorAll('.dl-role-option').forEach(o=>o.classList.remove('active'));opt.classList.add('active');const t=opt.textContent;setEl('dlRoleLabel',t.length>8?t.substring(0,8)+'…':t);closeRole();loadDownline();});});
  document.addEventListener('click',()=>closeRole());
  document.getElementById('dlSearchToggle').addEventListener('click',()=>{const bar=document.getElementById('dlSearchBar');bar.style.display=bar.style.display==='block'?'none':'block';if(bar.style.display==='block')document.getElementById('dlSearchInput').focus();});
  document.getElementById('dlSearchSubmit').addEventListener('click',()=>loadDownline(document.getElementById('dlSearchInput').value.trim()));

  async function loadDownline(searchId=''){
    if(!currentAgentId)return;
    const{data,error}=await supabase.rpc('get_agent_subordinates',{p_agent_id:currentAgentId});
    const empty=document.getElementById('dlEmpty');const tableWrap=document.getElementById('dlTableWrap');const tbody=document.getElementById('dlTableBody');
    if(error||!data||data.length===0){empty.style.display='flex';tableWrap.style.display='none';return;}
    let rows=data;
    if(searchId)rows=rows.filter(r=>String(r.id||'').includes(searchId)||String(r.phone||'').includes(searchId));
    if(rows.length===0){empty.style.display='flex';tableWrap.style.display='none';return;}
    empty.style.display='none';tableWrap.style.display='block';
    tbody.innerHTML=rows.map(r=>`<tr><td>${r.phone||r.id||'—'}</td><td><span class="dl-level-badge">Lv ${r.level||1}</span></td><td style="font-size:10px;">${r.joined_at?new Date(r.joined_at).toLocaleDateString('en-GB'):'—'}</td><td>${fmt(r.bet_amount)}</td><td>${fmt(r.deposit_amount)}</td></tr>`).join('');
  }

  // Agent tab switching
  document.getElementById('agentTabBar').addEventListener('click',e=>{
    const btn=e.target.closest('.atab');if(!btn)return;
    document.querySelectorAll('.atab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.atab-content').forEach(c=>c.classList.remove('active'));
    btn.classList.add('active');
    const target=document.getElementById('atab-'+btn.dataset.atab);
    if(target)target.classList.add('active');
    if(btn.dataset.atab==='mydata'&&currentAgentId){const p=document.querySelector('.time-pill.active')?.dataset.period||'today';loadMyData(currentAgentId,p);}
    if(btn.dataset.atab==='downline'&&currentAgentId)loadDownline();
  });

  // Lucky Wheel
  const wheelSlots=[{label:'5,000',amount:5000,color:'#6B1010'},{label:'15,000',amount:15000,color:'#3D0707'},{label:'30,000',amount:30000,color:'#6B1010'},{label:'50,000',amount:50000,color:'#3D0707'},{label:'65,000',amount:65000,color:'#6B1010'},{label:'80,000',amount:80000,color:'#3D0707'},{label:'ဗလာ',amount:0,color:'#151525'},{label:'ဗလာ',amount:0,color:'#0D0D18'}];
  const turnoverMult={5000:5,15000:6,30000:7,50000:10,65000:12,80000:15};
  const canvas=document.getElementById('wheelCanvas');const ctx=canvas.getContext('2d');
  let wheelAngle=0,isSpinning=false,animId=null;
  function drawWheel(angle){const sz=260,cx=sz/2,cy=sz/2,r=118,sa=(Math.PI*2)/8;ctx.clearRect(0,0,sz,sz);ctx.beginPath();ctx.arc(cx,cy,r+4,0,Math.PI*2);ctx.strokeStyle='#C9A227';ctx.lineWidth=4;ctx.stroke();wheelSlots.forEach((slot,i)=>{const start=angle+i*sa,end=start+sa;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,end);ctx.closePath();ctx.fillStyle=slot.color;ctx.fill();ctx.strokeStyle='#C9A227';ctx.lineWidth=1.5;ctx.stroke();ctx.save();ctx.translate(cx,cy);ctx.rotate(start+sa/2);ctx.fillStyle=slot.amount===0?'#333':'#FFD700';ctx.font=`bold 10px "Segoe UI",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=4;ctx.fillText(slot.label,r*0.62,0);ctx.restore();});const cg=ctx.createRadialGradient(cx-5,cy-5,3,cx,cy,22);cg.addColorStop(0,'#FFE55C');cg.addColorStop(1,'#8B6014');ctx.beginPath();ctx.arc(cx,cy,22,0,Math.PI*2);ctx.fillStyle=cg;ctx.fill();ctx.strokeStyle='#C9A227';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.moveTo(cx,cy-9);ctx.lineTo(cx+7,cy);ctx.lineTo(cx,cy+9);ctx.lineTo(cx-7,cy);ctx.closePath();ctx.fillStyle='rgba(255,255,255,.9)';ctx.fill();}
  drawWheel(0);
  function spinToSlot(slotIndex,onDone){if(isSpinning)return;isSpinning=true;document.getElementById('spinBtn').disabled=true;const idx=(slotIndex-1)%8,sa=(Math.PI*2)/8;const targetBase=(3*Math.PI/2)-idx*sa-sa/2;const curMod=((wheelAngle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);const tgtMod=((targetBase%(Math.PI*2))+Math.PI*2)%(Math.PI*2);let diff=tgtMod-curMod;if(diff<0)diff+=Math.PI*2;const total=6*Math.PI*2+diff,end=wheelAngle+total,start=wheelAngle,t0=performance.now();const ease=t=>1-Math.pow(1-t,3);function animate(now){const t=Math.min((now-t0)/5000,1);wheelAngle=start+total*ease(t);drawWheel(wheelAngle);if(t<1){animId=requestAnimationFrame(animate);}else{animId=null;wheelAngle=end;isSpinning=false;onDone&&onDone();}}animId=requestAnimationFrame(animate);}
  document.getElementById('spinResultClose').addEventListener('click',()=>document.getElementById('spinResultOverlay').classList.remove('show'));
  document.getElementById('spinBtn').addEventListener('click',async()=>{
    if(!currentUserId){document.getElementById('authModal').classList.add('active');switchTab('login');return;}
    if(availableSpins<=0){gToast("လှည့်ပိုင်ခွင့် မရှိသေးပါ");return;}
    const{data,error}=await supabase.rpc('spin_lucky_wheel',{p_user_id:currentUserId});
    if(error){gToast(error.message||"Spin မအောင်မြင်ပါ");return;}
    availableSpins--;setEl('availableSpins',availableSpins);
    const slot=wheelSlots[(data.slot_index-1)%8];
    spinToSlot(data.slot_index,()=>{
      const overlay=document.getElementById('spinResultOverlay');const content=document.getElementById('spinResultContent');
      if(slot.amount===0){content.innerHTML=`<div class="spin-result-blank">ဗလာ — သင်ကံမကောင်းပါ</div><div class="spin-result-unit" style="margin-bottom:16px;">ထပ်ကြိုးစားပါ</div>`;}
      else{const to=slot.amount*turnoverMult[slot.amount];content.innerHTML=`<div class="spin-result-amount">${slot.amount.toLocaleString()}</div><div class="spin-result-unit">ကျပ် ရရှိသည်</div><div class="spin-result-turnover">Turnover: <strong style="color:var(--gold2);">${to.toLocaleString()} ကျပ်</strong></div>`;}
      overlay.classList.add('show');
      const list=document.getElementById('spinHistoryList');const now=new Date().toLocaleString('en-GB');const item=document.createElement('div');item.className='history-item';item.innerHTML=`<span class="history-date">${now}</span><span class="history-desc">Lucky Wheel</span><span class="history-amount">${slot.amount>0?'+'+slot.amount.toLocaleString()+' ကျပ်':'ဗလာ'}</span>`;
      if(list.querySelector('.history-empty'))list.innerHTML='';list.prepend(item);
      if(availableSpins>0)document.getElementById('spinBtn').disabled=false;
    });
  });

  document.getElementById('bonusCodeBtn').addEventListener('click',async()=>{
    if(!currentUserId){document.getElementById('authModal').classList.add('active');switchTab('login');return;}
    const code=document.getElementById('bonusCodeInput').value.trim();
    if(!code){gToast("Bonus Code ထည့်ပါ");return;}
    const{data:bonusAmount,error}=await supabase.rpc('claim_bonus_code',{p_user_id:currentUserId,p_code:code.toUpperCase()});
    if(error){gToast(error.message||"Code မမှန်ပါ");return;}
    gToast(`အောင်မြင်ပါသည်! Bonus ${bonusAmount} ကျပ် ထည့်သွင်းပေးပြီး`,'success');
    document.getElementById('bonusCodeInput').value='';
  });

  // Daily timer
  function updateDailyTimer(){const now=new Date(),next=new Date();next.setHours(24,0,0,0);const d=next-now;const h=String(Math.floor(d/3600000)).padStart(2,'0');const m=String(Math.floor((d%3600000)/60000)).padStart(2,'0');const s=String(Math.floor((d%60000)/1000)).padStart(2,'0');setEl('task1Timer',`${h}:${m}:${s}`);}
  updateDailyTimer();setInterval(updateDailyTimer,1000);

  // Commission countdown
  const countEl=document.getElementById('commissionCountdown');
  if(countEl){const tick=()=>{const now=new Date(),next=new Date();next.setHours(24,0,0,0);const d=next-now;const h=String(Math.floor(d/3600000)).padStart(2,'0');const m=String(Math.floor((d%3600000)/60000)).padStart(2,'0');const s=String(Math.floor((d%60000)/1000)).padStart(2,'0');countEl.textContent=`(နောက်ခြေချချိန်: ${h}:${m}:${s})`;};tick();setInterval(tick,1000);}

  // AUTH
  const modal=document.getElementById("authModal");
  document.getElementById("showAuthBtn").addEventListener("click",()=>{modal.classList.add('active');switchTab('login');});
  document.getElementById('modalCloseBtn').addEventListener("click",()=>modal.classList.remove('active'));
  modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove('active');});
  document.getElementById('agentLoginBtn').addEventListener("click",()=>{modal.classList.add('active');switchTab('login');});

  document.getElementById('registerBtn').addEventListener('click',async()=>{
    const phone=document.getElementById('regPhone').value.trim();const password=document.getElementById('regPassword').value.trim();const name=document.getElementById('regName').value.trim();const refCode=document.getElementById('referrer_code_input').value.trim();const checked=document.getElementById('ageCheck').checked;
    if(!phone||!password||!name)return gToast("အချက်အလက်များ ပြည့်စုံစွာ ဖြည့်ပါ");
    if(!checked)return gToast("အသက် 18+ သတ်မှတ်ချက်ကို ဝန်ခံပါ");
    try{
      const resp=await fetch("https://xjqrwcsxiaybpztzestb.supabase.co/functions/v1/register-user",{method:"POST",headers:{"Content-Type":"application/json","apikey":_SUPA_KEY,"Authorization":"Bearer "+_SUPA_KEY},body:JSON.stringify({phone,password,fullname:name,referrer_code:refCode||null})});
      const result=await resp.json();
      if(resp.ok){gToast("မှတ်ပုံတင်ခြင်း အောင်မြင်သည်! Code: "+result.ref_code,'success');modal.classList.remove('active');onLoginSuccess({phone,name,ref_code:result.ref_code},result.ref_code,0,null);}
      else gToast("အမှားအယွင်း: "+result.error);
    }catch(err){console.error(err);gToast("Edge Function နဲ့ ချိတ်ဆက်လို့ မရပါ");}
  });

  document.getElementById('loginBtn').addEventListener('click',async()=>{
    const phone=document.getElementById('loginPhone').value.trim();const password=document.getElementById('loginPassword').value.trim();
    if(!phone||!password)return gToast("Phone & Password ဖြည့်ပါ");
    const{data,error}=await supabase.auth.signInWithPassword({email:`${phone}@diamondbett.com`,password});
    if(error){gToast("Login မအောင်မြင်ပါ: "+error.message);return;}
    const{data:ud}=await supabase.from('users').select('ref_code,fullname,phone,balance').eq('id',data.user.id).single();
    modal.classList.remove('active');currentUserId=data.user.id;currentAgentId=data.user.id;
    onLoginSuccess(ud||{phone},ud?.ref_code,ud?.balance,data.user.id);
  });

  function onLoginSuccess(user,refCode,balance=0,userId=null){
    if(userId)currentUserId=userId;
    document.getElementById('showAuthBtn').style.display='none';
    document.getElementById('walletBtns').style.display='flex';
    const phone=user.phone||user.name||'—';
    const agentRefCode=refCode||user.ref_code||'—';
    const shareLink=agentRefCode!=='—'?`https://diamond-bett.vercel.app/?ref=${agentRefCode}`:'—';
    const today=new Date().toLocaleDateString('en-GB');
    setEl('agentUserPhone',phone);setEl('agentPhoneDisplay',phone);setEl('agentJoinDate',today);
    document.getElementById('agentShareLinkInput').value=shareLink;
    setEl('statBalance',fmt(balance));setEl('userLevelNum','1');
    const invRef=document.getElementById('inv-refcode');if(invRef)invRef.textContent=agentRefCode;
    const invLink=document.getElementById('inv-link');if(invLink)invLink.value=shareLink;
    document.getElementById('agentLocked').style.display='none';
    document.getElementById('agentUnlocked').style.display='flex';
    availableSpins=1;setEl('availableSpins',availableSpins);
    document.getElementById('spinBtn').disabled=false;
    if(currentUserId){loadDashboardStats(currentUserId);initLinked();}
  }

  // Copy / Share
  document.getElementById('agentCopyLinkBtn').addEventListener('click',copyAgentLink);
  document.getElementById('copyPhoneBtn').addEventListener('click',()=>{navigator.clipboard.writeText(document.getElementById('agentPhoneDisplay').textContent).then(()=>gToast("ကူးယူပြီးပါပြီ! ✅"));});
  document.getElementById('shareNativeBtn').addEventListener('click',async()=>{const link=document.getElementById('agentShareLinkInput').value;if(!link||link==='—')return;navigator.share?await navigator.share({title:'Diamond-BETT',url:link}):copyAgentLink();});
  function copyAgentLink(){const input=document.getElementById('agentShareLinkInput');if(!input.value||input.value==='—')return;navigator.clipboard.writeText(input.value).then(()=>gToast("Link ကူးယူပြီးပါပြီ! ✅")).catch(()=>{input.select();document.execCommand('copy');gToast("Link ကူးပြီး ✅");});}

  // ===== DEPOSIT / WITHDRAW BUTTONS =====
  document.querySelectorAll('.wallet-btn.deposit').forEach(b=>b.addEventListener('click',openDepositModal));
  document.querySelectorAll('.wallet-btn.withdraw').forEach(b=>b.addEventListener('click',openWithdrawModal));

  document.getElementById('depCloseBtn').addEventListener('click',()=>{clearInterval(_cdTimer);document.getElementById('depositModal').classList.remove('open');});
  document.getElementById('wdCloseBtn').addEventListener('click',()=>{document.getElementById('withdrawModal').classList.remove('open');});

  // Ref from URL
  const urlParams=new URLSearchParams(window.location.search);
  const invitedBy=urlParams.get('ref');
  if(invitedBy){const ri=document.getElementById('referrer_code_input');if(ri){ri.value=invitedBy;ri.readOnly=true;}switchTab('register');modal.classList.add('active');}

  // Init linked account
  initLinked();

}); // end DOMContentLoaded
