import { useEffect, useState, useMemo } from "react";
import { supabase } from "./supabaseClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function SummaryCard({ title, value }) {
  return (
    <div className="bg-white/5 p-4 rounded-lg shadow-sm border border-gray-700">
      <p className="text-sm text-gray-300">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }) {
  return (
    <div className="flex items-center justify-center gap-4 mt-4">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="px-3 py-1 bg-gray-700 text-gray-200 rounded disabled:opacity-40"
      >
        ก่อนหน้า
      </button>
      <span className="text-gray-300 text-sm">
        หน้า {currentPage} จาก {totalPages || 1}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="px-3 py-1 bg-gray-700 text-gray-200 rounded disabled:opacity-40"
      >
        ถัดไป
      </button>
    </div>
  );
}

export default function Dashboard({ user }) {
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [fileTotal, setFileTotal] = useState(0);
  const [logTotal, setLogTotal] = useState(0);

  // pagination
  const [filePage, setFilePage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const pageSize = 6;

  const totalFilePages = Math.ceil(fileTotal / pageSize);
  const totalLogPages = Math.ceil(logTotal / pageSize);

  // โหลดข้อมูล
  useEffect(() => {
    loadFiles(filePage);
    loadLogs(logPage);
  }, [filePage, logPage]);

  async function loadFiles(page = 1) {
    setLoadingFiles(true);
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    const { count } = await supabase
      .from("files")
      .select("*", { count: "exact", head: true });
    setFileTotal(count || 0);

    const { data, error } = await supabase
      .from("files")
      .select("*")
      .order("created_at", { ascending: false })
      .range(start, end);

    if (error) console.error(error);
    else setFiles(data || []);
    setLoadingFiles(false);
  }

  async function loadLogs(page = 1) {
    setLoadingLogs(true);
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    const { count } = await supabase
      .from("file_logs")
      .select("*", { count: "exact", head: true });
    setLogTotal(count || 0);

    const { data, error } = await supabase
      .from("file_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(start, end);

    if (error) console.error(error);
    else setLogs(data || []);
    setLoadingLogs(false);
  }

  // ✅ ฟังก์ชันแปลงข้อมูลเป็น CSV แล้วดาวน์โหลด
  function exportToCSV(data, filename) {
    if (!data || data.length === 0) {
      alert("ไม่มีข้อมูลให้ดาวน์โหลด");
      return;
    }

    const header = Object.keys(data[0]).join(",");
    const rows = data.map((row) =>
      Object.values(row)
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Chart
// ✅ กราฟสรุปอัปโหลด 7 วันล่าสุด (แยกตามวันและผู้ใช้)
const chartData = useMemo(() => {
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 6); // รวมวันปัจจุบันด้วย

  // สร้างโครงข้อมูล: { 'จันทร์': { userA: 1, userB: 2, ... } }
  const days = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const dayData = {};
  days.forEach((day) => (dayData[day] = {}));

  logs.forEach((l) => {
    if (l.action !== "upload") return;
    const date = new Date(l.created_at);
    if (date < sevenDaysAgo) return;

    const dayName = days[date.getDay()];
    if (!dayData[dayName][l.user_email]) {
      dayData[dayName][l.user_email] = 0;
    }
    dayData[dayName][l.user_email] += 1;
  });

  // รวม user ทั้งหมดที่พบในช่วงนี้
  const allUsers = Array.from(
    new Set(logs.filter(l => l.action === "upload").map(l => l.user_email))
  );

  // แปลงเป็น array สำหรับ BarChart
  const formatted = days.map((day) => {
    const entry = { วัน: day };
    allUsers.forEach((u) => {
      entry[u] = dayData[day][u] || 0;
    });
    return entry;
  });

  return { formatted, allUsers };
}, [logs]);


  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm">ภาพรวมไฟล์และกิจกรรมของทีม</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard title="ไฟล์ทั้งหมด" value={fileTotal} />
        <SummaryCard title="กิจกรรมทั้งหมด" value={logTotal} />
        <SummaryCard
          title="อัปโหลดล่าสุด"
          value={`${logs.filter((l) => l.action === "upload").length} รายการล่าสุด`}
        />
      </div>

      {/* Chart */}
      <div className="bg-white/5 p-4 rounded-lg border border-gray-700">
        <h3 className="text-gray-200 text-lg font-medium mb-4">
          สรุปจำนวนการอัปโหลดตามผู้ใช้
        </h3>
        <div className="h-64">
          {chartData.length === 0 ? (
            <p className="text-gray-400 text-sm">ยังไม่มีข้อมูลสรุป</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
  <BarChart data={chartData.formatted}>
    <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
    <XAxis dataKey="วัน" tick={{ fill: "#cbd5e1" }} />
    <YAxis tick={{ fill: "#cbd5e1" }} />
    <Tooltip />
    {chartData.allUsers.map((user, i) => (
      <Bar
        key={user}
        dataKey={user}
        name={user.split("@")[0]}  // ✅ เพิ่มบรรทัดนี้เพื่อให้แสดงเฉพาะชื่อ
        stackId="a"
        fill={`hsl(${(i * 60) % 360}, 70%, 60%)`}
      />
    ))}
  </BarChart>
</ResponsiveContainer>

          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Files Table */}
        <div className="bg-white/5 p-4 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-white">📁 ไฟล์ทั้งหมด</h3>
            <button
              onClick={() => exportToCSV(files, "รายงานไฟล์ทั้งหมด")}
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              Export CSV
            </button>
          </div>
          {loadingFiles ? (
            <p className="text-gray-400">กำลังโหลด...</p>
          ) : (
            <>
              <div className="overflow-y-auto max-h-[300px]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-sm text-gray-300 border-b border-gray-700">
                      <th className="px-3 py-2">ชื่อไฟล์</th>
                      <th className="px-3 py-2">เวอร์ชัน</th>
                      <th className="px-3 py-2">ผู้ใช้งาน</th>
                      <th className="px-3 py-2">วันที่</th>
                      <th className="px-3 py-2">ลิงก์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f) => (
                      <tr
                        key={f.id}
                        className="border-b border-gray-800 hover:bg-gray-800/50"
                      >
                        <td className="px-3 py-2 text-gray-100">{f.filename}</td>
                        <td className="px-3 py-2 text-gray-300">v{f.version}</td>
                        <td className="px-3 py-2 text-gray-300">
                          {f.uploaded_by}
                        </td>
                        <td className="px-3 py-2 text-gray-300">
                          {new Date(f.created_at).toLocaleString("th-TH")}
                        </td>
                        <td className="px-3 py-2">
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            เปิด
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={filePage}
                totalPages={totalFilePages}
                onPageChange={setFilePage}
              />
            </>
          )}
        </div>

        {/* Logs Table */}
        <div className="bg-white/5 p-4 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-white">🧾 Activity Logs</h3>
            <button
              onClick={() => exportToCSV(logs, "รายงานกิจกรรมไฟล์")}
              className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded"
            >
              Export CSV
            </button>
          </div>
          {loadingLogs ? (
            <p className="text-gray-400">กำลังโหลด...</p>
          ) : (
            <>
              <div className="overflow-y-auto max-h-[300px]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-sm text-gray-300 border-b border-gray-700">
                      <th className="px-3 py-2">เวลา</th>
                      <th className="px-3 py-2">Action</th>
                      <th className="px-3 py-2">ไฟล์</th>
                      <th className="px-3 py-2">ผู้ทำ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr
                        key={l.id}
                        className="border-b border-gray-800 hover:bg-gray-800/50"
                      >
                        <td className="px-3 py-2 text-gray-300">
                          {new Date(l.created_at).toLocaleString("th-TH")}
                        </td>
                        <td className="px-3 py-2 text-gray-200">{l.action}</td>
                        <td className="px-3 py-2 text-gray-100">
                          {l.filename}
                        </td>
                        <td className="px-3 py-2 text-gray-300">
                          {l.user_email}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={logPage}
                totalPages={totalLogPages}
                onPageChange={setLogPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
