import React, { useState } from "react";
import { ERPState, Warehouse } from "../types";
import { Plus, Search, MapPin, Edit2, Trash2, Shield, Info } from "lucide-react";

interface WarehouseMasterViewProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
}

export default function WarehouseMasterView({ state, onUpdateState }: WarehouseMasterViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | "Active" | "Inactive">("All");
  const [isCreating, setIsCreating] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const warehouses = state.warehouses || [];

  const filteredWarehouses = warehouses.filter((wh) => {
    const matchesSearch =
      wh.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wh.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wh.address.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterStatus === "All" || wh.status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  const handleEditClick = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setName(wh.name);
    setCode(wh.code);
    setAddress(wh.address);
    setStatus(wh.status);
    setIsCreating(true);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingWarehouse(null);
    setName("");
    setCode("");
    setAddress("");
    setStatus("Active");
  };

  const handleSubmitWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) {
      alert("Name and Code are required.");
      return;
    }

    let updatedWarehouses = [...warehouses];

    // Check duplicate code
    const duplicate = warehouses.find(
      (wh) => wh.code.toUpperCase() === code.toUpperCase() && (!editingWarehouse || wh.id !== editingWarehouse.id)
    );
    if (duplicate) {
      alert(`A warehouse with code "${code.toUpperCase()}" already exists.`);
      return;
    }

    if (editingWarehouse) {
      updatedWarehouses = updatedWarehouses.map((wh) => {
        if (wh.id === editingWarehouse.id) {
          return {
            ...wh,
            name,
            code: code.toUpperCase(),
            address,
            status,
          };
        }
        return wh;
      });
    } else {
      const newWarehouse: Warehouse = {
        id: "wh-" + Math.random().toString(36).substring(2, 9),
        name,
        code: code.toUpperCase(),
        address,
        status,
      };
      updatedWarehouses.push(newWarehouse);
    }

    onUpdateState({
      ...state,
      warehouses: updatedWarehouses,
    });

    handleCancel();
  };

  const handleDeleteWarehouse = (id: string) => {
    // Check if it's the main warehouse or if there is active stock in it
    if (id === "wh-main") {
      alert("The Main Warehouse cannot be deleted for system integrity.");
      return;
    }

    const itemsWithStock = state.items.filter((item) => {
      const whStock = item.warehouseStocks?.[id] || 0;
      return whStock > 0;
    });

    if (itemsWithStock.length > 0) {
      alert(
        `Cannot delete this warehouse. There are ${itemsWithStock.length} items with positive stock remaining in this warehouse.`
      );
      return;
    }

    if (!window.confirm("Are you sure you want to delete this warehouse? This action cannot be undone.")) {
      return;
    }

    const updatedWarehouses = warehouses.filter((wh) => wh.id !== id);

    // Clean up item warehouseStocks keys
    const updatedItems = state.items.map((item) => {
      if (item.warehouseStocks && id in item.warehouseStocks) {
        const nextStocks = { ...item.warehouseStocks };
        delete nextStocks[id];
        return {
          ...item,
          warehouseStocks: nextStocks,
        };
      }
      return item;
    });

    onUpdateState({
      ...state,
      warehouses: updatedWarehouses,
      items: updatedItems,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
            <span>Inventory Management</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-bold">Warehouse Master</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Warehouse Directory</h2>
        </div>
        {!isCreating && (
          <button
            onClick={() => {
              handleCancel();
              setIsCreating(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-sm cursor-pointer border border-indigo-500"
          >
            <Plus size={16} /> Create New Warehouse
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <form onSubmit={handleSubmitWarehouse} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">
            {editingWarehouse ? "Modify Warehouse Details" : "Establish New Warehouse Facility"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                Warehouse Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Taloja Cold Storage"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                Warehouse Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. WH-TAL-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={editingWarehouse?.id === "wh-main"}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-slate-800 font-mono disabled:opacity-50"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                Physical Address
              </label>
              <input
                type="text"
                placeholder="e.g. Sector 12, Plot 42, MIDC, Taloja"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                Operation Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
                disabled={editingWarehouse?.id === "wh-main"}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-slate-800 font-medium cursor-pointer disabled:opacity-50"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-150"
            >
              Discard Changes
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer border border-indigo-500"
            >
              {editingWarehouse ? "Save Updates" : "Create Warehouse"}
            </button>
          </div>
        </form>
      )}

      {/* Warehouses List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-150 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search warehouses by name, code or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-slate-700 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 self-end">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {(["All", "Active", "Inactive"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFilterStatus(opt)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    filterStatus === opt
                      ? "bg-white text-slate-800 shadow-3xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-150 bg-slate-50 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">
                <th className="px-6 py-4">Facility Details</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4">Current Stock lines</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredWarehouses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Info className="mx-auto mb-2 text-slate-300" size={28} />
                    <p className="font-medium text-slate-500">No warehouses found matching your criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredWarehouses.map((wh) => {
                  const stockLines = state.items.filter((item) => (item.warehouseStocks?.[wh.id] || 0) > 0).length;

                  return (
                    <tr key={wh.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{wh.name}</div>
                        {wh.id === "wh-main" && (
                          <span className="inline-block mt-1 text-[9px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                            Primary Hub
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-xs text-slate-600">{wh.code}</td>
                      <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-slate-400 shrink-0" />
                          <span>{wh.address || "No address configured"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono font-medium text-slate-600">
                        {stockLines} item {stockLines === 1 ? "line" : "lines"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            wh.status === "Active"
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {wh.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditClick(wh)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Warehouse"
                          >
                            <Edit2 size={14} />
                          </button>
                          {wh.id !== "wh-main" && (
                            <button
                              onClick={() => handleDeleteWarehouse(wh.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Warehouse"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
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
