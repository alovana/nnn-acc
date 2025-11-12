import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function FileManager({ user }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [role, setRole] = useState("");
  const bucketName = "uploads"; // ⚠️ ชื่อ bucket ต้องตรงกับใน Supabase

  // โหลดไฟล์และดึง role ของผู้ใช้
  useEffect(() => {
    loadFiles();
    fetchUserRole();
  }, []);

  // ✅ ดึง role จากตาราง profiles
  async function fetchUserRole() {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("email", user.email)
      .single();

    if (!error && data) {
      setRole(data.role);
    } else {
      console.warn("ไม่พบ role ของผู้ใช้:", error);
    }
  }

  // ✅ โหลดไฟล์ทั้งหมด
  async function loadFiles() {
    const { data, error } = await supabase
      .from("files")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    else setFiles(data);
  }

  // ✅ อัปโหลดไฟล์
  async function handleUpload(e) {
    try {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(true);
      setProgress(10);

      const originalName = file.name;
      const timestamp = Date.now();

      // ✅ แปลงชื่อไฟล์ให้ปลอดภัย
      const safeName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");

      const extension = safeName.split(".").pop();
      const baseName = safeName.replace(`.${extension}`, "");

      // ✅ ตรวจสอบ version ล่าสุด
      const { data: existing } = await supabase
        .from("files")
        .select("version")
        .eq("filename", originalName)
        .eq("uploaded_by", user.email)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const newVersion = existing ? Number(existing.version) + 1 : 1;

      // ✅ ตั้งชื่อไฟล์ใน storage (ปลอดภัยแน่นอน)
      const filePath = `${user.email}/${baseName}_v${newVersion}_${timestamp}.${extension}`;

      setProgress(40);
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setProgress(70);

      // ✅ ดึง URL สำหรับเปิดไฟล์
      const { data: publicUrl } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      // ✅ เพิ่มข้อมูลในตาราง files
      const { error: dbError } = await supabase.from("files").insert([
        {
          filename: originalName,
          url: publicUrl.publicUrl,
          uploaded_by: user.email,
          version: newVersion,
        },
      ]);

      if (dbError) throw dbError;

      // ✅ เพิ่ม log การอัปโหลด
      await supabase.from("file_logs").insert([
        {
          action: "upload",
          filename: originalName,
          user_email: user.email,
        },
      ]);

      setProgress(100);
      setTimeout(() => setProgress(0), 800);
      alert(`✅ อัปโหลดไฟล์สำเร็จ (เวอร์ชัน ${newVersion})`);
      loadFiles();
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err.message);
      console.error(err);
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }

  // 🗑️ ลบไฟล์ (ตรวจสอบสิทธิ์)
  async function handleDelete(file) {
    const canDelete =
      role === "admin" ||
      role === "manager" ||
      file.uploaded_by === user.email;

    if (!canDelete) {
      alert("❌ คุณไม่มีสิทธิ์ลบไฟล์นี้");
      return;
    }

    const confirmDelete = confirm(`ต้องการลบไฟล์ "${file.filename}" ใช่ไหม?`);
    if (!confirmDelete) return;

    try {
      // ✅ ลบจาก storage
      const storageFile = file.url.split("/").pop();
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([`${file.uploaded_by}/${storageFile}`]);

      if (storageError) throw storageError;

      // ✅ ลบจากตาราง files
      const { error: dbError } = await supabase
        .from("files")
        .delete()
        .eq("id", file.id);

      if (dbError) throw dbError;

      // ✅ บันทึก Log การลบ
      await supabase.from("file_logs").insert([
        {
          action: "delete",
          filename: file.filename,
          user_email: user.email,
        },
      ]);

      alert(`🗑️ ลบไฟล์ "${file.filename}" สำเร็จ`);
      loadFiles();
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err.message);
      console.error(err);
    }
  }

  // ✅ ส่วน UI
  return (
    <div className="bg-white/5 p-6 rounded-xl shadow-lg border border-gray-700 max-w-5xl mx-auto mt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
          📂 ไฟล์ของฉัน
        </h2>
        <button
          onClick={() => document.getElementById("fileInput").click()}
          disabled={uploading}
          className={`px-5 py-2 rounded-lg font-medium transition ${
            uploading
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {uploading ? "⏳ กำลังอัปโหลด..." : "📤 อัปโหลดไฟล์"}
        </button>
        <input
          id="fileInput"
          type="file"
          className="hidden"
          onChange={handleUpload}
          accept="*/*"
        />
      </div>

      {progress > 0 && (
        <div className="w-full bg-gray-800 h-2 rounded-full mb-4">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      {files.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-6">
          ยังไม่มีไฟล์ในระบบ
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/30">
                <th className="px-4 py-3 font-medium text-gray-300">ชื่อไฟล์</th>
                <th className="px-4 py-3 font-medium text-gray-300">เวอร์ชัน</th>
                <th className="px-4 py-3 font-medium text-gray-300">ผู้ใช้งาน</th>
                <th className="px-4 py-3 font-medium text-gray-300">วันที่อัปโหลด</th>
                <th className="px-4 py-3 font-medium text-gray-300">ลิงก์</th>
                <th className="px-4 py-3 font-medium text-gray-300">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition"
                >
                  <td className="px-4 py-2 text-gray-200">{f.filename}</td>
                  <td className="px-4 py-2 text-gray-400">v{f.version}</td>
                  <td className="px-4 py-2 text-gray-400">{f.uploaded_by}</td>
                  <td className="px-4 py-2 text-gray-400">
                    {new Date(f.created_at).toLocaleString("th-TH")}
                  </td>
                  <td className="px-4 py-2">
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      เปิด
                    </a>
                  </td>
                  <td className="px-4 py-2">
                    {(role === "admin" || role === "manager" || f.uploaded_by === user.email) && (
                      <button
                        onClick={() => handleDelete(f)}
                        className="text-red-500 hover:text-red-400 transition"
                      >
                        🗑️ ลบ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
