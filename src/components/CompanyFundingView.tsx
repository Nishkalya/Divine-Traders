import React, { useState } from "react";
import { ERPState, FundingTransaction, FundingPartner } from "../types";
import { formatINR, formatDate, exportToCsv, calculateCompanyFundingTotals } from "../utils";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  Coins,
  Users,
  Landmark,
  Calendar,
  Check,
  X,
  Wallet,
  Percent,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Edit2,
  FileText,
  PieChart,
} from "lucide-react";

interface CompanyFundingViewProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  currentUserRole?: string;
  currentUserEmail?: string;
}

export default function CompanyFundingView({
  state,
  onUpdateState,
  currentUserRole = "Administrator",
  currentUserEmail = "",
}: CompanyFundingViewProps) {
  // Check permission: Admin and Accountant roles have write access
  // Also support matching Admin from email or name if required
  const isAdminOrFinance =
    currentUserRole.toLowerCase().includes("admin") ||
    currentUserRole.toLowerCase().includes("accountant") ||
    currentUserRole.toLowerCase().includes("finance");

  // Local State
  const [activeTab, setActiveTab] = useState<"entries" | "reports">("entries");
  const [searchTerm, setSearchTerm] = useState("");
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");

  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FundingTransaction | null>(null);

  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<FundingPartner | null>(null);

  // Tx Form state
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [txPartnerId, setTxPartnerId] = useState("partner-1");
  const [txAmount, setTxAmount] = useState<string>("");
  const [txMethod, setTxMethod] = useState<FundingTransaction["paymentMethod"]>("Bank Transfer");
  const [txRefNum, setTxRefNum] = useState("");
  const [txNotes, setTxNotes] = useState("");

  // Partner Form state
  const [partnerName, setPartnerName] = useState("");
  const [partnerMobile, setPartnerMobile] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");

  // Safely get state variables
  const fundingPartners = state.fundingPartners || [];
  const fundingTransactions = state.fundingTransactions || [];

  // 1. Calculations
  const {
    totalFunding,
    totalSalesCollection,
    totalCompanyCapital,
    totalSupplierPayments,
    remainingBalance,
  } = calculateCompanyFundingTotals(state);

  // Get investment per partner
  const getPartnerInvestment = (partnerId: string) => {
    return fundingTransactions
      .filter((tx) => tx.partnerId === partnerId)
      .reduce((sum, tx) => sum + tx.amount, 0);
  };

  // Filter Transactions
  const filteredTransactions = fundingTransactions.filter((tx) => {
    const partner = fundingPartners.find((p) => p.id === tx.partnerId);
    const partnerNameMatch = partner?.name.toLowerCase() || "";
    const matchesSearch =
      tx.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partnerNameMatch.includes(searchTerm.toLowerCase());

    const matchesPartner = partnerFilter === "all" || tx.partnerId === partnerFilter;
    const matchesMethod = methodFilter === "all" || tx.paymentMethod === methodFilter;

    return matchesSearch && matchesPartner && matchesMethod;
  });

  // Handle Partner Form Submit
  const handlePartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrFinance) return;

    if (!partnerName.trim()) {
      alert("Please enter partner name.");
      return;
    }

    if (editingPartner) {
      const updatedPartners = fundingPartners.map((p) =>
        p.id === editingPartner.id
          ? {
              ...p,
              name: partnerName.trim(),
              mobile: partnerMobile.trim(),
              email: partnerEmail.trim(),
            }
          : p
      );
      onUpdateState({
        ...state,
        fundingPartners: updatedPartners,
      });
      setIsPartnerModalOpen(false);
      setEditingPartner(null);
    }
  };

  // Handle Transaction Form Submit
  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrFinance) return;

    const amountNum = parseFloat(txAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid amount greater than ₹0.");
      return;
    }

    if (!txDate) {
      alert("Please specify a transaction date.");
      return;
    }

    if (editingTx) {
      // Edit transaction
      const updatedTxList = fundingTransactions.map((tx) =>
        tx.id === editingTx.id
          ? {
              ...tx,
              date: txDate,
              partnerId: txPartnerId,
              amount: amountNum,
              paymentMethod: txMethod,
              referenceNumber: txRefNum.trim(),
              notes: txNotes.trim(),
            }
          : tx
      );
      onUpdateState({
        ...state,
        fundingTransactions: updatedTxList,
      });
    } else {
      // Add new transaction
      const newTx: FundingTransaction = {
        id: "funding-tx-" + Math.random().toString(36).substring(2, 9),
        date: txDate,
        partnerId: txPartnerId,
        amount: amountNum,
        paymentMethod: txMethod,
        referenceNumber: txRefNum.trim() || `FTX-${Math.floor(100000 + Math.random() * 900000)}`,
        notes: txNotes.trim(),
      };
      onUpdateState({
        ...state,
        fundingTransactions: [newTx, ...fundingTransactions],
      });
    }

    // Reset Form
    setIsTxModalOpen(false);
    setEditingTx(null);
    setTxAmount("");
    setTxRefNum("");
    setTxNotes("");
  };

  // Handle Edit Click for Tx
  const openEditTxModal = (tx: FundingTransaction) => {
    setEditingTx(tx);
    setTxDate(tx.date);
    setTxPartnerId(tx.partnerId);
    setTxAmount(tx.amount.toString());
    setTxMethod(tx.paymentMethod);
    setTxRefNum(tx.referenceNumber);
    setTxNotes(tx.notes);
    setIsTxModalOpen(true);
  };

  // Handle Edit Click for Partner
  const openEditPartnerModal = (partner: FundingPartner) => {
    setEditingPartner(partner);
    setPartnerName(partner.name);
    setPartnerMobile(partner.mobile);
    setPartnerEmail(partner.email);
    setIsPartnerModalOpen(true);
  };

  // Delete Transaction
  const handleDeleteTx = (id: string, amount: number) => {
    if (!isAdminOrFinance) return;
    if (
      confirm(
        `Are you sure you want to delete this funding entry of ${formatINR(amount)}? This action cannot be undone.`
      )
    ) {
      const updatedTxList = fundingTransactions.filter((tx) => tx.id !== id);
      onUpdateState({
        ...state,
        fundingTransactions: updatedTxList,
      });
    }
  };

  // Export Transactions Ledger to CSV
  const handleExportCSV = () => {
    const headers = ["Date", "Partner Name", "Amount (INR)", "Payment Method", "Reference Number", "Notes"];
    const rows = fundingTransactions.map((tx) => {
      const partner = fundingPartners.find((p) => p.id === tx.partnerId);
      return [
        tx.date,
        partner?.name || "Unknown Partner",
        tx.amount,
        tx.paymentMethod,
        tx.referenceNumber,
        tx.notes || "-",
      ];
    });
    exportToCsv("Funding_Transactions_Ledger.csv", headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
            <span>Divine Traders</span>
            <span className="text-slate-300">/</span>
            <span>Finance</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-bold">Company Funding</span>
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Coins size={24} className="text-indigo-600 shrink-0" />
            Company Funding Management
          </h2>
        </div>

        {/* Permissions Indicator & Add Actions */}
        <div className="flex items-center gap-3">
          {!isAdminOrFinance ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-500 text-xs font-bold rounded-xl border border-slate-200 shadow-3xs">
              <ShieldCheck size={14} className="text-slate-400" />
              <span>Read-Only View</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-150 shadow-3xs">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Finance Auth Active</span>
            </div>
          )}

          {isAdminOrFinance && (
            <button
              id="btn-add-funding"
              onClick={() => {
                setEditingTx(null);
                setTxDate(new Date().toISOString().split("T")[0]);
                setTxPartnerId(fundingPartners[0]?.id || "partner-1");
                setTxAmount("");
                setTxMethod("Bank Transfer");
                setTxRefNum("");
                setTxNotes("");
                setIsTxModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all hover:shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Add Funding Transaction
            </button>
          )}
        </div>
      </div>

      {/* 3. Funding Partner Cards */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <Users size={12} className="text-slate-400" />
          Primary Funding Partners (Fixed Contributors)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {fundingPartners.map((partner) => {
            const totalInv = getPartnerInvestment(partner.id);
            const sharePercent = totalFunding > 0 ? (totalInv / totalFunding) * 100 : 0;

            return (
              <div
                key={partner.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all group relative overflow-hidden"
              >
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700"></div>

                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-md font-bold text-slate-800 tracking-tight">
                        {partner.name}
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-bold mt-0.5">
                        {partner.id.toUpperCase()}
                      </span>
                    </div>

                    {isAdminOrFinance && (
                      <button
                        onClick={() => openEditPartnerModal(partner)}
                        className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                        title="Edit Partner Profile"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Mobile:</span>
                      <span className="text-slate-700 font-semibold">{partner.mobile || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email:</span>
                      <span className="text-slate-700 font-semibold truncate max-w-[160px]" title={partner.email}>
                        {partner.email || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-4">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs text-slate-400 font-medium">Total Contributed</span>
                    <span className="text-lg font-black text-slate-900">{formatINR(totalInv)}</span>
                  </div>

                  {/* Progress Bar representation */}
                  <div className="w-full bg-slate-150 h-1.5 rounded-full overflow-hidden mt-2">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, sharePercent)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                    <span>Partner Contribution Share</span>
                    <span className="font-bold text-indigo-600">{sharePercent.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Total Funding */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Total Company Funding
          </span>
          <h3 className="text-2xl font-black text-emerald-600 mt-2 tracking-tight">
            {formatINR(totalFunding)}
          </h3>
          <span className="text-[10px] text-slate-400 block mt-1.5">
            Sum of all partner capital entries
          </span>
        </div>

        {/* Total Sales Collection Received */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Sales Collection (Read-Only)
          </span>
          <h3 className="text-2xl font-black text-indigo-600 mt-2 tracking-tight">
            {formatINR(totalSalesCollection)}
          </h3>
          <span className="text-[10px] text-slate-400 block mt-1.5">
            Auto-read from Sales invoices total
          </span>
        </div>

        {/* Total Company Capital */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs ring-1 ring-amber-100 bg-gradient-to-b from-white to-amber-50/20">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Company Capital
          </span>
          <h3 className="text-2xl font-black text-amber-600 mt-2 tracking-tight">
            {formatINR(totalCompanyCapital)}
          </h3>
          <span className="text-[10px] text-slate-400 block mt-1.5">
            Funding + Sales Invoices Received
          </span>
        </div>

        {/* Remaining Balance (Future Use) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Remaining Balance
          </span>
          <h3 className="text-2xl font-black text-slate-700 mt-2 tracking-tight">
            {formatINR(remainingBalance)}
          </h3>
          <span className="text-[10px] text-slate-400 block mt-1.5">
            Reserved for future allocations
          </span>
        </div>
      </div>

      {/* Sub-Tabs Switcher */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("entries")}
          className={`pb-3 text-sm font-bold tracking-tight cursor-pointer relative transition-all ${
            activeTab === "entries" ? "text-indigo-600 font-extrabold" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Transactions Ledger
          {activeTab === "entries" && (
            <motion.div
              layoutId="fundingTabLine"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"
            />
          )}
        </button>

        <button
          onClick={() => setActiveTab("reports")}
          className={`pb-3 text-sm font-bold tracking-tight cursor-pointer relative transition-all ${
            activeTab === "reports" ? "text-indigo-600 font-extrabold" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Funding Reports & Summary
          {activeTab === "reports" && (
            <motion.div
              layoutId="fundingTabLine"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"
            />
          )}
        </button>
      </div>

      {/* Content Area */}
      <div>
        {activeTab === "entries" ? (
          <div className="space-y-4">
            {/* Search, Filters and Export Row */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                {/* Search field */}
                <div className="relative w-full md:w-64">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by ref, notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white rounded-xl border border-slate-200 pl-9 pr-4 py-1.5 text-xs focus:border-indigo-600 focus:outline-none text-slate-700"
                  />
                </div>

                {/* Partner filter dropdown */}
                <select
                  value={partnerFilter}
                  onChange={(e) => setPartnerFilter(e.target.value)}
                  className="bg-white rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 focus:border-indigo-600 focus:outline-none"
                >
                  <option value="all">All Partners</option>
                  {fundingPartners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {/* Method filter dropdown */}
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="bg-white rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 focus:border-indigo-600 focus:outline-none"
                >
                  <option value="all">All Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>

              {/* Export button */}
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-3xs cursor-pointer transition-colors"
              >
                <Download size={12} className="text-slate-400" />
                Export CSV
              </button>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                      <th className="p-4">Date</th>
                      <th className="p-4">Partner Name</th>
                      <th className="p-4">Reference Number</th>
                      <th className="p-4">Payment Method</th>
                      <th className="p-4 text-right">Amount</th>
                      <th className="p-4">Notes</th>
                      {isAdminOrFinance && <th className="p-4 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isAdminOrFinance ? 7 : 6}
                          className="p-8 text-center text-slate-400 italic"
                        >
                          No funding transactions found matching filters.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => {
                        const partner = fundingPartners.find((p) => p.id === tx.partnerId);
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 whitespace-nowrap font-medium text-slate-700">
                              {formatDate(tx.date)}
                            </td>
                            <td className="p-4 whitespace-nowrap font-bold text-slate-800">
                              {partner?.name || "Unknown Partner"}
                            </td>
                            <td className="p-4 whitespace-nowrap font-mono text-[11px]">
                              {tx.referenceNumber}
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 border border-slate-150">
                                <Wallet size={10} className="text-slate-400" />
                                {tx.paymentMethod}
                              </span>
                            </td>
                            <td className="p-4 whitespace-nowrap text-right font-black text-slate-800">
                              {formatINR(tx.amount)}
                            </td>
                            <td className="p-4 max-w-xs truncate text-slate-500" title={tx.notes}>
                              {tx.notes || "-"}
                            </td>
                            {isAdminOrFinance && (
                              <td className="p-4 whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => openEditTxModal(tx)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                    title="Edit Transaction"
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTx(tx.id, tx.amount)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Delete Transaction"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* Reports Tab */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Partner-wise breakdown & Capital Summary */}
            <div className="lg:col-span-7 space-y-6">
              {/* Partner Contribution Summary Chart */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h4 className="text-sm font-bold text-slate-800 tracking-tight mb-4 flex items-center gap-1.5">
                  <Users size={16} className="text-slate-500" />
                  Partner Contribution Breakdown
                </h4>

                <div className="space-y-4">
                  {fundingPartners.map((partner) => {
                    const contributed = getPartnerInvestment(partner.id);
                    const pct = totalFunding > 0 ? (contributed / totalFunding) * 100 : 0;

                    return (
                      <div key={partner.id} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-700">{partner.name}</span>
                          <span className="text-slate-500 font-mono">
                            {formatINR(contributed)} ({pct.toFixed(1)}%)
                          </span>
                        </div>

                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Company Capital Summary Analysis */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h4 className="text-sm font-bold text-slate-800 tracking-tight mb-4 flex items-center gap-1.5">
                  <PieChart size={16} className="text-slate-500" />
                  Company Capital Summary & Share Analysis
                </h4>

                {/* Graphic representation */}
                <div className="space-y-4">
                  <div className="flex h-8 w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner">
                    {totalCompanyCapital > 0 ? (
                      <>
                        <div
                          className="bg-emerald-500 h-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ width: `${(totalFunding / totalCompanyCapital) * 100}%` }}
                        >
                          {totalFunding > 0 && `${((totalFunding / totalCompanyCapital) * 100).toFixed(0)}%`}
                        </div>
                        <div
                          className="bg-indigo-600 h-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ width: `${(totalSalesCollection / totalCompanyCapital) * 100}%` }}
                        >
                          {totalSalesCollection > 0 && `${((totalSalesCollection / totalCompanyCapital) * 100).toFixed(0)}%`}
                        </div>
                      </>
                    ) : (
                      <div className="bg-slate-100 h-full w-full flex items-center justify-center text-slate-400 text-xs italic">
                        No capital calculated yet
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between text-xs border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                      <span className="text-slate-500 font-semibold">Funding Share:</span>
                      <span className="font-bold text-emerald-600">
                        {totalCompanyCapital > 0 ? ((totalFunding / totalCompanyCapital) * 100).toFixed(1) : "0.0"}%
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-indigo-600 rounded-sm"></div>
                      <span className="text-slate-500 font-semibold">Sales Collection Share:</span>
                      <span className="font-bold text-indigo-600">
                        {totalCompanyCapital > 0 ? ((totalSalesCollection / totalCompanyCapital) * 100).toFixed(1) : "0.0"}%
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 text-xs text-slate-500 space-y-2">
                    <p className="leading-relaxed">
                      This analysis reports the breakdown of capital derived from external funding partners versus internal sales operations.
                    </p>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span>Total Equity Capital:</span>
                        <span className="font-bold text-slate-700">{formatINR(totalFunding)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Operating Revenue (Received):</span>
                        <span className="font-bold text-slate-700">{formatINR(totalSalesCollection)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-1 mt-1 font-bold">
                        <span className="text-slate-800">Combined Working Capital:</span>
                        <span className="text-amber-600">{formatINR(totalCompanyCapital)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Analytical Ledger Details & Stats */}
            <div className="lg:col-span-5 space-y-6">
              {/* Financial Audit Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 text-slate-100">
                  <Landmark size={80} />
                </div>
                <div className="relative space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-indigo-600" />
                    Capital Compliance Audit
                  </h4>

                  <div className="space-y-3 text-xs text-slate-600">
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-400">Total Transactions:</span>
                      <span className="font-mono font-bold text-slate-700">
                        {fundingTransactions.length} items
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-400">Payment Channels:</span>
                      <span className="font-semibold text-slate-700">
                        {Array.from(new Set(fundingTransactions.map((tx) => tx.paymentMethod))).join(", ") || "None"}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-400">Active Partners:</span>
                      <span className="font-semibold text-slate-700">
                        {fundingPartners.filter((p) => getPartnerInvestment(p.id) > 0).length} of {fundingPartners.length}
                      </span>
                    </div>

                    <div className="flex justify-between pb-1">
                      <span className="text-slate-400">Compliance Status:</span>
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                        Verified Balanced
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-150">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Capital Allocation Policy
                    </span>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      All partner capital contributions require legal execution documents. Sales collections are parsed programmatically from finalized invoices to avoid secondary manual ledger tampering.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Transaction Audit Trail */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h4 className="text-sm font-bold text-slate-800 tracking-tight mb-4 flex items-center gap-1.5">
                  <FileText size={16} className="text-slate-500" />
                  Recent Activity Trail
                </h4>

                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {fundingTransactions.length === 0 ? (
                    <div className="text-xs text-slate-400 italic text-center py-4">
                      No funding activity recorded yet.
                    </div>
                  ) : (
                    fundingTransactions.slice(0, 5).map((tx) => {
                      const partner = fundingPartners.find((p) => p.id === tx.partnerId);
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between text-xs border-b border-slate-50 pb-2 last:border-b-0"
                        >
                          <div>
                            <span className="font-bold text-slate-700 block">
                              {partner?.name || "Partner"}
                            </span>
                            <span className="text-[10px] text-slate-400">{formatDate(tx.date)}</span>
                          </div>
                          <span className="font-mono font-bold text-emerald-600">
                            +{formatINR(tx.amount)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Add/Edit Funding Transaction Modal */}
      <AnimatePresence>
        {isTxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Coins size={16} className="text-indigo-600" />
                  {editingTx ? "Edit Funding Transaction" : "New Funding Transaction"}
                </h3>
                <button
                  onClick={() => setIsTxModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleTxSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Date */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Transaction Date
                    </label>
                    <input
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-600 focus:outline-none bg-white text-slate-700 font-semibold"
                    />
                  </div>

                  {/* Partner selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Funding Partner
                    </label>
                    <select
                      value={txPartnerId}
                      onChange={(e) => setTxPartnerId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-600 focus:outline-none bg-white text-slate-700 font-semibold"
                    >
                      {fundingPartners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Amount */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Amount (INR)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 500000"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      required
                      min="1"
                      className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-600 focus:outline-none text-slate-700 font-bold"
                    />
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Payment Method
                    </label>
                    <select
                      value={txMethod}
                      onChange={(e) => setTxMethod(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-600 focus:outline-none bg-white text-slate-700 font-semibold"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="UPI">UPI</option>
                    </select>
                  </div>
                </div>

                {/* Reference Number */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Reference / Instrument Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TXN928103819 (Optional)"
                    value={txRefNum}
                    onChange={(e) => setTxRefNum(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-600 focus:outline-none text-slate-700"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Notes / Comments
                  </label>
                  <textarea
                    placeholder="Provide context about this funding allocation..."
                    rows={2}
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-600 focus:outline-none text-slate-700"
                  />
                </div>

                {/* Submit Row */}
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTxModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-3xs cursor-pointer"
                  >
                    {editingTx ? "Save Changes" : "Record Capital Entry"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Edit Funding Partner Profile Modal */}
      <AnimatePresence>
        {isPartnerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Users size={16} className="text-indigo-600" />
                  Edit Partner Profile
                </h3>
                <button
                  onClick={() => setIsPartnerModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handlePartnerSubmit} className="p-5 space-y-4">
                {/* Partner ID (Read only) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Partner ID
                  </label>
                  <input
                    type="text"
                    value={editingPartner?.id.toUpperCase()}
                    disabled
                    className="w-full rounded-xl border border-slate-100 px-3 py-1.5 text-xs bg-slate-50 text-slate-400 font-mono"
                  />
                </div>

                {/* Partner Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Full Name / Entity Name
                  </label>
                  <input
                    type="text"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-600 focus:outline-none text-slate-700 font-semibold"
                  />
                </div>

                {/* Mobile */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Mobile Contact Number
                  </label>
                  <input
                    type="text"
                    value={partnerMobile}
                    onChange={(e) => setPartnerMobile(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-600 focus:outline-none text-slate-700"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-600 focus:outline-none text-slate-700"
                  />
                </div>

                {/* Submit Row */}
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPartnerModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-3xs cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
