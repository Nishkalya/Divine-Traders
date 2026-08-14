import React, { useMemo } from "react";
import { ERPState } from "../types";
import { formatINR, formatDate, getVendorOutstanding, getCustomerOutstanding } from "../utils";
import { isWarehouseAllowed, getAllowedWarehouses } from "../utils/warehouseAuth";
import { motion } from "motion/react";
import {
  TrendingUp,
  TrendingDown,
  Boxes,
  Users,
  AlertTriangle,
  ArrowUpRight,
  ShoppingCart,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";

interface DashboardViewProps {
  state: ERPState;
  currentUserEmail?: string;
  setCurrentTab: (tab: string) => void;
  setSelectedOrderId?: (id: string) => void;
  setSelectedInvoiceId?: (id: string) => void;
}

export default function DashboardView({
  state,
  currentUserEmail,
  setCurrentTab,
  setSelectedOrderId,
  setSelectedInvoiceId,
}: DashboardViewProps) {
  const currentUser = useMemo(
    () => (state.teamMembers || []).find((m) => m.email.toLowerCase() === (currentUserEmail || "").toLowerCase()),
    [state.teamMembers, currentUserEmail]
  );

  const allowedWarehouses = useMemo(
    () => getAllowedWarehouses(currentUser, state.warehouses),
    [currentUser, state.warehouses]
  );
  const allowedWhIds = useMemo(() => allowedWarehouses.map((w) => w.id), [allowedWarehouses]);

  const authorizedInvoices = useMemo(
    () => state.saleInvoices.filter((inv) => isWarehouseAllowed(currentUser, inv.warehouseId)),
    [state.saleInvoices, currentUser]
  );

  const authorizedBills = useMemo(
    () => state.purchaseBills.filter((b) => isWarehouseAllowed(currentUser, b.warehouseId)),
    [state.purchaseBills, currentUser]
  );

  // Calculations
  const totalSales = authorizedInvoices
    .filter((inv) => inv.status !== "Draft")
    .reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalPurchases = authorizedBills.reduce((sum, b) => sum + b.totalAmount, 0);
  
  const stockValuation = state.items.reduce((sum, item) => {
    let stockQty = item.stockQuantity;
    if (currentUser?.allowedWarehouseIds && currentUser.allowedWarehouseIds.length > 0) {
      stockQty = allowedWhIds.reduce((acc, whId) => acc + (item.warehouseStocks?.[whId] ?? 0), 0);
    }
    return sum + stockQty * item.purchasePrice;
  }, 0);

  const totalReceivables = state.parties
    .filter((p) => p.type === "Customer" || p.type === "Both")
    .reduce((sum, p) => sum + getCustomerOutstanding(p.id, state), 0);

  const totalPayables = state.parties
    .filter((p) => p.type === "Vendor" || p.type === "Both")
    .reduce((sum, p) => sum + getVendorOutstanding(p.id, state), 0);

  // Alerts
  const lowStockItems = state.items.filter((item) => {
    let stockQty = item.stockQuantity;
    if (currentUser?.allowedWarehouseIds && currentUser.allowedWarehouseIds.length > 0) {
      stockQty = allowedWhIds.reduce((acc, whId) => acc + (item.warehouseStocks?.[whId] ?? 0), 0);
    }
    return stockQty <= item.minStockLevel;
  });
  
  const pendingBillsCount = authorizedBills.filter((b) => b.status !== "Paid").length;

  // Quick Audit calculations
  const today = new Date();
  const todayDateStr = today.toISOString().split("T")[0];

  const todaySalesInvoices = authorizedInvoices.filter((inv) => {
    if (inv.status === "Draft") return false;
    if (!inv.date) return false;
    const invDateStr = inv.date.split("T")[0];
    if (invDateStr === todayDateStr) return true;
    
    const d = new Date(inv.date);
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  });

  const todaySalesTotal = todaySalesInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const todaySalesCount = todaySalesInvoices.length;

  const pendingBillsList = authorizedBills.filter((b) => b.status !== "Paid");
  const pendingBillsTotal = pendingBillsList.reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0);

  // Let's create an elegant visual trend bar chart showing sales vs purchases categories
  const categories = Array.from(new Set(state.items.map((i) => i.category)));
  const categoryStockVal = categories.map((cat) => {
    const val = state.items
      .filter((i) => i.category === cat)
      .reduce((sum, i) => {
        let qty = i.stockQuantity;
        if (currentUser?.allowedWarehouseIds && currentUser.allowedWarehouseIds.length > 0) {
          qty = allowedWhIds.reduce((acc, whId) => acc + (i.warehouseStocks?.[whId] ?? 0), 0);
        }
        return sum + qty * i.purchasePrice;
      }, 0);
    return { name: cat, value: val };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
            <span>Divine Traders</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-bold">HQ Dashboard</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Executive Dashboard</h2>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end text-right hidden sm:flex">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">System Status</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              CONNECTED LIVE
            </span>
          </div>
        </div>
      </div>

      {/* Today's Quick Audit Section */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Today's Quick Audit</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400 font-bold bg-slate-200/50 px-2.5 py-1 rounded-lg">
            SNAPSHOT AS OF TODAY
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Today's Sales */}
          <motion.div 
            whileHover={{ scale: 1.02, y: -4, boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.1)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setCurrentTab("sales")}
            className="bg-emerald-50/40 border border-emerald-100 hover:border-emerald-200 p-5 rounded-2xl flex items-center justify-between cursor-pointer transition-all group"
          >
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-emerald-700/80 uppercase tracking-wider block">Today's Sales</span>
              <span className="text-2xl font-black font-mono text-emerald-950 block">
                {formatINR(todaySalesTotal)}
              </span>
              <span className="text-xs font-semibold text-emerald-700/90 block">
                {todaySalesCount === 0 ? "No invoices posted today" : `${todaySalesCount} Invoice${todaySalesCount > 1 ? "s" : ""} Posted`}
              </span>
            </div>
            <div className="p-3 bg-emerald-100/70 text-emerald-700 rounded-xl group-hover:scale-110 transition-transform">
              <ShoppingCart size={22} />
            </div>
          </motion.div>

          {/* Card 2: Pending Bills */}
          <motion.div 
            whileHover={{ scale: 1.02, y: -4, boxShadow: "0 10px 25px -5px rgba(245, 158, 11, 0.1)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setCurrentTab("purchase-bills")}
            className="bg-amber-50/40 border border-amber-150 hover:border-amber-250 p-5 rounded-2xl flex items-center justify-between cursor-pointer transition-all group"
          >
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-amber-700/80 uppercase tracking-wider block">Pending Bills</span>
              <span className="text-2xl font-black font-mono text-amber-950 block">
                {pendingBillsCount} Bill{pendingBillsCount !== 1 ? "s" : ""}
              </span>
              <span className="text-xs font-semibold text-amber-700/90 block">
                {formatINR(pendingBillsTotal)} Outstanding
              </span>
            </div>
            <div className="p-3 bg-amber-100/70 text-amber-700 rounded-xl group-hover:scale-110 transition-transform">
              <Receipt size={22} />
            </div>
          </motion.div>

          {/* Card 3: Low-Stock Items */}
          <motion.div 
            whileHover={{ scale: 1.02, y: -4, boxShadow: "0 10px 25px -5px rgba(244, 63, 94, 0.1)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setCurrentTab("stock-inventory")}
            className="bg-rose-50/40 border border-rose-100 hover:border-rose-200 p-5 rounded-2xl flex items-center justify-between cursor-pointer transition-all group"
          >
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-rose-700/80 uppercase tracking-wider block">Low Stock Alert</span>
              <span className="text-2xl font-black font-mono text-rose-950 block">
                {lowStockItems.length} SKU{lowStockItems.length !== 1 ? "s" : ""} Low
              </span>
              <span className="text-xs font-semibold text-rose-700/90 block">
                {lowStockItems.length === 0 ? "Inventory levels are healthy" : "Requires immediate restock"}
              </span>
            </div>
            <div className="p-3 bg-rose-100/70 text-rose-700 rounded-xl group-hover:scale-110 transition-transform">
              <Boxes size={22} />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Stat 1 */}
        <motion.div 
          whileHover={{ scale: 1.03, y: -4, boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.08)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setCurrentTab("sales")}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-200 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Total Sales</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-bold font-mono tracking-tight text-slate-800">{formatINR(totalSales)}</h3>
            <span className="text-[10px] text-slate-400 font-medium italic block mt-1">Accumulated revenue</span>
          </div>
        </motion.div>

        {/* Stat 2 */}
        <motion.div 
          whileHover={{ scale: 1.03, y: -4, boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.08)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setCurrentTab("purchase-bills")}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-200 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Total Purchases</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingDown size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-bold font-mono tracking-tight text-slate-800">{formatINR(totalPurchases)}</h3>
            <span className="text-[10px] text-slate-400 font-medium italic block mt-1">Billed vendor cost</span>
          </div>
        </motion.div>

        {/* Stat 3 */}
        <motion.div 
          whileHover={{ scale: 1.03, y: -4, boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.08)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setCurrentTab("stock-inventory")}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-200 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Stock Valuation</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Boxes size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-bold font-mono tracking-tight text-slate-800">{formatINR(stockValuation)}</h3>
            <span className="text-[10px] text-slate-400 font-medium italic block mt-1">{state.items.length} SKUs in inventory</span>
          </div>
        </motion.div>

        {/* Stat 4 */}
        <motion.div 
          whileHover={{ scale: 1.03, y: -4, boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.08)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setCurrentTab("customer-outstanding")}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-200 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Receivables</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-bold font-mono tracking-tight text-slate-800">{formatINR(totalReceivables)}</h3>
            <span className="text-[10px] text-slate-400 font-medium italic block mt-1">Due from customers</span>
          </div>
        </motion.div>

        {/* Stat 5 */}
        <motion.div 
          whileHover={{ scale: 1.03, y: -4, boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.08)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setCurrentTab("vendor-outstanding")}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-200 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Payables</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-xl font-bold font-mono tracking-tight text-slate-800">{formatINR(totalPayables)}</h3>
            <span className="text-[10px] text-slate-400 font-medium italic block mt-1">Due to vendors</span>
          </div>
        </motion.div>
      </div>

      {/* Alerts and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Alerts (using Dark Bento Card for Supply Chain / alerts vibe) */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl flex flex-col justify-between lg:col-span-1 shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <AlertTriangle className="text-amber-400" size={16} />
                Stock Alerts ({lowStockItems.length})
              </h4>
              <button
                onClick={() => setCurrentTab("stock-inventory")}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer"
              >
                Manage
              </button>
            </div>
            {lowStockItems.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center italic">All item stocks are within safe levels.</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-100">{item.name}</p>
                      <p className="text-slate-400 text-[11px]">Min level: {item.minStockLevel} {item.unit}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-300 font-mono">{item.stockQuantity} {item.unit}</p>
                      <span className="text-[9px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">
                        RESTOCK
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-400 italic">
            Warehouse dispatcher flagged 2 updates today.
          </div>
        </div>

        {/* Outstanding Vendor Bills Overview */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Receipt className="text-indigo-600" size={16} />
              Unpaid Vendor Bills ({pendingBillsCount})
            </h4>
            <button
              onClick={() => setCurrentTab("purchase-bills")}
              className="text-xs text-indigo-600 hover:underline font-bold cursor-pointer"
            >
              View Bills
            </button>
          </div>
          {pendingBillsCount === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center italic">No outstanding bills at the moment.</p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {state.purchaseBills
                .filter((b) => b.status !== "Paid")
                .map((b) => {
                  const vendor = state.parties.find((p) => p.id === b.vendorId);
                  const isOverdue = new Date() > new Date(b.dueDate);
                  return (
                    <div
                      key={b.id}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                        isOverdue
                          ? "bg-rose-50/50 border-rose-100 text-rose-950"
                          : "bg-slate-50/50 border-slate-100 text-slate-800"
                      }`}
                    >
                      <div>
                        <p className="font-bold text-slate-800">{b.billNumber}</p>
                        <p className="text-slate-400 truncate max-w-[130px]">{vendor?.name || "Unknown"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold font-mono text-slate-900">
                          {formatINR(b.totalAmount - b.paidAmount)}
                        </p>
                        <p className={`text-[9px] font-semibold uppercase ${isOverdue ? "text-rose-600" : "text-slate-400"}`}>
                          {isOverdue ? "Overdue" : "Due"}: {formatDate(b.dueDate)}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Category Stock Distribution - Accent block style (Indigo block layout) */}
        <div className="bg-indigo-600 text-white p-6 rounded-3xl shadow-sm lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-indigo-500">
              <h4 className="text-sm font-bold uppercase tracking-wider text-indigo-100 flex items-center gap-2">
                <FileSpreadsheet className="text-indigo-200" size={16} />
                Stock by Category
              </h4>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold">VALUATION</span>
            </div>
            <div className="space-y-3.5 pt-1">
              {categoryStockVal.map((cat) => {
                const pct = stockValuation > 0 ? (cat.value / stockValuation) * 100 : 0;
                return (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-100">{cat.name}</span>
                      <span className="font-bold font-mono text-white">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-indigo-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-white h-full rounded-full transition-all duration-350"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-500 flex justify-between items-center text-[10px] text-indigo-200 font-mono">
            <span>TOTAL VALUE:</span>
            <span className="font-bold text-white text-xs">{formatINR(stockValuation)}</span>
          </div>
        </div>
      </div>

      {/* Transaction Records - Dual Tables (Standard high contrast white bento blocks) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices / Sales */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <ShoppingCart size={16} className="text-emerald-600" />
              Recent Sales Invoices
            </h4>
            <button
              onClick={() => setCurrentTab("sales")}
              className="text-xs text-indigo-600 hover:underline font-bold cursor-pointer"
            >
              All Invoices
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5">Inv No</th>
                  <th className="py-2.5">Customer</th>
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {state.saleInvoices.slice(-5).reverse().map((inv) => {
                  const customer = state.parties.find((p) => p.id === inv.customerId);
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      onClick={() => {
                        if (setSelectedInvoiceId) setSelectedInvoiceId(inv.id);
                        setCurrentTab("sales");
                      }}
                    >
                      <td className="py-2.5 font-bold font-mono text-indigo-700">{inv.invoiceNumber}</td>
                      <td className="py-2.5 font-semibold text-slate-800">{customer?.name || "Cash Customer"}</td>
                      <td className="py-2.5 text-slate-500">{formatDate(inv.date)}</td>
                      <td className="py-2.5 text-right font-bold font-mono text-slate-800">{formatINR(inv.totalAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Purchase Orders */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Receipt size={16} className="text-indigo-600" />
              Recent Purchase Orders
            </h4>
            <button
              onClick={() => setCurrentTab("purchase-orders")}
              className="text-xs text-indigo-600 hover:underline font-bold cursor-pointer"
            >
              All POs
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5">PO No</th>
                  <th className="py-2.5">Vendor</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {state.purchaseOrders.slice(-5).reverse().map((po) => {
                  const vendor = state.parties.find((p) => p.id === po.vendorId);
                  const statusColors: Record<string, string> = {
                    Draft: "bg-slate-100 text-slate-700 border-slate-200",
                    Approved: "bg-blue-50 text-blue-700 border-blue-100",
                    Received: "bg-amber-50 text-amber-700 border-amber-100",
                    Closed: "bg-emerald-50 text-emerald-700 border-emerald-100",
                  };
                  return (
                    <tr
                      key={po.id}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      onClick={() => {
                        if (setSelectedOrderId) setSelectedOrderId(po.id);
                        setCurrentTab("purchase-orders");
                      }}
                    >
                      <td className="py-2.5 font-bold font-mono text-indigo-700">{po.orderNumber}</td>
                      <td className="py-2.5 font-semibold text-slate-800">{vendor?.name || "Unknown"}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase ${statusColors[po.status]}`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-bold font-mono text-slate-800">{formatINR(po.totalAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
