import React, { useState, useEffect, useRef, useMemo } from "react";
import { ERPState, PurchaseReturn, PurchaseReturnItem, Item, Party, StockMovement, LedgerEntry } from "../types";
import { formatINR, formatDate, numberToIndianWords } from "../utils";
import { isWarehouseAllowed } from "../utils/warehouseAuth";
import { downloadDocumentPDF } from "../utils/pdfGenerator";
import { Plus, Search, Eye, ArrowLeft, CheckCircle2, ShieldAlert, Trash2, Undo2, ChevronDown, Check, Edit, Download, Printer, X } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

interface SearchableItemSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { id: string; name: string }[];
  placeholder: string;
}

function SearchableItemSelect({ value, onChange, options, placeholder }: SearchableItemSelectProps) {
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
  const filtered = options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 hover:border-slate-300 transition-colors cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
      >
        <span className="truncate">{selectedOption ? selectedOption.name : placeholder}</span>
        <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-150 rounded-xl shadow-xl max-h-56 overflow-y-auto p-1.5 space-y-1">
          <input
            type="text"
            className="w-full px-2.5 py-1.5 text-xs border border-slate-150 rounded-lg focus:outline-none focus:border-indigo-500 bg-slate-50/50"
            placeholder="Search option..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-40 overflow-y-auto pt-1 space-y-0.5">
            {filtered.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-2">No matching options</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left cursor-pointer transition-colors ${
                    value === opt.id ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">{opt.name}</span>
                  {value === opt.id && <Check size={12} className="text-indigo-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface PurchaseReturnsViewProps {
  state: ERPState;
  currentUserEmail?: string;
  onUpdateState: (newState: ERPState) => void;
  setCurrentTab?: (tab: string) => void;
}

export default function PurchaseReturnsView({ state, currentUserEmail, onUpdateState, setCurrentTab }: PurchaseReturnsViewProps) {
  const currentUser = useMemo(
    () => (state.teamMembers || []).find((m) => m.email.toLowerCase() === (currentUserEmail || "").toLowerCase()),
    [state.teamMembers, currentUserEmail]
  );
  const [isCreating, setIsCreating] = useState(false);
  const [viewingPR, setViewingPR] = useState<PurchaseReturn | null>(null);
  const [editingPRId, setEditingPRId] = useState<string | null>(null);
  const [downloadingPRId, setDownloadingPRId] = useState<string | null>(null);

  // Form States
  const [returnNumber, setReturnNumber] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [purchaseBillId, setPurchaseBillId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<PurchaseReturnItem[]>([]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"Draft" | "Returned">("Returned");

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const printRef = useRef<HTMLDivElement>(null);

  // Auto-generate Return Number on creation
  useEffect(() => {
    if (isCreating && !editingPRId) {
      const returns = state.purchaseReturns || [];
      const count = returns.length + 1;
      const formattedNum = `PR-${String(count).padStart(3, "0")}`;
      setReturnNumber(formattedNum);
    }
  }, [isCreating, editingPRId, state.purchaseReturns]);

  // Handle PO mapping selection
  const handlePOMapChange = (poId: string) => {
    setPurchaseOrderId(poId);
    if (!poId) return;

    const po = state.purchaseOrders.find((p) => p.id === poId);
    if (po) {
      setVendorId(po.vendorId);
      const isNonGst = po.orderNumber.startsWith("DIVI-NG");
      // Populate items from the PO with max quantities and initial rates
      const mappedItems: PurchaseReturnItem[] = po.items.map((pi) => ({
        itemId: pi.itemId,
        name: pi.name,
        quantity: pi.quantity, // Default to returning all (user can adjust)
        rate: pi.rate,
        amount: pi.quantity * pi.rate,
        taxRate: isNonGst ? 0 : (pi.taxRate !== undefined ? pi.taxRate : 18),
      }));
      setItems(mappedItems);
    }
  };

  // Handle Purchase Bill mapping selection
  const handleBillMapChange = (billId: string) => {
    setPurchaseBillId(billId);
    if (!billId) return;

    const bill = state.purchaseBills.find((b) => b.id === billId);
    if (bill) {
      setVendorId(bill.vendorId);
      const isNonGstBill = bill.invoiceType === "NON_GST" || (bill.cgst === 0 && bill.sgst === 0 && bill.igst === 0);
      // Map the items from the linked purchase order if possible
      if (bill.purchaseOrderId) {
        setPurchaseOrderId(bill.purchaseOrderId);
        const po = state.purchaseOrders.find((p) => p.id === bill.purchaseOrderId);
        if (po) {
          const mappedItems: PurchaseReturnItem[] = po.items.map((pi) => ({
            itemId: pi.itemId,
            name: pi.name,
            quantity: pi.quantity,
            rate: pi.rate,
            amount: pi.quantity * pi.rate,
            taxRate: isNonGstBill ? 0 : (pi.taxRate !== undefined ? pi.taxRate : 18),
          }));
          setItems(mappedItems);
        }
      }
    }
  };

  // Handle prefill from other views (such as recording a return against a purchase bill)
  useEffect(() => {
    const prefillBillId = localStorage.getItem("prefill_bill_id");
    if (prefillBillId) {
      localStorage.removeItem("prefill_bill_id");
      setIsCreating(true);
      setEditingPRId(null);
      setTimeout(() => {
        handleBillMapChange(prefillBillId);
      }, 50);
    }
  }, [state.purchaseBills]);

  const handleAddItem = () => {
    setItems([...items, { itemId: "", name: "", quantity: 1, rate: 0, amount: 0, taxRate: 18 }]);
  };

  const handleRemoveItem = (index: number) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };

  const handleItemFieldChange = (index: number, field: keyof PurchaseReturnItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === "itemId") {
      const alreadyExistsIndex = items.findIndex((itm, idx) => idx !== index && itm.itemId === value);
      if (alreadyExistsIndex !== -1) {
        alert("This item is already added to this return document. Please adjust the quantity on the existing line instead of adding a duplicate.");
        return;
      }
      const dbItem = state.items.find((i) => i.id === value);
      if (dbItem) {
        item.itemId = dbItem.id;
        item.name = dbItem.name;
        item.rate = dbItem.purchasePrice;
        item.taxRate = dbItem.gstRate || 18;
      }
    } else {
      (item as any)[field] = value;
    }

    item.amount = Number(item.quantity || 0) * Number(item.rate || 0);
    updated[index] = item;
    setItems(updated);
  };

  // Math Calculations
  const calculateTotals = () => {
    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    items.forEach((item) => {
      subtotal += item.amount;
      
      // Determine if Non-GST based on document links or explicit tax rate 0
      let isNonGst = false;
      if (purchaseOrderId) {
        const po = state.purchaseOrders.find((p) => p.id === purchaseOrderId);
        if (po && po.orderNumber.startsWith("DIVI-NG")) {
          isNonGst = true;
        }
      } else if (purchaseBillId) {
        const bill = state.purchaseBills.find((b) => b.id === purchaseBillId);
        if (bill && (bill.invoiceType === "NON_GST" || (bill.cgst === 0 && bill.sgst === 0 && bill.igst === 0))) {
          isNonGst = true;
        }
      }

      const taxRate = isNonGst ? 0 : (item.taxRate !== undefined ? item.taxRate : 18);
      const taxAmount = item.amount * (taxRate / 100);

      // Determine state of vendor to divide SGST/CGST or IGST
      // Standard local GST assumption: split equally 50/50. If outer state, IGST.
      const vendor = state.parties.find((p) => p.id === vendorId);
      const isInterstate = vendor?.address.toLowerCase().includes("state") && !vendor?.address.toLowerCase().includes("local"); // mock logic

      if (isInterstate) {
        igst += taxAmount;
      } else {
        cgst += taxAmount / 2;
        sgst += taxAmount / 2;
      }
    });

    return {
      subtotal,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      totalAmount: Math.round((subtotal + cgst + sgst + igst) * 100) / 100,
    };
  };

  const totals = calculateTotals();

  const handleSavePR = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      alert("Please select a vendor.");
      return;
      }
    if (items.length === 0 || items.some((item) => !item.itemId || item.quantity <= 0)) {
      alert("Please add at least one item with positive quantity.");
      return;
    }

    const prId = editingPRId || "pr-" + Math.random().toString(36).substring(2, 9);
    const vendorObj = state.parties.find((p) => p.id === vendorId)!;

    // Consolidate duplicate items in the return list
    const consolidatedReturnItems: PurchaseReturnItem[] = [];
    items.forEach((item) => {
      const existing = consolidatedReturnItems.find((ci) => ci.itemId === item.itemId);
      if (existing) {
        const oldQty = existing.quantity;
        const newQty = item.quantity;
        existing.quantity = oldQty + newQty;
        if (oldQty + newQty > 0) {
          existing.rate = (oldQty * existing.rate + newQty * item.rate) / (oldQty + newQty);
        }
        existing.amount = existing.quantity * existing.rate;
      } else {
        consolidatedReturnItems.push({ ...item });
      }
    });

    const newPR: PurchaseReturn = {
      id: prId,
      returnNumber,
      purchaseOrderId: purchaseOrderId || undefined,
      purchaseBillId: purchaseBillId || undefined,
      vendorId,
      date,
      items: consolidatedReturnItems,
      subtotal: totals.subtotal,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      totalAmount: totals.totalAmount,
      notes,
      status,
    };

    let updatedItems = [...state.items];
    let newMovements = [...state.stockMovements];
    let newLedgers = [...state.ledger];

    // Handle stock quantity reduction and accounting ONLY if status is "Returned"
    // If it was already "Returned" and we're editing, we should ideally reverse old changes.
    // For robust simplicity, if editing, we reverse old stock and ledger adjustments associated with this PR ID first.
    if (editingPRId) {
      const oldPR = (state.purchaseReturns || []).find((p) => p.id === editingPRId);
      if (oldPR && oldPR.status === "Returned") {
        // Reverse old stock levels
        oldPR.items.forEach((item) => {
          const idx = updatedItems.findIndex((i) => i.id === item.itemId);
          if (idx !== -1) {
            updatedItems[idx] = {
              ...updatedItems[idx],
              stockQuantity: updatedItems[idx].stockQuantity + item.quantity, // add back returned stock
            };
          }
        });
        // Remove old stock movements & ledger entries for this PR
        newMovements = newMovements.filter((sm) => sm.referenceId !== editingPRId);
        newLedgers = newLedgers.filter((l) => l.referenceId !== editingPRId);
      }
    }

    // Apply new returned stock levels and accounting entries if saved as "Returned"
    if (status === "Returned") {
      consolidatedReturnItems.forEach((item) => {
        const idx = updatedItems.findIndex((i) => i.id === item.itemId);
        if (idx !== -1) {
          updatedItems[idx] = {
            ...updatedItems[idx],
            stockQuantity: Math.max(0, updatedItems[idx].stockQuantity - item.quantity), // subtract returned stock
          };
        }

        // Add Stock Movement
        newMovements.push({
          id: "sm-" + Math.random().toString(36).substring(2, 9),
          date,
          itemId: item.itemId,
          type: "Out",
          quantity: item.quantity,
          referenceType: "Adjustment", // use Adjustment/Adjustment mapping
          referenceId: prId,
          notes: `Purchase Return ${returnNumber} processed to vendor`,
        });
      });

      // Add Ledger entries for Debit Note (Purchase Return):
      // Debit: Accounts Payable (reduces vendor liability)
      // Credit: Purchase Account (reduces purchase value)
      // Credit: GST (reduces Input Credit)
      const ledgerIdBase = "l-pr-" + Math.random().toString(36).substring(2, 9);
      newLedgers.push(
        {
          id: `${ledgerIdBase}-a`,
          date,
          partyId: vendorId,
          partyName: vendorObj.name,
          type: "Debit",
          amount: totals.totalAmount,
          accountType: "Accounts Payable",
          referenceType: "Purchase Return",
          referenceId: prId,
          notes: `Debit Note ${returnNumber}: Stock returned to Vendor`,
        },
        {
          id: `${ledgerIdBase}-b`,
          date,
          partyName: "Purchase Account",
          type: "Credit",
          amount: totals.subtotal,
          accountType: "Purchase",
          referenceType: "Purchase Return",
          referenceId: prId,
          notes: `Purchase reversal against Return ${returnNumber}`,
        }
      );

      const taxAmount = totals.cgst + totals.sgst + totals.igst;
      if (taxAmount > 0) {
        newLedgers.push({
          id: `${ledgerIdBase}-c`,
          date,
          partyName: "GST Input Tax Credit",
          type: "Credit",
          amount: taxAmount,
          accountType: "Tax",
          referenceType: "Purchase Return",
          referenceId: prId,
          notes: `ITC reversal for Purchase Return ${returnNumber}`,
        });
      }
    }

    const updatedReturns = editingPRId
      ? (state.purchaseReturns || []).map((p) => (p.id === editingPRId ? newPR : p))
      : [...(state.purchaseReturns || []), newPR];

    const updatedState: ERPState = {
      ...state,
      purchaseReturns: updatedReturns,
      items: updatedItems,
      stockMovements: newMovements,
      ledger: newLedgers,
    };

    onUpdateState(updatedState);
    setIsCreating(false);
    setEditingPRId(null);
    setViewingPR(newPR);

    // Reset Form
    setVendorId("");
    setPurchaseOrderId("");
    setPurchaseBillId("");
    setItems([]);
    setNotes("");
    setStatus("Returned");
  };

  const handleEditPR = (pr: PurchaseReturn) => {
    setEditingPRId(pr.id);
    setReturnNumber(pr.returnNumber);
    setVendorId(pr.vendorId);
    setPurchaseOrderId(pr.purchaseOrderId || "");
    setPurchaseBillId(pr.purchaseBillId || "");
    setDate(pr.date);
    setItems(pr.items);
    setNotes(pr.notes);
    setStatus(pr.status);
    setIsCreating(true);
  };

  const handleDeletePR = (id: string) => {
    if (confirm("Are you sure you want to delete this purchase return? (Stock levels & ledger entries will be reverted back)")) {
      const oldPR = (state.purchaseReturns || []).find((p) => p.id === id);
      let updatedItems = [...state.items];
      let newMovements = [...state.stockMovements];
      let newLedgers = [...state.ledger];

      if (oldPR && oldPR.status === "Returned") {
        // Reverse stock changes
        oldPR.items.forEach((item) => {
          const idx = updatedItems.findIndex((i) => i.id === item.itemId);
          if (idx !== -1) {
            updatedItems[idx] = {
              ...updatedItems[idx],
              stockQuantity: updatedItems[idx].stockQuantity + item.quantity,
            };
          }
        });
        // Remove stock movements & ledgers
        newMovements = newMovements.filter((sm) => sm.referenceId !== id);
        newLedgers = newLedgers.filter((l) => l.referenceId !== id);
      }

      const updatedReturns = (state.purchaseReturns || []).filter((p) => p.id !== id);

      onUpdateState({
        ...state,
        purchaseReturns: updatedReturns,
        items: updatedItems,
        stockMovements: newMovements,
        ledger: newLedgers,
      });

      if (viewingPR?.id === id) {
        setViewingPR(null);
      }
    }
  };

  // Modern pdf downloading
  const handleDownloadPRDirectly = async (pr: PurchaseReturn) => {
    setDownloadingPRId(pr.id);
    const prevViewing = viewingPR;
    setViewingPR(pr);

    // Wait for the modal or DOM to render
    setTimeout(async () => {
      const element = printRef.current || (document.querySelector(".printable-area") as HTMLElement);
      if (!element) {
        setDownloadingPRId(null);
        return;
      }

      try {
        await downloadDocumentPDF(element, `DebitNote_${pr.returnNumber}.pdf`);
      } catch (err) {
        console.error("Error generating PDF, falling back to handlePrint():", err);
        window.print();
      } finally {
        setDownloadingPRId(null);
      }
    }, 400);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter purchase returns
  const filteredReturns = (state.purchaseReturns || []).filter((pr) => {
    let prWarehouseId = pr.warehouseId;
    if (!prWarehouseId && pr.purchaseOrderId) {
      const po = state.purchaseOrders.find((p) => p.id === pr.purchaseOrderId);
      prWarehouseId = po?.warehouseId;
    }
    if (!prWarehouseId && pr.purchaseBillId) {
      const bill = state.purchaseBills.find((b) => b.id === pr.purchaseBillId);
      prWarehouseId = bill?.warehouseId;
    }
    if (!isWarehouseAllowed(currentUser, prWarehouseId)) {
      return false;
    }

    const vendor = state.parties.find((p) => p.id === pr.vendorId);
    const vendorName = vendor ? vendor.name : "";
    const matchesSearch =
      pr.returnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pr.notes || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVendor = vendorFilter ? pr.vendorId === vendorFilter : true;
    const matchesStatus = statusFilter ? pr.status === statusFilter : true;

    return matchesSearch && matchesVendor && matchesStatus;
  });

  const vendors = state.parties.filter((p) => p.type === "Vendor" || p.type === "Both");
  const selectableItems = state.items;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Undo2 className="text-indigo-600" size={24} />
            Purchase Returns
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Create Debit Notes, reverse stock logs, and map vendor return outstanding.
          </p>
        </div>

        {!isCreating && (
          <button
            onClick={() => {
              setIsCreating(true);
              setEditingPRId(null);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={15} />
            <span>Process New Return</span>
          </button>
        )}
      </div>

      {isCreating ? (
        /* Create or Edit Form */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingPRId(null);
              }}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
            </button>
            <h2 className="text-base font-extrabold text-slate-800">
              {editingPRId ? "Edit Return Details" : "Record Vendor Return (Debit Note)"}
            </h2>
          </div>

          <form onSubmit={handleSavePR} className="space-y-6">
            {/* Meta Information */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Return No
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                  value={returnNumber}
                  onChange={(e) => setReturnNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Vendor Party
                </label>
                <SearchableItemSelect
                  value={vendorId}
                  onChange={(val) => {
                    setVendorId(val);
                    // Clear linked orders if changing vendor
                    setPurchaseOrderId("");
                    setPurchaseBillId("");
                  }}
                  options={vendors}
                  placeholder="Select Vendor"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="Returned">Returned (Stock/Ledger Updated)</option>
                  <option value="Draft">Draft (No Stock changes)</option>
                </select>
              </div>
            </div>

            {/* MAPIN SECTIONS (Linked PO & Linked Bills) */}
            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-indigo-900 uppercase tracking-wider mb-1">
                  Link with Purchase Order
                </label>
                <select
                  className="w-full px-3 py-2 bg-white border border-indigo-200/60 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={purchaseOrderId}
                  onChange={(e) => handlePOMapChange(e.target.value)}
                >
                  <option value="">-- No Direct Link --</option>
                  {state.purchaseOrders
                    .filter((po) => !vendorId || po.vendorId === vendorId)
                    .map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.orderNumber} (Amt: {formatINR(po.totalAmount)})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-indigo-500/80 mt-1">
                  Maps items, original rates, and quantities for stock correction.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-indigo-900 uppercase tracking-wider mb-1">
                  Link with Purchase Bill
                </label>
                <select
                  className="w-full px-3 py-2 bg-white border border-indigo-200/60 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={purchaseBillId}
                  onChange={(e) => handleBillMapChange(e.target.value)}
                >
                  <option value="">-- No Direct Link --</option>
                  {state.purchaseBills
                    .filter((bill) => !vendorId || bill.vendorId === vendorId)
                    .map((bill) => (
                      <option key={bill.id} value={bill.id}>
                        {bill.billNumber} (Amt: {formatINR(bill.totalAmount)})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-indigo-500/80 mt-1">
                  Automatically posts debit corrections against this bill balance.
                </p>
              </div>
            </div>

            {/* Returned Items Matrix */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Returned Item Catalog Matrix
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold rounded-lg text-[10px] border border-slate-200 hover:border-indigo-200 transition-all cursor-pointer"
                >
                  + Add Item
                </button>
              </div>

              {items.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/30">
                  <p className="text-xs text-slate-400">No items mapped. Link a Purchase Order above or add manual entries.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500 font-bold">
                        <th className="py-2 pl-2">Product Name</th>
                        <th className="py-2 w-20 text-center">Qty</th>
                        <th className="py-2 w-28 text-right">Rate</th>
                        <th className="py-2 w-20 text-center">Tax %</th>
                        <th className="py-2 w-28 text-right">Amount</th>
                        <th className="py-2 w-12 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/40">
                          <td className="py-2 pr-2 pl-2">
                            <SearchableItemSelect
                              value={item.itemId}
                              onChange={(val) => handleItemFieldChange(idx, "itemId", val)}
                              options={selectableItems}
                              placeholder="Select Item"
                            />
                          </td>
                          <td className="py-2 text-center">
                            <input
                              type="number"
                              required
                              min="1"
                              className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-center focus:outline-none focus:border-indigo-500"
                              value={item.quantity}
                              onChange={(e) => handleItemFieldChange(idx, "quantity", Number(e.target.value))}
                            />
                          </td>
                          <td className="py-2 text-right">
                            <input
                              type="number"
                              required
                              min="0"
                              step="any"
                              className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-right focus:outline-none focus:border-indigo-500"
                              value={item.rate}
                              onChange={(e) => handleItemFieldChange(idx, "rate", Number(e.target.value))}
                            />
                          </td>
                          <td className="py-2 text-center">
                            <select
                              className="w-16 px-1.5 py-1.5 border border-slate-200 rounded-lg text-xs text-center focus:outline-none bg-white font-semibold"
                              value={item.taxRate || 18}
                              onChange={(e) => handleItemFieldChange(idx, "taxRate", Number(e.target.value))}
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>
                          <td className="py-2 text-right font-bold text-slate-800 pr-2">
                            {formatINR(item.amount)}
                          </td>
                          <td className="py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Manager Execution Notes / Remarks
                </label>
                <textarea
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  rows={4}
                  placeholder="Reason for return, damaged stock log references..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="bg-slate-50/80 border border-slate-150 p-4 rounded-2xl space-y-2.5">
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Subtotal Amount:</span>
                  <span className="font-bold">{formatINR(totals.subtotal)}</span>
                </div>
                {totals.cgst > 0 && (
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>CGST (Central Tax):</span>
                    <span className="font-semibold">{formatINR(totals.cgst)}</span>
                  </div>
                )}
                {totals.sgst > 0 && (
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>SGST (State Tax):</span>
                    <span className="font-semibold">{formatINR(totals.sgst)}</span>
                  </div>
                )}
                {totals.igst > 0 && (
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>IGST (Integrated Interstate Tax):</span>
                    <span className="font-semibold">{formatINR(totals.igst)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm font-black text-slate-850 pt-2 border-t border-dashed border-slate-200">
                  <span>Refund / Credit Amount:</span>
                  <span className="text-indigo-700 text-base">{formatINR(totals.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingPRId(null);
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
              >
                {editingPRId ? "Save Corrections" : "Commit Purchase Return"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Filters and Dashboard View Table */
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all"
                placeholder="Search Return No, Vendor or remarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto">
              <select
                className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 focus:outline-none font-semibold"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
              >
                <option value="">All Vendor Parties</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>

              <select
                className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 focus:outline-none font-semibold"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Returned">Returned</option>
                <option value="Draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {filteredReturns.length === 0 ? (
              <div className="py-16 text-center">
                <Undo2 className="mx-auto text-slate-300 mb-3" size={36} />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  No Purchase Returns Found
                </h3>
                <p className="text-slate-400 text-xs mt-1">
                  Start mapping your vendor returns by processing a new debit note.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-150 text-slate-500 font-bold select-none uppercase tracking-wider text-[10px]">
                      <th className="p-4">Return No</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Vendor Name</th>
                      <th className="p-4 text-center">Linked PO/Bill</th>
                      <th className="p-4 text-right">Refund Value</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredReturns.map((pr) => {
                      const vendor = state.parties.find((p) => p.id === pr.vendorId);
                      const poObj = state.purchaseOrders.find((p) => p.id === pr.purchaseOrderId);
                      const billObj = state.purchaseBills.find((b) => b.id === pr.purchaseBillId);

                      return (
                        <tr key={pr.id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="p-4 font-mono font-bold text-slate-900">{pr.returnNumber}</td>
                          <td className="p-4 text-slate-500">{formatDate(pr.date)}</td>
                          <td className="p-4 text-slate-800 font-semibold">
                            {vendor ? vendor.name : "Unknown Vendor"}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex flex-col gap-0.5 items-center">
                              {poObj && (
                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[9px] font-bold border border-indigo-100">
                                  PO: {poObj.orderNumber}
                                </span>
                              )}
                              {billObj && (
                                <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-md text-[9px] font-bold border border-purple-100">
                                  Bill: {billObj.billNumber}
                                </span>
                              )}
                              {!poObj && !billObj && <span className="text-slate-400 text-[10px]">-</span>}
                            </div>
                          </td>
                          <td className="p-4 text-right font-black text-slate-900">
                            {formatINR(pr.totalAmount)}
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`px-2 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                                pr.status === "Returned"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                  : "bg-slate-100 text-slate-500 border border-slate-200"
                              }`}
                            >
                              {pr.status}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setViewingPR(pr)}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl flex items-center gap-1 text-[10px] font-bold border border-indigo-100 cursor-pointer transition-all"
                                title="View PR Details"
                              >
                                <Eye size={12} /> View
                              </button>
                              <button
                                onClick={() => handleDownloadPRDirectly(pr)}
                                disabled={downloadingPRId === pr.id}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:bg-slate-50 text-emerald-700 disabled:text-slate-400 rounded-xl flex items-center gap-1 text-[10px] font-bold border border-emerald-100 disabled:border-slate-200 cursor-pointer transition-all"
                                title="Download PDF"
                              >
                                {downloadingPRId === pr.id ? (
                                  <span className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin"></span>
                                ) : (
                                  <Download size={12} />
                                )}
                                <span>PDF</span>
                              </button>
                              <button
                                onClick={() => handleEditPR(pr)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1 text-[10px] font-bold border border-slate-200 cursor-pointer transition-all"
                                title="Edit PR"
                              >
                                <Edit size={12} /> Edit
                              </button>
                              <button
                                onClick={() => handleDeletePR(pr.id)}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl flex items-center gap-1 text-[10px] font-bold border border-rose-100 cursor-pointer transition-all"
                                title="Delete PR"
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
        </div>
      )}

      {/* Modern High-Quality Print & View Template Modal */}
      {viewingPR && (() => {
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
                <h3 className="text-[11px] sm:text-xs font-black text-slate-800 uppercase tracking-wider truncate mr-2">
                  Certified Debit Note Document
                </h3>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    onClick={handlePrint}
                    className="px-2.5 sm:px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Printer size={12} /> Print
                  </button>
                  <button
                    onClick={() => handleDownloadPRDirectly(viewingPR)}
                    disabled={downloadingPRId === viewingPR.id}
                    className="px-2.5 sm:px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {downloadingPRId === viewingPR.id ? "Saving PDF..." : "Save PDF"}
                  </button>
                  <button
                    onClick={() => setViewingPR(null)}
                    className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors cursor-pointer border border-slate-200 bg-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Core PDF printable content block */}
              <div className="p-3 sm:p-5 md:p-6 overflow-y-auto overflow-x-hidden printable-area flex-1 bg-white w-full flex justify-center items-start" ref={printRef}>
                <div className="w-full max-w-4xl mx-auto border-[1.5px] border-black text-black font-sans leading-tight bg-white">
                
                {/* Top Header border/sections */}
                <div className="grid grid-cols-3 border-b border-black px-4 py-1.5 text-[10px] font-bold select-none bg-white">
                  <div>GSTIN : {company.gstin}</div>
                  <div className="text-center">
                    <div className="font-extrabold uppercase text-xs tracking-wider">Debit Note</div>
                    <div className="text-[8px] text-slate-500 italic">(ORIGINAL FOR RECIPIENT)</div>
                  </div>
                  <div className="text-right uppercase">TAX INVOICE REVERSAL</div>
                </div>

                {/* Logo and Brand Header */}
                <div className="grid grid-cols-12 border-b border-black p-4 items-center bg-white">
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
                  <div className="col-span-4 flex items-start justify-end gap-3 font-mono text-[9px] bg-white">
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
                      <div className="text-[8px] break-all text-left truncate max-w-[150px]" title={viewingPR.id}>
                        <span className="font-extrabold">PR-ID:</span> {viewingPR.id}
                      </div>
                      <div>
                        <span className="font-extrabold">Debit Note No:</span> {viewingPR.returnNumber}
                      </div>
                      <div>
                        <span className="font-extrabold">Date:</span> {formatDate(viewingPR.date)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sender and Recipient Section Grid */}
                <div className="grid grid-cols-2 border-b border-black text-[11px] leading-relaxed bg-white">
                  {/* Left Column: Divine Traders (Sender returning goods) */}
                  <div className="border-r border-black flex flex-col justify-between divide-y divide-black">
                    {/* Sender Info (Divine Traders) */}
                    <div className="p-3 space-y-1">
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">SENDER (DEBIT TO)</div>
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

                    {/* Recipient details (Vendor who receives the return) */}
                    <div className="p-3 space-y-1">
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">RECIPIENT (SUPPLIER / VENDOR)</div>
                      {(() => {
                        const vendor = state.parties.find((p) => p.id === viewingPR.vendorId);
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
                  <div className="grid grid-cols-2 text-[10px] select-none font-semibold bg-white">
                    <div className="border-r border-b border-black p-2.5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Debit Note No.</div>
                      <div className="font-extrabold text-black text-xs">{viewingPR.returnNumber}</div>
                    </div>
                    <div className="border-b border-black p-2.5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Dated</div>
                      <div className="font-extrabold text-black text-xs">{formatDate(viewingPR.date)}</div>
                    </div>

                    <div className="border-r border-b border-black p-2.5 col-span-2">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Original Invoice Ref</div>
                      <div className="font-bold text-black">
                        {viewingPR.purchaseBillId ? (
                          <span>Bill No: {state.purchaseBills.find((b) => b.id === viewingPR.purchaseBillId)?.billNumber}</span>
                        ) : viewingPR.purchaseOrderId ? (
                          <span>PO No: {state.purchaseOrders.find((po) => po.id === viewingPR.purchaseOrderId)?.orderNumber}</span>
                        ) : (
                          <span>N/A</span>
                        )}
                      </div>
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
                      <div className="font-bold text-black">RET-124-125</div>
                    </div>
                    <div className="border-b border-black p-2.5">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Dated</div>
                      <div className="font-bold text-black">{formatDate(viewingPR.date)}</div>
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
                <div className="overflow-x-auto bg-white">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-black font-extrabold text-center select-none text-black">
                        <th className="border-r border-black p-2 text-center w-10">SI No.</th>
                        <th className="border-r border-black p-2 text-left">Description of Goods (Stock Returned)</th>
                        <th className="border-r border-black p-2 w-24">HSN/SAC</th>
                        <th className="border-r border-black p-2 w-16">GST Rate</th>
                        <th className="border-r border-black p-2 w-24">Quantity</th>
                        <th className="border-r border-black p-2 w-24">Rate</th>
                        <th className="border-r border-black p-2 w-16">per</th>
                        <th className="p-2 text-right w-28">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-900 font-semibold">
                      {viewingPR.items.map((item, idx) => {
                        const dbItem = state.items.find((i) => i.name === item.name);
                        const rateFormatted = item.rate.toFixed(2);
                        const unit = dbItem?.unit || "PCS";
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
                        const actualCount = viewingPR.items.length;
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
                          {viewingPR.subtotal.toFixed(2)}
                        </td>
                      </tr>

                      {/* CGST, SGST, IGST correction rows inside table format */}
                      {(() => {
                        const cgst = viewingPR.cgst || 0;
                        const sgst = viewingPR.sgst || 0;
                        const igst = viewingPR.igst || 0;

                        const subRows: React.ReactNode[] = [];
                        if (cgst > 0) {
                          subRows.push(
                            <tr key="cgst-row" className="align-middle font-semibold text-slate-900">
                              <td className="border-r border-black p-2"></td>
                              <td className="border-r border-black p-2 text-right font-extrabold uppercase text-slate-800 text-[11px]">
                                CGST (Correction)
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
                                SGST (Correction)
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
                        if (igst > 0) {
                          subRows.push(
                            <tr key="igst-row" className="align-middle font-semibold text-slate-900">
                              <td className="border-r border-black p-2"></td>
                              <td className="border-r border-black p-2 text-right font-extrabold uppercase text-slate-800 text-[11px]">
                                IGST (Correction)
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
                        return subRows;
                      })()}

                      {/* Total Row */}
                      {(() => {
                        const totalQty = viewingPR.items.reduce((sum, item) => sum + item.quantity, 0);
                        const unitSymbol = "PCS";
                        return (
                          <tr className="border-t-[1.5px] border-black bg-slate-50 font-bold text-black align-middle text-[11px]">
                            <td className="border-r border-black p-2 text-center"></td>
                            <td className="border-r border-black p-2 font-black text-right uppercase">Total Debit Value</td>
                            <td className="border-r border-black p-2"></td>
                            <td className="border-r border-black p-2"></td>
                            <td className="border-r border-black p-2 text-right font-black text-black">{totalQty} {unitSymbol}</td>
                            <td className="border-r border-black p-2"></td>
                            <td className="border-r border-black p-2"></td>
                            <td className="p-2 text-right font-black text-black text-xs">₹ {viewingPR.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
                    {numberToIndianWords(viewingPR.totalAmount)}
                  </div>
                </div>

                {/* Bottom PAN, Remarks, Bank details and Authorized Signatory Grid */}
                <div className="grid grid-cols-2 text-[10px] border-t border-black font-semibold leading-normal select-none bg-white">
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
                          This is a certified Debit Note for return of stocks. The values indicated represent adjustments made to tax ledger entries.
                        </p>
                      </div>
                      {viewingPR.notes && (
                        <div className="mt-3 p-2 bg-slate-50 rounded border border-slate-200">
                          <span className="font-extrabold text-slate-800 block mb-0.5 text-[9px] uppercase tracking-wider">Internal Remarks / Notes:</span>
                          <span className="text-slate-700 font-bold">{viewingPR.notes}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-8 text-center text-slate-400 font-black uppercase tracking-wider border-t border-dashed border-slate-200">
                      Authorized Signatory &amp; Seal
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
                This is a Computer Generated Debit Note
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
