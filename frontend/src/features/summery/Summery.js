// src/features/Summary/Summery.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Divider,
  Chip,
  Stack,
} from "@mui/material";

const API_URL = process.env.REACT_APP_API_URL;

// ---------- helpers ----------
const fmt = (v) => {
  if (v === null || v === undefined || v === "" || Number.isNaN(Number(v))) return "-";
  const n = Number(v);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
};
const cellSx = { fontSize: 14, whiteSpace: "nowrap", px: 1.25, py: 0.75 };
const thSx = { ...cellSx, fontWeight: 700, background: "rgba(0,0,0,0.03)" };
const subRowSx = { color: "text.secondary" };

const num = (x) => {
  if (x === null || x === undefined) return 0;
  if (typeof x === "number") return x;
  return Number(String(x).replace(/,/g, "").trim()) || 0;
};

// รับค่า dueDate แล้วคืน 'YYYY/MM'
function toMonthKey(dueDate) {
  if (!dueDate) return null;
  if (typeof dueDate === "string") {
    const m = dueDate.match(/^(\d{4})[-/](\d{1,2})/);
    if (m) {
      const y = Number(m[1]);
      const mm = String(Number(m[2])).padStart(2, "0");
      return `${y}/${mm}`;
    }
  }
  const dt = new Date(dueDate);
  if (isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${y}/${m}`;
}

function parseMonthKey(key) {
  // key: 'YYYY/MM' -> Date object of first day of month (local)
  const [y, m] = key.split("/").map((v) => Number(v));
  return new Date(y, (m || 1) - 1, 1);
}

function toMonthKeyFromTargetPlanMonth(v) {
  if (!v) return null;
  if (typeof v === "string") {
    // รองรับ 'YYYY/MM' หรือ 'YYYY-MM'
    let m = v.match(/^(\d{4})[-/](\d{1,2})$/);
    if (m) return `${m[1]}/${String(Number(m[2])).padStart(2, "0")}`;
    // เผื่อกรณี 'YYYYMM'
    m = v.match(/^(\d{4})(\d{2})$/);
    if (m) return `${m[1]}/${m[2]}`;
    // เผื่อเป็นวันที่เต็ม 'YYYY-MM-DD'/'YYYY/MM/DD'
    m = v.match(/^(\d{4})[-/](\d{1,2})/);
    if (m) return `${m[1]}/${String(Number(m[2])).padStart(2, "0")}`;
  }
  const dt = new Date(v);
  if (!isNaN(dt.getTime())) return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
  return null;
}

// สร้างโครงหน้า Summary ให้มีคอลัมน์ตามที่ระบุ
function makeBase(columns) {
  const ptCols = ["Target/day", "Average plan_target/day", "Total target", "Total plan target"];
  const emptyPt = Array(ptCols.length).fill(null);
  return {
    columns, // e.g. ['PASS', '2025/07', '2025/08', '2025/09', '2025/10', 'OVER']
    rows: [
      { label: "Balance order", values: Array(columns.length).fill(null) },
      { label: "wos q'ty", isSub: true, values: Array(columns.length).fill(null) },

      { label: "Plan target", values: Array(columns.length).fill(null) },
      { label: "wos q'ty", isSub: true, values: Array(columns.length).fill(null) },

      { label: "diff", values: Array(columns.length).fill(null) },
      { label: "wos q'ty", isSub: true, values: Array(columns.length).fill(null) },
    ],
    productionTarget: {
      columns: ptCols,
      rows: [
        { label: "Auto_machine_daily_target", values: [...emptyPt] },
        { label: "Manual_daily_target", values: [...emptyPt] },
      ],
    },
    setup: {
      columns: ["maxSetUpPerDay", "Plan set up/day", "diff"],
      rows: [
        { label: "AGL", values: [null, null, null] },
        { label: "FFL", values: [null, null, null] },
        { label: "AMT", values: [null, null, null] },
      ],
    },
    lostTime: [
      { label: "Set up time (hrs.)", value: null },
      { label: "Wait part (hrs.)", value: null },
    ],
  };
}

// ---------- main ----------
export default function Summery() {
  const [data, setData] = useState(null);
  const [usingSample, setUsingSample] = useState(false);
  // ใช้ machineGroup จาก API เป็นชื่อแถว (ควรตรงกับ "AGL/FFL/AMT")
  const normalizeGroup = (g) => (typeof g === "string" ? g.trim().toUpperCase() : g);

  // ✅ ดึง KPI production แล้วอัปเดต Target/day
  async function loadKpiProductionAndPatch() {
    try {
      const res = await fetch(`${API_URL}/data_management/kpiProduction/`);
      if (!res.ok) throw new Error("fetch kpiProduction error");
      const list = await res.json(); // [{autoMachineDailyTarget, manualDailyTarget}, ...]

      // เลือกค่าตัวแรกที่ไม่เป็น null (ส่วนใหญ่มีแถวเดียวอยู่แล้ว)
      let auto = null, manual = null;
      for (const r of list || []) {
        if (auto === null && r?.autoMachineDailyTarget != null) {
          auto = Number(r.autoMachineDailyTarget);
        }
        if (manual === null && r?.manualDailyTarget != null) {
          manual = Number(r.manualDailyTarget);
        }
        if (auto !== null && manual !== null) break;
      }

      setData((prev) => {
        if (!prev) return prev;

        const nextRows = prev.productionTarget.rows.map((row) => {
          if (row.label === "Auto_machine_daily_target") {
            const vals = [...row.values];
            if (auto !== null) vals[0] = auto; // คอลัมน์ Target/day
            return { ...row, values: vals };
          }
          if (row.label === "Manual_daily_target") {
            const vals = [...row.values];
            if (manual !== null) vals[0] = manual; // คอลัมน์ Target/day
            return { ...row, values: vals };
          }
          return row;
        });

        return {
          ...prev,
          productionTarget: { ...prev.productionTarget, rows: nextRows },
        };
      });
    } catch (e) {
      // เงียบตามสไตล์ summary
    }
  }

  // ✅ เติม wos q'ty ใต้ "Plan target" จาก /data_management/plan_wos_qty/
  async function loadPlanWosQtyAndPatch() {
    try {
      const res = await fetch(`${API_URL}/data_management/plan_wos_qty/`);
      if (!res.ok) throw new Error("fetch plan wos qty error");
      const monthly = await res.json(); // [{targetPlanMonth, wosQty}, ...]

      setData((prev) => {
        if (!prev) return prev;
        const colIndex = Object.fromEntries(prev.columns.map((c, i) => [c, i]));
        const values = Array(prev.columns.length).fill(null);

        for (const row of monthly || []) {
          const key =
            toMonthKeyFromTargetPlanMonth(row?.targetPlanMonth) ?? toMonthKey(row?.targetPlanMonth);
          if (!key) continue;

          if (colIndex[key] != null) {
            const ci = colIndex[key];
            values[ci] = (values[ci] ?? 0) + Number(row?.wosQty ?? 0);
          } else if (colIndex["OVER"] != null) {
            const ci = colIndex["OVER"];
            values[ci] = (values[ci] ?? 0) + Number(row?.wosQty ?? 0);
          }
        }

        // แถว wos q'ty ใต้ Plan target คือ index = 3 ตาม makeBase()
        const rows = prev.rows.map((r, i) => (i === 3 && r.label === "wos q'ty" ? { ...r, values } : r));
        return { ...prev, rows };
      });
    } catch (e) {
      // เงียบตามสไตล์ summary
    }
  }

  // ใช้ผลรวม planTarget รายเดือนจาก /data_management/plan_target/
  async function loadPlanTargetAndPatch() {
    try {
      const res = await fetch(`${API_URL}/data_management/plan_target/`);
      if (!res.ok) throw new Error("fetch plan target error");
      const monthly = await res.json(); // [{month:'YYYY/MM', totalPlanTarget}, ...]

      setData((prev) => {
        if (!prev) return prev;
        const colIndex = Object.fromEntries(prev.columns.map((c, i) => [c, i]));
        const planVals = Array(prev.columns.length).fill(null);

        for (const row of monthly || []) {
          const month = row?.month;
          const total = Number(row?.totalPlanTarget ?? 0);
          if (!month) continue;

          if (colIndex[month] != null) {
            const ci = colIndex[month];
            planVals[ci] = (planVals[ci] ?? 0) + total;
          } else if (colIndex["OVER"] != null) {
            const ci = colIndex["OVER"];
            planVals[ci] = (planVals[ci] ?? 0) + total;
          }
        }

        const rows = prev.rows.map((r) =>
          r.label === "Plan target" ? { ...r, values: planVals } : r
        );
        return { ...prev, rows };
      });
    } catch (e) {
      // เงียบตามสไตล์ summary
    }
  }

  // ✅ ดึง KPI Setup แล้วอัปเดตบล็อก "setup"
  async function loadKpiSetupAndPatch() {
    try {
      const res = await fetch(`${API_URL}/data_management/kpiSetup/`);
      if (!res.ok) throw new Error("fetch kpiSetup error");
      const list = await res.json(); // [{machineGroup, maxSetUpPerDay, setupAverage}, ...]

      setData((prev) => {
        if (!prev) return prev;

        // รวมเป็นกลุ่มตาม machineGroup (ฝั่ง backend คัดแถวแรกต่อ group มาแล้ว)
        const byGroup = {};
        for (const r of list || []) {
          const label = normalizeGroup(r?.machineGroup);
          if (!label) continue;
          byGroup[label] = {
            maxSet: Number(r?.maxSetUpPerDay),
            avg: Number(r?.setupAverage),
          };
        }

        const nextRows = prev.setup.rows.map((row) => {
          const g = byGroup[row.label];
          if (!g) return row;

          const maxSet = Number.isFinite(g.maxSet) ? g.maxSet : null;
          const planPerDay = Number.isFinite(g.avg) ? g.avg : null;
          const diff = maxSet != null && planPerDay != null ? maxSet - planPerDay : null;

          const vals = [...row.values];
          vals[0] = maxSet; // maxSetUpPerDay
          vals[1] = planPerDay; // Plan set up/day (= setupAverage)
          vals[2] = diff; // diff
          return { ...row, values: vals };
        });

        return { ...prev, setup: { ...prev.setup, rows: nextRows } };
      });
    } catch (e) {
      // เงียบตามสไตล์ summary
    }
  }

  // ✅ ใช้ยอดแผน "ทั้งเดือน" เพื่อคำนวณ Average/Total
  async function loadMonthlyTotalsAndPatch() {
    try {
      const [wdRes, ptRes] = await Promise.all([
        fetch(`${API_URL}/data_management/workingDate/`),
        fetch(`${API_URL}/data_management/plan_target/`),
      ]);
      if (!wdRes.ok) throw new Error("fetch workingDate error");
      if (!ptRes.ok) throw new Error("fetch plan_target error");

      const workingDates = await wdRes.json();   // [{workingDate, workingHr}, ...]
      const planMonthly  = await ptRes.json();   // [{month:'YYYY/MM', totalPlanTarget}, ...]

      // --- หาเดือนเป้าหมาย: ปัจจุบันถ้ามี ไม่งั้นใช้เดือนล่าสุดที่มีข้อมูล
      const months = (planMonthly || []).map(r => r.month).filter(Boolean).sort();
      const now = new Date();
      const curKey = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
      const targetMonthKey = months.includes(curKey) ? curKey : (months[months.length - 1] || null);

      // ถ้าไม่มีข้อมูลเดือนเลย ก็ไม่อัปเดต
      if (!targetMonthKey) return;

      // --- นับจำนวน "วันทำงานของเดือนเป้าหมายทั้งเดือน" (workingHr > 0 และ key ตรงกัน)
      const workingDaysInMonth = (workingDates || []).filter(r => {
        return num(r?.workingHr) > 0 && toMonthKey(r?.workingDate) === targetMonthKey;
      }).length;

      // --- รวม plan ทั้งเดือนเป้าหมาย
      const totalPlanMonth = (planMonthly || [])
        .filter(r => r.month === targetMonthKey)
        .reduce((s, r) => s + Number(r?.totalPlanTarget ?? 0), 0);

      const avgPerDay = workingDaysInMonth > 0 ? (totalPlanMonth / workingDaysInMonth) : null;

      // --- อัปเดตบล็อก Production target
      setData(prev => {
        if (!prev) return prev;
        const colMap = Object.fromEntries(prev.productionTarget.columns.map((c, i) => [c, i]));
        const idxAvg        = colMap["Average plan_target/day"];
        const idxTotalTarget= colMap["Total target"];
        const idxTotalPlan  = colMap["Total plan target"];

        const nextRows = prev.productionTarget.rows.map(row => {
          const vals = [...row.values];
          if (idxAvg != null)         vals[idxAvg]         = avgPerDay;
          if (idxTotalTarget != null) vals[idxTotalTarget] = totalPlanMonth; // = ยอดแผนทั้งเดือน
          if (idxTotalPlan != null)   vals[idxTotalPlan]   = totalPlanMonth; // = ยอดแผนทั้งเดือน
          return { ...row, values: vals };
        });

        return { ...prev, productionTarget: { ...prev.productionTarget, rows: nextRows } };
      });
    } catch (e) {
      // เงียบตามสไตล์ summary
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadBalanceOrder() {
      try {
        const res = await fetch(`${API_URL}/data_management/balanceOrderMidSmall/`);
        if (!res.ok) throw new Error("fetch error");
        const items = await res.json(); // [{dueDate, balanceOrder, orderNo, ...}, ...]

        // 1) หาเดือนจาก targetPlanMonth ของ balanceOrderMidSmall
        let monthKeys = Array.from(
          new Set(
            (items || [])
              .map((r) => toMonthKeyFromTargetPlanMonth(r?.targetPlanMonth))
              .filter(Boolean)
          )
        ).sort((a, b) => parseMonthKey(a) - parseMonthKey(b));

        // Fallback: ถ้า targetPlanMonth ว่าง/ไม่มีค่า ใช้ตาม dueDate เหมือนเดิม
        if (monthKeys.length === 0) {
          monthKeys = Array.from(
            new Set((items || []).map((r) => toMonthKey(r?.dueDate)).filter(Boolean))
          ).sort((a, b) => parseMonthKey(a) - parseMonthKey(b));
        }

        // 3) คอลัมน์: PASS | months... | OVER
        const columns = ["PASS", ...monthKeys, "OVER"];
        const base = makeBase(columns);
        const colIndex = Object.fromEntries(columns.map((c, i) => [c, i]));

        const firstMonth = monthKeys.length ? parseMonthKey(monthKeys[0]) : null;
        const lastMonth = monthKeys.length ? parseMonthKey(monthKeys[monthKeys.length - 1]) : null;

        // 4) ตัวสะสม: ยอดเงิน + ชุด WOS ไม่ซ้ำ
        const sums = Array(columns.length).fill(0);
        const wosSets = columns.map(() => new Set());

        for (const r of items || []) {
          const key = toMonthKey(r?.dueDate);
          if (!key) continue;

          // --- เลือกบัคเก็ตคอลัมน์ (PASS / เดือน / OVER)
          const cur = parseMonthKey(key);
          let bucket =
            firstMonth && cur < firstMonth
              ? "PASS"
              : lastMonth && cur > lastMonth
              ? "OVER"
              : key in colIndex
              ? key
              : "OVER";

          const ci = colIndex[bucket];

          // --- รวมยอด Balance
          sums[ci] += num(r?.balanceOrder);

          // --- เก็บ WOS แบบไม่ซ้ำ
          const idRaw = r?.orderNo ?? r?.wosNo ?? r?.bomWosId;
          const wosId = idRaw != null ? String(idRaw).trim() : null;
          if (wosId) wosSets[ci].add(wosId);
        }

        // 5) แปลงชุด WOS -> จำนวน
        const wosCounts = wosSets.map((s) => s.size);

        // 6) ใส่ค่าลงตาราง
        const rows = base.rows.map((r, i) => {
          if (r.label === "Balance order") return { ...r, values: sums };
          // แถว wos q'ty ใต้ Balance order คือ index 1 ตาม makeBase()
          if (i === 1 && r.label === "wos q'ty") return { ...r, values: wosCounts };
          return r;
        });

        if (mounted) {
          const prepared = { ...base, rows };
          setData(prepared);
          setUsingSample(false);

          // ลำดับการโหลด/คำนวณ
          await loadPlanTargetAndPatch();
          await loadPlanWosQtyAndPatch();
          await loadKpiProductionAndPatch();
          await loadKpiSetupAndPatch();
          await loadMonthlyTotalsAndPatch();
        }
      } catch (e) {
        const columns = ["PASS", "OVER"]; // ไม่มีเดือนคงที่แล้ว
        const base = makeBase(columns);
        if (mounted) {
          setData(base);
          setUsingSample(true);
        }
      }
    }

    loadBalanceOrder();
    return () => {
      mounted = false;
    };
  }, []);

  // auto-compute diff = Balance - Plan และ wos q'ty diff = (wos balance - wos plan)
  const computedRows = useMemo(() => {
    if (!data) return [];
    const copy = data.rows.map((r) => ({ ...r, values: [...(r.values || [])] }));

    const idxBalance = copy.findIndex((r) => r.label === "Balance order");
    const idxPlan = copy.findIndex((r) => r.label === "Plan target");
    const idxDiff = copy.findIndex((r) => r.label === "diff");

    // หา index ของ 3 แถว wos q'ty ตามลำดับใน makeBase(): balance, plan, diff
    const wosIdxs = [];
    copy.forEach((r, i) => {
      if (r.label === "wos q'ty") wosIdxs.push(i);
    });
    const [idxWosBalance, idxWosPlan, idxWosDiff] = wosIdxs;

    // ---- คำนวณตัวเลขหลัก (Balance - Plan) ----
    if (idxBalance !== -1 && idxPlan !== -1 && idxDiff !== -1) {
      for (let c = 0; c < data.columns.length; c++) {
        const balRaw = copy[idxBalance].values?.[c];
        const planRaw = copy[idxPlan].values?.[c];
        const bal = balRaw == null ? NaN : Number(balRaw);
        const plan = planRaw == null ? NaN : Number(planRaw);

        const haveDiff = copy[idxDiff].values?.[c] != null;

        if (!haveDiff) {
          if (!Number.isNaN(bal) && !Number.isNaN(plan)) {
            copy[idxDiff].values[c] = bal - plan;
          } else if (!Number.isNaN(bal) && (planRaw == null || Number.isNaN(plan))) {
            copy[idxDiff].values[c] = bal;
          }
        }
      }
    }

    // ---- คำนวณ wos q'ty diff = (วอสของ Balance - วอสของ Plan) ----
    if (idxWosBalance != null && idxWosPlan != null && idxWosDiff != null) {
      for (let c = 0; c < data.columns.length; c++) {
        const wbRaw = copy[idxWosBalance].values?.[c];
        const wpRaw = copy[idxWosPlan].values?.[c];
        const wb = wbRaw == null ? NaN : Number(wbRaw);
        const wp = wpRaw == null ? NaN : Number(wpRaw);

        const haveWosDiff = copy[idxWosDiff].values?.[c] != null;

        if (!haveWosDiff) {
          if (!Number.isNaN(wb) && !Number.isNaN(wp)) {
            copy[idxWosDiff].values[c] = wb - wp;
          } else if (!Number.isNaN(wb) && (wpRaw == null || Number.isNaN(wp))) {
            copy[idxWosDiff].values[c] = wb;
          }
          // ถ้าทั้งคู่ว่าง ปล่อยเป็น null ตามเดิม
        }
      }
    }

    return copy;
  }, [data]);

  if (!data) {
    return (
      <Box p={2}>
        <Typography variant="body2" color="text.secondary">
          Loading summary...
        </Typography>
      </Box>
    );
  }

  return (
    <Box p={2} sx={{ maxWidth: 1400, mx: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <Typography variant="h6" fontWeight={800}>
          Production Summary
        </Typography>
        {usingSample && <Chip size="small" label="Fallback mode" />}
      </Stack>

      {/* -------- TOP BLOCK -------- */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
          DUE DATE
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={thSx}> </TableCell>
              {data.columns.map((c) => (
                <TableCell key={c} align="right" sx={thSx}>
                  {c}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {computedRows.map((row, idx) => (
              <TableRow key={`${row.label}-${idx}`}>
                <TableCell sx={{ ...cellSx, ...(row.isSub ? subRowSx : {}) }}>
                  {row.label}
                </TableCell>
                {data.columns.map((_, ci) => (
                  <TableCell key={ci} align="right" sx={{ ...cellSx, ...(row.isSub ? subRowSx : {}) }}>
                    {fmt(row.values?.[ci])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* -------- PRODUCTION TARGET -------- */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Production target :
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={thSx}> </TableCell>
              {data.productionTarget.columns.map((c) => (
                <TableCell key={c} align="right" sx={thSx}>
                  {c}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.productionTarget.rows.map((r) => (
              <TableRow key={r.label}>
                <TableCell sx={cellSx}>{r.label}</TableCell>
                {r.values.map((v, i) => (
                  <TableCell key={i} align="right" sx={cellSx}>
                    {fmt(v)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* -------- SET UP -------- */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Set up :
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={thSx}> </TableCell>
              {data.setup.columns.map((c) => (
                <TableCell key={c} align="right" sx={thSx}>
                  {c}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.setup.rows.map((r) => (
              <TableRow key={r.label}>
                <TableCell sx={cellSx}>{r.label}</TableCell>
                {r.values.map((v, i) => (
                  <TableCell
                    key={i}
                    align="right"
                    sx={{
                      ...cellSx,
                      ...(data.setup.columns[i] === "diff"
                        ? {
                            fontWeight: 700,
                            color: v < 0 ? "error.main" : v > 0 ? "success.main" : "text.primary",
                          }
                        : {}),
                    }}
                  >
                    {fmt(v)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* -------- LOST TIME -------- */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Lost time :
        </Typography>

        {data.lostTime.map((it, i) => (
          <Box key={i}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(200px, 320px) 1fr",
                gap: 2,
                alignItems: "center",
                py: 0.75,
              }}
            >
              <Typography sx={{ ...cellSx }}>{it.label}</Typography>
              <Typography align="right" sx={{ ...cellSx }}>
                {fmt(it.value)}
              </Typography>
            </Box>
            {i < data.lostTime.length - 1 && <Divider />}
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
