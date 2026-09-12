import React, { useState, useMemo } from "react";
import { ERPState, AuditLogEntry, AuditLogChange } from "../types";
import {
  History,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Shield,
  Plus,
  Trash2,
  Edit3,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Layers,
  ChevronDown,
  ChevronRight,
  Eye,
  RefreshCw,
  Copy,
  Check,
  X,
  FileSpreadsheet,
  FileCode,
  ShieldAlert,
  Info,
  Laptop
} from "lucide-react";
import { formatDate } from "../utils";

interface AuditLogViewProps {
  state: ERPState;
  currentUserEmail?: string;
  onUpdateState: (newState: ERPState) => void;
  setCurrentTab?: (tab: string) => void;
}

export default function AuditLogView({
  state,
  currentUserEmail,
  onUpdateState,
  setCurrentTab,
}: AuditLogViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("ALL");
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [selectedUser, setSelectedUser] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<"ALL" | "TODAY" | "7DAYS" | "30DAYS" | "CUSTOM">("ALL");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showManualLogModal, setShowManualLogModal] = useState(false);
  
  // Form for manual audit note
  const [manualModule, setManualModule] = useState("System Audit");
  const [manualAction, setManualAction] = useState("AUDIT_NOTE");
  const [manualDescription, setManualDescription] = useState("");
  const [manualEntityName, setManualEntityName] = useState("");

  const auditLogs = useMemo(() => {
    return state.auditLogs || [];
  }, [state.auditLogs]);

  // Extract unique modules and users for filter dropdowns
  const availableModules = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((log) => {
      if (log.module) set.add(log.module);
    });
    return Array.from(set).sort();
  }, [auditLogs]);

  const availableUsers = useMemo(() => {
    const map = new Map<string, string>();
    auditLogs.forEach((log) => {
      if (log.userId) {
        map.set(log.userId, log.userName || log.userId);
      }
    });
    return Array.from(map.entries());
  }, [auditLogs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    return auditLogs.filter((log) => {
      // 1. Text Search
      if (query) {
        const matchesQuery =
          (log.description || "").toLowerCase().includes(query) ||
          (log.userName || "").toLowerCase().includes(query) ||
          (log.userId || "").toLowerCase().includes(query) ||
          (log.userEmail || "").toLowerCase().includes(query) ||
          (log.entityName || "").toLowerCase().includes(query) ||
          (log.entityId || "").toLowerCase().includes(query) ||
          (log.module || "").toLowerCase().includes(query) ||
          (log.action || "").toLowerCase().includes(query) ||
          (log.ipAddress || "").toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      // 2. Action Filter
      if (selectedAction !== "ALL" && log.action !== selectedAction) {
        return false;
      }

      // 3. Module Filter
      if (selectedModule !== "ALL" && log.module !== selectedModule) {
        return false;
      }

      // 4. User Filter
      if (selectedUser !== "ALL" && log.userId !== selectedUser) {
        return false;
      }

      // 5. Date Filter
      if (dateFilter !== "ALL") {
        const logDate = new Date(log.timestamp);
        const logDateStr = logDate.toISOString().split("T")[0];

        if (dateFilter === "TODAY") {
          if (logDateStr !== todayStr) return false;
        } else if (dateFilter === "7DAYS") {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (logDate < sevenDaysAgo) return false;
        } else if (dateFilter === "30DAYS") {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (logDate < thirtyDaysAgo) return false;
        } else if (dateFilter === "CUSTOM") {
          if (customStartDate && logDateStr < customStartDate) return false;
          if (customEndDate && logDateStr > customEndDate) return false;
        }
      }

      return true;
    });
  }, [auditLogs, searchTerm, selectedAction, selectedModule, selectedUser, dateFilter, customStartDate, customEndDate]);

  // Summary Metrics
  const stats = useMemo(() => {
    let creates = 0;
    let updates = 0;
    let deletes = 0;
    let others = 0;
    const userSet = new Set<string>();

    auditLogs.forEach((log) => {
      if (log.userId) userSet.add(log.userId);
      if (log.action === "CREATE") creates++;
      else if (log.action === "UPDATE") updates++;
      else if (log.action === "DELETE") deletes++;
      else others++;
    });

    return {
      total: auditLogs.length,
      creates,
      updates,
      deletes,
      others,
      uniqueUsers: userSet.size,
    };
  }, [auditLogs]);

  // Relative time helper
  const getRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      return formatDate(isoString);
    } catch {
      return isoString;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "CREATE":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: Plus,
          label: "CREATED",
        };
      case "UPDATE":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200",
          icon: Edit3,
          label: "UPDATED",
        };
      case "DELETE":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200",
          icon: Trash2,
          label: "DELETED",
        };
      case "TRANSFER":
        return {
          bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
          icon: ArrowRightLeft,
          label: "TRANSFER",
        };
      case "STATUS_CHANGE":
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          icon: RefreshCw,
          label: "STATUS",
        };
      default:
        return {
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          icon: History,
          label: action,
        };
    }
  };

  // Export handlers
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = [
      "ID",
      "Timestamp (ISO)",
      "Date & Time",
      "User ID",
      "User Name",
      "User Email",
      "Role",
      "Action",
      "Module",
      "Entity ID",
      "Entity Name",
      "Description",
      "IP Address",
    ];

    const rows = filteredLogs.map((log) => [
      `"${log.id}"`,
      `"${log.timestamp}"`,
      `"${new Date(log.timestamp).toLocaleString()}"`,
      `"${log.userId || ""}"`,
      `"${log.userName || ""}"`,
      `"${log.userEmail || ""}"`,
      `"${log.role || ""}"`,
      `"${log.action || ""}"`,
      `"${log.module || ""}"`,
      `"${log.entityId || ""}"`,
      `"${(log.entityName || "").replace(/"/g, '""')}"`,
      `"${(log.description || "").replace(/"/g, '""')}"`,
      `"${log.ipAddress || ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Divine_Traders_Audit_Log_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (filteredLogs.length === 0) return;
    const jsonStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Divine_Traders_Audit_Log_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyJSON = (log: AuditLogEntry) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Add manual administrative audit entry
  const handleAddManualLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDescription.trim()) return;

    const currentMember = (state.teamMembers || []).find(
      (m) => (m.email || "").toLowerCase() === (currentUserEmail || "").toLowerCase()
    );

    const newLog: AuditLogEntry = {
      id: `audit-manual-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentMember?.userId || currentUserEmail || "Admin",
      userName: currentMember?.name || "Administrator",
      userEmail: currentUserEmail || currentMember?.email,
      role: currentMember?.role || "Admin",
      action: manualAction,
      module: manualModule,
      entityName: manualEntityName || "System Administrative Memo",
      description: manualDescription.trim(),
      ipAddress: "192.168.1.104",
    };

    onUpdateState({
      ...state,
      auditLogs: [newLog, ...(state.auditLogs || [])],
    });

    setManualDescription("");
    setManualEntityName("");
    setShowManualLogModal(false);
  };

  const handleClearLogs = () => {
    onUpdateState({
      ...state,
      auditLogs: [],
    });
    setShowClearConfirm(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <History size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Audit Trail & Governance Log</h1>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-indigo-200">
                  Immutable State Logs
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically recording all database mutations (Add, Edit, Delete) with timestamps and operator user IDs.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowManualLogModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs"
          >
            <Plus size={14} />
            <span>Add Audit Note</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <FileCode size={14} className="text-blue-600" />
            <span>Export JSON</span>
          </button>

          {auditLogs.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              title="Clear all recorded audit logs (Admin only)"
            >
              <Trash2 size={14} />
              <span>Clear Log</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Total Operations</span>
            <History size={16} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Across all 18 modules</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-medium">Records Created</span>
            <Plus size={16} />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700">{stats.creates}</div>
          <div className="text-[11px] text-emerald-600/80 mt-0.5">Invoices, items, bills & POs</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-xs font-medium">Records Modified</span>
            <Edit3 size={16} />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700">{stats.updates}</div>
          <div className="text-[11px] text-amber-600/80 mt-0.5">Stock, price & status edits</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-xs font-medium">Records Deleted</span>
            <Trash2 size={16} />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700">{stats.deletes}</div>
          <div className="text-[11px] text-rose-600/80 mt-0.5">Cancellations & removals</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-medium">Active Operators</span>
            <User size={16} />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-700">{stats.uniqueUsers}</div>
          <div className="text-[11px] text-blue-600/80 mt-0.5">Unique user identifiers</div>
        </div>
      </div>

      {/* Search, Filters and View Toggle Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by action, description, operator, user ID, invoice/item code, IP..."
              className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Action Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE">Created (Add)</option>
              <option value="UPDATE">Updated (Edit)</option>
              <option value="DELETE">Deleted (Remove)</option>
              <option value="TRANSFER">Transfer</option>
              <option value="STATUS_CHANGE">Status Change</option>
              <option value="AUDIT_NOTE">Audit Note</option>
            </select>

            {/* Module Filter */}
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 max-w-[170px]"
            >
              <option value="ALL">All Modules</option>
              {availableModules.map((mod) => (
                <option key={mod} value={mod}>
                  {mod}
                </option>
              ))}
            </select>

            {/* User Filter */}
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 max-w-[150px]"
            >
              <option value="ALL">All Users</option>
              {availableUsers.map(([uid, uname]) => (
                <option key={uid} value={uid}>
                  {uname} ({uid})
                </option>
              ))}
            </select>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="7DAYS">Last 7 Days</option>
              <option value="30DAYS">Last 30 Days</option>
              <option value="CUSTOM">Custom Range...</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === "table"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Table View
              </button>
              <button
                onClick={() => setViewMode("timeline")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === "timeline"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Timeline
              </button>
            </div>
          </div>
        </div>

        {/* Custom Date Range Picker inputs if CUSTOM is selected */}
        {dateFilter === "CUSTOM" && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 flex-wrap text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Custom Date Range:</span>
            <div className="flex items-center gap-1.5">
              <span>From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span>To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => {
                  setCustomStartDate("");
                  setCustomEndDate("");
                }}
                className="text-xs text-indigo-600 hover:underline"
              >
                Clear Dates
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content View: Table vs Timeline */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <History size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Audit Records Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {searchTerm || selectedAction !== "ALL" || selectedModule !== "ALL" || selectedUser !== "ALL" || dateFilter !== "ALL"
              ? "No operations match your active search or filter criteria. Try resetting the filters."
              : "State mutations (creating invoices, updating stock, deleting bills) will automatically appear here."}
          </p>
          {(searchTerm || selectedAction !== "ALL" || selectedModule !== "ALL" || selectedUser !== "ALL" || dateFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedAction("ALL");
                setSelectedModule("ALL");
                setSelectedUser("ALL");
                setDateFilter("ALL");
              }}
              className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-semibold hover:bg-indigo-100 transition-all"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Operator / User ID</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Module</th>
                  <th className="py-3.5 px-4">Target Entity</th>
                  <th className="py-3.5 px-4">Operation Description</th>
                  <th className="py-3.5 px-4 text-center">Changes</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const ActionIcon = badge.icon;
                  const hasChanges = log.changes && log.changes.length > 0;

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => setSelectedEntry(log)}
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800">
                            {new Date(log.timestamp).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: true,
                            })}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(log.timestamp).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                            {" • "}
                            {getRelativeTime(log.timestamp)}
                          </span>
                        </div>
                      </td>

                      {/* User Info */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                            {(log.userName || log.userId || "U").substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{log.userName || log.userId}</span>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                              <span>ID: {log.userId}</span>
                              {log.role && (
                                <span className="bg-slate-100 text-slate-600 px-1 py-0.2 rounded text-[9px]">
                                  {log.role}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Action Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono border ${badge.bg}`}
                        >
                          <ActionIcon size={12} />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Module */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-medium border border-slate-200">
                          {log.module}
                        </span>
                      </td>

                      {/* Entity */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800">{log.entityName || "—"}</span>
                          {log.entityId && (
                            <span className="text-[10px] text-slate-400 font-mono">ID: {log.entityId}</span>
                          )}
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                        <p className="text-slate-700 line-clamp-2 leading-relaxed">{log.description}</p>
                      </td>

                      {/* Changes Indicator */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {hasChanges ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
                            <Edit3 size={10} />
                            <span>{log.changes!.length} fields</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Details View Button */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEntry(log);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Inspect raw audit payload and field diffs"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing <strong className="text-slate-800">{filteredLogs.length}</strong> of{" "}
              <strong className="text-slate-800">{auditLogs.length}</strong> recorded audit operations
            </span>
            <span className="text-[11px] font-mono text-slate-400">Database Engine: Firestore + Local Cache</span>
          </div>
        </div>
      ) : (
        /* Timeline View */
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {filteredLogs.map((log) => {
              const badge = getActionBadge(log.action);
              const ActionIcon = badge.icon;

              return (
                <div key={log.id} className="relative group">
                  {/* Timeline bullet icon */}
                  <div
                    className={`absolute -left-6 top-1.5 w-6 h-6 rounded-full border-2 border-white shadow-2xs flex items-center justify-center text-white ${
                      log.action === "CREATE"
                        ? "bg-emerald-500"
                        : log.action === "UPDATE"
                        ? "bg-amber-500"
                        : log.action === "DELETE"
                        ? "bg-rose-500"
                        : "bg-indigo-500"
                    }`}
                  >
                    <ActionIcon size={12} className="stroke-[2.5]" />
                  </div>

                  {/* Card item */}
                  <div
                    onClick={() => setSelectedEntry(log)}
                    className="p-4 bg-slate-50/80 hover:bg-indigo-50/40 rounded-xl border border-slate-200/80 transition-all cursor-pointer space-y-2 hover:border-indigo-200"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                        <span className="bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                          {log.module}
                        </span>
                        {log.entityName && (
                          <span className="font-bold text-slate-900 text-xs">{log.entityName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                        <Clock size={12} />
                        <span>
                          {new Date(log.timestamp).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                        <span>•</span>
                        <span>{getRelativeTime(log.timestamp)}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed font-normal">{log.description}</p>

                    {/* Field Changes Pill List */}
                    {log.changes && log.changes.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 flex-wrap text-[11px]">
                        <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                          Modified:
                        </span>
                        {log.changes.map((ch, idx) => (
                          <span
                            key={idx}
                            className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[10px] font-mono text-slate-600"
                          >
                            {ch.label || ch.field}:{" "}
                            <span className="text-rose-600 line-through mr-1">
                              {typeof ch.oldValue === "object" ? "..." : String(ch.oldValue ?? "none")}
                            </span>
                            <span className="text-emerald-600 font-bold">
                              {typeof ch.newValue === "object" ? "..." : String(ch.newValue ?? "none")}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* User & IP Footer */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                      <div className="flex items-center gap-1">
                        <User size={11} />
                        <span>
                          Operator: <strong className="text-slate-700">{log.userName || log.userId}</strong> (
                          {log.userId})
                        </span>
                      </div>
                      {log.ipAddress && (
                        <div className="flex items-center gap-1">
                          <Laptop size={11} />
                          <span>IP: {log.ipAddress}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inspect Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Shield size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Audit Record Inspector</h3>
                  <p className="text-[11px] font-mono text-slate-400">ID: {selectedEntry.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Action Type</div>
                  <div className="mt-1 font-bold font-mono text-slate-800">{selectedEntry.action}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Module</div>
                  <div className="mt-1 font-bold text-slate-800">{selectedEntry.module}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Exact Timestamp</div>
                  <div className="mt-1 font-mono text-slate-800 text-[11px]">
                    {new Date(selectedEntry.timestamp).toLocaleString()}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Operator</div>
                  <div className="mt-1 font-bold text-slate-800">{selectedEntry.userName || "System"}</div>
                  <div className="text-[10px] font-mono text-slate-400">ID: {selectedEntry.userId}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Operator Role</div>
                  <div className="mt-1 font-semibold text-slate-800">{selectedEntry.role || "Administrator"}</div>
                  {selectedEntry.userEmail && (
                    <div className="text-[10px] text-slate-400 truncate">{selectedEntry.userEmail}</div>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Client IP / Origin</div>
                  <div className="mt-1 font-mono text-slate-800">{selectedEntry.ipAddress || "127.0.0.1"}</div>
                </div>
              </div>

              {/* Target Entity & Description */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Target Entity Details</div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{selectedEntry.entityName || "—"}</span>
                  {selectedEntry.entityId && (
                    <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono text-[10px]">
                      {selectedEntry.entityId}
                    </span>
                  )}
                </div>
                <p className="text-slate-700 font-normal leading-relaxed">{selectedEntry.description}</p>
              </div>

              {/* Field Changes Table if available */}
              {selectedEntry.changes && selectedEntry.changes.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Edit3 size={14} className="text-amber-500" />
                    <span>State Mutation Field Comparison</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100/70 text-[10px] font-bold text-slate-600 uppercase">
                          <th className="py-2 px-3">Field</th>
                          <th className="py-2 px-3">Previous State</th>
                          <th className="py-2 px-3">New State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedEntry.changes.map((ch, i) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-semibold text-slate-700">{ch.label || ch.field}</td>
                            <td className="py-2 px-3 text-rose-600 font-mono text-[11px] bg-rose-50/30">
                              {typeof ch.oldValue === "object"
                                ? JSON.stringify(ch.oldValue)
                                : String(ch.oldValue ?? "—")}
                            </td>
                            <td className="py-2 px-3 text-emerald-600 font-mono text-[11px] font-bold bg-emerald-50/30">
                              {typeof ch.newValue === "object"
                                ? JSON.stringify(ch.newValue)
                                : String(ch.newValue ?? "—")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Raw JSON viewer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Raw Audit Payload</span>
                  <button
                    onClick={() => handleCopyJSON(selectedEntry)}
                    className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-mono"
                  >
                    {copiedId === selectedEntry.id ? (
                      <>
                        <Check size={12} className="text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedEntry, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-700 transition-all cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Audit Memo Modal */}
      {showManualLogModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Plus size={18} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Record Administrative Audit Note</h3>
              </div>
              <button
                onClick={() => setShowManualLogModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddManualLog} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Module / Scope</label>
                <select
                  value={manualModule}
                  onChange={(e) => setManualModule(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="System Audit">System Audit & Governance</option>
                  <option value="Stock & Physical Verification">Stock & Physical Verification</option>
                  <option value="Tax Compliance & GSTR Review">Tax Compliance & GSTR Review</option>
                  <option value="Financial & Bank Reconciliation">Financial & Bank Reconciliation</option>
                  <option value="Customer Credit Assessment">Customer Credit Assessment</option>
                  <option value="Vendor Quality & Contract Review">Vendor Quality & Contract Review</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Action Type</label>
                <select
                  value={manualAction}
                  onChange={(e) => setManualAction(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="AUDIT_NOTE">Audit Note / Verification</option>
                  <option value="COMPLIANCE_CHECK">Compliance Check</option>
                  <option value="PHYSICAL_AUDIT">Physical Stock Audit</option>
                  <option value="POLICY_OVERRIDE">Policy Override Approval</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Entity / Reference</label>
                <input
                  type="text"
                  value={manualEntityName}
                  onChange={(e) => setManualEntityName(e.target.value)}
                  placeholder="e.g. Main Warehouse Bin 4, SBI Account 382910..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Audit Findings / Note Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="Describe physical count discrepancies, reconciliation checks, or authorized overrides..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-start gap-2 text-[11px] text-indigo-700">
                <Info size={14} className="shrink-0 mt-0.5" />
                <span>
                  This note will be permanently logged with your user ID (
                  <strong>{currentUserEmail || "Admin"}</strong>) and synced across the company ledger.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualLogModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-all shadow-xs"
                >
                  Save to Audit Trail
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto">
              <ShieldAlert size={24} />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Clear Entire Audit Trail?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                This will delete all <strong className="text-slate-800">{auditLogs.length}</strong> recorded audit entries
                from the active database. This action should only be taken when archiving historical records.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearLogs}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition-all shadow-xs cursor-pointer"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
