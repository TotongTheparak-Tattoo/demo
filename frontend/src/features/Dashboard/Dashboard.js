// Dashboard.js
import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Divider,
  Toolbar,
} from "@mui/material";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";

const apiBase = process.env.REACT_APP_API_URL;

// ---------- helpers ----------
const fmtInt = (n) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Number(n || 0)
  );

// parse safe: "YYYY-MM-DD" (หรือ string ที่ยาวกว่า) -> Date (local time)
function parseDateOnly(s) {
  if (!s) return new Date(NaN);
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// ts -> "YYYY-MM-DD"
function fmtDate(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// รวมค่าตามวันที่จากรายการ [{date, value}]
function sumByDateSimple(list) {
  const m = new Map();
  for (const r of list || []) {
    const k = r.date;
    const v = Number(r.value || 0);
    m.set(k, (m.get(k) || 0) + v);
  }
  // คืน [{date, value}]
  return Array.from(m, ([date, value]) => ({ date, value }));
}

// กระจาย actualOutput ตามช่วง startDate..endDate แบบเฉลี่ยเท่า ๆ กันต่อวัน
function expandActualToDaily(actualRows) {
  const expanded = [];
  for (const r of actualRows || []) {
    const s = parseDateOnly(r.startDate);
    const e = parseDateOnly(r.endDate);
    if (Number.isNaN(+s) || Number.isNaN(+e)) continue;

    // รวมวันแบบ inclusive
    const days =
      Math.max(1, Math.round((e - s) / (24 * 3600 * 1000)) + 1) || 1;
    const perDay = Number(r.actualOutput || 0) / days;

    const d = new Date(s);
    for (;;) {
      const iso = fmtDate(d.getTime());
      expanded.push({ date: iso, value: perDay });
      if (d.getTime() >= e.getTime()) break;
      d.setDate(d.getDate() + 1);
    }
  }
  return sumByDateSimple(expanded); // รวมซ้ำในวันเดียวกัน
}

// ---------- component ----------
export default function Dashboard() {
  const [chartData, setChartData] = useState([]); // [{dateTs, mfgDate, planQty, actualQty, difQty}]
  const [tableRows, setTableRows] = useState([]); // แถวไว้โชว์ใต้กราฟ
  const [loading, setLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      // ดึง PLAN & ACTUAL พร้อมกัน
      const [resPlan, resActual] = await Promise.all([
        fetch(`${apiBase?.replace(/\/$/, "")}/report/plan`),
        fetch(`${apiBase?.replace(/\/$/, "")}/report/actual`),
      ]);

      const planRaw = await resPlan.json();
      const actualRaw = await resActual.json();

      // --- PLAN -> รายวัน: ใช้ workingDate, planTarget ---
      const planDaily = sumByDateSimple(
        (Array.isArray(planRaw) ? planRaw : [])
          .map((r) => ({
            date: String(r.workingDate ?? "").slice(0, 10),
            value: Number(r.planTarget || 0),
          }))
          .filter((x) => x.date) // กันค่าที่ไม่มีวันที่
      ); // [{date, value}]

      // --- ACTUAL -> รายวัน: กระจายตามช่วง startDate..endDate ---
      const actualDaily = expandActualToDaily(
        Array.isArray(actualRaw) ? actualRaw : []
      ); // [{date, value}]

      // --- รวมสองชุดตามวันที่ ---
      const allDates = new Set([
        ...planDaily.map((d) => d.date),
        ...actualDaily.map((d) => d.date),
      ]);
      const pMap = new Map(planDaily.map((d) => [d.date, d.value]));
      const aMap = new Map(actualDaily.map((d) => [d.date, d.value]));

      const combined = Array.from(allDates)
        .map((date) => {
          const ts = parseDateOnly(date).getTime();
          const planQty = Number(pMap.get(date) || 0);
          const actualQty = Number(aMap.get(date) || 0);
          return {
            dateTs: ts,
            mfgDate: date,
            planQty,
            actualQty,
            difQty: actualQty - planQty,
          };
        })
        .filter((d) => !Number.isNaN(d.dateTs))
        .sort((a, b) => a.dateTs - b.dateTs);

      setChartData(combined);
      setTableRows(
        combined.map((d) => ({
          mfgDate: d.mfgDate,
          planQty: d.planQty,
          actualQty: d.actualQty,
          difQty: d.difQty,
        }))
      );
    } catch (e) {
      console.error("DASHBOARD load failed:", e);
      setChartData([]);
      setTableRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Toolbar />
      <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
        DASHBOARD PLAN vs ACTUAL
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={loadData} disabled={loading}>
            {loading ? "LOADING..." : "RELOAD"}
          </Button>
        </Box>
      </Paper>

      {/* LINE CHART: X = Date, Y = Qty */}
      <Typography sx={{ fontWeight: "bold", mb: 1 }}>
        LINE CHART – PLAN vs ACTUAL (ต่อวัน)
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              {/* ใช้วันที่แบบสตริงเพื่อให้แท่งเรียงเป็นรายวันง่าย ๆ */}
              <XAxis dataKey="mfgDate" />
              <YAxis />
              <Tooltip formatter={(value, name) => [value?.toLocaleString(), name]} />
              <Legend />
              {/* แท่งคู่: PLAN vs ACTUAL */}
              <Bar dataKey="planQty" name="PLAN QTY" fill="#8884d8" />
              <Bar dataKey="actualQty" name="ACTUAL QTY" fill="#82ca9d" />
              {/* ถ้าอยากแสดงส่วนต่างด้วย (อาจติดลบได้) เปิดอันนี้เพิ่มได้ */}
              {/* <Bar dataKey="difQty" name="DIF (ACT-PLAN)" fill="#ffc658" /> */}
            </BarChart>
          </ResponsiveContainer>
        </Box>

      </Paper>

      <Divider sx={{ my: 2 }} />

      {/* TABLE SUMMARY */}
      <Typography sx={{ fontWeight: "bold", mb: 1 }}>
        SUMMARY (ต่อวัน)
      </Typography>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold" }}>DATE</TableCell>
              <TableCell sx={{ fontWeight: "bold" }} align="right">
                PLAN QTY
              </TableCell>
              <TableCell sx={{ fontWeight: "bold" }} align="right">
                ACTUAL QTY
              </TableCell>
              <TableCell sx={{ fontWeight: "bold" }} align="right">
                DIF (ACT-PLAN)
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tableRows.map((r, i) => (
              <TableRow key={`${r.mfgDate}-${i}`}>
                <TableCell>{r.mfgDate}</TableCell>
                <TableCell align="right">{fmtInt(r.planQty)}</TableCell>
                <TableCell align="right">{fmtInt(r.actualQty)}</TableCell>
                <TableCell align="right">{fmtInt(r.difQty)}</TableCell>
              </TableRow>
            ))}

            {tableRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                  <em>No data</em>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
