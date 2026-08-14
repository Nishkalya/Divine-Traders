import React, { useState, useRef, useMemo } from "react";
import { ERPState, PurchaseBill, Party, PurchaseOrder, LedgerEntry } from "../types";
import { formatINR, formatDate, safeConfirm, safeAlert, numberToIndianWords } from "../utils";
import { isWarehouseAllowed } from "../utils/warehouseAuth";
import { downloadDocumentPDF } from "../utils/pdfGenerator";
import { INITIAL_COMPANY_PROFILE } from "../data";
import { Plus, Search, Eye, ArrowLeft, Receipt, Wallet, Undo2, Edit, Trash2, Printer, Download, X } from "lucide-react";

interface PurchaseBillsViewProps {
  state: ERPState;
  currentUserEmail?: string;
  onUpdateState: (newState: ERPState) => void;
  setCurrentTab?: (tab: string) => void;
}

export default function PurchaseBillsView({
  state,
  currentUserEmail,
  onUpdateState,
  setCurrentTab,
}: PurchaseBillsViewProps) {
  const currentUser = useMemo(
    () => (state.teamMembers || []).find((m) => m.email.toLowerCase() === (currentUserEmail || "").toLowerCase()),
    [state.teamMembers, currentUserEmail]
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [viewingBill, setViewingBill] = useState<PurchaseBill | null>(null);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const company = state.companyProfile || INITIAL_COMPANY_PROFILE;

  const handleDownloadPDF = async (bill: PurchaseBill) => {
    setIsDownloading(true);
    setViewingBill(bill);
    setTimeout(async () => {
      const element = printRef.current || (document.querySelector(".printable-area") as HTMLElement);
      if (!element) {
        setIsDownloading(false);
        return;
      }
      try {
        await downloadDocumentPDF(element, `PurchaseBill_${bill.billNumber}.pdf`);
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

  const handleDeleteBill = (billId: string) => {
    const bill = state.purchaseBills.find((b) => b.id === billId);
    if (!bill) return;

    if (bill.paidAmount > 0) {
      safeAlert(`Cannot delete this Purchase Bill because payments (₹${bill.paidAmount}) are already applied. Please delete the payments for this vendor first.`);
      return;
    }

    if (!safeConfirm(`Are you sure you want to delete Purchase Bill ${bill.billNumber}? This will reverse Account Payable balances and corresponding ledger entries.`)) {
      return;
    }

    // Re-calculate PO status if linked
    const updatedPOs = state.purchaseOrders.map((po) => {
      if (po.id === bill.purchaseOrderId) {
        const poGrns = state.goodsReceipts.filter((g) => g.purchaseOrderId === po.id);
        const totalOrdered = po.items.reduce((sum, item) => sum + item.quantity, 0);
        const totalReceived = poGrns.reduce((sum, g) => {
          return sum + g.items.reduce((itemSum, gi) => itemSum + (gi.quantityReceived || 0), 0);
        }, 0);

        let status: "Draft" | "Approved" | "Partially Received" | "Received" | "Closed" = "Approved";
        if (totalReceived === 0) {
          status = "Approved";
        } else if (totalReceived < totalOrdered) {
          status = "Partially Received";
        } else {
          status = "Received";
        }
        return { ...po, status };
      }
      return po;
    });

    // Revert ledger entries
    const updatedLedger = state.ledger.filter(
      (l) => !(l.referenceType === "Bill" && l.referenceId === billId)
    );

    // Filter bills list
    const updatedBills = state.purchaseBills.filter((b) => b.id !== billId);

    onUpdateState({
      ...state,
      purchaseBills: updatedBills,
      purchaseOrders: updatedPOs,
      ledger: updatedLedger,
    });

    setViewingBill(null);
  };

  // Form states
  const [vendorId, setVendorId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [goodsReceiptId, setGoodsReceiptId] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] // default 30 days
  );
  const [subtotal, setSubtotal] = useState(0);
  const [isInterstate, setIsInterstate] = useState(false);
  const [invoiceType, setInvoiceType] = useState<"GST" | "NON_GST">("GST");

  const vendors = state.parties.filter((p) => p.type === "Vendor" || p.type === "Both");
  // Select POs that are received/approved but don't have bills yet
  const availablePOs = state.purchaseOrders.filter((po) => {
    if (!isWarehouseAllowed(currentUser, po.warehouseId)) {
      return false;
    }
    const alreadyBilled = state.purchaseBills.some((b) => b.purchaseOrderId === po.id);
    return !alreadyBilled && (po.status === "Received" || po.status === "Partially Received" || po.status === "Approved");
  });

  // Select Goods Receipts that haven't been billed yet
  const availableGRNs = state.goodsReceipts.filter((grn) => {
    const po = state.purchaseOrders.find((p) => p.id === grn.purchaseOrderId);
    const grnWarehouseId = grn.warehouseId || po?.warehouseId;
    if (!isWarehouseAllowed(currentUser, grnWarehouseId)) {
      return false;
    }
    const alreadyBilled = state.purchaseBills.some((b) => b.goodsReceiptId === grn.id);
    return !alreadyBilled;
  });

  const filteredBills = state.purchaseBills.filter((b) => {
    let billWarehouseId = b.warehouseId;
    if (!billWarehouseId && b.purchaseOrderId) {
      const po = state.purchaseOrders.find((p) => p.id === b.purchaseOrderId);
      billWarehouseId = po?.warehouseId;
    }
    if (!billWarehouseId && b.goodsReceiptId) {
      const grn = state.goodsReceipts.find((g) => g.id === b.goodsReceiptId);
      const po = grn ? state.purchaseOrders.find((p) => p.id === grn.purchaseOrderId) : null;
      billWarehouseId = grn?.warehouseId || po?.warehouseId;
    }
    if (!isWarehouseAllowed(currentUser, billWarehouseId)) {
      return false;
    }

    const vendor = state.parties.find((p) => p.id === b.vendorId);
    const term = (searchTerm || "").toLowerCase();
    return (
      (b.billNumber || "").toLowerCase().includes(term) ||
      (vendor?.name || "").toLowerCase().includes(term)
    );
  });

  const handlePoChange = (poId: string) => {
    setPurchaseOrderId(poId);
    setGoodsReceiptId(""); // Clear GRN when direct PO is selected
    if (!poId) {
      setVendorId("");
      setSubtotal(0);
      setInvoiceType("GST");
      return;
    }
    const po = state.purchaseOrders.find((o) => o.id === poId);
    if (po) {
      setVendorId(po.vendorId);
      const isNonGst = po.orderNumber.startsWith("DIVI-NG");
      setInvoiceType(isNonGst ? "NON_GST" : "GST");
      const poSubtotal = po.items.reduce((sum, item) => sum + item.amount, 0);
      setSubtotal(poSubtotal);
    }
  };

  const handleGrnChange = (grnId: string) => {
    setGoodsReceiptId(grnId);
    if (!grnId) {
      setPurchaseOrderId("");
      setVendorId("");
      setSubtotal(0);
      setInvoiceType("GST");
      return;
    }
    const grn = state.goodsReceipts.find((g) => g.id === grnId);
    if (grn) {
      setPurchaseOrderId(grn.purchaseOrderId);
      const po = state.purchaseOrders.find((o) => o.id === grn.purchaseOrderId);
      if (po) {
        setVendorId(po.vendorId);
        const isNonGst = po.orderNumber.startsWith("DIVI-NG");
        setInvoiceType(isNonGst ? "NON_GST" : "GST");
        // Calculate subtotal based on GRN items and Invoice/GRN prices
        let calculatedSubtotal = 0;
        grn.items.forEach((grnItem) => {
          const poItem = po.items.find((pi) => pi.itemId === grnItem.itemId);
          const rate = grnItem.rate !== undefined ? grnItem.rate : (poItem ? poItem.rate : 0);
          calculatedSubtotal += (grnItem.quantityReceived || 0) * rate;
        });
        setSubtotal(calculatedSubtotal);
      }
    }
  };

  const handleEditClick = (bill: PurchaseBill) => {
    setBillNumber(bill.billNumber);
    setVendorId(bill.vendorId);
    setPurchaseOrderId(bill.purchaseOrderId || "");
    setGoodsReceiptId(bill.goodsReceiptId || "");
    setDate(bill.date);
    setDueDate(bill.dueDate);
    setSubtotal(bill.subtotal);
    setIsInterstate(bill.igst > 0);
    const isNonGst = bill.invoiceType === "NON_GST" || (bill.cgst === 0 && bill.sgst === 0 && bill.igst === 0);
    setInvoiceType(isNonGst ? "NON_GST" : "GST");
    setEditingBillId(bill.id);
    setIsCreating(true);
    setViewingBill(null);
  };

  React.useEffect(() => {
    const prefillGrnId = localStorage.getItem("prefill_grn_id");
    if (prefillGrnId) {
      localStorage.removeItem("prefill_grn_id");
      setIsCreating(true);
      handleGrnChange(prefillGrnId);
    }
  }, [state.goodsReceipts]);

  const handleSubmitBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      alert("Please select a vendor.");
      return;
    }
    if (!billNumber) {
      alert("Please provide a vendor bill/invoice number.");
      return;
    }
    if (subtotal <= 0) {
      alert("Please provide a valid subtotal amount.");
      return;
    }

    const gstRate = invoiceType === "NON_GST" ? 0 : 0.09;
    const cgst = isInterstate ? 0 : Math.round(subtotal * gstRate);
    const sgst = isInterstate ? 0 : Math.round(subtotal * gstRate);
    const igst = isInterstate ? (invoiceType === "NON_GST" ? 0 : Math.round(subtotal * 0.18)) : 0;
    const totalAmount = subtotal + cgst + sgst + igst;

    const targetBillId = editingBillId || "pb-" + Math.random().toString(36).substring(2, 9);
    
    const newBill: PurchaseBill = {
      id: targetBillId,
      billNumber,
      vendorId,
      purchaseOrderId: purchaseOrderId || undefined,
      goodsReceiptId: goodsReceiptId || undefined,
      date,
      dueDate,
      subtotal,
      cgst,
      sgst,
      igst,
      totalAmount,
      status: editingBillId ? (state.purchaseBills.find(b => b.id === editingBillId)?.status || "Unpaid") : "Unpaid",
      paidAmount: editingBillId ? (state.purchaseBills.find(b => b.id === editingBillId)?.paidAmount || 0) : 0,
      invoiceType,
    };

    // Close PO if linked
    const updatedPOs = state.purchaseOrders.map((po) => {
      if (po.id === purchaseOrderId) {
        return { ...po, status: "Closed" as const };
      }
      return po;
    });

    // Create Ledger entries: Accounts Payable credit, Purchase Debit, Input Tax Credit Debit
    const vendorObj = state.parties.find((p) => p.id === vendorId)!;
    const ledgerIdBase = "l-bill-" + Math.random().toString(36).substring(2, 9);

    const newLedgers: LedgerEntry[] = [
      {
        id: `${ledgerIdBase}-a`,
        date,
        partyId: vendorId,
        partyName: vendorObj.name,
        type: "Credit",
        amount: totalAmount,
        accountType: "Accounts Payable",
        referenceType: "Bill",
        referenceId: targetBillId,
        notes: `Vendor Bill ${billNumber} received` + (editingBillId ? " (Edited)" : ""),
      },
      {
        id: `${ledgerIdBase}-b`,
        date,
        partyName: "Purchase Account",
        type: "Debit",
        amount: subtotal,
        accountType: "Purchase",
        referenceType: "Bill",
        referenceId: targetBillId,
        notes: `Inventory Purchase from Vendor Bill ${billNumber}` + (editingBillId ? " (Edited)" : ""),
      },
    ];

    if (cgst > 0 || sgst > 0) {
      newLedgers.push({
        id: `${ledgerIdBase}-c`,
        date,
        partyName: "GST Input Tax Credit",
        type: "Debit",
        amount: cgst + sgst,
        accountType: "Tax",
        referenceType: "Bill",
        referenceId: targetBillId,
        notes: `Input CGST + SGST on Bill ${billNumber}`,
      });
    }

    if (igst > 0) {
      newLedgers.push({
        id: `${ledgerIdBase}-d`,
        date,
        partyName: "GST Input Tax Credit",
        type: "Debit",
        amount: igst,
        accountType: "Tax",
        referenceType: "Bill",
        referenceId: targetBillId,
        notes: `Input IGST on Bill ${billNumber}`,
      });
    }

    let baseLedgers = [...state.ledger];
    if (editingBillId) {
      baseLedgers = baseLedgers.filter((l) => !(l.referenceType === "Bill" && l.referenceId === editingBillId));
    }

    const updatedBills = editingBillId
      ? state.purchaseBills.map((b) => (b.id === editingBillId ? newBill : b))
      : [...state.purchaseBills, newBill];

    const updatedState: ERPState = {
      ...state,
      purchaseBills: updatedBills,
      purchaseOrders: updatedPOs,
      ledger: [...baseLedgers, ...newLedgers],
    };

    onUpdateState(updatedState);
    setIsCreating(false);
    setEditingBillId(null);
    setViewingBill(newBill);

    // Reset form
    setVendorId("");
    setPurchaseOrderId("");
    setGoodsReceiptId("");
    setBillNumber("");
    setSubtotal(0);
    setIsInterstate(false);
    setInvoiceType("GST");
  };

  const statusBadges: Record<string, string> = {
    Unpaid: "bg-rose-50 text-rose-700 border-rose-100",
    "Partially Paid": "bg-amber-50 text-amber-700 border-amber-100",
    Paid: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Purchase Bills</h2>
          <p className="text-sm text-gray-500">Record vendor invoices, track input tax credits (ITC), and manage account payables schedules.</p>
        </div>
        {!isCreating && !viewingBill && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-[#002f1d] text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[#00472c] transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={16} />
            Record Vendor Bill
          </button>
        )}
        {(isCreating || viewingBill) && (
          <button
            onClick={() => {
              setIsCreating(false);
              setViewingBill(null);
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            Back to Bills
          </button>
        )}
      </div>

      {/* Record Bill Form */}
      {isCreating && (
        <form onSubmit={handleSubmitBill} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
            <Receipt className="text-emerald-700" size={20} />
            Record Vendor Invoice
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Invoice Type</label>
              <select
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value as "GST" | "NON_GST")}
                disabled={!!purchaseOrderId || !!goodsReceiptId}
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none font-semibold text-slate-700 bg-white cursor-pointer disabled:bg-gray-50"
              >
                <option value="GST">GST Invoice</option>
                <option value="NON_GST">Non-GST Invoice</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Vendor Invoice No *</label>
              <input
                type="text"
                required
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                placeholder="E.g., BILL-9921, AMB/26/102"
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-800 uppercase mb-2 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded w-max">
                Link Goods Receipt (GRN)
              </label>
              <select
                value={goodsReceiptId}
                onChange={(e) => handleGrnChange(e.target.value)}
                disabled={!!purchaseOrderId && !goodsReceiptId}
                className="w-full rounded-lg border border-emerald-500 bg-emerald-50/20 p-2.5 text-sm focus:border-emerald-600 focus:outline-none font-bold text-emerald-800 disabled:opacity-50"
              >
                <option value="" className="text-gray-600 font-normal">-- No GRN Link --</option>
                {availableGRNs.map((grn) => {
                  const po = state.purchaseOrders.find((o) => o.id === grn.purchaseOrderId);
                  const vendor = po ? state.parties.find((p) => p.id === po.vendorId) : null;
                  return (
                    <option key={grn.id} value={grn.id} className="text-gray-800 font-medium">
                      {grn.grnNumber} - {vendor?.name} (PO: {po?.orderNumber})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-indigo-800 uppercase mb-2 flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded w-max">
                Link Purchase Order (Direct)
              </label>
              <select
                value={purchaseOrderId}
                onChange={(e) => handlePoChange(e.target.value)}
                disabled={!!goodsReceiptId}
                className="w-full rounded-lg border border-indigo-500 bg-indigo-50/20 p-2.5 text-sm focus:border-indigo-600 focus:outline-none font-bold text-indigo-800 disabled:opacity-50"
              >
                <option value="" className="text-gray-600 font-normal">-- No PO Link --</option>
                {availablePOs.map((po) => {
                  const vendor = state.parties.find((p) => p.id === po.vendorId);
                  return (
                    <option key={po.id} value={po.id} className="text-gray-800 font-medium">
                      {po.orderNumber} - {vendor?.name} ({formatINR(po.totalAmount)})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Vendor Name *</label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                required
                disabled={!!purchaseOrderId || !!goodsReceiptId}
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none disabled:bg-gray-50"
              >
                <option value="">-- Select Vendor --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Bill Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Subtotal Amount (Excl. Tax) *</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={subtotal || ""}
                  onChange={(e) => setSubtotal(parseFloat(e.target.value) || 0)}
                  disabled={!!purchaseOrderId || !!goodsReceiptId}
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none disabled:bg-gray-50 font-bold"
                />
              </div>

              <div className="flex items-center pt-2">
                <label className="inline-flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInterstate}
                    onChange={(e) => setIsInterstate(e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="text-sm font-semibold text-gray-700">Interstate Bill (IGST 18% instead of local CGST+SGST 9%)</span>
                </label>
              </div>
            </div>

            <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-3.5 text-sm text-gray-600">
              <div className="flex justify-between font-semibold">
                <span>Assessable Value (Subtotal)</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              {invoiceType !== "NON_GST" ? (
                <>
                  {!isInterstate ? (
                    <>
                      <div className="flex justify-between text-xs">
                        <span>Input CGST (9%)</span>
                        <span>{formatINR(Math.round(subtotal * 0.09))}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Input SGST (9%)</span>
                        <span>{formatINR(Math.round(subtotal * 0.09))}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-xs">
                      <span>Input IGST (18%)</span>
                      <span>{formatINR(Math.round(subtotal * 0.18))}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between text-xs text-gray-400 italic">
                  <span>GST Exemption (0% GST)</span>
                  <span>₹0</span>
                </div>
              )}
              <div className="border-t border-gray-200 my-1 pt-3 flex justify-between font-extrabold text-gray-900 text-base">
                <span>Total Payable Liability</span>
                <span className="text-indigo-800">
                  {formatINR(
                    subtotal +
                      (invoiceType === "NON_GST"
                        ? 0
                        : isInterstate
                        ? Math.round(subtotal * 0.18)
                        : Math.round(subtotal * 0.09) * 2)
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
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
              Post Bill to Accounts Payable
            </button>
          </div>
        </form>
      )}

      {/* Bill Detail View */}
      {viewingBill && (
        <div className="space-y-4 max-w-3xl mx-auto">
          {/* Action header bar */}
          <div className="no-print bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setViewingBill(null)}
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
                onClick={() => handleDownloadPDF(viewingBill)}
                disabled={isDownloading}
                className="px-4 py-2 bg-emerald-800 hover:bg-[#002f1d] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors disabled:opacity-50"
              >
                <Download size={14} /> {isDownloading ? "Generating PDF..." : "Download PDF"}
              </button>
            </div>
          </div>

          {/* Printable Bill Area */}
          <div ref={printRef} className="printable-area bg-white p-8 rounded-xl border border-gray-100 shadow-sm space-y-6 text-gray-900">
            {/* Header / Logo */}
            <div className="border-b pb-6 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-[#002f1d] text-[#f9f6f0] flex items-center justify-center font-extrabold text-sm rounded">
                    {company.name.charAt(0)}
                  </div>
                  <h2 className="text-xl font-black text-gray-950 tracking-tight">{company.name}</h2>
                </div>
                <p className="text-xs text-gray-500 max-w-sm">{company.address}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">GSTIN: {company.gstin} | Email: {company.email}</p>
                <p className="text-xs text-gray-500 font-mono">Phone: {company.phone}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-gray-900 text-white text-xs font-extrabold uppercase tracking-wider rounded mb-2">
                  INWARD PURCHASE BILL
                </span>
                <p className="text-sm font-black text-gray-900 font-mono">{viewingBill.billNumber}</p>
                <p className="text-xs text-gray-500 mt-1">Posting Date: <span className="font-bold text-gray-800">{formatDate(viewingBill.date)}</span></p>
                <p className="text-xs text-gray-500">Due Date: <span className="font-bold text-gray-800">{formatDate(viewingBill.dueDate)}</span></p>
                <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${statusBadges[viewingBill.status]}`}>
                  {viewingBill.status}
                </span>
              </div>
            </div>

            {/* Vendor & References */}
            <div className="grid grid-cols-2 gap-6 text-xs bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div>
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">SUPPLIER / VENDOR DETAILS</span>
                {(() => {
                  const supplier = state.parties.find((p) => p.id === viewingBill.vendorId);
                  return (
                    <>
                      <p className="font-bold text-gray-900 text-sm">{supplier?.name || "Vendor"}</p>
                      <p className="text-gray-600 mt-0.5 whitespace-pre-line">{supplier?.address || "Address N/A"}</p>
                      <p className="text-gray-600 font-mono mt-1">GSTIN: {supplier?.gstin || "N/A"}</p>
                      <p className="text-gray-600 font-mono">Phone: {supplier?.phone || "N/A"}</p>
                    </>
                  );
                })()}
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">DOCUMENT REFERENCES</span>
                {viewingBill.purchaseOrderId && (
                  <p className="text-gray-700">PO Ref: <span className="font-bold text-indigo-700 font-mono">{
                    state.purchaseOrders.find((o) => o.id === viewingBill.purchaseOrderId)?.orderNumber || viewingBill.purchaseOrderId
                  }</span></p>
                )}
                {viewingBill.goodsReceiptId && (
                  <p className="text-gray-700 mt-0.5">GRN Ref: <span className="font-bold text-emerald-700 font-mono">{
                    state.goodsReceipts.find((g) => g.id === viewingBill.goodsReceiptId)?.grnNumber || viewingBill.goodsReceiptId
                  }</span></p>
                )}
                <p className="text-gray-700 mt-1">Payment Status: <span className="font-bold">{viewingBill.status}</span></p>
              </div>
            </div>

            {/* Items Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 font-bold border-b">
                    <th className="p-3">#</th>
                    <th className="p-3">Item Description</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3 text-right">Unit Rate</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {(() => {
                    const po = viewingBill.purchaseOrderId ? state.purchaseOrders.find(o => o.id === viewingBill.purchaseOrderId) : null;
                    const grn = viewingBill.goodsReceiptId ? state.goodsReceipts.find(g => g.id === viewingBill.goodsReceiptId) : null;
                    const items = grn ? grn.items : (po ? po.items : []);
                    if (items.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-gray-400 italic">No line items detailed</td>
                        </tr>
                      );
                    }
                    return items.map((item, index) => {
                      const poItem = po?.items.find((pi) => pi.itemId === item.itemId);
                      const rate = (item as any).rate !== undefined ? (item as any).rate : (poItem?.rate || 0);
                      const qty = grn ? (item as any).quantityReceived : (item as any).quantity;
                      const lineTotal = qty * rate;
                      return (
                        <tr key={index}>
                          <td className="p-3 text-gray-400 font-mono">{index + 1}</td>
                          <td className="p-3 font-semibold text-gray-900">{item.name}</td>
                          <td className="p-3 text-right font-medium">{qty} {(item as any).unit || ""}</td>
                          <td className="p-3 text-right font-mono">{formatINR(rate)}</td>
                          <td className="p-3 text-right font-bold font-mono text-gray-900">{formatINR(lineTotal)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Subtotal & Taxes */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
              <div className="text-xs text-gray-500 max-w-xs space-y-1">
                <p className="font-bold text-gray-700">Amount In Words:</p>
                <p className="italic font-medium text-gray-800 bg-gray-50 p-2 rounded border border-gray-100">
                  {numberToIndianWords(viewingBill.totalAmount)}
                </p>
              </div>

              <div className="w-full sm:w-64 space-y-2 text-xs bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="flex justify-between text-gray-600">
                  <span>Assessable Value</span>
                  <span className="font-semibold">{formatINR(viewingBill.subtotal)}</span>
                </div>
                {viewingBill.cgst > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Input CGST (9%)</span>
                    <span>{formatINR(viewingBill.cgst)}</span>
                  </div>
                )}
                {viewingBill.sgst > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Input SGST (9%)</span>
                    <span>{formatINR(viewingBill.sgst)}</span>
                  </div>
                )}
                {viewingBill.igst > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Input IGST (18%)</span>
                    <span>{formatINR(viewingBill.igst)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2 flex justify-between font-black text-sm text-gray-950">
                  <span>Total Amount</span>
                  <span className="text-[#002f1d]">{formatINR(viewingBill.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-gray-500 text-[11px]">
                  <span>Paid Amount</span>
                  <span>{formatINR(viewingBill.paidAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-rose-600 border-t border-dashed pt-1.5 text-[11px]">
                  <span>Balance Outstanding</span>
                  <span>{formatINR(viewingBill.totalAmount - viewingBill.paidAmount)}</span>
                </div>
              </div>
            </div>

            {/* Signatures & Footer */}
            <div className="border-t pt-8 grid grid-cols-2 gap-6 text-xs text-gray-500">
              <div>
                <p className="font-bold text-gray-700">Verification & Acceptance</p>
                <p className="mt-8 pt-2 border-t border-gray-300 w-48 text-[10px] text-gray-400">Stores / Accounts Incharge</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-700">For {company.name}</p>
                <p className="mt-8 pt-2 border-t border-gray-300 w-48 ml-auto text-[10px] text-gray-400">Authorized Signatory</p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="no-print space-y-2 pt-2">
            <div className="flex gap-2">
              <button
                onClick={() => handleEditClick(viewingBill)}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Edit size={14} /> Edit Bill Details
              </button>
              <button
                onClick={() => handleDeleteBill(viewingBill.id)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Trash2 size={14} /> Delete Bill
              </button>
            </div>

            {viewingBill.status !== "Paid" && setCurrentTab && (
              <button
                onClick={() => setCurrentTab("payments")}
                className="w-full py-2.5 bg-[#002f1d] hover:bg-[#00472c] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Wallet size={14} /> Record Outward Payment
              </button>
            )}

            {setCurrentTab && (
              <button
                onClick={() => {
                  localStorage.setItem("prefill_bill_id", viewingBill.id);
                  setCurrentTab("purchase-returns");
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Undo2 size={14} /> Record Purchase Return (Debit Note)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bill Directory List */}
      {!isCreating && !viewingBill && (
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
                placeholder="Search vendor or bill #..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-none bg-white"
              />
            </div>
            <span className="text-xs text-gray-400 font-medium font-mono">
              Total Recorded Inward Invoices: {state.purchaseBills.length}
            </span>
          </div>

          {filteredBills.length === 0 ? (
            <p className="text-sm text-gray-500 py-12 text-center">No Purchase Bills found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold">
                    <th className="p-4">Bill #</th>
                    <th className="p-4">Vendor</th>
                    <th className="p-4">Date</th>
                    <th className="p-4 text-right">Total</th>
                    <th className="p-4 text-right">Paid</th>
                    <th className="p-4 text-right">Balance</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-600">
                  {filteredBills.slice().reverse().map((b) => {
                    const vendor = state.parties.find((p) => p.id === b.vendorId);
                    return (
                      <tr key={b.id} className="hover:bg-gray-50/40">
                        <td className="p-4 font-bold text-gray-900">{b.billNumber}</td>
                        <td className="p-4 font-semibold text-gray-900">{vendor?.name || "Unknown"}</td>
                        <td className="p-4">{formatDate(b.date)}</td>
                        <td className="p-4 text-right font-medium">{formatINR(b.totalAmount)}</td>
                        <td className="p-4 text-right text-gray-600">{formatINR(b.paidAmount || 0)}</td>
                        <td className="p-4 text-right font-bold text-rose-600">
                          {formatINR(b.totalAmount - b.paidAmount)}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusBadges[b.status]}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-1.5">
                            <button
                              onClick={() => setViewingBill(b)}
                              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded border flex items-center justify-center gap-1 font-bold text-[10px] cursor-pointer"
                            >
                              <Eye size={13} /> View
                            </button>
                            <button
                              onClick={() => handleDownloadPDF(b)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded border border-emerald-200 flex items-center justify-center gap-1 font-bold text-[10px] cursor-pointer"
                              title="Download Purchase Bill PDF"
                            >
                              <Download size={13} /> PDF
                            </button>
                            <button
                              onClick={() => handleDeleteBill(b.id)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-100 flex items-center justify-center gap-1 font-bold text-[10px] cursor-pointer"
                              title="Delete Purchase Bill"
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
