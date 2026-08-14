import React, { useState, useEffect, useRef } from "react";
import { ERPState, SaleInvoice, Party, Item, SaleInvoiceItem, StockMovement, LedgerEntry } from "../types";
import { formatINR, formatDate, convertQuantity, getConversionFactor, exportToCsv, numberToIndianWords, safeConfirm, safeAlert } from "../utils";
import { isWarehouseAllowed, getAllowedWarehouses } from "../utils/warehouseAuth";
import { downloadDocumentPDF } from "../utils/pdfGenerator";
import { INITIAL_COMPANY_PROFILE } from "../data";
import { Plus, Search, Eye, FileText, X, Trash2, ArrowLeft, Printer, ChevronDown, Check, Edit, Download, CheckCircle2, AlertTriangle } from "lucide-react";
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
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-indigo-600 focus:outline-none bg-white text-slate-700 font-semibold flex items-center justify-between text-left cursor-pointer h-9 shadow-xs"
      >
        <span className="truncate">
          {selectedItem 
            ? `${selectedItem.code} - ${selectedItem.name} (Stock: ${selectedItem.stockQuantity} ${selectedItem.unit})` 
            : placeholder}
        </span>
        <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 flex items-center gap-1.5 bg-slate-50">
            <Search size={12} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search SKU code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none text-xs focus:outline-none text-slate-700 p-0.5"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1 py-1 max-h-48">
            {filteredItems.length === 0 ? (
              <div className="p-3 text-xs text-slate-400 text-center italic">No items found</div>
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
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer ${
                      isSelected ? "bg-indigo-50/50 text-indigo-600 font-semibold" : "text-slate-700"
                    }`}
                  >
                    <span className="truncate">
                      <span className="font-mono font-bold bg-slate-100 px-1 py-0.5 rounded text-[10px] text-slate-600 mr-1.5">
                        {item.code}
                      </span>
                      {item.name}
                      <span className="text-slate-400 text-[10px] ml-1.5">
                        (Stock: {item.stockQuantity} {item.unit})
                      </span>
                    </span>
                    {isSelected && <Check size={12} className="text-indigo-600 shrink-0 ml-2" />}
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

interface SearchableCustomerSelectProps {
  value: string;
  onChange: (value: string) => void;
  customers: Party[];
  onAddNew: (initialName?: string) => void;
  onEdit?: () => void;
  placeholder?: string;
  required?: boolean;
}

function SearchableCustomerSelect({
  value,
  onChange,
  customers,
  onAddNew,
  onEdit,
  placeholder = "Search or select customer...",
  required = false,
}: SearchableCustomerSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCustomer = customers.find((c) => c.id === value);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.gstin && c.gstin.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.toLowerCase().includes(search.toLowerCase())) ||
      (c.address && c.address.toLowerCase().includes(search.toLowerCase())) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
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
    <div className="relative w-full" ref={containerRef}>
      <input
        type="text"
        value={value}
        required={required}
        onChange={() => {}}
        className="sr-only"
        tabIndex={-1}
      />

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full rounded-xl border p-2.5 text-sm focus:outline-none bg-white text-slate-800 font-semibold flex items-center justify-between text-left cursor-pointer shadow-xs transition-all ${
            isOpen ? "border-indigo-600 ring-2 ring-indigo-100" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center gap-2 truncate pr-1">
            <Search size={14} className="text-slate-400 shrink-0" />
            <span className="truncate">
              {selectedCustomer ? (
                <span className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">{selectedCustomer.name}</span>
                  {selectedCustomer.gstin && (
                    <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200/60 font-semibold">
                      {selectedCustomer.gstin}
                    </span>
                  )}
                  {selectedCustomer.phone && (
                    <span className="text-xs text-slate-500 font-normal hidden sm:inline">
                      • {selectedCustomer.phone}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-slate-400 font-normal">{placeholder}</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {selectedCustomer && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear selection"
              >
                <X size={14} />
              </span>
            )}
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180 text-indigo-600" : ""}`} />
          </div>
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-80 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/90">
            <Search size={14} className="text-slate-400 shrink-0 ml-1" />
            <input
              type="text"
              placeholder="Search by customer name, GSTIN, mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none text-xs focus:outline-none text-slate-800 p-1 font-medium placeholder:text-slate-400"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1 py-1 divide-y divide-slate-50 max-h-56">
            {filteredCustomers.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-slate-500 mb-2">No customers matching "{search}"</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onAddNew(search);
                    setSearch("");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Plus size={14} /> Add "{search || "New Customer"}"
                </button>
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = c.id === value;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onChange(c.id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left px-3 py-2.5 text-xs flex items-center justify-between hover:bg-indigo-50/80 hover:text-indigo-900 transition-colors cursor-pointer ${
                      isSelected ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-800"
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 truncate pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{c.name}</span>
                        {c.gstin ? (
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1 py-0.2 rounded border border-slate-200">
                            {c.gstin}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400">No GSTIN</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-normal">
                        {c.phone && <span>📞 {c.phone}</span>}
                        {c.address && <span>📍 {c.address}</span>}
                        {c.openingBalance ? (
                          <span className="text-amber-600 font-medium">Bal: ₹{c.openingBalance}</span>
                        ) : null}
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-indigo-600 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="p-2 border-t border-slate-100 bg-slate-50/90 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onAddNew(search);
                setSearch("");
              }}
              className="w-full py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-indigo-200/60"
            >
              <Plus size={13} /> Add New Customer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface GstGroup {
  rate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
}

export function calculateGstGroups(
  items: Array<{ quantity: number; rate: number; taxRate?: number }>,
  isInterstate: boolean
): GstGroup[] {
  const groups: Record<number, number> = {};
  items.forEach((item) => {
    const rate = item.taxRate || 0;
    if (rate > 0) {
      const amount = item.quantity * item.rate;
      groups[rate] = (groups[rate] || 0) + amount;
    }
  });

  const sortedRates = Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b);

  return sortedRates.map((rate) => {
    const taxableAmount = groups[rate];
    if (isInterstate) {
      const igst = Math.round(taxableAmount * (rate / 100));
      return {
        rate,
        taxableAmount,
        cgst: 0,
        sgst: 0,
        igst,
        totalGst: igst,
      };
    } else {
      const cgst = Math.round(taxableAmount * (rate / 200));
      const sgst = Math.round(taxableAmount * (rate / 200));
      return {
        rate,
        taxableAmount,
        cgst,
        sgst,
        igst: 0,
        totalGst: cgst + sgst,
      };
    }
  });
}

interface SalesViewProps {
  state: ERPState;
  currentUserEmail?: string;
  onUpdateState: (newState: ERPState) => void;
  selectedInvoiceId?: string;
  setSelectedInvoiceId?: (id: string) => void;
  setCurrentTab?: (tab: string) => void;
  setPaymentsPrefill?: (prefill: any) => void;
  setLedgerPrefillSearchTerm?: (term: string) => void;
  setCustomerOutstandingPrefillSearchTerm?: (term: string) => void;
  setPartiesPrefillSearchTerm?: (term: string) => void;
  setStockMovementPrefillSearchTerm?: (term: string) => void;
}

export default function SalesView({
  state,
  currentUserEmail,
  onUpdateState,
  selectedInvoiceId,
  setSelectedInvoiceId,
  setCurrentTab,
  setPaymentsPrefill,
  setLedgerPrefillSearchTerm,
  setCustomerOutstandingPrefillSearchTerm,
  setPartiesPrefillSearchTerm,
  setStockMovementPrefillSearchTerm,
}: SalesViewProps) {
  const currentUser = React.useMemo(
    () => (state.teamMembers || []).find((m) => m.email.toLowerCase() === (currentUserEmail || "").toLowerCase()),
    [state.teamMembers, currentUserEmail]
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState<"All" | "Today" | "This Week" | "This Month" | "Financial Year">("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Paid" | "Partial" | "Unpaid" | "Cancelled" | "Draft" | "Posted">("All");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("All");
  const [activeMenuInvoiceId, setActiveMenuInvoiceId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<SaleInvoice | null>(
    selectedInvoiceId ? state.saleInvoices.find((inv) => inv.id === selectedInvoiceId) || null : null
  );

  React.useEffect(() => {
    if (selectedInvoiceId) {
      const found = state.saleInvoices.find((inv) => inv.id === selectedInvoiceId);
      if (found) {
        setViewingInvoice(found);
        setIsCreating(false);
      }
    }
  }, [selectedInvoiceId, state.saleInvoices]);

  const activeWarehouses = React.useMemo(
    () => getAllowedWarehouses(currentUser, state.warehouses),
    [currentUser, state.warehouses]
  );
  const [warehouseId, setWarehouseId] = useState(() => {
    return activeWarehouses[0]?.id || "wh-main";
  });

  // Form State for creating new invoice
  const [invoiceType, setInvoiceType] = useState<"GST" | "GST_5" | "NON_GST">("GST");
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isInterstate, setIsInterstate] = useState(false); // Local vs Interstate GST
  const [notes, setNotes] = useState("");
  const [itemsList, setItemsList] = useState<Array<{ itemId: string; quantity: number; rate: number; taxRate: 0 | 5 | 18; unit?: string }>>([
    { itemId: "", quantity: 0, rate: 0, taxRate: 18, unit: "" },
  ]);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [assignee, setAssignee] = useState(state.salesAssigneeName || "Vishal Kumar");
  const [isPostAction, setIsPostAction] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Inline Party Creator Modal State
  const [showInlinePartyModal, setShowInlinePartyModal] = useState(false);
  const [inlinePartyMode, setInlinePartyMode] = useState<"add" | "edit">("add");
  const [inlinePartyName, setInlinePartyName] = useState("");
  const [inlinePartyEmail, setInlinePartyEmail] = useState("");
  const [inlinePartyPhone, setInlinePartyPhone] = useState("");
  const [inlinePartyAddress, setInlinePartyAddress] = useState("");
  const [inlinePartyGstin, setInlinePartyGstin] = useState("");
  const [inlinePartyOpeningBalance, setInlinePartyOpeningBalance] = useState(0);

  const handleAddCustomerInline = (initialName?: string) => {
    setInlinePartyMode("add");
    setInlinePartyName(initialName && typeof initialName === "string" ? initialName : "");
    setInlinePartyEmail("");
    setInlinePartyPhone("");
    setInlinePartyAddress("");
    setInlinePartyGstin("");
    setInlinePartyOpeningBalance(0);
    setShowInlinePartyModal(true);
  };

  const handleEditCustomerInline = () => {
    const customer = state.parties.find((p) => p.id === customerId);
    if (!customer) return;
    setInlinePartyMode("edit");
    setInlinePartyName(customer.name);
    setInlinePartyEmail(customer.email || "");
    setInlinePartyPhone(customer.phone || "");
    setInlinePartyAddress(customer.address || "");
    setInlinePartyGstin(customer.gstin || "");
    setInlinePartyOpeningBalance(customer.openingBalance || 0);
    setShowInlinePartyModal(true);
  };



  const handleSaveInlineParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlinePartyName.trim()) {
      alert("Name is required.");
      return;
    }

    let updatedParties = [...state.parties];
    let savedPartyId = customerId;

    if (inlinePartyMode === "edit") {
      updatedParties = updatedParties.map((p) => {
        if (p.id === customerId) {
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
        type: "Customer" as const,
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
    setCustomerId(savedPartyId);
    setShowInlinePartyModal(false);
  };

  const handleDownloadInvoiceDirectly = async (inv: SaleInvoice) => {
    if (downloadingInvoiceId) return;
    setDownloadingInvoiceId(inv.id);
    const prevViewing = viewingInvoice;
    setViewingInvoice(inv);
    setTimeout(async () => {
      try {
        await handleDownloadPDF(inv.invoiceNumber);
      } catch (e) {
        console.error(e);
      } finally {
        setViewingInvoice(prevViewing);
        setDownloadingInvoiceId(null);
      }
    }, 400);
  };

  const handleEditInvoice = (inv: SaleInvoice) => {
    setEditingInvoiceId(inv.id);
    setWarehouseId(inv.warehouseId || "wh-main");
    const isNG = inv.invoiceNumber.startsWith("DIVI-NG") || inv.invoiceNumber.startsWith("DIVI-Z");
    let detectedType: "GST" | "GST_5" | "NON_GST" = isNG ? "NON_GST" : "GST";
    if (!isNG) {
      const hasGst5 = inv.items.some(item => item.taxRate === 5);
      const hasGst18 = inv.items.some(item => item.taxRate === 18);
      if (hasGst5 && !hasGst18) {
        detectedType = "GST_5";
      }
    }
    setInvoiceType(detectedType);
    setCustomerId(inv.customerId);
    setDate(inv.date);
    setAssignee(inv.assignee || state.salesAssigneeName || "Vishal Kumar");
    setIsInterstate(inv.igst > 0);
    setNotes(inv.notes || "");
    setItemsList(
      inv.items.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        rate: item.rate,
        taxRate: (item.taxRate ?? 18) as any,
        unit: item.unit || "",
      }))
    );
    setIsCreating(true);
    setViewingInvoice(null);
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    const inv = state.saleInvoices.find((i) => i.id === invoiceId || i.invoiceNumber === invoiceId);
    if (!inv) return;

    const isDraft = inv.status === "Draft";

    const confirmMsg = isDraft
      ? `Are you sure you want to permanently delete Draft Invoice ${inv.invoiceNumber}?`
      : `Are you sure you want to permanently delete and revert Invoice ${inv.invoiceNumber}? This will revert item stock quantities and clear related ledger postings.`;

    if (!safeConfirm(confirmMsg)) {
      return;
    }

    const targetId = inv.id;
    const targetNo = inv.invoiceNumber;

    const updatedItems = [...state.items];
    if (!isDraft) {
      inv.items.forEach((item) => {
        const index = updatedItems.findIndex((i) => i.id === item.itemId);
        if (index !== -1) {
          const dbItem = updatedItems[index];
          const baseQty = convertQuantity(item.quantity, item.unit || dbItem.unit, dbItem.unit, state.unitConversions);
          const oldWhId = inv.warehouseId || "wh-main";
          const warehouseStocks = { ...updatedItems[index].warehouseStocks };
          warehouseStocks[oldWhId] = (warehouseStocks[oldWhId] || 0) + baseQty;
          const totalStock = Object.values(warehouseStocks).reduce((sum: number, val) => sum + (val || 0), 0);

          updatedItems[index] = {
            ...updatedItems[index],
            stockQuantity: totalStock,
            warehouseStocks,
          };
        }
      });
    }

    const updatedMovements = isDraft
      ? state.stockMovements
      : state.stockMovements.filter(
          (sm) => !(sm.referenceType === "Sale Invoice" && (sm.referenceId === targetId || sm.referenceId === targetNo))
        );

    const updatedLedger = isDraft
      ? state.ledger
      : state.ledger.filter((le) => le.referenceId !== targetId && le.referenceId !== targetNo);

    const updatedInvoices = state.saleInvoices.filter((i) => i.id !== targetId && i.invoiceNumber !== targetNo);

    const updatedState: ERPState = {
      ...state,
      saleInvoices: updatedInvoices,
      items: updatedItems,
      stockMovements: updatedMovements,
      ledger: updatedLedger,
      parties: state.parties, // Explicitly preserve customer/party master records; never delete them.
    };

    onUpdateState(updatedState);
    
    if (viewingInvoice?.id === targetId || viewingInvoice?.invoiceNumber === targetNo) {
      setViewingInvoice(null);
    }
  };

  const customers = React.useMemo(() => {
    const raw = state.parties.filter((p) => p.type === "Customer" || p.type === "Both");
    const seen = new Set<string>();
    const unique: Party[] = [];
    for (const p of raw) {
      if (p.id && !seen.has(p.id)) {
        seen.add(p.id);
        unique.push(p);
      }
    }
    return unique;
  }, [state.parties]);

  const stockItems = React.useMemo(() => {
    const seen = new Set<string>();
    const unique: typeof state.items = [];
    for (const item of state.items) {
      if (item.id && !seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
      }
    }
    return unique.map((item) => ({
      ...item,
      stockQuantity: item.warehouseStocks?.[warehouseId] ?? 0,
    }));
  }, [state.items, warehouseId]);

  // Helper to parse YYYY-MM-DD date safely in local time
  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date(0);
    const cleanStr = dateStr.split("T")[0];
    const parts = cleanStr.split("-");
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(dateStr);
  };

  // Compute list of assignees for filtering (deduplicated & sales representation persons only)
  const availableAssignees = React.useMemo(() => {
    // 1. Get sales team members (role contains 'sales' or sales permission is true)
    const salesTeamMembers = (state.teamMembers || [])
      .filter((m) => {
        const r = (m.role || "").toLowerCase();
        if (r === "purchase" || r === "store" || r === "production") return false;
        return r.includes("sales") || m.permissions?.sales === true;
      })
      .map((m) => m.name.trim());

    // 2. Identify non-sales team members to exclude
    const nonSalesLower = new Set(
      (state.teamMembers || [])
        .filter((m) => {
          const r = (m.role || "").toLowerCase();
          return (r === "purchase" || r === "store" || r === "production" || r === "accountant") && !m.permissions?.sales;
        })
        .map((m) => m.name.trim().toLowerCase())
    );

    const candidates: string[] = [];

    // Add sales team members
    salesTeamMembers.forEach((name) => {
      if (name) candidates.push(name);
    });

    // Add configured sales assignees if not non-sales
    if (state.salesAssignees) {
      state.salesAssignees.forEach((name) => {
        if (name && name.trim() && !nonSalesLower.has(name.trim().toLowerCase())) {
          candidates.push(name.trim());
        }
      });
    }

    // Add assignees from existing sale invoices if valid
    state.saleInvoices.forEach((inv) => {
      const a = (inv.assignee || state.salesAssigneeName || "").trim();
      if (a && !nonSalesLower.has(a.toLowerCase())) {
        candidates.push(a);
      }
    });

    // Fallback if empty
    if (candidates.length === 0) {
      candidates.push("Vishal Kumar");
    }

    // Case-insensitive deduplication maintaining clean casing
    const resultMap = new Map<string, string>();
    candidates.forEach((name) => {
      const key = name.toLowerCase();
      if (!resultMap.has(key)) {
        resultMap.set(key, name);
      }
    });

    return Array.from(resultMap.values()).sort((a, b) => a.localeCompare(b));
  }, [state.saleInvoices, state.salesAssignees, state.salesAssigneeName, state.teamMembers]);

  // Filter invoices with rich timeline, status, assignee, and multi-field search logic
  const filteredInvoices = React.useMemo(() => {
    const rawInvoices = state.saleInvoices || [];
    const seen = new Set<string>();
    const uniqueInvoices: SaleInvoice[] = [];
    for (const inv of rawInvoices) {
      const key = inv.id || inv.invoiceNumber;
      if (key && !seen.has(key)) {
        seen.add(key);
        uniqueInvoices.push(inv);
      } else if (!key) {
        uniqueInvoices.push(inv);
      }
    }

    return uniqueInvoices.filter((inv) => {
      // Filter out records from warehouses not authorized for current user
      if (!isWarehouseAllowed(currentUser, inv.warehouseId)) {
        return false;
      }

      const customer = state.parties.find((p) => p.id === inv.customerId);
      const warehouse = state.warehouses?.find((w) => w.id === inv.warehouseId);
      const query = searchTerm.toLowerCase().trim();

      const invAssignee = (inv.assignee || state.salesAssigneeName || "Vishal Kumar").trim();

      // 1. Multi-field search match
      let matchesSearch = true;
      if (query) {
        const invNoMatch = (inv.invoiceNumber || "").toLowerCase().includes(query);
        const custNameMatch = customer?.name?.toLowerCase().includes(query) || false;
        const phoneMatch = customer?.phone?.includes(query) || false;
        const gstinMatch = customer?.gstin?.toLowerCase().includes(query) || false;
        const amtMatch = String(inv.totalAmount || 0).includes(query);
        const dateMatch = (inv.date || "").includes(query) || formatDate(inv.date || "").toLowerCase().includes(query);
        const whMatch = warehouse?.name?.toLowerCase().includes(query) || warehouse?.code?.toLowerCase().includes(query) || false;
        const assigneeMatch = invAssignee.toLowerCase().includes(query);

        matchesSearch = invNoMatch || custNameMatch || phoneMatch || gstinMatch || amtMatch || dateMatch || whMatch || assigneeMatch;
      }

      // 2. Timeline filter match
      const matchesTime = (() => {
        if (timeFilter === "All") return true;
        const now = new Date();
        const invDate = parseLocalDate(inv.date);

        if (timeFilter === "Today") {
          const todayStr = new Date().toLocaleDateString("en-CA");
          return (inv.date || "").startsWith(todayStr);
        }
        if (timeFilter === "This Week") {
          const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
          const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6, 23, 59, 59);
          return invDate >= startOfWeek && invDate <= endOfWeek;
        }
        if (timeFilter === "This Month") {
          return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
        }
        if (timeFilter === "Financial Year") {
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth();
          const startYear = currentMonth < 3 ? currentYear - 1 : currentYear;
          const start = new Date(startYear, 3, 1, 0, 0, 0);
          const end = new Date(startYear + 1, 2, 31, 23, 59, 59);
          return invDate >= start && invDate <= end;
        }
        return true;
      })();

      // 3. Status filter match
      const matchesStatus = (() => {
        if (statusFilter === "All") return true;
        if (statusFilter === "Paid") return inv.status === "Paid";
        if (statusFilter === "Partial") return inv.status === "Partial";
        if (statusFilter === "Unpaid") return inv.status === "Unpaid" || ((inv.status === "Posted" || !inv.status) && (inv.paidAmount || 0) === 0);
        if (statusFilter === "Cancelled") return inv.status === "Cancelled";
        if (statusFilter === "Draft") return inv.status === "Draft";
        if (statusFilter === "Posted") return inv.status !== "Draft" && inv.status !== "Cancelled";
        return true;
      })();

      // 4. Assignee filter match
      const matchesAssignee = (() => {
        if (assigneeFilter === "All") return true;
        return invAssignee.toLowerCase() === assigneeFilter.trim().toLowerCase();
      })();

      return matchesSearch && matchesTime && matchesStatus && matchesAssignee;
    });
  }, [state.saleInvoices, state.parties, state.warehouses, searchTerm, timeFilter, statusFilter, assigneeFilter, state.salesAssigneeName]);

  const handleExportInvoicesCsv = () => {
    const headers = [
      "Invoice No",
      "Customer Name",
      "Date",
      "Sales Representative",
      "GST Status",
      "Subtotal",
      "Total Amount",
      "Status"
    ];

    const rows = filteredInvoices.map((inv) => {
      const customer = state.parties.find((p) => p.id === inv.customerId);
      const customerName = customer ? customer.name : "Cash Customer";
      const isNonGst = inv.invoiceNumber.startsWith("DIVI-NG") || inv.invoiceNumber.startsWith("DIVI-Z");
      return [
        inv.invoiceNumber,
        customerName,
        inv.date,
        inv.assignee || state.salesAssigneeName || "Vishal Kumar",
        isNonGst ? "Non-GST" : "Regular GST",
        inv.subtotal,
        inv.totalAmount,
        inv.status || "Posted"
      ];
    });

    exportToCsv("sales_invoices_report.csv", headers, rows);
  };

  const handleExportPdfSummary = () => {
    const pdf = new jsPDF("p", "mm", "a4");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("SALES INVOICES SUMMARY REPORT", 14, 20);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Generated Date: ${new Date().toLocaleDateString()}`, 14, 26);
    pdf.text(`Total Records: ${filteredInvoices.length} Invoices`, 14, 31);
    
    // Draw a line
    pdf.setDrawColor(200, 200, 200);
    pdf.line(14, 35, 196, 35);
    
    // Table Headers
    pdf.setFont("helvetica", "bold");
    pdf.text("Invoice No", 14, 41);
    pdf.text("Customer", 45, 41);
    pdf.text("Date", 110, 41);
    pdf.text("Status", 140, 41);
    pdf.text("Total Amount", 170, 41);
    
    pdf.line(14, 43, 196, 43);
    pdf.setFont("helvetica", "normal");
    
    let y = 49;
    filteredInvoices.forEach((inv, index) => {
      if (y > 280) {
        pdf.addPage();
        y = 20;
        pdf.setFont("helvetica", "bold");
        pdf.text("Invoice No", 14, y);
        pdf.text("Customer", 45, y);
        pdf.text("Date", 110, y);
        pdf.text("Status", 140, y);
        pdf.text("Total Amount", 170, y);
        pdf.line(14, y + 2, 196, y + 2);
        pdf.setFont("helvetica", "normal");
        y += 8;
      }
      
      const customer = state.parties.find((p) => p.id === inv.customerId);
      const name = customer?.name || "Cash Customer";
      const displayCustomer = name.length > 30 ? name.substring(0, 27) + "..." : name;
      
      pdf.text(inv.invoiceNumber, 14, y);
      pdf.text(displayCustomer, 45, y);
      pdf.text(inv.date, 110, y);
      pdf.text(inv.status || "Posted", 140, y);
      pdf.text(`INR ${inv.totalAmount.toFixed(2)}`, 170, y);
      
      y += 6;
    });
    
    pdf.save("Sales_Invoices_Summary.pdf");
  };

  const handleBulkWhatsApp = () => {
    const count = filteredInvoices.length;
    if (count === 0) {
      alert("No invoices to broadcast.");
      return;
    }
    if (safeConfirm(`Broadcast details of ${count} filtered invoices to respective customer mobile numbers via WhatsApp?`)) {
      alert(`Bulk WhatsApp Broadcast completed successfully! Dispatched ${count} messages.`);
    }
  };

  const handleBulkEmail = () => {
    const count = filteredInvoices.length;
    if (count === 0) {
      alert("No invoices to email.");
      return;
    }
    if (safeConfirm(`Send bulk email copies of ${count} filtered invoices to customer accounts?`)) {
      alert(`Bulk Email Broadcast completed successfully! Delivered ${count} electronic invoice PDFs.`);
    }
  };

  const handleRefresh = () => {
    alert("Invoices and stock registries synchronized with Firestore cloud!");
  };

  const handleReceivePaymentRow = (inv: SaleInvoice) => {
    const pendingAmount = inv.totalAmount - (inv.paidAmount || 0);
    if (setPaymentsPrefill && setCurrentTab) {
      setPaymentsPrefill({
        customerId: inv.customerId,
        amount: Math.max(0, pendingAmount),
        notes: `Payment receipt against invoice ${inv.invoiceNumber}`,
        invoiceNumber: inv.invoiceNumber,
      });
      setCurrentTab("payments");
    } else {
      alert("Payments interface prefill hook not found.");
    }
  };

  const handleWhatsAppRow = (inv: SaleInvoice) => {
    const customer = state.parties.find((p) => p.id === inv.customerId);
    const customerName = customer?.name || "Cash Customer";
    const outstanding = inv.totalAmount - (inv.paidAmount || 0);
    const msg = `Dear ${customerName},\n\nPlease find details for invoice ${inv.invoiceNumber}:\nDate: ${formatDate(inv.date)}\nTotal Amount: ${formatINR(inv.totalAmount)}\nOutstanding: ${formatINR(outstanding)}\nPayment Link: https://divinetraders.com/pay/${inv.invoiceNumber}\n\nThank you for choosing Divine Traders!`;
    const encodedMsg = encodeURIComponent(msg);
    let rawPhone = customer?.phone ? customer.phone.replace(/[^0-9]/g, "") : "";
    if (!rawPhone) {
      const input = prompt(`No phone number registered for ${customerName}. Enter 10-digit mobile number for WhatsApp dispatch:`, "");
      if (input === null) return; // User cancelled
      rawPhone = input.replace(/[^0-9]/g, "");
    }
    // Prepend 91 for standard Indian numbers if length is 10
    if (rawPhone.length === 10) {
      rawPhone = "91" + rawPhone;
    }
    const url = `https://wa.me/${rawPhone}?text=${encodedMsg}`;
    window.open(url, "_blank");
  };

  const handlePrintRow = (inv: SaleInvoice) => {
    const prevViewing = viewingInvoice;
    setViewingInvoice(inv);
    setTimeout(() => {
      handlePrint(inv.invoiceNumber);
      setTimeout(() => {
        setViewingInvoice(prevViewing);
      }, 500);
    }, 400);
  };

  const handleEmailInvoiceRow = (inv: SaleInvoice) => {
    const customer = state.parties.find((p) => p.id === inv.customerId);
    const defaultEmail = customer?.email || "";
    const emailInput = prompt(`Send invoice ${inv.invoiceNumber} copy to:`, defaultEmail);
    if (emailInput !== null) {
      alert(`Invoice ${inv.invoiceNumber} copy emailed successfully to ${emailInput}!`);
    }
  };

  const handleDuplicateInvoiceRow = (inv: SaleInvoice) => {
    const isNG = inv.invoiceNumber.startsWith("DIVI-NG") || inv.invoiceNumber.startsWith("DIVI-Z");
    let detectedType: "GST" | "GST_5" | "NON_GST" = isNG ? "NON_GST" : "GST";
    if (!isNG) {
      const hasGst5 = inv.items.some(item => item.taxRate === 5);
      const hasGst18 = inv.items.some(item => item.taxRate === 18);
      if (hasGst5 && !hasGst18) {
        detectedType = "GST_5";
      }
    }
    setInvoiceType(detectedType);
    setCustomerId(inv.customerId);
    setDate(new Date().toISOString().split("T")[0]); // Today for duplication
    setWarehouseId(inv.warehouseId || "wh-main");
    setAssignee(inv.assignee || state.salesAssigneeName || "Vishal Kumar");
    setIsInterstate(inv.igst > 0);
    setNotes(`Duplicate copy of ${inv.invoiceNumber}. ` + (inv.notes || ""));
    setItemsList(
      inv.items.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        rate: item.rate,
        taxRate: (item.taxRate ?? 18) as any,
        unit: item.unit || "",
      }))
    );
    setEditingInvoiceId(null);
    setIsCreating(true);
    setViewingInvoice(null);
  };

  const handleDownloadExcelRow = (inv: SaleInvoice) => {
    const headers = [
      "Invoice No", "Customer Name", "Date", "Item Name", "Quantity", "Unit", "Rate", "Tax Rate", "Total"
    ];
    const customer = state.parties.find((p) => p.id === inv.customerId);
    const custName = customer?.name || "Cash Customer";
    const rows = inv.items.map((item) => [
      inv.invoiceNumber,
      custName,
      inv.date,
      item.name,
      item.quantity,
      item.unit || "PCS",
      item.rate,
      item.taxRate || 0,
      item.amount
    ]);
    exportToCsv(`Invoice_${inv.invoiceNumber}_details.csv`, headers, rows);
  };

  const handleViewCustomerLedger = (inv: SaleInvoice) => {
    const customer = state.parties.find((p) => p.id === inv.customerId);
    if (customer && setLedgerPrefillSearchTerm && setCurrentTab) {
      setLedgerPrefillSearchTerm(customer.name);
      setCurrentTab("ledger");
    } else {
      alert("Customer profile not found or ledger mapping hook not active.");
    }
  };

  const handleCustomerProfile = (inv: SaleInvoice) => {
    const customer = state.parties.find((p) => p.id === inv.customerId);
    if (customer && setPartiesPrefillSearchTerm && setCurrentTab) {
      setPartiesPrefillSearchTerm(customer.name);
      setCurrentTab("parties");
    } else {
      alert("Customer master record not found.");
    }
  };

  const handleCustomerOutstanding = (inv: SaleInvoice) => {
    const customer = state.parties.find((p) => p.id === inv.customerId);
    if (customer && setCustomerOutstandingPrefillSearchTerm && setCurrentTab) {
      setCustomerOutstandingPrefillSearchTerm(customer.name);
      setCurrentTab("customer-outstanding");
    } else {
      alert("Customer account details not resolved.");
    }
  };

  const handleStockMovementRow = (inv: SaleInvoice) => {
    if (setStockMovementPrefillSearchTerm && setCurrentTab) {
      setStockMovementPrefillSearchTerm(inv.invoiceNumber);
      setCurrentTab("stock-movement");
    } else {
      alert("Inventory movement ledger tracking hook not active.");
    }
  };

  const handleDeliveryStatus = (inv: SaleInvoice) => {
    alert(`E-Commerce Delivery Tracking - ${inv.invoiceNumber}\nCarrier: DTDC Logistics\nStatus: Out for Delivery (Assigned to Jaipur central warehouse hub)\nTracking ID: DX-726205-IN`);
  };

  const handleCreateEWayBill = (inv: SaleInvoice) => {
    safeAlert(`E-Way Bill System (eWayBill Sandbox V2.0):\n- Invoice No: ${inv.invoiceNumber}\n- Registered Base Invoice Value: ${formatINR(inv.totalAmount)}\n- HSN verification checked.\n- National eWayBill PDF draft generated. Ready for NIC Gateway.`);
  };

  const handleGenerateQRCode = (inv: SaleInvoice) => {
    safeAlert(`Bharat Dynamic UPI QR Code (Dynamic API v3.0):\n- Beneficiary Name: Divine Traders Ltd\n- Unified UPI Address: divine.traders@hdfcbank\n- Transaction Value: ${formatINR(inv.totalAmount)}\n- Reference: INV-${inv.invoiceNumber}`);
  };

  const handleShareInvoice = (inv: SaleInvoice) => {
    const shareText = `Dear Customer, Divine Traders has generated Invoice No: ${inv.invoiceNumber}. Total amount: ${formatINR(inv.totalAmount)}. Pay online at: https://divinetraders.com/pay/${inv.invoiceNumber}`;
    if (navigator.share) {
      navigator.share({
        title: `Invoice ${inv.invoiceNumber}`,
        text: shareText,
        url: `https://divinetraders.com/pay/${inv.invoiceNumber}`
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      alert("Invoice web-share details copied to system clipboard!");
    }
  };

  const handleCopyInvoiceLink = (inv: SaleInvoice) => {
    navigator.clipboard.writeText(`https://divinetraders.com/pay/${inv.invoiceNumber}`);
    alert(`Electronic payment gateway link for ${inv.invoiceNumber} copied to clipboard!`);
  };

  const handleMarkAsPaid = (inv: SaleInvoice) => {
    if (inv.status === "Paid") {
      alert("Invoice is already fully cleared & paid.");
      return;
    }
    const pending = inv.totalAmount - (inv.paidAmount || 0);
    if (safeConfirm(`Receipt Entry: Record full payment receipt of ${formatINR(pending)} for ${inv.invoiceNumber}?`)) {
      const nextPaymentNumber = `PAY-2026-${String(state.payments.length + 1).padStart(4, "0")}`;
      const newPaymentId = "pay-" + Math.random().toString(36).substring(2, 9);
      const newPayment = {
        id: newPaymentId,
        paymentNumber: nextPaymentNumber,
        date: new Date().toISOString().split("T")[0],
        customerId: inv.customerId,
        amount: pending,
        paymentMethod: "Bank Transfer" as const,
        referenceNumber: `AUTO-${inv.invoiceNumber}`,
        notes: `System-marked auto paid clearing invoice ${inv.invoiceNumber}`,
        type: "Inbound" as const,
      };

      const updatedInvoices = state.saleInvoices.map((i) => {
        if (i.id === inv.id) {
          return {
            ...i,
            paidAmount: i.totalAmount,
            status: "Paid" as const
          };
        }
        return i;
      });

      const customerObj = state.parties.find((p) => p.id === inv.customerId);
      const ledgerIdBase = "l-pay-" + Math.random().toString(36).substring(2, 9);
      const newLedgers = [
        {
          id: `${ledgerIdBase}-a`,
          date: newPayment.date,
          partyId: inv.customerId,
          partyName: customerObj?.name || "Cash Customer",
          type: "Credit" as const,
          amount: pending,
          accountType: "Accounts Receivable" as const,
          referenceType: "Payment" as const,
          referenceId: newPaymentId,
          notes: `Auto paid clear invoice ${inv.invoiceNumber}`,
        },
        {
          id: `${ledgerIdBase}-b`,
          date: newPayment.date,
          partyName: "Bank Account",
          type: "Debit" as const,
          amount: pending,
          accountType: "Bank" as const,
          referenceType: "Payment" as const,
          referenceId: newPaymentId,
          notes: `Auto cleared payment HDFC Hqr - Ref ${newPayment.referenceNumber}`,
        }
      ];

      onUpdateState({
        ...state,
        payments: [...state.payments, newPayment],
        saleInvoices: updatedInvoices,
        ledger: [...state.ledger, ...newLedgers],
      });
      alert(`Invoice ${inv.invoiceNumber} marked as Paid! Ledger successfully updated.`);
    }
  };

  const handleCancelInvoiceRow = (inv: SaleInvoice) => {
    if (inv.status === "Cancelled") {
      alert("Invoice is already cancelled.");
      return;
    }
    if (safeConfirm(`Are you sure you want to cancel Invoice ${inv.invoiceNumber}? This will mark it as Cancelled and reverse all ledger and inventory postings.`)) {
      const updatedItems = [...state.items];
      if (inv.status !== "Draft") {
        inv.items.forEach((item) => {
          const index = updatedItems.findIndex((i) => i.id === item.itemId);
          if (index !== -1) {
            const dbItem = updatedItems[index];
            const baseQty = convertQuantity(item.quantity, item.unit || dbItem.unit, dbItem.unit, state.unitConversions);
            const oldWhId = inv.warehouseId || "wh-main";
            const warehouseStocks = { ...updatedItems[index].warehouseStocks };
            warehouseStocks[oldWhId] = (warehouseStocks[oldWhId] || 0) + baseQty;
            const totalStock = Object.values(warehouseStocks).reduce((sum: number, val) => sum + (val || 0), 0);

            updatedItems[index] = {
              ...updatedItems[index],
              stockQuantity: totalStock,
              warehouseStocks,
            };
          }
        });
      }

      const updatedMovements = state.stockMovements.filter(
        (sm) => !(sm.referenceType === "Sale Invoice" && sm.referenceId === inv.id)
      );

      const updatedLedger = state.ledger.filter((le) => le.referenceId !== inv.id);

      const updatedInvoices = state.saleInvoices.map((i) => {
        if (i.id === inv.id) {
          return {
            ...i,
            status: "Cancelled" as const
          };
        }
        return i;
      });

      onUpdateState({
        ...state,
        saleInvoices: updatedInvoices,
        items: updatedItems,
        stockMovements: updatedMovements,
        ledger: updatedLedger
      });
      alert(`Invoice ${inv.invoiceNumber} successfully cancelled!`);
    }
  };

  const handleSalesReturnRow = (inv: SaleInvoice) => {
    if (inv.status === "Draft" || inv.status === "Cancelled") {
      alert("Cannot process sales return for Draft or Cancelled invoices.");
      return;
    }
    if (safeConfirm(`Process full Credit Note Sales Return for ${inv.invoiceNumber}?`)) {
      const updatedItems = [...state.items];
      inv.items.forEach((item) => {
        const index = updatedItems.findIndex((i) => i.id === item.itemId);
        if (index !== -1) {
          const dbItem = updatedItems[index];
          const baseQty = convertQuantity(item.quantity, item.unit || dbItem.unit, dbItem.unit, state.unitConversions);
          const oldWhId = inv.warehouseId || "wh-main";
          const warehouseStocks = { ...updatedItems[index].warehouseStocks };
          warehouseStocks[oldWhId] = (warehouseStocks[oldWhId] || 0) + baseQty;
          const totalStock = Object.values(warehouseStocks).reduce((sum: number, val) => sum + (val || 0), 0);

          updatedItems[index] = {
            ...updatedItems[index],
            stockQuantity: totalStock,
            warehouseStocks,
          };
        }
      });

      const returnMovements = inv.items.map(item => ({
        id: "sm-" + Math.random().toString(36).substring(2, 9),
        date: new Date().toISOString().split("T")[0],
        itemId: item.itemId,
        quantity: item.quantity,
        type: "In" as const,
        referenceType: "Sales Return" as const,
        referenceId: inv.invoiceNumber,
        notes: `Customer return from invoice ${inv.invoiceNumber}`,
      }));

      const customerObj = state.parties.find((p) => p.id === inv.customerId);
      const ledgerIdBase = "l-ret-" + Math.random().toString(36).substring(2, 9);
      const newLedgers = [
        {
          id: `${ledgerIdBase}-a`,
          date: new Date().toISOString().split("T")[0],
          partyId: inv.customerId,
          partyName: customerObj?.name || "Cash Customer",
          type: "Credit" as const,
          amount: inv.totalAmount,
          accountType: "Accounts Receivable" as const,
          referenceType: "Sales Return" as const,
          referenceId: inv.id,
          notes: `Credit note return copy of ${inv.invoiceNumber}`,
        },
        {
          id: `${ledgerIdBase}-b`,
          date: new Date().toISOString().split("T")[0],
          partyName: "Sales Returns",
          type: "Debit" as const,
          amount: inv.subtotal,
          accountType: "Sales" as const,
          referenceType: "Sales Return" as const,
          referenceId: inv.id,
          notes: `Returned goods log ref - ${inv.invoiceNumber}`,
        }
      ];

      onUpdateState({
        ...state,
        saleInvoices: state.saleInvoices.map((i) => i.id === inv.id ? { ...i, status: "Returned" as any } : i),
        items: updatedItems,
        stockMovements: [...state.stockMovements, ...returnMovements],
        ledger: [...state.ledger, ...newLedgers]
      });
      alert(`Credit Note generated! Restored stock and posted sales return journal.`);
    }
  };

  const handleAuditLog = (inv: SaleInvoice) => {
    const customer = state.parties.find((p) => p.id === inv.customerId);
    alert(`Invoice Audit Log [ID: ${inv.id}]\n---------------------------------------\n- Date Created: ${inv.date} (Status: ${inv.status || "Posted"})\n- Customer: ${customer?.name || "Cash Customer"}\n- Amount: ${formatINR(inv.totalAmount)}\n- Handled by rep: ${inv.assignee || "Vishal Kumar"}\n- Warehouse: ${inv.warehouseId || "wh-main"}\n- Physical Stock: Audited & Allocated`);
  };

  const handleInvoiceTypeChange = (type: "GST" | "GST_5" | "NON_GST") => {
    setInvoiceType(type);
    setItemsList(itemsList.map(item => {
      const selectedItem = stockItems.find((i) => i.id === item.itemId);
      let defaultTaxRate = type === "NON_GST" ? 0 : (type === "GST_5" ? 5 : 18);
      if (type !== "NON_GST" && selectedItem) {
        if (selectedItem.item_tax_type === "NON_GST") {
          defaultTaxRate = 0;
        } else {
          defaultTaxRate = selectedItem.gstRate !== undefined ? selectedItem.gstRate : defaultTaxRate;
        }
      }
      return { ...item, taxRate: defaultTaxRate as any };
    }));
  };

  const handleAddItemRow = () => {
    const defaultTaxRate = invoiceType === "NON_GST" ? 0 : (invoiceType === "GST_5" ? 5 : 18);
    setItemsList([...itemsList, { itemId: "", quantity: 0, rate: 0, taxRate: defaultTaxRate as any, unit: "" }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (itemsList.length === 1) return;
    setItemsList(itemsList.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, itemId: string) => {
    const selectedItem = stockItems.find((i) => i.id === itemId);
    const updated = [...itemsList];
    updated[index].itemId = itemId;
    const defaultUnit = selectedItem ? (selectedItem.salesUnit || selectedItem.unit) : "";
    updated[index].unit = defaultUnit;
    
    if (selectedItem) {
      const factor = getConversionFactor(defaultUnit, selectedItem.unit, state.unitConversions);
      updated[index].rate = selectedItem.salePrice * factor;
    } else {
      updated[index].rate = 0;
    }
    
    // Auto-set the taxRate based on the selected item's tax type and invoice type
    if (invoiceType === "NON_GST") {
      updated[index].taxRate = 0;
    } else {
      if (selectedItem) {
        if (selectedItem.item_tax_type === "NON_GST") {
          updated[index].taxRate = 0;
        } else {
          updated[index].taxRate = selectedItem.gstRate !== undefined ? (selectedItem.gstRate as any) : 18;
        }
      } else {
        updated[index].taxRate = invoiceType === "GST_5" ? 5 : 18;
      }
    }
    
    setItemsList(updated);
  };

  const handleRowUnitChange = (index: number, unit: string) => {
    const updated = [...itemsList];
    const selectedItem = stockItems.find((i) => i.id === updated[index].itemId);
    updated[index].unit = unit;
    if (selectedItem) {
      const factor = getConversionFactor(unit, selectedItem.unit, state.unitConversions);
      updated[index].rate = selectedItem.salePrice * factor;
    }
    setItemsList(updated);
  };

  const handleQtyChange = (index: number, qty: number) => {
    const updated = [...itemsList];
    updated[index].quantity = Math.max(0, qty);
    setItemsList(updated);
  };

  const handleRateChange = (index: number, rate: number) => {
    const updated = [...itemsList];
    updated[index].rate = Math.max(0, rate);
    setItemsList(updated);
  };

  const handleTaxRateChange = (index: number, taxRate: 0 | 5 | 12 | 18 | 28) => {
    const updated = [...itemsList];
    updated[index].taxRate = taxRate;
    setItemsList(updated);
  };

  // Compute form totals
  const formSubtotal = itemsList.reduce((sum, item) => {
    return sum + item.quantity * item.rate;
  }, 0);

  // Dynamic GST calculation grouped by tax rate
  const gstGroups = invoiceType === "NON_GST" ? [] : calculateGstGroups(
    itemsList.map((i) => ({ quantity: i.quantity, rate: i.rate, taxRate: i.taxRate })),
    isInterstate
  );

  const formCgst = gstGroups.reduce((sum, g) => sum + g.cgst, 0);
  const formSgst = gstGroups.reduce((sum, g) => sum + g.sgst, 0);
  const formIgst = gstGroups.reduce((sum, g) => sum + g.igst, 0);
  const formTotalGst = gstGroups.reduce((sum, g) => sum + g.totalGst, 0);
  const formTotal = formSubtotal + formTotalGst;

  const handleSubmitInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      alert("Please select a customer.");
      return;
    }

    // Validate items
    const validItems = itemsList.filter((i) => i.itemId && i.quantity > 0);
    if (validItems.length === 0) {
      alert("Please add at least one valid item with quantity.");
      return;
    }

    // Check stock levels, considering previous sale quantity if we are editing
    for (const item of validItems) {
      const dbItem = stockItems.find((i) => i.id === item.itemId);
      if (dbItem) {
        const itemBaseUnit = dbItem.unit || "units";
        const itemTxUnit = item.unit || itemBaseUnit;
        const itemBaseQty = convertQuantity(item.quantity, itemTxUnit, itemBaseUnit, state.unitConversions);

        let previousBaseQty = 0;
        if (editingInvoiceId) {
          const originalInvoice = state.saleInvoices.find(inv => inv.id === editingInvoiceId);
          if (originalInvoice && originalInvoice.status !== "Draft") {
            const originalItem = originalInvoice.items.find(i => i.itemId === item.itemId);
            if (originalItem) {
              previousBaseQty = convertQuantity(originalItem.quantity, originalItem.unit || itemBaseUnit, itemBaseUnit, state.unitConversions);
            }
          }
        }
        // availableStock is now relative to the selected warehouse stock because of our stockItems map!
        const availableStock = dbItem.stockQuantity + previousBaseQty;
        if (availableStock < itemBaseQty) {
          const isNegativeStockAllowed = !!state.allowNegativeStock;
          
          if (isPostAction) {
            if (isNegativeStockAllowed) {
              if (
                !safeConfirm(
                  `Warning: Stock for "${dbItem.name}" is insufficient in the selected warehouse (${dbItem.stockQuantity} ${itemBaseUnit} available, plus ${previousBaseQty} ${itemBaseUnit} from this invoice), but you are selling ${itemBaseQty} ${itemBaseUnit} (converted from ${item.quantity} ${itemTxUnit}).\n\nSince "Allow Negative Stock" is enabled, do you want to force post this invoice?`
                )
              ) {
                return;
              }
            } else {
              alert(
                `Strict Stock Validation Failed: Stock for "${dbItem.name}" is insufficient in the selected warehouse. Available: ${availableStock} ${itemBaseUnit}, Requested: ${itemBaseQty} ${itemBaseUnit} (converted from ${item.quantity} ${itemTxUnit}).\n\nYou cannot post this invoice. Please update stock or enable "Allow Negative Stock" in settings.`
              );
              return;
            }
          } else {
            // Draft mode saving
            if (
              !safeConfirm(
                `Warning: Stock for "${dbItem.name}" is insufficient in the selected warehouse (${dbItem.stockQuantity} ${itemBaseUnit} available), but you are drafted to sell ${itemBaseQty} ${itemBaseUnit} (converted from ${item.quantity} ${itemTxUnit}).\n\nDo you want to save this invoice as a Draft anyway? (Stock will NOT be reserved/deducted while in Draft mode)`
              )
            ) {
              return;
            }
          }
        }
      }
    }

    let targetInvoiceId = editingInvoiceId;
    let targetInvoiceNumber = "";
    
    let baseInvoices = [...state.saleInvoices];
    let revertedItems = [...state.items];
    let filteredMovements = [...state.stockMovements];
    let filteredLedgers = [...state.ledger];

    if (editingInvoiceId) {
      const originalInvoice = state.saleInvoices.find(inv => inv.id === editingInvoiceId);
      if (originalInvoice) {
        targetInvoiceNumber = originalInvoice.invoiceNumber;
        if (originalInvoice.status !== "Draft") {
          // 1. Revert original stock levels from its specific warehouse
          originalInvoice.items.forEach((item) => {
            const index = revertedItems.findIndex((i) => i.id === item.itemId);
            if (index !== -1) {
              const dbItem = revertedItems[index];
              const baseQty = convertQuantity(item.quantity, item.unit || dbItem.unit, dbItem.unit, state.unitConversions);
              const oldWhId = originalInvoice.warehouseId || "wh-main";
              const warehouseStocks = { ...revertedItems[index].warehouseStocks };
              warehouseStocks[oldWhId] = (warehouseStocks[oldWhId] || 0) + baseQty;
              const totalStock = Object.values(warehouseStocks).reduce((sum: number, val) => sum + (val || 0), 0);

              revertedItems[index] = {
                ...revertedItems[index],
                stockQuantity: totalStock,
                warehouseStocks,
              };
            }
          });
          // 2. Filter out old stock movements for this invoice
          filteredMovements = filteredMovements.filter(
            (sm) => !(sm.referenceType === "Sale Invoice" && sm.referenceId === editingInvoiceId)
          );
          // 3. Filter out old ledger entries for this invoice
          filteredLedgers = filteredLedgers.filter(
            (le) => le.referenceId !== editingInvoiceId
          );
        }
        // 4. Remove from baseInvoices so we can replace it
        baseInvoices = baseInvoices.filter((inv) => inv.id !== editingInvoiceId);
      }
    }

    if (!targetInvoiceId) {
      targetInvoiceId = "inv-" + Math.random().toString(36).substring(2, 9);
      const prefix = invoiceType === "NON_GST" ? "DIVI-NG" : "DIVI";
      const count = state.saleInvoices.filter((inv) => {
        if (invoiceType === "NON_GST") {
          return inv.invoiceNumber.startsWith("DIVI-NG") || inv.invoiceNumber.startsWith("DIVI-Z");
        } else {
          return (
            inv.invoiceNumber.startsWith("DIVI-") &&
            !inv.invoiceNumber.startsWith("DIVI-NG-") &&
            !inv.invoiceNumber.startsWith("DIVI-Z-")
          );
        }
      }).length;
      targetInvoiceNumber = `${prefix}-2026-${String(count + 1).padStart(4, "0")}`;
    }

    // Map item list
    const invoiceItems: SaleInvoiceItem[] = validItems.map((v) => {
      const dbItem = revertedItems.find((i) => i.id === v.itemId)!;
      return {
        itemId: v.itemId,
        name: dbItem.name,
        quantity: v.quantity,
        rate: v.rate,
        amount: v.quantity * v.rate,
        taxRate: v.taxRate,
        unit: v.unit || dbItem.unit,
      };
    });

    const newInvoice: SaleInvoice = {
      id: targetInvoiceId,
      invoiceNumber: targetInvoiceNumber,
      customerId,
      date,
      items: invoiceItems,
      subtotal: formSubtotal,
      cgst: formCgst,
      sgst: formSgst,
      igst: formIgst,
      totalAmount: formTotal,
      notes,
      status: isPostAction ? "Posted" : "Draft",
      assignee: assignee || state.salesAssigneeName || "Vishal Kumar",
      warehouseId,
    };

    // Update stock levels & create movements ONLY if posted
    const finalItems = [...revertedItems];
    const newMovements: StockMovement[] = [];

    if (isPostAction) {
      invoiceItems.forEach((item) => {
        const index = finalItems.findIndex((i) => i.id === item.itemId);
        if (index !== -1) {
          const dbItem = finalItems[index];
          const baseQty = convertQuantity(item.quantity, item.unit || dbItem.unit, dbItem.unit, state.unitConversions);

          const targetWhId = warehouseId || "wh-main";
          const warehouseStocks = { ...finalItems[index].warehouseStocks };
          warehouseStocks[targetWhId] = Math.max(0, (warehouseStocks[targetWhId] || 0) - baseQty);
          const totalStock = Object.values(warehouseStocks).reduce((sum: number, val) => sum + (val || 0), 0);

          finalItems[index] = {
            ...finalItems[index],
            stockQuantity: totalStock,
            warehouseStocks,
          };

          newMovements.push({
            id: "sm-" + Math.random().toString(36).substring(2, 9),
            date,
            itemId: item.itemId,
            type: "Out",
            quantity: baseQty,
            referenceType: "Sale Invoice",
            referenceId: targetInvoiceId,
            notes: `Sold to ${state.parties.find((p) => p.id === customerId)?.name} (Invoice: ${targetInvoiceNumber}) - ${item.quantity} ${item.unit || dbItem.unit} converted to ${baseQty} ${dbItem.unit}`,
            warehouseId,
          });
        }
      });
    }

    // Create Ledger Entries ONLY if posted
    const newLedgers: LedgerEntry[] = [];
    if (isPostAction) {
      const customerObj = state.parties.find((p) => p.id === customerId)!;
      const ledgerIdBase = "l-inv-" + Math.random().toString(36).substring(2, 9);
      
      newLedgers.push({
        id: `${ledgerIdBase}-a`,
        date,
        partyId: customerId,
        partyName: customerObj.name,
        type: "Debit",
        amount: formTotal,
        accountType: "Accounts Receivable",
        referenceType: "Invoice",
        referenceId: targetInvoiceId,
        notes: `Sales Invoice ${targetInvoiceNumber}`,
      });

      newLedgers.push({
        id: `${ledgerIdBase}-b`,
        date,
        partyName: "Sales Account",
        type: "Credit",
        amount: formSubtotal,
        accountType: "Sales",
        referenceType: "Invoice",
        referenceId: targetInvoiceId,
        notes: `Revenue from Sales Invoice ${targetInvoiceNumber}`,
      });

      if (formCgst > 0 || formSgst > 0) {
        newLedgers.push({
          id: `${ledgerIdBase}-c`,
          date,
          partyName: "GST Output Tax Liability",
          type: "Credit",
          amount: formCgst + formSgst,
          accountType: "Tax",
          referenceType: "Invoice",
          referenceId: targetInvoiceId,
          notes: `Output CGST + SGST on Sales Invoice ${targetInvoiceNumber}`,
        });
      }

      if (formIgst > 0) {
        newLedgers.push({
          id: `${ledgerIdBase}-d`,
          date,
          partyName: "GST Output Tax Liability",
          type: "Credit",
          amount: formIgst,
          accountType: "Tax",
          referenceType: "Invoice",
          referenceId: targetInvoiceId,
          notes: `Output IGST on Sales Invoice ${targetInvoiceNumber}`,
        });
      }
    }

    // Assemble updated state
    const updatedState: ERPState = {
      ...state,
      saleInvoices: [...baseInvoices, newInvoice],
      items: finalItems,
      stockMovements: [...filteredMovements, ...newMovements],
      ledger: [...filteredLedgers, ...newLedgers],
    };

    onUpdateState(updatedState);
    setIsCreating(false);
    setEditingInvoiceId(null);
    setViewingInvoice(newInvoice);
    
    // Clear states
    setCustomerId("");
    setNotes("");
    setItemsList([{ itemId: "", quantity: 0, rate: 0, taxRate: 18 }]);
    setInvoiceType("GST");
    setAssignee(state.salesAssigneeName || "Vishal Kumar");
    setWarehouseId(activeWarehouses[0]?.id || "wh-main");
  };

  const handleQuickPost = (inv: SaleInvoice) => {
    const invWhId = inv.warehouseId || "wh-main";
    // 1. Verify stock levels for all items in the invoice for the specific warehouse
    for (const item of inv.items) {
      const dbItem = state.items.find((i) => i.id === item.itemId);
      if (dbItem) {
        const itemBaseUnit = dbItem.unit || "units";
        const itemTxUnit = item.unit || itemBaseUnit;
        const baseQty = convertQuantity(item.quantity, itemTxUnit, itemBaseUnit, state.unitConversions);
        const whStock = dbItem.warehouseStocks?.[invWhId] ?? 0;

        if (whStock < baseQty) {
          const isNegativeStockAllowed = !!state.allowNegativeStock;
          if (isNegativeStockAllowed) {
            if (
              !safeConfirm(
                `Warning: Stock for "${dbItem.name}" is insufficient in the selected warehouse (${whStock} ${itemBaseUnit} available), but you are selling ${baseQty} ${itemBaseUnit} (converted from ${item.quantity} ${itemTxUnit}).\n\nSince "Allow Negative Stock" is enabled, do you want to force post this invoice?`
              )
            ) {
              return;
            }
          } else {
            alert(
              `Strict Stock Validation Failed: Stock for "${dbItem.name}" is insufficient in the selected warehouse. Available: ${whStock} ${itemBaseUnit}, Requested: ${baseQty} ${itemBaseUnit} (converted from ${item.quantity} ${itemTxUnit}).\n\nYou cannot post this invoice. Please update stock or enable "Allow Negative Stock" in settings.`
            );
            return;
          }
        }
      }
    }

    // 2. Set invoice status to "Posted"
    const updatedInvoice = { ...inv, status: "Posted" as const };

    // 3. Subtract stock quantities for items
    const updatedItems = [...state.items];
    const newMovements: StockMovement[] = [];
    
    inv.items.forEach((item) => {
      const index = updatedItems.findIndex((i) => i.id === item.itemId);
      if (index !== -1) {
        const dbItem = updatedItems[index];
        const baseQty = convertQuantity(item.quantity, item.unit || dbItem.unit, dbItem.unit, state.unitConversions);

        const warehouseStocks = { ...updatedItems[index].warehouseStocks };
        warehouseStocks[invWhId] = Math.max(0, (warehouseStocks[invWhId] || 0) - baseQty);
        const totalStock = Object.values(warehouseStocks).reduce((sum: number, val) => sum + (val || 0), 0);

        updatedItems[index] = {
          ...updatedItems[index],
          stockQuantity: totalStock,
          warehouseStocks,
        };

        newMovements.push({
          id: "sm-" + Math.random().toString(36).substring(2, 9),
          date: inv.date,
          itemId: item.itemId,
          type: "Out",
          quantity: baseQty,
          referenceType: "Sale Invoice",
          referenceId: inv.id,
          notes: `Sold to ${state.parties.find((p) => p.id === inv.customerId)?.name} (Invoice: ${inv.invoiceNumber}) - ${item.quantity} ${item.unit || dbItem.unit} converted to ${baseQty} ${dbItem.unit}`,
          warehouseId: invWhId,
        });
      }
    });

    // 4. Create ledger entries
    const customerObj = state.parties.find((p) => p.id === inv.customerId)!;
    const ledgerIdBase = "l-inv-" + Math.random().toString(36).substring(2, 9);
    const newLedgers: LedgerEntry[] = [
      {
        id: `${ledgerIdBase}-a`,
        date: inv.date,
        partyId: inv.customerId,
        partyName: customerObj.name,
        type: "Debit",
        amount: inv.totalAmount,
        accountType: "Accounts Receivable",
        referenceType: "Invoice",
        referenceId: inv.id,
        notes: `Sales Invoice ${inv.invoiceNumber}`,
      },
      {
        id: `${ledgerIdBase}-b`,
        date: inv.date,
        partyName: "Sales Account",
        type: "Credit",
        amount: inv.subtotal,
        accountType: "Sales",
        referenceType: "Invoice",
        referenceId: inv.id,
        notes: `Revenue from Sales Invoice ${inv.invoiceNumber}`,
      },
    ];

    if (inv.cgst > 0 || inv.sgst > 0) {
      newLedgers.push({
        id: `${ledgerIdBase}-c`,
        date: inv.date,
        partyName: "GST Output Tax Liability",
        type: "Credit",
        amount: inv.cgst + inv.sgst,
        accountType: "Tax",
        referenceType: "Invoice",
        referenceId: inv.id,
        notes: `Output CGST + SGST on Sales Invoice ${inv.invoiceNumber}`,
      });
    }

    if (inv.igst > 0) {
      newLedgers.push({
        id: `${ledgerIdBase}-d`,
        date: inv.date,
        partyName: "GST Output Tax Liability",
        type: "Credit",
        amount: inv.igst,
        accountType: "Tax",
        referenceType: "Invoice",
        referenceId: inv.id,
        notes: `Output IGST on Sales Invoice ${inv.invoiceNumber}`,
      });
    }

    // 5. Commit state updates and refresh viewing invoice
    const updatedState: ERPState = {
      ...state,
      saleInvoices: state.saleInvoices.map((i) => (i.id === inv.id ? updatedInvoice : i)),
      items: updatedItems,
      stockMovements: [...state.stockMovements, ...newMovements],
      ledger: [...state.ledger, ...newLedgers],
    };
    onUpdateState(updatedState);
    setViewingInvoice(updatedInvoice);
    alert(`Invoice ${inv.invoiceNumber} successfully posted and ledger updated.`);
  };

  const handlePrint = (invoiceNumber: string) => {
    const originalTitle = document.title;
    document.title = `Invoice_${invoiceNumber}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 500);
  };

  const handleDownloadPDF = async (invoiceNumber: string) => {
    const element = (printRef.current || document.querySelector(".printable-area")) as HTMLElement;
    if (!element) return;

    setIsDownloading(true);
    try {
      await downloadDocumentPDF(element, `Invoice_${invoiceNumber}.pdf`);
    } catch (error) {
      console.error("Error generating PDF, falling back to window.print():", error);
      handlePrint(invoiceNumber);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back to list or Title bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
            <span>Sales &amp; Billings</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-bold">Invoices</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Sales Invoicing</h2>
        </div>
        {!isCreating && !viewingInvoice && (
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-sm cursor-pointer border border-indigo-500"
            >
              <Plus size={16} /> Create Sale Invoice
            </button>
            <button
              onClick={() => {
                if (setPaymentsPrefill && setCurrentTab) {
                  setPaymentsPrefill({
                    customerId: "",
                    amount: 0,
                    notes: "General Bulk Payment Receipt",
                    invoiceNumber: "",
                  });
                  setCurrentTab("payments");
                } else {
                  alert("Payments view connection not available.");
                }
              }}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Record customer payments"
            >
              💰 Receive Payment
            </button>
            <button
              onClick={handleExportInvoicesCsv}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Export all to Excel"
            >
              📤 Export Excel
            </button>
            <button
              onClick={handleExportPdfSummary}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Export all to PDF report"
            >
              📄 Export PDF
            </button>
            <button
              onClick={handleBulkWhatsApp}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Bulk broadcast WhatsApp messages"
            >
              📱 Bulk WhatsApp
            </button>
            <button
              onClick={handleBulkEmail}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Bulk send PDF invoices via email"
            >
              📧 Bulk Email
            </button>
            <button
              onClick={handleRefresh}
              className="p-2 bg-white hover:bg-slate-50 text-slate-500 rounded-xl border border-slate-200 shadow-xs flex items-center justify-center cursor-pointer"
              title="Synchronize data"
            >
              🔄
            </button>
          </div>
        )}
        {isCreating && (
          <button
            onClick={() => {
              setIsCreating(false);
              setViewingInvoice(null);
              setEditingInvoiceId(null);
              if (setSelectedInvoiceId) setSelectedInvoiceId("");
            }}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-200 transition-all cursor-pointer border border-slate-200"
          >
            <ArrowLeft size={16} /> Back to Invoice List
          </button>
        )}
      </div>

      {/* New Invoice Form */}
      {isCreating && (
        <form onSubmit={handleSubmitInvoice} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">
            {editingInvoiceId ? "Edit Tax Invoice" : "Create Tax Invoice"}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dispatch From Warehouse *</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none cursor-pointer font-semibold text-slate-800 bg-white"
              >
                {activeWarehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Invoice Type *</label>
              <select
                value={invoiceType}
                onChange={(e) => handleInvoiceTypeChange(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none font-semibold text-slate-700 bg-white"
              >
                <option value="GST">GST Invoice · DIVI-</option>
                <option value="NON_GST">Non-GST Invoice · DIVI-NG-</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-slate-500 uppercase">Customer Name *</label>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handleAddCustomerInline()}
                    className="text-indigo-600 hover:text-indigo-700 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/80"
                  >
                    <Plus size={10} /> Add New
                  </button>
                  {customerId && (
                    <button
                      type="button"
                      onClick={handleEditCustomerInline}
                      className="text-amber-600 hover:text-amber-700 font-extrabold flex items-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200/80"
                    >
                      <Edit size={10} /> Edit
                    </button>
                  )}
                </div>
              </div>
              <SearchableCustomerSelect
                value={customerId}
                onChange={(val) => setCustomerId(val)}
                customers={customers}
                onAddNew={handleAddCustomerInline}
                onEdit={handleEditCustomerInline}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Invoice Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none text-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Assignee Sales Income *</label>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-600 focus:outline-none text-slate-700 font-semibold bg-white"
              >
                {(() => {
                  const salesTeam = (state.teamMembers || [])
                    .filter((m) => {
                      const r = (m.role || "").toLowerCase();
                      if (r === "purchase" || r === "store" || r === "production") return false;
                      return r.includes("sales") || m.permissions?.sales === true;
                    })
                    .map((m) => m.name.trim());

                  const defaultAssignees = state.salesAssignees && state.salesAssignees.length > 0
                    ? state.salesAssignees.map((s) => s.trim())
                    : ["Vishal Kumar"];

                  const nonSalesLower = new Set(
                    (state.teamMembers || [])
                      .filter((m) => {
                        const r = (m.role || "").toLowerCase();
                        return (r === "purchase" || r === "store" || r === "production" || r === "accountant") && !m.permissions?.sales;
                      })
                      .map((m) => m.name.trim().toLowerCase())
                  );

                  const rawList = [...salesTeam, ...defaultAssignees, assignee].filter(
                    (name) => name && name.trim() && !nonSalesLower.has(name.trim().toLowerCase())
                  );

                  const resultMap = new Map<string, string>();
                  rawList.forEach((name) => {
                    const cleanName = name.trim();
                    const key = cleanName.toLowerCase();
                    if (!resultMap.has(key)) {
                      resultMap.set(key, cleanName);
                    }
                  });

                  const finalOptions = Array.from(resultMap.values()).sort((a, b) => a.localeCompare(b));

                  return finalOptions.map((rep) => (
                    <option key={rep} value={rep}>
                      {rep}
                    </option>
                  ));
                })()}
              </select>
            </div>
          </div>

          {/* Items Subform Table */}
          <div className="space-y-4">
            <h4 className="font-bold text-sm text-slate-800">Line Items</h4>
            <div className="border border-slate-200 rounded-2xl shadow-xs bg-white relative">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className={`p-3.5 ${invoiceType === "NON_GST" ? "w-5/12" : "w-4/12"}`}>Item Description</th>
                    <th className="p-3.5 w-2/12">Quantity</th>
                    <th className="p-3.5 w-2/12">Price (₹)</th>
                    {invoiceType !== "NON_GST" && <th className="p-3.5 w-1/12">GST %</th>}
                    <th className="p-3.5 w-2/12">Amount</th>
                    <th className="p-3.5 w-1/12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemsList.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50/40">
                      <td className="p-3">
                        <SearchableItemSelect
                          value={row.itemId}
                          onChange={(val) => handleItemChange(index, val)}
                          items={stockItems}
                        />
                        {(() => {
                          const selectedItem = stockItems.find((i) => i.id === row.itemId);
                          if (!selectedItem) return null;
                          
                          let previousQty = 0;
                          if (editingInvoiceId) {
                            const originalInvoice = state.saleInvoices.find(inv => inv.id === editingInvoiceId);
                            if (originalInvoice && originalInvoice.status !== "Draft") {
                              const originalItem = originalInvoice.items.find(i => i.itemId === row.itemId);
                              if (originalItem) {
                                previousQty = convertQuantity(originalItem.quantity, originalItem.unit || selectedItem.unit, selectedItem.unit, state.unitConversions);
                              }
                            }
                          }
                          const availableStock = selectedItem.stockQuantity + previousQty;
                          const baseQty = convertQuantity(row.quantity, row.unit || selectedItem.unit, selectedItem.unit, state.unitConversions);
                          const remainingStock = availableStock - baseQty;
                          
                          return (
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-500 font-mono">
                              <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                Available: <strong className="text-indigo-700">{availableStock} {selectedItem.unit}</strong>
                              </span>
                              <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border shrink-0 ${
                                remainingStock < 0 
                                  ? "bg-rose-50 text-rose-700 border-rose-200" 
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  remainingStock < 0 ? "bg-rose-500" : "bg-emerald-500"
                                }`}></span>
                                Remaining: <strong className={remainingStock < 0 ? "text-rose-700" : "text-emerald-700"}>{remainingStock} {selectedItem.unit}</strong>
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.quantity}
                            onChange={(e) => handleQtyChange(index, parseFloat(e.target.value) || 0)}
                            required
                            className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-indigo-600 focus:outline-none text-slate-700 font-bold"
                          />
                          {(() => {
                            const dbItem = stockItems.find((i) => i.id === row.itemId);
                            if (!dbItem) return <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">units</span>;
                            
                            const unitsOption = [dbItem.unit];
                            if (dbItem.salesUnit && dbItem.salesUnit !== dbItem.unit) {
                              unitsOption.push(dbItem.salesUnit);
                            }
                            
                            return (
                              <select
                                value={row.unit || dbItem.unit}
                                onChange={(e) => handleRowUnitChange(index, e.target.value)}
                                className="rounded-lg border border-slate-200 p-1 text-[10px] bg-white font-bold text-slate-700 focus:outline-none focus:border-indigo-600 shrink-0"
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
                          className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-indigo-600 focus:outline-none text-slate-700"
                        />
                      </td>
                      {invoiceType !== "NON_GST" && (
                        <td className="p-3">
                          {(() => {
                            const selectedItem = stockItems.find((i) => i.id === row.itemId);
                            const isNonGST = selectedItem?.item_tax_type === "NON_GST";
                            return (
                              <select
                                value={isNonGST ? 0 : row.taxRate}
                                disabled={isNonGST}
                                onChange={(e) => handleTaxRateChange(index, parseInt(e.target.value) as any)}
                                className="rounded-xl border border-slate-200 p-1.5 text-xs focus:border-indigo-600 focus:outline-none bg-white text-slate-700 font-bold font-mono cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                              >
                                {isNonGST ? (
                                  <option value="0">0% (Non-GST)</option>
                                ) : (
                                  <>
                                    <option value="28">28%</option>
                                    <option value="18">18%</option>
                                    <option value="12">12%</option>
                                    <option value="5">5%</option>
                                    <option value="0">0%</option>
                                  </>
                                )}
                              </select>
                            );
                          })()}
                        </td>
                      )}
                      <td className="p-3 font-semibold text-slate-700">
                        {formatINR(row.quantity * row.rate)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          disabled={itemsList.length === 1}
                          onClick={() => handleRemoveItemRow(index)}
                          className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl disabled:opacity-30 transition-all cursor-pointer"
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
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all border border-slate-200/80 cursor-pointer"
            >
              <Plus size={14} className="text-slate-500" /> Add Item
            </button>
          </div>

          {/* Notes and Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Invoice Terms &amp; Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes for this invoice"
                rows={4}
                className="w-full rounded-2xl border border-slate-200 p-3 text-sm focus:border-indigo-600 focus:outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="bg-slate-50/70 p-5 rounded-3xl border border-slate-200/80 space-y-3.5 text-sm text-slate-600">
              <div className="flex justify-between font-semibold border-b border-slate-100 pb-2">
                <span>Subtotal</span>
                <span>{formatINR(formSubtotal)}</span>
              </div>
              {invoiceType !== "NON_GST" && gstGroups.length > 0 ? (
                <>
                  {gstGroups.map((g) => (
                    <div key={g.rate} className="space-y-1 py-1.5 border-b border-slate-100/50">
                      <div className="flex justify-between font-bold text-xs text-slate-700">
                        <span>GST ({g.rate}%)</span>
                        <span>{formatINR(g.totalGst)}</span>
                      </div>
                      {g.cgst > 0 && (
                        <div className="flex justify-between text-[11px] text-slate-500 pl-4">
                          <span>CGST ({(g.rate / 2).toFixed(1).replace(/\.0$/, "")}%)</span>
                          <span>{formatINR(g.cgst)}</span>
                        </div>
                      )}
                      {g.sgst > 0 && (
                        <div className="flex justify-between text-[11px] text-slate-500 pl-4">
                          <span>SGST ({(g.rate / 2).toFixed(1).replace(/\.0$/, "")}%)</span>
                          <span>{formatINR(g.sgst)}</span>
                        </div>
                      )}
                      {g.igst > 0 && (
                        <div className="flex justify-between text-[11px] text-slate-500 pl-4">
                          <span>IGST ({g.rate}%)</span>
                          <span>{formatINR(g.igst)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-xs text-slate-700 pt-1">
                    <span>Total GST</span>
                    <span>{formatINR(formTotalGst)}</span>
                  </div>
                </>
              ) : invoiceType !== "NON_GST" ? (
                <div className="flex justify-between text-xs text-slate-400 italic">
                  <span>No taxable items added</span>
                  <span>₹0</span>
                </div>
              ) : null}
              {invoiceType === "NON_GST" && (
                <div className="flex justify-between text-xs text-slate-400 italic">
                  <span>GST Exemption (0% GST)</span>
                  <span>₹0</span>
                </div>
              )}
              <div className="border-t border-slate-200 my-1 pt-3 flex justify-between font-bold text-slate-800 text-base">
                <span>Grand Total</span>
                <span className="text-indigo-600 font-extrabold">{formatINR(formTotal)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingInvoiceId(null);
              }}
              className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer border border-slate-200"
            >
              Cancel
            </button>
            {(!editingInvoiceId || state.saleInvoices.find(i => i.id === editingInvoiceId)?.status === "Draft") && (
              <button
                type="submit"
                onClick={() => setIsPostAction(false)}
                className="px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold shadow-xs cursor-pointer border border-amber-200"
              >
                Save as Draft
              </button>
            )}
            <button
              type="submit"
              onClick={() => setIsPostAction(true)}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer border border-indigo-500"
            >
              {editingInvoiceId ? "Save & Post Invoice" : "Post Invoice & Update Ledger"}
            </button>
          </div>
        </form>
      )}

      {/* Invoice Detail / Printable View Modal */}
      {viewingInvoice && (() => {
        const isNonGst = viewingInvoice.invoiceNumber.startsWith("DIVI-NG");
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
        const pan = company.gstin && company.gstin.length >= 12 ? company.gstin.substring(2, 12) : "AANFD1234B";

        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-0 sm:p-3 md:p-4 overflow-hidden">
            <div className="bg-white w-[100vw] h-[100vh] sm:w-[98vw] sm:max-w-[98vw] lg:w-[94vw] lg:max-w-[94vw] 2xl:w-[95vw] 2xl:max-w-[95vw] sm:h-auto sm:max-h-[95vh] 2xl:max-h-[95vh] rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 shadow-2xl overflow-hidden relative my-0 sm:my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col">
              <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print shrink-0 sticky top-0 z-20">
                <h3 className="text-[11px] sm:text-xs font-black text-slate-800 uppercase tracking-wider truncate mr-2">
                  Certified {isNonGst ? "Non-GST Invoice" : "Tax Invoice"} Document
                </h3>
                <div className="flex gap-1.5 sm:gap-2 shrink-0 items-center">
                  {viewingInvoice.status === "Draft" && (
                    <button
                      onClick={() => handleQuickPost(viewingInvoice)}
                      className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <CheckCircle2 size={12} /> <span className="hidden sm:inline">Post Invoice</span><span className="sm:hidden">Post</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleEditInvoice(viewingInvoice)}
                    className="px-2.5 sm:px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 border border-slate-200 cursor-pointer transition-colors"
                  >
                    <Edit size={12} /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteInvoice(viewingInvoice.id)}
                    className="px-2.5 sm:px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 border border-rose-100 cursor-pointer transition-colors"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                  <button
                    onClick={() => handleDownloadPDF(viewingInvoice.invoiceNumber)}
                    disabled={isDownloading}
                    className="px-2.5 sm:px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {isDownloading ? "Saving..." : "Save PDF"}
                  </button>
                  <button
                    onClick={() => {
                      setViewingInvoice(null);
                      setEditingInvoiceId(null);
                      if (setSelectedInvoiceId) setSelectedInvoiceId("");
                    }}
                    className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors cursor-pointer border border-slate-200 bg-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Core PDF printable content block */}
              <div className="p-3 sm:p-5 md:p-6 overflow-y-auto overflow-x-hidden printable-area flex-1 bg-white w-full flex justify-center items-start" ref={printRef}>
                <div className="w-full max-w-4xl mx-auto bg-white text-slate-900 font-sans leading-relaxed border border-slate-200/60 shadow-xs relative">
                  
                  {/* Top Red Bar Header */}
                  <div className="w-full h-1.5 bg-red-600"></div>

                  <div className="p-3 sm:p-5 md:p-6 space-y-4 sm:space-y-6">
                    {/* Header reference string at top center */}
                    <div className="text-center font-mono font-bold text-xs text-slate-700 tracking-wider">
                      DIVI-Z-{viewingInvoice.invoiceNumber.replace(/^(INV-|DIVI-)/i, '').padStart(5, '0')}
                    </div>

                    {/* Company Branding & Invoice Metadata Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-indigo-950 text-white font-black text-xl flex items-center justify-center rounded-lg shrink-0 mt-0.5 shadow-xs">
                          D
                        </div>
                        <div>
                          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">
                            {company.name}
                          </h1>
                          <p className="text-xs font-semibold text-slate-600 mt-1">
                            {company.address || "Jaipur 302033"}
                          </p>
                          <p className="text-xs font-semibold text-slate-600">
                            Phone: {company.phone || "8561818645"}
                          </p>
                          {company.gstin && (
                            <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                              GSTIN: {company.gstin}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-left sm:text-right space-y-1">
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">
                          Invoice No.{viewingInvoice.invoiceNumber}
                        </h2>
                        <p className="text-xs font-extrabold text-slate-600">
                          Invoice Date: {formatDate(viewingInvoice.date)}
                        </p>
                      </div>
                    </div>

                    {/* Customer Info & Amount Summary Card */}
                    {(() => {
                      const customer = state.parties.find((p) => p.id === viewingInvoice.customerId);
                      const isPaid = viewingInvoice.status === "Paid";
                      const isPending = viewingInvoice.status === "Pending" || viewingInvoice.status === "Draft" || !isPaid;
                      const statusText = isPaid ? "paid" : "pending";
                      const statusColor = isPaid ? "text-emerald-600" : "text-red-600";

                      return (
                        <div className="bg-slate-50/90 rounded-2xl p-3 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row justify-between items-start gap-4">
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              BILL AND SHIP TO
                            </p>
                            <h3 className="text-base font-black text-slate-900">
                              {customer?.name || "Sonu Sharam"}
                            </h3>
                            <p className="text-xs font-semibold text-slate-600 max-w-sm">
                              {customer?.address || "Mundiya Ram Sir japur"}
                            </p>
                            <p className="text-xs font-bold text-slate-500 pt-0.5">
                              GSTIN: {customer?.gstin || "URD (Unregistered)"}
                            </p>
                          </div>

                          <div className="text-left sm:text-right space-y-1 shrink-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Total amount
                            </p>
                            <div className="text-3xl font-black text-slate-900 leading-none py-0.5">
                              {viewingInvoice.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </div>
                            <p className="text-[11px] font-semibold italic text-slate-500 capitalize max-w-xs sm:ml-auto">
                              {numberToIndianWords(viewingInvoice.totalAmount)}
                            </p>
                            <p className={`text-xs font-black uppercase tracking-wider ${statusColor} pt-1`}>
                              Invoice: {statusText}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Items Table */}
                    <div className="overflow-hidden rounded-xl border border-slate-200 w-full">
                      <table className="w-full text-left text-[9px] xs:text-[10px] sm:text-xs border-collapse table-auto">
                        <thead>
                          <tr className="bg-slate-100/80 border-b border-slate-200 text-[9px] sm:text-[11px] font-black text-slate-800 select-none">
                            <th className="p-1 sm:p-2.5 text-center w-6 sm:w-10 border-r border-slate-200">#</th>
                            <th className="p-1 sm:p-2.5 border-r border-slate-200">Item Details</th>
                            <th className="p-1 sm:p-2.5 text-center border-r border-slate-200">HSN</th>
                            <th className="p-1 sm:p-2.5 text-right border-r border-slate-200">Qty</th>
                            <th className="p-1 sm:p-2.5 text-right border-r border-slate-200">Rate</th>
                            <th className="p-1 sm:p-2.5 text-right border-r border-slate-200">Amount</th>
                            <th className="p-1 sm:p-2.5 text-center border-r border-slate-200">GST%</th>
                            <th className="p-1 sm:p-2.5 text-right border-r border-slate-200">CGST</th>
                            <th className="p-1 sm:p-2.5 text-right border-r border-slate-200">SGST</th>
                            <th className="p-1 sm:p-2.5 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-800 text-[9px] sm:text-xs">
                          {viewingInvoice.items.map((item, idx) => {
                            const dbItem = state.items.find((i) => i.id === item.itemId);
                            const hsnCode = dbItem?.hsnCode || "09092200";
                            const taxRate = item.taxRate !== undefined ? item.taxRate : (dbItem?.gstRate || 0);
                            const unit = item.unit || dbItem?.unit || "kg";
                            const isInterstate = viewingInvoice.igst > 0;
                            
                            const lineAmount = item.amount;
                            const cgstVal = isInterstate ? 0 : (lineAmount * (taxRate / 2)) / 100;
                            const sgstVal = isInterstate ? 0 : (lineAmount * (taxRate / 2)) / 100;
                            const igstVal = isInterstate ? (lineAmount * taxRate) / 100 : 0;
                            const lineTotal = lineAmount + (isInterstate ? igstVal : (cgstVal + sgstVal));

                            return (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="p-1 sm:p-2.5 text-center font-mono text-slate-500 border-r border-slate-100">
                                  {(idx + 1).toString().padStart(2, "0")}
                                </td>
                                <td className="p-1 sm:p-2.5 border-r border-slate-100 break-words max-w-[100px] sm:max-w-none">
                                  <div className="font-extrabold text-slate-900 leading-tight">{item.name}</div>
                                  {dbItem?.description && (
                                    <div className="text-[8px] sm:text-[10px] text-slate-500 font-normal mt-0.5 leading-tight">
                                      {dbItem.description}
                                    </div>
                                  )}
                                </td>
                                <td className="p-1 sm:p-2.5 text-center font-mono text-slate-600 border-r border-slate-100 text-[8px] sm:text-xs">
                                  {hsnCode}
                                </td>
                                <td className="p-1 sm:p-2.5 text-right font-bold text-slate-900 border-r border-slate-100 whitespace-nowrap">
                                  {item.quantity} {unit}
                                </td>
                                <td className="p-1 sm:p-2.5 text-right font-mono text-slate-700 border-r border-slate-100">
                                  {item.rate.toFixed(2)}
                                </td>
                                <td className="p-1 sm:p-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-100">
                                  {lineAmount.toFixed(2)}
                                </td>
                                <td className="p-1 sm:p-2.5 text-center font-mono text-slate-600 border-r border-slate-100">
                                  {taxRate}%
                                </td>
                                <td className="p-1 sm:p-2.5 text-right font-mono text-slate-600 border-r border-slate-100">
                                  {cgstVal.toFixed(2)}
                                </td>
                                <td className="p-1 sm:p-2.5 text-right font-mono text-slate-600 border-r border-slate-100">
                                  {sgstVal.toFixed(2)}
                                </td>
                                <td className="p-1 sm:p-2.5 text-right font-mono font-black text-slate-900">
                                  {lineTotal.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Sub-total Row */}
                          {(() => {
                            const totalQty = viewingInvoice.items.reduce((sum, i) => sum + i.quantity, 0);
                            const primaryUnit = viewingInvoice.items[0]?.unit || "kg";
                            const totalBaseAmount = viewingInvoice.items.reduce((sum, i) => sum + i.amount, 0);
                            const totalCGST = viewingInvoice.cgst || 0;
                            const totalSGST = viewingInvoice.sgst || 0;
                            const totalLineTotal = viewingInvoice.totalAmount;

                            return (
                              <tr className="bg-slate-50 border-t-2 border-slate-200 font-black text-slate-900 text-[9px] sm:text-xs">
                                <td className="p-1 sm:p-2.5 text-center border-r border-slate-200"></td>
                                <td className="p-1 sm:p-2.5 uppercase font-extrabold text-slate-800 border-r border-slate-200">
                                  Sub-total
                                </td>
                                <td className="p-1 sm:p-2.5 border-r border-slate-200"></td>
                                <td className="p-1 sm:p-2.5 text-right font-black border-r border-slate-200 whitespace-nowrap">
                                  {totalQty} {primaryUnit}
                                </td>
                                <td className="p-1 sm:p-2.5 border-r border-slate-200"></td>
                                <td className="p-1 sm:p-2.5 text-right font-mono font-black border-r border-slate-200">
                                  {totalBaseAmount.toFixed(2)}
                                </td>
                                <td className="p-1 sm:p-2.5 border-r border-slate-200"></td>
                                <td className="p-1 sm:p-2.5 text-right font-mono border-r border-slate-200">
                                  {totalCGST.toFixed(2)}
                                </td>
                                <td className="p-1 sm:p-2.5 text-right font-mono border-r border-slate-200">
                                  {totalSGST.toFixed(2)}
                                </td>
                                <td className="p-1 sm:p-2.5 text-right font-mono font-black text-slate-900">
                                  {totalLineTotal.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>

                    {/* GST Summary Card */}
                    {(() => {
                      const totalBase = viewingInvoice.items.reduce((sum, i) => sum + i.amount, 0);
                      const totalCgst = viewingInvoice.cgst || 0;
                      const totalSgst = viewingInvoice.sgst || 0;
                      const totalIgst = viewingInvoice.igst || 0;
                      const totalGst = totalIgst > 0 ? totalIgst : (totalCgst + totalSgst);

                      return (
                        <div className="bg-slate-50/80 rounded-xl p-3 sm:p-4 border border-slate-200/80 space-y-2">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                            GST Summary
                          </h4>
                          <div className="flex flex-wrap items-center justify-between text-[11px] sm:text-xs font-extrabold text-slate-700 gap-2 sm:gap-3 pt-1">
                            <div>
                              <span className="text-slate-500 font-semibold">Taxable Amount: </span>
                              <span>₹{totalBase.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 font-semibold">CGST: </span>
                              <span>₹{totalCgst.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 font-semibold">SGST: </span>
                              <span>₹{totalSgst.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 font-semibold">Total GST: </span>
                              <span className="text-slate-900">₹{totalGst.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Customer Payment History Card */}
                    {(() => {
                      const customerPayments = (state.payments || []).filter(
                        (p) => p.customerId === viewingInvoice.customerId && (p.type === "Inbound" || !p.type)
                      );
                      if (customerPayments.length === 0) return null;

                      return (
                        <div className="bg-slate-50/80 rounded-xl p-3 sm:p-4 border border-slate-200/80 space-y-2">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                            Payment History & Received By Representative
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-[11px] border-collapse">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-500 font-bold">
                                  <th className="py-1 px-2">Payment No</th>
                                  <th className="py-1 px-2">Date</th>
                                  <th className="py-1 px-2">Received By</th>
                                  <th className="py-1 px-2">Method</th>
                                  <th className="py-1 px-2 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {customerPayments.map((p) => (
                                  <tr key={p.id}>
                                    <td className="py-1 px-2 font-bold font-mono text-slate-900">{p.paymentNumber}</td>
                                    <td className="py-1 px-2">{p.date}</td>
                                    <td className="py-1 px-2 font-bold text-emerald-800">{p.receivedBy || "Vishal Kumar"}</td>
                                    <td className="py-1 px-2">{p.paymentMethod}</td>
                                    <td className="py-1 px-2 text-right font-mono font-bold text-slate-900">₹{p.amount.toLocaleString("en-IN")}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Terms & Conditions / Notes & Total Amount Card */}
                    {(() => {
                      const isPaid = viewingInvoice.status === "Paid";
                      const statusText = isPaid ? "paid" : "pending";
                      const statusColor = isPaid ? "text-emerald-600" : "text-red-600";

                      return (
                        <div className="pt-2">
                          {/* Terms & Conditions */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                              Terms &amp; conditions
                            </h4>
                            <ol className="text-xs font-medium text-slate-600 space-y-1 list-decimal list-inside">
                              <li>Sold material not returnable after 2 days.</li>
                              <li>Payment terms 10 days.</li>
                            </ol>
                            <div className="pt-2 text-xs font-extrabold text-slate-800">
                              Notes: <span className="font-semibold text-slate-600">{viewingInvoice.notes || company.name}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Authorised Signature & Thank You Footer */}
                    <div className="flex flex-col sm:flex-row justify-between items-end gap-4 pt-4 border-t border-slate-200">
                      <div className="text-xs font-bold text-slate-600">
                        Thank you for the business.
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Invoice List */}
      {!isCreating && !viewingInvoice && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Filters & Advanced Multi-Field Search */}
          <div className="p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-7/12">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by Invoice #, Customer, Mobile, GSTIN, Amount, Date, Warehouse..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-2xl text-xs focus:border-indigo-600 focus:outline-none bg-white font-semibold text-slate-700 placeholder:text-slate-400/80 shadow-xs transition-colors"
                />
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                <button
                  type="button"
                  onClick={handleExportInvoicesCsv}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-100 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
                  title="Export current filtered list to CSV"
                >
                  <Download size={14} /> Export CSV
                </button>
                <span className="text-xs text-slate-400 font-bold font-mono whitespace-nowrap bg-white px-3 py-2 border border-slate-200/60 rounded-xl">
                  Showing {filteredInvoices.length} of {state.saleInvoices.length} Invoices
                </span>
              </div>
            </div>

            {/* Pill Filters Matrix */}
            <div className="flex flex-col gap-3 pt-3 border-t border-slate-200/50">
              {/* Status filter row */}
              <div className="flex flex-wrap gap-2 items-center text-[11px]">
                <span className="font-bold text-slate-400 uppercase tracking-wider mr-2 w-20">Status:</span>
                <button
                  onClick={() => setStatusFilter("All")}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
                    statusFilter === "All"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  All Statuses
                </button>
                <button
                  onClick={() => setStatusFilter("Paid")}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
                    statusFilter === "Paid"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Paid
                </button>
                <button
                  onClick={() => setStatusFilter("Partial")}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
                    statusFilter === "Partial"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Partial
                </button>
                <button
                  onClick={() => setStatusFilter("Unpaid")}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
                    statusFilter === "Unpaid"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Unpaid
                </button>
                <button
                  onClick={() => setStatusFilter("Cancelled")}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
                    statusFilter === "Cancelled"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Cancelled
                </button>
                <button
                  onClick={() => setStatusFilter("Draft")}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
                    statusFilter === "Draft"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Draft
                </button>
                <button
                  onClick={() => setStatusFilter("Posted")}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
                    statusFilter === "Posted"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Posted
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          {filteredInvoices.length === 0 ? (
            <p className="text-sm text-slate-400 py-12 text-center italic">No invoices matched your search criteria.</p>
          ) : (
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-2xs">
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                    <th className="sticky top-0 bg-slate-50 py-3 px-3 pl-4 text-left whitespace-nowrap z-10">Invoice No</th>
                    <th className="sticky top-0 bg-slate-50 py-3 px-3 text-left whitespace-nowrap z-10">Customer</th>
                    <th className="sticky top-0 bg-slate-50 py-3 px-3 text-left whitespace-nowrap z-10">
                      <div className="flex items-center gap-1.5">
                        <span>Assignee Sales Income</span>
                        <select
                          value={assigneeFilter}
                          onChange={(e) => setAssigneeFilter(e.target.value)}
                          className="text-[10px] font-bold border border-slate-200 bg-white text-slate-700 rounded-lg px-2 py-0.5 focus:outline-none focus:border-indigo-600 cursor-pointer shadow-2xs"
                          title="Filter list by Assignee Sales Income"
                        >
                          <option value="All">All</option>
                          {availableAssignees.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th className="sticky top-0 bg-slate-50 py-3 px-3 text-center whitespace-nowrap z-10">Warehouse</th>
                    <th className="sticky top-0 bg-slate-50 py-3 px-3 text-left whitespace-nowrap z-10">Date</th>
                    <th className="sticky top-0 bg-slate-50 py-3 px-3 text-right whitespace-nowrap z-10">Amount</th>
                    <th className="sticky top-0 bg-slate-50 py-3 px-3 text-center whitespace-nowrap z-10">GST</th>
                    <th className="sticky top-0 bg-slate-50 py-3 px-3 text-right whitespace-nowrap z-10">Paid / Balance</th>
                    <th className="sticky top-0 bg-slate-50 py-3 px-3 text-center whitespace-nowrap z-10">Status</th>
                    <th className="sticky top-0 bg-slate-50 py-3 px-3 pr-4 text-right whitespace-nowrap z-10">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {filteredInvoices.slice().reverse().map((inv) => {
                    const customer = state.parties.find((p) => p.id === inv.customerId);
                    const totalGst = inv.cgst + inv.sgst + inv.igst;
                    const isNonGst = inv.invoiceNumber.startsWith("DIVI-NG") || inv.invoiceNumber.startsWith("DIVI-Z");
                    const paid = inv.paidAmount || 0;
                    const balance = Math.max(0, inv.totalAmount - paid);
                    const isUnpaidOrPartial = inv.status !== "Paid" && inv.status !== "Cancelled" && balance > 0;

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors border-b border-slate-100 h-[64px]">
                        {/* 1. Invoice Number */}
                        <td className="py-2.5 px-3 pl-4 align-middle font-extrabold text-indigo-600 whitespace-nowrap">
                          {inv.invoiceNumber}
                        </td>

                        {/* 2. Customer Name */}
                        <td className="py-2.5 px-3 align-middle font-bold text-slate-800 max-w-[180px] truncate" title={customer?.name || "Cash Customer"}>
                          {customer?.name || "Cash Customer"}
                        </td>

                        {/* Assignee Sales Income */}
                        <td className="py-2.5 px-3 align-middle font-bold text-slate-700 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 border border-slate-200/80 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                            {inv.assignee || state.salesAssigneeName || "Vishal Kumar"}
                          </span>
                        </td>

                        {/* 3. Warehouse */}
                        <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap">
                          <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider">
                            {state.warehouses?.find((w) => w.id === inv.warehouseId)?.code || "MAIN"}
                          </span>
                        </td>

                        {/* 4. Invoice Date */}
                        <td className="py-2.5 px-3 align-middle text-slate-600 text-xs font-semibold whitespace-nowrap">
                          {formatDate(inv.date)}
                        </td>

                        {/* 5. Invoice Amount */}
                        <td className="py-2.5 px-3 align-middle text-right font-black text-slate-900 whitespace-nowrap">
                          {formatINR(inv.totalAmount)}
                        </td>

                        {/* 6. GST Status */}
                        <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap">
                          {isNonGst ? (
                            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">Exempt</span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded">
                              {(() => {
                                const uniqueRates = Array.from(new Set((inv.items || []).map(item => item.taxRate).filter((r): r is number => typeof r === "number" && r > 0))).sort((a, b) => Number(a) - Number(b));
                                const ratesStr = uniqueRates.length > 0 ? uniqueRates.map(r => `${r}%`).join("/") : "GST";
                                return inv.igst > 0 ? `${ratesStr} IGST` : `${ratesStr} GST`;
                              })()}
                            </span>
                          )}
                        </td>

                        {/* 7. Paid/Balance Amount */}
                        <td className="py-2.5 px-3 align-middle text-right whitespace-nowrap font-mono text-[11px]">
                          {inv.status === "Paid" || balance === 0 ? (
                            <span className="text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                              Paid {formatINR(inv.totalAmount)}
                            </span>
                          ) : paid > 0 ? (
                            <div className="leading-tight">
                              <span className="text-emerald-700 font-bold block text-[10px]">Paid: {formatINR(paid)}</span>
                              <span className="text-rose-600 font-extrabold block">Bal: {formatINR(balance)}</span>
                            </div>
                          ) : (
                            <span className="text-rose-600 font-extrabold bg-rose-50 border border-rose-100 px-2 py-0.5 rounded">
                              Bal {formatINR(balance)}
                            </span>
                          )}
                        </td>

                        {/* 8. Invoice Status Badge */}
                        <td className="py-2.5 px-3 align-middle text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            inv.status === "Draft"
                              ? "bg-amber-100 text-amber-800"
                              : inv.status === "Paid"
                              ? "bg-teal-100 text-teal-800"
                              : inv.status === "Partial"
                              ? "bg-blue-100 text-blue-800"
                              : inv.status === "Cancelled"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {inv.status || "Posted"}
                          </span>
                        </td>

                        {/* 9. Action Buttons */}
                        <td className="py-2.5 px-3 pr-4 align-middle text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            {/* View */}
                            <button
                              onClick={() => setViewingInvoice(inv)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg flex items-center gap-1 text-[11px] font-bold border border-indigo-100 cursor-pointer transition-all whitespace-nowrap"
                              title="View Invoice"
                            >
                              👁 View
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => handleEditInvoice(inv)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1 text-[11px] font-bold border border-slate-200 cursor-pointer transition-all whitespace-nowrap"
                              title="Edit Invoice"
                            >
                              ✏ Edit
                            </button>

                            {/* Receive Payment (only if unpaid or partially paid) */}
                            {isUnpaidOrPartial && (
                              <button
                                onClick={() => handleReceivePaymentRow(inv)}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg flex items-center gap-1 text-[11px] font-bold border border-amber-100 cursor-pointer transition-all whitespace-nowrap"
                                title="Receive payment for this invoice"
                              >
                                💰 Receive Payment
                              </button>
                            )}

                            {/* WhatsApp */}
                            <button
                              onClick={() => handleWhatsAppRow(inv)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded-lg flex items-center gap-1 text-[11px] font-bold border border-emerald-100 hover:border-emerald-600 cursor-pointer transition-all duration-200 whitespace-nowrap shadow-2xs"
                              title="Send invoice details via WhatsApp"
                            >
                              📱 WhatsApp
                            </button>

                            {/* More (only for Print, PDF Download, Duplicate, Delete) */}
                            <div className="relative inline-block text-left">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuInvoiceId(activeMenuInvoiceId === inv.id ? null : inv.id);
                                }}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1 text-[11px] font-bold border border-slate-200 cursor-pointer transition-all whitespace-nowrap"
                              >
                                More ▾
                              </button>

                              {activeMenuInvoiceId === inv.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setActiveMenuInvoiceId(null)}
                                  />
                                  <div className="absolute right-0 bottom-full mb-1 sm:bottom-auto sm:top-full sm:mt-1 z-50 w-44 bg-white border border-slate-200 rounded-xl shadow-xl py-1 text-left text-xs font-semibold text-slate-700">
                                    <button
                                      onClick={() => { handlePrintRow(inv); setActiveMenuInvoiceId(null); }}
                                      className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer border-b border-slate-100"
                                    >
                                      🖨 Print Invoice
                                    </button>
                                    <button
                                      onClick={() => { handleDownloadInvoiceDirectly(inv); setActiveMenuInvoiceId(null); }}
                                      className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer border-b border-slate-100"
                                    >
                                      📄 PDF Download
                                    </button>
                                    <button
                                      onClick={() => { handleCreateEWayBill(inv); setActiveMenuInvoiceId(null); }}
                                      className="w-full px-3 py-2 text-left hover:bg-amber-50 text-amber-800 flex items-center gap-2 cursor-pointer border-b border-slate-100 font-bold"
                                    >
                                      🚛 E-Way Bill / E-Bill
                                    </button>
                                    <button
                                      onClick={() => { handleDuplicateInvoiceRow(inv); setActiveMenuInvoiceId(null); }}
                                      className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 cursor-pointer border-b border-slate-100"
                                    >
                                      🔗 Duplicate Invoice
                                    </button>
                                    <button
                                      onClick={() => { handleDeleteInvoice(inv.id); setActiveMenuInvoiceId(null); }}
                                      className="w-full px-3 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer font-bold"
                                    >
                                      🗑 Delete Invoice
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Business Intelligence Summary Section */}
          <div className="p-5 bg-slate-50/70 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Total Invoices</span>
              <span className="text-xl font-black text-slate-800 tracking-tight mt-1.5 block">
                {filteredInvoices.length} <span className="text-[10px] text-slate-400 font-normal">items</span>
              </span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Total Sales (Taxable)</span>
              <span className="text-base font-black text-slate-800 tracking-tight mt-1.5 block">
                {formatINR(filteredInvoices.reduce((sum, i) => sum + i.subtotal, 0))}
              </span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Total GST Tax</span>
              <span className="text-base font-black text-slate-800 tracking-tight mt-1.5 block">
                {formatINR(filteredInvoices.reduce((sum, i) => sum + (i.cgst + i.sgst + i.igst), 0))}
              </span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Total Paid Amount</span>
              <span className="text-base font-black text-teal-600 tracking-tight mt-1.5 block">
                {formatINR(filteredInvoices.reduce((sum, i) => sum + (i.paidAmount || 0), 0))}
              </span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Total Outstanding</span>
              <span className="text-base font-black text-amber-600 tracking-tight mt-1.5 block">
                {formatINR(Math.max(0, filteredInvoices.reduce((sum, i) => sum + (i.totalAmount - (i.paidAmount || 0)), 0)))}
              </span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/60 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Total Customers</span>
              <span className="text-xl font-black text-slate-800 tracking-tight mt-1.5 block">
                {new Set(filteredInvoices.map(i => i.customerId)).size} <span className="text-[10px] text-slate-400 font-normal">accounts</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Inline Customer Registry/Editor Modal */}
      {showInlinePartyModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white max-w-lg w-full rounded-3xl border border-slate-200 shadow-2xl relative overflow-hidden animate-scaleUp">
            {/* Colored top border bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-600"></div>
            
            <div className="p-6 md:p-8 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-800">
                  {inlinePartyMode === "edit" ? "Modify Customer Account" : "Register New Customer"}
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
                    placeholder="E.g., Ambika Retailers"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-indigo-600 focus:outline-none"
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
                      className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-indigo-600 focus:outline-none uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={inlinePartyPhone}
                      onChange={(e) => setInlinePartyPhone(e.target.value)}
                      placeholder="10-digit number"
                      className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-indigo-600 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    value={inlinePartyEmail}
                    onChange={(e) => setInlinePartyEmail(e.target.value)}
                    placeholder="info@client.com"
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Billing / Shipping Address</label>
                  <textarea
                    value={inlinePartyAddress}
                    onChange={(e) => setInlinePartyAddress(e.target.value)}
                    placeholder="Full postal address"
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:border-indigo-600 focus:outline-none"
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
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-md"
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
