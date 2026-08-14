import React, { useState } from "react";
import { ERPState } from "../types";
import { formatINR, getCustomerOutstanding } from "../utils";
import { Landmark, ArrowUpRight, Search, ShieldCheck, Trash2 } from "lucide-react";

interface CustomerOutstandingViewProps {
  state: ERPState;
  currentUserEmail?: string;
  onUpdateState?: (newState: ERPState) => void;
  setCurrentTab?: (tab: string) => void;
  prefillSearchTerm?: string;
  clearPrefill?: () => void;
}

export default function CustomerOutstandingView({ state, currentUserEmail, onUpdateState, setCurrentTab, prefillSearchTerm, clearPrefill }: CustomerOutstandingViewProps) {
  const [searchTerm, setSearchTerm] = useState(prefillSearchTerm || "");

  React.useEffect(() => {
    if (prefillSearchTerm) {
      setSearchTerm(prefillSearchTerm);
      if (clearPrefill) {
        clearPrefill();
      }
    }
  }, [prefillSearchTerm, clearPrefill]);

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

  const customers = state.parties.filter((p) => p.type === "Customer" || p.type === "Both");

  // Calculate total outstanding receivables
  const totalOutstanding = customers.reduce(
    (sum, c) => sum + getCustomerOutstanding(c.id, state),
    0
  );

  // Compute age bins dynamically from sale invoices
  let age0_30 = 0;
  let age31_60 = 0;
  let age61_90 = 0;
  let ageOver90 = 0;

  (state.saleInvoices || []).forEach((inv) => {
    if (inv.status === "Draft") return;
    const balance = inv.totalAmount;
    const invDate = new Date(inv.date);
    const diffTime = Math.abs(Date.now() - invDate.getTime());
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
  });

  // Filter customers by search
  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Customer Outstanding (Accounts Receivable)</h2>
        <p className="text-sm text-gray-500">Track real-time debit balances, age distributions, and customer payment collection schedules.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Total Accounts Receivable</span>
          <h3 className="text-2xl font-black text-emerald-600 mt-2">{formatINR(totalOutstanding)}</h3>
          <span className="text-[10px] text-gray-400 block mt-1">Across {customers.length} trade customers</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">0 - 30 Days Out</span>
          <h3 className="text-lg font-bold text-gray-800 mt-2">{formatINR(age0_30)}</h3>
          <span className="text-[10px] text-emerald-600 block mt-1">Current billing cycles</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">31 - 60 Days Out</span>
          <h3 className="text-lg font-bold text-amber-600 mt-2">{formatINR(age31_60)}</h3>
          <span className="text-[10px] text-amber-500 block mt-1">Invoices near due</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">&gt; 60 Days (Overdue)</span>
          <h3 className="text-lg font-extrabold text-rose-600 mt-2">{formatINR(age61_90 + ageOver90)}</h3>
          <span className="text-[10px] text-rose-500 font-bold block mt-1">Follow-up suggested</span>
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
              placeholder="Search customer name..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-none bg-white"
            />
          </div>
          <span className="text-xs text-gray-400 font-mono">
            {filteredCustomers.length} customers listed
          </span>
        </div>

        {filteredCustomers.length === 0 ? (
          <p className="text-sm text-gray-500 py-12 text-center">No customers found matching your search.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold">
                  <th className="p-4">Customer Name</th>
                  <th className="p-4">Opening Balance</th>
                  <th className="p-4">Total Sales (GST inc.)</th>
                  <th className="p-4 text-right">Outstanding Receivable Balance</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-600">
                {filteredCustomers.map((c) => {
                  const outstanding = getCustomerOutstanding(c.id, state);
                  
                  // Compute individual customer stats
                  const salesTotal = state.saleInvoices
                    .filter((inv) => inv.customerId === c.id)
                    .reduce((sum, inv) => sum + inv.totalAmount, 0);

                  return (
                    <tr key={c.id} className="hover:bg-gray-50/40">
                      <td className="p-4">
                        <p className="font-bold text-gray-900">{c.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">GSTIN: {c.gstin || "URD"}</p>
                      </td>
                      <td className="p-4 font-mono">{formatINR(c.openingBalance)}</td>
                      <td className="p-4 font-mono">{formatINR(salesTotal)}</td>
                      <td className={`p-4 text-right font-extrabold font-mono text-sm ${outstanding > 0 ? "text-emerald-700" : "text-gray-400"}`}>
                        {formatINR(outstanding)}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {outstanding > 0 && setCurrentTab ? (
                            <button
                              onClick={() => setCurrentTab("sales")}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded border border-emerald-100 text-[10px] font-extrabold flex items-center gap-1.5 cursor-pointer"
                            >
                              View Sales Invoices
                              <ArrowUpRight size={12} />
                            </button>
                          ) : (
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1.5">
                              <ShieldCheck size={12} /> Settled
                            </span>
                          )}
                          {onUpdateState && (
                            <button
                              onClick={() => handleDeleteParty(c.id, c.name)}
                              className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-700 rounded border border-slate-200 hover:border-rose-200 cursor-pointer transition-all"
                              title="Delete Customer Account"
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
