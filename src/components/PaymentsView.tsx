import React, { useState, useRef, useMemo } from "react";
import { ERPState, Payment, Party, PurchaseBill, SaleInvoice, LedgerEntry, UserActivityLog } from "../types";
import { formatINR, formatDate, getVendorOutstanding, getCustomerOutstanding, numberToIndianWords } from "../utils";
import { isWarehouseAllowed } from "../utils/warehouseAuth";
import { downloadDocumentPDF } from "../utils/pdfGenerator";
import { INITIAL_COMPANY_PROFILE } from "../data";
import { Plus, Search, Eye, ArrowLeft, Wallet, Trash2, Printer, Download, X, User, Edit, ShieldCheck } from "lucide-react";

interface PaymentsViewProps {
  state: ERPState;
  currentUserEmail?: string;
  onUpdateState: (newState: ERPState) => void;
  prefill?: { customerId: string; amount: number; notes: string; invoiceNumber: string } | null;
  clearPrefill?: () => void;
}

export default function PaymentsView({ state, currentUserEmail, onUpdateState, prefill, clearPrefill }: PaymentsViewProps) {
  const currentUser = useMemo(
    () => (state.teamMembers || []).find((m) => m.email.toLowerCase() === (currentUserEmail || "").toLowerCase()),
    [state.teamMembers, currentUserEmail]
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [paymentType, setPaymentType] = useState<"Outward" | "Inbound" | "PartnerInbound">("Outward");
  const [viewTypeFilter, setViewTypeFilter] = useState<"All" | "Outward" | "Inbound" | "PartnerInbound">("All");
  const [repFilter, setRepFilter] = useState<string>("All");
  const printRef = useRef<HTMLDivElement>(null);

  const company = state.companyProfile || INITIAL_COMPANY_PROFILE;

  // Compute sales representatives & team members for 'Received By' dropdown
  const salesTeamMemberNames = (state.teamMembers || [])
    .filter((m) => {
      const r = (m.role || "").toLowerCase();
      if (r === "purchase" || r === "store" || r === "production") return false;
      return r.includes("sales") || m.permissions?.sales === true;
    })
    .map((m) => m.name.replace(/\s*\(.*?\)/, "").trim())
    .filter(Boolean);

  const nonSalesLower = new Set(
    (state.teamMembers || [])
      .filter((m) => {
        const r = (m.role || "").toLowerCase();
        return (r === "purchase" || r === "store" || r === "production" || r === "accountant") && !m.permissions?.sales;
      })
      .map((m) => m.name.trim().toLowerCase())
  );

  const rawAssignees = state.salesAssignees && state.salesAssignees.length > 0
    ? state.salesAssignees
    : ["Vishal Kumar"];

  // Form States
  const [vendorId, setVendorId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [receivedBy, setReceivedBy] = useState(state.salesAssigneeName || "Vishal Kumar");
  const [isCustomRep, setIsCustomRep] = useState(false);
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Bank Transfer" | "Cheque" | "UPI">("Bank Transfer");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const deduplicateNames = (names: (string | undefined | null)[]) => {
    const map = new Map<string, string>();
    names.forEach((n) => {
      if (n && n.trim()) {
        const clean = n.trim();
        const key = clean.toLowerCase();
        if (!map.has(key) && !nonSalesLower.has(key)) {
          map.set(key, clean);
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  };

  const receivedByOptions = deduplicateNames([
    ...rawAssignees,
    ...salesTeamMemberNames,
    state.salesAssigneeName,
    receivedBy
  ]);

  const representatives = deduplicateNames([
    ...receivedByOptions,
    ...state.payments.map((p) => p.receivedBy)
  ]);

  const handleDownloadPDF = async (payment: Payment) => {
    setIsDownloading(true);
    setViewingPayment(payment);
    setTimeout(async () => {
      const element = printRef.current || (document.querySelector(".printable-area") as HTMLElement);
      if (!element) {
        setIsDownloading(false);
        return;
      }
      try {
        await downloadDocumentPDF(element, `PaymentReceipt_${payment.paymentNumber}.pdf`);
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

  React.useEffect(() => {
    if (prefill) {
      setIsCreating(true);
      setEditingPayment(null);
      setPaymentType("Inbound");
      setCustomerId(prefill.customerId);
      setAmount(prefill.amount);
      setNotes(prefill.notes);
      setReferenceNumber(prefill.invoiceNumber);
      setReceivedBy("Vishal Kumar");
      if (clearPrefill) {
        clearPrefill();
      }
    }
  }, [prefill, clearPrefill]);

  const vendors = state.parties.filter((p) => p.type === "Vendor" || p.type === "Both");
  const customers = state.parties.filter((p) => p.type === "Customer" || p.type === "Both");
  const fundingPartners = state.fundingPartners || [];

  // Filter payments
  const filteredPayments = state.payments.filter((pay) => {
    let payWarehouseId = (pay as any).warehouseId;
    if (!payWarehouseId && pay.notes) {
      // Check if linked to an invoice
      const matchedInv = state.saleInvoices.find((inv) => pay.notes?.includes(inv.invoiceNumber));
      if (matchedInv) {
        payWarehouseId = matchedInv.warehouseId;
      } else {
        const matchedBill = state.purchaseBills.find((b) => pay.notes?.includes(b.billNumber));
        if (matchedBill) {
          payWarehouseId = matchedBill.warehouseId;
        }
      }
    }
    if (payWarehouseId && !isWarehouseAllowed(currentUser, payWarehouseId)) {
      return false;
    }

    const isPartner = Boolean(pay.partnerId || pay.type === "PartnerInbound");
    if (viewTypeFilter === "Outward" && (pay.customerId || isPartner)) return false;
    if (viewTypeFilter === "Inbound" && (!pay.customerId || isPartner)) return false;
    if (viewTypeFilter === "PartnerInbound" && !isPartner) return false;

    if (repFilter !== "All" && pay.receivedBy !== repFilter) return false;

    const vendor = pay.vendorId ? state.parties.find((p) => p.id === pay.vendorId) : null;
    const customer = pay.customerId ? state.parties.find((p) => p.id === pay.customerId) : null;
    const partner = pay.partnerId ? fundingPartners.find((p) => p.id === pay.partnerId) : null;
    const partyName = partner?.name || vendor?.name || customer?.name || "";

    const term = (searchTerm || "").toLowerCase();
    return (
      (pay.paymentNumber || "").toLowerCase().includes(term) ||
      (pay.referenceNumber || "").toLowerCase().includes(term) ||
      (pay.receivedBy || "").toLowerCase().includes(term) ||
      partyName.toLowerCase().includes(term)
    );
  });

  const handleVendorChange = (vId: string) => {
    setVendorId(vId);
    // Auto-populate outstanding balance to help user pay
    const outstanding = getVendorOutstanding(vId, state);
    setAmount(Math.max(0, outstanding));
  };

  const handleCustomerChange = (cId: string) => {
    setCustomerId(cId);
    // Auto-populate outstanding balance to help user receive
    const outstanding = getCustomerOutstanding(cId, state);
    setAmount(Math.max(0, outstanding));
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setReceivedBy(payment.receivedBy || "Vishal Kumar");
    setAmount(payment.amount);
    setPaymentMethod(payment.paymentMethod);
    setReferenceNumber(payment.referenceNumber);
    setDate(payment.date);
    setNotes(payment.notes || "");
    setVendorId(payment.vendorId || "");
    setCustomerId(payment.customerId || "");
    setPartnerId(payment.partnerId || "");
    setPaymentType(payment.type || (payment.customerId ? "Inbound" : payment.partnerId ? "PartnerInbound" : "Outward"));
    setIsCreating(true);
  };

  const handleDeletePayment = (paymentId: string) => {
    const payment = state.payments.find((p) => p.id === paymentId);
    if (!payment) return;

    if (
      !confirm(
        `Are you sure you want to delete Payment ${payment.paymentNumber} of ₹${payment.amount}? This will restore outstanding balances and reopen unpaid bill balances.`
      )
    ) {
      return;
    }

    const updatedPayments = state.payments.filter((p) => p.id !== paymentId);
    const updatedFundingTxs = (state.fundingTransactions || []).filter(
      (ftx) => !(ftx.notes && ftx.notes.includes(payment.paymentNumber)) && ftx.referenceNumber !== payment.referenceNumber
    );
    const updatedLedger = state.ledger.filter(
      (l) =>
        !(
          l.referenceType === "Payment" &&
          (l.referenceId === paymentId || l.referenceId === payment.paymentNumber)
        )
    );

    let updatedInvoices = state.saleInvoices;
    let updatedBills = state.purchaseBills;

    if (payment.customerId) {
      // Revert Customer Payment
      const customerId = payment.customerId;

      const otherCustomerPayments = updatedPayments
        .filter((p) => p.customerId === customerId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const otherInvoices = state.saleInvoices.filter((inv) => inv.customerId !== customerId);
      const customerInvoicesToAllocate = state.saleInvoices
        .filter((inv) => inv.customerId === customerId)
        .map((inv) => {
          if (inv.status === "Draft") {
            return inv;
          }
          return {
            ...inv,
            paidAmount: 0,
            status: "Posted" as const,
          };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      otherCustomerPayments.forEach((pay) => {
        let cashRemaining = pay.amount;
        for (let i = 0; i < customerInvoicesToAllocate.length; i++) {
          const inv = customerInvoicesToAllocate[i];
          if (inv.status === "Draft") continue;
          const invPaidAmount = inv.paidAmount || 0;
          const invOutstanding = inv.totalAmount - invPaidAmount;
          if (invOutstanding > 0 && cashRemaining > 0) {
            if (cashRemaining >= invOutstanding) {
              cashRemaining -= invOutstanding;
              inv.paidAmount = inv.totalAmount;
              inv.status = "Paid";
            } else {
              inv.paidAmount = invPaidAmount + cashRemaining;
              cashRemaining = 0;
              inv.status = "Partial";
            }
          }
        }
      });

      updatedInvoices = [...otherInvoices, ...customerInvoicesToAllocate];
    }

    if (payment.vendorId) {
      // Revert Vendor Payment
      const vendorId = payment.vendorId;

      const otherVendorPayments = updatedPayments
        .filter((p) => p.vendorId === vendorId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const otherBills = state.purchaseBills.filter((b) => b.vendorId !== vendorId);
      const vendorBillsToAllocate = state.purchaseBills
        .filter((b) => b.vendorId === vendorId)
        .map((b) => ({
          ...b,
          paidAmount: 0,
          status: "Unpaid" as "Unpaid" | "Partially Paid" | "Paid",
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      otherVendorPayments.forEach((pay) => {
        let cashRemaining = pay.amount;
        for (let i = 0; i < vendorBillsToAllocate.length; i++) {
          const b = vendorBillsToAllocate[i];
          const billOutstanding = b.totalAmount - b.paidAmount;
          if (billOutstanding > 0 && cashRemaining > 0) {
            if (cashRemaining >= billOutstanding) {
              cashRemaining -= billOutstanding;
              b.paidAmount = b.totalAmount;
              b.status = "Paid";
            } else {
              b.paidAmount += cashRemaining;
              cashRemaining = 0;
              b.status = "Partially Paid";
            }
          }
        }
      });

      updatedBills = [...otherBills, ...vendorBillsToAllocate];
    }

    // Always recalculate Factory Expenses to ensure any expense bill whose payment was deleted is REOPENED!
    const currentExpenses = state.factoryExpenses || [];
    const updatedExpenses = currentExpenses.map((e) => {
      const remainingPayments = updatedPayments.filter(
        (p) =>
          p.expenseId === e.id ||
          p.referenceNumber === e.expenseNumber ||
          p.notes?.includes(e.expenseNumber)
      );
      const newPaidAmount = remainingPayments.reduce((sum, p) => sum + p.amount, 0);
      let newStatus: "Unpaid" | "Partially Paid" | "Paid" = "Unpaid";
      if (newPaidAmount >= e.totalAmount && e.totalAmount > 0) {
        newStatus = "Paid";
      } else if (newPaidAmount > 0) {
        newStatus = "Partially Paid";
      }

      return {
        ...e,
        paidAmount: Math.min(e.totalAmount, Math.max(0, newPaidAmount)),
        status: newStatus,
      };
    });

    onUpdateState({
      ...state,
      payments: updatedPayments,
      fundingTransactions: updatedFundingTxs,
      saleInvoices: updatedInvoices,
      purchaseBills: updatedBills,
      factoryExpenses: updatedExpenses,
      ledger: updatedLedger,
    });
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentType === "Outward") {
      if (!vendorId) {
        alert("Please select a vendor.");
        return;
      }
    } else if (paymentType === "Inbound") {
      if (!customerId) {
        alert("Please select a customer.");
        return;
      }
    } else if (paymentType === "PartnerInbound") {
      if (!partnerId) {
        alert("Please select a partner.");
        return;
      }
    }

    if (!receivedBy || receivedBy.trim() === "") {
      alert("Please select the payment receiving representative.");
      return;
    }

    if (amount <= 0) {
      alert(`Please enter a valid ${paymentType === "Outward" ? "disbursement" : "receipt"} amount.`);
      return;
    }
    if (!referenceNumber) {
      alert("Please provide a transaction reference or transaction ID.");
      return;
    }

    // Check if editing an existing payment
    if (editingPayment) {
      const prevRep = editingPayment.receivedBy || "N/A";
      const updatedPayments = state.payments.map((p) => {
        if (p.id === editingPayment.id) {
          return {
            ...p,
            receivedBy,
            amount,
            paymentMethod,
            referenceNumber,
            date,
            notes,
            vendorId: paymentType === "Outward" ? vendorId : undefined,
            customerId: paymentType === "Inbound" ? customerId : undefined,
            partnerId: paymentType === "PartnerInbound" ? partnerId : undefined,
            type: paymentType,
          };
        }
        return p;
      });

      const auditLog: UserActivityLog = {
        id: "log-" + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        userName: "System Admin",
        userEmail: "admin@erp.com",
        role: "Admin",
        action: "Payment Updated",
        module: "Payment Receiving",
        details: `Updated Payment ${editingPayment.paymentNumber}. Previous Representative: "${prevRep}", New Representative: "${receivedBy}". Amount: ₹${amount}`,
        status: "Success",
      };

      const updatedAssignees = Array.from(
        new Set([
          ...(state.salesAssignees || ["Vishal Kumar"]),
          receivedBy.trim()
        ].filter(Boolean))
      );

      onUpdateState({
        ...state,
        payments: updatedPayments,
        salesAssignees: updatedAssignees,
        activityLogs: [auditLog, ...(state.activityLogs || [])],
      });

      setIsCreating(false);
      setEditingPayment(null);
      setVendorId("");
      setCustomerId("");
      setPartnerId("");
      setAmount(0);
      setReferenceNumber("");
      setNotes("");
      setReceivedBy(state.salesAssigneeName || "Vishal Kumar");
      setIsCustomRep(false);
      return;
    }

    const nextPaymentNumber = `PAY-2026-${String(state.payments.length + 1).padStart(4, "0")}`;
    const newPaymentId = "pay-" + Math.random().toString(36).substring(2, 9);

    const auditLog: UserActivityLog = {
      id: "log-" + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      userName: "System Admin",
      userEmail: "admin@erp.com",
      role: "Admin",
      action: "Payment Created",
      module: "Payment Receiving",
      details: `Created Payment ${nextPaymentNumber} for ₹${amount}. Received By Representative: "${receivedBy}".`,
      status: "Success",
    };

    if (paymentType === "Outward") {
      // Vendor Payment Outward
      const newPayment: Payment = {
        id: newPaymentId,
        paymentNumber: nextPaymentNumber,
        date,
        vendorId,
        amount,
        paymentMethod,
        referenceNumber,
        notes,
        type: "Outward",
        receivedBy,
      };

      // Premium Allocator: Allocate payment across vendor's unpaid bills sequentially (oldest first)
      const vendorBills = state.purchaseBills
        .filter((b) => b.vendorId === vendorId && b.status !== "Paid")
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let cashRemaining = amount;
      const updatedBills = state.purchaseBills.map((b) => {
        const targetIdx = vendorBills.findIndex((vb) => vb.id === b.id);
        if (targetIdx !== -1 && cashRemaining > 0) {
          const billOutstanding = b.totalAmount - b.paidAmount;
          if (cashRemaining >= billOutstanding) {
            cashRemaining -= billOutstanding;
            return {
              ...b,
              paidAmount: b.totalAmount,
              status: "Paid" as const,
            };
          } else {
            const newPaidAmount = b.paidAmount + cashRemaining;
            cashRemaining = 0;
            return {
              ...b,
              paidAmount: newPaidAmount,
              status: "Partially Paid" as const,
            };
          }
        }
        return b;
      });

      // Create Ledger Entries: Accounts Payable Debit, Cash/Bank Credit
      const vendorObj = state.parties.find((p) => p.id === vendorId)!;
      const ledgerIdBase = "l-pay-" + Math.random().toString(36).substring(2, 9);

      const newLedgers: LedgerEntry[] = [
        {
          id: `${ledgerIdBase}-a`,
          date,
          partyId: vendorId,
          partyName: vendorObj.name,
          type: "Debit",
          amount: amount,
          accountType: "Accounts Payable",
          referenceType: "Payment",
          referenceId: newPaymentId,
          notes: `Payment Out ${nextPaymentNumber} disbursed via ${paymentMethod}`,
        },
        {
          id: `${ledgerIdBase}-b`,
          date,
          partyName: paymentMethod === "Cash" ? "Cash Account" : "Bank Account",
          type: "Credit",
          amount: amount,
          accountType: paymentMethod === "Cash" ? "Cash" : "Bank",
          referenceType: "Payment",
          referenceId: newPaymentId,
          notes: `Disbursement from ${paymentMethod === "Cash" ? "Cash Box" : "HDFC Bank"} - Ref ${referenceNumber}`,
        },
      ];

      const updatedAssignees = Array.from(
        new Set([
          ...(state.salesAssignees || ["Vishal Kumar"]),
          receivedBy.trim()
        ].filter(Boolean))
      );

      const updatedState: ERPState = {
        ...state,
        payments: [...state.payments, newPayment],
        salesAssignees: updatedAssignees,
        purchaseBills: updatedBills,
        ledger: [...state.ledger, ...newLedgers],
        activityLogs: [auditLog, ...(state.activityLogs || [])],
      };

      onUpdateState(updatedState);
    } else if (paymentType === "Inbound") {
      // Customer Payment Inward
      const newPayment: Payment = {
        id: newPaymentId,
        paymentNumber: nextPaymentNumber,
        date,
        customerId,
        amount,
        paymentMethod,
        referenceNumber,
        notes,
        type: "Inbound",
        receivedBy,
      };

      // Premium Allocator: Allocate payment across customer's unpaid sale invoices sequentially (oldest first)
      const customerInvoices = state.saleInvoices
        .filter(
          (inv) =>
            inv.customerId === customerId &&
            inv.status !== "Draft" &&
            (inv.status || "Posted") !== "Paid"
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let cashRemaining = amount;
      const updatedInvoices = state.saleInvoices.map((inv) => {
        if (inv.customerId === customerId && inv.status !== "Draft" && cashRemaining > 0) {
          const invPaidAmount = inv.paidAmount || 0;
          const invOutstanding = inv.totalAmount - invPaidAmount;
          if (invOutstanding > 0) {
            if (cashRemaining >= invOutstanding) {
              cashRemaining -= invOutstanding;
              return {
                ...inv,
                paidAmount: inv.totalAmount,
                status: "Paid" as const,
              };
            } else {
              const newPaidAmount = invPaidAmount + cashRemaining;
              cashRemaining = 0;
              return {
                ...inv,
                paidAmount: newPaidAmount,
                status: "Partial" as const,
              };
            }
          }
        }
        return inv;
      });

      // Create Ledger Entries: Cash/Bank Debit, Accounts Receivable Credit
      const customerObj = state.parties.find((p) => p.id === customerId)!;
      const ledgerIdBase = "l-rec-" + Math.random().toString(36).substring(2, 9);

      const newLedgers: LedgerEntry[] = [
        {
          id: `${ledgerIdBase}-a`,
          date,
          partyName: paymentMethod === "Cash" ? "Cash Account" : "Bank Account",
          type: "Debit",
          amount: amount,
          accountType: paymentMethod === "Cash" ? "Cash" : "Bank",
          referenceType: "Payment",
          referenceId: newPaymentId,
          notes: `Receipt to ${paymentMethod === "Cash" ? "Cash Box" : "HDFC Bank"} - Ref ${referenceNumber}`,
        },
        {
          id: `${ledgerIdBase}-b`,
          date,
          partyId: customerId,
          partyName: customerObj.name,
          type: "Credit",
          amount: amount,
          accountType: "Accounts Receivable",
          referenceType: "Payment",
          referenceId: newPaymentId,
          notes: `Customer Payment Received ${nextPaymentNumber} via ${paymentMethod}`,
        },
      ];

      const updatedAssignees = Array.from(
        new Set([
          ...(state.salesAssignees || ["Vishal Kumar"]),
          receivedBy.trim()
        ].filter(Boolean))
      );

      const updatedState: ERPState = {
        ...state,
        payments: [...state.payments, newPayment],
        salesAssignees: updatedAssignees,
        saleInvoices: updatedInvoices,
        ledger: [...state.ledger, ...newLedgers],
        activityLogs: [auditLog, ...(state.activityLogs || [])],
      };

      onUpdateState(updatedState);
    } else if (paymentType === "PartnerInbound") {
      // Partner Capital Payment Received
      const partnerObj = fundingPartners.find((p) => p.id === partnerId);
      const partnerName = partnerObj?.name || "Partner";

      const newPayment: Payment = {
        id: newPaymentId,
        paymentNumber: nextPaymentNumber,
        date,
        partnerId,
        amount,
        paymentMethod,
        referenceNumber,
        notes,
        type: "PartnerInbound",
        receivedBy,
      };

      const newFundingTx = {
        id: "funding-tx-" + Math.random().toString(36).substring(2, 9),
        date,
        partnerId: partnerId || (fundingPartners[0]?.id || "partner-1"),
        amount,
        paymentMethod,
        referenceNumber: referenceNumber || `FTX-${Math.floor(100000 + Math.random() * 900000)}`,
        notes: notes ? `${notes} (Voucher ${nextPaymentNumber})` : `Partner Capital Received (${nextPaymentNumber})`,
      };

      const ledgerIdBase = "l-prt-" + Math.random().toString(36).substring(2, 9);
      const newLedgers: LedgerEntry[] = [
        {
          id: `${ledgerIdBase}-a`,
          date,
          partyName: paymentMethod === "Cash" ? "Cash Account" : "Bank Account",
          type: "Debit",
          amount: amount,
          accountType: paymentMethod === "Cash" ? "Cash" : "Bank",
          referenceType: "Payment",
          referenceId: newPaymentId,
          notes: `Partner Capital Receipt into ${paymentMethod === "Cash" ? "Cash Box" : "Bank Account"} - Ref ${referenceNumber}`,
        },
        {
          id: `${ledgerIdBase}-b`,
          date,
          partyId: partnerId,
          partyName: `Partner Equity: ${partnerName}`,
          type: "Credit",
          amount: amount,
          accountType: "Cash" as const,
          referenceType: "Payment",
          referenceId: newPaymentId,
          notes: `Capital Investment Received from Partner ${partnerName} (${nextPaymentNumber})`,
        },
      ];

      const updatedAssignees = Array.from(
        new Set([
          ...(state.salesAssignees || ["Vishal Kumar"]),
          receivedBy.trim()
        ].filter(Boolean))
      );

      const updatedState: ERPState = {
        ...state,
        payments: [...state.payments, newPayment],
        salesAssignees: updatedAssignees,
        fundingTransactions: [newFundingTx, ...(state.fundingTransactions || [])],
        ledger: [...state.ledger, ...newLedgers],
        activityLogs: [auditLog, ...(state.activityLogs || [])],
      };

      onUpdateState(updatedState);
    }

    setIsCreating(false);
    setEditingPayment(null);

    // Reset Form
    setVendorId("");
    setCustomerId("");
    setPartnerId("");
    setAmount(0);
    setReferenceNumber("");
    setNotes("");
    setReceivedBy(state.salesAssigneeName || "Vishal Kumar");
    setIsCustomRep(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Payments Ledger</h2>
          <p className="text-sm text-gray-500">
            Record supplier cash/bank disbursements and customer payment collections, settle outstanding balances, and post financial journal entries.
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-[#002f1d] text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[#00472c] transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={16} />
            Record Payment Voucher
          </button>
        )}
        {isCreating && (
          <button
            onClick={() => setIsCreating(false)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            Back to Payments Log
          </button>
        )}
      </div>

      {/* Record Payment Form */}
      {isCreating && (
        <form onSubmit={handleSubmitPayment} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
            <Wallet className="text-emerald-700" size={20} />
            {paymentType === "Outward"
              ? "Disburse Funds to Supplier"
              : paymentType === "Inbound"
              ? "Receive Funds from Customer"
              : "Receive Partner Capital / Investment"}
          </h3>

          {/* Payment Type Switcher */}
          <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-lg max-w-xl">
            <button
              type="button"
              onClick={() => {
                setPaymentType("Outward");
                setVendorId("");
                setCustomerId("");
                setPartnerId("");
                setAmount(0);
              }}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                paymentType === "Outward"
                  ? "bg-[#002f1d] text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Supplier Payment (Outward)
            </button>
            <button
              type="button"
              onClick={() => {
                setPaymentType("Inbound");
                setVendorId("");
                setCustomerId("");
                setPartnerId("");
                setAmount(0);
              }}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                paymentType === "Inbound"
                  ? "bg-[#002f1d] text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Customer Payment (Inbound)
            </button>
            <button
              type="button"
              onClick={() => {
                setPaymentType("PartnerInbound");
                setVendorId("");
                setCustomerId("");
                setPartnerId(fundingPartners[0]?.id || "");
                setAmount(0);
              }}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                paymentType === "PartnerInbound"
                  ? "bg-purple-900 text-white shadow-xs"
                  : "text-purple-800 hover:text-purple-950 hover:bg-purple-100/50"
              }`}
            >
              Partner Capital Received
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paymentType === "Outward" ? (
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Select Vendor *</label>
                <select
                  value={vendorId}
                  onChange={(e) => handleVendorChange(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} (Outstanding: {formatINR(getVendorOutstanding(v.id, state))})
                    </option>
                  ))}
                </select>
              </div>
            ) : paymentType === "Inbound" ? (
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Select Customer *</label>
                <select
                  value={customerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Outstanding: {formatINR(getCustomerOutstanding(c.id, state))})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-purple-900 uppercase mb-2">Select Funding Partner *</label>
                <select
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-purple-200 p-2.5 text-sm focus:border-purple-600 focus:outline-none bg-purple-50/20 font-semibold"
                >
                  <option value="">-- Choose Partner --</option>
                  {fundingPartners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.mobile || p.email || "Partner"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                {paymentType === "Outward" ? "Disbursement Amount (₹) *" : "Receipt Amount (₹) *"}
              </label>
              <input
                type="number"
                min="1"
                required
                value={amount || ""}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none font-extrabold text-lg"
              />
              {paymentType === "Outward" && vendorId && (
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Current total liability for this supplier is {formatINR(getVendorOutstanding(vendorId, state))}
                </span>
              )}
              {paymentType === "Inbound" && customerId && (
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Current outstanding receivable for this customer is {formatINR(getCustomerOutstanding(customerId, state))}
                </span>
              )}
              {paymentType === "PartnerInbound" && partnerId && (
                <span className="text-[10px] text-purple-700 mt-1 block">
                  Capital investment received will be automatically credited to partner equity & funding ledger.
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-gray-600 uppercase">
                  Received By (Representative) *
                </label>
                {isCustomRep ? (
                  <button
                    type="button"
                    onClick={() => setIsCustomRep(false)}
                    className="text-[11px] text-emerald-700 hover:underline font-bold cursor-pointer"
                  >
                    Select from directory
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomRep(true);
                      setReceivedBy("");
                    }}
                    className="text-[11px] text-emerald-700 hover:underline font-bold cursor-pointer"
                  >
                    + Enter New Representative
                  </button>
                )}
              </div>
              {isCustomRep ? (
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="Enter representative name..."
                  required
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none font-bold text-gray-800 bg-white"
                />
              ) : (
                <select
                  value={receivedBy}
                  onChange={(e) => {
                    if (e.target.value === "__NEW_REP__") {
                      setIsCustomRep(true);
                      setReceivedBy("");
                    } else {
                      setReceivedBy(e.target.value);
                    }
                  }}
                  required
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none font-bold text-gray-800 bg-emerald-50/20 cursor-pointer"
                >
                  <option value="">-- Select Representative --</option>
                  {receivedByOptions.map((rep) => (
                    <option key={rep} value={rep}>
                      {rep}
                    </option>
                  ))}
                  <option value="__NEW_REP__">+ Enter New Representative...</option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                required
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none font-semibold text-gray-700"
              >
                <option value="Bank Transfer">Bank Transfer (IMPS/NEFT)</option>
                <option value="UPI">UPI Payment</option>
                <option value="Cash">Cash (Cash Box)</option>
                <option value="Cheque">Bank Cheque</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Transaction Ref / Cheque No *</label>
              <input
                type="text"
                required
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="UTR, IMPS-ID, Chq-662211, UPI-99"
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Payment Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Payment Notes & Memo</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record any bank details, payment receipts, or partial settlement explanations..."
              rows={3}
              className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingPayment(null);
              }}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-800 hover:bg-[#002f1d] text-[#f9f6f0] rounded-lg text-sm font-bold shadow-sm cursor-pointer"
            >
              {editingPayment
                ? "Update Payment & Representative"
                : paymentType === "Outward"
                ? "Post Payment Out & Settle Bills"
                : paymentType === "Inbound"
                ? "Receive Customer Payment"
                : "Receive Partner Capital Investment"}
            </button>
          </div>
        </form>
      )}

      {/* Viewing Payment Voucher Detail */}
      {viewingPayment && (
        <div className="space-y-4 max-w-2xl mx-auto my-6">
          <div className="no-print bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between gap-3">
            <button
              onClick={() => setViewingPayment(null)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
            >
              <ArrowLeft size={14} /> Back to List
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
              >
                <Printer size={14} /> Print
              </button>
              <button
                onClick={() => handleDownloadPDF(viewingPayment)}
                disabled={isDownloading}
                className="px-4 py-2 bg-emerald-800 hover:bg-[#002f1d] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors disabled:opacity-50"
              >
                <Download size={14} /> {isDownloading ? "Generating PDF..." : "Download PDF"}
              </button>
            </div>
          </div>

          <div ref={printRef} className="printable-area bg-white p-8 rounded-xl border border-gray-100 shadow-sm space-y-6 text-gray-900">
            {/* Voucher Header */}
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
                  {viewingPayment.customerId ? "RECEIPT VOUCHER" : "PAYMENT VOUCHER"}
                </span>
                <p className="text-sm font-black text-gray-900 font-mono">{viewingPayment.paymentNumber}</p>
                <p className="text-xs text-gray-500 mt-1">Date: <span className="font-bold text-gray-800">{formatDate(viewingPayment.date)}</span></p>
                <p className="text-xs text-gray-500">Method: <span className="font-bold text-gray-800">{viewingPayment.paymentMethod}</span></p>
                <p className="text-xs text-gray-500 mt-0.5">Received By: <span className="font-extrabold text-emerald-800">{viewingPayment.receivedBy || "Vishal Kumar"}</span></p>
              </div>
            </div>

            {/* Voucher Body */}
            {(() => {
              const party = viewingPayment.customerId
                ? state.parties.find((p) => p.id === viewingPayment.customerId)
                : viewingPayment.vendorId
                ? state.parties.find((p) => p.id === viewingPayment.vendorId)
                : null;

              return (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">
                        {viewingPayment.customerId ? "RECEIVED FROM" : "PAID TO"}
                      </span>
                      <p className="font-bold text-gray-900 text-sm">{party?.name || "Direct Account Payee"}</p>
                      <p className="text-gray-600 mt-0.5 whitespace-pre-line">{party?.address || "Address N/A"}</p>
                      {party?.gstin && <p className="text-gray-600 font-mono mt-1">GSTIN: {party.gstin}</p>}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">PAYMENT DETAILS</span>
                      <p className="text-gray-700">Ref / Cheque #: <span className="font-bold text-gray-900 font-mono">{viewingPayment.referenceNumber || "N/A"}</span></p>
                      <p className="text-gray-700 mt-1">Received By Rep: <span className="font-bold text-emerald-800">{viewingPayment.receivedBy || "Vishal Kumar"}</span></p>
                      <p className="text-gray-700 mt-1">Voucher ID: <span className="font-bold text-gray-500 font-mono">{viewingPayment.id}</span></p>
                    </div>
                  </div>

                  <div className="border rounded-lg p-6 bg-emerald-50/40 border-emerald-100 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Amount Received / Paid</p>
                      <p className="text-2xl font-black text-[#002f1d] font-mono mt-1">{formatINR(viewingPayment.amount)}</p>
                      <p className="text-xs text-gray-600 italic mt-1 font-serif">
                        Amount in words: <span className="font-semibold text-gray-900">{numberToIndianWords(viewingPayment.amount)}</span>
                      </p>
                    </div>
                  </div>

                  {viewingPayment.notes && (
                    <div className="p-3 bg-gray-50 rounded border text-xs text-gray-600">
                      <span className="font-bold text-gray-700 block mb-0.5">Remarks / Settlement Notes:</span>
                      <span className="italic">{viewingPayment.notes}</span>
                    </div>
                  )}

                  {/* Signatures */}
                  <div className="border-t pt-8 grid grid-cols-2 gap-6 text-xs text-gray-500 mt-6">
                    <div>
                      <p className="font-bold text-gray-700">Receiver / Payee Signature</p>
                      <p className="mt-8 pt-2 border-t border-gray-300 w-48 text-[10px] text-gray-400">Sign & Stamp</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-700">For {company.name}</p>
                      <p className="mt-8 pt-2 border-t border-gray-300 w-48 ml-auto text-[10px] text-gray-400">Authorized Signatory</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Payments Log Directory */}
      {!isCreating && !viewingPayment && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-72">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search party, pay #, rep, ref..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-emerald-600 focus:outline-none bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Representative Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Received By:</span>
                <select
                  value={repFilter}
                  onChange={(e) => setRepFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-bold border border-gray-200 rounded-lg bg-white focus:outline-none"
                >
                  <option value="All">All Representatives</option>
                  {representatives.map((rep) => (
                    <option key={rep} value={rep}>
                      {rep}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type filter */}
              <div className="flex gap-1.5 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setViewTypeFilter("All")}
                  className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                    viewTypeFilter === "All"
                      ? "bg-white text-gray-900 shadow-3xs"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setViewTypeFilter("Outward")}
                  className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                    viewTypeFilter === "Outward"
                      ? "bg-white text-gray-900 shadow-3xs"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Supplier
                </button>
                <button
                  onClick={() => setViewTypeFilter("Inbound")}
                  className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                    viewTypeFilter === "Inbound"
                      ? "bg-white text-gray-900 shadow-3xs"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Customer
                </button>
                <button
                  onClick={() => setViewTypeFilter("PartnerInbound")}
                  className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                    viewTypeFilter === "PartnerInbound"
                      ? "bg-purple-100 text-purple-900 shadow-3xs font-black"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Partner
                </button>
              </div>
            </div>

            <span className="text-xs text-gray-400 font-mono">
              Total Payments: {state.payments.length}
            </span>
          </div>

          {filteredPayments.length === 0 ? (
            <p className="text-sm text-gray-500 py-12 text-center">No payment entries found matching the filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold">
                    <th className="p-4">Payment Number</th>
                    <th className="p-4">Party / Account</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Payment Date</th>
                    <th className="p-4">Received By</th>
                    <th className="p-4">Method</th>
                    <th className="p-4">Reference No</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-600">
                  {filteredPayments
                    .slice()
                    .reverse()
                    .map((pay) => {
                      const partner = pay.partnerId
                        ? fundingPartners.find((p) => p.id === pay.partnerId)
                        : null;

                      const party = pay.customerId
                        ? state.parties.find((p) => p.id === pay.customerId)
                        : pay.vendorId
                        ? state.parties.find((p) => p.id === pay.vendorId)
                        : null;

                      const isPartnerPay = Boolean(pay.partnerId || pay.type === "PartnerInbound");

                      const matchingExp = pay.expenseId
                        ? (state.factoryExpenses || []).find((e) => e.id === pay.expenseId)
                        : (state.factoryExpenses || []).find(
                            (e) => e.expenseNumber === pay.referenceNumber || pay.notes?.includes(e.expenseNumber)
                          );

                      const isFactoryExpense = Boolean(pay.expenseId || matchingExp || pay.notes?.includes("Factory Expense"));
                      const partyName =
                        partner?.name
                          ? `Partner: ${partner.name}`
                          : party?.name ||
                            matchingExp?.payeeName ||
                            (isFactoryExpense ? "Factory Expense Payee" : "Direct Account / General");

                      return (
                        <tr key={pay.id} className="hover:bg-gray-50/40">
                          <td className="p-4 font-bold text-gray-900">{pay.paymentNumber}</td>
                          <td className="p-4 font-semibold text-gray-900">
                            {partyName}
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-0.5 rounded font-semibold border text-[10px] ${
                                isPartnerPay
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : pay.customerId
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                  : isFactoryExpense
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : "bg-rose-50 text-rose-700 border-rose-100"
                              }`}
                            >
                              {isPartnerPay ? "Partner Capital" : pay.customerId ? "Receipt" : isFactoryExpense ? "Factory Expense" : "Disbursement"}
                            </span>
                          </td>
                          <td className="p-4">{formatDate(pay.date)}</td>
                          <td className="p-4 font-semibold text-gray-900">
                            <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-extrabold inline-flex items-center gap-1">
                              <User size={11} className="text-emerald-700 shrink-0" />
                              {pay.receivedBy || "Vishal Kumar"}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold border text-[10px]">
                              {pay.paymentMethod}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-gray-500">{pay.referenceNumber}</td>
                          <td className="p-4 text-right font-extrabold text-[#002f1d] font-mono text-sm">
                            {formatINR(pay.amount)}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-1.5">
                              <button
                                onClick={() => setViewingPayment(pay)}
                                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded border flex items-center justify-center gap-1 font-bold text-[10px] cursor-pointer"
                              >
                                <Eye size={13} /> View
                              </button>
                              <button
                                onClick={() => handleEditPayment(pay)}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded border border-blue-200 flex items-center justify-center gap-1 font-bold text-[10px] cursor-pointer"
                                title="Edit Payment & Representative"
                              >
                                <Edit size={13} /> Edit
                              </button>
                              <button
                                onClick={() => handleDownloadPDF(pay)}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded border border-emerald-200 flex items-center justify-center gap-1 font-bold text-[10px] cursor-pointer"
                                title="Download Receipt PDF"
                              >
                                <Download size={13} /> PDF
                              </button>
                              <button
                                onClick={() => handleDeletePayment(pay.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-100 flex items-center justify-center gap-1 font-bold text-[10px] cursor-pointer"
                                title="Delete Payment"
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
