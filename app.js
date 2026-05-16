// ============================================================
// GLOBAL HELPERS
// ============================================================
function switchTab(tab) {
  document.getElementById('registerForm').style.display = tab==='register'?'block':'none';
  document.getElementById('loginForm').style.display    = tab==='login'?'block':'none';
  document.getElementById('tabRegister').classList.toggle('active', tab==='register');
  document.getElementById('tabLogin').classList.toggle('active',    tab==='login');
}
function toggleEye(id, btn) {
  const inp = document.getElementById(id);
  inp.type = inp.type==='password'?'text':'password';
  btn.style.color = inp.type==='text'?'#f5c518':'rgba(255,255,255,.5)';
}
function shareVia(platform) {
  const link = document.getElementById('agentShareLinkInput')?.value;
  if (!link||link==='—') return alert("Login ဝင်ပြီးမှ Share လုပ်ပါ");
  const text = encodeURIComponent(`Diamond-BETT မှ ဖိတ်ကြားပါသည်! ${link}`);
  const urls = {
    telegram:`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`,
    viber:`viber://forward?text=${text}`,
    facebook:`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    whatsapp:`https://wa.me/?text=${text}`
  };
  if (urls[platform]) window.open(urls[platform],'_blank');
}
function fmt(v,d=2){const n=parseFloat(v);return isNaN(n)?'0.00':n.toFixed(d);}
function setEl(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}

// ============================================================
// DOM READY
// ============================================================
document.addEventListener("DOMContentLoaded",()=>{

  // SUPABASE
  const supabaseUrl = "https://xjqrwcsxiaybpztzestb.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqcXJ3Y3N4aWF5YnB6dHplc3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzQxMDksImV4cCI6MjA5NDM1MDEwOX0.Kn5sLOTBdNtlooaH-q8ml0cOEswMlgMTSP7GFe7mbxg";
  const supabase = window.supabase.createClient(supabaseUrl,supabaseKey);

  let currentUserId  = null;
  let currentAgentId = null;
  let availableSpins = 0;

  // ?ref= auto-fill
  const urlParams = new URLSearchParams(window.location.search);
  const invitedBy = urlParams.get('ref');
  if (invitedBy) {
    const ri = document.getElementById('referrer_code_input');
    if (ri){ri.value=invitedBy;ri.readOnly=true;}
    switchTab('register');
    document.getElementById('authModal').classList.add('active');
  }

  // ============================================================
  // BANNER
  // ============================================================
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

  // ============================================================
  // GAMES
  // ============================================================
  async function loadGamesFromDB(){
    const{data:games,error}=await supabase.from('games').select('*');
    console.log("GAMES:",games,"ERROR:",error);
    const grid=document.getElementById('gameGrid');
    if(!grid)return;
    if(error||!games||games.length===0){grid.innerHTML=`<div style="color:var(--muted);font-size:12px;padding:20px;grid-column:span 3;text-align:center;">Games loading...</div>`;return;}
    grid.innerHTML="";
    games.forEach((g,idx)=>{
      const hue=(idx*37)%360;
      const hasImg=g.image_url&&!g.image_url.includes('placehold');
      grid.innerHTML+=`<div class="game-card" onclick="alert('Launch ${g.name}')">
        ${hasImg?`<img src="${g.image_url}" class="gc-bg" onerror="this.style.display='none'">`
          :`<div class="gc-bg" style="background:linear-gradient(145deg,hsl(${hue},60%,30%),hsl(${hue+20},70%,20%));"></div><div class="gc-char"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="3"/></svg></div>`}
        <div class="gc-label"><span>${g.name}</span></div></div>`;
    });
  }
  loadGamesFromDB();

  // ============================================================
  // DASHBOARD STATS — NEW: fetches real commission for header
  // ============================================================
  async function loadDashboardStats(userId){
    const{data,error}=await supabase
      .from('agent_dashboard_stats')
      .select('today_commission,total_commission,direct_members,received,bonus,yesterday_commission,salary')
      .eq('agent_id',userId)
      .eq('period','today')
      .single();
    if(error||!data)return;
    setEl('statCommission', fmt(data.today_commission));
    setEl('statInvited',    data.direct_members??0);
    // Populate wallet card with today's data
    setEl('walletReceived',  fmt(data.received));
    setEl('walletBonus',     fmt(data.bonus));
    setEl('walletYesterday', fmt(data.yesterday_commission));
    setEl('walletSalary',    fmt(data.salary));
    // Update ticker
    const ticker=document.getElementById('agentTickerText');
    if(ticker){
      const t=` &rsaquo; သာ ကော်မရှင်: ${fmt(data.today_commission)} &nbsp;&nbsp;&nbsp; &rsaquo; Diamond-BETT Affiliate &nbsp;&nbsp;&nbsp;`;
      ticker.innerHTML=t+t;
    }
  }

  // ============================================================
  // MY DATA
  // ============================================================
  async function loadMyData(agentId,period='today'){
    const loading=document.getElementById('mdLoading');
    if(loading)loading.style.display='flex';
    const{data,error}=await supabase.from('agent_dashboard_stats').select('*').eq('agent_id',agentId).eq('period',period).single();
    if(loading)loading.style.display='none';
    if(error||!data)return;
    setEl('md-total-commission',fmt(data.total_commission));
    setEl('md-direct-bet',fmt(data.direct_bet_amount));
    setEl('md-sub-bet',fmt(data.sub_bet_amount));
    setEl('md-total-members',data.total_members??0);
    setEl('md-direct-members',data.direct_members??0);
    setEl('md-sub-members',data.sub_members??0);
    setEl('md-direct-performance',fmt(data.direct_performance));
    setEl('md-sub-performance',fmt(data.sub_performance));
    setEl('md-total-performance',fmt(data.total_performance));
    setEl('md-direct-savings',fmt(data.direct_savings));
    setEl('md-direct-withdraw',fmt(data.direct_withdraw_savings));
    setEl('md-direct-total-savings',fmt(data.direct_total_savings));
    setEl('md-effective-bets',fmt(data.effective_bets));
    setEl('md-level-savings',fmt(data.level_savings));
    setEl('md-direct-commission',fmt(data.direct_commission));
    setEl('md-sub-commission',fmt(data.sub_commission));
    setEl('md-total-commission2',fmt(data.total_commission));
    setEl('md-bonus',fmt(data.bonus));
    setEl('md-received',fmt(data.received));
    setEl('md-salary',fmt(data.salary));
    setEl('md-promo-savings',fmt(data.promotion_savings));
    setEl('md-achievement-savings',fmt(data.achievement_savings));
    setEl('md-direct-reg',data.direct_registrations??0);
    setEl('md-deposited-members',data.deposited_members??0);
    setEl('md-first-dep-members',data.first_deposit_members??0);
    setEl('md-reg-first-dep',data.reg_first_deposit??0);
    setEl('md-deposit-total',fmt(data.deposit_total));
    setEl('md-first-dep-total',fmt(data.first_deposit_total));
    setEl('md-reg-first-withdraw',fmt(data.reg_first_withdraw));
    setEl('md-withdraw-total',fmt(data.withdrawal_total));
    setEl('md-withdraw-count',data.withdrawal_count??0);
    setEl('md-bonus-requests',fmt(data.bonus_requests));
    setEl('md-negative-count',data.negative_count??0);
    setEl('md-valid-bets',fmt(data.valid_bets));
    setEl('md-bet-count',data.bet_count??0);
    setEl('md-win-loss',fmt(data.win_loss));
    setEl('md-direct-perf2',fmt(data.direct_performance));
    setEl('md-direct-income-commission',fmt(data.direct_commission));
    setEl('md-sub-income-commission',fmt(data.sub_commission));
    setEl('md-total-income-commission',fmt(data.total_commission));
  }

  document.getElementById('timePills')?.addEventListener('click',e=>{
    const pill=e.target.closest('.time-pill');
    if(!pill||!currentAgentId)return;
    document.querySelectorAll('.time-pill').forEach(p=>p.classList.remove('active'));
    pill.classList.add('active');
    loadMyData(currentAgentId,pill.dataset.period);
  });

  // ============================================================
  // DOWNLINE
  // ============================================================
  let dlCurrentPeriod='today';

  const dlBackdrop=document.getElementById('dlBackdrop');
  const dlDateModal=document.getElementById('dlDateModal');

  const openDateModal=()=>{dlBackdrop.classList.add('show');dlDateModal.classList.add('show');};
  const closeDateModal=()=>{dlBackdrop.classList.remove('show');dlDateModal.classList.remove('show');};
  const closeRoleDropdown=()=>{document.getElementById('dlRoleDropdown').style.display='none';};

  document.getElementById('dlDateBtn').addEventListener('click',openDateModal);
  document.getElementById('dlDateCancel').addEventListener('click',closeDateModal);
  dlBackdrop.addEventListener('click',()=>{closeDateModal();closeRoleDropdown();});
  document.getElementById('dlDateConfirm').addEventListener('click',()=>{
    const ap=dlDateModal.querySelector('.dl-period-btn.active');
    if(ap){dlCurrentPeriod=ap.dataset.period;setEl('dlDateLabel',ap.textContent);}
    closeDateModal();loadDownline();
  });
  dlDateModal.querySelectorAll('.dl-period-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{dlDateModal.querySelectorAll('.dl-period-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');});
  });

  // Date selects
  (function(){
    const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1,d=now.getDate();
    ['dlStartYear','dlEndYear'].forEach(id=>{
      const sel=document.getElementById(id);
      for(let yr=y-2;yr<=y;yr++){const o=document.createElement('option');o.value=yr;o.textContent=yr;if(yr===y)o.selected=true;sel.appendChild(o);}
    });
    ['dlStartMonth','dlEndMonth'].forEach(id=>{
      const sel=document.getElementById(id);
      for(let mo=1;mo<=12;mo++){const o=document.createElement('option');o.value=String(mo).padStart(2,'0');o.textContent=String(mo).padStart(2,'0');if(mo===m)o.selected=true;sel.appendChild(o);}
    });
    ['dlStartDay','dlEndDay'].forEach(id=>{
      const sel=document.getElementById(id);
      for(let dy=1;dy<=31;dy++){const o=document.createElement('option');o.value=String(dy).padStart(2,'0');o.textContent=String(dy).padStart(2,'0');if(dy===d)o.selected=true;sel.appendChild(o);}
    });
  })();

  document.getElementById('dlRoleBtn').addEventListener('click',e=>{
    e.stopPropagation();
    const dd=document.getElementById('dlRoleDropdown');
    dd.style.display=dd.style.display==='block'?'none':'block';
  });
  document.getElementById('dlRoleDropdown').querySelectorAll('.dl-role-option').forEach(opt=>{
    opt.addEventListener('click',()=>{
      document.getElementById('dlRoleDropdown').querySelectorAll('.dl-role-option').forEach(o=>o.classList.remove('active'));
      opt.classList.add('active');
      const t=opt.textContent;
      setEl('dlRoleLabel',t.length>8?t.substring(0,8)+'…':t);
      closeRoleDropdown();loadDownline();
    });
  });
  document.addEventListener('click',()=>closeRoleDropdown());

  document.getElementById('dlSearchToggle').addEventListener('click',()=>{
    const bar=document.getElementById('dlSearchBar');
    bar.style.display=bar.style.display==='block'?'none':'block';
    if(bar.style.display==='block')document.getElementById('dlSearchInput').focus();
  });
  document.getElementById('dlSearchSubmit').addEventListener('click',()=>loadDownline(document.getElementById('dlSearchInput').value.trim()));

  async function loadDownline(searchId=''){
    if(!currentAgentId)return;
    const{data,error}=await supabase.rpc('get_agent_subordinates',{p_agent_id:currentAgentId});
    const empty=document.getElementById('dlEmpty');
    const tableWrap=document.getElementById('dlTableWrap');
    const tbody=document.getElementById('dlTableBody');
    if(error||!data||data.length===0){empty.style.display='flex';tableWrap.style.display='none';return;}
    let rows=data;
    if(searchId)rows=rows.filter(r=>String(r.id||'').includes(searchId)||String(r.phone||'').includes(searchId));
    if(rows.length===0){empty.style.display='flex';tableWrap.style.display='none';return;}
    empty.style.display='none';tableWrap.style.display='block';
    tbody.innerHTML=rows.map(r=>`<tr>
      <td>${r.phone||r.id||'—'}</td>
      <td><span class="dl-level-badge">Lv ${r.level||1}</span></td>
      <td style="font-size:10px;">${r.joined_at?new Date(r.joined_at).toLocaleDateString('en-GB'):'—'}</td>
      <td>${fmt(r.bet_amount)}</td>
      <td>${fmt(r.deposit_amount)}</td>
    </tr>`).join('');
  }

  // ============================================================
  // LUCKY WHEEL
  // ============================================================
  const wheelSlots=[
    {label:'5,000',amount:5000,color:'#6B1010',dark:'#3D0707'},
    {label:'15,000',amount:15000,color:'#3D0707',dark:'#6B1010'},
    {label:'30,000',amount:30000,color:'#6B1010',dark:'#3D0707'},
    {label:'50,000',amount:50000,color:'#3D0707',dark:'#6B1010'},
    {label:'65,000',amount:65000,color:'#6B1010',dark:'#3D0707'},
    {label:'80,000',amount:80000,color:'#3D0707',dark:'#6B1010'},
    {label:'ဗလာ',amount:0,color:'#151525',dark:'#0D0D18'},
    {label:'ဗလာ',amount:0,color:'#0D0D18',dark:'#151525'},
  ];
  const turnoverMult={5000:5,15000:6,30000:7,50000:10,65000:12,80000:15};

  const canvas=document.getElementById('wheelCanvas');
  const ctx=canvas.getContext('2d');
  let wheelAngle=0,isSpinning=false,animId=null;

  function drawWheel(angle){
    const sz=260,cx=sz/2,cy=sz/2,r=118;
    const sa=(Math.PI*2)/8;
    ctx.clearRect(0,0,sz,sz);
    // Outer ring
    ctx.beginPath();ctx.arc(cx,cy,r+4,0,Math.PI*2);
    ctx.strokeStyle='#C9A227';ctx.lineWidth=4;ctx.stroke();
    wheelSlots.forEach((slot,i)=>{
      const start=angle+i*sa,end=start+sa;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,end);ctx.closePath();
      ctx.fillStyle=slot.color;ctx.fill();
      ctx.strokeStyle='#C9A227';ctx.lineWidth=1.5;ctx.stroke();
      ctx.save();ctx.translate(cx,cy);ctx.rotate(start+sa/2);
      ctx.fillStyle=slot.amount===0?'#333':'#FFD700';
      ctx.font=`bold 10px "Segoe UI",sans-serif`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=4;
      ctx.fillText(slot.label,r*0.62,0);ctx.restore();
    });
    // Center
    const cg=ctx.createRadialGradient(cx-5,cy-5,3,cx,cy,22);
    cg.addColorStop(0,'#FFE55C');cg.addColorStop(1,'#8B6014');
    ctx.beginPath();ctx.arc(cx,cy,22,0,Math.PI*2);ctx.fillStyle=cg;ctx.fill();
    ctx.strokeStyle='#C9A227';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,cy-9);ctx.lineTo(cx+7,cy);ctx.lineTo(cx,cy+9);ctx.lineTo(cx-7,cy);
    ctx.closePath();ctx.fillStyle='rgba(255,255,255,.9)';ctx.fill();
  }
  drawWheel(0);

  function spinToSlot(slotIndex,onDone){
    if(isSpinning)return;
    isSpinning=true;
    document.getElementById('spinBtn').disabled=true;
    const idx=(slotIndex-1)%8;
    const sa=(Math.PI*2)/8;
    const targetBase=(3*Math.PI/2)-idx*sa-sa/2;
    const curMod=((wheelAngle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
    const tgtMod=((targetBase%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
    let diff=tgtMod-curMod; if(diff<0)diff+=Math.PI*2;
    const total=6*Math.PI*2+diff;
    const end=wheelAngle+total,start=wheelAngle,t0=performance.now();
    const ease=t=>1-Math.pow(1-t,3);
    function animate(now){
      const t=Math.min((now-t0)/5000,1);
      wheelAngle=start+total*ease(t);drawWheel(wheelAngle);
      if(t<1){animId=requestAnimationFrame(animate);}
      else{animId=null;wheelAngle=end;isSpinning=false;onDone&&onDone();}
    }
    animId=requestAnimationFrame(animate);
  }

  function showSpinResult(slot){
    const overlay=document.getElementById('spinResultOverlay');
    const content=document.getElementById('spinResultContent');
    if(slot.amount===0){
      content.innerHTML=`<div class="spin-result-blank">ဗလာ — သင်ကံမကောင်းပါ</div><div class="spin-result-unit" style="margin-bottom:16px;">ထပ်ကြိုးစားပါ</div>`;
    } else {
      const to=slot.amount*turnoverMult[slot.amount];
      content.innerHTML=`<div class="spin-result-amount">${slot.amount.toLocaleString()}</div><div class="spin-result-unit">ကျပ် ရရှိသည်</div><div class="spin-result-turnover">Turnover လိုအပ်ချက်: <strong style="color:var(--gold2);">${to.toLocaleString()} ကျပ်</strong><br>(${slot.amount.toLocaleString()} × ${turnoverMult[slot.amount]})</div>`;
    }
    overlay.classList.add('show');
  }

  document.getElementById('spinResultClose').addEventListener('click',()=>document.getElementById('spinResultOverlay').classList.remove('show'));

  document.getElementById('spinBtn').addEventListener('click',async()=>{
    if(!currentUserId){document.getElementById('authModal').classList.add('active');switchTab('login');return;}
    if(availableSpins<=0){alert("လှည့်ပိုင်ခွင့် မရှိသေးပါ");return;}
    const{data,error}=await supabase.rpc('spin_lucky_wheel',{p_user_id:currentUserId});
    if(error){alert(error.message||"Spin မအောင်မြင်ပါ");return;}
    availableSpins--;setEl('availableSpins',availableSpins);
    const slot=wheelSlots[(data.slot_index-1)%8];
    spinToSlot(data.slot_index,()=>{
      showSpinResult(slot);
      const list=document.getElementById('spinHistoryList');
      const now=new Date().toLocaleString('en-GB');
      const item=document.createElement('div');item.className='history-item';
      item.innerHTML=`<span class="history-date">${now}</span><span class="history-desc">Lucky Wheel ဆော့ကစား</span><span class="history-amount">${slot.amount>0?'+'+slot.amount.toLocaleString()+' ကျပ်':'ဗလာ'}</span>`;
      if(list.querySelector('.history-empty'))list.innerHTML='';
      list.prepend(item);
      if(availableSpins>0)document.getElementById('spinBtn').disabled=false;
    });
  });

  document.getElementById('bonusCodeBtn').addEventListener('click',async()=>{
    if(!currentUserId){document.getElementById('authModal').classList.add('active');switchTab('login');return;}
    const code=document.getElementById('bonusCodeInput').value.trim();
    if(!code){alert("Bonus Code ထည့်ပါ");return;}
    const{data:bonusAmount,error}=await supabase.rpc('claim_bonus_code',{p_user_id:currentUserId,p_code:code.toUpperCase()});
    if(error){alert(error.message||"Code မမှန်ပါ");return;}
    alert(`အောင်မြင်ပါသည်! Bonus ${bonusAmount} ကျပ် ထည့်သွင်းပေးပြီးပါပြီ`);
    document.getElementById('bonusCodeInput').value='';
  });

  // Daily timer
  function updateDailyTimer(){
    const now=new Date(),next=new Date();next.setHours(24,0,0,0);
    const d=next-now;
    const h=String(Math.floor(d/3600000)).padStart(2,'0');
    const m=String(Math.floor((d%3600000)/60000)).padStart(2,'0');
    const s=String(Math.floor((d%60000)/1000)).padStart(2,'0');
    setEl('task1Timer',`${h}:${m}:${s}`);
  }
  updateDailyTimer();setInterval(updateDailyTimer,1000);

  // ============================================================
  // NAVIGATION
  // ============================================================
  const topArea=document.getElementById('topArea');
  const sidebar=document.getElementById('sidebar');
  const homePageArea=document.getElementById('homePageArea');
  const agentPage=document.getElementById('agentPage');
  const tasksPage=document.getElementById('tasksPage');
  const csPage=document.getElementById('csPage');
  const accountPage=document.getElementById('accountPage');

  function showPage(nav){
    [sidebar,homePageArea].forEach(el=>el.style.display='none');
    [agentPage,tasksPage,csPage,accountPage].forEach(el=>el.classList.remove('active'));
    topArea.style.display='';
    if(nav==='home'){sidebar.style.display='block';homePageArea.style.display='block';}
    else if(nav==='tasks'){topArea.style.display='none';tasksPage.classList.add('active');if(currentUserId&&availableSpins>0)document.getElementById('spinBtn').disabled=false;}
    else if(nav==='agent'){topArea.style.display='none';agentPage.classList.add('active');}
    else if(nav==='cs'){csPage.classList.add('active');}
    else if(nav==='account'){accountPage.classList.add('active');}
  }

  document.querySelectorAll(".bnav-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".bnav-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");showPage(btn.dataset.nav);
    });
  });
  document.querySelectorAll(".cat-item").forEach(item=>{
    item.addEventListener("click",()=>{document.querySelectorAll(".cat-item").forEach(el=>el.classList.remove("active"));item.classList.add("active");});
  });
  document.getElementById("langBtn").addEventListener("click",()=>{
    const isEn=document.getElementById('langLabel').textContent==='မြန်မာ';
    setEl('langLabel',isEn?'EN':'မြန်မာ');
  });

  // Agent tab switching
  document.getElementById('agentTabBar').addEventListener('click',e=>{
    const btn=e.target.closest('.atab');if(!btn)return;
    document.querySelectorAll('.atab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.atab-content').forEach(c=>c.classList.remove('active'));
    btn.classList.add('active');
    const target=document.getElementById('atab-'+btn.dataset.atab);
    if(target)target.classList.add('active');
    if(btn.dataset.atab==='mydata'&&currentAgentId){
      const p=document.querySelector('.time-pill.active')?.dataset.period||'today';
      loadMyData(currentAgentId,p);
    }
    if(btn.dataset.atab==='downline'&&currentAgentId)loadDownline();
  });

  // ============================================================
  // AUTH
  // ============================================================
  const modal=document.getElementById("authModal");
  document.getElementById("showAuthBtn").addEventListener("click",()=>{modal.classList.add('active');switchTab('login');});
  document.getElementById('modalCloseBtn').addEventListener("click",()=>modal.classList.remove('active'));
  modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove('active');});
  document.getElementById('agentLoginBtn').addEventListener("click",()=>{modal.classList.add('active');switchTab('login');});

  // REGISTER
  document.getElementById('registerBtn').addEventListener('click',async()=>{
    const phone=document.getElementById('regPhone').value.trim();
    const password=document.getElementById('regPassword').value.trim();
    const name=document.getElementById('regName').value.trim();
    const refCode=document.getElementById('referrer_code_input').value.trim();
    const checked=document.getElementById('ageCheck').checked;
    if(!phone||!password||!name)return alert("အချက်အလက်များ ပြည့်စုံစွာ ဖြည့်ပါ");
    if(!checked)return alert("အသက် 18+ သတ်မှတ်ချက်ကို ဝန်ခံပါ");
    try{
      const resp=await fetch("https://xjqrwcsxiaybpztzestb.supabase.co/functions/v1/register-user",{
        method:"POST",headers:{"Content-Type":"application/json","apikey":supabaseKey,"Authorization":"Bearer "+supabaseKey},
        body:JSON.stringify({phone,password,fullname:name,referrer_code:refCode||null})
      });
      const result=await resp.json();
      if(resp.ok){alert("မှတ်ပုံတင်ခြင်း အောင်မြင်သည်!\nReferral Code: "+result.ref_code);modal.classList.remove('active');onLoginSuccess({phone,name,ref_code:result.ref_code},result.ref_code,0,null);}
      else alert("အမှားအယွင်း: "+result.error);
    }catch(err){console.error(err);alert("Edge Function နဲ့ ချိတ်ဆက်လို့ မရပါ");}
  });

  // LOGIN
  document.getElementById('loginBtn').addEventListener('click',async()=>{
    const phone=document.getElementById('loginPhone').value.trim();
    const password=document.getElementById('loginPassword').value.trim();
    if(!phone||!password)return alert("Phone & Password ဖြည့်ပါ");
    const{data,error}=await supabase.auth.signInWithPassword({email:`${phone}@diamondbett.com`,password});
    if(error){alert("Login မအောင်မြင်ပါ: "+error.message);return;}
    const{data:ud}=await supabase.from('users').select('ref_code,fullname,phone,balance').eq('id',data.user.id).single();
    modal.classList.remove('active');
    currentUserId=data.user.id;currentAgentId=data.user.id;
    onLoginSuccess(ud||{phone},ud?.ref_code,ud?.balance,data.user.id);
  });

  function onLoginSuccess(user,refCode,balance=0,userId=null){
    if(userId)currentUserId=userId;
    document.getElementById('showAuthBtn').style.display='none';
    document.getElementById('walletBtns').style.display='flex';

    const phone=user.phone||user.name||'—';
    // Build referral link using ref_code from affiliate system
    const agentRefCode=refCode||user.ref_code||'—';
    const shareLink=agentRefCode!=='—'?`https://diamond-bett.vercel.app/?ref=${agentRefCode}`:'—';
    const today=new Date().toLocaleDateString('en-GB');

    setEl('agentUserPhone',phone);
    setEl('agentPhoneDisplay',phone);
    setEl('agentJoinDate',today);
    document.getElementById('agentShareLinkInput').value=shareLink;
    setEl('statBalance',fmt(balance));

    document.getElementById('agentLocked').style.display='none';
    document.getElementById('agentUnlocked').style.display='flex';

    // Spin access
    availableSpins=1;setEl('availableSpins',availableSpins);
    document.getElementById('spinBtn').disabled=false;

    // Fetch real stats for header cards — NEW
    if(currentUserId)loadDashboardStats(currentUserId);
  }

  // COPY/SHARE
  document.getElementById('agentCopyLinkBtn').addEventListener('click',copyAgentLink);
  document.getElementById('copyPhoneBtn').addEventListener('click',()=>{
    navigator.clipboard.writeText(document.getElementById('agentPhoneDisplay').textContent).then(()=>alert("ကူးယူပြီးပါပြီ!"));
  });
  document.getElementById('shareNativeBtn').addEventListener('click',async()=>{
    const link=document.getElementById('agentShareLinkInput').value;
    if(!link||link==='—')return;
    navigator.share?await navigator.share({title:'Diamond-BETT',url:link}):copyAgentLink();
  });

  function copyAgentLink(){
    const input=document.getElementById('agentShareLinkInput');
    if(!input.value||input.value==='—')return;
    navigator.clipboard.writeText(input.value).then(()=>alert("Link ကူးယူပြီးပါပြီ!")).catch(()=>{input.select();document.execCommand('copy');alert("Link ကူးယူပြီးပါပြီ!");});
  }

  // COUNTDOWN
  const countEl=document.getElementById('commissionCountdown');
  if(countEl){
    const tick=()=>{
      const now=new Date(),next=new Date();next.setHours(24,0,0,0);
      const d=next-now;
      const h=String(Math.floor(d/3600000)).padStart(2,'0');
      const m=String(Math.floor((d%3600000)/60000)).padStart(2,'0');
      const s=String(Math.floor((d%60000)/1000)).padStart(2,'0');
      countEl.textContent=`(နောက်ခြေချချိန်: ${h}:${m}:${s})`;
    };
    tick();setInterval(tick,1000);
  }

});// end DOMContentLoaded
