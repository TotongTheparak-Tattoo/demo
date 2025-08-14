// src/features/Report/Report.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Button, ToggleButton, ToggleButtonGroup, Toolbar, TextField, TableContainer,
  CircularProgress, Backdrop,
} from "@mui/material";

const apiBase = process.env.REACT_APP_API_URL;

// ---------- helpers ----------
const pad2 = (n) => n.toString().padStart(2, "0");
const numberFmt = (v) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Number(v ?? 0)
  );

// parse safe: "YYYY-MM-DD" -> Date (local time)
function parseDateOnly(s) {
  if (!s) return new Date(NaN);
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function fmtDate(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function daysInMonthStr(monthStr) {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return 31;
  const [yy, mm] = monthStr.split("-").map(Number);
  return new Date(yy, mm, 0).getDate(); // mm 1-based
}
function monthDayCols(monthStr) {
  const n = daysInMonthStr(monthStr);
  return Array.from({ length: n }, (_, i) => pad2(i + 1));
}

function getRowKeyParts(r) {
  const machineNo = r.machineNo ?? r.layout_row ?? "";
  const brgNoValue = r.brgNoValue ?? r.brg_no_value ?? "";
  return { machineNo, brgNoValue };
}

// แจกแจง Actual “ต่อวัน” สำหรับแถวเดียว -> { 'DD': value } เฉพาะวันที่อยู่ใน monthStr
function splitActualRowToMonthDays(row, monthStr) {
  const map = {};
  const qty = Number(row.actualOutput ?? row.actual_output ?? 0);

  // รายวันผ่าน workingDate
  if (row.workingDate) {
    const d = parseDateOnly(row.workingDate);
    if (!Number.isNaN(+d)) {
      const ym = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
      if (ym === monthStr) {
        const dd = pad2(d.getDate());
        map[dd] = (map[dd] || 0) + qty;
      }
      return map;
    }
  }

  // ช่วง start..end -> เฉลี่ยต่อวัน
  const s = parseDateOnly(row.startDate);
  const e = parseDateOnly(row.endDate);
  if (Number.isNaN(+s) || Number.isNaN(+e) || qty === 0) return map;

  const totalDays = Math.max(1, Math.round((e - s) / (24 * 3600 * 1000)) + 1);
  const perDay = qty / totalDays;

  const d = new Date(s);
  while (true) {
    const ym = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    if (ym === monthStr) {
      const dd = pad2(d.getDate());
      map[dd] = (map[dd] || 0) + perDay;
    }
    if (d.getTime() >= e.getTime()) break;
    d.setDate(d.getDate() + 1);
  }
  return map;
}

// แจกแจง Plan ต่อวันสำหรับแถวเดียว (ใช้ workingDate + planTarget)
function splitPlanRowToMonthDays(row, monthStr) {
  const map = {};
  const qty = Number(row.planTarget ?? row.require_assy ?? 0);
  const d = row.workingDate ? parseDateOnly(row.workingDate) : null;
  if (d && !Number.isNaN(+d)) {
    const ym = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    if (ym === monthStr) {
      const dd = pad2(d.getDate());
      map[dd] = (map[dd] || 0) + qty;
    }
  }
  return map;
}

// รวมเป็นรายกลุ่ม (MachineNo+BRG) สำหรับ COMBINE แบบแนวนอน
function buildCombinedDailyMaps(planRows, actualRows, monthStr) {
  const byKey = new Map();

  const ensure = (machineNo, brgNoValue) => {
    const key = `${machineNo}|${brgNoValue}`;
    let rec = byKey.get(key);
    if (!rec) {
      rec = { key, machineNo, brgNoValue, plan: {}, actual: {} };
      byKey.set(key, rec);
    }
    return rec;
  };

  for (const r of planRows || []) {
    const { machineNo, brgNoValue } = getRowKeyParts(r);
    const dayMap = splitPlanRowToMonthDays(r, monthStr);
    if (Object.keys(dayMap).length) {
      const rec = ensure(machineNo, brgNoValue);
      for (const [dd, val] of Object.entries(dayMap)) {
        rec.plan[dd] = (rec.plan[dd] || 0) + Number(val || 0);
      }
    }
  }

  for (const r of actualRows || []) {
    const { machineNo, brgNoValue } = getRowKeyParts(r);
    const dayMap = splitActualRowToMonthDays(r, monthStr);
    if (Object.keys(dayMap).length) {
      const rec = ensure(machineNo, brgNoValue);
      for (const [dd, val] of Object.entries(dayMap)) {
        rec.actual[dd] = (rec.actual[dd] || 0) + Number(val || 0);
      }
    }
  }

  const out = [];
  for (const rec of byKey.values()) {
    const planTotal = Object.values(rec.plan).reduce((a, b) => a + b, 0);
    const actualTotal = Object.values(rec.actual).reduce((a, b) => a + b, 0);
    const gap = actualTotal - planTotal;
    const achv = planTotal ? (actualTotal / planTotal) * 100 : null;
    out.push({ ...rec, planTotal, actualTotal, gap, achv });
  }

  out.sort(
    (x, y) =>
      (x.machineNo || "").localeCompare(y.machineNo || "") ||
      (x.brgNoValue || "").localeCompare(y.brgNoValue || "")
  );

  return out;
}

// ---------- main ----------
export default function Report() {
  const [mode, setMode] = useState("ACTUAL"); // ACTUAL | COMBINE
  const [file, setFile] = useState(null);
  const [actualRows, setActualRows] = useState([]);
  const [planRows, setPlanRows] = useState([]);

  // loader สำหรับ upload ASSY
  const [uploadingAssy, setUploadingAssy] = useState(false);

  // ใช้เดือนเดียวกันทั้ง Actual/Plan/Combine (แนวนอน)
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  // คอลัมน์วันของเดือนที่เลือก
  const dayColsH = useMemo(() => monthDayCols(selectedMonth), [selectedMonth]);

  // ตารางแนวนอน (ACTUAL/PLAN) ต่อแถว
  const actualHorizontalRows = useMemo(
    () =>
      (actualRows || []).map((r) => ({
        row: r,
        dayMap: splitActualRowToMonthDays(r, selectedMonth),
      })),
    [actualRows, selectedMonth]
  );
  const planHorizontalRows = useMemo(
    () =>
      (planRows || []).map((r) => ({
        row: r,
        dayMap: splitPlanRowToMonthDays(r, selectedMonth),
      })),
    [planRows, selectedMonth]
  );

  // สำหรับ CSV (ของเดิม)
  const dayCols = useMemo(() => {
    const keys = new Set();
    const add = (rows) =>
      rows.forEach((r) =>
        Object.keys(r?.days || {}).forEach((k) => keys.add(k))
      );
    add(planRows);
    add(actualRows);
    if (keys.size === 0)
      return Array.from({ length: 31 }, (_, i) => pad2(i + 1));
    return Array.from(keys).sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10)
    );
  }, [planRows, actualRows]);

  // ---- upload actual assy file ----
  const handleUpload = async () => {
    if (!file) {
      alert("Please choose a file.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    try {
      setUploadingAssy(true);
      const res = await fetch(
        `${apiBase}/data_management/actualAssy/upload/`,
        { method: "POST", body: fd }
      );

      // พยายามอ่านผลลัพธ์เป็น JSON (ถ้าไม่ใช่ JSON ก็ไม่พัง)
      let out = null;
      try { out = await res.json(); } catch {}

      if (!res.ok) {
        throw new Error(out?.detail || "Upload failed");
      }
      alert(`✅ upload: ${out?.status || "success"}`);
      loadData();
    } catch (e) {
      console.error(e);
      alert("❌ " + (e.message || e));
    } finally {
      setUploadingAssy(false); // ✅ ปิดวงโหลดเสมอ
    }
  };

  // ---- COMBINE SUMMARY (ของเดิม) ----
  const combinedRows = useMemo(() => {
    const planMap = new Map();
    for (const r of planRows || []) {
      const { machineNo, brgNoValue } = getRowKeyParts(r);
      const key = `${machineNo}|${brgNoValue}`;
      const rec = planMap.get(key) || {
        machineNo,
        brgNoValue,
        planTotal: 0,
        pMin: null,
        pMax: null,
      };
      const val = Number(r.planTarget ?? 0);
      rec.planTotal += val;
      if (r.workingDate) {
        const d = new Date(r.workingDate);
        if (!Number.isNaN(+d)) {
          rec.pMin = rec.pMin ? (d < rec.pMin ? d : rec.pMin) : d;
          rec.pMax = rec.pMax ? (d > rec.pMax ? d : rec.pMax) : d;
        }
      }
      planMap.set(key, rec);
    }

    const actualMap2 = new Map();
    for (const r of actualRows || []) {
      const { machineNo, brgNoValue } = getRowKeyParts(r);
      const key = `${machineNo}|${brgNoValue}`;
      const rec = actualMap2.get(key) || {
        machineNo,
        brgNoValue,
        actualTotal: 0,
        aMin: null,
        aMax: null,
      };
      rec.actualTotal += Number(r.actualOutput ?? 0);

      if (r.startDate) {
        const ds = new Date(r.startDate);
        if (!Number.isNaN(+ds)) {
          rec.aMin = rec.aMin ? (ds < rec.aMin ? ds : rec.aMin) : ds;
        }
      }
      if (r.endDate) {
        const de = new Date(r.endDate);
        if (!Number.isNaN(+de)) {
          rec.aMax = rec.aMax ? (de > rec.aMax ? de : rec.aMax) : de;
        }
      }
      if (r.workingDate) {
        const wd = new Date(r.workingDate);
        if (!Number.isNaN(+wd)) {
          rec.aMin = rec.aMin ? (wd < rec.aMin ? wd : rec.aMin) : wd;
          rec.aMax = rec.aMax ? (wd > rec.aMax ? wd : rec.aMax) : wd;
        }
      }

      actualMap2.set(key, rec);
    }

    const keys = new Set([...planMap.keys(), ...actualMap2.keys()]);
    const out = [];
    keys.forEach((k) => {
      const p = planMap.get(k) || {};
      const a = actualMap2.get(k) || {};

      const machineNo = a.machineNo ?? p.machineNo ?? "";
      const brgNoValue = a.brgNoValue ?? p.brgNoValue ?? "";

      const start = [p.pMin, a.aMin].filter(Boolean).sort((x, y) => x - y)[0] || null;
      const end = [p.pMax, a.aMax].filter(Boolean).sort((x, y) => y - x)[0] || null;

      const planTotal = Number(p.planTotal ?? 0);
      const actualTotal = Number(a.actualTotal ?? 0);
      const gap = actualTotal - planTotal;
      const achv = planTotal ? (actualTotal / planTotal) * 100 : null;

      out.push({
        machineNo,
        brgNoValue,
        startDate: start ? start.toISOString().slice(0, 10) : "",
        endDate: end ? end.toISOString().slice(0, 10) : "",
        planTotal,
        actualTotal,
        gap,
        achv, // %
      });
    });

    out.sort(
      (x, y) =>
        (x.machineNo || "").localeCompare(y.machineNo || "") ||
        (x.brgNoValue || "").localeCompare(y.brgNoValue || "")
    );

    return out;
  }, [planRows, actualRows]);

  // ---- COMBINE แนวนอนแบบรายแถว (ใหม่) ----
  const combinedHorizontalRows = useMemo(
    () => buildCombinedDailyMaps(planRows, actualRows, selectedMonth),
    [planRows, actualRows, selectedMonth]
  );

  const loadData = async () => {
    try {
      const url = `${apiBase?.replace(/\/$/, "")}/report/plan`;
      const res = await fetch(url);
      const raw = await res.text();
      let data = null;
      try {
        data = JSON.parse(raw);
      } catch {}
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      setPlanRows(data);
    } catch (err) {
      console.error("PLAN > fetch failed:", err);
    }
    // === Actual ===
    try {
      const urlA = `${apiBase?.replace(/\/$/, "")}/report/actual`;
      const resA = await fetch(urlA);
      const rawA = await resA.text();
      let dataA = null;
      try {
        dataA = JSON.parse(rawA);
      } catch {}
      if (!resA.ok) throw new Error(`HTTP ${resA.status} ${resA.statusText}`);
      setActualRows(Array.isArray(dataA) ? dataA : []);
    } catch (err) {
      console.error("ACTUAL > fetch failed:", err);
      setActualRows([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const keyOf = (r) =>
    [
      r.machineNo ?? "",
      r.brg_no_value ?? "",
      r.group_brg_no_value ?? "",
      r.startDate ?? "",
      r.endDate ?? "",
    ].join("|");

  // ---- download CSVs ----
  const downloadActualPlan = async () => {
    const toCsv = (rows, baseHeader) => {
      const head = [...baseHeader, ...dayCols];
      const lines = [head.join(",")];
      rows.forEach((r) => {
        const base = [
          r.machineNo,
          r.brg_no_value,
          r.group_brg_no_value,
          r.startDate,
          r.endDate,
          r.actual_output ?? r.require_assy ?? "",
        ];
        const dayVals = dayCols.map((d) =>
          r.days?.[d] != null ? numberFmt(r.days[d]) : ""
        );
        lines.push([...base, ...dayVals].join(","));
      });
      return lines.join("\n");
    };

    const actualHeader = [
      "Machine No",
      "brg_no_value",
      "group_brg_no_value",
      "Start Date",
      "End Date",
      "Actual_output",
    ];
    const planHeader = [
      "Machine No",
      "brg_no_value",
      "group_brg_no_value",
      "Start Date",
      "End Date",
      "require_assy",
    ];

    const csv =
      toCsv(actualRows, actualHeader) + `\n\nPlan\n` + toCsv(planRows, planHeader);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadCombine = () => {
    const head = [
      "Machine No",
      "BRG NO VALUE",
      "Start",
      "End",
      "Plan Total",
      "Actual Total",
      "GAP",
      "% Achv",
    ];
    const lines = [head.join(",")];

    combinedRows.forEach((r) => {
      lines.push([
        r.machineNo ?? "",
        r.brgNoValue ?? "",
        r.startDate ?? "",
        r.endDate ?? "",
        r.planTotal ?? 0,
        r.actualTotal ?? 0,
        r.gap ?? 0,
        r.achv == null ? "" : r.achv.toFixed(1),
      ].join(","));
    });

    const content = `REPORT COMBINE (Plan vs Actual)\n` + lines.join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_combine.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ---------- UI ----------
  return (
    <Box sx={{ p: 3 }}>
      <Toolbar />
      <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
        REPORT PAGE
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography sx={{ fontWeight: "bold", mb: 1 }}>ACTUAL ASSY</Typography>

        <Table size="small" sx={{ mb: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold" }}>ACTUAL</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>TEMPLATE</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>TEMPLATE VERSION</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>FILE</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>ASSY</TableCell>
              <TableCell>
                <Button size="small" onClick={() => alert("(demo) download template")}>
                  [download]
                </Button>
              </TableCell>
              <TableCell>v.0.0.1</TableCell>
              <TableCell>
                <Button
                  size="small"
                  component="label"
                  sx={{ textTransform: "none", color: "blue" }}
                  disabled={uploadingAssy}
                >
                  {file?.name || "[file]"}
                  <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <Button
          variant="outlined"
          size="small"
          onClick={handleUpload}
          sx={{ mr: 2 }}
          disabled={!file || uploadingAssy}
        >
          {uploadingAssy ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              uploading...
            </>
          ) : (
            "upload"
          )}
        </Button>

        <ToggleButtonGroup
          size="small"
          color="primary"
          exclusive
          value={mode}
          onChange={(_, v) => v && setMode(v)}
          sx={{ ml: 2 }}
          disabled={uploadingAssy}
        >
          <ToggleButton value="ACTUAL">ACTUAL</ToggleButton>
          <ToggleButton value="COMBINE">COMBINE</ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {mode === "ACTUAL" ? (
        <>
          {/* ====== แนวนอน: Actual ต่อแถว ====== */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: "bold" }}>Actual (Horizontal by Row)</Typography>
              <TextField
                type="month"
                size="small"
                label="เลือกเดือน"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <Box sx={{ fontSize: 13, color: "text.secondary" }}>
                * ช่องมีสี = มี Actual ของวันนั้น (ตัวเลขคือยอดต่อวัน)
              </Box>
            </Box>

            <Box sx={{ overflowX: "auto" }}>
              <TableContainer sx={{ maxHeight: "70vh", overflowX: "auto" }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>ID</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Machine</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>BRG</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Start / Working</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>End</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }} align="right">Total</TableCell>
                      {dayColsH.map((d) => (
                        <TableCell key={`ahead-${d}`} align="center" sx={{ fontWeight: "bold" }}>
                          {d}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {actualHorizontalRows.map(({ row, dayMap }, i) => (
                      <TableRow key={row.id ?? `${row.rev}-${row.startDate || row.workingDate}-${i}`}>
                        <TableCell>{row.id ?? ""}</TableCell>
                        <TableCell>{row.machineNo ?? ""}</TableCell>
                        <TableCell>{row.brgNoValue ?? ""}</TableCell>
                        <TableCell>{String(row.workingDate ?? row.startDate ?? "")}</TableCell>
                        <TableCell>{String(row.endDate ?? "")}</TableCell>
                        <TableCell align="right">{numberFmt(row.actualOutput)}</TableCell>

                        {dayColsH.map((d) => {
                          const val = dayMap[d] || 0;
                          const has = val > 0;
                          return (
                            <TableCell
                              key={`${row.id || i}-a-${d}`}
                              align="center"
                              sx={{
                                p: 0.5,
                                backgroundColor: has ? "success.light" : "transparent",
                                borderLeft: "1px solid",
                                borderColor: "divider",
                                minWidth: 44,
                              }}
                              title={has ? `${selectedMonth}-${d}` : ""}
                            >
                              {has ? <b>{numberFmt(val)}</b> : ""}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}

                    {actualHorizontalRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6 + dayColsH.length} align="center" sx={{ py: 3 }}>
                          <em>No data</em>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Paper>

          {/* ====== แนวนอน: Plan ต่อแถว ====== */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: "bold" }}>Plan (Horizontal by Row)</Typography>
              <TextField
                type="month"
                size="small"
                label="เลือกเดือน"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <Box sx={{ fontSize: 13, color: "text.secondary" }}>
                * ช่องมีสี = มี Plan ของวันนั้น (ค่าจาก planTarget)
              </Box>
            </Box>

            <Box sx={{ overflowX: "auto" }}>
              <TableContainer sx={{ maxHeight: "70vh", overflowX: "auto" }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>ID</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Machine</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>BRG</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Working Date</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Plan Type</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Is Continue</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }} align="right">Plan Target</TableCell>
                      {dayColsH.map((d) => (
                        <TableCell key={`phead-${d}`} align="center" sx={{ fontWeight: "bold" }}>
                          {d}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {planHorizontalRows.map(({ row, dayMap }, i) => (
                      <TableRow key={row.id ?? `${row.rev}-${row.workingDate}-${i}`}>
                        <TableCell>{row.id ?? ""}</TableCell>
                        <TableCell>{row.machineNo ?? row.layout_row ?? ""}</TableCell>
                        <TableCell>{row.brgNoValue ?? ""}</TableCell>
                        <TableCell>{String(row.workingDate ?? "")}</TableCell>
                        <TableCell>{row.planType ?? ""}</TableCell>
                        <TableCell>{String(row.isMachineContinue)}</TableCell>
                        <TableCell align="right">{numberFmt(row.planTarget)}</TableCell>

                        {dayColsH.map((d) => {
                          const val = dayMap[d] || 0;
                          const has = val > 0;
                          return (
                            <TableCell
                              key={`${row.id || i}-p-${d}`}
                              align="center"
                              sx={{
                                p: 0.5,
                                backgroundColor: has ? "info.light" : "transparent",
                                borderLeft: "1px solid",
                                borderColor: "divider",
                                minWidth: 44,
                              }}
                              title={has ? `${selectedMonth}-${d}` : ""}
                            >
                              {has ? <b>{numberFmt(val)}</b> : ""}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}

                    {planHorizontalRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7 + dayColsH.length} align="center" sx={{ py: 3 }}>
                          <em>No data</em>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Paper>
        </>
      ) : (
        // ================= COMBINE =================
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: "bold" }}>Combine – Horizontal by Row</Typography>
            <TextField
              type="month"
              size="small"
              label="เลือกเดือน"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Box sx={{ fontSize: 13, color: "text.secondary" }}>
              * ในช่องวัน: บน = Plan (ฟ้า), ล่าง = Actual (เขียว)
            </Box>
          </Box>

          <Box sx={{ overflowX: "auto" }}>
            <TableContainer sx={{ maxHeight: "70vh", overflowX: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: "bold" }}>Machine</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>BRG</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }} align="right">Plan Total</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }} align="right">Actual Total</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }} align="right">GAP</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }} align="right">% Achv</TableCell>
                    {dayColsH.map((d) => (
                      <TableCell key={`chead-${d}`} align="center" sx={{ fontWeight: "bold" }}>
                        {d}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {combinedHorizontalRows.map((r, i) => (
                    <TableRow key={`${r.machineNo}|${r.brgNoValue}|H|${i}`}>
                      <TableCell>{r.machineNo}</TableCell>
                      <TableCell>{r.brgNoValue}</TableCell>
                      <TableCell align="right">{numberFmt(r.planTotal)}</TableCell>
                      <TableCell align="right">{numberFmt(r.actualTotal)}</TableCell>
                      <TableCell align="right">{numberFmt(r.gap)}</TableCell>
                      <TableCell align="right">
                        {r.achv == null ? "-" : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(r.achv)}%`}
                      </TableCell>

                      {dayColsH.map((d) => {
                        const pv = r.plan[d] || 0;
                        const av = r.actual[d] || 0;
                        const hasP = pv > 0;
                        const hasA = av > 0;
                        return (
                          <TableCell
                            key={`${r.machineNo}|${r.brgNoValue}|${d}`}
                            align="center"
                            sx={{
                              p: 0.25,
                              borderLeft: "1px solid",
                              borderColor: "divider",
                              minWidth: 54,
                            }}
                            title={`${selectedMonth}-${d}`}
                          >
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                              <Box
                                sx={{
                                  fontSize: 12,
                                  px: 0.5,
                                  borderRadius: 0.5,
                                  backgroundColor: hasP ? "info.light" : "transparent",
                                }}
                              >
                                {hasP ? numberFmt(pv) : ""}
                              </Box>
                              <Box
                                sx={{
                                  fontSize: 12,
                                  px: 0.5,
                                  borderRadius: 0.5,
                                  backgroundColor: hasA ? "success.light" : "transparent",
                                }}
                              >
                                {hasA ? numberFmt(av) : ""}
                              </Box>
                            </Box>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}

                  {combinedHorizontalRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6 + dayColsH.length} align="center" sx={{ py: 3 }}>
                        <em>No data</em>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>
      )}

      {/* Backdrop ระหว่างอัปโหลด ASSY */}
      <Backdrop
        open={uploadingAssy}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 1, color: "#fff" }}
      >
        <CircularProgress color="inherit" />
        <Box sx={{ ml: 2 }}>Uploading ASSY...</Box>
      </Backdrop>
    </Box>
  );
}
