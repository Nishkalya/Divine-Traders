import React, { useState } from "react";
import { ERPState, ProductionRun, Item } from "../types";
import { Plus, Edit, Trash2, CheckCircle2, PlayCircle, Clock, Calendar, HelpCircle } from "lucide-react";

interface ProductionViewProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
}

export default function ProductionView({ state, onUpdateState }: ProductionViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [batchNumber, setBatchNumber] = useState("");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<ProductionRun["status"]>("Scheduled");
  const [notes, setNotes] = useState("");

  const productionRuns = state.productionRuns || [];
  const itemsList = state.items || [];

  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setBatchNumber(`BATCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setProductName(itemsList[0]?.name || "");
    setQuantity(100);
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setStatus("Scheduled");
    setNotes("");
  };

  const handleStartEdit = (run: ProductionRun) => {
    setEditingId(run.id);
    setIsCreating(true);
    setBatchNumber(run.batchNumber);
    setProductName(run.productName);
    setQuantity(run.quantity);
    setStartDate(run.startDate);
    setEndDate(run.endDate || "");
    setStatus(run.status);
    setNotes(run.notes || "");
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this Production Run?")) {
      const updatedRuns = productionRuns.filter((r) => r.id !== id);
      onUpdateState({
        ...state,
        productionRuns: updatedRuns,
      });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!batchNumber.trim() || !productName.trim() || quantity <= 0) {
      alert("Please fill in all required fields and ensure quantity is positive.");
      return;
    }

    let updatedRuns = [...productionRuns];

    if (editingId) {
      // Find old run to check if it's changing to Completed
      const oldRun = productionRuns.find((r) => r.id === editingId);
      
      updatedRuns = updatedRuns.map((run) => {
        if (run.id === editingId) {
          const finalEndDate = status === "Completed" ? (endDate || new Date().toISOString().split("T")[0]) : undefined;
          
          // Trigger stock update if transitioning to completed
          if (oldRun && oldRun.status !== "Completed" && status === "Completed") {
            triggerStockUpdate(productName, quantity);
          }

          return {
            ...run,
            batchNumber,
            productName,
            quantity,
            startDate,
            endDate: finalEndDate,
            status,
            notes,
          };
        }
        return run;
      });
    } else {
      const newRun: ProductionRun = {
        id: "run-" + Math.random().toString(36).substring(2, 9),
        batchNumber,
        productName,
        quantity,
        startDate,
        endDate: status === "Completed" ? (endDate || new Date().toISOString().split("T")[0]) : undefined,
        status,
        notes,
      };

      updatedRuns.push(newRun);

      if (status === "Completed") {
        triggerStockUpdate(productName, quantity);
      }
    }

    onUpdateState({
      ...state,
      productionRuns: updatedRuns,
    });

    setIsCreating(false);
    setEditingId(null);
  };

  const triggerStockUpdate = (prodName: string, qty: number) => {
    // Find the item
    const matchedItem = itemsList.find((i) => i.name === prodName);
    if (matchedItem) {
      const updatedItems = itemsList.map((i) => {
        if (i.id === matchedItem.id) {
          return {
            ...i,
            stockQuantity: i.stockQuantity + qty,
          };
        }
        return i;
      });

      // Log a Stock Movement
      const movement = {
        id: "sm-" + Math.random().toString(36).substring(2, 9),
        date: new Date().toISOString().split("T")[0],
        itemId: matchedItem.id,
        type: "In" as const,
        quantity: qty,
        referenceType: "Adjustment" as const,
        referenceId: batchNumber,
        notes: `Stock auto-credited from completed production batch ${batchNumber}`,
      };

      onUpdateState({
        ...state,
        items: updatedItems,
        stockMovements: [...(state.stockMovements || []), movement],
      });
    }
  };

  const getStatusBadgeColor = (st: ProductionRun["status"]) => {
    switch (st) {
      case "Completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "In Progress":
        return "bg-amber-50 text-amber-700 border-amber-100 animate-pulse";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Production &amp; Batch Manufacturing</h2>
          <p className="text-sm text-slate-500 font-medium">
            Monitor shop floor operations, schedule batch runs, and auto-credit inventory.
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={handleStartCreate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm self-start"
          >
            <Plus size={16} /> Log Production Batch
          </button>
        )}
      </div>

      {isCreating ? (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-6 animate-fadeIn">
          <div className="border-b pb-3 border-slate-150">
            <h3 className="text-base font-extrabold text-slate-800">
              {editingId ? `Update Production Run: ${batchNumber}` : "Schedule New Manufacturing Batch"}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Batch Number *</label>
                <input
                  type="text"
                  required
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Product Name *</label>
                <select
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none bg-white cursor-pointer font-medium"
                >
                  {itemsList.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                  {itemsList.length === 0 && <option value="">No items registered in catalog</option>}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Manufacturing Quantity *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none font-bold"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Completion Date</label>
                  <input
                    type="date"
                    disabled={status !== "Completed"}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none font-medium disabled:bg-slate-50 disabled:text-slate-400"
                    placeholder="Auto-set on complete"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Batch Status *</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none bg-white cursor-pointer font-bold"
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed (Credits Stock)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Operation Logs / Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Note equipment used, temperature readings, or yield updates..."
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none resize-none font-medium"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
            >
              Save Manufacturing Run
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5">Batch Code</th>
                  <th className="py-3 px-5">Product Target</th>
                  <th className="py-3 px-5 text-right">Qty</th>
                  <th className="py-3 px-5">Start Date</th>
                  <th className="py-3 px-5">End Date</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Notes</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {productionRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-5 font-mono font-bold text-slate-800">{run.batchNumber}</td>
                    <td className="py-4 px-5 text-slate-900 font-semibold">{run.productName}</td>
                    <td className="py-4 px-5 text-right font-mono font-bold text-indigo-600">{run.quantity}</td>
                    <td className="py-4 px-5 text-slate-500">{run.startDate}</td>
                    <td className="py-4 px-5 text-slate-500">{run.endDate || "-"}</td>
                    <td className="py-4 px-5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-wide ${getStatusBadgeColor(run.status)}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-400 italic font-normal max-w-xs truncate" title={run.notes}>
                      {run.notes || "No log entries"}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleStartEdit(run)}
                          className="p-1.5 hover:bg-slate-100 hover:text-indigo-600 rounded-lg cursor-pointer transition-colors"
                          title="Edit Batch"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(run.id)}
                          className="p-1.5 hover:bg-slate-100 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                          title="Delete Batch"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {productionRuns.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                      No active or historical production batches logged.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
