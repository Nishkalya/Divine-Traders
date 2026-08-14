import React, { useState, useMemo } from "react";
import { ERPState } from "../types";
import { formatINR, safeConfirm } from "../utils";
import { isWarehouseAllowed, getAllowedWarehouses } from "../utils/warehouseAuth";
import { 
  TrendingUp, 
  FileText, 
  BarChart3, 
  ShieldCheck, 
  Sparkles, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Sliders, 
  ArrowRight, 
  TrendingDown, 
  Percent, 
  Coins,
  User,
  Edit2,
  Check,
  X,
  Info,
  Calculator,
  CheckCircle2
} from "lucide-react";

interface ReportsViewProps {
  state: ERPState;
  currentUserEmail?: string;
  onUpdateState?: (newState: ERPState) => void;
}

interface ExpenseItem {
  id: string;
  category: string;
  description: string;
  amount: number;
}

export default function ReportsView({ state, currentUserEmail, onUpdateState }: ReportsViewProps) {
  const currentUser = useMemo(
    () => (state.teamMembers || []).find((m) => m.email.toLowerCase() === (currentUserEmail || "").toLowerCase()),
    [state.teamMembers, currentUserEmail]
  );
  const [activeReport, setActiveReport] = useState<"PL" | "StockVal" | "Model" | "Modules" | "AssigneeSales">("PL");

  // --- SALES REPRESENTATIVES DIRECTORY STATE ---
  const teamMemberNames = (state.teamMembers || [])
    .map((m) => m.name.replace(/\s*\(.*?\)/, "").trim())
    .filter(Boolean);

  const rawAssignees = state.salesAssignees && state.salesAssignees.length > 0
    ? state.salesAssignees
    : ["Vishal Kumar"];

  const assigneesList = Array.from(new Set([...rawAssignees, ...teamMemberNames]));

  const [newAssigneeName, setNewAssigneeName] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [selectedRepModalName, setSelectedRepModalName] = useState<string | null>(null);

  const handleAddAssignee = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newAssigneeName.trim();
    if (!name) {
      alert("Please enter a valid representative name.");
      return;
    }
    if (assigneesList.some(a => a.toLowerCase() === name.toLowerCase())) {
      alert("A representative with this name already exists.");
      return;
    }
    const updatedList = [...assigneesList, name];
    if (onUpdateState) {
      onUpdateState({
        ...state,
        salesAssignees: updatedList,
        salesAssigneeName: state.salesAssigneeName || name
      });
    }
    setNewAssigneeName("");
  };

  const handleSaveEditRepresentative = (index: number) => {
    const originalName = assigneesList[index];
    const newName = editingValue.trim();
    if (!newName) {
      alert("Name cannot be empty.");
      return;
    }
    if (assigneesList.some((a, idx) => idx !== index && a.toLowerCase() === newName.toLowerCase())) {
      alert("A representative with this name already exists.");
      return;
    }

    const updatedList = [...assigneesList];
    updatedList[index] = newName;

    const originalLower = originalName.trim().toLowerCase();
    const updatedTeamMembers = (state.teamMembers || []).map((m) => {
      if (m.name.replace(/\s*\(.*?\)/, "").trim().toLowerCase() === originalLower) {
        return { ...m, name: newName };
      }
      return m;
    });

    // Update attributed invoices to keep references consistent
    const updatedInvoices = state.saleInvoices.map((inv) => {
      const currentAssignee = inv.assignee || state.salesAssigneeName || "Vishal Kumar";
      if (currentAssignee.trim().toLowerCase() === originalLower) {
        return { ...inv, assignee: newName };
      }
      return inv;
    });

    if (onUpdateState) {
      onUpdateState({
        ...state,
        salesAssignees: updatedList,
        teamMembers: updatedTeamMembers,
        salesAssigneeName:
          state.salesAssigneeName?.trim().toLowerCase() === originalLower
            ? newName
            : state.salesAssigneeName || "Vishal Kumar",
        saleInvoices: updatedInvoices,
      });
    }
    setEditingIndex(null);
    setEditingValue("");
  };

  const handleDeleteRepresentative = (index: number) => {
    const name = assigneesList[index];
    if (!name) return;

    if (safeConfirm(`Are you sure you want to remove representative "${name}"?`)) {
      const nameLower = name.trim().toLowerCase();

      const updatedAssignees = assigneesList.filter((_, idx) => idx !== index);

      const updatedTeamMembers = (state.teamMembers || []).filter(
        (m) => m.name.replace(/\s*\(.*?\)/, "").trim().toLowerCase() !== nameLower
      );

      const nextAssigneeName =
        state.salesAssigneeName?.trim().toLowerCase() === nameLower
          ? updatedAssignees[0] || "Vishal Kumar"
          : state.salesAssigneeName || "Vishal Kumar";

      if (editingIndex === index) {
        setEditingIndex(null);
      }

      if (onUpdateState) {
        onUpdateState({
          ...state,
          salesAssignees: updatedAssignees,
          teamMembers: updatedTeamMembers,
          salesAssigneeName: nextAssigneeName,
        });
      }
    }
  };


  // --- DYNAMIC EXPENSES SYSTEM ---
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);

  const [newCategory, setNewCategory] = useState("Warehouse Rent");
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState<number>(0);

  // Add Expense
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAmount <= 0) {
      alert("Please specify an expense amount greater than ₹0.");
      return;
    }
    const id = "exp-" + Math.random().toString(36).substring(2, 9);
    setExpenses([
      ...expenses,
      { id, category: newCategory, description: newDesc.trim() || `${newCategory} expense line`, amount: newAmount }
    ]);
    setNewDesc("");
    setNewAmount(0);
  };

  // Delete Individual Expense
  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  // Clear All Expenses (Report screen clear)
  const handleClearExpenses = () => {
    if (safeConfirm("Are you sure you want to clear all indirect administrative expenses? Your overhead expenses will be wiped clean for the profit & loss statement.")) {
      setExpenses([]);
    }
  };

  // Filtered collections by warehouse permissions
  const authorizedInvoices = useMemo(
    () => state.saleInvoices.filter((inv) => isWarehouseAllowed(currentUser, inv.warehouseId)),
    [state.saleInvoices, currentUser]
  );

  const authorizedBills = useMemo(
    () => state.purchaseBills.filter((b) => isWarehouseAllowed(currentUser, b.warehouseId)),
    [state.purchaseBills, currentUser]
  );

  const allowedWarehouses = useMemo(
    () => getAllowedWarehouses(currentUser, state.warehouses),
    [currentUser, state.warehouses]
  );
  const allowedWhIds = useMemo(() => allowedWarehouses.map((w) => w.id), [allowedWarehouses]);

  // --- CALCULATE P&L ---
  // Revenue (Taxable Value of Sales excluding tax)
  const totalRevenue = authorizedInvoices
    .filter((inv) => inv.status !== "Draft")
    .reduce((sum, inv) => sum + inv.subtotal, 0);

  const getRepStats = (repName: string) => {
    const repInvoices = authorizedInvoices.filter((inv) => {
      if (inv.status === "Draft") return false;
      const currentAssignee = inv.assignee || state.salesAssigneeName || "Vishal Kumar";
      return currentAssignee.toLowerCase() === repName.toLowerCase();
    });
    const revenue = repInvoices.reduce((sum, inv) => sum + inv.subtotal, 0);
    const gross = repInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    return {
      count: repInvoices.length,
      revenue,
      gross
    };
  };

  // COGS (Items sold count * Standard Purchase Price)
  let totalCogs = 0;
  authorizedInvoices.forEach((inv) => {
    if (inv.status === "Draft") return;
    inv.items.forEach((line) => {
      const dbItem = state.items.find((i) => i.id === line.itemId);
      const purchasePrice = dbItem ? dbItem.purchasePrice : 0;
      totalCogs += line.quantity * purchasePrice;
    });
  });

  const grossProfit = totalRevenue - totalCogs;
  const totalIndirectExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit - totalIndirectExpenses;

  // --- CALCULATE STOCK VALUATION ---
  const stockItemsVal = state.items.map((item) => {
    let stockQty = item.stockQuantity;
    if (currentUser?.allowedWarehouseIds && currentUser.allowedWarehouseIds.length > 0) {
      stockQty = allowedWhIds.reduce((sum, whId) => sum + (item.warehouseStocks?.[whId] ?? 0), 0);
    }
    const valuation = stockQty * item.purchasePrice;
    return {
      ...item,
      stockQuantity: stockQty,
      valuation,
    };
  });

  const totalStockValuation = stockItemsVal.reduce((sum, item) => sum + item.valuation, 0);

  // --- CALCULATE GST FOR OPERATIONAL REPORT ---
  const totalSalesTaxCollected = authorizedInvoices
    .filter((inv) => inv.status !== "Draft")
    .reduce((sum, inv) => sum + (inv.cgst + inv.sgst + inv.igst), 0);
  const totalPurchaseITCRecouped = authorizedBills.reduce((sum, b) => sum + (b.cgst + b.sgst + b.igst), 0);
  const netGstPayable = totalSalesTaxCollected - totalPurchaseITCRecouped;

  // Category distributions for visual bars
  const categoryStats: Record<string, number> = {};
  state.items.forEach((i) => {
    categoryStats[i.category] = (categoryStats[i.category] || 0) + i.stockQuantity;
  });

  const maxStock = Math.max(...Object.values(categoryStats), 1);

  // --- INTERACTIVE FORECASTING / SIMULATION MODEL ("New Model") ---
  const [selectedPreset, setSelectedPreset] = useState<"Custom" | "Baseline" | "Aggressive" | "Volatile">("Baseline");
  const [salesGrowth, setSalesGrowth] = useState<number>(0); // % change
  const [costChange, setCostChange] = useState<number>(0);     // % change
  const [overheadFactor, setOverheadFactor] = useState<number>(0); // % change

  const handleApplyPreset = (preset: "Baseline" | "Aggressive" | "Volatile") => {
    setSelectedPreset(preset);
    if (preset === "Baseline") {
      setSalesGrowth(0);
      setCostChange(0);
      setOverheadFactor(0);
    } else if (preset === "Aggressive") {
      setSalesGrowth(50);
      setCostChange(-5);
      setOverheadFactor(15);
    } else if (preset === "Volatile") {
      setSalesGrowth(-15);
      setCostChange(30);
      setOverheadFactor(40);
    }
  };

  // Projected Calculations
  const projectedRevenue = totalRevenue * (1 + salesGrowth / 100);
  const projectedCogs = totalCogs * (1 + costChange / 100) * (1 + salesGrowth / 100);
  const projectedGrossProfit = projectedRevenue - projectedCogs;
  const projectedOverhead = totalIndirectExpenses * (1 + overheadFactor / 100);
  const projectedNetProfit = projectedGrossProfit - projectedOverhead;

  // Clear Model Settings
  const handleClearModel = () => {
    setSalesGrowth(0);
    setCostChange(0);
    setOverheadFactor(0);
    setSelectedPreset("Baseline");
  };

  const handleMasterClearReports = () => {
    setExpenses([]);
    setSalesGrowth(0);
    setCostChange(0);
    setOverheadFactor(0);
    setSelectedPreset("Baseline");
  };

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
            <span>Divine Intelligence</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-bold">Ledger Analytics</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Financial &amp; Stock Intelligence</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-xl text-xs font-semibold gap-1.5 border border-slate-200">
            <button
              id="btn-report-pl"
              onClick={() => setActiveReport("PL")}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeReport === "PL" ? "bg-[#002f1d] text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <TrendingUp size={14} /> Profit &amp; Loss
            </button>
            <button
              id="btn-report-stock"
              onClick={() => setActiveReport("StockVal")}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeReport === "StockVal" ? "bg-[#002f1d] text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <BarChart3 size={14} /> Stock Valuation
            </button>
            <button
              id="btn-report-model"
              onClick={() => setActiveReport("Model")}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeReport === "Model" ? "bg-[#002f1d] text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Sparkles size={14} className="text-amber-500" /> Dynamic Projection Model
            </button>
            <button
              id="btn-report-modules"
              onClick={() => setActiveReport("Modules")}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeReport === "Modules" ? "bg-[#002f1d] text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Sliders size={14} /> Operational Modules Report
            </button>
            <button
              id="btn-report-assignee"
              onClick={() => setActiveReport("AssigneeSales")}
              className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeReport === "AssigneeSales" ? "bg-[#002f1d] text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <User size={14} /> Assignee Sales Income
            </button>
          </div>
        </div>
      </div>

      {/* PROFIT & LOSS STATEMENT WITH INTEGRATED DYNAMIC EXPENSES */}
      {activeReport === "PL" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Statement */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-indigo-600" size={18} />
                Trading Profit &amp; Loss Statement (YTD)
              </h3>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                Dynamic Overhead Enabled
              </span>
            </div>

            <div className="space-y-4 text-sm">
              {/* Revenue */}
              <div className="space-y-2">
                <div className="flex justify-between font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                  <span>Revenues (Incomes)</span>
                  <span>Amount (₹)</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-700">
                  <span>Wholesale Trade Sales (Excl. Tax)</span>
                  <span className="font-mono font-bold">{formatINR(totalRevenue)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-dashed pt-2 text-indigo-700 text-sm">
                  <span>Total Revenue (A)</span>
                  <span className="font-mono">{formatINR(totalRevenue)}</span>
                </div>
              </div>

              {/* COGS */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <div className="flex justify-between font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                  <span>Direct Cost of Goods Sold (COGS)</span>
                  <span>Amount (₹)</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-700">
                  <span>Procurement cost of sold grain bags</span>
                  <span className="font-mono font-bold">{formatINR(totalCogs)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-dashed pt-2 text-rose-600 text-sm">
                  <span>Total Cost of Sales (B)</span>
                  <span className="font-mono">{formatINR(totalCogs)}</span>
                </div>
              </div>

              {/* Gross Margin */}
              <div className="bg-slate-50 p-4 rounded-2xl flex justify-between font-extrabold text-slate-800 text-sm border border-slate-100">
                <span>Gross Trading Margin (A - B)</span>
                <span className={`font-mono ${grossProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatINR(grossProfit)}
                </span>
              </div>

              {/* Dynamic Indirect Expenses */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <div className="flex justify-between font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                  <span>Indirect Administrative &amp; Operating Expenses</span>
                  <span>Amount (₹)</span>
                </div>
                {expenses.length === 0 ? (
                  <div className="pl-4 text-xs italic text-slate-400 py-1">
                    No active indirect operating overheads recorded.
                  </div>
                ) : (
                  <div className="space-y-1.5 pl-4">
                    {expenses.map((exp) => (
                      <div key={exp.id} className="flex justify-between text-slate-700 items-center group">
                        <div className="flex-1">
                          <span className="font-semibold text-xs text-slate-800 block">{exp.category}</span>
                          <span className="text-[10px] text-slate-400">{exp.description}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold">{formatINR(exp.amount)}</span>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1 text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete this expense"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between font-bold border-t border-dashed pt-2 text-rose-600 text-sm">
                  <span>Total Operating Expenses (C)</span>
                  <span className="font-mono">{formatINR(totalIndirectExpenses)}</span>
                </div>
              </div>

              {/* Net Margin - Dark Bento Block Style */}
              <div className="bg-[#002f1d] text-white p-5 rounded-2xl border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-xs uppercase tracking-widest text-emerald-300 font-bold block">Final Bottomline</span>
                  <span className="font-bold text-slate-100 text-sm mt-0.5 block">Net Operating Profit (A - B - C)</span>
                </div>
                <span className={`font-mono text-xl font-black ${netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatINR(netProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Expenses Management & Input Form */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Overhead Control</h4>
                <button
                  onClick={handleClearExpenses}
                  className="text-[10px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 transition-colors border border-rose-100 bg-rose-50 px-2 py-1 rounded"
                >
                  <Trash2 size={11} /> Clear Slate
                </button>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Add, remove, or clear custom indirect operating costs (e.g., storage rentals, personnel wages) to simulate real business overheads dynamically.
              </p>

              <form onSubmit={handleAddExpense} className="space-y-3 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Expense Type</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full text-xs font-semibold rounded border p-2 bg-white"
                  >
                    <option value="Warehouse Rent">Warehouse Rent</option>
                    <option value="Utilities & Grid">Utilities & Grid</option>
                    <option value="Staff Wages">Staff Wages</option>
                    <option value="Logistics & Transport">Logistics & Transport</option>
                    <option value="Equipment Repair">Equipment Repair</option>
                    <option value="Finance & Taxes">Finance & Taxes</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Short Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. generator fuel recharge"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full text-xs rounded border p-2 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₹)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2.5 text-xs text-slate-400 font-mono">₹</span>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="0.00"
                      value={newAmount || ""}
                      onChange={(e) => setNewAmount(parseInt(e.target.value) || 0)}
                      className="w-full text-xs rounded border p-2 pl-6 bg-white font-mono font-bold"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#002f1d] hover:bg-[#00472c] text-white text-xs font-bold rounded flex items-center justify-center gap-1 transition-colors"
                >
                  <Plus size={13} /> Add Operating Expense
                </button>
              </form>
            </div>

            {/* Visual Category Distribution */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider border-b pb-2">Physical Stock Mix</h4>
              <p className="text-xs text-slate-400">Inventory balance split by product categories (total units):</p>
              <div className="space-y-3.5">
                {Object.entries(categoryStats).map(([cat, qty]) => {
                  const percent = (qty / maxStock) * 100;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                        <span>{cat}</span>
                        <span className="font-mono font-bold">{qty} Units</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className="bg-[#002f1d] h-full rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STOCK VALUATION REPORT */}
      {activeReport === "StockVal" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="text-[#002f1d]" size={18} />
              Stock Valuation Asset Balance Sheet
            </h3>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Warehouse Asset Value</p>
              <p className="text-2xl font-black text-[#002f1d] font-mono tracking-tight">{formatINR(totalStockValuation)}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">SKU Code</th>
                  <th className="p-3">Item Description</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Standard Cost Price (₹)</th>
                  <th className="p-3 text-center">Available Stock Qty</th>
                  <th className="p-3 text-right">Asset Valuation Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {stockItemsVal.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold font-mono text-[#002f1d]">{item.code}</td>
                    <td className="p-3 font-semibold text-slate-800">{item.name}</td>
                    <td className="p-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60 font-medium">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-700">{formatINR(item.purchasePrice)}</td>
                    <td className="p-3 text-center font-bold text-slate-800 font-mono">
                      {item.stockQuantity} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-700 font-mono">
                      {formatINR(item.valuation)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DYNAMIC PROJECTION MODEL ("started new model") */}
      {activeReport === "Model" && (
        <div className="space-y-6">
          {/* Preset Model Selection Row */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Sparkles className="text-amber-500" size={16} /> Choose Simulation Preset Model
                </h3>
                <p className="text-xs text-slate-400">Select an analytics preset or manually adjust variables using the control board below.</p>
              </div>
              <button
                onClick={handleClearModel}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded flex items-center gap-1 transition-colors cursor-pointer self-start md:self-auto"
              >
                <RotateCcw size={12} /> Clear Simulation Settings
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div 
                onClick={() => handleApplyPreset("Baseline")}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedPreset === "Baseline" 
                    ? "bg-slate-900 border-slate-900 text-white" 
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800"
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wider block mb-1">Baseline Model</span>
                <p className="text-[11px] opacity-80 leading-relaxed">Runs projection using current YTD performance, zero inflation, and static demand margins.</p>
              </div>

              <div 
                onClick={() => handleApplyPreset("Aggressive")}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedPreset === "Aggressive" 
                    ? "bg-slate-900 border-slate-900 text-white" 
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800"
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wider block mb-1 text-emerald-400 flex items-center gap-1">
                  🚀 Aggressive Scale-Up
                </span>
                <p className="text-[11px] opacity-80 leading-relaxed">Simulates 50% sales demand growth, optimized 5% supply-cost discount, and modest wages increase.</p>
              </div>

              <div 
                onClick={() => handleApplyPreset("Volatile")}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedPreset === "Volatile" 
                    ? "bg-slate-900 border-slate-900 text-white" 
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800"
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wider block mb-1 text-rose-400 flex items-center gap-1">
                  ⚠️ Volatile Costs Spike
                </span>
                <p className="text-[11px] opacity-80 leading-relaxed">Simulates market slowdown (15% drop in sales volume), 30% procurement cost spike, and 40% wage overhead inflation.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Control Sliders Panel */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                <Sliders className="text-[#002f1d]" size={15} /> Projection Variable Board
              </h3>

              {/* Slider 1 */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">Projected Sales Demand</span>
                  <span className={`font-mono font-bold ${salesGrowth >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {salesGrowth > 0 ? `+${salesGrowth}%` : `${salesGrowth}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="150"
                  step="5"
                  value={salesGrowth}
                  onChange={(e) => {
                    setSalesGrowth(parseInt(e.target.value));
                    setSelectedPreset("Custom");
                  }}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#002f1d]"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>-50% Recession</span>
                  <span>Steady</span>
                  <span>+150% Supergrowth</span>
                </div>
              </div>

              {/* Slider 2 */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">Procurement Cost Shift</span>
                  <span className={`font-mono font-bold ${costChange > 0 ? "text-rose-600" : costChange < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                    {costChange > 0 ? `+${costChange}%` : `${costChange}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="50"
                  step="5"
                  value={costChange}
                  onChange={(e) => {
                    setCostChange(parseInt(e.target.value));
                    setSelectedPreset("Custom");
                  }}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#002f1d]"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>-30% Wholesale Discount</span>
                  <span>Steady</span>
                  <span>+50% Supply Spike</span>
                </div>
              </div>

              {/* Slider 3 */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">Operating Overhead Delta</span>
                  <span className={`font-mono font-bold ${overheadFactor > 0 ? "text-rose-600" : overheadFactor < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                    {overheadFactor > 0 ? `+${overheadFactor}%` : `${overheadFactor}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="200"
                  step="10"
                  value={overheadFactor}
                  onChange={(e) => {
                    setOverheadFactor(parseInt(e.target.value));
                    setSelectedPreset("Custom");
                  }}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#002f1d]"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Wiped clean (-100%)</span>
                  <span>Steady</span>
                  <span>+200% High Inflation</span>
                </div>
              </div>

              <div className="p-3.5 bg-[#002f1d]/5 border border-[#002f1d]/10 rounded-2xl text-[11px] text-slate-600 space-y-1.5">
                <span className="font-bold text-[#002f1d] uppercase block text-[10px] tracking-wide">Model Formulation Logic</span>
                <p className="leading-relaxed">
                  Projected revenue scales direct sales volume. direct purchase cost (COGS) recalculates on crop inflation shift, balancing simulated profit yields.
                </p>
              </div>
            </div>

            {/* Results Bench Panel */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                <Percent className="text-amber-500" size={15} /> Forecast Output Bench
              </h3>

              {/* Side by side comparison indicators */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Revenue compare card */}
                <div className="bg-slate-50 border p-4 rounded-2xl flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimated Gross Revenue</span>
                    <span className="text-xl font-black font-mono text-slate-800 block mt-1">
                      {formatINR(projectedRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] pt-2 border-t text-slate-500">
                    <span>Actual YTD: {formatINR(totalRevenue)}</span>
                    <span className={`font-bold font-mono ${salesGrowth >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {salesGrowth >= 0 ? `+${salesGrowth}%` : `${salesGrowth}%`}
                    </span>
                  </div>
                </div>

                {/* Net Profit compare card */}
                <div className={`border p-4 rounded-2xl flex flex-col justify-between space-y-3 transition-colors ${
                  projectedNetProfit >= 0 ? "bg-emerald-50/20 border-emerald-100" : "bg-rose-50/20 border-rose-100"
                }`}>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Projected Net Operating Profit</span>
                    <span className={`text-xl font-black font-mono block mt-1 ${
                      projectedNetProfit >= 0 ? "text-emerald-800" : "text-rose-800"
                    }`}>
                      {formatINR(projectedNetProfit)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] pt-2 border-t text-slate-500">
                    <span>Actual YTD: {formatINR(netProfit)}</span>
                    <span className={`font-bold font-mono ${projectedNetProfit >= netProfit ? "text-emerald-700" : "text-rose-700"}`}>
                      {netProfit === 0 ? "N/A" : `${(((projectedNetProfit - netProfit) / Math.abs(netProfit || 1)) * 100).toFixed(0)}% delta`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Visual CSS-based Progress Bars comparing Actual vs Projected */}
              <div className="space-y-4 pt-2">
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wide">Actuals vs. Simulation Target Comparisons</h4>
                
                {/* Revenue compare bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Gross Revenue Index</span>
                    <span className="font-mono">
                      YTD Actual: <span className="font-bold text-slate-800">{formatINR(totalRevenue)}</span> vs Sim: <span className="font-bold text-indigo-700">{formatINR(projectedRevenue)}</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full flex overflow-hidden">
                    <div className="bg-indigo-600 h-full transition-all" style={{ width: "45%" }} title="YTD Actual Baseline" />
                    <div className={`h-full transition-all ${salesGrowth >= 0 ? "bg-emerald-500" : "bg-rose-400"}`} style={{ width: `${Math.max(5, Math.min(55, Math.abs(salesGrowth)))}%` }} title="Projected Variance Delta" />
                  </div>
                </div>

                {/* Net Profit compare bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Net Operating Profit Index</span>
                    <span className="font-mono">
                      YTD Actual: <span className="font-bold text-slate-800">{formatINR(netProfit)}</span> vs Sim: <span className={`font-bold ${projectedNetProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatINR(projectedNetProfit)}</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full flex overflow-hidden">
                    <div className="bg-slate-800 h-full transition-all" style={{ width: "45%" }} title="YTD Actual Net Margin" />
                    <div className={`h-full transition-all ${projectedNetProfit >= netProfit ? "bg-emerald-400" : "bg-rose-500"}`} style={{ width: `${Math.max(5, Math.min(55, Math.abs(projectedNetProfit - netProfit) / Math.max(1, Math.abs(netProfit)) * 30))}%` }} title="Projected Net Margin Change" />
                  </div>
                </div>
              </div>

              {/* Smart Recommendations generated dynamically based on values */}
              <div className="border-t pt-4">
                <span className="text-[10px] font-bold text-[#002f1d] uppercase tracking-widest block mb-2 flex items-center gap-1">
                  💡 Actionable Model Diagnostics
                </span>
                <div className="p-4 bg-[#002f1d]/5 rounded-2xl space-y-2 text-xs text-slate-700">
                  {projectedNetProfit < 0 ? (
                    <p className="leading-relaxed font-medium text-rose-800">
                      ⚠️ <strong className="font-extrabold text-rose-950">Overhead Deficit Warning:</strong> Under your simulated parameters, the business faces dynamic operating losses of <strong className="font-mono text-sm">{formatINR(Math.abs(projectedNetProfit))}</strong>. We highly advise either reducing warehouse operating costs (currently ₹{projectedOverhead.toLocaleString()}) or raising standard wholesale sale prices to absorb direct grain cost spikes.
                    </p>
                  ) : projectedNetProfit > netProfit ? (
                    <p className="leading-relaxed font-medium text-emerald-800">
                      🚀 <strong className="font-extrabold text-emerald-950">Profit Yield Expansion Detected:</strong> Projected operating profits expand to <strong className="font-mono text-sm">{formatINR(projectedNetProfit)}</strong>. High sales demand and wholesale margin savings provide an optimal runway to procure extra grain stock buffer and secure long-term client commitments.
                    </p>
                  ) : (
                    <p className="leading-relaxed font-medium text-slate-700">
                      ℹ️ <strong className="font-extrabold text-slate-900">Steady State Profile:</strong> Projected business performance remains stable. Minor changes are simulated with net margins tracking at {((projectedNetProfit / (projectedRevenue || 1)) * 100).toFixed(1)}%. Maintain existing buffer stock levels and follow present trading schedules.
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 leading-relaxed italic pt-1 border-t">
                    Note: Projections are computed based on double-entry book assets, invoice records, and active overhead expenses lists. Keep variables updated to maintain maximum forecasting fidelity.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ALL OPERATIONAL MODULES ANALYSIS REPORT */}
      {activeReport === "Modules" && (
        <div className="space-y-6">
          <div className="bg-[#002f1d] text-white p-6 rounded-3xl space-y-2 relative overflow-hidden shadow-sm">
            <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-emerald-950/40 blur-3xl pointer-events-none" />
            <span className="text-[10px] bg-emerald-800 text-emerald-100 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Cross-Module Intelligence Audit
            </span>
            <h3 className="text-2xl font-black tracking-tight">ERP Module Performance Directory</h3>
            <p className="text-emerald-100 text-xs max-w-2xl leading-relaxed">
              Consolidated real-time analytics auditing transactional indices, inventory registers, and ledger activity balances across all operational workflows in Divine Traders.
            </p>
          </div>

          {/* Grid of All 9 Modules */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. Sales & Receivables Module */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-bold text-xs text-slate-400 uppercase tracking-wider">1. Sales &amp; Receivables</span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                    {state.saleInvoices.filter(i => i.status !== "Draft").length} Posted
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total Turn-over (Gross):</span>
                    <strong className="font-mono text-slate-800">{formatINR(state.saleInvoices.filter(i => i.status !== "Draft").reduce((sum, inv) => sum + inv.totalAmount, 0))}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Taxable Subtotal:</span>
                    <strong className="font-mono text-slate-800">{formatINR(state.saleInvoices.filter(i => i.status !== "Draft").reduce((sum, inv) => sum + inv.subtotal, 0))}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">GST Collected:</span>
                    <strong className="font-mono text-indigo-700">{formatINR(state.saleInvoices.filter(i => i.status !== "Draft").reduce((sum, inv) => sum + (inv.cgst + inv.sgst + inv.igst), 0))}</strong>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                <span>Posted: {state.saleInvoices.filter(i => i.status === "Posted").length}</span>
                <span>Draft Invoices: {state.saleInvoices.filter(i => i.status === "Draft").length}</span>
              </div>
            </div>

            {/* 2. Purchase Orders Module */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-bold text-xs text-slate-400 uppercase tracking-wider">2. Purchase Orders (PO)</span>
                  <span className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-bold">
                    {state.purchaseOrders.length} POs
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total Ordered Value:</span>
                    <strong className="font-mono text-slate-800">{formatINR(state.purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0))}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Approved POs Value:</span>
                    <strong className="font-mono text-emerald-700">{formatINR(state.purchaseOrders.filter(p => p.status === "Approved" || p.status === "Received" || p.status === "Partially Received").reduce((sum, po) => sum + po.totalAmount, 0))}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Draft POs Count:</span>
                    <strong className="font-mono text-amber-700">{state.purchaseOrders.filter(p => p.status === "Draft").length} orders</strong>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                <span>Received: {state.purchaseOrders.filter(p => p.status === "Received").length}</span>
                <span>Partially Recd: {state.purchaseOrders.filter(p => p.status === "Partially Received").length}</span>
              </div>
            </div>

            {/* 3. Goods Receipts (GRN) Module */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-bold text-xs text-slate-400 uppercase tracking-wider">3. Goods Receipts (GRN)</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                    {state.goodsReceipts.length} GRNs
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total Inbound Deliveries:</span>
                    <strong className="text-slate-800 font-bold">{state.goodsReceipts.length} receipts</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total Items Checked In:</span>
                    <strong className="font-mono text-slate-800">
                      {state.goodsReceipts.reduce((sum, grn) => sum + grn.items.reduce((itemSum, item) => itemSum + (item.quantityReceived || 0), 0), 0).toLocaleString()} bags
                    </strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">PO Mapping Ratio:</span>
                    <strong className="text-emerald-700 font-bold">
                      {state.goodsReceipts.length > 0 ? `${Math.round((state.goodsReceipts.filter(g => g.purchaseOrderId).length / state.goodsReceipts.length) * 100)}%` : "0%"}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                <span>Verified: {state.goodsReceipts.length}</span>
                <span>Receiver Signatures: Active</span>
              </div>
            </div>

            {/* 4. Purchase Bills & Payables */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-bold text-xs text-slate-400 uppercase tracking-wider">4. Purchase Bills &amp; Payables</span>
                  <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold">
                    {state.purchaseBills.length} Bills
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total Bill Liabilities:</span>
                    <strong className="font-mono text-slate-800">{formatINR(state.purchaseBills.reduce((sum, b) => sum + b.totalAmount, 0))}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Outstanding Payables:</span>
                    <strong className="font-mono text-rose-600">{formatINR(state.purchaseBills.reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0))}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Input Tax Credit (ITC Asset):</span>
                    <strong className="font-mono text-emerald-700">{formatINR(state.purchaseBills.reduce((sum, b) => sum + (b.cgst + b.sgst + b.igst), 0))}</strong>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                <span>Paid: {state.purchaseBills.filter(b => b.status === "Paid").length}</span>
                <span>Partially / Unpaid: {state.purchaseBills.filter(b => b.status !== "Paid").length}</span>
              </div>
            </div>

            {/* 5. Purchase Returns */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-bold text-xs text-slate-400 uppercase tracking-wider">5. Purchase Returns (Debit Notes)</span>
                  <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                    {(state.purchaseReturns || []).length} Debit Notes
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total Returned value:</span>
                    <strong className="font-mono text-slate-800">{formatINR((state.purchaseReturns || []).reduce((sum, r) => sum + r.totalAmount, 0))}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Tax Reversed Value:</span>
                    <strong className="font-mono text-amber-700">{formatINR((state.purchaseReturns || []).reduce((sum, r) => sum + (r.cgst + r.sgst + r.igst), 0))}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Returned item lines:</span>
                    <strong className="text-slate-800 font-bold">{(state.purchaseReturns || []).reduce((sum, r) => sum + r.items.length, 0)} lines</strong>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                <span>Linked Bills: {(state.purchaseReturns || []).filter(r => r.purchaseBillId).length}</span>
                <span>Linked POs: {(state.purchaseReturns || []).filter(r => r.purchaseOrderId).length}</span>
              </div>
            </div>

            {/* 6. Payments Module */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-bold text-xs text-slate-400 uppercase tracking-wider">6. Payments Module</span>
                  <span className="text-[10px] bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full font-bold">
                    {(state.payments || []).length} Entries
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total Disbursements (to Vendors):</span>
                    <strong className="font-mono text-rose-600">{formatINR((state.payments || []).reduce((sum, p) => sum + p.amount, 0))}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Average Per Transaction:</span>
                    <strong className="font-mono text-slate-800">
                      {state.payments.length > 0 ? formatINR(Math.round(state.payments.reduce((sum, p) => sum + p.amount, 0) / state.payments.length)) : "N/A"}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                <span>Bank Transfer: {(state.payments || []).filter(p => p.paymentMethod === "Bank Transfer").length}</span>
                <span>Cash/UPI/Cheque: {(state.payments || []).filter(p => p.paymentMethod !== "Bank Transfer").length}</span>
              </div>
            </div>

            {/* 7. Items Stock Module */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-bold text-xs text-slate-400 uppercase tracking-wider">7. Stock &amp; Catalog</span>
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                    {state.items.length} SKUs
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total In-Stock Bags:</span>
                    <strong className="font-mono text-slate-800">{state.items.reduce((sum, i) => sum + i.stockQuantity, 0).toLocaleString()} bags</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total Asset Valuation:</span>
                    <strong className="font-mono text-[#002f1d]">{formatINR(state.items.reduce((sum, i) => sum + (i.stockQuantity * i.purchasePrice), 0))}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Low Stock Reorder Alerts:</span>
                    <strong className={`font-mono ${state.items.filter(i => i.stockQuantity < i.minStockLevel).length > 0 ? "text-amber-600 font-bold" : "text-slate-500"}`}>
                      {state.items.filter(i => i.stockQuantity < i.minStockLevel).length} alerts
                    </strong>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                <span>Categories: {Object.keys(categoryStats).length} groups</span>
                <span>Zero-stock lines: {state.items.filter(i => i.stockQuantity === 0).length}</span>
              </div>
            </div>

            {/* 8. Parties Directory */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-bold text-xs text-slate-400 uppercase tracking-wider">8. Parties Registry</span>
                  <span className="text-[10px] bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full font-bold">
                    {state.parties.length} Contacts
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Wholesale Customers:</span>
                    <strong className="text-slate-800 font-bold">{state.parties.filter(p => p.type === "Customer" || p.type === "Both").length} buyers</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Procurement Vendors:</span>
                    <strong className="text-slate-800 font-bold">{state.parties.filter(p => p.type === "Vendor" || p.type === "Both").length} suppliers</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Dual-capacity entities:</span>
                    <strong className="text-slate-800 font-bold">{state.parties.filter(p => p.type === "Both").length} accounts</strong>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                <span>Opening Balance Sum: {formatINR(state.parties.reduce((sum, p) => sum + (p.openingBalance || 0), 0))}</span>
              </div>
            </div>

            {/* 9. GST & Tax Compliance */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-bold text-xs text-slate-400 uppercase tracking-wider">9. GST &amp; Compliance</span>
                  <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-bold">
                    Net GST
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">GSTR-1 (Output Liability):</span>
                    <strong className="font-mono text-rose-600">{formatINR(totalSalesTaxCollected)}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">GSTR-2 (Input ITC Asset):</span>
                    <strong className="font-mono text-emerald-700">{formatINR(totalPurchaseITCRecouped)}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Cash GST Payable:</span>
                    <strong className={`font-mono ${netGstPayable >= 0 ? "text-indigo-800 font-bold" : "text-emerald-700 font-bold"}`}>
                      {formatINR(Math.abs(netGstPayable))} {netGstPayable >= 0 ? "Payable" : "ITC Asset"}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                <span>Non-GST Sales: {state.saleInvoices.filter(i => i.cgst === 0 && i.sgst === 0 && i.igst === 0).length} bills</span>
                <span>Non-GST Purc: {state.purchaseBills.filter(b => b.invoiceType === "NON_GST").length} bills</span>
              </div>
            </div>

          </div>

          {/* Module-by-Module Operational Ledger Section */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <h4 className="text-base font-extrabold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <FileText className="text-emerald-800" size={16} />
              Cross-Module Operational Ledger Logs
            </h4>

            <div className="space-y-6">
              {/* Sales Invoice Log Section */}
              <div className="space-y-2">
                <h5 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                  <span>Sales &amp; Customer Billing Log (Last 3 Invoices)</span>
                  <span className="text-[10px] text-slate-400 normal-case">Operational Module 1</span>
                </h5>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                        <th className="p-2.5 font-semibold">Invoice No</th>
                        <th className="p-2.5 font-semibold">Customer</th>
                        <th className="p-2.5 font-semibold">Date</th>
                        <th className="p-2.5 font-semibold text-right">Taxable</th>
                        <th className="p-2.5 font-semibold text-right">Total (INR)</th>
                        <th className="p-2.5 font-semibold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {state.saleInvoices.slice(-3).reverse().map(inv => {
                        const party = state.parties.find(p => p.id === inv.customerId);
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">{inv.invoiceNumber}</td>
                            <td className="p-2.5 text-slate-600 truncate max-w-[120px]">{party?.name || "Unknown Party"}</td>
                            <td className="p-2.5 text-slate-500">{inv.date}</td>
                            <td className="p-2.5 text-right font-mono text-slate-600">{formatINR(inv.subtotal)}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-800">{formatINR(inv.totalAmount)}</td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                inv.status === "Posted" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                              }`}>{inv.status}</span>
                            </td>
                          </tr>
                        );
                      })}
                      {state.saleInvoices.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-400 italic">No wholesale sales recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Purchase Bills & Payables Log Section */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <h5 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                  <span>Vendor Purchase Bills Log (Last 3 Bills)</span>
                  <span className="text-[10px] text-slate-400 normal-case">Operational Module 4</span>
                </h5>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                        <th className="p-2.5 font-semibold">Bill No</th>
                        <th className="p-2.5 font-semibold">Vendor</th>
                        <th className="p-2.5 font-semibold">Date</th>
                        <th className="p-2.5 font-semibold text-right">Taxable</th>
                        <th className="p-2.5 font-semibold text-right">Total (INR)</th>
                        <th className="p-2.5 font-semibold text-center">Type</th>
                        <th className="p-2.5 font-semibold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {state.purchaseBills.slice(-3).reverse().map(bill => {
                        const party = state.parties.find(p => p.id === bill.vendorId);
                        return (
                          <tr key={bill.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">{bill.billNumber}</td>
                            <td className="p-2.5 text-slate-600 truncate max-w-[120px]">{party?.name || "Unknown Vendor"}</td>
                            <td className="p-2.5 text-slate-500">{bill.date}</td>
                            <td className="p-2.5 text-right font-mono text-slate-600">{formatINR(bill.subtotal)}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-800">{formatINR(bill.totalAmount)}</td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                bill.invoiceType === "NON_GST" ? "bg-slate-100 text-slate-700" : "bg-indigo-50 text-indigo-700"
                              }`}>{bill.invoiceType || "GST"}</span>
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                bill.status === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                              }`}>{bill.status}</span>
                            </td>
                          </tr>
                        );
                      })}
                      {state.purchaseBills.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400 italic">No purchase bills/invoices recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Purchase Returns Log Section */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <h5 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                  <span>Vendor Returns &amp; Debit Notes Log (Last 2 Debit Notes)</span>
                  <span className="text-[10px] text-slate-400 normal-case">Operational Module 5</span>
                </h5>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                        <th className="p-2.5 font-semibold">Return No</th>
                        <th className="p-2.5 font-semibold">Vendor</th>
                        <th className="p-2.5 font-semibold">Date</th>
                        <th className="p-2.5 font-semibold text-right">Items Returned</th>
                        <th className="p-2.5 font-semibold text-right">Total Amount (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(state.purchaseReturns || []).slice(-2).reverse().map(ret => {
                        const party = state.parties.find(p => p.id === ret.vendorId);
                        return (
                          <tr key={ret.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">{ret.returnNumber}</td>
                            <td className="p-2.5 text-slate-600 truncate max-w-[120px]">{party?.name || "Unknown Vendor"}</td>
                            <td className="p-2.5 text-slate-500">{ret.date}</td>
                            <td className="p-2.5 text-right text-slate-600">{ret.items.length} lines</td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-800">{formatINR(ret.totalAmount)}</td>
                          </tr>
                        );
                      })}
                      {(state.purchaseReturns || []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 italic">No debit notes or vendor returns logged.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeReport === "AssigneeSales" && (
        <div className="space-y-6 animate-fade-in">
          {/* Form and info in one row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* 1. Directory & Add Form */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <User size={16} className="text-[#002f1d]" />
                      Sales Representatives Directory
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Manage company sales representatives and monitor their individual revenue contributions.
                    </p>
                  </div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-full font-bold">
                    {assigneesList.length} Active Reps
                  </span>
                </div>

                {/* Inline "Add" Form */}
                <form onSubmit={handleAddAssignee} className="flex items-center gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 w-full flex-wrap sm:flex-nowrap">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-tight whitespace-nowrap flex items-center gap-1">
                    <User size={13} className="text-[#002f1d]" />
                    Add Representative:
                  </span>
                  <input
                    type="text"
                    value={newAssigneeName}
                    onChange={(e) => setNewAssigneeName(e.target.value)}
                    placeholder="Enter full name (e.g., Anjali Mehta)"
                    required
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#002f1d] flex-1 min-w-[150px]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#002f1d] hover:bg-[#00472c] text-white rounded-lg text-xs font-bold transition-all shadow-3xs cursor-pointer whitespace-nowrap"
                  >
                    + Add Representative
                  </button>
                </form>

                {/* Directory Table with inline edit */}
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                        <th className="p-3 font-semibold">Representative Name</th>
                        <th className="p-3 font-semibold text-center">Invoices</th>
                        <th className="p-3 font-semibold text-right">Credited Income (INR)</th>
                        <th className="p-3 font-semibold text-center">Share</th>
                        <th className="p-3 font-semibold text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assigneesList.map((name, idx) => {
                        const stats = getRepStats(name);
                        const sharePercent = totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0;
                        const isEditing = editingIndex === idx;

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3">
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    className="px-2 py-1 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-800 focus:outline-hidden focus:border-[#002f1d] w-full max-w-[180px]"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveEditRepresentative(idx)}
                                    className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md cursor-pointer flex items-center justify-center"
                                    title="Save changes"
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    onClick={() => setEditingIndex(null)}
                                    className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md cursor-pointer flex items-center justify-center"
                                    title="Cancel"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => setSelectedRepModalName(name)}
                                    className="font-bold text-slate-800 text-xs hover:text-[#002f1d] hover:underline text-left cursor-pointer transition-colors"
                                    title="Click to view full setup data & calculation explanation"
                                  >
                                    {name}
                                  </button>
                                  {state.salesAssigneeName === name && (
                                    <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.2 rounded font-semibold">
                                      Default
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center font-semibold text-slate-600">
                              {stats.count}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-[#002f1d]">
                              {formatINR(stats.revenue)}
                            </td>
                            <td className="p-3 text-center">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold text-[10px]">
                                {sharePercent.toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {!isEditing && (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setSelectedRepModalName(name)}
                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-[#002f1d] text-[#002f1d] hover:text-white rounded-lg border border-emerald-200 hover:border-[#002f1d] text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                                    title="View full setup data & calculation explanation"
                                  >
                                    <Info size={11} /> Info
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingIndex(idx);
                                      setEditingValue(name);
                                    }}
                                    className="px-2.5 py-1 bg-slate-50 hover:bg-[#002f1d] text-slate-600 hover:text-white rounded-lg border border-slate-200 hover:border-[#002f1d] text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                                  >
                                    <Edit2 size={10} /> Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRepresentative(idx)}
                                    className="px-2.5 py-1 bg-slate-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-lg border border-slate-200 hover:border-rose-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                                  >
                                    <Trash2 size={10} /> Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. List of attributed sales invoices */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Attributed Sales Transactions
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Individual ledger showing invoices credited to their respective sales representative.
                  </p>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                        <th className="p-3 font-semibold">Invoice No</th>
                        <th className="p-3 font-semibold">Representative</th>
                        <th className="p-3 font-semibold">Customer</th>
                        <th className="p-3 font-semibold text-right">Taxable Value (INR)</th>
                        <th className="p-3 font-semibold text-right">Total (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {state.saleInvoices.map((inv) => {
                        const customer = state.parties.find((p) => p.id === inv.customerId);
                        const assignedRep = inv.assignee || state.salesAssigneeName || "Vishal Kumar";
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-800">{inv.invoiceNumber}</td>
                            <td className="p-3">
                              <button
                                onClick={() => setSelectedRepModalName(assignedRep)}
                                className="font-semibold text-[#002f1d] bg-emerald-50 hover:bg-[#002f1d] hover:text-white border border-emerald-100 px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer"
                                title="Click to view setup data & calculation explanation"
                              >
                                {assignedRep}
                              </button>
                            </td>
                            <td className="p-3 text-slate-600 truncate max-w-[150px]">
                              {customer?.name || "Unknown Customer"}
                            </td>
                            <td className="p-3 text-right font-mono font-medium text-slate-600">
                              {formatINR(inv.subtotal)}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-800">
                              {formatINR(inv.totalAmount)}
                            </td>
                          </tr>
                        );
                      })}
                      {state.saleInvoices.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                            No sales invoices have been posted yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sales Income Display Column */}
            <div className="space-y-6">
              {/* Gross Income Card */}
              <div className="bg-[#002f1d] text-white p-6 rounded-3xl shadow-md border border-[#002114] space-y-4">
                <div className="flex items-center justify-between border-b border-[#00472c] pb-3">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                    <TrendingUp size={12} /> Company Revenue
                  </span>
                  <span className="text-[10px] bg-[#00472c] text-emerald-300 px-2 py-0.5 rounded font-extrabold uppercase">
                    YTD
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-tight mb-1">
                    Company's Sales Income (Taxable)
                  </h4>
                  <p className="text-3xl font-extrabold tracking-tight text-white font-mono">
                    {formatINR(totalRevenue)}
                  </p>
                  <p className="text-[11px] text-emerald-400/80 mt-1">
                    Excludes GST/tax components. Represents base operational earnings.
                  </p>
                </div>
              </div>

              {/* Gross Invoice Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-[10px] font-bold text-[#002f1d] uppercase tracking-widest flex items-center gap-1">
                    <Coins size={12} /> Total Invoice Cashflow
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-tight mb-1">
                    Gross Billing Amount
                  </h4>
                  <p className="text-2xl font-extrabold tracking-tight text-slate-800 font-mono">
                    {formatINR(state.saleInvoices.filter(i => i.status !== "Draft").reduce((sum, inv) => sum + inv.totalAmount, 0))}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Includes all applied GST taxes (CGST, SGST, IGST).
                  </p>
                </div>
              </div>

              {/* Representative Performance Analytics */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Info size={14} className="text-[#002f1d]" />
                    Attribution Diagnostics
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">Click rep for full setup data</span>
                </div>
                <div className="space-y-2">
                  {assigneesList.map((name, index) => {
                    const stats = getRepStats(name);
                    const sharePercent = totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0;
                    return (
                      <button
                        key={index}
                        onClick={() => setSelectedRepModalName(name)}
                        className="w-full text-left flex justify-between items-center text-xs border-b border-slate-200/60 pb-2.5 last:border-b-0 last:pb-0 hover:bg-white p-2.5 rounded-2xl border border-transparent hover:border-emerald-200/80 hover:shadow-2xs transition-all cursor-pointer group"
                        title={`Click to view full setup data & calculation explanation for ${name}`}
                      >
                        <span className="text-slate-700 truncate max-w-[120px] font-bold group-hover:text-[#002f1d] flex items-center gap-1">
                          {name}
                          <Info size={11} className="text-emerald-700 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </span>
                        <div className="text-right">
                          <span className="font-extrabold text-slate-800 group-hover:text-[#002f1d] font-mono block">
                            {formatINR(stats.revenue)}
                          </span>
                          <span className="text-[10px] text-slate-400 group-hover:text-slate-600 font-medium">
                            {stats.count} Invoices ({sharePercent.toFixed(1)}%)
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPRESENTATIVE SETUP & DATA EXPLANATION POPUP MODAL */}
      {selectedRepModalName && (() => {
        const repName = selectedRepModalName;
        const repNameLower = repName.trim().toLowerCase();

        // Matched Team Member Profile
        const matchedMember = (state.teamMembers || []).find(m => 
          m.name.replace(/\s*\(.*?\)/, "").trim().toLowerCase() === repNameLower ||
          m.name.trim().toLowerCase() === repNameLower
        );

        // All invoices assigned to this representative
        const repAllInvoices = state.saleInvoices.filter(inv => {
          const assigned = inv.assignee || state.salesAssigneeName || "Vishal Kumar";
          return assigned.trim().toLowerCase() === repNameLower;
        });

        const postedInvoices = repAllInvoices.filter(i => i.status === "Posted");
        const draftInvoices = repAllInvoices.filter(i => i.status === "Draft");
        const cancelledInvoices = repAllInvoices.filter(i => i.status === "Cancelled");

        const totalRepTaxable = postedInvoices.reduce((sum, i) => sum + i.subtotal, 0);
        const totalRepGross = postedInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
        const totalRepGst = totalRepGross - totalRepTaxable;
        const repSharePct = totalRevenue > 0 ? (totalRepTaxable / totalRevenue) * 100 : 0;
        const isDefaultRep = state.salesAssigneeName?.trim().toLowerCase() === repNameLower || (!state.salesAssigneeName && repName === "Vishal Kumar");

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="bg-[#002f1d] text-white p-6 flex items-center justify-between border-b border-[#00472c] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 font-bold text-lg">
                    {repName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-extrabold tracking-tight text-white">{repName}</h3>
                      {isDefaultRep && (
                        <span className="text-[10px] bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded font-bold uppercase">
                          Default Sales Rep
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-emerald-200/80 mt-0.5 flex items-center gap-2">
                      <span>Representative Setup &amp; Calculation Audit Trail</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRepModalName(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
                  title="Close popup"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content Scrollable Area */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Section 1: Full Setup Data & Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Setup Info Card */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <User size={12} className="text-[#002f1d]" /> Account Setup
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{repName}</p>
                      <p className="text-[11px] text-slate-500 truncate">{matchedMember?.email || "No email assigned (Directory Representative)"}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-200/60 flex justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">System Role:</span>
                      <span className="font-bold text-slate-700">{matchedMember?.role || "Sales Executive"}</span>
                    </div>
                  </div>

                  {/* Credited Sales Card */}
                  <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/60 space-y-2">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp size={12} /> Credited Sales Revenue
                    </span>
                    <div>
                      <p className="text-2xl font-black text-[#002f1d] font-mono">{formatINR(totalRepTaxable)}</p>
                      <p className="text-[11px] text-emerald-800/80 mt-0.5">Taxable Sales Income (Excl. GST)</p>
                    </div>
                    <div className="pt-2 border-t border-emerald-200/60 flex justify-between text-[11px]">
                      <span className="text-emerald-800 font-medium">Gross Billing:</span>
                      <span className="font-bold text-emerald-900 font-mono">{formatINR(totalRepGross)}</span>
                    </div>
                  </div>

                  {/* Company Share & Volume */}
                  <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200/60 space-y-2">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                      <Percent size={12} /> Company Share &amp; Volume
                    </span>
                    <div>
                      <p className="text-2xl font-black text-indigo-900 font-mono">{repSharePct.toFixed(1)}%</p>
                      <p className="text-[11px] text-indigo-800/80 mt-0.5">Contribution to Company Sales</p>
                    </div>
                    <div className="pt-2 border-t border-indigo-200/60 flex justify-between text-[11px]">
                      <span className="text-indigo-800 font-medium">Posted Invoices:</span>
                      <span className="font-bold text-indigo-950 font-mono">{postedInvoices.length} Invoices</span>
                    </div>
                  </div>
                </div>

                {/* Section 2: "WHY THIS VALUE SHOWS" Breakdown Explanation */}
                <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-amber-200/60 pb-3">
                    <Calculator size={18} className="text-amber-800" />
                    <div>
                      <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                        Calculation Explanation: "Why This Value Shows"
                      </h4>
                      <p className="text-[11px] text-amber-800/90 mt-0.5">
                        Complete mathematical step-by-step transparency breakdown for {repName}.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* Formula 1 */}
                    <div className="bg-white p-3.5 rounded-xl border border-amber-200/60 space-y-2">
                      <div className="flex justify-between items-center flex-wrap gap-1">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          1. Credited Taxable Income = {formatINR(totalRepTaxable)}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">
                          Formula: Sum(Subtotal of Posted Invoices)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Calculated by summing the net taxable value (subtotal excluding taxes) of all <strong className="text-slate-800">Posted</strong> sale invoices where Assignee = <strong className="text-[#002f1d]">{repName}</strong>.
                      </p>
                      {postedInvoices.length > 0 ? (
                        <div className="bg-slate-50 p-2.5 rounded-lg text-[11px] font-mono text-slate-700 border border-slate-100 space-y-1">
                          <span className="font-semibold text-slate-500 block text-[10px] uppercase font-sans">Itemized Calculation Breakdown:</span>
                          {postedInvoices.map((inv) => (
                            <div key={inv.id} className="flex justify-between items-center">
                              <span>Invoice {inv.invoiceNumber} ({inv.date}):</span>
                              <span className="font-bold">{formatINR(inv.subtotal)}</span>
                            </div>
                          ))}
                          <div className="border-t border-slate-200 pt-1 flex justify-between font-bold text-[#002f1d]">
                            <span>Total Credited Income:</span>
                            <span>{formatINR(totalRepTaxable)}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic bg-slate-50 p-2 rounded">
                          No posted invoices are currently credited to this representative. Taxable income = ₹0.00.
                        </p>
                      )}
                    </div>

                    {/* Formula 2: Exclusion policy */}
                    <div className="bg-white p-3.5 rounded-xl border border-amber-200/60 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Info size={13} className="text-amber-600" />
                          2. Draft &amp; Cancelled Invoices Policy
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Draft invoices ({draftInvoices.length}) are pending confirmation and not posted to ledger accounts. Cancelled invoices ({cancelledInvoices.length}) are reversed. Only Posted invoices ({postedInvoices.length}) are counted toward realized sales income.
                      </p>
                    </div>

                    {/* Formula 3: Share formula */}
                    <div className="bg-white p-3.5 rounded-xl border border-amber-200/60 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Percent size={13} className="text-indigo-600" />
                          3. Company Revenue Share = {repSharePct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg text-[11px] font-mono text-slate-700 border border-slate-100">
                        <span>(Rep Taxable Sales {formatINR(totalRepTaxable)} ÷ Total Company Taxable Sales {formatINR(totalRevenue)}) × 100 = <strong>{repSharePct.toFixed(2)}%</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Attributed Transactions Ledger */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Attributed Transactions Ledger ({repAllInvoices.length})
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      All sales invoices assigned to {repName}
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                          <th className="p-3">Invoice No</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Customer</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">Taxable Value</th>
                          <th className="p-3 text-right">Total Billing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {repAllInvoices.map((inv) => {
                          const customer = state.parties.find(p => p.id === inv.customerId);
                          return (
                            <tr key={inv.id} className="hover:bg-slate-50">
                              <td className="p-3 font-bold text-slate-800">{inv.invoiceNumber}</td>
                              <td className="p-3 text-slate-500">{inv.date}</td>
                              <td className="p-3 text-slate-700 font-medium truncate max-w-[160px]">
                                {customer?.name || "Unknown Customer"}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  inv.status === "Posted" 
                                    ? "bg-emerald-100 text-emerald-800" 
                                    : inv.status === "Cancelled" 
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-[#002f1d]">
                                {formatINR(inv.subtotal)}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-800">
                                {formatINR(inv.totalAmount)}
                              </td>
                            </tr>
                          );
                        })}
                        {repAllInvoices.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                              No sales invoices have been assigned to {repName} yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end shrink-0">
                <button
                  onClick={() => setSelectedRepModalName(null)}
                  className="px-5 py-2 bg-[#002f1d] hover:bg-[#00472c] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Close Information
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
