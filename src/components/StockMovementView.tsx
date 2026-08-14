import React, { useState, useMemo } from "react";
import { ERPState } from "../types";
import { formatDate } from "../utils";
import { isWarehouseAllowed } from "../utils/warehouseAuth";
import { ArrowLeftRight, Search } from "lucide-react";

interface StockMovementViewProps {
  state: ERPState;
  currentUserEmail?: string;
  prefillSearchTerm?: string;
  clearPrefill?: () => void;
}

export default function StockMovementView({ state, currentUserEmail, prefillSearchTerm, clearPrefill }: StockMovementViewProps) {
  const currentUser = useMemo(
    () => (state.teamMembers || []).find((m) => m.email.toLowerCase() === (currentUserEmail || "").toLowerCase()),
    [state.teamMembers, currentUserEmail]
  );

  const [searchTerm, setSearchTerm] = useState(prefillSearchTerm || "");

  React.useEffect(() => {
    if (prefillSearchTerm) {
      setSearchTerm(prefillSearchTerm);
      if (clearPrefill) {
        clearPrefill();
      }
    }
  }, [prefillSearchTerm, clearPrefill]);

  const filteredMovements = state.stockMovements.filter((mov) => {
    if (!isWarehouseAllowed(currentUser, mov.warehouseId)) {
      return false;
    }
    const item = state.items.find((i) => i.id === mov.itemId);
    const term = (searchTerm || "").toLowerCase();
    return (
      (item?.name || "").toLowerCase().includes(term) ||
      (item?.code || "").toLowerCase().includes(term) ||
      (mov.referenceType || "").toLowerCase().includes(term) ||
      (mov.notes || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Stock Movement & Audit Log</h2>
        <p className="text-sm text-gray-500">Inspect real-time physical bin-card adjustments, trace dispatch invoices, and audit incoming cargo receipts.</p>
      </div>

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
              placeholder="Search SKU code, reference, notes..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-none bg-white"
            />
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Recorded Transactions: {state.stockMovements.length} events
          </span>
        </div>

        {filteredMovements.length === 0 ? (
          <p className="text-sm text-gray-500 py-12 text-center">No stock movements found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">SKU / Item</th>
                  <th className="p-4">Type</th>
                  <th className="p-4 text-center">Movement Qty</th>
                  <th className="p-4">Reference source</th>
                  <th className="p-4">Audit Memo Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-600">
                {filteredMovements.slice().reverse().map((mov) => {
                  const item = state.items.find((i) => i.id === mov.itemId);
                  const isIncoming = mov.type === "In";
                  return (
                    <tr key={mov.id} className="hover:bg-gray-50/40 font-medium">
                      <td className="p-4 text-gray-500">{formatDate(mov.date)}</td>
                      <td className="p-4">
                        <span className="font-bold text-gray-900 block">{item?.code || "SKU"}</span>
                        <span className="text-[10px] text-gray-400 block max-w-xs truncate">{item?.name}</span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${
                            isIncoming
                              ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                              : mov.type === "Out"
                              ? "bg-rose-50 text-rose-800 border-rose-100"
                              : "bg-amber-50 text-amber-800 border-amber-100"
                          }`}
                        >
                          {mov.type === "In" ? "Stock InWARD" : mov.type === "Out" ? "Stock OutWARD" : "Adjustment"}
                        </span>
                      </td>
                      <td className={`p-4 text-center font-black font-mono text-sm ${isIncoming ? "text-emerald-700" : "text-rose-600"}`}>
                        {isIncoming ? "+" : "-"}
                        {mov.quantity} {item?.unit || "Bags"}
                      </td>
                      <td className="p-4 font-mono">
                        <span className="text-gray-400 uppercase font-bold text-[9px] block tracking-widest">{mov.referenceType}</span>
                        <span className="text-gray-800 font-semibold">{mov.referenceId}</span>
                      </td>
                      <td className="p-4 italic text-gray-500">{mov.notes}</td>
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
