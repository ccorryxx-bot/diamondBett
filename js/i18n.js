// ============================================================
// DiamondBett — i18n Language System
// Supports: mm (Myanmar) | en (English)
// Usage: applyLang('en') or applyLang('mm')
// HTML: add data-i18n="key" to any text element
//       add data-i18n-placeholder="key" to any input
// ============================================================

window.TRANSLATIONS = {
  mm: {
    // ── Index / Top Nav ──────────────────────────────────────
    download:        'ဒေါင်း',
    lang_label:      'မြန်မာ',
    login_btn:       'လော့ဂ်အင်!',
    deposit:         'ငွေသွင်း',
    withdraw:        'ငွေထုတ်',
    announce:        'ကြိုဆိုပါတယ်! Diamond-BETT မှာ မှတ်ပုံတင်ပြီး ဆုငွေများ ရယူပါ။',

    // ── Home — Category Sidebar ──────────────────────────────
    cat_all:         'အားလုံး',
    cat_show:        'ဂိမ်း Show',
    cat_live:        'တိုက်ရိုက်',
    cat_fish:        'ငါးဖမ်း',
    cat_sport:       'အားကစား',

    // ── Home — Footer Links ──────────────────────────────────
    footer_about:    'ကျွန်ုပ်တို့အကြောင်း',
    footer_privacy:  'ကိုယ်ရေးလုံခြုံမှု',
    footer_contact:  'ဆက်သွယ်ရန်',

    // ── Tasks Page ───────────────────────────────────────────
    bonus_label:     'Bonus Code ထည့်ပါ',
    bonus_btn:       'လက်ခံ',
    turnover_title:  'TURNOVER သတ်မှတ်ချက်',
    section_tasks:   'အလုပ်များ',
    section_history: 'မှတ်တမ်း',
    history_empty:   'မှတ်တမ်း မရှိသေးပါ',

    task1_title:     'နေ့တိုင်း ဂိမ်းထဲ ဝင်ရောက်ပါ',
    task1_desc:      '1 ကြိမ် ဝင်ရောက်ရင် spin 1 ကြိမ် ရမည်',
    task2_title:     'Referral ကနေ ငွေသွင်းကစားတဲ့သူ ရှိရင်',
    task2_desc:      'မိတ်ဆက်ပေးသူ Player တစ်ဦးချင်း spin 3 ကြိမ် ရမည်',
    task2_btn:       'ဖိတ်ကြားရန်',
    task3_title:     'ကိုယ်တိုင် ငွေသွင်းကစားပါ',
    task3_desc:      'ကိုယ်တိုင် ငွေသွင်းပြီး ကစားတိုင်း spin 2 ကြိမ် ရမည်',
    task3_btn:       'ငွေသွင်းရန်',
    task4_title:     '15 ရက်ဆက်တိုက် ဝင်ကစားပါ',
    task4_desc:      '15 ရက်ဆက်တိုက် ဝင်ကစားရင် spin 5 ကြိမ် ရမည်',

    // ── Account — Guest ──────────────────────────────────────
    acct_guest_title: 'Account ကြည့်ရန် အကောင့်ဝင်ရန်လိုအပ်သည်',
    acct_guest_btn:  'အကောင့်ဝင်ရန်',

    // ── Account — Action Buttons ─────────────────────────────
    acct_withdraw:   'ငွေထုတ်ရန်',
    acct_deposit:    'ငွေသွင်းရန်',

    // ── Account — VIP Section ────────────────────────────────
    vip_promo:       'ပရိုမိုးရှင်းကြေးငွေ',
    vip_dep_label:   'ငွေသွင်း',
    vip_dep_need_pre:'နောက် Level → ငွေသွင်းရန်',
    vip_dep_need_suf:'လိုသည်',
    vip_tov_label:   'အလောင်းအစား',
    vip_needed:      'လိုအပ်သည်:',

    // ── Account — Menu Items ─────────────────────────────────
    menu_history:    'ငါ့မှတ်တမ်း',
    menu_history_sub:'ငွေသွင်း/ထုတ် မှတ်တမ်းများ · Real-Time',
    menu_withdraw:   'ငွေထုတ်စီမံခန့်ခွဲမှု',
    menu_agent:      'အေးဂျင့်!',
    menu_agent_val:  'တစ်လဝင်ငွေ 2သန်း',
    menu_profile:    'ကိုယ်ရေးအချက်အလက်များ',
    menu_security:   'လုံခြုံရေးစင်တာ',
    menu_language:   'ဘာသာစကား',
    menu_cs:         'ဖောက်သည် ဝန်ဆောင်မှု့',
    menu_feedback:   'အကြံပြုချက်များ',
    menu_logout:     'အကောင့်ထွက်ရန်',

    // ── Modals ───────────────────────────────────────────────
    tab_register:    'မှတ်ပုံတင်━━➤',
    tab_login:       'လော့ဂ်အင်➜',
    auth_reg_title:  'အကောင် မှတ်ပုံတင်ပါ',
    auth_log_title:  'ကြိုဆိုပါသည် — ပြန်ဝင်ပါ',
    reg_btn:         'မှတ်ပုံတင်မည်',
    login_submit:    'ဝင်ရောက်မည်',
    cs_contact_link: 'CS ဆက်သွယ်ရန်',
    close_btn:       'ပိတ်မည်',
    result_label:    'ရလဒ်',

    // ── Date Modal ───────────────────────────────────────────
    date_select_title:  'ရက်စွဲ ရွေးချယ်ပါ',
    period_today:       'ဒီနေ့',
    period_yesterday:   'မနေက',
    period_this_week:   'ယခုအပတ်',
    period_last_week:   'ပြီးခဲ့သောအပတ်',
    period_this_month:  'ဒီလ',
    period_last_month:  'ပြီးခဲ့သည့်လ',
    period_all:         'အားလုံး',
    date_custom_title:  'စိတ်ကြိုက် ရက်ပိုင်းရွေး',
    date_start:         'စတင်ရက်',
    date_end:           'ပြီးဆုံးရက်',
    date_cancel:        'မလုပ်တော့',
    date_confirm:       'အတည်ပြု',

    // ── Level Modal ──────────────────────────────────────────
    level_title:     'အောက်အဆင့်!',
    level_sub:       'ကော်မရှင်ပမာဏ အလိုက် အဆင့်တိုးမည်',
    level_th_level:  'အဆင့်',
    level_th_name:   'နာမည်',

    // ── Profile Popup ────────────────────────────────────────
    pp_title:        'ကိုယ်ရေးအချက်အလက်များ',
    pp_name_lbl:     'နာမည်',
    pp_copy:         'ကူး',
    pp_see:          'ကြည့်',
    pp_hide:         'ဖျောက်',

    // ── Placeholder texts ─────────────────────────────────────
    ph_bonus:        'DIAMOND-XXXX',
    ph_reg_name:     '* နာမည် (English Only, No Space)',
    ph_reg_pass:     '* စကားဝှက် (No Myanmar)',
    ph_reg_phone:    '*ကျေးဇူးပြု၍ဖုန်းနံပါတ်ထည့်ပါ!',
    ph_log_phone:    '* ဖုန်းနံပါတ်',
    ph_log_pass:     '* စကားဝှက်',

    // ── Age Check ────────────────────────────────────────────
    age_check:       'ကျွန်ုပ်သည် အသက် 18 နှစ်ကျော်သည်!',
    age_terms:       'Terms ကို ဖတ်ပြီး သဘောတူသည်။',
  },

  en: {
    // ── Index / Top Nav ──────────────────────────────────────
    download:        'Download',
    lang_label:      'EN',
    login_btn:       'Login!',
    deposit:         'Deposit',
    withdraw:        'Withdraw',
    announce:        'Welcome! Register at Diamond-BETT and claim your rewards.',

    // ── Home — Category Sidebar ──────────────────────────────
    cat_all:         'All',
    cat_show:        'Shows',
    cat_live:        'Live',
    cat_fish:        'Fishing',
    cat_sport:       'Sports',

    // ── Home — Footer Links ──────────────────────────────────
    footer_about:    'About Us',
    footer_privacy:  'Privacy Policy',
    footer_contact:  'Contact Us',

    // ── Tasks Page ───────────────────────────────────────────
    bonus_label:     'Enter Bonus Code',
    bonus_btn:       'Claim',
    turnover_title:  'TURNOVER REQUIREMENT',
    section_tasks:   'Tasks',
    section_history: 'History',
    history_empty:   'No history yet',

    task1_title:     'Login Every Day',
    task1_desc:      'Login once to earn 1 free spin',
    task2_title:     'Refer a Player Who Deposits',
    task2_desc:      'Earn 3 spins for each referred player who deposits',
    task2_btn:       'Invite',
    task3_title:     'Deposit & Play',
    task3_desc:      'Earn 2 spins each time you deposit and play',
    task3_btn:       'Deposit',
    task4_title:     'Login 15 Days in a Row',
    task4_desc:      'Login 15 consecutive days to earn 5 spins',

    // ── Account — Guest ──────────────────────────────────────
    acct_guest_title: 'Please login to view your account',
    acct_guest_btn:  'Login',

    // ── Account — Action Buttons ─────────────────────────────
    acct_withdraw:   'Withdraw',
    acct_deposit:    'Deposit',

    // ── Account — VIP Section ────────────────────────────────
    vip_promo:       'Promo Bonus',
    vip_dep_label:   'Deposit',
    vip_dep_need_pre:'Next Level → Need to Deposit',
    vip_dep_need_suf:'more',
    vip_tov_label:   'Turnover',
    vip_needed:      'Needed:',

    // ── Account — Menu Items ─────────────────────────────────
    menu_history:    'My History',
    menu_history_sub:'Deposit/Withdraw Records · Real-Time',
    menu_withdraw:   'Withdrawal Management',
    menu_agent:      'Agent!',
    menu_agent_val:  'Monthly Income 2M',
    menu_profile:    'My Profile',
    menu_security:   'Security Center',
    menu_language:   'Language',
    menu_cs:         'Customer Service',
    menu_feedback:   'Suggestions',
    menu_logout:     'Logout',

    // ── Modals ───────────────────────────────────────────────
    tab_register:    'Register━━➤',
    tab_login:       'Login➜',
    auth_reg_title:  'Create Account',
    auth_log_title:  'Welcome Back — Login',
    reg_btn:         'Register',
    login_submit:    'Login',
    cs_contact_link: 'Contact CS',
    close_btn:       'Close',
    result_label:    'Result',

    // ── Date Modal ───────────────────────────────────────────
    date_select_title:  'Select Date',
    period_today:       'Today',
    period_yesterday:   'Yesterday',
    period_this_week:   'This Week',
    period_last_week:   'Last Week',
    period_this_month:  'This Month',
    period_last_month:  'Last Month',
    period_all:         'All',
    date_custom_title:  'Custom Date Range',
    date_start:         'Start Date',
    date_end:           'End Date',
    date_cancel:        'Cancel',
    date_confirm:       'Confirm',

    // ── Level Modal ──────────────────────────────────────────
    level_title:     'Level Up!',
    level_sub:       'Levels increase based on commission amount',
    level_th_level:  'Level',
    level_th_name:   'Name',

    // ── Profile Popup ────────────────────────────────────────
    pp_title:        'My Profile',
    pp_name_lbl:     'Name',
    pp_copy:         'Copy',
    pp_see:          'Show',
    pp_hide:         'Hide',

    // ── Placeholder texts ─────────────────────────────────────
    ph_bonus:        'DIAMOND-XXXX',
    ph_reg_name:     '* Username (English Only, No Space)',
    ph_reg_pass:     '* Password (No Myanmar Characters)',
    ph_reg_phone:    '* Please enter your phone number',
    ph_log_phone:    '* Phone Number',
    ph_log_pass:     '* Password',

    // ── Age Check ────────────────────────────────────────────
    age_check:       'I am over 18 years old.',
    age_terms:       'I have read and agree to the Terms.',
  }
};

// ============================================================
// applyLang — main function called on toggle / page load
// ============================================================
window.applyLang = function(lang) {
  const t = window.TRANSLATIONS[lang] || window.TRANSLATIONS.mm;

  // 1. All data-i18n text elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });

  // 2. All data-i18n-placeholder inputs
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key] !== undefined) el.placeholder = t[key];
  });

  // 3. lang toggle button label (special: shows 'မြန်မာ' or 'EN')
  const langLbl = document.getElementById('langLabel');
  if (langLbl) langLbl.textContent = lang === 'en' ? 'EN' : 'မြန်မာ';

  // 4. account page language label
  const acctLangLbl = document.getElementById('acctLangLabel');
  if (acctLangLbl) acctLangLbl.textContent = lang === 'en' ? 'English' : 'မြန်မာဘာသာ';

  // 5. Store
  localStorage.setItem('_db_lang', lang);
};

// ── Auto-apply on load (after DOM is ready) ──────────────────
(function initI18n() {
  function run() {
    const lang = localStorage.getItem('_db_lang') || 'mm';
    window.applyLang(lang);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  // Also re-apply when SPA partials finish loading
  document.addEventListener('partials-loaded', run);
})();
