// ============================================================
// GLOBAL HELPERS
// ============================================================
function switchTab(tab) {
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
  if(!link||link==='—')return alert("Login ဝင်ပြီးမှ Share လုပ်ပါ");
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

// ============================================================
// DOM READY
// ============================================================
document.addEventListener("DOMContentLoaded",()=>{

  // SUPABASE
  const supabaseUrl="https://xjqrwcsxiaybpztzestb.supabase.co";
  const supabaseKey="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqcXJ3Y3N4aWF5YnB6dHplc3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzQxMDksImV4cCI6MjA5NDM1MDEwOX0.Kn5sLOTBdNtlooaH-q8ml0cOEswMlgMTSP7GFe7mbxg";
  const supabase=window.supabase.createClient(supabaseUrl,supabaseKey);

  let currentUserId=null,currentAgentId=null,availableSpins=0;

  // ?ref= auto-fill
  const urlParams=new URLSearchParams(window.location.search);
  const invitedBy=urlParams.get('ref');
  if(invitedBy){
    const ri=document.getElementById('referrer_code_input');
    if(ri){ri.value=invitedBy;ri.readOnly=true;}
    switchTab('register');
    document.getElementById('authModal').classList.add('active');
  }

  // ============================================================
  // NAVIGATION — absolute page panels, single active
  // ============================================================
  function showPage(nav){
    document.querySelectorAll('.page-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('topArea').style.display='';

    if(nav==='home'){
      document.getElementById('homePage').classList.add('active');
    } else if(nav==='tasks'){
      document.getElementById('topArea').style.display='none';
      document.getElementById('tasksPage').classList.add('active');
      if(currentUserId&&availableSpins>0)document.getElementById('spinBtn').disabled=false;
    } else if(nav==='agent'){
      document.getElementById('topArea').style.display='none';
      document.getElementById('agentPage').classList.add('active');
    } else if(nav==='cs'){
      document.getElementById('csPage').classList.add('active');
    } else if(nav==='account'){
      document.getElementById('accountPage').classList.add('active');
    }
  }

  // Initial page — home
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
    item.addEventListener("click",()=>{
      document.querySelectorAll(".cat-item").forEach(el=>el.classList.remove("active"));
      item.classList.add("active");
    });
  });

  document.getElementById("langBtn").addEventListener("click",()=>{
    const isEn=document.getElementById('langLabel').textContent==='မြန်မာ';
    setEl('langLabel',isEn?'EN':'မြန်မာ');
  });

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
  // AGENT LEVEL MODAL
  // ============================================================
  const agentLevels=[
    {lv:1,req:0},{lv:2,req:100},{lv:3,req:300},{lv:4,req:500},
    {lv:5,req:800},{lv:6,req:1000},{lv:7,req:10000},{lv:8,req:30000},
    {lv:9,req:50000},{lv:10,req:80000},{lv:11,req:100000},{lv:12,req:1000000},
    {lv:13,req:3000000},{lv:14,req:5000000},{lv:15,req:8000000},
    {lv:16,req:10000000},{lv:17,req:100000000},{lv:18,req:300000000},
    {lv:19,req:500000000},{lv:20,req:800000000},
  ];

  function getLevelColor(lv){
    if(lv<=2)return{a:'#CD7F32',b:'#8B4513'};
    if(lv<=4)return{a:'#A8A9AD',b:'#606060'};
    if(lv<=6)return{a:'#FFD700',b:'#B8860B'};
    if(lv<=8)return{a:'#4169E1',b:'#1E3A8A'};
    if(lv<=10)return{a:'#A855F7',b:'#6B21A8'};
    if(lv<=14)return{a:'#F97316',b:'#C2410C'};
    if(lv<=16)return{a:'#06B6D4',b:'#0E7490'};
    if(lv<=18)return{a:'#C084FC',b:'#7E22CE'};
    return{a:'#EF4444',b:'#991B1B'};
  }

  function buildLevelModal(){
    const body=document.getElementById('levelModalBody');
    const userLv=parseInt(document.getElementById('userLevelNum').textContent)||1;
    body.innerHTML=agentLevels.map(({lv,req})=>{
      const{a,b}=getLevelColor(lv);
      const isCurrent=lv===userLv;
      const svg=`<svg width="36" height="36" viewBox="0 0 36 36">
        <defs><linearGradient id="g${lv}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient></defs>
        <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="url(#g${lv})" opacity=".25" stroke="${a}" stroke-width="1.5"/>
        <polygon points="18,6 28,12 28,24 18,30 8,24 8,12" fill="url(#g${lv})" opacity=".6"/>
        <text x="18" y="22" text-anchor="middle" fill="white" font-size="${lv>=10?9:11}" font-weight="900" font-family="sans-serif">${lv}</text>
      </svg>`;
      return `<div class="level-row${isCurrent?' current-level':''}">
        <div class="level-badge-icon">${svg}</div>
        <div class="level-row-name" style="color:${isCurrent?'var(--accent)':'#fff'}">LV${lv}${isCurrent?' ✓':''}</div>
        <div class="level-row-req" style="color:${a}">${req===0?'0.00':req.toLocaleString()+'.00'}</div>
      </div>`;
    }).join('');
  }

  document.getElementById('levelBtn').addEventListener('click',()=>{
    buildLevelModal();
    document.getElementById('levelModal').classList.add('show');
  });
  document.getElementById('levelModalClose').addEventListener('click',()=>{
    document.getElementById('levelModal').classList.remove('show');
  });
  document.getElementById('levelModal').addEventListener('click',e=>{
    if(e.target===document.getElementById('levelModal'))
      document.getElementById('levelModal').classList.remove('show');
  });

  // ============================================================
  // DASHBOARD STATS
  // ============================================================
  async function loadDashboardStats(userId){
    const{data,error}=await supabase.from('agent_dashboard_stats')
      .select('today_commission,direct_members,received,bonus,yesterday_commission,salary')
      .eq('agent_id',userId).eq('period','today').single();
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

  // ============================================================
  // MY DATA
  // ============================================================
  async function loadMyData(agentId,period='today'){
    const loading=document.getElementById('mdLoading');
    if(loading)loading.style.display='flex';
    const{data,error}=await supabase.from('agent_dashboard_stats').select('*').eq('agent_id',agentId).eq('period',period).single();
    if(loading)loading.style.display='none';
    if(error||!data)return;
    const map={
      'md-total-commission':fmt(data.total_commission),
      'md-direct-bet':fmt(data.direct_bet_amount),
      'md-sub-bet':fmt(data.sub_bet_amount),
      'md-total-members':data.total_members??0,
      'md-direct-members':data.direct_members??0,
      'md-sub-members':data.sub_members??0,
      'md-direct-performance':fmt(data.direct_performance),
      'md-sub-performance':fmt(data.sub_performance),
      'md-total-performance':fmt(data.total_performance),
      'md-direct-savings':fmt(data.direct_savings),
      'md-direct-withdraw':fmt(data.direct_withdraw_savings),
      'md-direct-total-savings':fmt(data.direct_total_savings),
      'md-effective-bets':fmt(data.effective_bets),
      'md-level-savings':fmt(data.level_savings),
      'md-direct-commission':fmt(data.direct_commission),
      'md-sub-commission':fmt(data.sub_commission),
      'md-total-commission2':fmt(data.total_commission),
      'md-bonus':fmt(data.bonus),
      'md-received':fmt(data.received),
      'md-salary':fmt(data.salary),
      'md-promo-savings':fmt(data.promotion_savings),
      'md-achievement-savings':fmt(data.achievement_savings),
      'md-direct-income-commission':fmt(data.direct_commission),
      'md-sub-income-commission':fmt(data.sub_commission),
      'md-total-income-commission':fmt(data.total_commission),
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

  // ============================================================
  // DOWNLINE
  // ============================================================
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
    if(ap)setEl('dlDateLabel',ap.textContent);
    closeDl();loadDownline();
  });
  dlDateModal.querySelectorAll('.dl-period-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{dlDateModal.querySelectorAll('.dl-period-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');});
  });

  // Date selects populate
  (function(){
    const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1,d=now.getDate();
    ['dlStartYear','dlEndYear'].forEach(id=>{const s=document.getElementById(id);for(let yr=y-2;yr<=y;yr++){const o=document.createElement('option');o.value=yr;o.textContent=yr;if(yr===y)o.selected=true;s.appendChild(o);}});
    ['dlStartMonth','dlEndMonth'].forEach(id=>{const s=document.getElementById(id);for(let mo=1;mo<=12;mo++){const o=document.createElement('option');o.value=String(mo).padStart(2,'0');o.textContent=String(mo).padStart(2,'0');if(mo===m)o.selected=true;s.appendChild(o);}});
    ['dlStartDay','dlEndDay'].forEach(id=>{const s=document.getElementById(id);for(let dy=1;dy<=31;dy++){const o=document.createElement('option');o.value=String(dy).padStart(2,'0');o.textContent=String(dy).padStart(2,'0');if(dy===d)o.selected=true;s.appendChild(o);}});
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
      const t=opt.textContent;setEl('dlRoleLabel',t.length>8?t.substring(0,8)+'…':t);
      closeRole();loadDownline();
    });
  });
  document.addEventListener('click',()=>closeRole());

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
  // AGENT TAB SWITCHING
  // ============================================================
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
  // LUCKY WHEEL
  // ============================================================
  const wheelSlots=[
    {label:'5,000',amount:5000,color:'#6B1010'},{label:'15,000',amount:15000,color:'#3D0707'},
    {label:'30,000',amount:30000,color:'#6B1010'},{label:'50,000',amount:50000,color:'#3D0707'},
    {label:'65,000',amount:65000,color:'#6B1010'},{label:'80,000',amount:80000,color:'#3D0707'},
    {label:'ဗလာ',amount:0,color:'#151525'},{label:'ဗလာ',amount:0,color:'#0D0D18'},
  ];
  const turnoverMult={5000:5,15000:6,30000:7,50000:10,65000:12,80000:15};
  const canvas=document.getElementById('wheelCanvas');
  const ctx=canvas.getContext('2d');
  let wheelAngle=0,isSpinning=false,animId=null;

  function drawWheel(angle){
    const sz=260,cx=sz/2,cy=sz/2,r=118,sa=(Math.PI*2)/8;
    ctx.clearRect(0,0,sz,sz);
    ctx.beginPath();ctx.arc(cx,cy,r+4,0,Math.PI*2);ctx.strokeStyle='#C9A227';ctx.lineWidth=4;ctx.stroke();
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
    isSpinning=true;document.getElementById('spinBtn').disabled=true;
    const idx=(slotIndex-1)%8,sa=(Math.PI*2)/8;
    const targetBase=(3*Math.PI/2)-idx*sa-sa/2;
    const curMod=((wheelAngle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
    const tgtMod=((targetBase%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
    let diff=tgtMod-curMod;if(diff<0)diff+=Math.PI*2;
    const total=6*Math.PI*2+diff,end=wheelAngle+total,start=wheelAngle,t0=performance.now();
    const ease=t=>1-Math.pow(1-t,3);
    function animate(now){
      const t=Math.min((now-t0)/5000,1);
      wheelAngle=start+total*ease(t);drawWheel(wheelAngle);
      if(t<1){animId=requestAnimationFrame(animate);}
      else{animId=null;wheelAngle=end;isSpinning=false;onDone&&onDone();}
    }
    animId=requestAnimationFrame(animate);
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
      const overlay=document.getElementById('spinResultOverlay');
      const content=document.getElementById('spinResultContent');
      if(slot.amount===0){
        content.innerHTML=`<div class="spin-result-blank">ဗလာ — သင်ကံမကောင်းပါ</div><div class="spin-result-unit" style="margin-bottom:16px;">ထပ်ကြိုးစားပါ</div>`;
      } else {
        const to=slot.amount*turnoverMult[slot.amount];
        content.innerHTML=`<div class="spin-result-amount">${slot.amount.toLocaleString()}</div><div class="spin-result-unit">ကျပ် ရရှိသည်</div><div class="spin-result-turnover">Turnover: <strong style="color:var(--gold2);">${to.toLocaleString()} ကျပ်</strong><br>(${slot.amount.toLocaleString()} × ${turnoverMult[slot.amount]})</div>`;
      }
      overlay.classList.add('show');
      const list=document.getElementById('spinHistoryList');
      const now=new Date().toLocaleString('en-GB');
      const item=document.createElement('div');item.className='history-item';
      item.innerHTML=`<span class="history-date">${now}</span><span class="history-desc">Lucky Wheel</span><span class="history-amount">${slot.amount>0?'+'+slot.amount.toLocaleString()+' ကျပ်':'ဗလာ'}</span>`;
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
  // AUTH
  // ============================================================
  const modal=document.getElementById("authModal");
  document.getElementById("showAuthBtn").addEventListener("click",()=>{modal.classList.add('active');switchTab('login');});
  document.getElementById('modalCloseBtn').addEventListener("click",()=>modal.classList.remove('active'));
  modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove('active');});
  document.getElementById('agentLoginBtn').addEventListener("click",()=>{modal.classList.add('active');switchTab('login');});

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
    const agentRefCode=refCode||user.ref_code||'—';
    const shareLink=agentRefCode!=='—'?`https://diamond-bett.vercel.app/?ref=${agentRefCode}`:'—';
    const today=new Date().toLocaleDateString('en-GB');

    setEl('agentUserPhone',phone);
    setEl('agentPhoneDisplay',phone);
    setEl('agentJoinDate',today);
    document.getElementById('agentShareLinkInput').value=shareLink;
    setEl('statBalance',fmt(balance));
    // Update user level display (from DB or default 1)
    setEl('userLevelNum','1');

    document.getElementById('agentLocked').style.display='none';
    document.getElementById('agentUnlocked').style.display='flex';

    availableSpins=1;setEl('availableSpins',availableSpins);
    document.getElementById('spinBtn').disabled=false;

    if(currentUserId)loadDashboardStats(currentUserId);
  }

  // Copy / Share
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

  // Commission countdown
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

  // Dashboard stats
  async function loadDashboardStats(userId){
    const{data,error}=await supabase.from('agent_dashboard_stats')
      .select('today_commission,direct_members,received,bonus,yesterday_commission,salary')
      .eq('agent_id',userId).eq('period','today').single();
    if(error||!data)return;
    setEl('statCommission',fmt(data.today_commission));
    setEl('statInvited',data.direct_members??0);
    setEl('walletReceived',fmt(data.received));
    setEl('walletBonus',fmt(data.bonus));
    setEl('walletYesterday',fmt(data.yesterday_commission));
    setEl('walletSalary',fmt(data.salary));
  }

});// end DOMContentLoaded
