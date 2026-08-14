import React, { useState, useEffect, useRef, useMemo } from "react";
import { ERPState, GoodsReceipt, PurchaseOrder, Party, Item, GoodsReceiptItem, StockMovement, Warehouse } from "../types";
import { formatDate, formatINR, convertQuantity, getStrictConversionFactor, normalizeUnit, safeConfirm, safeAlert } from "../utils";
import { isWarehouseAllowed, getAllowedWarehouses } from "../utils/warehouseAuth";
import { downloadDocumentPDF } from "../utils/pdfGenerator";
import { INITIAL_COMPANY_PROFILE } from "../data";
import { Plus, Search, Eye, ArrowLeft, PackageCheck, Receipt, Edit, Trash2, Printer, Download, X } from "lucide-react";

interface GoodsReceiptsViewProps {
  state: ERPState;
  currentUserEmail?: string;
  onUpdateState: (newState: ERPState) => void;
  setCurrentTab?: (tab: string) => void;
}

export default function GoodsReceiptsView({ state, currentUserEmail, onUpdateState, setCurrentTab }: GoodsReceiptsViewProps) {
  const currentUser = useMemo(
    () => (state.teamMembers || []).find((m) => m.email.toLowerCase() === (currentUserEmail || "").toLowerCase()),
    [state.teamMembers, currentUserEmail]
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [viewingGRN, setViewingGRN] = useState<GoodsReceipt | null>(null);
  const [editingGRNId, setEditingGRNId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const company = state.companyProfile || INITIAL_COMPANY_PROFILE;

  const handleDownloadPDF = async (grn: GoodsReceipt) => {
    setIsDownloading(true);
    setViewingGRN(grn);
    setTimeout(async () => {
      const element = printRef.current || (document.querySelector(".printable-area") as HTMLElement);
      if (!element) {
        setIsDownloading(false);
        return;
      }
      try {
        await downloadDocumentPDF(element, `GRN_${grn.grnNumber}.pdf`);
      } catch (err) {
        console.error("Error generating PDF:", err);
        window.print();
      } finally {
        setIsDownloading(false);
      }
    }, 300);
  };

  const handlePrint = () => {
    window.print();
  };

  // Form states
  const [selectedPoId, setSelectedPoId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [receivedBy, setReceivedBy] = useState("Ketan Sharma (Warehouse Exec)");
  const [notes, setNotes] = useState("");
  // Mapping of itemId -> quantity received
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});
  // Mapping of itemId -> invoice rate (price)
  const [receivedRates, setReceivedRates] = useState<Record<string, number>>({});

  const warehouses = useMemo(
    () => getAllowedWarehouses(currentUser, state.warehouses),
    [currentUser, state.warehouses]
  );
  const [warehouseId, setWarehouseId] = useState(() => {
    return warehouses[0]?.id || "wh-main";
  });

  const handleDeleteGRN = (grnId: string) => {
    const grn = state.goodsReceipts.find((g) => g.id === grnId);
    if (!grn) return;

    // Check if there is any linked Purchase Bill
    const linkedBill = state.purchaseBills.find((b) => b.goodsReceiptId === grnId);
    if (linkedBill) {
      safeAlert(`Cannot delete this Goods Receipt because it is billed in Purchase Bill ${linkedBill.billNumber}. Please delete that Purchase Bill first.`);
      return;
    }

    if (!safeConfirm(`Are you sure you want to delete Goods Receipt ${grn.grnNumber}? This will reduce your physical stock levels and remove associated stock movements.`)) {
      return;
    }

    // 1. Revert stock levels
    const updatedItems = state.items.map((item) => {
      const grnItem = grn.items.find((gi) => gi.itemId === item.id);
      if (grnItem) {
        const oldWhId = grn.warehouseId || "wh-main";
        const warehouseStocks = { ...item.warehouseStocks };
        const grnUnit = grnItem.unit || item.purchaseUnit || item.unit;
        const stockQtyToRevert = grnItem.stockQuantityReceived ?? convertQuantity(grnItem.quantityReceived, grnUnit, item.unit, state.unitConversions);
        warehouseStocks[oldWhId] = Math.max(0, (warehouseStocks[oldWhId] || 0) - stockQtyToRevert);
        const totalStock = Object.values(warehouseStocks).reduce((sum: number, val) => sum + (val || 0), 0);

        return {
          ...item,
          stockQuantity: totalStock,
          warehouseStocks,
        };
      }
      return item;
    });

    // 2. Filter out stock movements
    const updatedMovements = state.stockMovements.filter(
      (m) => !(m.referenceType === "GRN" && m.referenceId === grnId)
    );

    // 3. Recalculate PO status
    const updatedPOs = state.purchaseOrders.map((po) => {
      if (po.id === grn.purchaseOrderId) {
        const otherGrns = state.goodsReceipts.filter((g) => g.purchaseOrderId === po.id && g.id !== grnId);
        const totalOrdered = po.items.reduce((sum, item) => sum + item.quantity, 0);
        const totalOtherReceived = otherGrns.reduce((sum, g) => {
          return sum + g.items.reduce((itemSum, gi) => itemSum + (gi.quantityReceived || 0), 0);
        }, 0);

        let newStatus: "Draft" | "Approved" | "Partially Received" | "Received" | "Closed" = "Approved";
        if (totalOtherReceived === 0) {
          newStatus = "Approved";
        } else if (totalOtherReceived < totalOrdered) {
          newStatus = "Partially Received";
        } else {
          newStatus = "Closed";
        }
        return { ...po, status: newStatus };
      }
      return po;
    });

    // 4. Update Goods Receipt list
    const updatedGRNs = state.goodsReceipts.filter((g) => g.id !== grnId);

    onUpdateState({
      ...state,
      goodsReceipts: updatedGRNs,
      items: updatedItems,
      stockMovements: updatedMovements,
      purchaseOrders: updatedPOs,
    });

    setViewingGRN(null);
  };

  const eligiblePOs = state.purchaseOrders.filter(
    (po) =>
      isWarehouseAllowed(currentUser, po.warehouseId) &&
      (po.status === "Approved" || po.status === "Partially Received" || po.status === "Received" || po.id === selectedPoId)
  );

  useEffect(() => {
    const prefillPoId = localStorage.getItem("prefill_po_id");
    if (prefillPoId) {
      localStorage.removeItem("prefill_po_id");
      setIsCreating(true);
      setSelectedPoId(prefillPoId);
      
      const po = state.purchaseOrders.find((o) => o.id === prefillPoId);
      if (po) {
        const initialQtys: Record<string, number> = {};
        const initialRates: Record<string, number> = {};
        po.items.forEach((item) => {
          const prevRec = state.goodsReceipts
            .filter((grn) => grn.purchaseOrderId === prefillPoId)
            .reduce((sum, grn) => {
              const matchingItem = grn.items.find((i) => i.itemId === item.itemId);
              return sum + (matchingItem ? (matchingItem.quantityReceived || 0) : 0);
            }, 0);
          initialQtys[item.itemId] = Math.max(0, item.quantity - prevRec);
          initialRates[item.itemId] = item.rate;
        });
        setReceivedQtys(initialQtys);
        setReceivedRates(initialRates);
      }
    }
  }, [state.purchaseOrders, state.goodsReceipts]);

  const filteredGRNs = state.goodsReceipts.filter((grn) => {
    const po = state.purchaseOrders.find((o) => o.id === grn.purchaseOrderId);
    const grnWarehouseId = grn.warehouseId || po?.warehouseId;
    if (!isWarehouseAllowed(currentUser, grnWarehouseId)) {
      return false;
    }
    const vendor = po ? state.parties.find((p) => p.id === po.vendorId) : null;
    return (
      grn.grnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      false
    );
  });

  const handlePoChange = (poId: string) => {
    setSelectedPoId(poId);
    const po = state.purchaseOrders.find((o) => o.id === poId);
    if (po) {
      const initialQtys: Record<string, number> = {};
      const initialRates: Record<string, number> = {};
      po.items.forEach((item) => {
        const prevRec = state.goodsReceipts
          .filter((grn) => grn.purchaseOrderId === poId)
          .reduce((sum, grn) => {
            const matchingItem = grn.items.find((i) => i.itemId === item.itemId);
            return sum + (matchingItem ? (matchingItem.quantityReceived || 0) : 0);
          }, 0);
        initialQtys[item.itemId] = Math.max(0, item.quantity - prevRec); // default to remaining pending qty
        initialRates[item.itemId] = item.rate; // default to PO item rate
      });
      setReceivedQtys(initialQtys);
      setReceivedRates(initialRates);
    } else {
      setReceivedQtys({});
      setReceivedRates({});
    }
  };

  const handleQtyChange = (itemId: string, qty: number) => {
    setReceivedQtys({
      ...receivedQtys,
      [itemId]: Math.max(0, qty),
    });
  };

  const handleRateChange = (itemId: string, rate: number) => {
    setReceivedRates({
      ...receivedRates,
      [itemId]: Math.max(0, rate),
    });
  };

  const handleEditClick = (grn: GoodsReceipt) => {
    setSelectedPoId(grn.purchaseOrderId);
    setDate(grn.date);
    setReceivedBy(grn.receivedBy);
    setNotes(grn.notes);
    
    const qtys: Record<string, number> = {};
    const rates: Record<string, number> = {};
    const po = state.purchaseOrders.find((o) => o.id === grn.purchaseOrderId);

    grn.items.forEach((item) => {
      qtys[item.itemId] = item.quantityReceived;
      const poItem = po?.items.find((pi) => pi.itemId === item.itemId);
      rates[item.itemId] = item.rate !== undefined ? item.rate : (poItem?.rate || 0);
    });
    setReceivedQtys(qtys);
    setReceivedRates(rates);
    
    setEditingGRNId(grn.id);
    setWarehouseId(grn.warehouseId || "wh-main");
    setIsCreating(true);
    setViewingGRN(null);
  };

  const handleSubmitGRN = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoId) {
      alert("Please select a Purchase Order.");
      return;
    }

    const po = state.purchaseOrders.find((o) => o.id === selectedPoId)!;

    // Validate UOM conversions for all items being received
    for (const poItem of po.items) {
      const dbItem = state.items.find((i) => i.id === poItem.itemId);
      const poUnit = poItem.unit || dbItem?.purchaseUnit || dbItem?.unit || "Units";
      const baseUnit = dbItem?.unit || "Units";
      const recQty = receivedQtys[poItem.itemId] ?? poItem.quantity;

      if (recQty > 0) {
        const convResult = getStrictConversionFactor(poUnit, baseUnit, state.unitConversions);
        if (!convResult.found) {
          alert(`No UOM conversion found for item "${poItem.name}" between purchase unit "${poUnit}" and inventory base unit "${baseUnit}". Please define a conversion rule in Unit Conversion Master.`);
          return;
        }
      }
    }

    // Construct GRN items with inherited PO unit and converted stock quantity
    const grnItems: GoodsReceiptItem[] = po.items.map((poItem) => {
      const dbItem = state.items.find((i) => i.id === poItem.itemId);
      const poUnit = poItem.unit || dbItem?.purchaseUnit || dbItem?.unit || "Units";
      const baseUnit = dbItem?.unit || "Units";
      const recQty = receivedQtys[poItem.itemId] ?? poItem.quantity;
      const convResult = getStrictConversionFactor(poUnit, baseUnit, state.unitConversions);
      const stockQty = recQty * convResult.factor;

      return {
        itemId: poItem.itemId,
        name: poItem.name,
        quantityReceived: recQty,
        unit: poUnit, // Requirement 1: Always inherit PO UOM!
        stockQuantityReceived: stockQty, // Converted quantity for stock posting!
        rate: receivedRates[poItem.itemId] !== undefined ? receivedRates[poItem.itemId] : poItem.rate,
      };
    });

    const targetGRNId = editingGRNId || "grn-" + Math.random().toString(36).substring(2, 9);
    const targetGRNNumber = editingGRNId 
      ? (state.goodsReceipts.find((g) => g.id === editingGRNId)?.grnNumber || `GRN-2026-${String(state.goodsReceipts.length + 1).padStart(4, "0")}`)
      : `GRN-2026-${String(state.goodsReceipts.length + 1).padStart(4, "0")}`;

    const newGRN: GoodsReceipt = {
      id: targetGRNId,
      grnNumber: targetGRNNumber,
      purchaseOrderId: selectedPoId,
      date,
      items: grnItems,
      receivedBy,
      notes,
      warehouseId,
    };

    // Update stock levels & append stock movements
    let baseItems = [...state.items];
    let baseMovements = [...state.stockMovements];

    if (editingGRNId) {
      const oldGRN = state.goodsReceipts.find((g) => g.id === editingGRNId);
      if (oldGRN) {
        const oldWhId = oldGRN.warehouseId || "wh-main";
        // Reverse old GRN items stock using converted stock quantities
        oldGRN.items.forEach((item) => {
          const idx = baseItems.findIndex((i) => i.id === item.itemId);
          if (idx !== -1) {
            const dbItem = baseItems[idx];
            const oldUnit = item.unit || dbItem.purchaseUnit || dbItem.unit;
            const stockQtyToRevert = item.stockQuantityReceived ?? convertQuantity(item.quantityReceived, oldUnit, dbItem.unit, state.unitConversions);
            const warehouseStocks = { ...baseItems[idx].warehouseStocks };
            warehouseStocks[oldWhId] = Math.max(0, (warehouseStocks[oldWhId] || 0) - stockQtyToRevert);
            const totalStock = Object.values(warehouseStocks).reduce((sum: number, val) => sum + (val || 0), 0);

            baseItems[idx] = {
              ...baseItems[idx],
              stockQuantity: totalStock,
              warehouseStocks,
            };
          }
        });
        // Remove old stock movements
        baseMovements = baseMovements.filter((m) => !(m.referenceType === "GRN" && m.referenceId === editingGRNId));
      }
    }

    grnItems.forEach((item) => {
      const idx = baseItems.findIndex((i) => i.id === item.itemId);
      if (idx !== -1) {
        const dbItem = baseItems[idx];
        const stockQtyToPost = item.stockQuantityReceived ?? convertQuantity(item.quantityReceived, item.unit || dbItem.unit, dbItem.unit, state.unitConversions);
        const targetWhId = warehouseId || "wh-main";
        const warehouseStocks = { ...baseItems[idx].warehouseStocks };
        warehouseStocks[targetWhId] = (warehouseStocks[targetWhId] || 0) + stockQtyToPost;
        const totalStock = Object.values(warehouseStocks).reduce((sum: number, val) => sum + (val || 0), 0);

        // Calculate rate per base inventory unit for valuation
        const itemTotalAmount = item.quantityReceived * (item.rate ?? dbItem.purchasePrice);
        const effectiveBaseRate = stockQtyToPost > 0 ? (itemTotalAmount / stockQtyToPost) : (item.rate || dbItem.purchasePrice);

        baseItems[idx] = {
          ...baseItems[idx],
          stockQuantity: totalStock,
          warehouseStocks,
          purchasePrice: effectiveBaseRate,
        };

        baseMovements.push({
          id: "sm-" + Math.random().toString(36).substring(2, 9),
          date,
          itemId: item.itemId,
          type: "In",
          quantity: stockQtyToPost, // Requirement 5: Stock posting always in inventory base unit!
          referenceType: "GRN",
          referenceId: targetGRNId,
          notes: `Received ${item.quantityReceived} ${item.unit || dbItem.unit} (${stockQtyToPost} ${dbItem.unit}) against ${po.orderNumber}` + (editingGRNId ? " (Edited)" : ""),
          warehouseId,
        });
      }
    });

    // Dynamically calculate status based on total received quantities in PO unit
    const currentPoGrns = (editingGRNId
      ? state.goodsReceipts.map((g) => (g.id === editingGRNId ? newGRN : g))
      : [...state.goodsReceipts, newGRN]
    ).filter((grn) => grn.purchaseOrderId === selectedPoId);

    const totalOrdered = po.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAllReceived = currentPoGrns.reduce((sum, grn) => {
      return sum + grn.items.reduce((itemSum, grnItem) => {
        const poItem = po.items.find((pi) => pi.itemId === grnItem.itemId);
        const poUnit = poItem?.unit || "Units";
        const grnUnit = grnItem.unit || poUnit;
        const recInPoUnit = convertQuantity(grnItem.quantityReceived || 0, grnUnit, poUnit, state.unitConversions);
        return itemSum + recInPoUnit;
      }, 0);
    }, 0);

    let newStatus: "Draft" | "Approved" | "Partially Received" | "Received" | "Closed" = "Approved";
    if (totalAllReceived === 0) {
      newStatus = "Approved";
    } else if (totalAllReceived < totalOrdered) {
      newStatus = "Partially Received";
    } else {
      newStatus = "Closed";
    }

    // Update PO status
    const updatedPOs = state.purchaseOrders.map((o) => {
      if (o.id === selectedPoId) {
        return { ...o, status: newStatus };
      }
      return o;
    });

    const updatedGRNs = editingGRNId
      ? state.goodsReceipts.map((g) => (g.id === editingGRNId ? newGRN : g))
      : [...state.goodsReceipts, newGRN];

    // Save
    const updatedState: ERPState = {
      ...state,
      goodsReceipts: updatedGRNs,
      items: baseItems,
      purchaseOrders: updatedPOs,
      stockMovements: baseMovements,
    };

    onUpdateState(updatedState);
    setIsCreating(false);
    setViewingGRN(newGRN);

    // Clear form
    setSelectedPoId("");
    setNotes("");
    setReceivedQtys({});
    setReceivedRates({});
    setEditingGRNId(null);
    setWarehouseId(warehouses[0]?.id || "wh-main");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Goods Receipts (GRN)</h2>
          <p className="text-sm text-gray-500">Record physical stock intake, verify quantities against POs, and update warehouse bin cards.</p>
        </div>
        {!isCreating && !viewingGRN && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-[#002f1d] text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[#00472c] transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={16} />
            Record Goods Receipt (GRN)
          </button>
        )}
        {(isCreating || viewingGRN) && (
          <button
            onClick={() => {
              setIsCreating(false);
              setViewingGRN(null);
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            Back to Receipts
          </button>
        )}
      </div>

      {/* Record GRN Form */}
      {isCreating && (
        <form onSubmit={handleSubmitGRN} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
            <PackageCheck className="text-emerald-700" size={20} />
            Record Physical Goods Inward
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Receive Into Warehouse *</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none cursor-pointer font-semibold text-slate-800"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Linked Purchase Order *</label>
              <select
                value={selectedPoId}
                onChange={(e) => handlePoChange(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
              >
                <option value="">-- Select Approved PO --</option>
                {eligiblePOs.map((po) => {
                  const vendor = state.parties.find((p) => p.id === po.vendorId);
                  return (
                    <option key={po.id} value={po.id}>
                      {po.orderNumber} - {vendor?.name} (Order Date: {po.date})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Receipt Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Received By *</label>
              <input
                type="text"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* PO items verifier list */}
          {selectedPoId && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-gray-900">Verify Delivered Quantities</h4>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                      <th className="p-3">Item Name</th>
                      <th className="p-3 text-right">Ordered Qty</th>
                      <th className="p-3 text-right text-emerald-800 bg-emerald-50/50">Previously Received</th>
                      <th className="p-3 text-right text-amber-800 bg-amber-50/50">Pending Qty</th>
                      <th className="p-3 text-right">PO Rate</th>
                      <th className="p-3 text-right w-36">Invoice Price *</th>
                      <th className="p-3 text-right w-36">This Receipt Qty *</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-gray-700">
                    {(() => {
                      const po = state.purchaseOrders.find((o) => o.id === selectedPoId);
                      if (!po) return null;
                      return po.items.map((item) => {
                        const itemObj = state.items.find((i) => i.id === item.itemId);
                        const poItemUnit = item.unit || itemObj?.purchaseUnit || itemObj?.unit || "Units";
                        const baseUnit = itemObj?.unit || "Units";

                        const prevRec = state.goodsReceipts
                          .filter((grn) => grn.purchaseOrderId === selectedPoId && grn.id !== editingGRNId)
                          .reduce((sum, grn) => {
                            const matchingItem = grn.items.find((i) => i.itemId === item.itemId);
                            if (!matchingItem) return sum;
                            const grnUnit = matchingItem.unit || poItemUnit;
                            return sum + convertQuantity(matchingItem.quantityReceived || 0, grnUnit, poItemUnit, state.unitConversions);
                          }, 0);
                        const pending = Math.max(0, item.quantity - prevRec);

                        const currentInputQty = receivedQtys[item.itemId] ?? pending;
                        const conv = getStrictConversionFactor(poItemUnit, baseUnit, state.unitConversions);
                        const calculatedStockQty = conv.found ? (currentInputQty * conv.factor) : 0;
                        const formattedStockQty = calculatedStockQty.toFixed(4).replace(/\.?0+$/, "");

                        return (
                          <tr key={item.itemId}>
                            <td className="p-3 font-semibold text-gray-900">
                              {item.name}
                              <span className="text-[10px] text-gray-400 block font-normal">
                                SKU: {itemObj?.code || "N/A"}
                              </span>
                            </td>
                            <td className="p-3 text-right font-medium text-gray-600">
                              {item.quantity} {poItemUnit}
                            </td>
                            <td className="p-3 text-right text-emerald-800 font-medium bg-emerald-50/30">
                              {prevRec} {poItemUnit}
                            </td>
                            <td className="p-3 text-right text-amber-800 font-semibold bg-amber-50/30">
                              {pending} {poItemUnit}
                            </td>
                            <td className="p-3 text-right font-medium font-mono text-gray-600">
                              {formatINR(item.rate)}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-gray-400 text-[10px]">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={receivedRates[item.itemId] ?? item.rate}
                                  onChange={(e) => handleRateChange(item.itemId, parseFloat(e.target.value) || 0)}
                                  required
                                  className="w-24 text-right rounded border border-gray-200 p-1.5 focus:border-emerald-600 focus:outline-none font-bold font-mono text-gray-800"
                                />
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={receivedQtys[item.itemId] ?? pending}
                                  onChange={(e) => handleQtyChange(item.itemId, parseFloat(e.target.value) || 0)}
                                  required
                                  className="w-24 text-right rounded border border-gray-200 p-1.5 focus:border-emerald-600 focus:outline-none font-bold"
                                />
                                <span className="text-[11px] font-bold text-gray-700 min-w-10 text-left">
                                  {poItemUnit}
                                </span>
                              </div>
                              {conv.found ? (
                                <div className="text-[10px] text-gray-600 mt-1 font-medium bg-emerald-50/60 px-2 py-0.5 rounded border border-emerald-100 text-right">
                                  <div>Entered: <span className="font-bold">{currentInputQty} {poItemUnit}</span></div>
                                  <div>Stock Quantity: <span className="font-bold text-emerald-800">{formattedStockQty} {baseUnit}</span></div>
                                </div>
                              ) : (
                                <div className="text-[10px] text-rose-700 font-bold mt-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-right">
                                  ⚠️ No UOM conversion found.
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Gate Entry Notes & Inspection Details</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record any moisture levels, damaged bags, or warehouse storage zone placements..."
              rows={3}
              className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-800 hover:bg-[#002f1d] text-[#f9f6f0] rounded-lg text-sm font-bold shadow-sm cursor-pointer"
            >
              Commit Goods Receipt & Increase Stock
            </button>
          </div>
        </form>
      )}

      {/* Viewing GRN Detail */}
      {viewingGRN && (
        <div className="space-y-4 max-w-3xl mx-auto">
          {/* Action header bar */}
          <div className="no-print bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setViewingGRN(null)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
            >
              <ArrowLeft size={14} /> Back to Directory
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
              >
                <Printer size={14} /> Print
              </button>
              <button
                onClick={() => handleDownloadPDF(viewingGRN)}
                disabled={isDownloading}
                className="px-4 py-2 bg-emerald-800 hover:bg-[#002f1d] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors disabled:opacity-50"
              >
                <Download size={14} /> {isDownloading ? "Generating PDF..." : "Download PDF"}
              </button>
            </div>
          </div>

          {/* Printable GRN Document */}
          <div ref={printRef} className="printable-area bg-white p-8 rounded-xl border border-gray-100 shadow-sm space-y-6 text-gray-900">
            {/* Header */}
            <div className="border-b pb-6 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-[#002f1d] text-[#f9f6f0] flex items-center justify-center font-extrabold text-sm rounded">
                    {company.name.charAt(0)}
                  </div>
                  <h2 className="text-xl font-black text-gray-950 tracking-tight">{company.name}</h2>
                </div>
                <p className="text-xs text-gray-500 max-w-sm">{company.address}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">GSTIN: {company.gstin}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-emerald-800 text-white text-xs font-extrabold uppercase tracking-wider rounded mb-2">
                  GOODS RECEIPT NOTE (GRN)
                </span>
                <p className="text-sm font-black text-gray-900 font-mono">{viewingGRN.grnNumber}</p>
                <p className="text-xs text-gray-500 mt-1">Receipt Date: <span className="font-bold text-gray-800">{formatDate(viewingGRN.date)}</span></p>
                <p className="text-xs text-gray-500">Received By: <span className="font-bold text-gray-800">{viewingGRN.receivedBy}</span></p>
              </div>
            </div>

            {/* Info Box */}
            <div className="grid grid-cols-2 gap-6 text-xs bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div>
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">SUPPLIER / VENDOR</span>
                {(() => {
                  const po = state.purchaseOrders.find((o) => o.id === viewingGRN.purchaseOrderId);
                  const vendor = po ? state.parties.find((p) => p.id === po.vendorId) : null;
                  return (
                    <>
                      <p className="font-bold text-gray-900 text-sm">{vendor?.name || "Direct Supplier"}</p>
                      <p className="text-gray-600 mt-0.5 whitespace-pre-line">{vendor?.address || "Address N/A"}</p>
                      <p className="text-gray-600 font-mono mt-1">GSTIN: {vendor?.gstin || "N/A"}</p>
                    </>
                  );
                })()}
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">DESTINATION & REFERENCES</span>
                <p className="text-gray-700">Destination Warehouse: <span className="font-bold text-indigo-800">{
                  state.warehouses?.find((w) => w.id === viewingGRN.warehouseId)?.name || "Main Warehouse"
                }</span></p>
                <p className="text-gray-700 mt-1">Purchase Order Ref: <span className="font-bold text-gray-900 font-mono">{
                  state.purchaseOrders.find((o) => o.id === viewingGRN.purchaseOrderId)?.orderNumber || "Direct Inward"
                }</span></p>
              </div>
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-700 font-bold border-b">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Received Item</th>
                    <th className="p-3 text-right">Invoice Rate</th>
                    <th className="p-3 text-right">Inward Quantity</th>
                    <th className="p-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {viewingGRN.items.map((item, idx) => {
                    const dbItem = state.items.find((i) => i.id === item.itemId);
                    const rate = item.rate !== undefined ? item.rate : (dbItem?.purchasePrice || 0);
                    const subtotal = item.quantityReceived * rate;
                    const itemUnit = item.unit || dbItem?.purchaseUnit || dbItem?.unit || "Units";
                    const baseUnit = dbItem?.unit || "Units";
                    const stockQty = item.stockQuantityReceived ?? convertQuantity(item.quantityReceived, itemUnit, baseUnit, state.unitConversions);
                    const formattedStockQty = Number(stockQty).toFixed(4).replace(/\.?0+$/, "");

                    return (
                      <tr key={idx}>
                        <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-semibold text-gray-900">{item.name}</td>
                        <td className="p-3 text-right font-mono">{formatINR(rate)}</td>
                        <td className="p-3 text-right font-semibold text-emerald-800">
                          +{item.quantityReceived} {itemUnit} ({formattedStockQty} {baseUnit})
                        </td>
                        <td className="p-3 text-right font-bold font-mono text-gray-900">{formatINR(subtotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {viewingGRN.notes && (
              <div className="p-3 bg-gray-50 rounded border text-xs text-gray-600">
                <span className="font-bold text-gray-700 block mb-0.5">Inward Verification Remarks:</span>
                <span className="italic">{viewingGRN.notes}</span>
              </div>
            )}

            {/* Footer / Signatures */}
            <div className="border-t pt-8 grid grid-cols-2 gap-6 text-xs text-gray-500">
              <div>
                <p className="font-bold text-gray-700">Inspected & Verified By</p>
                <p className="mt-8 pt-2 border-t border-gray-300 w-48 text-[10px] text-gray-400">Stores / Quality Incharge</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-700">For {company.name}</p>
                <p className="mt-8 pt-2 border-t border-gray-300 w-48 ml-auto text-[10px] text-gray-400">Authorized Receiver</p>
              </div>
            </div>
          </div>

          {/* Quick Billing Action */}
          <div className="no-print border-t pt-4 flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleEditClick(viewingGRN)}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
              >
                <Edit size={14} />
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDeleteGRN(viewingGRN.id)}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>

            <div className="flex gap-2">
              {(() => {
                const matchingBill = state.purchaseBills.find((b) => b.goodsReceiptId === viewingGRN.id);
                if (matchingBill) {
                  return (
                    <div className="flex items-center gap-2 text-xs font-semibold px-3 py-2 bg-emerald-50 text-emerald-800 rounded border border-emerald-100">
                      <Receipt size={14} />
                      Billed via invoice: <span className="font-bold">{matchingBill.billNumber}</span> ({matchingBill.status})
                    </div>
                  );
                } else if (setCurrentTab) {
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.setItem("prefill_grn_id", viewingGRN.id);
                        setCurrentTab("purchase-bills");
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-[#002f1d] hover:bg-[#00472c] text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
                    >
                      <Receipt size={14} />
                      Record Purchase Bill Against This GRN
                    </button>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* GRN List */}
      {!isCreating && !viewingGRN && (
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
                placeholder="Search GRN # or vendor..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-none bg-white"
              />
            </div>
            <span className="text-xs text-gray-400 font-medium font-mono">
              Total Recorded Inwards: {state.goodsReceipts.length} GRNs
            </span>
          </div>

          {filteredGRNs.length === 0 ? (
            <p className="text-sm text-gray-500 py-12 text-center">No Goods Receipt records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold">
                    <th className="p-4">GRN Number</th>
                    <th className="p-4">Purchase Order</th>
                    <th className="p-4">Vendor</th>
                    <th className="p-4">Warehouse</th>
                    <th className="p-4 hidden">Arrival Date</th>
                    <th className="p-4">Received By</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-600">
                  {filteredGRNs.slice().reverse().map((grn) => {
                    const po = state.purchaseOrders.find((o) => o.id === grn.purchaseOrderId);
                    const vendor = po ? state.parties.find((p) => p.id === po.vendorId) : null;
                    return (
                      <tr key={grn.id} className="hover:bg-gray-50/40">
                        <td className="p-4 font-bold text-emerald-800">{grn.grnNumber}</td>
                        <td className="p-4 font-semibold text-indigo-800">{po?.orderNumber || "Direct"}</td>
                        <td className="p-4 font-semibold text-gray-900">{vendor?.name || "Unknown"}</td>
                        <td className="p-4 font-medium text-slate-600">
                          {state.warehouses?.find((w) => w.id === grn.warehouseId)?.name || "Main Warehouse"}
                        </td>
                        <td className="p-4 hidden">{formatDate(grn.date)}</td>
                        <td className="p-4 text-gray-500">{grn.receivedBy}</td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-1.5">
                            <button
                              onClick={() => setViewingGRN(grn)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded border border-emerald-100 flex items-center justify-center gap-1 font-bold text-[10px] cursor-pointer"
                            >
                              <Eye size={13} /> View
                            </button>
                            <button
                              onClick={() => handleDownloadPDF(grn)}
                              className="p-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded flex items-center justify-center gap-1 font-bold text-[10px] cursor-pointer"
                              title="Download GRN PDF"
                            >
                              <Download size={13} /> PDF
                            </button>
                            <button
                              onClick={() => handleDeleteGRN(grn.id)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-100 flex items-center justify-center gap-1 font-bold text-[10px] cursor-pointer"
                              title="Delete Goods Receipt"
                            >
                              <Trash2 size={13} />
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
      )}
    </div>
  );
}
