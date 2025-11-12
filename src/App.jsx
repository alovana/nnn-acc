import "./index.css";
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import FileManager from "./FileManager";
import Dashboard from "./Dashboard";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("employee");
  const [view, setView] = useState("files");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // ✅ โหลด session ปัจจุบัน (ถ้ามี)
  useEffect(() => {
    async function getSession() {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        console.log("✅ Session restored:", data.session.user.email);
        setUser(data.session.user);
      }
      setLoading(false);
    }

    getSession();

    // ✅ ฟัง event การเปลี่ยน session เช่น login / logout
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔄 Auth state changed:", event);
        setUser(session?.user ?? null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  // ✅ ดึง Role จากตาราง profiles
  useEffect(() => {
    async function loadUserRole() {
      if (user?.email) {
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("email", user.email)
          .single();
        if (data) setRole(data.role || "employee");
      }
    }
    loadUserRole();
  }, [user]);

  // ✅ เข้าสู่ระบบ
  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("❌ Login error:", error.message);
      setError("❌ " + error.message);
      setUser(null);
    } else {
      console.log("✅ Logged in user:", data.user);
      const { data: session } = await supabase.auth.getSession();
      console.log("🔑 Active session:", session);
      setUser(data.user);
    }
  }

  // ✅ ออกจากระบบ
  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setEmail("");
    setPassword("");
    setRole("employee");
    console.log("🚪 Logged out");
  }

  // ✅ โหลดเสร็จหรือยัง
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center">
        <p>กำลังโหลดระบบ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-100">
      {!user ? (
        // -------------------------------
        // 🔒 หน้า Login
        // -------------------------------
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-lg w-full max-w-md text-center border border-gray-700">
          <h1 className="text-3xl font-semibold mb-6 text-gray-100 flex items-center justify-center gap-2">
            <span role="img" aria-label="lock">
              🔒
            </span>{" "}
            เข้าสู่ระบบ
          </h1>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="email"
              className="p-3 border border-gray-700 bg-gray-800 text-gray-100 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="อีเมลพนักงาน"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              className="p-3 border border-gray-700 bg-gray-800 text-gray-100 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 transition w-full"
            >
              เข้าสู่ระบบ
            </button>
          </form>

          <div className="mt-4 text-center leading-tight">
  <p className="text-sm font-medium text-gray-200">
    บริษัท นั่งนับเงินการบัญชี จำกัด
  </p>
  <p className="text-xs text-gray-400">
    File Management Web App
  </p>
</div>
        </div>
      ) : (
        // -------------------------------
        // 🧭 หน้าหลัง Login (FileManager + Dashboard)
        // -------------------------------
        <div className="w-full max-w-6xl mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-green-400">
                ✅ เข้าสู่ระบบสำเร็จ
              </h1>
              <p className="text-gray-300 text-sm">
                บทบาท:{" "}
                {role === "admin"
                  ? "ผู้จัดการ"
                  : role === "manager"
                  ? "หัวหน้า"
                  : "พนักงาน"}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-gray-300">{user.email}</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white rounded-lg py-2 px-4 font-medium hover:bg-red-700 transition"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>

          {/* 🔘 เมนูเลือกหน้า */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setView("files")}
              className={`px-4 py-2 rounded-lg ${
                view === "files"
                  ? "bg-blue-600"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              จัดการไฟล์ของฉัน
            </button>

            {(role === "manager" || role === "admin") && (
              <button
                onClick={() => setView("dashboard")}
                className={`px-4 py-2 rounded-lg ${
                  view === "dashboard"
                    ? "bg-blue-600"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                แดชบอร์ดไฟล์ทั้งหมด
              </button>
            )}
          </div>

          {/* 🔄 สลับหน้า */}
          {view === "files" ? (
            <FileManager user={user} />
          ) : (
            <Dashboard user={user} />
          )}
        </div>
      )}
    </div>
  );
}
