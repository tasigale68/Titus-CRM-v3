import { useState, useRef, useEffect } from "react";

const MOCK_CLIENTS = [
  {
    id: "CB-001",
    uniqueRef: "DCS-2025-001",
    clientName: "James Paterson",
    ndisRef: "43012345678",
    planType: "Plan Managed",
    sosUploaded: true,
    sosFileName: "SOS_Paterson_2025.pdf",
    accountStatus: "Active",
    silOrCas: "SIL",
    coreBudgetSIL: 285000,
    coreBudgetCommunity: 42000,
    coreBudgetTransport: 8500,
    totalBudget: 335500,
    invoiceAmount: 127800,
    fromBudget: "Core Budget (SIL)",
    created: "2025-01-15",
    lastUpdate: "2026-02-14",
  },
  {
    id: "CB-002",
    uniqueRef: "DCS-2025-002",
    clientName: "Sarah Mitchell",
    ndisRef: "43098765432",
    planType: "Self Managed",
    sosUploaded: true,
    sosFileName: "SOS_Mitchell_2025.pdf",
    accountStatus: "Active",
    silOrCas: "CAS",
    coreBudgetSIL: 0,
    coreBudgetCommunity: 68000,
    coreBudgetTransport: 12000,
    totalBudget: 80000,
    invoiceAmount: 34200,
    fromBudget: "Core Budget (Community Access)",
    created: "2025-02-01",
    lastUpdate: "2026-02-10",
  },
  {
    id: "CB-003",
    uniqueRef: "DCS-2025-003",
    clientName: "Tane Wiremu",
    ndisRef: "43055667788",
    planType: "NDIA Managed",
    sosUploaded: false,
    sosFileName: null,
    accountStatus: "Active",
    silOrCas: "SIL",
    coreBudgetSIL: 310000,
    coreBudgetCommunity: 55000,
    coreBudgetTransport: 9800,
    totalBudget: 374800,
    invoiceAmount: 0,
    fromBudget: null,
    created: "2025-03-12",
    lastUpdate: "2026-02-12",
  },
  {
    id: "CB-004",
    uniqueRef: "DCS-2025-004",
    clientName: "Lisa Hoang",
    ndisRef: "43011223344",
    planType: "Plan Managed",
    sosUploaded: true,
    sosFileName: "SOS_Hoang_2025.pdf",
    accountStatus: "Inactive",
    silOrCas: "CAS",
    coreBudgetSIL: 0,
    coreBudgetCommunity: 35000,
    coreBudgetTransport: 6500,
    totalBudget: 41500,
    invoiceAmount: 41500,
    fromBudget: "Core Budget (Community Access)",
    created: "2024-11-20",
    lastUpdate: "2026-01-28",
  },
  {
    id: "CB-005",
    uniqueRef: "DCS-2025-005",
    clientName: "Rawiri Johnson",
    ndisRef: "43099887766",
    planType: "Plan Managed",
    sosUploaded: false,
    sosFileName: null,
    accountStatus: "Prospect",
    silOrCas: "SIL",
    coreBudgetSIL: 0,
    coreBudgetCommunity: 0,
    coreBudgetTransport: 0,
    totalBudget: 0,
    invoiceAmount: 0,
    fromBudget: null,
    created: "2026-02-10",
    lastUpdate: "2026-02-10",
  },
  {
    id: "CB-006",
    uniqueRef: "DCS-2025-006",
    clientName: "Emily Donovan",
    ndisRef: "43044556677",
    planType: "Self Managed",
    sosUploaded: true,
    sosFileName: "SOS_Donovan_2025.pdf",
    accountStatus: "Active",
    silOrCas: "SIL",
    coreBudgetSIL: 260000,
    coreBudgetCommunity: 38000,
    coreBudgetTransport: 7200,
    totalBudget: 305200,
    invoiceAmount: 89500,
    fromBudget: "Core Budget (SIL)",
    created: "2025-04-05",
    lastUpdate: "2026-02-15",
  },
];

const formatCurrency = (val) =>
  val === 0 ? "$0.00" : `$${val.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;

const StatusBadge = ({ status }) => {
  const colors = {
    Active: { bg: "#e6f9ee", text: "#0d7a3e", border: "#0d7a3e" },
    Inactive: { bg: "#fef3e6", text: "#b5600a", border: "#b5600a" },
    Prospect: { bg: "#e8edf5", text: "#3a5a8c", border: "#3a5a8c" },
  };
  const c = colors[status] || colors.Active;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: 600,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}30`,
        letterSpacing: "0.3px",
      }}
    >
      {status}
    </span>
  );
};

const TypeBadge = ({ type }) => {
  const isSIL = type === "SIL";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: 600,
        background: isSIL ? "#eae0f5" : "#dff0f7",
        color: isSIL ? "#6b21a8" : "#0e6f8f",
        border: `1px solid ${isSIL ? "#6b21a830" : "#0e6f8f30"}`,
        letterSpacing: "0.3px",
      }}
    >
      {type}
    </span>
  );
};

const BudgetBar = ({ used, total }) => {
  if (total === 0) return <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>;
  const pct = Math.min((used / total) * 100, 100);
  const color = pct > 85 ? "#ef4444" : pct > 60 ? "#f59e0b" : "#10b981";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "#e2e8f0",
          borderRadius: 3,
          overflow: "hidden",
          minWidth: 60,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 3,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500, minWidth: 38 }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
};

// Upload Modal
const UploadModal = ({ client, onClose, onUpload }) => {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const fileRef = useRef();

  const handleFile = (f) => {
    setFile(f);
    setScanning(true);
    // Simulate AI scanning
    setTimeout(() => {
      setScanResults({
        clientName: client?.clientName || "New Client",
        ndisRef: client?.ndisRef || "430XXXXXXXX",
        dob: "15/03/1989",
        planStart: "01/01/2026",
        planEnd: "31/12/2026",
        coreSIL: 295000,
        coreCommunity: 48000,
        coreTransport: 9200,
        total: 352200,
        planType: "Plan Managed",
        silOrCas: "SIL",
      });
      setScanning(false);
      setScanComplete(true);
    }, 2800);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        animation: "fadeIn 0.2s ease",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: 560,
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e3a5f 0%, #2a4d6e 100%)",
            padding: "24px 28px",
            borderRadius: "16px 16px 0 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 700 }}>
              📄 Upload Schedule of Supports
            </h2>
            {client && (
              <p style={{ margin: "4px 0 0", color: "#93c5fd", fontSize: 13 }}>
                {client.clientName} • NDIS: {client.ndisRef}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "#fff",
              width: 32,
              height: 32,
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "24px 28px" }}>
          {!file && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
              }}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? "#2563eb" : "#cbd5e1"}`,
                borderRadius: 12,
                padding: "48px 24px",
                textAlign: "center",
                cursor: "pointer",
                background: dragging ? "#eff6ff" : "#f8fafc",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>📤</div>
              <p style={{ margin: 0, fontWeight: 600, color: "#334155", fontSize: 15 }}>
                Drop SOS document here or click to browse
              </p>
              <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 13 }}>
                Supports PDF, DOC, DOCX • Max 25MB
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx"
                style={{ display: "none" }}
                onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
              />
            </div>
          )}

          {file && scanning && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  margin: "0 auto 20px",
                  borderRadius: "50%",
                  border: "4px solid #e2e8f0",
                  borderTopColor: "#2563eb",
                  animation: "spin 1s linear infinite",
                }}
              />
              <p style={{ fontWeight: 600, color: "#1e3a5f", fontSize: 16, margin: "0 0 6px" }}>
                Scanning Document...
              </p>
              <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
                AI is extracting budget details from {file.name || "document"}
              </p>
              <div style={{ margin: "20px auto 0", maxWidth: 300 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {["Identifying client details", "Extracting core budgets", "Mapping support categories"].map(
                    (step, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          opacity: 1,
                          animation: `fadeIn 0.4s ease ${i * 0.8}s both`,
                        }}
                      >
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "#e2e8f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                          }}
                        >
                          ⏳
                        </div>
                        <span style={{ fontSize: 13, color: "#475569" }}>{step}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {scanComplete && scanResults && (
            <div>
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 10,
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                <span style={{ fontSize: 20 }}>✅</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: "#166534", fontSize: 14 }}>
                    Document Scanned Successfully
                  </p>
                  <p style={{ margin: "2px 0 0", color: "#4ade80", fontSize: 12 }}>
                    {file.name || "SOS_Document.pdf"} • All fields extracted
                  </p>
                </div>
              </div>

              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#1e3a5f",
                  margin: "0 0 14px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Extracted Details
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                {[
                  { label: "Client Name", val: scanResults.clientName },
                  { label: "NDIS Ref #", val: scanResults.ndisRef },
                  { label: "Date of Birth", val: scanResults.dob },
                  { label: "Plan Type", val: scanResults.planType },
                  { label: "Plan Start", val: scanResults.planStart },
                  { label: "Plan End", val: scanResults.planEnd },
                  { label: "SIL or CAS", val: scanResults.silOrCas },
                ].map(({ label, val }) => (
                  <div
                    key={label}
                    style={{
                      background: "#f8fafc",
                      borderRadius: 8,
                      padding: "10px 14px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginBottom: 2 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{val}</div>
                  </div>
                ))}
              </div>

              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#1e3a5f",
                  margin: "0 0 14px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Core Budgets Identified
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {[
                  { label: "Core Budget (SIL)", val: scanResults.coreSIL, color: "#6b21a8" },
                  { label: "Core Budget (Community Access)", val: scanResults.coreCommunity, color: "#0e6f8f" },
                  { label: "Core Budget (Transport)", val: scanResults.coreTransport, color: "#b5600a" },
                ].map(({ label, val, color }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      background: "#f8fafc",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      borderLeft: `4px solid ${color}`,
                    }}
                  >
                    <span style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                      {formatCurrency(val)}
                    </span>
                  </div>
                ))}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 16px",
                    background: "#1e3a5f",
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: 14, color: "#93c5fd", fontWeight: 600 }}>Total Budget</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>
                    {formatCurrency(scanResults.total)}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    setFile(null);
                    setScanComplete(false);
                    setScanResults(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#475569",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Re-upload
                </button>
                <button
                  onClick={() => {
                    onUpload && onUpload(scanResults);
                    onClose();
                  }}
                  style={{
                    flex: 2,
                    padding: "12px 20px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
                  }}
                >
                  ✓ Confirm & Create Budget
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

// Detail Panel
const DetailPanel = ({ client, onClose }) => {
  if (!client) return null;
  const remaining = client.totalBudget - client.invoiceAmount;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 420,
        background: "#fff",
        boxShadow: "-8px 0 30px rgba(0,0,0,0.15)",
        zIndex: 900,
        overflow: "auto",
        animation: "slideIn 0.25s ease",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a5f 0%, #2a4d6e 100%)",
          padding: "24px 24px 20px",
          position: "sticky",
          top: 0,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, color: "#fff", fontSize: 20, fontWeight: 700 }}>
              {client.clientName}
            </h2>
            <p style={{ margin: "6px 0 0", color: "#93c5fd", fontSize: 13 }}>
              NDIS: {client.ndisRef} • {client.planType}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "#fff",
              width: 32,
              height: 32,
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <StatusBadge status={client.accountStatus} />
          <TypeBadge type={client.silOrCas} />
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {/* Budget Overview */}
        <h3 style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 14px" }}>
          Budget Overview
        </h3>
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 12,
            padding: 18,
            marginBottom: 20,
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Total Budget</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1e3a5f" }}>
                {formatCurrency(client.totalBudget)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Remaining</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: remaining < 0 ? "#ef4444" : "#10b981",
                }}
              >
                {formatCurrency(remaining)}
              </div>
            </div>
          </div>
          <BudgetBar used={client.invoiceAmount} total={client.totalBudget} />
        </div>

        {/* Core Budgets */}
        <h3 style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 14px" }}>
          Core Budgets Breakdown
        </h3>
        {[
          { label: "SIL", val: client.coreBudgetSIL, color: "#6b21a8" },
          { label: "Community Access", val: client.coreBudgetCommunity, color: "#0e6f8f" },
          { label: "Transport", val: client.coreBudgetTransport, color: "#b5600a" },
        ].map(({ label, val, color }) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 14px",
              background: "#fff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              borderLeft: `4px solid ${color}`,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 13, color: "#475569" }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
              {formatCurrency(val)}
            </span>
          </div>
        ))}

        {/* SOS Document */}
        <h3 style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px", margin: "20px 0 14px" }}>
          Schedule of Supports
        </h3>
        <div
          style={{
            background: client.sosUploaded ? "#f0fdf4" : "#fef3e6",
            border: `1px solid ${client.sosUploaded ? "#bbf7d0" : "#fde68a"}`,
            borderRadius: 10,
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 24 }}>{client.sosUploaded ? "📄" : "⚠️"}</span>
          <div style={{ flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontWeight: 600,
                fontSize: 13,
                color: client.sosUploaded ? "#166534" : "#92400e",
              }}
            >
              {client.sosUploaded ? client.sosFileName : "No SOS Uploaded"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>
              {client.sosUploaded ? "Uploaded & verified" : "Upload required to auto-populate budgets"}
            </p>
          </div>
        </div>

        {/* Meta */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Unique Ref</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{client.uniqueRef}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Created</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{client.created}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Last Updated</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{client.lastUpdate}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button
            style={{
              flex: 1,
              padding: "11px 16px",
              borderRadius: 10,
              border: "1px solid #1e3a5f",
              background: "transparent",
              color: "#1e3a5f",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            View in Airtable ↗
          </button>
          <button
            style={{
              flex: 1,
              padding: "11px 16px",
              borderRadius: 10,
              border: "none",
              background: "#1e3a5f",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Edit Budget
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

// Sidebar items
const NAV_ITEMS = [
  { icon: "📊", label: "Dashboard", path: "/dashboard" },
  { icon: "📥", label: "Inbox", path: "/inbox", badge: 0 },
  { icon: "👥", label: "Contacts", path: "/contacts" },
  { icon: "✅", label: "Leads", path: "/leads", hasSubmenu: true },
  { icon: "👤", label: "HR / Recruit", path: "/hr", hasSubmenu: true },
  {
    icon: "📅",
    label: "Rosters",
    path: "/rosters",
    hasSubmenu: true,
    expanded: true,
    submenu: [
      { icon: "🏠", label: "Accommodation", path: "/rosters/accommodation" },
      { icon: "📋", label: "Scheduler", path: "/rosters/scheduler" },
      { icon: "💰", label: "Client Budget", path: "/rosters/client-budget", active: true },
    ],
  },
  { icon: "📈", label: "Reports", path: "/reports", hasSubmenu: true },
  { icon: "⚙️", label: "User Management", path: "/user-management" },
];

export default function ClientBudgetPage() {
  const [clients] = useState(MOCK_CLIENTS);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [selectedClient, setSelectedClient] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadClient, setUploadClient] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const filtered = clients.filter((c) => {
    const matchesSearch =
      c.clientName.toLowerCase().includes(search.toLowerCase()) ||
      c.ndisRef.includes(search) ||
      c.uniqueRef.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "All" || c.accountStatus === filterStatus;
    const matchesType = filterType === "All" || c.silOrCas === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const totals = {
    totalBudget: filtered.reduce((s, c) => s + c.totalBudget, 0),
    invoiced: filtered.reduce((s, c) => s + c.invoiceAmount, 0),
    activeCount: filtered.filter((c) => c.accountStatus === "Active").length,
    pendingSOS: filtered.filter((c) => !c.sosUploaded).length,
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Segoe UI', -apple-system, sans-serif", background: "#f1f5f9" }}>
      {/* Sidebar */}
      <div
        style={{
          width: sidebarCollapsed ? 64 : 210,
          background: "linear-gradient(180deg, #1a2e4a 0%, #1e3a5f 40%, #243f5c 100%)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.2s ease",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: sidebarCollapsed ? "16px 12px" : "16px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #1e3a5f, #3b82f6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            DCS
          </div>
          {!sidebarCollapsed && (
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
                Titus CRM
              </div>
              <div style={{ color: "#64748b", fontSize: 10 }}>Delta Community Support</div>
            </div>
          )}
        </div>

        {/* Time */}
        {!sidebarCollapsed && (
          <div
            style={{
              padding: "10px 18px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ color: "#94a3b8", fontSize: 11 }}>Mon, 16 Feb, 11:08 am</span>
            <span
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "#94a3b8",
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              QLD
            </span>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px 8px", overflow: "auto" }}>
          {NAV_ITEMS.map((item) => (
            <div key={item.label}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: sidebarCollapsed ? "10px 12px" : "10px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                  color: "#cbd5e1",
                  fontSize: 13,
                  fontWeight: 500,
                  transition: "background 0.15s",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {!sidebarCollapsed && (
                  <>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        style={{
                          background: "#3b82f6",
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 10,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                    {item.hasSubmenu && <span style={{ fontSize: 10, color: "#64748b" }}>▼</span>}
                  </>
                )}
              </div>
              {/* Submenu */}
              {item.expanded && item.submenu && !sidebarCollapsed && (
                <div style={{ paddingLeft: 16, marginTop: 2 }}>
                  {item.submenu.map((sub) => (
                    <div
                      key={sub.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: sub.active ? 600 : 400,
                        color: sub.active ? "#fff" : "#94a3b8",
                        background: sub.active ? "rgba(59,130,246,0.2)" : "transparent",
                        transition: "background 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{sub.icon}</span>
                      <span>{sub.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div
          style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.06)",
              border: "none",
              color: "#64748b",
              padding: "8px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            {sidebarCollapsed ? "»" : "« Hide Menu"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Top Header */}
        <div
          style={{
            background: "#fff",
            padding: "16px 28px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>💰</span>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1e293b" }}>
                Client Budget
              </h1>
              <p style={{ margin: "2px 0 0", color: "#94a3b8", fontSize: 13 }}>
                {filtered.length} clients • Linked to Airtable
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => {
                setUploadClient(null);
                setShowUpload(true);
              }}
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 8px rgba(16,185,129,0.25)",
              }}
            >
              📤 Upload SOS
            </button>
            <button
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                border: "none",
                background: "#1e3a5f",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              + New Budget
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            padding: "20px 28px 0",
          }}
        >
          {[
            {
              label: "Total Budget Pool",
              value: formatCurrency(totals.totalBudget),
              sub: `${totals.activeCount} active clients`,
              color: "#1e3a5f",
              icon: "📊",
            },
            {
              label: "Total Invoiced",
              value: formatCurrency(totals.invoiced),
              sub: `${((totals.invoiced / (totals.totalBudget || 1)) * 100).toFixed(1)}% utilised`,
              color: "#059669",
              icon: "💵",
            },
            {
              label: "Remaining Budget",
              value: formatCurrency(totals.totalBudget - totals.invoiced),
              sub: "Across all clients",
              color: "#2563eb",
              icon: "📈",
            },
            {
              label: "Pending SOS Upload",
              value: totals.pendingSOS,
              sub: "Documents required",
              color: totals.pendingSOS > 0 ? "#dc2626" : "#10b981",
              icon: totals.pendingSOS > 0 ? "⚠️" : "✅",
            },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: "18px 20px",
                borderTop: `3px solid ${card.color}`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginBottom: 6 }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#1e293b" }}>{card.value}</div>
                </div>
                <span style={{ fontSize: 24 }}>{card.icon}</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div
          style={{
            padding: "18px 28px",
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", flex: 1, maxWidth: 340 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, NDIS ref, or unique ref..."
              style={{
                width: "100%",
                padding: "10px 14px 10px 38px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 13,
                outline: "none",
                background: "#fff",
                boxSizing: "border-box",
              }}
            />
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 15,
                color: "#94a3b8",
              }}
            >
              🔍
            </span>
          </div>
          {[
            {
              label: "Status",
              value: filterStatus,
              options: ["All", "Active", "Inactive", "Prospect"],
              onChange: setFilterStatus,
            },
            {
              label: "Type",
              value: filterType,
              options: ["All", "SIL", "CAS"],
              onChange: setFilterType,
            },
          ].map((f) => (
            <select
              key={f.label}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 13,
                color: "#475569",
                background: "#fff",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {f.label}: {o}
                </option>
              ))}
            </select>
          ))}
        </div>

        {/* Table */}
        <div style={{ padding: "0 28px 28px" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                    {[
                      "Client Name",
                      "NDIS Ref #",
                      "Status",
                      "Type",
                      "SOS",
                      "Core (SIL)",
                      "Core (Community)",
                      "Core (Transport)",
                      "Total Budget",
                      "Invoiced",
                      "Utilisation",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "12px 14px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedClient(c)}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        cursor: "pointer",
                        transition: "background 0.1s",
                        background: i % 2 === 0 ? "#fff" : "#fafbfc",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f7ff")}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafbfc")
                      }
                    >
                      <td style={{ padding: "12px 14px", fontWeight: 600, color: "#1e293b" }}>
                        {c.clientName}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#475569", fontFamily: "monospace", fontSize: 12 }}>
                        {c.ndisRef}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <StatusBadge status={c.accountStatus} />
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <TypeBadge type={c.silOrCas} />
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {c.sosUploaded ? (
                          <span title={c.sosFileName} style={{ cursor: "help" }}>✅</span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadClient(c);
                              setShowUpload(true);
                            }}
                            style={{
                              background: "#fef3e6",
                              border: "1px solid #fde68a",
                              borderRadius: 6,
                              padding: "3px 8px",
                              fontSize: 11,
                              cursor: "pointer",
                              color: "#92400e",
                              fontWeight: 600,
                            }}
                          >
                            Upload
                          </button>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 500, color: "#1e293b" }}>
                        {formatCurrency(c.coreBudgetSIL)}
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 500, color: "#1e293b" }}>
                        {formatCurrency(c.coreBudgetCommunity)}
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 500, color: "#1e293b" }}>
                        {formatCurrency(c.coreBudgetTransport)}
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "#1e3a5f" }}>
                        {formatCurrency(c.totalBudget)}
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 500, color: "#475569" }}>
                        {formatCurrency(c.invoiceAmount)}
                      </td>
                      <td style={{ padding: "12px 14px", minWidth: 120 }}>
                        <BudgetBar used={c.invoiceAmount} total={c.totalBudget} />
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClient(c);
                          }}
                          style={{
                            background: "transparent",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            padding: "5px 10px",
                            fontSize: 12,
                            cursor: "pointer",
                            color: "#475569",
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={12}
                        style={{ padding: "48px 14px", textAlign: "center", color: "#94a3b8" }}
                      >
                        No clients found matching your filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showUpload && (
        <UploadModal
          client={uploadClient}
          onClose={() => setShowUpload(false)}
          onUpload={(results) => console.log("Budget created:", results)}
        />
      )}
      {selectedClient && (
        <DetailPanel client={selectedClient} onClose={() => setSelectedClient(null)} />
      )}
    </div>
  );
}
