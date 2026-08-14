import React, { useState, useRef, useEffect, useMemo } from "react";
import { ERPState, StockTransfer, StockMovement } from "../types";
import { Plus, Search, ArrowRightLeft, Calendar, Info, Clock, ArrowRight, ChevronDown, Check } from "lucide-react";
import { formatDate } from "../utils";
import { isWarehouseAllowed, getAllowedWarehouses } from "../utils/warehouseAuth";

interface SearchableSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { id: string; name: string }[];
  placeholder: string;
  disabled?: boolean;
}

function SearchableSelect({ value, onChange, options, placeholder, disabled }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.id === value);
  const searchLower = (search || "").toLowerCase();
  const filtered = options.filter((o) => (o?.name || "").toLowerCase().includes(searchLower));

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 hover:border-slate-300 transition-colors cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        <span className="truncate">{selectedOption ? selectedOption.name : placeholder}</span>
        <ChevronDown size={16} className="text-slate-400 shrink-0 ml-1" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 flex items-center gap-1.5 bg-slate-50/50">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              type="text"
              className="w-full bg-transparent text-xs text-slate-700 focus:outline-none p-0.5"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1 max-h-40 p-1 space-y-0.5">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2 italic">No options found</p>
            ) : (
              filtered.map((opt) => {
                const isSelected = value === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-indigo-50 text-indigo-700 font-bold"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{opt.name}</span>
                    {isSelected && <Check size={14} className="text-indigo-600 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface StockTransferViewProps {
  state: ERPState;
  currentUserEmail?: string;
  onUpdateState: (newState: ERPState) => void;
}

export default function StockTransferView({ state, currentUserEmail, onUpdateState }: StockTransferViewProps) {
  const currentUser = useMemo(
    () => (state.teamMembers || []).find((m) => m.email.toLowerCase() === (currentUserEmail || "").toLowerCase()),
    [state.teamMembers, currentUserEmail]
  );

  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Form states
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  const warehouses = useMemo(
    () => getAllowedWarehouses(currentUser, state.warehouses),
    [currentUser, state.warehouses]
  );
  const stockTransfers = state.stockTransfers || [];

  const selectedItem = state.items.find((i) => i.id === itemId);
  const fromWarehouse = warehouses.find((w) => w.id === fromWarehouseId);
  const toWarehouse = warehouses.find((w) => w.id === toWarehouseId);

  // Available stock in the selected FROM warehouse
  const availableStock = selectedItem && fromWarehouseId
    ? (selectedItem.warehouseStocks?.[fromWarehouseId] || 0)
    : 0;

  const handleSubmitTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !fromWarehouseId || !toWarehouseId || !itemId || !quantity || quantity <= 0) {
      alert("Please fill all mandatory fields with valid values.");
      return;
    }

    if (fromWarehouseId === toWarehouseId) {
      alert("Source and Destination warehouses cannot be the same.");
      return;
    }

    if (quantity > availableStock) {
      alert(
        `Insufficient stock in ${fromWarehouse?.name || "source warehouse"}. Available: ${availableStock} ${
          selectedItem?.unit || ""
        }, Requested: ${quantity} ${selectedItem?.unit || ""}.`
      );
      return;
    }

    // 1. Create StockTransfer record
    const transferId = "st-" + Math.random().toString(36).substring(2, 9);
    const transferNumber = "ST-" + Date.now().toString().slice(-6);

    const newTransfer: StockTransfer = {
      id: transferId,
      transferNumber,
      date,
      fromWarehouseId,
      toWarehouseId,
      itemId,
      quantity,
      notes,
    };

    // 2. Deduct stock from 'fromWarehouse' and add to 'toWarehouse'
    const updatedItems = state.items.map((item) => {
      if (item.id === itemId) {
        const warehouseStocks = { ...item.warehouseStocks };
        warehouseStocks[fromWarehouseId] = (warehouseStocks[fromWarehouseId] || 0) - quantity;
        warehouseStocks[toWarehouseId] = (warehouseStocks[toWarehouseId] || 0) + quantity;

        // Recalculate total stock quantity as sum of all warehouse stocks
        const totalStock = Object.values(warehouseStocks).reduce((sum: number, val) => sum + (val || 0), 0);

        return {
          ...item,
          stockQuantity: totalStock,
          warehouseStocks,
        };
      }
      return item;
    });

    // 3. Log StockMovement records
    const movementOut: StockMovement = {
      id: "sm-" + Math.random().toString(36).substring(2, 9),
      date,
      itemId,
      type: "Out",
      quantity,
      referenceType: "Stock Transfer",
      referenceId: transferId,
      notes: `Transferred to ${toWarehouse?.name || "other warehouse"}. Notes: ${notes}`,
      warehouseId: fromWarehouseId,
    };

    const movementIn: StockMovement = {
      id: "sm-" + Math.random().toString(36).substring(2, 9),
      date,
      itemId,
      type: "In",
      quantity,
      referenceType: "Stock Transfer",
      referenceId: transferId,
      notes: `Transferred from ${fromWarehouse?.name || "other warehouse"}. Notes: ${notes}`,
      warehouseId: toWarehouseId,
    };

    onUpdateState({
      ...state,
      items: updatedItems,
      stockTransfers: [newTransfer, ...stockTransfers],
      stockMovements: [movementOut, movementIn, ...state.stockMovements],
    });

    // Reset Form
    setIsCreating(false);
    setItemId("");
    setQuantity("");
    setNotes("");
  };

  const filteredTransfers = stockTransfers.filter((st) => {
    const item = state.items.find((i) => i.id === st.itemId);
    const fromWh = state.warehouses?.find((w) => w.id === st.fromWarehouseId);
    const toWh = state.warehouses?.find((w) => w.id === st.toWarehouseId);

    const term = (searchTerm || "").toLowerCase();
    const matchesSearch =
      (st.transferNumber || "").toLowerCase().includes(term) ||
      (item?.name || "").toLowerCase().includes(term) ||
      (fromWh?.name || "").toLowerCase().includes(term) ||
      (toWh?.name || "").toLowerCase().includes(term);

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
            <span>Inventory Management</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-bold">Stock Transfer</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Inter-Warehouse Transfers</h2>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-sm cursor-pointer border border-indigo-500"
          >
            <Plus size={16} /> New Stock Transfer
          </button>
        )}
      </div>

      {isCreating && (
        <form onSubmit={handleSubmitTransfer} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
            <ArrowRightLeft className="text-indigo-600" size={18} /> Initiate Stock Transfer
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                Transfer Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                From Warehouse (Source) <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                value={fromWarehouseId}
                onChange={(val) => {
                  setFromWarehouseId(val);
                  setItemId("");
                  setQuantity("");
                }}
                options={warehouses.map((wh) => ({
                  id: wh.id,
                  name: `${wh.name} (${wh.code})`
                }))}
                placeholder="-- Select Source Warehouse --"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                To Warehouse (Destination) <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                value={toWarehouseId}
                onChange={(val) => setToWarehouseId(val)}
                options={warehouses
                  .filter((wh) => wh.id !== fromWarehouseId)
                  .map((wh) => ({
                    id: wh.id,
                    name: `${wh.name} (${wh.code})`
                  }))}
                placeholder="-- Select Destination Warehouse --"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                Select Stock Item <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                disabled={!fromWarehouseId}
                value={itemId}
                onChange={(val) => {
                  setItemId(val);
                  setQuantity("");
                }}
                options={state.items.map((item) => {
                  const whStock = item.warehouseStocks?.[fromWarehouseId] || 0;
                  return {
                    id: item.id,
                    name: `${item.name} (${whStock} ${item.unit} available)`
                  };
                })}
                placeholder={!fromWarehouseId ? "-- Select Source Warehouse First --" : "-- Select Item to Transfer --"}
              />
            </div>

            {selectedItem && (
              <div className="md:col-span-2 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Source Warehouse Inventory Availability</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">{selectedItem.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-500">Available Qty</p>
                  <p className="text-lg font-black text-indigo-700 font-mono mt-0.5">
                    {availableStock} {selectedItem.unit}
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                Transfer Quantity <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={quantity}
                  disabled={!itemId}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                    setQuantity(val);
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-slate-800 font-mono disabled:opacity-50"
                />
                {selectedItem && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {selectedItem.unit}
                  </span>
                )}
              </div>
            </div>

            <div className={selectedItem ? "md:col-span-1 lg:col-span-3" : "md:col-span-2 lg:col-span-3"}>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                Transfer Notes / Remark
              </label>
              <input
                type="text"
                placeholder="e.g. Replenishment stock for South-Zone distribution"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-slate-800 font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setItemId("");
                setQuantity("");
                setNotes("");
              }}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-150"
            >
              Cancel Transfer
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer border border-indigo-500"
            >
              Execute Stock Transfer
            </button>
          </div>
        </form>
      )}

      {/* Transfers Log */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-150 bg-slate-50 flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search transfer history by item, code or warehouse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-slate-700 placeholder-slate-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-150 bg-slate-50 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">
                <th className="px-6 py-4">Transfer Number</th>
                <th className="px-6 py-4">Transfer Date</th>
                <th className="px-6 py-4">Stock Item</th>
                <th className="px-6 py-4">Source Warehouse</th>
                <th className="px-6 py-4 text-center"></th>
                <th className="px-6 py-4">Destination Warehouse</th>
                <th className="px-6 py-4">Quantity Moved</th>
                <th className="px-6 py-4">Remarks / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <Info className="mx-auto mb-2 text-slate-300" size={28} />
                    <p className="font-medium text-slate-500">No stock transfers recorded.</p>
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((st) => {
                  const item = state.items.find((i) => i.id === st.itemId);
                  const fromWh = state.warehouses?.find((w) => w.id === st.fromWarehouseId);
                  const toWh = state.warehouses?.find((w) => w.id === st.toWarehouseId);

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{st.transferNumber}</td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-500">{formatDate(st.date)}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{item?.name || "Deleted Item"}</div>
                        <div className="text-[10px] text-slate-400 font-mono font-bold">{item?.code}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                        {fromWh?.name || "Unknown"}
                        <div className="text-[10px] text-slate-400 font-mono">{fromWh?.code}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <ArrowRight size={14} className="text-slate-400 mx-auto" />
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                        {toWh?.name || "Unknown"}
                        <div className="text-[10px] text-slate-400 font-mono">{toWh?.code}</div>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-indigo-700">
                        {st.quantity} {item?.unit || ""}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate" title={st.notes}>
                        {st.notes || "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
