import React, { useState, useMemo } from "react";
import { ERPState, Item, StockMovement, LedgerEntry } from "../types";
import { formatINR, exportToCsv } from "../utils";
import { isWarehouseAllowed, getAllowedWarehouses } from "../utils/warehouseAuth";
import { 
  Warehouse, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  ArrowLeftRight, 
  TrendingUp, 
  Settings, 
  Plus, 
  Minus, 
  Sliders, 
  Activity, 
  DollarSign, 
  Inbox,
  Filter,
  Copy,
  Download
} from "lucide-react";

interface StockInventoryViewProps {
  state: ERPState;
  currentUserEmail?: string;
  onUpdateState: (newState: ERPState) => void;
}

export default function StockInventoryView({ state, currentUserEmail, onUpdateState }: StockInventoryViewProps) {
  const currentUser = useMemo(
    () => (state.teamMembers || []).find((m) => m.email.toLowerCase() === (currentUserEmail || "").toLowerCase()),
    [state.teamMembers, currentUserEmail]
  );

  const allowedWarehouses = useMemo(
    () => getAllowedWarehouses(currentUser, state.warehouses),
    [currentUser, state.warehouses]
  );

  const allowedWhIds = useMemo(() => allowedWarehouses.map((w) => w.id), [allowedWarehouses]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [stockFilter, setStockFilter] = useState<"All" | "Low">("All");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("All");
  const [adjustingWarehouseId, setAdjustingWarehouseId] = useState(() => allowedWarehouses[0]?.id || "wh-main");
  
  // Quick adjustment modal state
  const [adjustingItem, setAdjustingItem] = useState<Item | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<"In" | "Out" | "Reset">("In");
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustmentNotes, setAdjustmentNotes] = useState("");

  // Categories list
  const categories = Array.from(new Set(["All", ...state.items.map((item) => item.category)]));

  const resolvedItems = state.items.map((item) => {
    let stockQty = 0;
    if (selectedWarehouseId === "All") {
      if (currentUser?.allowedWarehouseIds && currentUser.allowedWarehouseIds.length > 0) {
        stockQty = allowedWhIds.reduce((sum, whId) => sum + (item.warehouseStocks?.[whId] ?? 0), 0);
      } else {
        stockQty = item.stockQuantity;
      }
    } else {
      stockQty = item.warehouseStocks?.[selectedWarehouseId] ?? 0;
    }
    return {
      ...item,
      stockQuantity: stockQty,
    };
  });

  // Calculations for Valuation & Metrics
  const totalItems = resolvedItems.length;
  const totalStockQuantity = resolvedItems.reduce((sum, item) => sum + item.stockQuantity, 0);
  
  const totalValuationCost = resolvedItems.reduce(
    (sum, item) => sum + item.stockQuantity * item.purchasePrice, 
    0
  );
  
  const totalValuationSale = resolvedItems.reduce(
    (sum, item) => sum + item.stockQuantity * item.salePrice, 
    0
  );

  const lowStockItems = resolvedItems.filter((item) => item.stockQuantity <= item.minStockLevel);
  const lowStockCount = lowStockItems.length;

  const handleDuplicateItem = (item: Item) => {
    let newCode = item.code + "-COPY";
    let attempts = 1;
    while (state.items.some((i) => i.code === newCode)) {
      newCode = `${item.code}-COPY${attempts}`;
      attempts++;
    }

    const newItem: Item = {
      ...item,
      id: "i-" + Math.random().toString(36).substring(2, 9),
      code: newCode,
      name: `${item.name} (Copy)`,
    };

    onUpdateState({
      ...state,
      items: [...state.items, newItem],
    });
    alert(`Successfully duplicated product "${item.name}" as "${newItem.name}" with code "${newCode}"`);
  };

  // Filtered items
  const filteredItems = (resolvedItems || []).filter((item) => {
    if (!item) return false;
    const nameStr = String(item.name || "").toLowerCase();
    const codeStr = String(item.code || "").toLowerCase();
    const categoryStr = String(item.category || "").toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch = 
      nameStr.includes(search) ||
      codeStr.includes(search) ||
      categoryStr.includes(search);

    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesStockFilter = stockFilter === "All" || item.stockQuantity <= item.minStockLevel;

    return matchesSearch && matchesCategory && matchesStockFilter;
  });

  const handleExportStockCsv = () => {
    const headers = [
      "SKU Code",
      "Product Name",
      "Category",
      "Unit",
      "Purchase Price (₹)",
      "Sale Price (₹)",
      "Min Stock Level",
      "Stock Quantity",
      "Book Cost Value (₹)"
    ];

    const rows = filteredItems.map((item) => {
      const bookValue = item.stockQuantity * item.purchasePrice;
      return [
        item.code,
        item.name,
        item.category,
        item.unit,
        item.purchasePrice,
        item.salePrice,
        item.minStockLevel,
        item.stockQuantity,
        bookValue
      ];
    });

    exportToCsv("stock_inventory_report.csv", headers, rows);
  };

  const handleOpenAdjustment = (item: Item) => {
    setAdjustingItem(item);
    setAdjustmentType("In");
    setAdjustQuantity(0);
    setAdjustmentNotes("");
    setAdjustingWarehouseId(state.warehouses?.[0]?.id || "wh-main");
  };

  const handleCloseAdjustment = () => {
    setAdjustingItem(null);
  };

  const handleSubmitAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;

    if (adjustQuantity <= 0 && adjustmentType !== "Reset") {
      alert("Adjustment quantity must be greater than zero.");
      return;
    }

    if (adjustmentType === "Reset" && adjustQuantity < 0) {
      alert("Recalibrated physical stock cannot be negative.");
      return;
    }

    const currentQty = adjustingItem.warehouseStocks?.[adjustingWarehouseId] ?? 0;
    let newQty = currentQty;
    let movementType: "In" | "Out" | "Adjustment" = "In";
    let actualDelta = adjustQuantity;

    if (adjustmentType === "In") {
      newQty = currentQty + adjustQuantity;
      movementType = "In";
    } else if (adjustmentType === "Out") {
      if (currentQty < adjustQuantity && !state.allowNegativeStock) {
        alert(`Insufficient stock in selected warehouse. Current stock is ${currentQty} ${adjustingItem.unit}. You cannot deduct ${adjustQuantity} ${adjustingItem.unit} without enabling negative stock in Admin controls.`);
        return;
      }
      newQty = Math.max(0, currentQty - adjustQuantity);
      movementType = "Out";
    } else if (adjustmentType === "Reset") {
      newQty = adjustQuantity;
      movementType = "Adjustment";
      actualDelta = newQty - currentQty;
    }

    // Determine notes
    const reasonNotes = adjustmentNotes.trim() || `Physical Stock Correction (${adjustmentType})`;

    // Generate unique movement & reference IDs
    const adjRefId = "ADJ-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const movementId = "sm-" + Math.random().toString(36).substring(2, 9);
    const today = new Date().toISOString().split("T")[0];

    // 1. Create Stock Movement Log Entry
    const newMovement: StockMovement = {
      id: movementId,
      date: today,
      itemId: adjustingItem.id,
      type: movementType,
      quantity: Math.abs(actualDelta),
      referenceType: "Adjustment",
      referenceId: adjRefId,
      notes: reasonNotes,
      warehouseId: adjustingWarehouseId,
    };

    // 2. Cascade Ledger double-entry record for balance sheet audit trail
    const ledgerIdBase = "l-adj-" + Math.random().toString(36).substring(2, 9);
    const valuationDeltaAmount = Math.abs(actualDelta) * adjustingItem.purchasePrice;
    const newLedgerEntries: LedgerEntry[] = [];

    if (valuationDeltaAmount > 0) {
      const isIncrease = actualDelta > 0;
      
      // Stock ledger account adjustments
      newLedgerEntries.push({
        id: `${ledgerIdBase}-a`,
        date: today,
        partyName: "Inventory Assets Account",
        type: isIncrease ? "Debit" : "Credit",
        amount: valuationDeltaAmount,
        accountType: "Stock",
        referenceType: "Adjustment",
        referenceId: adjRefId,
        notes: `Physical inventory re-evaluation delta for ${adjustingItem.code} (${reasonNotes})`,
      });

      newLedgerEntries.push({
        id: `${ledgerIdBase}-b`,
        date: today,
        partyName: "Stock Adjustment Loss / Gain",
        type: isIncrease ? "Credit" : "Debit",
        amount: valuationDeltaAmount,
        accountType: isIncrease ? "Sales" : "Purchase", // Offset accounts
        referenceType: "Adjustment",
        referenceId: adjRefId,
        notes: `Inventory adjustment reconciliation balancing ledger entries`,
      });
    }

    // Update state
    const updatedItems = state.items.map((it) => {
      if (it.id === adjustingItem.id) {
        const warehouseStocks = { ...it.warehouseStocks };
        warehouseStocks[adjustingWarehouseId] = newQty;
        const totalStock = Object.values(warehouseStocks).reduce((sum: number, val) => sum + (val || 0), 0);

        return {
          ...it,
          stockQuantity: totalStock,
          warehouseStocks,
        };
      }
      return it;
    });

    onUpdateState({
      ...state,
      items: updatedItems,
      stockMovements: [...state.stockMovements, newMovement],
      ledger: [...state.ledger, ...newLedgerEntries],
    });

    handleCloseAdjustment();
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Stock & Inventory Control</h2>
          <p className="text-sm text-gray-500">
            Monitor real-time warehouse quantities, check low-stock triggers, evaluate book-value assets, and log physical corrections.
          </p>
        </div>
      </div>

      {/* Visual Analytics Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Total Physical Stock Quantity */}
        <div className="bg-white border border-gray-100 p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Physical Stock</span>
            <span className="text-2xl font-black font-mono text-slate-900 block">
              {totalStockQuantity.toLocaleString()} <span className="text-xs font-medium text-slate-400">units</span>
            </span>
            <span className="text-[11px] text-emerald-600 font-semibold block flex items-center gap-1">
              <TrendingUp size={12} /> Across {totalItems} Catalog products
            </span>
          </div>
          <div className="p-3.5 bg-indigo-50 text-indigo-700 rounded-2xl">
            <Warehouse size={22} />
          </div>
        </div>

        {/* Valuation at Cost */}
        <div className="bg-white border border-gray-100 p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Valuation at Purchase Cost</span>
            <span className="text-2xl font-black font-mono text-slate-900 block">
              {formatINR(totalValuationCost)}
            </span>
            <span className="text-[11px] text-slate-500 block">Asset Book Value</span>
          </div>
          <div className="p-3.5 bg-slate-100 text-slate-700 rounded-2xl">
            <DollarSign size={22} />
          </div>
        </div>

        {/* Valuation at Sale Value */}
        <div className="bg-white border border-gray-100 p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Valuation at Selling Value</span>
            <span className="text-2xl font-black font-mono text-emerald-800 block">
              {formatINR(totalValuationSale)}
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold block">
              Estimated Gross Return
            </span>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-700 rounded-2xl">
            <TrendingUp size={22} />
          </div>
        </div>

        {/* Low-Stock Alert Monitor */}
        <div className={`border p-5 rounded-2xl flex items-center justify-between shadow-xs transition-all ${
          lowStockCount > 0 
            ? "bg-rose-50/40 border-rose-100 text-rose-950" 
            : "bg-white border-gray-100"
        }`}>
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Critical Low Stock</span>
            <span className="text-2xl font-black font-mono block">
              {lowStockCount} SKU{lowStockCount !== 1 ? "s" : ""}
            </span>
            <span className={`text-[11px] font-bold block ${
              lowStockCount > 0 ? "text-rose-600" : "text-emerald-600"
            }`}>
              {lowStockCount > 0 ? "Reorder recommendations active" : "Warehouse levels are healthy"}
            </span>
          </div>
          <div className={`p-3.5 rounded-2xl ${
            lowStockCount > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"
          }`}>
            <AlertTriangle size={22} />
          </div>
        </div>
      </div>

      {/* Directory Section with Search and Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-white flex flex-col md:flex-row gap-4 items-center justify-between rounded-t-xl">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search SKU code, name, category..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-none bg-white"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600">
              <Filter size={13} className="text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="focus:outline-none bg-transparent cursor-pointer font-bold text-gray-700"
              >
                <option value="All">All Categories</option>
                {categories.filter((cat) => cat !== "All").map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Warehouse Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600">
              <Warehouse size={13} className="text-indigo-500" />
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="focus:outline-none bg-transparent cursor-pointer font-bold text-indigo-700"
              >
                <option value="All">All Warehouses</option>
                {allowedWarehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock Level Selector Tab buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportStockCsv}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-100 flex items-center gap-2 transition-all cursor-pointer"
              title="Export stock data to CSV"
            >
              <Download size={14} /> Export CSV
            </button>

            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setStockFilter("All")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  stockFilter === "All"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                All Stock
              </button>
              <button
                onClick={() => setStockFilter("Low")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  stockFilter === "Low"
                    ? "bg-white text-rose-700 shadow-xs"
                    : "text-slate-500 hover:text-rose-600"
                }`}
              >
                <AlertTriangle size={12} /> Low Stock Only
              </button>
            </div>
          </div>
        </div>

        {/* Inventory Master Table */}
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center">
            <Inbox className="mx-auto text-gray-300 mb-2" size={32} />
            <p className="text-sm text-gray-500 font-medium">No inventory products match your query or filters.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-280px)] min-h-[300px] relative">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold">
                  <th className="p-4 bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">SKU / Item Code</th>
                  <th className="p-4 bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Product Name</th>
                  <th className="p-4 bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Category</th>
                  <th className="p-4 text-center bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Unit</th>
                  <th className="p-4 text-right bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Standard Cost</th>
                  <th className="p-4 text-center bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Min Threshold</th>
                  <th className="p-4 text-center bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Physical Stock</th>
                  <th className="p-4 text-center bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Stock Level Status</th>
                  <th className="p-4 text-right bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Cost Asset Value</th>
                  <th className="p-4 text-center bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-2xs whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-600">
                {filteredItems.map((item) => {
                  const isLowStock = item.stockQuantity <= item.minStockLevel;
                  const itemValuation = item.stockQuantity * item.purchasePrice;
                  
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/40">
                      <td className="p-4 font-bold font-mono text-gray-900">{item.code}</td>
                      <td className="p-4">
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        <p className="text-[10px] text-gray-400 max-w-sm truncate">{item.description}</p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-4 text-center font-mono text-gray-500 font-bold">{item.unit}</td>
                      <td className="p-4 text-right font-mono font-medium">{formatINR(item.purchasePrice)}</td>
                      <td className="p-4 text-center font-mono font-semibold text-slate-500">{item.minStockLevel}</td>
                      <td className={`p-4 text-center font-black font-mono text-sm ${
                        isLowStock ? "text-amber-700 bg-amber-50/30" : "text-gray-900"
                      }`}>
                        {item.stockQuantity}
                      </td>
                      <td className="p-4 text-center">
                        {isLowStock ? (
                          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                            <AlertTriangle size={11} /> Reorder Low
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 px-2.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                            <CheckCircle size={11} /> Stock OK
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold font-mono text-slate-800">
                        {formatINR(itemValuation)}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenAdjustment(item)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-100 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 text-[10px]"
                            title="Recalibrate physical stock quantities"
                          >
                            <Sliders size={11} /> Adjust Stock
                          </button>
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

      {/* Stock Adjustment Dialog (Modal Overlap overlay) */}
      {adjustingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl border border-gray-100 shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-[#002f1d] text-white p-5">
              <div className="flex items-center gap-2 mb-1">
                <Warehouse size={20} className="text-emerald-400" />
                <h3 className="text-lg font-bold">Physical Stock Adjustment</h3>
              </div>
              <p className="text-xs text-emerald-200">
                Correct physical stock counts for <span className="font-bold font-mono text-white">{adjustingItem.code}</span> ({adjustingItem.name})
              </p>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmitAdjustment} className="p-6 space-y-5">
              {/* Warehouse selector for adjustment */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Adjust In Warehouse *</label>
                <select
                  value={adjustingWarehouseId}
                  onChange={(e) => setAdjustingWarehouseId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none bg-white font-bold text-slate-800"
                >
                  {allowedWarehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Quantities Status banner */}
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex justify-between items-center text-xs font-semibold text-slate-600">
                <span>Selected Warehouse Stock:</span>
                <span className="font-mono text-sm font-black text-slate-900 bg-white border px-2 py-0.5 rounded">
                  {adjustingItem.warehouseStocks?.[adjustingWarehouseId] ?? 0} {adjustingItem.unit}
                </span>
              </div>

              {/* Adjustment Action Choice */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Adjustment Action</label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType("In")}
                    className={`py-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      adjustmentType === "In"
                        ? "bg-white text-emerald-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <Plus size={12} /> Add Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType("Out")}
                    className={`py-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      adjustmentType === "Out"
                        ? "bg-white text-rose-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <Minus size={12} /> Deduct Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType("Reset")}
                    className={`py-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      adjustmentType === "Reset"
                        ? "bg-white text-indigo-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <Activity size={12} /> Recalibrate
                  </button>
                </div>
              </div>

              {/* Numeric Input */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                  {adjustmentType === "In" && "Quantity to Add *"}
                  {adjustmentType === "Out" && "Quantity to Subtract *"}
                  {adjustmentType === "Reset" && "New Absolute Physical Stock Count *"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={adjustmentType === "Reset" ? "0" : "1"}
                    required
                    value={adjustQuantity || ""}
                    onChange={(e) => setAdjustQuantity(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-gray-200 p-2.5 pl-3 pr-16 text-sm font-bold focus:border-emerald-600 focus:outline-none"
                    placeholder="Enter quantity"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-gray-400 select-none">
                    {adjustingItem.unit}
                  </span>
                </div>
              </div>

              {/* Adjustment Reason/Memo */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Audit Notes / Reason *</label>
                <textarea
                  required
                  rows={2}
                  value={adjustmentNotes}
                  onChange={(e) => setAdjustmentNotes(e.target.value)}
                  placeholder="E.g., Physical stock count check, damaged grain sacks discard, item found in storage bin..."
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Form Actions footer */}
              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={handleCloseAdjustment}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#002f1d] hover:bg-[#00472c] text-white rounded-lg text-xs font-extrabold shadow-sm cursor-pointer"
                >
                  Commit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
