import React, { useState } from "react";
import { ERPState, FactoryExpense, FactoryExpenseItem, Payment, LedgerEntry } from "../types";
import { formatINR, formatDate } from "../utils";
import {
  Plus,
  Search,
  Eye,
  Wallet,
  AlertTriangle,
  FileText,
  Printer,
  Trash2,
  CheckCircle,
  Clock,
  Building2,
  DollarSign,
  X,
  ChevronDown,
  ArrowRight,
  Sparkles,
  Calendar,
  Layers,
  Filter,
  MapPin
} from "lucide-react";

interface FactoryExpensesViewProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  prefillExpenseId?: string | null;
  clearPrefill?: () => void;
}

export default function FactoryExpensesView({
  state,
  onUpdateState,
  prefillExpenseId,
  clearPrefill
}: FactoryExpensesViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");

  // Modals
  const [isCreatingBill, setIsCreatingBill] = useState(false);
  const [isDisbursing, setIsDisbursing] = useState(false);
  const [viewingExpense, setViewingExpense] = useState<FactoryExpense | null>(null);

  // Disbursement Form State
  const [disburseExpenseId, setDisburseExpenseId] = useState<string>("");
  const [disburseAmount, setDisburseAmount] = useState<number>(0);
  const [disburseSearchTerm, setDisburseSearchTerm] = useState<string>("");
  const [isDisburseDropdownOpen, setIsDisburseDropdownOpen] = useState<boolean>(false);
  const [disburseMethod, setDisburseMethod] = useState<"Cash" | "Bank Transfer" | "Cheque" | "UPI">("Bank Transfer");
  const [disburseRefNo, setDisburseRefNo] = useState<string>("");
  const [disburseDate, setDisburseDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [disburseNotes, setDisburseNotes] = useState<string>("");

  // Create Bill Form State
  const [category, setCategory] = useState<FactoryExpense["category"]>("Electricity");
  const [payeeName, setPayeeName] = useState("");
  const [payeeAddress, setPayeeAddress] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split("T")[0];
  });
  const [warehouseId, setWarehouseId] = useState(state.warehouses?.[0]?.id || "wh-main");
  const [isInterstate, setIsInterstate] = useState(false);
  const [items, setItems] = useState<FactoryExpenseItem[]>([
    { particulars: "Monthly Factory Power Overhead", quantity: 1, rate: 25000, amount: 25000, taxRate: 18 }
  ]);
  const [initialPaidAmount, setInitialPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];
  const factoryExpenses = state.factoryExpenses || [];

  // Open prefilled expense or disbursement modal if needed
  React.useEffect(() => {
    if (prefillExpenseId) {
      const exp = factoryExpenses.find((e) => e.id === prefillExpenseId);
      if (exp) {
        openDisburseModal(exp);
      }
      if (clearPrefill) clearPrefill();
    }
  }, [prefillExpenseId, clearPrefill]);

  // Calculated Metrics
  const totalBillsCount = factoryExpenses.length;
  const totalExpenseAmount = factoryExpenses.reduce((sum, e) => sum + e.totalAmount, 0);
  const totalPaidAmount = factoryExpenses.reduce((sum, e) => sum + e.paidAmount, 0);
  const totalOutstanding = Math.max(0, totalExpenseAmount - totalPaidAmount);

  // Overdue calculations
  const overdueExpenses = factoryExpenses.filter((e) => {
    const remaining = Math.max(0, e.totalAmount - (e.paidAmount || 0));
    return remaining > 0 && e.status !== "Paid" && e.dueDate < todayStr;
  });
  const totalOverdueAmount = overdueExpenses.reduce((sum, e) => sum + Math.max(0, e.totalAmount - (e.paidAmount || 0)), 0);

  // Filtered list
  const filteredExpenses = factoryExpenses.filter((e) => {
    const term = (searchTerm || "").toLowerCase();
    const matchesSearch =
      (e.expenseNumber || "").toLowerCase().includes(term) ||
      (e.payeeName || "").toLowerCase().includes(term) ||
      (e.invoiceNumber && e.invoiceNumber.toLowerCase().includes(term)) ||
      (e.category || "").toLowerCase().includes(term);

    const matchesCategory = selectedCategory === "All" || e.category === selectedCategory;

    const remaining = Math.max(0, e.totalAmount - (e.paidAmount || 0));
    const isOverdue = remaining > 0 && e.status !== "Paid" && e.dueDate < todayStr;

    let matchesStatus = true;
    if (selectedStatus === "Overdue") matchesStatus = isOverdue;
    else if (selectedStatus === "Unpaid") matchesStatus = e.status === "Unpaid" && !isOverdue;
    else if (selectedStatus === "Partially Paid") matchesStatus = e.status === "Partially Paid";
    else if (selectedStatus === "Paid") matchesStatus = e.status === "Paid";

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Calculate bill item totals
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  items.forEach((item) => {
    const rate = item.taxRate || 0;
    const itemAmount = item.quantity * item.rate;
    if (rate > 0) {
      if (isInterstate) {
        igst += (itemAmount * rate) / 100;
      } else {
        cgst += (itemAmount * (rate / 2)) / 100;
        sgst += (itemAmount * (rate / 2)) / 100;
      }
    }
  });

  const totalBillAmount = subtotal + cgst + sgst + igst;

  // Item form helpers
  const handleItemChange = (index: number, field: keyof FactoryExpenseItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    if (field === "quantity" || field === "rate") {
      item.amount = item.quantity * item.rate;
    }
    newItems[index] = item;
    setItems(newItems);
  };

  const handleAddItemRow = () => {
    setItems([...items, { particulars: "", quantity: 1, rate: 0, amount: 0, taxRate: 18 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Generate new Expense Number (EXP-00001)
  const generateExpenseNumber = () => {
    const existing = factoryExpenses.map((e) => {
      const match = e.expenseNumber.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });
    const max = existing.length > 0 ? Math.max(...existing) : 0;
    return `EXP-${String(max + 1).padStart(5, "0")}`;
  };

  // Submit Create Expense Bill
  const handleSaveExpenseBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payeeName.trim()) {
      alert("Please enter a valid Payee / Vendor name.");
      return;
    }
    if (totalBillAmount <= 0) {
      alert("Bill total must be greater than zero.");
      return;
    }

    const expNum = generateExpenseNumber();
    const paid = Math.min(initialPaidAmount, totalBillAmount);
    const balance = totalBillAmount - paid;

    let initialStatus: FactoryExpense["status"] = "Unpaid";
    if (balance <= 0) initialStatus = "Paid";
    else if (paid > 0) initialStatus = "Partially Paid";

    const newExpense: FactoryExpense = {
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      expenseNumber: expNum,
      category,
      payeeName,
      payeeAddress: payeeAddress.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      date: billDate,
      dueDate,
      items,
      subtotal,
      cgst,
      sgst,
      igst,
      totalAmount: totalBillAmount,
      paidAmount: paid,
      status: initialStatus,
      notes,
      warehouseId
    };

    let updatedPayments = [...state.payments];
    let updatedLedger = [...state.ledger];

    // Ledger Entry for Expense Creation
    const expenseLedgerEntry: LedgerEntry = {
      id: `led-${Date.now()}-1`,
      date: billDate,
      partyName: payeeName,
      type: "Debit",
      amount: totalBillAmount,
      accountType: "Accounts Payable",
      referenceType: "Bill",
      referenceId: expNum,
      notes: `Factory Expense Bill: ${category} - ${payeeName}`
    };
    updatedLedger.push(expenseLedgerEntry);

    // Initial Payment Disbursement if provided
    if (paid > 0) {
      const pNum = `PAY-EXP-${Date.now().toString().slice(-5)}`;
      const newPayment: Payment = {
        id: `pay-${Date.now()}`,
        paymentNumber: pNum,
        date: billDate,
        type: "Outward",
        amount: paid,
        paymentMethod: "Bank Transfer",
        referenceNumber: expNum,
        notes: `Initial Payment for Factory Expense ${expNum} (${category})`
      };
      updatedPayments.push(newPayment);

      const paymentLedgerEntry: LedgerEntry = {
        id: `led-${Date.now()}-2`,
        date: billDate,
        partyName: payeeName,
        type: "Credit",
        amount: paid,
        accountType: "Bank",
        referenceType: "Payment",
        referenceId: pNum,
        notes: `Disbursement to Factory Expense ${expNum}`
      };
      updatedLedger.push(paymentLedgerEntry);
    }

    onUpdateState({
      ...state,
      factoryExpenses: [newExpense, ...factoryExpenses],
      payments: updatedPayments,
      ledger: updatedLedger
    });

    setIsCreatingBill(false);
    resetBillForm();
  };

  const resetBillForm = () => {
    setPayeeName("");
    setPayeeAddress("");
    setInvoiceNumber("");
    setItems([{ particulars: "Monthly Factory Power Overhead", quantity: 1, rate: 25000, amount: 25000, taxRate: 18 }]);
    setInitialPaidAmount(0);
    setNotes("");
  };

  // Open Disbursement Modal
  const openDisburseModal = (exp: FactoryExpense) => {
    setDisburseExpenseId(exp.id);
    setDisburseSearchTerm(`${exp.expenseNumber} - ${exp.payeeName}`);
    setIsDisburseDropdownOpen(false);
    const remaining = Math.max(0, exp.totalAmount - (exp.paidAmount || 0));
    setDisburseAmount(remaining);
    setDisburseRefNo(`TRX-${Math.floor(100000 + Math.random() * 900000)}`);
    setDisburseNotes(`Disbursement fund to ${exp.category} bill (${exp.expenseNumber})`);
    setIsDisbursing(true);
  };

  // Submit Disbursement ("DISBURSE FUND TO Factory Expenses")
  const handleExecuteDisbursement = (e: React.FormEvent) => {
    e.preventDefault();
    const exp = factoryExpenses.find((x) => x.id === disburseExpenseId);
    if (!exp) {
      alert("Please select a valid Factory Expense bill.");
      return;
    }

    const currentPaid = exp.paidAmount || 0;
    const remainingBefore = Math.max(0, exp.totalAmount - currentPaid);

    if (disburseAmount <= 0) {
      alert("Disbursement amount must be greater than zero.");
      return;
    }

    if (disburseAmount > remainingBefore + 1) {
      alert(`Disbursement amount (₹${disburseAmount}) exceeds remaining balance of ₹${remainingBefore}.`);
      return;
    }

    const updatedPaidAmount = currentPaid + disburseAmount;
    const remainingAfter = Math.max(0, exp.totalAmount - updatedPaidAmount);

    let newStatus: FactoryExpense["status"] = "Partially Paid";
    if (remainingAfter <= 0) {
      newStatus = "Paid"; // CLOSED
    }

    // Update expense record
    const updatedExpenses = factoryExpenses.map((x) => {
      if (x.id === exp.id) {
        return {
          ...x,
          paidAmount: updatedPaidAmount,
          status: newStatus
        };
      }
      return x;
    });

    // Record Outward Payment
    const pNum = `PAY-EXP-${Date.now().toString().slice(-5)}`;
    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      paymentNumber: pNum,
      date: disburseDate,
      type: "Outward",
      amount: disburseAmount,
      paymentMethod: disburseMethod,
      referenceNumber: exp.expenseNumber,
      expenseId: exp.id,
      vendorId: exp.vendorId,
      notes: disburseNotes || `Disbursed ₹${disburseAmount} to Factory Expense ${exp.expenseNumber}`
    };

    // Record Ledger Entries (Debit Expense / Payable, Credit Bank/Cash)
    const ledgerEntry: LedgerEntry = {
      id: `led-${Date.now()}`,
      date: disburseDate,
      partyName: exp.payeeName,
      type: "Credit",
      amount: disburseAmount,
      accountType: disburseMethod === "Cash" ? "Cash" : "Bank",
      referenceType: "Payment",
      referenceId: pNum,
      notes: `Disbursement to Factory Expense ${exp.expenseNumber} (${exp.category}) - Remaining Bal: ₹${remainingAfter}`
    };

    onUpdateState({
      ...state,
      factoryExpenses: updatedExpenses,
      payments: [newPayment, ...state.payments],
      ledger: [...state.ledger, ledgerEntry]
    });

    setIsDisbursing(false);
  };

  // Delete Expense
  const handleDeleteExpense = (expId: string) => {
    const exp = factoryExpenses.find((x) => x.id === expId);
    if (!exp) return;
    if (confirm(`Are you sure you want to delete Factory Expense ${exp.expenseNumber}? This cannot be undone.`)) {
      onUpdateState({
        ...state,
        factoryExpenses: factoryExpenses.filter((x) => x.id !== expId)
      });
    }
  };

  // Delete Payment / Reopen Factory Expense Bill
  const handleDeleteDisbursementPayment = (paymentId: string) => {
    const payment = state.payments.find((p) => p.id === paymentId);
    if (!payment) return;

    if (
      !confirm(
        `Are you sure you want to delete Payment ${payment.paymentNumber} of ${formatINR(
          payment.amount
        )}? This will delete the paid ledger entry and REOPEN the Factory Expense bill balance.`
      )
    ) {
      return;
    }

    const updatedPayments = state.payments.filter((p) => p.id !== paymentId);
    const updatedLedger = state.ledger.filter(
      (l) =>
        !(
          l.referenceType === "Payment" &&
          (l.referenceId === paymentId || l.referenceId === payment.paymentNumber)
        )
    );

    // Recalculate Factory Expense paid amounts and status
    const updatedExpenses = factoryExpenses.map((e) => {
      const remainingPayments = updatedPayments.filter(
        (p) =>
          p.expenseId === e.id ||
          p.referenceNumber === e.expenseNumber ||
          p.notes?.includes(e.expenseNumber)
      );
      const newPaidAmount = remainingPayments.reduce((sum, p) => sum + p.amount, 0);
      let newStatus: FactoryExpense["status"] = "Unpaid";
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
      ledger: updatedLedger,
      factoryExpenses: updatedExpenses,
    });

    if (viewingExpense) {
      const refreshed = updatedExpenses.find((x) => x.id === viewingExpense.id);
      if (refreshed) {
        setViewingExpense(refreshed);
      }
    }
  };

  const selectedDisburseExpense = factoryExpenses.find((e) => e.id === disburseExpenseId);
  const currentDisburseRemaining = selectedDisburseExpense
    ? Math.max(0, selectedDisburseExpense.totalAmount - (selectedDisburseExpense.paidAmount || 0))
    : 0;

  const openExpenses = factoryExpenses.filter((e) => e.totalAmount - (e.paidAmount || 0) > 0);
  const filteredDisburseExpenses = openExpenses.filter((e) => {
    if (!disburseSearchTerm.trim()) return true;
    const term = disburseSearchTerm.toLowerCase();
    return (
      (e.expenseNumber || "").toLowerCase().includes(term) ||
      (e.payeeName || "").toLowerCase().includes(term) ||
      (e.category || "").toLowerCase().includes(term) ||
      (e.invoiceNumber && e.invoiceNumber.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 select-none pb-12">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-[10px] uppercase tracking-wider font-mono">
              Factory Operational Ledger
            </span>
            <span className="text-xs text-slate-400 font-bold">• Module 4.2</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Building2 className="text-indigo-600" size={26} />
            Factory Expenses & Overhead
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage electricity, rent, machinery repair, labor charges, track overdue outstanding balances, and disburse funds.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              resetBillForm();
              setIsCreatingBill(true);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            <span>Create Bill Invoice</span>
          </button>
        </div>
      </div>

      {/* OVERDUE FACTORY EXPENSES ALERT BANNER (If Overdue Exists) */}
      {overdueExpenses.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border-2 border-rose-200/80 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-sm shrink-0 animate-pulse">
                <AlertTriangle size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-rose-800 uppercase tracking-widest bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200">
                    CARETA OVERDUE ALERT
                  </span>
                  <span className="text-xs font-bold text-rose-600 font-mono">
                    {overdueExpenses.length} Factory Expense{overdueExpenses.length > 1 ? "s" : ""} Overdue
                  </span>
                </div>
                <h3 className="text-lg font-black text-rose-950 mt-0.5">
                  Factory Expenses Overdue Outstanding: <span className="text-rose-700 font-mono underline decoration-rose-300">{formatINR(totalOverdueAmount)}</span>
                </h3>
                <p className="text-xs text-rose-700 font-medium mt-0.5">
                  The following bills have passed their payment due date and require immediate fund disbursement to maintain uninterrupted factory production.
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedStatus("Overdue")}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>View Overdue Bills ({overdueExpenses.length})</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Factory Expense Bills */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-3xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Expense Bills</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <FileText size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 font-mono">{totalBillsCount}</div>
            <div className="text-xs text-slate-500 font-semibold mt-0.5">
              Valued at <span className="text-slate-800 font-bold">{formatINR(totalExpenseAmount)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Disbursed Paid */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-3xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Disbursed Paid</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-700 font-mono">{formatINR(totalPaidAmount)}</div>
            <div className="text-xs text-emerald-600 font-semibold mt-0.5">
              Successfully closed factory liabilities
            </div>
          </div>
        </div>

        {/* Card 3: Total Outstanding Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-3xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Outstanding Balance</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-700 font-mono">{formatINR(totalOutstanding)}</div>
            <div className="text-xs text-amber-600 font-semibold mt-0.5">
              Pending fund disbursement
            </div>
          </div>
        </div>

        {/* Card 4: Overdue Outstanding */}
        <div className={`p-5 rounded-2xl border shadow-3xs flex flex-col justify-between ${
          totalOverdueAmount > 0 ? "bg-rose-50/80 border-rose-200 text-rose-900" : "bg-white border-slate-200/80"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-500">Overdue Outstanding</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-700 font-mono">{formatINR(totalOverdueAmount)}</div>
            <div className="text-xs text-rose-600 font-bold mt-0.5">
              {overdueExpenses.length} Overdue Factory Bill{overdueExpenses.length > 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Matrix & Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search Expense #, Payee, Bill No, Category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Electricity">Electricity</option>
              <option value="Factory Rent">Factory Rent</option>
              <option value="Machinery Repair">Machinery Repair</option>
              <option value="Labor Charges">Labor Charges</option>
              <option value="Packaging Materials">Packaging Materials</option>
              <option value="Fuel / Diesel">Fuel / Diesel</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Utilities">Utilities</option>
              <option value="Other Overhead">Other Overhead</option>
            </select>
          </div>
        </div>

        {/* Status Pill Filters */}
        <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-400 uppercase tracking-wider mr-2 text-[10px]">Filter Status:</span>
          {["All", "Overdue", "Unpaid", "Partially Paid", "Paid"].map((st) => {
            const isActive = selectedStatus === st;
            return (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all border cursor-pointer ${
                  isActive
                    ? st === "Overdue"
                      ? "bg-rose-600 text-white border-rose-600 shadow-3xs"
                      : "bg-indigo-600 text-white border-indigo-600 shadow-3xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {st === "Paid" ? "Closed / Paid" : st}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Expense Bills Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-3xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Factory Expense Registers & Invoices
            </h3>
            <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full font-mono">
              Showing {filteredExpenses.length} of {factoryExpenses.length}
            </span>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Building2 size={24} />
            </div>
            <h4 className="text-sm font-bold text-slate-700">No Factory Expense Bills Found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Click "Create Bill Invoice" above to add operational overhead bills such as power, machinery repairs, or factory rent.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3 pl-4">Expense No</th>
                  <th className="py-3 px-3">Payee / Vendor</th>
                  <th className="py-3 px-3">Address / Location</th>
                  <th className="py-3 px-3 text-center">Category</th>
                  <th className="py-3 px-3">Date / Due Date</th>
                  <th className="py-3 px-3 text-right">Bill Total</th>
                  <th className="py-3 px-3 text-right">Disbursed Paid</th>
                  <th className="py-3 px-3 text-right">Remaining Balance</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                {filteredExpenses.map((exp) => {
                  const paid = exp.paidAmount || 0;
                  const balance = Math.max(0, exp.totalAmount - paid);
                  const isOverdue = balance > 0 && exp.status !== "Paid" && exp.dueDate < todayStr;

                  return (
                    <tr
                      key={exp.id}
                      className={`hover:bg-slate-50/80 transition-colors h-[64px] ${
                        isOverdue ? "bg-rose-50/30" : ""
                      }`}
                    >
                      {/* Expense No */}
                      <td className="py-3 px-3 pl-4 align-middle">
                        <span className="font-extrabold text-indigo-600 block">{exp.expenseNumber}</span>
                        {exp.invoiceNumber && (
                          <span className="text-[10px] text-slate-400 font-mono block">Ref: {exp.invoiceNumber}</span>
                        )}
                      </td>

                      {/* Payee Name */}
                      <td className="py-3 px-3 align-middle font-bold text-slate-800 max-w-[180px] truncate" title={exp.payeeName}>
                        {exp.payeeName}
                      </td>

                      {/* Payee Address / Location */}
                      <td className="py-3 px-3 align-middle text-xs text-slate-500 max-w-[180px]" title={exp.payeeAddress || "Factory Main Unit"}>
                        <div className="flex items-center gap-1">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{exp.payeeAddress || "Factory Floor / Main Unit"}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 align-middle text-center">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {exp.category}
                        </span>
                      </td>

                      {/* Date & Due Date */}
                      <td className="py-3 px-3 align-middle text-xs">
                        <div className="font-semibold text-slate-700">{formatDate(exp.date)}</div>
                        <div className="text-[10px] font-mono mt-0.5">
                          {isOverdue ? (
                            <span className="text-rose-600 font-extrabold bg-rose-100 px-1.5 py-0.5 rounded">
                              Overdue ({formatDate(exp.dueDate)})
                            </span>
                          ) : (
                            <span className="text-slate-400">Due: {formatDate(exp.dueDate)}</span>
                          )}
                        </div>
                      </td>

                      {/* Bill Total */}
                      <td className="py-3 px-3 align-middle text-right font-black text-slate-900">
                        {formatINR(exp.totalAmount)}
                      </td>

                      {/* Disbursed Paid */}
                      <td className="py-3 px-3 align-middle text-right text-emerald-700 font-bold font-mono">
                        {formatINR(paid)}
                      </td>

                      {/* Remaining Balance (THIS AMOUNT - REMAINING BALANCE) */}
                      <td className="py-3 px-3 align-middle text-right font-mono">
                        {balance === 0 ? (
                          <span className="text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-[11px]">
                            ₹0 (CLOSED)
                          </span>
                        ) : (
                          <span className={`font-extrabold px-2 py-0.5 rounded text-[11px] ${
                            isOverdue ? "text-rose-700 bg-rose-100 border border-rose-200" : "text-amber-700 bg-amber-50 border border-amber-100"
                          }`}>
                            {formatINR(balance)}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 align-middle text-center">
                        {isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                            Overdue
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            exp.status === "Paid"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : exp.status === "Partially Paid"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}>
                            {exp.status === "Paid" ? "Closed / Paid" : exp.status}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 pr-4 align-middle text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View */}
                          <button
                            onClick={() => setViewingExpense(exp)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[11px] border border-indigo-100 cursor-pointer transition-all"
                            title="View Expense Invoice"
                          >
                            👁 View
                          </button>

                          {/* Disburse Fund (If Balance > 0) */}
                          {balance > 0 && (
                            <button
                              onClick={() => openDisburseModal(exp)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded-lg font-bold text-[11px] border border-emerald-100 hover:border-emerald-600 cursor-pointer transition-all shadow-3xs"
                              title="Disburse Fund to this Expense"
                            >
                              💰 Disburse Fund
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="px-2.5 py-1 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg font-bold text-[11px] border border-slate-200 hover:border-rose-200 cursor-pointer transition-all"
                            title="Delete Expense Record"
                          >
                            🗑
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

      {/* MODAL 1: CREATE EXPENSE BILL INVOICE */}
      {isCreatingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 border border-slate-100 my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  New Factory Bill Entry
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">Create Factory Expense Invoice</h3>
              </div>
              <button
                onClick={() => setIsCreatingBill(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExpenseBill} className="space-y-4 text-xs font-medium text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Category */}
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Expense Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Electricity">Electricity</option>
                    <option value="Factory Rent">Factory Rent</option>
                    <option value="Machinery Repair">Machinery Repair</option>
                    <option value="Labor Charges">Labor Charges</option>
                    <option value="Packaging Materials">Packaging Materials</option>
                    <option value="Fuel / Diesel">Fuel / Diesel</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Other Overhead">Other Overhead</option>
                  </select>
                </div>

                {/* Payee / Vendor Name */}
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Payee / Vendor Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MSEDCL / Divine Engineering"
                    value={payeeName}
                    onChange={(e) => setPayeeName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Payee Address / Vendor Location */}
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Payee Address / Vendor Location</label>
                  <input
                    type="text"
                    placeholder="e.g. MIDC Industrial Area, Plot 42"
                    value={payeeAddress}
                    onChange={(e) => setPayeeAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Vendor Invoice / Ref No */}
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Supplier Bill Ref No</label>
                  <input
                    type="text"
                    placeholder="e.g. BILL-9921"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Bill Date */}
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Bill Date *</label>
                  <input
                    type="date"
                    required
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Payment Due Date *</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Warehouse */}
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Warehouse / Unit</label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    {state.warehouses?.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Interstate Tax Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div>
                  <span className="font-bold text-slate-800">Interstate Supply (IGST)</span>
                  <p className="text-[10px] text-slate-400">Toggle on if vendor is outside Maharashtra (18% IGST instead of CGST+SGST)</p>
                </div>
                <input
                  type="checkbox"
                  checked={isInterstate}
                  onChange={(e) => setIsInterstate(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              {/* Items / Particulars Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-slate-800 uppercase tracking-wider text-[10px]">
                    Expense Particulars & Line Items
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    + Add Particular
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-500 font-bold text-[10px] uppercase">
                      <tr>
                        <th className="p-2.5">Particulars / Description</th>
                        <th className="p-2.5 text-center w-20">Qty</th>
                        <th className="p-2.5 text-right w-28">Rate (₹)</th>
                        <th className="p-2.5 text-center w-24">GST %</th>
                        <th className="p-2.5 text-right w-28">Amount</th>
                        <th className="p-2.5 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2">
                            <input
                              type="text"
                              required
                              placeholder="Particulars description"
                              value={item.particulars}
                              onChange={(e) => handleItemChange(idx, "particulars", e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white font-medium"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-center bg-white font-mono font-bold"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              value={item.rate}
                              onChange={(e) => handleItemChange(idx, "rate", parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-right bg-white font-mono font-bold"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={item.taxRate || 0}
                              onChange={(e) => handleItemChange(idx, "taxRate", parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-center bg-white font-bold"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>
                          <td className="p-2 text-right font-black font-mono text-slate-800">
                            {formatINR(item.amount)}
                          </td>
                          <td className="p-2 text-center">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                className="text-slate-400 hover:text-rose-600 font-bold"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Calculations Summary */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs font-semibold">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Amount:</span>
                  <span className="font-mono font-bold">{formatINR(subtotal)}</span>
                </div>
                {isInterstate ? (
                  <div className="flex justify-between text-slate-600">
                    <span>IGST Tax:</span>
                    <span className="font-mono font-bold">{formatINR(igst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST Tax:</span>
                      <span className="font-mono font-bold">{formatINR(cgst)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST Tax:</span>
                      <span className="font-mono font-bold">{formatINR(sgst)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2">
                  <span>Total Bill Amount:</span>
                  <span className="font-mono text-indigo-700">{formatINR(totalBillAmount)}</span>
                </div>
              </div>

              {/* Initial Disbursement Input (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Initial Disbursed Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    max={totalBillAmount}
                    value={initialPaidAmount}
                    onChange={(e) => setInitialPaidAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Remaining Balance: <span className="font-bold text-amber-700">{formatINR(Math.max(0, totalBillAmount - initialPaidAmount))}</span>
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">Remarks / Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Approved by Factory Manager"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreatingBill(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer shadow-sm"
                >
                  Save & Post Expense Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DISBURSE FUND TO FACTORY EXPENSES */}
      {isDisbursing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">DISBURSE FUND TO Factory Expenses</h3>
                  <p className="text-xs text-slate-400 font-medium">Record fund payment against open factory overhead bills</p>
                </div>
              </div>
              <button
                onClick={() => setIsDisbursing(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteDisbursement} className="space-y-4 text-xs font-medium text-slate-700">
              {/* Select Expense Bill with Interactive Live Search Combobox */}
              <div className="space-y-1.5 relative">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-600">Select Factory Expense Bill *</label>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {filteredDisburseExpenses.length} bill(s) available
                  </span>
                </div>

                {/* Quick Search & Select Trigger */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by bill no, payee name, or category..."
                    value={disburseSearchTerm}
                    onFocus={() => setIsDisburseDropdownOpen(true)}
                    onChange={(e) => {
                      setDisburseSearchTerm(e.target.value);
                      setIsDisburseDropdownOpen(true);
                    }}
                    className="w-full pl-8 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-500 focus:bg-white transition-all placeholder:font-normal placeholder:text-slate-400"
                  />
                  {disburseSearchTerm ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDisburseSearchTerm("");
                        setIsDisburseDropdownOpen(true);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  ) : (
                    <ChevronDown
                      size={14}
                      onClick={() => setIsDisburseDropdownOpen(!isDisburseDropdownOpen)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                    />
                  )}
                </div>

                {/* Searchable Options List */}
                {isDisburseDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 space-y-1">
                    {filteredDisburseExpenses.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 italic text-[11px]">
                        No matching unpaid factory expense bills found
                      </div>
                    ) : (
                      filteredDisburseExpenses.map((e) => {
                        const rem = Math.max(0, e.totalAmount - (e.paidAmount || 0));
                        const isSelected = e.id === disburseExpenseId;
                        return (
                          <div
                            key={e.id}
                            onClick={() => {
                              setDisburseExpenseId(e.id);
                              setDisburseAmount(rem);
                              setDisburseSearchTerm(`${e.expenseNumber} - ${e.payeeName}`);
                              setIsDisburseDropdownOpen(false);
                            }}
                            className={`p-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between text-xs ${
                              isSelected
                                ? "bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold"
                                : "hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900">{e.expenseNumber}</span>
                                <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">{e.category}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium">
                                Payee: <span className="font-semibold text-slate-700">{e.payeeName}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-slate-400">Outstanding</div>
                              <div className="font-mono font-bold text-amber-700">{formatINR(rem)}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Selected Bill Balance Card */}
              {selectedDisburseExpense && (
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-4 rounded-2xl space-y-2 shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-indigo-300 uppercase tracking-widest font-extrabold">
                      {selectedDisburseExpense.expenseNumber} • {selectedDisburseExpense.category}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
                      Due: {formatDate(selectedDisburseExpense.dueDate)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-white/10 pt-2">
                    <div>
                      <div className="text-[10px] text-slate-300">Total Bill Amount</div>
                      <div className="text-sm font-bold font-mono">{formatINR(selectedDisburseExpense.totalAmount)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-emerald-300">Already Paid</div>
                      <div className="text-sm font-bold font-mono text-emerald-400">{formatINR(selectedDisburseExpense.paidAmount)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-amber-300 font-extrabold uppercase">REMAINING BALANCE</div>
                      <div className="text-lg font-black font-mono text-amber-400">
                        {formatINR(currentDisburseRemaining)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Disbursement Amount */}
              <div>
                <label className="block font-bold text-slate-600 mb-1">Disbursement Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={currentDisburseRemaining}
                  value={disburseAmount}
                  onChange={(e) => setDisburseAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-black text-slate-900 text-base font-mono focus:outline-none focus:border-indigo-500"
                />
                <div className="flex items-center justify-between text-[11px] font-bold mt-1.5 px-1">
                  <span className="text-slate-400">THIS AMOUNT - REMAINING BALANCE:</span>
                  <span className={`font-mono ${
                    currentDisburseRemaining - disburseAmount <= 0 ? "text-emerald-600 font-black" : "text-amber-600 font-extrabold"
                  }`}>
                    {formatINR(Math.max(0, currentDisburseRemaining - disburseAmount))}
                    {currentDisburseRemaining - disburseAmount <= 0 ? " (CLOSED & FULLY PAID)" : " (REMAINING)"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Payment Method */}
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Payment Method *</label>
                  <select
                    value={disburseMethod}
                    onChange={(e) => setDisburseMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="Cash">Cash Account</option>
                    <option value="UPI">UPI Payment</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Disbursement Date *</label>
                  <input
                    type="date"
                    required
                    value={disburseDate}
                    onChange={(e) => setDisburseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Ref Number */}
              <div>
                <label className="block font-bold text-slate-600 mb-1">Transaction Ref / Cheque / UTR No</label>
                <input
                  type="text"
                  placeholder="e.g. UTR882910283"
                  value={disburseRefNo}
                  onChange={(e) => setDisburseRefNo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-600 mb-1">Disbursement Remarks / Ledger Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Factory cash disbursement for power tariff"
                  value={disburseNotes}
                  onChange={(e) => setDisburseNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsDisbursing(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle size={16} />
                  <span>Confirm Fund Disbursement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW / PRINT EXPENSE INVOICE */}
      {viewingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 border border-slate-100 space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Factory Expense Voucher
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-0.5">{viewingExpense.expenseNumber}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Print Voucher</span>
                </button>
                <button
                  onClick={() => setViewingExpense(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Company & Voucher Header */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-base">{state.companyProfile?.name || "DIVINE TRADERS"}</h4>
                  <p className="text-slate-500 max-w-xs">{state.companyProfile?.address}</p>
                  <p className="text-slate-500 font-mono mt-0.5">GSTIN: {state.companyProfile?.gstin}</p>
                </div>
                <div className="text-right">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Expense Category</div>
                  <div className="font-black text-indigo-700 text-sm">{viewingExpense.category}</div>
                  <div className="text-slate-500 font-mono mt-1">Date: {formatDate(viewingExpense.date)}</div>
                  <div className="text-rose-600 font-mono font-bold">Due Date: {formatDate(viewingExpense.dueDate)}</div>
                </div>
              </div>

              {/* Payee Info */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex justify-between items-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Payee / Vendor Name</span>
                  <span className="font-black text-slate-800 text-sm">{viewingExpense.payeeName}</span>
                  {viewingExpense.payeeAddress && (
                    <div className="flex items-center gap-1 text-slate-500 text-[11px] mt-0.5 font-medium">
                      <MapPin size={11} className="text-slate-400 shrink-0" />
                      <span>{viewingExpense.payeeAddress}</span>
                    </div>
                  )}
                  {viewingExpense.invoiceNumber && (
                    <span className="text-slate-500 font-mono text-[11px] block mt-0.5">Supplier Bill Ref: {viewingExpense.invoiceNumber}</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    viewingExpense.status === "Paid"
                      ? "bg-emerald-100 text-emerald-800"
                      : viewingExpense.status === "Partially Paid"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    {viewingExpense.status}
                  </span>
                </div>
              </div>

              {/* Particulars Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-500 font-bold text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">Particulars</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Rate</th>
                      <th className="p-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {(viewingExpense.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-bold text-slate-800">{it.particulars}</td>
                        <td className="p-2.5 text-center font-mono">{it.quantity}</td>
                        <td className="p-2.5 text-right font-mono">{formatINR(it.rate)}</td>
                        <td className="p-2.5 text-right font-black font-mono text-slate-900">{formatINR(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600 font-semibold">
                  <span>Subtotal Amount:</span>
                  <span className="font-mono">{formatINR(viewingExpense.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-semibold">
                  <span>GST Taxes Total:</span>
                  <span className="font-mono">{formatINR(viewingExpense.cgst + viewingExpense.sgst + viewingExpense.igst)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-2">
                  <span>Total Expense Bill:</span>
                  <span className="font-mono text-indigo-700">{formatINR(viewingExpense.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-xs font-extrabold text-emerald-700 pt-1">
                  <span>Disbursed Paid Amount:</span>
                  <span className="font-mono">{formatINR(viewingExpense.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-xs font-black text-amber-700 border-t border-slate-200/80 pt-1">
                  <span>Remaining Balance:</span>
                  <span className="font-mono font-black">{formatINR(Math.max(0, viewingExpense.totalAmount - viewingExpense.paidAmount))}</span>
                </div>
              </div>

              {/* Disbursement Payment History */}
              {(() => {
                const expensePayments = state.payments.filter(
                  (p) =>
                    p.expenseId === viewingExpense.id ||
                    p.referenceNumber === viewingExpense.expenseNumber ||
                    p.notes?.includes(viewingExpense.expenseNumber)
                );
                return (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-slate-700 tracking-wider">
                        Disbursement Payment History ({expensePayments.length})
                      </span>
                      {expensePayments.length > 0 && (
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          {formatINR(expensePayments.reduce((s, p) => s + p.amount, 0))} Total Disbursed
                        </span>
                      )}
                    </div>
                    {expensePayments.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">No disbursement payments recorded for this expense bill.</p>
                    ) : (
                      <div className="space-y-1.5 pt-1">
                        {expensePayments.map((pay) => (
                          <div key={pay.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs shadow-3xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 font-mono">{pay.paymentNumber}</span>
                                <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">{pay.paymentMethod}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 block font-mono">{formatDate(pay.date)} • Ref: {pay.referenceNumber}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-black font-mono text-emerald-700">{formatINR(pay.amount)}</span>
                              <button
                                onClick={() => handleDeleteDisbursementPayment(pay.id)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold border border-rose-200 cursor-pointer flex items-center gap-1"
                                title="Delete payment record & reopen bill"
                              >
                                <Trash2 size={12} />
                                Reopen Bill
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {viewingExpense.notes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 text-[11px] text-slate-600">
                  <span className="font-bold block text-slate-400 uppercase text-[9px]">Notes / Remarks</span>
                  {viewingExpense.notes}
                </div>
              )}

              {/* Signature Block */}
              <div className="pt-8 flex justify-between items-end text-[11px] font-bold text-slate-500">
                <div>
                  <div className="border-t border-slate-300 w-36 pt-1 text-center">Prepared By</div>
                </div>
                <div>
                  <div className="border-t border-slate-300 w-40 pt-1 text-center">Factory Manager Signature</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
