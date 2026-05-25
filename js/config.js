const SUPA_URL = "https://xjqrwcsxiaybpztzestb.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqcXJ3Y3N4aWF5YnB6dHplc3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzQxMDksImV4cCI6MjA5NDM1MDEwOX0.Kn5sLOTBdNtlooaH-q8ml0cOEswMlgMTSP7GFe7mbxg";

// B2B Game API (update this URL after deployment)
const GAME_API_BASE = "https://1fff3b0f-8370-4287-a9e5-87cf8ae02f5a-00-1zuhl4rxv30uv.pike.replit.dev";

// Global state
window.DB            = null;
window.currentUserId = null;
window.currentAgentId= null;
window.availableSpins= 0;
window._depMethods   = [];
window._dMethod      = null;
window._dAmt         = 0;
window._dBonus       = true;
window._cdTimer      = null;
window._linked       = null;
window._curProv      = null;