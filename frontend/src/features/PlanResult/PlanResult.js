// src/features/PlanResult/PlanResult.js
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
  Button,
  CircularProgress,
  Stack,
  Chip,
  Toolbar,
  TableContainer,
} from "@mui/material";

const apiBase = process.env.REACT_APP_API_URL;

// -------- helpers --------
const numberFmt = (v) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    Number(v ?? 0)
  );

// รองรับวันที่ทั้งรูปแบบ ISO และ dd/mm/yyyy
const parseMaybeDate = (s) => {
  if (!s) return null;
  if (typeof s !== "string") {
    const d = new Date(s);
    return isNaN(+d) ? null : d;
  }
  const tryIso = new Date(s);
  if (!isNaN(+tryIso)) return tryIso;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    const d2 = new Date(`${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00`);
    return isNaN(+d2) ? null : d2;
  }
  return null;
};

export default function PlanResult() {
  const [loading, setLoading] = useState(true);
  const [rowsAll, setRowsAll] = useState([]);        // ดึงทั้งหมด (ทุก rev)
  const [approvingRev, setApprovingRev] = useState(null);
  const [approvedRev, setApprovedRev] = useState(null); // ✅ rev ที่อนุมัติอยู่แล้ว (มาจาก /report/plan)

  // ดึงรายการทั้งหมดทุก rev (เดิม)
  const loadAll = async () => {
    setLoading(true);
    try {
      const url = `${apiBase}/data_menagement/plan_result/get`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const cleaned = Array.isArray(data)
        ? data.map((r) => ({ ...r, rev: r.rev == null ? null : Number(r.rev) }))
        : [];
      setRowsAll(cleaned);
    } catch (e) {
      console.error("loadAll error:", e);
      setRowsAll([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ ดึง rev ที่อนุมัติแล้วจาก /report/plan (ApproveDataPlan)
  const loadApprovedRev = async () => {
    try {
      const res = await fetch(`${apiBase}/report/plan`);
      if (!res.ok) throw new Error("report/plan failed");
      const data = await res.json();
      const revs = (Array.isArray(data) ? data : [])
        .map((r) => Number(r.rev))
        .filter((n) => Number.isFinite(n));
      // ปกติ ApproveDataPlan ควรมี rev เดียว; เผื่อมีหลายอัน เลือก max ไว้ก่อน
      const current = revs.length ? Math.max(...revs) : null;
      setApprovedRev(current);
    } catch (e) {
      console.error("loadApprovedRev error:", e);
      setApprovedRev(null);
    }
  };

  useEffect(() => {
    loadAll();
    loadApprovedRev();
  }, []);

  // จัดกลุ่มตาม rev (desc) และ sort แถวในแต่ละ rev ตาม workingDate (asc)
  const sections = useMemo(() => {
    const map = new Map(); // rev:number -> rows[]
    for (const r of rowsAll) {
      const key = Number(r.rev);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    const revs = [...map.keys()]
      .filter((v) => Number.isFinite(v))
      .sort((a, b) => b - a);
    return revs.map((rev) => {
      const rows = map.get(rev) ?? [];
      const sorted = [...rows].sort((a, b) => {
        const da = parseMaybeDate(a.workingDate);
        const db = parseMaybeDate(b.workingDate);
        if (da && db) return da - db;
        return String(a.workingDate).localeCompare(String(b.workingDate));
      });
      return { rev, rows: sorted };
    });
  }, [rowsAll]);

  const downloadCSV = (rev, rows) => {
    const head = [
      "brgNoValue",
      "machineNo",
      "workingDate",
      "planTarget",
      "isMachineContinue",
      "rev",
      "updateAt",
      "planType",
    ];
    const lines = [head.join(",")];
    rows.forEach((r) => {
      lines.push(
        [
          r.brgNoValue ?? "",
          r.machineNo ?? "",
          r.workingDate ?? "",
          r.planTarget ?? r.planTraget ?? "",
          r.isMachineContinue ?? 0,
          r.rev ?? "",
          r.updatedAt ?? "",
          r.planType ?? "",
        ].join(",")
      );
    });
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plan_result_rev_${rev}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // อนุมัติ rev -> เคลียร์ตาราง approved แล้วคัดลอกของ rev มาใส่ใหม่
  const approveRev = async (rev) => {
    try {
      setApprovingRev(rev);
      const res = await fetch(`${apiBase}/data_management/create_approve_plan/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rev }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Approve failed");
      }
      alert(`✅ Approved rev ${rev}`);
      // รีเฟรชทั้งรายการ และ rev ที่อนุมัติอยู่
      await loadAll();
      await loadApprovedRev();
    } catch (e) {
      alert("❌ " + (e.message || "Approve failed"));
    } finally {
      setApprovingRev(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Toolbar />
      <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
        PLAN RESULT PAGE
      </Typography>

      {loading ? (
        <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      ) : sections.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography align="center" sx={{ opacity: 0.7 }}>
            No data
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: "grid", gap: 2 }}>
          {sections.map(({ rev, rows }) => {
            const isApproved = approvedRev != null && rev === approvedRev; // ✅ เขียวเฉพาะ rev ที่ /report/plan บอกว่าอนุมัติแล้ว
            return (
              <Paper
                key={rev}
                variant="outlined"
                sx={{
                  p: 2,
                  border: "2px solid",
                  borderColor: isApproved ? "success.main" : "divider",
                  bgcolor: isApproved ? "success.light" : "background.paper",
                  transition: "all .2s",
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: "bold", mb: 1, display: "flex", alignItems: "center", gap: 1 }}
                >
                  REV: {rev}
                  {isApproved && <Chip size="small" color="success" label="APPROVED" />}
                </Typography>
                <TableContainer sx={{ maxHeight: "70vh", overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>BRG NO VALUE</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>MACHINE NO</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>WORKING DATE</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>PLAN TARGET</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }} align="right">
                        IS MACHINE CONTINUE
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold" }} align="right">
                        REV
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>UPDATE AT</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>PLAN TYPE</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={`${rev}-${r.id ?? i}`}>
                        <TableCell>{r.brgNoValue}</TableCell>
                        <TableCell>{r.machineNo}</TableCell>
                        <TableCell>{r.workingDate}</TableCell>
                        <TableCell align="right">{numberFmt(r.planTarget ?? r.planTraget)}</TableCell>
                        <TableCell align="right">{r.isMachineContinue ?? 0}</TableCell>
                        <TableCell align="right">{r.rev}</TableCell>
                        <TableCell>{r.updatedAt ?? ""}</TableCell>
                        <TableCell>{r.planType}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </TableContainer>
                <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => downloadCSV(rev, rows)}
                    disabled={approvingRev === rev}
                  >
                    DOWNLOAD
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => approveRev(rev)}
                    disabled={approvingRev === rev}
                  >
                    {approvingRev === rev ? "APPROVING..." : "APPROVE"}
                  </Button>
                </Stack>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
