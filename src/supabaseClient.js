import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,      // ✅ เก็บ session ไว้หลัง login
    autoRefreshToken: true,    // ✅ ต่ออายุ token อัตโนมัติ
    detectSessionInUrl: true,  // ✅ ใช้ได้ใน browser ทุกกรณี
  },
});
