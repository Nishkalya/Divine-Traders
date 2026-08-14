import React, { useState } from "react";
import { ERPState } from "../types";
import { formatINR, getVendorOutstanding } from "../utils";
import { Landmark, ArrowUpRight, Search, ShieldCheck, Trash2 } from "lucide-react";

interface VendorOutstandingViewProps {
  state: ERPState;
  currentUserEmail?: string;
  onUpdateState?: (newState: ERPState) => void;
  setCurrentTab?: (tab: string) => void;
}

export default function VendorOutstandingView({ state, currentUserEmail, onUpdateState, setCurrentTab }: VendorOutstandingViewProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const handleDeleteParty = (partyId: string, partyName: string) => {
    if (!onUpdateState) return;
    if (
      confirm(
        `Are you sure you want to delete "${partyName}"? This will permanently remove them from the business registry/parties directory and outstanding sheets.`
      )
    ) {
      const updatedParties = state.parties.filter((p) => p.id !== partyId);
      onUpdateState({
        ...state,
        parties: updatedParties,
      });
    }
  };

  const vendors = state.parties.filter((p) => p.type === "Vendor" || p.type === "Both");

  // Calculate total outstanding payables
  const totalOutstanding = vendors.reduce(
    (sum, v) => sum + getVendorOutstanding(v.id, state),
    0
  );

  // Compute age bins dynamically from unpaid purchase bills
  let age0_30 = 0;
  let age31_60 = 0;
  let age61_90 = 0;
  let ageOver90 = 0;

  state.purchaseBills.forEach((b) => {
    if (b.status !== "Paid") {
      const balance = b.totalAmount - b.paidAmount;
      const billDate = new Date(b.date);
      const diffTime = Math.abs(Date.now() - billDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        age0_30 += balance;
      } else if (diffDays <= 60) {
        age31_60 += balance;
      } else if (diffDays <= 90) {
        age61_90 += balance;
      } else {
        ageOver90 += balance;
      }
    }
  });

  // Filter vendors by search
  const filteredVendors = vendors.filter((v) =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Vendor Payables</h2>
        <p className="text-sm text-gray-500">Track real-time credit balances, age distributions, and outward payment schedules.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Total Vendor Payables</span>
          <h3 className="text-2xl font-black text-rose-600 mt-2">{formatINR(totalOutstanding)}</h3>
          <span className="text-[10px] text-gray-400 block mt-1">Across {vendors.length} trade vendors</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">0 - 30 Days Out</span>
          <h3 className="text-lg font-bold text-gray-800 mt-2">{formatINR(age0_30)}</h3>
          <span className="text-[10px] text-emerald-600 block mt-1">Current billing cycles</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">31 - 60 Days Out</span>
          <h3 className="text-lg font-bold text-amber-600 mt-2">{formatINR(age31_60)}</h3>
          <span className="text-[10px] text-amber-500 block mt-1">Nearing due dates</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">&gt; 60 Days (Overdue)</span>
          <h3 className="text-lg font-extrabold text-rose-600 mt-2">{formatINR(age61_90 + ageOver90)}</h3>
          <span className="text-[10px] text-rose-500 font-bold block mt-1">Action required immediately</span>
        </div>
      </div>

      {/* Directory Grid */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vendor name..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-none bg-white"
            />
          </div>
          <span className="text-xs text-gray-400 font-mono">
            {filteredVendors.length} vendors listed
          </span>
        </div>

        {filteredVendors.length === 0 ? (
          <p className="text-sm text-gray-500 py-12 text-center">No vendors found matching your search.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold">
                  <th className="p-4">Vendor Name</th>
                  <th className="p-4">Opening Balance</th>
                  <th className="p-4">Total Purchases (GST inc.)</th>
                  <th className="p-4">Total Payments Disbursed</th>
                  <th className="p-4 text-right text-rose-800 bg-rose-50/60 font-black">Purchased Payment To Pay Amount</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-600">
                {filteredVendors.map((v) => {
                  const outstanding = getVendorOutstanding(v.id, state);
                  
                  // Compute individual vendor stats
                  const billsTotal = state.purchaseBills
                    .filter((b) => b.vendorId === v.id)
                    .reduce((sum, b) => sum + b.totalAmount, 0);

                  const paymentsTotal = state.payments
                    .filter((p) => p.vendorId === v.id)
                    .reduce((sum, p) => sum + p.amount, 0);

                  return (
                    <tr key={v.id} className="hover:bg-gray-50/40">
                      <td className="p-4">
                        <p className="font-bold text-gray-900">{v.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">GSTIN: {v.gstin || "URD"}</p>
                      </td>
                      <td className="p-4 font-mono">{formatINR(v.openingBalance)}</td>
                      <td className="p-4 font-mono">{formatINR(billsTotal)}</td>
                      <td className="p-4 font-mono">{formatINR(paymentsTotal)}</td>
                      <td className={`p-4 text-right font-extrabold font-mono text-sm ${outstanding > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                        {formatINR(outstanding)}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {outstanding > 0 && setCurrentTab ? (
                            <button
                              onClick={() => setCurrentTab("payments")}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-100 text-[10px] font-extrabold flex items-center gap-1.5 cursor-pointer"
                            >
                              Disburse Payment
                              <ArrowUpRight size={12} />
                            </button>
                          ) : (
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1.5">
                              <ShieldCheck size={12} /> Settled
                            </span>
                          )}
                          {onUpdateState && (
                            <button
                              onClick={() => handleDeleteParty(v.id, v.name)}
                              className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-700 rounded border border-slate-200 hover:border-rose-200 cursor-pointer transition-all"
                              title="Delete Vendor Account"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
