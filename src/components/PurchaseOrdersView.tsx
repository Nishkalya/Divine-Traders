import React, { useState, useEffect, useRef } from "react";
import { ERPState, PurchaseOrder, Party, Item, PurchaseOrderItem } from "../types";
import { formatINR, formatDate, getConversionFactor, numberToIndianWords, safeConfirm } from "../utils";
import { isWarehouseAllowed, getAllowedWarehouses } from "../utils/warehouseAuth";
import { downloadDocumentPDF } from "../utils/pdfGenerator";
import { Plus, Search, Eye, ArrowLeft, CheckCircle2, ShieldAlert, Trash2, Package, ChevronDown, Check, Edit, Download, X, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

interface SearchableItemSelectProps {
  value: string;
  onChange: (value: string) => void;
  items: Array<{ id: string; name: string; code: string; stockQuantity: number; unit: string }>;
  placeholder?: string;
}

function SearchableItemSelect({ value, onChange, items, placeholder = "Select stock item" }: SearchableItemSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((i) => i.id === value);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded border border-gray-200 p-2 text-xs focus:border-emerald-600 focus:outline-none bg-white text-gray-700 font-semibold flex items-center justify-between text-left cursor-pointer h-9 shadow-sm"
      >
        <span className="truncate">
          {selectedItem 
            ? `${selectedItem.code} - ${selectedItem.name} (Stock: ${selectedItem.stockQuantity} ${selectedItem.unit})` 
            : placeholder}
        </span>
        <ChevronDown size={14} className="text-gray-400 shrink-0 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-150 flex items-center gap-1.5 bg-gray-50">
            <Search size={12} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search SKU code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none text-xs focus:outline-none text-gray-700 p-0.5"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1 py-1 max-h-48">
            {filteredItems.length === 0 ? (
              <div className="p-3 text-xs text-gray-400 text-center italic">No items found</div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === value;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange(item.id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer ${
                      isSelected ? "bg-emerald-50/50 text-emerald-600 font-semibold" : "text-gray-700"
                    }`}
                  >
                    <span className="truncate">
                      <span className="font-mono font-bold bg-gray-100 px-1 py-0.5 rounded text-[10px] text-gray-600 mr-1.5">
                        {item.code}
                      </span>
                      {item.name}
                      <span className="text-gray-400 text-[10px] ml-1.5">
                        (Stock: {item.stockQuantity} {item.unit})
                      </span>
                    </span>
                    {isSelected && <Check size={12} className="text-emerald-600 shrink-0 ml-2" />}
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

interface PurchaseOrdersViewProps {
  state: ERPState;
  currentUserEmail?: string;
  onUpdateState: (newState: ERPState) => void;
  selectedOrderId?: string;
  setSelectedOrderId?: (id: string) => void;
  setCurrentTab?: (tab: string) => void;
}

export default function PurchaseOrdersView({
  state,
  currentUserEmail,
  onUpdateState,
  selectedOrderId,
  setSelectedOrderId,
  setCurrentTab,
}: PurchaseOrdersViewProps) {
  const currentUser = React.useMemo(
    () => (state.teamMembers || []).find((m) => m.email.toLowerCase() === (currentUserEmail || "").toLowerCase()),
    [state.teamMembers, currentUserEmail]
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(
    selectedOrderId ? state.purchaseOrders.find((po) => po.id === selectedOrderId) || null : null
  );

  React.useEffect(() => {
    if (selectedOrderId) {
      const found = state.purchaseOrders.find((po) => po.id === selectedOrderId);
      if (found) {
        setViewingPO(found);
        setIsCreating(false);
      }
    }
  }, [selectedOrderId, state.purchaseOrders]);
  const [editingPOId, setEditingPOId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingPOId, setDownloadingPOId] = useState<string | null>(null);
  const printRef = React.useRef<HTMLDivElement>(null);

  const getReceivedQtyForPoItem = (poId: string, itemId: string) => {
    const grns = state.goodsReceipts.filter((g) => g.purchaseOrderId === poId);
    return grns.reduce((sum, grn) => {
      const item = grn.items.find((i) => i.itemId === itemId);
      return sum + (item ? (item.quantityReceived || 0) : 0);
    }, 0);
  };

  const handleDeletePO = (poId: string) => {
    if (!safeConfirm("Are you sure you want to delete this Purchase Order? This will permanently remove it from records.")) {
      return;
    }
    const updatedPOs = state.purchaseOrders.filter((po) => po.id !== poId);
    onUpdateState({
      ...state,
      purchaseOrders: updatedPOs,
    });
    if (viewingPO && viewingPO.id === poId) {
      setViewingPO(null);
    }
  };

  const handleEditPO = (po: PurchaseOrder) => {
    setEditingPOId(po.id);
    setInvoiceType(po.orderNumber.startsWith("DIVI-NG") ? "NON_GST" : "GST");
    setVendorId(po.vendorId);
    setDate(po.date);
    setStatus(po.status as any);
    setNotes(po.notes);
    
    const vendor = state.parties.find((p) => p.id === po.vendorId);
    setIsInterstate(vendor?.gstin ? !vendor.gstin.startsWith("27") : false);

    setItemsList(
      po.items.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        rate: item.rate,
        unit: item.unit,
        taxRate: (item.taxRate !== undefined ? item.taxRate : 18) as 0 | 5 | 18,
      }))
    );
    setIsCreating(true);
    setViewingPO(null);
  };

  const handlePrint = (poNumber: string) => {
    const originalTitle = document.title;
    document.title = `PurchaseOrder_${poNumber}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 500);
  };

  const handleDownloadPDF = async (poNumber: string) => {
    const element = (printRef.current || document.querySelector(".printable-area")) as HTMLElement;
    if (!element) return;

    setIsDownloading(true);
    try {
      await downloadDocumentPDF(element, `PurchaseOrder_${poNumber}.pdf`);
    } catch (error) {
      console.error("Error generating PDF, falling back to handlePrint():", error);
      handlePrint(poNumber);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadPODirectly = async (po: PurchaseOrder) => {
    if (downloadingPOId) return;
    setDownloadingPOId(po.id);
    const prevViewing = viewingPO;
    setViewingPO(po);
    setTimeout(async () => {
      try {
        await handleDownloadPDF(po.orderNumber);
      } catch (e) {
        console.error(e);
      } finally {
        setViewingPO(prevViewing);
        setDownloadingPOId(null);
      }
    }, 400);
  };

  // Form states for creating new PO
  const [invoiceType, setInvoiceType] = useState<"GST" | "NON_GST">("GST");
  const [vendorId, setVendorId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState<"Draft" | "Approved">("Approved");
  const [notes, setNotes] = useState("");
  const [isInterstate, setIsInterstate] = useState(false);
  const [itemsList, setItemsList] = useState<Array<{ itemId: string; quantity: number; rate: number; unit?: string; taxRate: 0 | 5 | 18 }>>([
    { itemId: "", quantity: 10, rate: 0, taxRate: 18 },
  ]);

  // Inline Vendor Modal State
  const [showInlinePartyModal, setShowInlinePartyModal] = useState(false);
  const [inlinePartyMode, setInlinePartyMode] = useState<"add" | "edit">("add");
  const [inlinePartyName, setInlinePartyName] = useState("");
  const [inlinePartyEmail, setInlinePartyEmail] = useState("");
  const [inlinePartyPhone, setInlinePartyPhone] = useState("");
  const [inlinePartyAddress, setInlinePartyAddress] = useState("");
  const [inlinePartyGstin, setInlinePartyGstin] = useState("");
  const [inlinePartyOpeningBalance, setInlinePartyOpeningBalance] = useState(0);

  const handleAddVendorInline = () => {
    setInlinePartyMode("add");
    setInlinePartyName("");
    setInlinePartyEmail("");
    setInlinePartyPhone("");
    setInlinePartyAddress("");
    setInlinePartyGstin("");
    setInlinePartyOpeningBalance(0);
    setShowInlinePartyModal(true);
  };

  const handleEditVendorInline = () => {
    const vendor = state.parties.find((p) => p.id === vendorId);
    if (!vendor) return;
    setInlinePartyMode("edit");
    setInlinePartyName(vendor.name);
    setInlinePartyEmail(vendor.email || "");
    setInlinePartyPhone(vendor.phone || "");
    setInlinePartyAddress(vendor.address || "");
    setInlinePartyGstin(vendor.gstin || "");
    setInlinePartyOpeningBalance(vendor.openingBalance || 0);
    setShowInlinePartyModal(true);
  };

  const handleDeleteVendorInline = () => {
    const vendor = state.parties.find((p) => p.id === vendorId);
    if (!vendor) return;
    if (confirm(`Are you sure you want to delete the vendor ${vendor.name}? This will remove them from the system.`)) {
      const updatedParties = state.parties.filter((p) => p.id !== vendorId);
      onUpdateState({ ...state, parties: updatedParties });
      setVendorId("");
    }
  };

  const handleSaveInlineParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlinePartyName.trim()) {
      alert("Name is required.");
      return;
    }

    let updatedParties = [...state.parties];
    let savedPartyId = vendorId;

    if (inlinePartyMode === "edit") {
      updatedParties = updatedParties.map((p) => {
        if (p.id === vendorId) {
          return {
            ...p,
            name: inlinePartyName.trim(),
            email: inlinePartyEmail.trim(),
            phone: inlinePartyPhone.trim(),
            address: inlinePartyAddress.trim(),
            gstin: inlinePartyGstin.trim().toUpperCase(),
            openingBalance: inlinePartyOpeningBalance,
          };
        }
        return p;
      });
    } else {
      const newPartyId = "p-" + Math.random().toString(36).substring(2, 9);
      const newParty = {
        id: newPartyId,
        name: inlinePartyName.trim(),
        type: "Vendor" as const,
        email: inlinePartyEmail.trim(),
        phone: inlinePartyPhone.trim(),
        address: inlinePartyAddress.trim(),
        gstin: inlinePartyGstin.trim().toUpperCase(),
        openingBalance: inlinePartyOpeningBalance,
      };
      updatedParties.push(newParty);
      savedPartyId = newPartyId;
    }

    onUpdateState({ ...state, parties: updatedParties });
    setVendorId(savedPartyId);
    setShowInlinePartyModal(false);
  };

  const vendors = state.parties.filter((p) => p.type === "Vendor" || p.type === "Both");
  const stockItems = state.items;

  // Filter POs
  const filteredPOs = state.purchaseOrders.filter((po) => {
    if (!isWarehouseAllowed(currentUser, po.warehouseId)) {
      return false;
    }
    const vendor = state.parties.find((p) => p.id === po.vendorId);
    const numMatch = po.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const vendorMatch = vendor?.name.toLowerCase().includes(searchTerm.toLowerCase()) || false;
    return numMatch || vendorMatch;
  });

  const handleInvoiceTypeChange = (type: "GST" | "NON_GST") => {
    setInvoiceType(type);
    const defaultTaxRate = type === "NON_GST" ? 0 : 18;
    setItemsList(itemsList.map(item => ({ ...item, taxRate: defaultTaxRate })));
  };

  const handleTaxRateChange = (index: number, taxRate: 0 | 5 | 18) => {
    const updated = [...itemsList];
    updated[index].taxRate = taxRate;
    setItemsList(updated);
  };

  const handleAddItemRow = () => {
    const defaultTaxRate = invoiceType === "NON_GST" ? 0 : 18;
    setItemsList([...itemsList, { itemId: "", quantity: 10, rate: 0, taxRate: defaultTaxRate }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (itemsList.length === 1) return;
    setItemsList(itemsList.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, itemId: string) => {
    const alreadyExistsIndex = itemsList.findIndex((item, idx) => idx !== index && item.itemId === itemId);
    if (alreadyExistsIndex !== -1) {
      alert(`This item is already added to this order. Please adjust the quantity on the existing row instead of adding a duplicate.`);
      return;
    }
    const selectedItem = stockItems.find((i) => i.id === itemId);
    const updated = [...itemsList];
    updated[index].itemId = itemId;
    const defaultUnit = selectedItem ? (selectedItem.purchaseUnit || selectedItem.unit) : "";
    updated[index].unit = defaultUnit;
    
    if (selectedItem) {
      const factor = getConversionFactor(defaultUnit, selectedItem.unit, state.unitConversions);
      updated[index].rate = selectedItem.purchasePrice * factor;
    } else {
      updated[index].rate = 0;
    }
    setItemsList(updated);
  };

  const handleRowUnitChange = (index: number, unit: string) => {
    const updated = [...itemsList];
    const selectedItem = stockItems.find((i) => i.id === updated[index].itemId);
    updated[index].unit = unit;
    if (selectedItem) {
      const factor = getConversionFactor(unit, selectedItem.unit, state.unitConversions);
      updated[index].rate = selectedItem.purchasePrice * factor;
    }
    setItemsList(updated);
  };

  const handleQtyChange = (index: number, qty: number) => {
    const updated = [...itemsList];
    updated[index].quantity = Math.max(0.001, qty);
    setItemsList(updated);
  };

  const handleRateChange = (index: number, rate: number) => {
    const updated = [...itemsList];
    updated[index].rate = Math.max(0, rate);
    setItemsList(updated);
  };

  // Compute form totals
  const formSubtotal = itemsList.reduce((sum, item) => {
    return sum + item.quantity * item.rate;
  }, 0);

  // Dynamic GST calculation based on each item's taxRate and interstate status
  let formCgst = 0;
  let formSgst = 0;
  let formIgst = 0;

  itemsList.forEach((item) => {
    const itemAmount = item.quantity * item.rate;
    const rate = invoiceType === "NON_GST" ? 0 : (item.taxRate || 0);
    if (rate > 0) {
      if (isInterstate) {
        formIgst += Math.round(itemAmount * (rate / 100));
      } else {
        formCgst += Math.round(itemAmount * (rate / 200));
        formSgst += Math.round(itemAmount * (rate / 200));
      }
    }
  });

  const formTotal = formSubtotal + formCgst + formSgst + formIgst;

  const handleSubmitPO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      alert("Please select a vendor.");
      return;
    }

    const validItems = itemsList.filter((i) => i.itemId && i.quantity > 0);
    if (validItems.length === 0) {
      alert("Please add at least one valid item with quantity.");
      return;
    }

    let targetPOId = editingPOId;
    let targetOrderNumber = "";
    let basePOs = [...state.purchaseOrders];

    if (editingPOId) {
      const originalPO = state.purchaseOrders.find((po) => po.id === editingPOId);
      if (originalPO) {
        targetOrderNumber = originalPO.orderNumber;
      }
    }

    if (!targetOrderNumber) {
      const prefix = invoiceType === "NON_GST" ? "DIVI-NG" : "DIVI";
      const count = state.purchaseOrders.filter((po) => {
        if (invoiceType === "NON_GST") {
          return po.orderNumber.startsWith("DIVI-NG") || po.orderNumber.startsWith("DIVI-Z");
        } else {
          return (
            po.orderNumber.startsWith("DIVI-") &&
            !po.orderNumber.startsWith("DIVI-NG-") &&
            !po.orderNumber.startsWith("DIVI-Z-")
          );
        }
      }).length;
      targetOrderNumber = `${prefix}-2026-${String(count + 1).padStart(4, "0")}`;
    }

    const consolidatedItems: typeof validItems = [];
    validItems.forEach((v) => {
      const existing = consolidatedItems.find((ci) => ci.itemId === v.itemId);
      if (existing) {
        const oldQty = existing.quantity;
        const newQty = v.quantity;
        existing.quantity = oldQty + newQty;
        if (oldQty + newQty > 0) {
          existing.rate = (oldQty * existing.rate + newQty * v.rate) / (oldQty + newQty);
        }
      } else {
        consolidatedItems.push({ ...v });
      }
    });

    const poItems: PurchaseOrderItem[] = consolidatedItems.map((v) => {
      const dbItem = stockItems.find((i) => i.id === v.itemId)!;
      return {
        itemId: v.itemId,
        name: dbItem.name,
        quantity: v.quantity,
        rate: v.rate,
        unit: v.unit || dbItem.unit,
        amount: v.quantity * v.rate,
        taxRate: v.taxRate,
      };
    });

    const subtotal = poItems.reduce((sum, item) => sum + item.amount, 0);
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    poItems.forEach((item) => {
      const rate = invoiceType === "NON_GST" ? 0 : (item.taxRate || 0);
      if (rate > 0) {
        if (isInterstate) {
          igst += Math.round(item.amount * (rate / 100));
        } else {
          cgst += Math.round(item.amount * (rate / 200));
          sgst += Math.round(item.amount * (rate / 200));
        }
      }
    });
    const poTotal = subtotal + cgst + sgst + igst;

    const targetPO: PurchaseOrder = {
      id: targetPOId || ("po-" + Math.random().toString(36).substring(2, 9)),
      orderNumber: targetOrderNumber,
      vendorId,
      date,
      status,
      items: poItems,
      totalAmount: poTotal,
      notes,
    };

    let updatedPOs;
    if (editingPOId) {
      updatedPOs = basePOs.map((po) => po.id === editingPOId ? targetPO : po);
    } else {
      updatedPOs = [...basePOs, targetPO];
    }

    const updatedState: ERPState = {
      ...state,
      purchaseOrders: updatedPOs,
    };

    onUpdateState(updatedState);
    setIsCreating(false);
    setViewingPO(targetPO);
    setEditingPOId(null);

    // Clear form
    setInvoiceType("GST");
    setVendorId("");
    setNotes("");
    setIsInterstate(false);
    setItemsList([{ itemId: "", quantity: 10, rate: 0, taxRate: 18 }]);
  };

  const handleApprovePO = (poId: string) => {
    const updatedPOs = state.purchaseOrders.map((po) => {
      if (po.id === poId) {
        return { ...po, status: "Approved" as const };
      }
      return po;
    });

    const updatedState = { ...state, purchaseOrders: updatedPOs };
    onUpdateState(updatedState);
    
    // Update viewing state
    if (viewingPO && viewingPO.id === poId) {
      setViewingPO({ ...viewingPO, status: "Approved" });
    }
  };

  const statusColors: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-700 border-gray-200",
    Approved: "bg-blue-50 text-blue-700 border-blue-100",
    "Partially Received": "bg-sky-50 text-sky-700 border-sky-100",
    Received: "bg-amber-50 text-amber-700 border-amber-100",
    Closed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Purchase Orders</h2>
          <p className="text-sm text-gray-500">Log procurement requirements, get administrative approvals, and manage vendor supply queues.</p>
        </div>
        {!isCreating && !viewingPO && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-[#002f1d] text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[#00472c] transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={16} />
            Create Purchase Order
          </button>
        )}
        {isCreating && (
          <button
            onClick={() => {
              setIsCreating(false);
              setViewingPO(null);
              setEditingPOId(null);
              if (setSelectedOrderId) setSelectedOrderId("");
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            Back to PO List
          </button>
        )}
      </div>

      {/* Create PO Form */}
      {isCreating && (
        <form onSubmit={handleSubmitPO} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-gray-900 border-b pb-2">
            {editingPOId ? "Edit Purchase Order" : "New Purchase Order"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Invoice Type</label>
              <select
                value={invoiceType}
                onChange={(e) => handleInvoiceTypeChange(e.target.value as any)}
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none font-semibold text-slate-700 bg-white cursor-pointer"
              >
                <option value="GST">GST Invoice · DIVI-</option>
                <option value="NON_GST">Non-GST Invoice · DIVI-NG-</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-600 uppercase">Vendor *</label>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={handleAddVendorInline}
                    className="text-emerald-700 hover:text-emerald-800 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/80"
                  >
                    <Plus size={10} /> Add New
                  </button>
                  {vendorId && (
                    <>
                      <button
                        type="button"
                        onClick={handleEditVendorInline}
                        className="text-amber-600 hover:text-amber-700 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/80"
                      >
                        <Edit size={10} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteVendorInline}
                        className="text-rose-600 hover:text-rose-700 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/80"
                      >
                        <Trash2 size={10} /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none bg-white cursor-pointer"
              >
                <option value="">-- Select Vendor --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.gstin ? `(${v.gstin})` : "(No GSTIN)"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Order Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none bg-white cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Initial Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                required
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none font-semibold text-gray-700 bg-white cursor-pointer"
              >
                <option value="Approved">Approved (Ready to Receive)</option>
                <option value="Draft">Draft (Awaiting Approval)</option>
              </select>
            </div>
          </div>

          {/* Line Items Subform */}
          <div className="space-y-4">
            <h4 className="font-bold text-sm text-gray-900">Items to Purchase</h4>
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold">
                    <th className={`p-3 ${invoiceType === "NON_GST" ? "w-5/12" : "w-4/12"}`}>Item / SKU</th>
                    <th className="p-3 w-2/12">Quantity</th>
                    <th className="p-3 w-2/12">Purchase Price (₹)</th>
                    {invoiceType !== "NON_GST" && <th className="p-3 w-1/12">GST %</th>}
                    <th className="p-3 w-2/12">Estimated Amount (₹)</th>
                    <th className="p-3 w-1/12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {itemsList.map((row, index) => (
                    <tr key={index}>
                      <td className="p-3">
                        <SearchableItemSelect
                          value={row.itemId}
                          onChange={(val) => handleItemChange(index, val)}
                          items={stockItems}
                          placeholder="Select SKU"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={row.quantity}
                            onChange={(e) => handleQtyChange(index, parseFloat(e.target.value) || 0)}
                            required
                            className="w-full rounded border border-gray-200 p-1.5 focus:border-emerald-600 focus:outline-none font-bold text-gray-700 h-9"
                          />
                          {(() => {
                            const dbItem = stockItems.find((i) => i.id === row.itemId);
                            if (!dbItem) return <span className="text-[10px] font-bold text-gray-400 uppercase shrink-0">units</span>;
                            
                            const unitsOption = [dbItem.unit];
                            if (dbItem.salesUnit && dbItem.salesUnit !== dbItem.unit) {
                              unitsOption.push(dbItem.salesUnit);
                            }
                            if (dbItem.purchaseUnit && dbItem.purchaseUnit !== dbItem.unit && !unitsOption.includes(dbItem.purchaseUnit)) {
                              unitsOption.push(dbItem.purchaseUnit);
                            }
                            
                            return (
                              <select
                                value={row.unit || dbItem.unit}
                                onChange={(e) => handleRowUnitChange(index, e.target.value)}
                                className="rounded border border-gray-200 p-1 text-[10px] bg-white font-bold text-gray-700 focus:outline-none focus:border-emerald-600 shrink-0 cursor-pointer h-9"
                              >
                                {unitsOption.map(u => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.rate}
                          onChange={(e) => handleRateChange(index, parseFloat(e.target.value) || 0)}
                          required
                          className="w-full rounded border border-gray-200 p-1.5 focus:border-emerald-600 focus:outline-none"
                        />
                      </td>
                      {invoiceType !== "NON_GST" && (
                        <td className="p-3">
                          <select
                            value={row.taxRate}
                            onChange={(e) => handleTaxRateChange(index, parseInt(e.target.value) as any)}
                            className="rounded border border-gray-200 p-1 text-xs focus:border-emerald-600 focus:outline-none bg-white text-gray-700 font-bold font-mono cursor-pointer"
                          >
                            <option value="18">18%</option>
                            <option value="5">5%</option>
                            <option value="0">0%</option>
                          </select>
                        </td>
                      )}
                      <td className="p-3 font-semibold text-gray-800">
                        {formatINR(row.quantity * row.rate)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          disabled={itemsList.length === 1}
                          onClick={() => handleRemoveItemRow(index)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded disabled:opacity-30 cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={handleAddItemRow}
              className="text-xs text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} /> Add Row
            </button>
          </div>

          {/* Notes and Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Order Terms & Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Require standard packing and test reports on delivery."
                rows={3}
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
              />
              <div className="flex items-center pt-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInterstate}
                    onChange={(e) => setIsInterstate(e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-600 uppercase">Interstate Order (IGST)</span>
                </label>
              </div>
            </div>

            <div className="bg-slate-50/70 p-5 rounded-xl border border-gray-200 space-y-3 text-sm text-slate-600">
              <div className="flex justify-between font-semibold">
                <span>Subtotal</span>
                <span>{formatINR(formSubtotal)}</span>
              </div>
              {invoiceType !== "NON_GST" && (
                <>
                  {!isInterstate ? (
                    <>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>CGST ({formSubtotal > 0 ? `${Math.round((formCgst / formSubtotal) * 1000) / 10}%` : "9%"})</span>
                        <span>{formatINR(formCgst)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>SGST ({formSubtotal > 0 ? `${Math.round((formSgst / formSubtotal) * 1000) / 10}%` : "9%"})</span>
                        <span>{formatINR(formSgst)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>IGST ({formSubtotal > 0 ? `${Math.round((formIgst / formSubtotal) * 1000) / 10}%` : "18%"})</span>
                      <span>{formatINR(formIgst)}</span>
                    </div>
                  )}
                </>
              )}
              {invoiceType === "NON_GST" && (
                <div className="flex justify-between text-xs text-slate-400 italic">
                  <span>GST Exemption (0% GST)</span>
                  <span>₹0</span>
                </div>
              )}
              <div className="border-t border-slate-200 my-1 pt-3 flex justify-between font-bold text-slate-800 text-base">
                <span>Total Amount Due</span>
                <span className="text-emerald-700 font-extrabold">{formatINR(formTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingPOId(null);
              }}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-800 hover:bg-[#002f1d] text-[#f9f6f0] rounded-lg text-sm font-bold shadow-sm cursor-pointer"
            >
              {editingPOId ? "Save Changes" : "Save Purchase Order"}
            </button>
          </div>
        </form>
      )}

      {/* PO Detail View Modal */}
      {viewingPO && (() => {
        const company = {
          name: state.companyProfile?.name || "DIVINE TRADERS",
          description: state.companyProfile?.description || "Largest Manufacturer of Labels, Tags, & Packaging",
          address: state.companyProfile?.address || "S/O BHAWAR LAL PRAJAPAT, PACHEWAR MALPURA, Malpura, Tonk, Rajasthan, 304502",
          phone: state.companyProfile?.phone || "8561818645",
          email: state.companyProfile?.email || "nrmhr1@gmail.com",
          gstin: state.companyProfile?.gstin || "08CTVPP2940J2ZX",
          bankName: state.companyProfile?.bankName || "HDFC BANK LTD",
          bankBranch: state.companyProfile?.bankBranch || "SITAPURA IND. AREA",
          accountNumber: state.companyProfile?.accountNumber || "50200024514383",
          ifscCode: state.companyProfile?.ifscCode || "HDFC0003873",
          accountName: state.companyProfile?.accountName || state.companyProfile?.name || "DIVINE TRADERS"
        };

        const getCompanyStateDetails = (gstinStr: string, addrStr: string) => {
          if (gstinStr && gstinStr.length >= 2 && /^\d+$/.test(gstinStr.substring(0, 2))) {
            const code = gstinStr.substring(0, 2);
            const codesMap: Record<string, string> = {
              "08": "Rajasthan", "27": "Maharashtra", "07": "Delhi", "24": "Gujarat",
              "23": "Madhya Pradesh", "09": "Uttar Pradesh", "06": "Haryana", "03": "Punjab",
              "19": "West Bengal", "33": "Tamil Nadu", "29": "Karnataka", "36": "Telangana", "37": "Andhra Pradesh"
            };
            if (codesMap[code]) return { name: codesMap[code], code };
          }
          const addr = (addrStr || "").toLowerCase();
          if (addr.includes("rajasthan") || addr.includes("jaipur")) return { name: "Rajasthan", code: "08" };
          if (addr.includes("maharashtra") || addr.includes("mumbai") || addr.includes("vashi")) return { name: "Maharashtra", code: "27" };
          if (addr.includes("delhi")) return { name: "Delhi", code: "07" };
          return { name: "Rajasthan", code: "08" };
        };

        const getPartyStateDetails = (party?: Party) => {
          if (!party) return { name: "Rajasthan", code: "08" };
          if (party.gstin && party.gstin.length >= 2 && /^\d+$/.test(party.gstin.substring(0, 2))) {
            const code = party.gstin.substring(0, 2);
            const codesMap: Record<string, string> = {
              "08": "Rajasthan", "27": "Maharashtra", "07": "Delhi", "24": "Gujarat",
              "23": "Madhya Pradesh", "09": "Uttar Pradesh", "06": "Haryana", "03": "Punjab",
              "19": "West Bengal", "33": "Tamil Nadu", "29": "Karnataka", "36": "Telangana", "37": "Andhra Pradesh"
            };
            if (codesMap[code]) return { name: codesMap[code], code };
          }
          const addr = (party.address || "").toLowerCase();
          if (addr.includes("rajasthan") || addr.includes("jaipur")) return { name: "Rajasthan", code: "08" };
          if (addr.includes("maharashtra") || addr.includes("mumbai") || addr.includes("vashi")) return { name: "Maharashtra", code: "27" };
          if (addr.includes("delhi")) return { name: "Delhi", code: "07" };
          return { name: "Other State", code: "N/A" };
        };

        const companyState = getCompanyStateDetails(company.gstin, company.address);

        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-0 sm:p-3 md:p-4 overflow-hidden">
            <div className="bg-white w-[100vw] h-[100vh] sm:w-[98vw] sm:max-w-[98vw] lg:w-[94vw] lg:max-w-[94vw] 2xl:w-[95vw] 2xl:max-w-[95vw] sm:h-auto sm:max-h-[95vh] 2xl:max-h-[95vh] rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 shadow-2xl overflow-hidden relative my-0 sm:my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col">
              <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print shrink-0 sticky top-0 z-20">
                <div className="flex items-center gap-2 truncate mr-2">
                  <h3 className="text-[11px] sm:text-xs font-black text-slate-800 uppercase tracking-wider truncate">
                    Certified Purchase Order
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full border text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${statusColors[viewingPO.status]}`}>
                    {viewingPO.status}
                  </span>
                </div>
                <div className="flex gap-1.5 sm:gap-2 shrink-0 items-center">
                  {viewingPO.status === "Draft" && (
                    <button
                      onClick={() => handleApprovePO(viewingPO.id)}
                      className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <CheckCircle2 size={12} /> <span className="hidden sm:inline">Approve Order</span><span className="sm:hidden">Approve</span>
                    </button>
                  )}
                  {(viewingPO.status === "Approved" || viewingPO.status === "Partially Received" || viewingPO.status === "Closed") && setCurrentTab && (
                    <button
                      disabled={viewingPO.status === "Closed"}
                      onClick={() => {
                        localStorage.setItem("prefill_po_id", viewingPO.id);
                        setCurrentTab("goods-receipts");
                        setViewingPO(null);
                      }}
                      className={`px-2.5 sm:px-3 py-1.5 text-white rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-all ${
                        viewingPO.status === "Closed"
                          ? "bg-slate-300 text-slate-500 cursor-not-allowed opacity-75"
                          : "bg-amber-600 hover:bg-amber-700 cursor-pointer"
                      }`}
                    >
                      <Package size={12} /> <span className="hidden sm:inline">Receive Goods</span><span className="sm:hidden">Receive</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleEditPO(viewingPO)}
                    className="px-2.5 sm:px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 border border-slate-200 cursor-pointer transition-colors"
                  >
                    <Edit size={12} /> Edit
                  </button>
                  <button
                    onClick={() => handleDeletePO(viewingPO.id)}
                    className="px-2.5 sm:px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 border border-rose-100 cursor-pointer transition-colors"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                  <button
                    onClick={() => handleDownloadPDF(viewingPO.orderNumber)}
                    disabled={isDownloading}
                    className="px-2.5 sm:px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {isDownloading ? "Saving..." : "Save PDF"}
                  </button>
                  <button
                    onClick={() => {
                      setViewingPO(null);
                      setEditingPOId(null);
                      if (setSelectedOrderId) setSelectedOrderId("");
                    }}
                    className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors cursor-pointer border border-slate-200 bg-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Core PDF printable content block */}
              <div className="p-3 sm:p-5 md:p-6 overflow-y-auto overflow-x-hidden printable-area flex-1 bg-white w-full flex justify-center items-start" ref={printRef}>
                {/* Outermost border framing the whole Purchase Order */}
                <div className="w-full max-w-4xl mx-auto border-[1.5px] border-black text-black font-sans leading-tight bg-white">
                
                {/* Top Header border/sections */}
                <div className="grid grid-cols-3 border-b border-black px-4 py-1.5 text-[10px] font-bold select-none">
                  <div>GSTIN : {company.gstin}</div>
                  <div className="text-center">
                    <div className="font-extrabold uppercase text-xs tracking-wider">Purchase Order</div>
                    <div className="text-[8px] text-slate-500 italic">(ORIGINAL FOR SUPPLIER)</div>
                  </div>
                  <div className="text-right uppercase">E-WAY BILL ENHANCED</div>
                </div>

                {/* Logo and Brand Header */}
                <div className="grid grid-cols-12 border-b border-black p-4 items-center">
                  {/* Left part: Logo & Brand Name */}
                  <div className="col-span-8 flex items-center gap-4">
                    <div className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-blue-700 via-indigo-700 to-amber-500 rounded-lg shadow-inner border border-slate-300">
                      <span className="text-white text-base font-black italic tracking-tighter">DIVE</span>
                      <span className="absolute -top-1 -right-1 text-amber-400 text-xs">★</span>
                    </div>
                    <div className="space-y-1">
                      <h1 className="text-3xl font-black text-black tracking-widest font-serif leading-none uppercase">{company.name}</h1>
                      <div className="bg-black text-white text-[8px] font-black tracking-wider px-2 py-0.5 rounded uppercase inline-block">
                        {company.description}
                      </div>
                    </div>
                  </div>

                  {/* Right part: QR Code and Reference Info */}
                  <div className="col-span-4 flex items-start justify-end gap-3 font-mono text-[9px]">
                    <div className="w-16 h-16 border border-black p-0.5 bg-white flex flex-col justify-between shrink-0 select-none">
                      <div className="grid grid-cols-5 gap-0.5 h-full w-full opacity-90">
                        {Array.from({ length: 25 }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-full h-full ${
                              (i * 11 + 7) % 3 === 0 || i % 4 === 0 || i === 0 || i === 4 || i === 20 || i === 24 ? "bg-black" : "bg-white"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1 leading-tight text-right text-slate-900 select-none">
                      <div className="text-[8px] break-all text-left truncate max-w-[150px]" title={viewingPO.id}>
                        <span className="font-extrabold">PO-ID:</span> {viewingPO.id}
                      </div>
                      <div>
                        <span className="font-extrabold">Ref No. :</span> PO-{viewingPO.orderNumber}
                      </div>
                      <div>
                        <span className="font-extrabold">PO Date:</span> {formatDate(viewingPO.date)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seller and Buyer Info Section Grid */}
                <div className="grid grid-cols-2 border-b border-black text-[11px] leading-relaxed">
                  {/* Left Column: Divine Traders (Buyer in this case because PO is sent by Divine Traders) */}
                  <div className="border-r border-black flex flex-col justify-between divide-y divide-black">
                    {/* Buyer info (Divine Traders) */}
                    <div className="p-3 space-y-1">
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">BUYER (BILL TO)</div>
                      <div className="font-extrabold text-xs uppercase tracking-tight text-black">{company.name}</div>
                      <div className="text-slate-700 font-bold">
                        {company.address}
                      </div>
                      <div className="font-bold text-black font-sans">PH NO-{company.phone}</div>
                      <div className="grid grid-cols-12 gap-1 font-mono text-[10px] pt-1">
                        <div className="col-span-4 text-slate-500 font-sans font-semibold">GSTIN/UIN:</div>
                        <div className="col-span-8 font-extrabold">{company.gstin}</div>
                        
                        <div className="col-span-4 text-slate-500 font-sans font-semibold">State Name:</div>
                        <div className="col-span-8 font-extrabold">{companyState.name}, Code : {companyState.code}</div>
                        
                        <div className="col-span-4 text-slate-500 font-sans font-semibold">E-Mail:</div>
                        <div className="col-span-8 font-extrabold">{company.email}</div>
                      </div>
                    </div>

                    {/* Vendor details (Supplier / Seller) */}
                    <div className="p-3 space-y-1">
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">SUPPLIER (SENDER / SELLER)</div>
                      {(() => {
                        const vendor = state.parties.find((p) => p.id === viewingPO.vendorId);
                        const vendorState = getPartyStateDetails(vendor);
                        return (
                          <>
                            <div className="font-extrabold text-xs uppercase text-slate-900">{vendor?.name || "N/A"}</div>
                            <div className="text-slate-700 font-bold">{vendor?.address || "No Address Provided"}</div>
                            {vendor?.phone && (
                              <div className="font-bold text-black font-sans">PH NO - {vendor.phone}</div>
                            )}
                            <div className="grid grid-cols-12 gap-1 font-mono text-[10px] pt-1">
                              <div className="col-span-4 text-slate-500 font-sans font-semibold">GSTIN/UIN:</div>
                              <div className="col-span-8 font-extrabold">{vendor?.gstin || "URD (Unregistered)"}</div>

                              <div className="col-span-4 text-slate-500 font-sans font-semibold">State Name:</div>
                              <div className="col-span-8 font-extrabold">{vendorState.name}, Code : {vendorState.code}</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Right Column: Reference Grid */}
                  <div className="grid grid-cols-2 text-[10px] select-none font-semibold">
                    <div className="border-r border-b border-black p-2.5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">PO Order No.</div>
                      <div className="font-extrabold text-black text-xs">{viewingPO.orderNumber}</div>
                    </div>
                    <div className="border-b border-black p-2.5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Dated</div>
                      <div className="font-extrabold text-black text-xs">{formatDate(viewingPO.date)}</div>
                    </div>

                    <div className="border-r border-b border-black p-2.5 col-span-2">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Delivery Note</div>
                      <div className="font-bold text-slate-800">-</div>
                    </div>

                    <div className="border-r border-b border-black p-2.5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Reference No. &amp; Date</div>
                      <div className="font-bold text-slate-800">-</div>
                    </div>
                    <div className="border-b border-black p-2.5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Other References</div>
                      <div className="font-bold text-slate-800">-</div>
                    </div>

                    <div className="border-r border-b border-black p-2.5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Buyer's Order No.</div>
                      <div className="font-bold text-black">PI-158-159</div>
                    </div>
                    <div className="border-b border-black p-2.5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Dated</div>
                      <div className="font-bold text-black">{formatDate(viewingPO.date)}</div>
                    </div>

                    <div className="border-r border-b border-black p-2.5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Dispatch Doc No.</div>
                      <div className="font-bold text-slate-800">-</div>
                    </div>
                    <div className="border-b border-black p-2.5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Delivery Note Date</div>
                      <div className="font-bold text-slate-800">-</div>
                    </div>

                    <div className="border-r border-black p-2.5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Dispatched through</div>
                      <div className="font-bold text-slate-800">-</div>
                    </div>
                    <div className="p-2.5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Destination</div>
                      <div className="font-bold text-slate-800">-</div>
                    </div>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-black font-extrabold text-center select-none text-black">
                        <th className="border-r border-black p-2 text-center w-10">SI No.</th>
                        <th className="border-r border-black p-2 text-left">Description of Goods</th>
                        <th className="border-r border-black p-2 w-24">HSN/SAC</th>
                        <th className="border-r border-black p-2 w-16">GST Rate</th>
                        <th className="border-r border-black p-2 w-24">Quantity</th>
                        <th className="border-r border-black p-2 w-24">Rate</th>
                        <th className="border-r border-black p-2 w-16">per</th>
                        <th className="p-2 text-right w-28">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-900 font-semibold">
                      {viewingPO.items.map((item, idx) => {
                        const dbItem = state.items.find((i) => i.id === item.itemId);
                        const rateFormatted = item.rate.toFixed(2);
                        const unit = item.unit || dbItem?.unit || "PCS";
                        const taxRate = item.taxRate !== undefined ? item.taxRate : 18;
                        return (
                          <tr key={idx} className="align-top font-semibold border-b border-black/10">
                            <td className="border-r border-black p-2.5 text-center font-mono text-slate-600">{idx + 1}</td>
                            <td className="border-r border-black p-2.5">
                              <div className="font-extrabold text-black uppercase">{item.name}</div>
                              {dbItem && <div className="text-[9px] text-slate-500 font-medium">SKU: {dbItem.code}</div>}
                            </td>
                            <td className="border-r border-black p-2.5 text-center font-mono text-slate-600">
                              {dbItem?.hsnCode || "48211010"}
                            </td>
                            <td className="border-r border-black p-2.5 text-center font-mono text-slate-600">
                              {taxRate} %
                            </td>
                            <td className="border-r border-black p-2.5 text-right font-bold text-black">
                              {item.quantity}
                            </td>
                            <td className="border-r border-black p-2.5 text-right font-mono">
                              {rateFormatted}
                            </td>
                            <td className="border-r border-black p-2.5 text-center uppercase text-slate-600">
                              {unit}
                            </td>
                            <td className="p-2.5 text-right font-bold text-black font-mono">
                              {item.amount.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Dummy rows to pad the table so that vertical column lines stretch beautifully down like a real pre-printed invoice sheet */}
                      {(() => {
                        const minRows = 8;
                        const actualCount = viewingPO.items.length;
                        if (actualCount < minRows) {
                          return Array.from({ length: minRows - actualCount }).map((_, dIdx) => (
                            <tr key={`dummy-${dIdx}`} className="h-8 align-top">
                              <td className="border-r border-black p-2.5 text-center"></td>
                              <td className="border-r border-black p-2.5"></td>
                              <td className="border-r border-black p-2.5 text-center"></td>
                              <td className="border-r border-black p-2.5 text-center"></td>
                              <td className="border-r border-black p-2.5 text-right"></td>
                              <td className="border-r border-black p-2.5 text-right"></td>
                              <td className="border-r border-black p-2.5 text-center"></td>
                              <td className="p-2.5 text-right"></td>
                            </tr>
                          ));
                        }
                        return null;
                      })()}

                      {/* Subtotal Row inside table Amount column */}
                      <tr className="align-middle font-bold text-slate-900 border-t border-black/20 bg-slate-50/20">
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2 text-right text-slate-800 font-extrabold text-[10px] uppercase">
                          Sub Total
                        </td>
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2"></td>
                        <td className="border-r border-black p-2"></td>
                        <td className="p-2 text-right font-black text-black">
                          {viewingPO.items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                        </td>
                      </tr>

                      {/* CGST, SGST, IGST nested sub-rows inside table format */}
                      {(() => {
                        const isNonGST = viewingPO.orderNumber.startsWith("DIVI-NG");
                        if (isNonGST) return null;

                        const subtotal = viewingPO.items.reduce((sum, item) => sum + item.amount, 0);
                        const vendor = state.parties.find((p) => p.id === viewingPO.vendorId);
                        const isInterstatePO = vendor?.gstin ? !vendor.gstin.startsWith("27") : false;

                        let cgst = 0;
                        let sgst = 0;
                        let igst = 0;

                        viewingPO.items.forEach((item) => {
                          const itemAmount = item.amount;
                          const rate = item.taxRate !== undefined ? item.taxRate : 18;
                          if (rate > 0) {
                            if (isInterstatePO) {
                              igst += Math.round(itemAmount * (rate / 100));
                            } else {
                              cgst += Math.round(itemAmount * (rate / 200));
                              sgst += Math.round(itemAmount * (rate / 200));
                            }
                          }
                        });

                        // Reconcile rounding differences
                        if (viewingPO.totalAmount !== subtotal) {
                          if (isInterstatePO) {
                            igst = viewingPO.totalAmount - subtotal;
                          } else {
                            const totalTax = viewingPO.totalAmount - subtotal;
                            cgst = Math.round(totalTax / 2);
                            sgst = totalTax - cgst;
                          }
                        }

                        const subRows: React.ReactNode[] = [];
                        if (!isInterstatePO) {
                          if (cgst > 0) {
                            subRows.push(
                              <tr key="cgst-row" className="align-middle font-semibold text-slate-900">
                                <td className="border-r border-black p-2"></td>
                                <td className="border-r border-black p-2 text-right font-extrabold uppercase text-slate-800 text-[11px]">
                                  CGST
                                </td>
                                <td className="border-r border-black p-2"></td>
                                <td className="border-r border-black p-2"></td>
                                <td className="border-r border-black p-2"></td>
                                <td className="border-r border-black p-2"></td>
                                <td className="border-r border-black p-2"></td>
                                <td className="p-2 text-right font-black text-black">{cgst.toFixed(2)}</td>
                              </tr>
                            );
                          }
                          if (sgst > 0) {
                            subRows.push(
                              <tr key="sgst-row" className="align-middle font-semibold text-slate-900">
                                <td className="border-r border-black p-2"></td>
                                <td className="border-r border-black p-2 text-right font-extrabold uppercase text-slate-800 text-[11px]">
                                  SGST
                                Plat
                                </td>
                                <td className="border-r border-black p-2"></td>
                                <td className="border-r border-black p-2"></td>
                                <td className="border-r border-black p-2"></td>
                                <td className="border-r border-black p-2"></td>
                                <td className="border-r border-black p-2"></td>
                                <td className="p-2 text-right font-black text-black">{sgst.toFixed(2)}</td>
                              </tr>
                            );
                          }
                        } else {
                          if (igst > 0) {
                            subRows.push(
                              <tr key="igst-row" className="align-middle font-semibold text-slate-900">
                                <td className="border-r border-black p-2"></td>
                                <td className="border-r border-black p-2 text-right font-extrabold uppercase text-slate-800 text-[11px]">
                                  IGST
                                </td>
                                <td className="border-r border-black p-2"></td>
                                <td className="border-r border-black p-2"></td>
                                <td className="border-r border-black p-2"></td>
                                <td className="border-r border-black p-2"></td>
                                <td className="border-r border-black p-2"></td>
                                <td className="p-2 text-right font-black text-black">{igst.toFixed(2)}</td>
                              </tr>
                            );
                          }
                        }
                        return subRows;
                      })()}

                      {/* Total Row */}
                      {(() => {
                        const totalQty = viewingPO.items.reduce((sum, item) => sum + item.quantity, 0);
                        const unitSymbol = viewingPO.items[0]?.unit || "PCS";
                        return (
                          <tr className="border-t-[1.5px] border-black bg-slate-50 font-bold text-black align-middle text-[11px]">
                            <td className="border-r border-black p-2 text-center"></td>
                            <td className="border-r border-black p-2 font-black text-right uppercase">Total</td>
                            <td className="border-r border-black p-2"></td>
                            <td className="border-r border-black p-2"></td>
                            <td className="border-r border-black p-2 text-right font-black text-black">{totalQty} {unitSymbol}</td>
                            <td className="border-r border-black p-2"></td>
                            <td className="border-r border-black p-2"></td>
                            <td className="p-2 text-right font-black text-black text-xs">₹ {viewingPO.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Amount Chargeable (in words) section */}
                <div className="border-t border-black p-3 text-[11px] font-semibold bg-white">
                  <div className="flex justify-between items-center text-[9px] text-slate-500 font-black uppercase tracking-wider">
                    <span>Amount Chargeable (in words)</span>
                    <span className="font-extrabold">E. &amp; O.E</span>
                  </div>
                  <div className="font-black text-black text-xs mt-1">
                    {numberToIndianWords(viewingPO.totalAmount)}
                  </div>
                </div>

                {/* Bottom PAN, Remarks, Bank details and Authorized Signatory Grid */}
                <div className="grid grid-cols-2 text-[10px] border-t border-black font-semibold leading-normal select-none">
                  {/* Left Side: PAN, Declaration & Customer Seal */}
                  <div className="border-r border-black p-3 flex flex-col justify-between space-y-6">
                    <div>
                      <div className="grid grid-cols-12 gap-1 font-mono">
                        <div className="col-span-4 text-slate-500 font-sans font-bold">Company's PAN :</div>
                        <div className="col-span-8 font-black">AANFD1234B</div>
                      </div>
                      <div className="mt-4 space-y-1">
                        <div className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Declaration</div>
                        <p className="text-slate-600 font-semibold leading-relaxed italic">
                          This is a certified purchase order sent to the vendor. Kindly dispatch items in accordance with the specified shipping requirements.
                        </p>
                      </div>
                      {viewingPO.notes && (
                        <div className="mt-3 p-2 bg-slate-50 rounded border border-slate-200">
                          <span className="font-extrabold text-slate-800 block mb-0.5 text-[9px] uppercase tracking-wider">Remarks / Notes:</span>
                          <span className="text-slate-700 font-bold">{viewingPO.notes}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-8 text-center text-slate-400 font-black uppercase tracking-wider border-t border-dashed border-slate-200">
                      Customer's Seal and Signature
                    </div>
                  </div>

                  {/* Right Side: Bank details & Signature */}
                  <div className="p-3 flex flex-col justify-between space-y-6">
                    <div className="space-y-1">
                      <div className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Company's Bank Details</div>
                      <div className="grid grid-cols-12 gap-1 leading-normal text-slate-700">
                        <div className="col-span-4 font-extrabold">A/c Holder's Name:</div>
                        <div className="col-span-8 font-black text-black uppercase">{company.accountName}</div>
                        
                        <div className="col-span-4 font-extrabold">Bank Name:</div>
                        <div className="col-span-8 font-black text-black uppercase">{company.bankName}</div>
                        
                        <div className="col-span-4 font-extrabold">A/c No.:</div>
                        <div className="col-span-8 font-mono font-black text-black">{company.accountNumber}</div>
                        
                        <div className="col-span-4 font-extrabold">Branch &amp; IFS Code:</div>
                        <div className="col-span-8 font-mono font-black text-black uppercase">{company.bankBranch} &amp; {company.ifscCode}</div>
                      </div>
                    </div>

                    <div className="text-right pt-6">
                      <div className="font-black uppercase text-[9px] text-slate-500 tracking-widest">for {company.name}</div>
                      <div className="h-10"></div>
                      <div className="border-t border-dashed border-slate-200/80 pt-1 text-slate-800 font-black tracking-wide uppercase text-[9px]">
                        Authorised Signatory
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Sub-footer message */}
              <div className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest py-2 select-none">
                This is a Computer Generated Purchase Order
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* PO List */}
      {!isCreating && !viewingPO && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Filters */}
          <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search PO # or vendor..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-none bg-white"
              />
            </div>
            <span className="text-xs text-gray-400 font-medium font-mono">
              Showing {filteredPOs.length} of {state.purchaseOrders.length} orders
            </span>
          </div>

          {filteredPOs.length === 0 ? (
            <p className="text-sm text-gray-500 py-12 text-center">No purchase orders found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold">
                    <th className="p-4">PO Number</th>
                    <th className="p-4">Vendor</th>
                    <th className="p-4 hidden sm:table-cell">Order Date</th>
                    <th className="p-4 hidden sm:table-cell">Status</th>
                    <th className="p-4 text-right">Total Amount</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-600">
                  {filteredPOs.slice().reverse().map((po) => {
                    const vendor = state.parties.find((p) => p.id === po.vendorId);
                    return (
                      <tr key={po.id} className="hover:bg-gray-50/40">
                        <td className="p-4 font-bold text-indigo-800">{po.orderNumber}</td>
                        <td className="p-4 font-semibold text-gray-900">{vendor?.name || "Unknown"}</td>
                        <td className="p-4 hidden sm:table-cell">{formatDate(po.date)}</td>
                        <td className="p-4 hidden sm:table-cell">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusColors[po.status]}`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold text-gray-900">{formatINR(po.totalAmount)}</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => setViewingPO(po)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg flex items-center gap-1 text-[10px] font-bold border border-indigo-100 cursor-pointer transition-all"
                              title="View PO Details"
                            >
                              <Eye size={12} /> View
                            </button>
                            <button
                              onClick={() => handleDownloadPODirectly(po)}
                              disabled={downloadingPOId === po.id}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 disabled:bg-slate-50 text-emerald-700 disabled:text-slate-400 rounded-lg flex items-center gap-1 text-[10px] font-bold border border-emerald-100 disabled:border-slate-200 cursor-pointer transition-all"
                              title="Download PDF"
                            >
                              {downloadingPOId === po.id ? (
                                <span className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin"></span>
                              ) : (
                                <Download size={12} />
                              )}
                              <span>PDF</span>
                            </button>
                            <button
                              onClick={() => handleEditPO(po)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1 text-[10px] font-bold border border-slate-200 cursor-pointer transition-all"
                              title="Edit PO"
                            >
                              <Edit size={12} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeletePO(po.id)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg flex items-center gap-1 text-[10px] font-bold border border-rose-100 cursor-pointer transition-all"
                              title="Delete PO"
                            >
                              <Trash2 size={12} /> Delete
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

      {/* Inline Vendor Registry/Editor Modal */}
      {showInlinePartyModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white max-w-lg w-full rounded-3xl border border-slate-200 shadow-2xl relative overflow-hidden animate-scaleUp">
            {/* Colored top border bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-600"></div>
            
            <div className="p-6 md:p-8 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-800">
                  {inlinePartyMode === "edit" ? "Modify Vendor Account" : "Register New Vendor"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowInlinePartyModal(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveInlineParty} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Legal/Trade Name *</label>
                  <input
                    type="text"
                    required
                    value={inlinePartyName}
                    onChange={(e) => setInlinePartyName(e.target.value)}
                    placeholder="E.g., Ambika Distributors"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">GSTIN Identification Number</label>
                    <input
                      type="text"
                      value={inlinePartyGstin}
                      onChange={(e) => setInlinePartyGstin(e.target.value)}
                      maxLength={15}
                      placeholder="27AAACR1234D1Z0"
                      className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-emerald-600 focus:outline-none uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={inlinePartyPhone}
                      onChange={(e) => setInlinePartyPhone(e.target.value)}
                      placeholder="10-digit number"
                      className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-emerald-600 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    value={inlinePartyEmail}
                    onChange={(e) => setInlinePartyEmail(e.target.value)}
                    placeholder="sales@distributor.com"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Office / Warehouse Address</label>
                  <textarea
                    value={inlinePartyAddress}
                    onChange={(e) => setInlinePartyAddress(e.target.value)}
                    placeholder="Full postal address"
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowInlinePartyModal(false)}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-800 hover:bg-[#002f1d] text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-md"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
