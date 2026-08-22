// --- TAB-ISOLATED SUPABASE CLIENT CONFIGURATION ---
// Ensures that if Supabase Auth or Realtime client is used, auth state is strictly
// scoped to window.sessionStorage per browser tab, preventing cross-tab session leakage.

export const tabSessionStorage = {
  getItem: (key) => {
    try {
      return window.sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (e) {}
  },
  removeItem: (key) => {
    try {
      window.sessionStorage.removeItem(key);
    } catch (e) {}
  }
};

// Export helper configuration for Supabase createClient options
export const tabIsolatedSupabaseConfig = {
  auth: {
    storage: tabSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce'
  }
};
