import React, { useState, useEffect  } from "react";
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell, Button,
  Select, MenuItem, InputLabel, FormControl, Toolbar,
  CircularProgress, Backdrop, TableContainer,
} from "@mui/material";

//MASTER
const masterItems = [
  { topic: "bomWos" },
  { topic: "machineGroup" },
  { topic: "machineLayout" },
  { topic: "toolLimitAndCapa" },
  { topic: "fac1" },
  { topic: "fac3" },
  { topic: "sleeveAndThrustBrg" },
];

//BY MONTH
const monthItems = [
  { topic: "balanceOrderMidSmall" },
  { topic: "machineNotAvailable" },
  { topic: "productionPlan" },
  { topic: "kpiSetup" },
  { topic: "kpiProduction" },
  { topic: "workingDate" },
  { topic: "wipAssy" },
];

// === CSV template helpers ===
const TEMPLATE_HEADERS = {
  // ----- MASTER -----
  bomWos: ["updateAt","wosNo","brgNoValue","partNoValue","partComponentGroup","qty","parentPartNo"],
  machineGroup: ["machineNo","machineType","machineGroup"],
  machineLayout: ["lineNo","machineNo","locationNo"],
  toolLimitAndCapa: ["brgNoValue","groupBrgNoValue","machineGroup","machineType","machineNo","groupBrgAndMcGroup","limitByType","limitByGroup","joinToolingPartNo","joinToolingMc","capaDay","utilizeMc","cycleTime","capaF3"],
  fac1: ["brgNoValue","groupBrgNoValue"],
  fac3: ["brgNoValue","groupBrgNoValue"],
  sleeveAndThrustBrg: ["brgNoValue","groupBrgNoValue"],

  // ----- BY MONTH -----
  balanceOrderMidSmall: ["targetPlanMonth","orderNo","dueDate","balanceOrder","partGroup","wosNo"],
  machineNotAvailable: ["machineNo"],
  productionPlan: ["machineNo","brgNoValue"],
  kpiSetup: ["machineGroup","setupAverage","maxSetUpPerDay"],
  kpiProduction: ["autoMachineDailyTarget","manualDailyTarget"],
  workingDate: ["workingDate","workingHr"],
  wipAssy: ["updateAt","brgNoValue","wosNo","processValue","qty","wipType"],
};

export default function UploadPlanningPage() {
  const [activeTab, setActiveTab] = useState("MASTER");
  const [searchTopic, setSearchTopic] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedMonthTopic, setSelectedMonthTopic] = useState("");
  const [fileMap, setFileMap] = useState({});
  const [showData, setShowData] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  // loading states
  const [uploadingTopic, setUploadingTopic] = useState(null);
  const [uploadingMonth, setUploadingMonth] = useState(false);
  const [loadingTopicData, setLoadingTopicData] = useState(false);

  // สร้างไฟล์ CSV ที่มีเฉพาะหัวคอลัมน์
  function downloadCsvTemplate(topic, headers) {
    if (!headers || headers.length === 0) {
      alert(`No template headers configured for ${topic}`);
      return;
    }
    const csv = "\uFEFF" + headers.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic}_template.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const handleFileChange = (topic, file) => {
    setFileMap((prev) => ({
      ...prev,
      [topic]: { file, filename: file.name },
    }));
  };

  const handleDownloadTemplate = (topic) => {
    const headers =
      TEMPLATE_HEADERS[topic] ||
      (Array.isArray(showData) && showData.length > 0 ? Object.keys(showData[0]) : null);
    downloadCsvTemplate(topic, headers);
  };

  const handleUpload = async (topic) => {
    const selected = fileMap[topic];
    if (!selected?.file) {
      alert("Please choose a file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selected.file);

    try {
      setUploadingTopic(topic);
      const endpoint = `/data_management/${topic}/upload/`;

      const res = await fetch(
        `${process.env.REACT_APP_API_URL}${endpoint}`,
        { method: "POST", body: formData }
      );

      let json = null;
      try { json = await res.json(); } catch {}

      if (!res.ok) {
        throw new Error(json?.detail || `Upload failed (HTTP ${res.status})`);
      }

      const { status, inserted, skipped } = json || {};
      alert(`✅ ${status || "success"}${inserted != null ? ` | inserted=${inserted}` : ""}${skipped != null ? ` | skipped=${skipped}` : ""}`);
    } catch (error) {
      console.error("❌ Upload error:", error);
      alert(error.message || "Something went wrong");
    } finally {
      setUploadingTopic(null);
    }
  };

  useEffect(() => {
    const fetchTopicData = async () => {
      if (!searchTopic) {
        setShowData([]);
        return;
      }

      setLoadingTopicData(true);
      setShowData([]);

      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/data_management/${searchTopic}/`);
        if (!res.ok) throw new Error(`Failed to fetch ${searchTopic} data`);
        const data = await res.json();
        setShowData(data);
      } catch (err) {
        console.error("Fetch error:", err);
        setShowData([]);
      } finally {
        setLoadingTopicData(false);
      }
    };

    fetchTopicData();
  }, [searchTopic]);

  const handleMonthUpload = async () => {
    const incompleteTopics = monthItems.filter((item) => !fileMap[item.topic]?.file);
    if (incompleteTopics.length > 0) {
      alert("❌ Please upload all required files before submitting.");
      return;
    }

    const formData = new FormData();
    for (const item of monthItems) {
      const file = fileMap[item.topic].file;
      formData.append(item.topic, file);
    }

    setUploadingMonth(true);
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/data_management/monthy/upload/`,
        { method: "POST", body: formData }
      );

      let json = null;
      try { json = await res.json(); } catch {}

      if (!res.ok) {
        throw new Error(json?.detail || `Upload failed (HTTP ${res.status})`);
      }

      const { status, inserted, skipped } = json || {};
      alert(`✅ ${status || "success"}${inserted != null ? ` | inserted=${inserted}` : ""}${skipped != null ? ` | skipped=${skipped}` : ""}`);
    } catch (error) {
      console.error("❌ Upload error:", error.message);
      alert("❌ Upload failed: " + (error.message || error));
    } finally {
      setUploadingMonth(false);
    }
  };

  const handleDeleteRow = async (row) => {
    if (!searchTopic) {
      alert("ยังไม่ได้เลือกหัวข้อ (topic)");
      return;
    }

    const id = row?.id;
    if (id == null) {
      alert("ลบไม่สำเร็จ: แถวนี้ไม่มีฟิลด์ id");
      return;
    }

    const ok = window.confirm(`ต้องการลบรายการ id=${id} ในหัวข้อ ${searchTopic} ใช่หรือไม่?`);
    if (!ok) return;

    setDeletingId(id);
    const API = process.env.REACT_APP_API_URL;

    try {
      let res = await fetch(`${API}/data_management/${searchTopic}/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        res = await fetch(`${API}/data_management/${searchTopic}/delete/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Delete failed");
      }

      setShowData((prev) => prev.filter((r) => r.id !== id));
      alert("✅ ลบสำเร็จ");
    } catch (err) {
      console.error("❌ Delete error:", err);
      alert(`❌ ลบไม่สำเร็จ: ${err.message || err}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      <Toolbar />
      <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold", mb: 1 }}>
        UPLOAD PLANNING DATA PAGE
      </Typography>
      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        <Typography
          onClick={() => {
            setActiveTab("BY_MONTH");
            setSearchTopic("");
            setShowData([]);
          }}
          sx={{
            cursor: "pointer",
            fontWeight: activeTab === "BY_MONTH" ? "bold" : "normal",
            borderBottom: activeTab === "BY_MONTH" ? "2px solid black" : "none",
          }}
        >
          BY MONTH
        </Typography>
        <Typography
          onClick={() => {
            setActiveTab("MASTER");
            setSelectedMonth("");
            setSelectedMonthTopic("");
          }}
          sx={{
            cursor: "pointer",
            fontWeight: activeTab === "MASTER" ? "bold" : "normal",
            borderBottom: activeTab === "MASTER" ? "2px solid black" : "none",
          }}
        >
          MASTER
        </Typography>
      </Box>

      {/* --- MASTER --- */}
      {activeTab === "MASTER" && (
        <>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography fontWeight="bold" mb={1}>
              MASTER PLANNING DATA LIST
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>TOPICS</TableCell>
                  <TableCell>TEMPLATE</TableCell>
                  <TableCell>TEMPLATE VERSION</TableCell>
                  <TableCell>FILE</TableCell>
                  <TableCell>UPLOAD</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {masterItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.topic}</TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => handleDownloadTemplate(item.topic)}>
                        [download]
                      </Button>
                    </TableCell>
                    <TableCell>v.0.0.1</TableCell>
                    <TableCell>
                      <Button size="small" component="label" sx={{ textTransform: "none", color: "blue" }}>
                        {fileMap[item.topic]?.filename || "[file]"}
                        <input type="file" hidden onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) handleFileChange(item.topic, file);
                        }} />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() => handleUpload(item.topic)}
                        disabled={!fileMap[item.topic]?.file || uploadingTopic === item.topic}
                      >
                        {uploadingTopic === item.topic
                          ? (<><CircularProgress size={16} sx={{ mr: 1 }} /> uploading...</>)
                          : "[upload]"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Box mt={3}>
            <Typography fontWeight="bold">FIND&SEARCH</Typography>

            <Box sx={{ mt: 1, width: 250, display: "flex", alignItems: "center", gap: 1 }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>TOPICS</InputLabel>
                <Select
                  value={searchTopic}
                  label="TOPICS"
                  onChange={(e) => setSearchTopic(e.target.value)}
                >
                  <MenuItem value=""><em>Select</em></MenuItem>
                  {masterItems.map((item, idx) => (
                    <MenuItem key={idx} value={item.topic}>{item.topic}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {loadingTopicData && <CircularProgress size={18} />}
            </Box>
          </Box>
        </>
      )}

      {/* --- BY MONTH --- */}
      {activeTab === "BY_MONTH" && (
        <>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography fontWeight="bold" mb={1}>PLANNING DATA BY MONTH LIST</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>TOPICS</TableCell>
                  <TableCell>TEMPLATE</TableCell>
                  <TableCell>TEMPLATE VERSION</TableCell>
                  <TableCell>FILE</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthItems.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{item.topic}</TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => handleDownloadTemplate(item.topic)}>
                        [download]
                      </Button>
                    </TableCell>
                    <TableCell>v.0.0.1</TableCell>
                    <TableCell>
                      <Button size="small" component="label" sx={{ textTransform: "none", color: "blue" }}>
                        {fileMap[item.topic]?.filename || "[file]"}
                        <input type="file" hidden onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) handleFileChange(item.topic, file);
                        }} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                size="medium"
                sx={{ px: 4 }}
                onClick={handleMonthUpload}
                disabled={uploadingMonth}
              >
                {uploadingMonth
                  ? (<><CircularProgress size={16} sx={{ mr: 1 }} /> uploading...</>)
                  : "upload"}
              </Button>
            </Box>
          </Paper>

          <Box mt={3}>
            <Typography fontWeight="bold">FIND&SEARCH</Typography>

            <Box mt={1}>
              <Typography sx={{ mb: 0.5 }}>MONTH</Typography>
              <Select
                size="small"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                displayEmpty
                sx={{ width: 200 }}
              >
                <MenuItem value="">SELECT</MenuItem>
                <MenuItem value="2025-10">2025-10</MenuItem>
              </Select>
            </Box>

            <Box mt={2}>
              <Typography sx={{ mb: 0.5 }}>TOPICS</Typography>
              <Box sx={{ width: 250, display: "flex", alignItems: "center", gap: 1 }}>
                <Select
                  size="small"
                  value={selectedMonthTopic}
                  onChange={(e) => {
                    const apiKey = e.target.value;
                    setSelectedMonthTopic(apiKey);
                    setSearchTopic(apiKey);
                  }}
                  displayEmpty
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="">Select</MenuItem>
                  {monthItems.map((item, i) => (
                    <MenuItem key={i} value={item.topic}>{item.topic}</MenuItem>
                  ))}
                </Select>
                {loadingTopicData && <CircularProgress size={18} />}
              </Box>
            </Box>
          </Box>
        </>
      )}

      {/* ตารางแสดงผล (ใส่สกรอลล์แนวตั้ง) */}
      {(showData.length > 0 || loadingTopicData) && (
        <Box mt={2}>
          <Typography fontWeight="bold" mb={1}>
            DATA FOR: {searchTopic ? searchTopic.toUpperCase() : "-"}
          </Typography>

          <TableContainer
            sx={{
              maxHeight: "70vh",
              overflowY: "auto",
              overflowX: "auto",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {showData.length > 0
                    ? Object.keys(showData[0]).map((key, idx) => (
                        <TableCell key={idx} sx={{ whiteSpace: "nowrap" }}>{key}</TableCell>
                      ))
                    : <TableCell>Loading...</TableCell>}
                  {activeTab === "MASTER" && showData.length > 0 && (
                    <TableCell sx={{ whiteSpace: "nowrap" }}>ACTIONS</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingTopicData && (
                  <TableRow>
                    <TableCell
                      colSpan={
                        showData.length > 0
                          ? Object.keys(showData[0]).length + (activeTab === "MASTER" ? 1 : 0)
                          : 1
                      }
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <CircularProgress size={18} />
                        <span>Loading data...</span>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}

                {!loadingTopicData && showData.map((row, i) => (
                  <TableRow key={row.id ?? i}>
                    {Object.values(row).map((val, j) => (
                      <TableCell key={j} sx={{ whiteSpace: "nowrap" }}>{String(val)}</TableCell>
                    ))}
                    {activeTab === "MASTER" && (
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleDeleteRow(row)}
                          disabled={deletingId === row.id}
                        >
                          {deletingId === row.id ? "deleting..." : "delete"}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Backdrop รวมหน้า */}
      <Backdrop
        open={Boolean(uploadingTopic || uploadingMonth)}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 1, color: "#fff" }}
      >
        <CircularProgress color="inherit" />
        <Box sx={{ ml: 2 }}>
          {uploadingTopic ? `Uploading: ${uploadingTopic}...` : "Uploading..."}
        </Box>
      </Backdrop>
    </Box>
  );
}
