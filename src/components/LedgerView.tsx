import React, { useState } from "react";
import { ERPState, LedgerEntry, FactoryExpense } from "../types";
import { formatINR, formatDate } from "../utils";
import { Landmark, Search, Layers, Columns, Trash2 } from "lucide-react";

interface LedgerViewProps {
  state: ERPState;
  onUpdateState?: (newState: ERPState) => void;
  prefillSearchTerm?: string;
  clearPrefill?: () => void;
}

export default function LedgerView({ state, onUpdateState, prefillSearchTerm, clearPrefill }: LedgerViewProps) {
  const [searchTerm, setSearchTerm] = useState(prefillSearchTerm || "");
  const [selectedAccount, setSelectedAccount] = useState<string>("All");

  React.useEffect(() => {
    if (prefillSearchTerm) {
      setSearchTerm(prefillSearchTerm);
      if (clearPrefill) {
        clearPrefill();
      }
    }
  }, [prefillSearchTerm, clearPrefill]);

  // Get list of unique account names
  const accountTypesSet = new Set<string>();
  state.ledger.forEach((item) => {
    accountTypesSet.add(item.accountType);
  });
  const accountTypesList = Array.from(accountTypesSet);

  // Filter entries
  const filteredLedger = state.ledger.filter((entry) => {
    const matchesAccount = selectedAccount === "All" || entry.accountType === selectedAccount;
    const term = (searchTerm || "").toLowerCase();
    const matchesSearch =
      (entry.partyName || "").toLowerCase().includes(term) ||
      (entry.notes || "").toLowerCase().includes(term) ||
      (entry.referenceId || "").toLowerCase().includes(term);
    return matchesAccount && matchesSearch;
  });

  // Calculate Running Balances precisely for the filtered account list
  // Note: Debit increases Asset/Expense. Credit increases Liability/Revenue/Equity.
  let cumulativeBalance = 0;
  const ledgerWithBalances = filteredLedger
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((entry) => {
      // Determine sign based on accountType
      const isAssetOrExpense = [
        "Bank",
        "Cash",
        "Accounts Receivable",
        "Purchase",
        "Tax",
        "Factory Expense",
      ].includes(entry.accountType);

      if (isAssetOrExpense) {
        cumulativeBalance += entry.type === "Debit" ? entry.amount : -entry.amount;
      } else {
        // Liabilities & Revenues: Credits increase balance, Debits decrease it
        cumulativeBalance += entry.type === "Credit" ? entry.amount : -entry.amount;
      }

      return {
        ...entry,
        runningBalance: cumulativeBalance,
        balanceType: isAssetOrExpense
          ? cumulativeBalance >= 0
            ? "Dr"
            : "Cr"
          : cumulativeBalance >= 0
          ? "Cr"
          : "Dr",
      };
    });

  const handleDeleteLedgerEntry = (entry: LedgerEntry) => {
    if (!onUpdateState) return;
    if (
      !confirm(
        `Are you sure you want to delete ledger posting ${entry.referenceId} (${formatINR(
          entry.amount
        )})? This will revert associated payment records and REOPEN unpaid bill balances.`
      )
    ) {
      return;
    }

    const matchingPayment = state.payments.find(
      (p) => p.id === entry.referenceId || p.paymentNumber === entry.referenceId
    );

    let updatedPayments = state.payments;
    let updatedLedger = state.ledger.filter((l) => l.id !== entry.id);

    if (matchingPayment) {
      updatedPayments = state.payments.filter((p) => p.id !== matchingPayment.id);
      updatedLedger = updatedLedger.filter(
        (l) =>
          !(
            l.referenceType === "Payment" &&
            (l.referenceId === matchingPayment.id || l.referenceId === matchingPayment.paymentNumber)
          )
      );
    }

    let updatedInvoices = state.saleInvoices;
    let updatedBills = state.purchaseBills;

    if (matchingPayment?.customerId) {
      const customerId = matchingPayment.customerId;
      const otherCustomerPayments = updatedPayments
        .filter((p) => p.customerId === customerId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const otherInvoices = state.saleInvoices.filter((inv) => inv.customerId !== customerId);
      const customerInvoicesToAllocate = state.saleInvoices
        .filter((inv) => inv.customerId === customerId)
        .map((inv) => {
          if (inv.status === "Draft") return inv;
          return { ...inv, paidAmount: 0, status: "Posted" as const };
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

    if (matchingPayment?.vendorId) {
      const vendorId = matchingPayment.vendorId;
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

    // Always recalculate Factory Expenses to reopen bills if payment/ledger entry was deleted
    const currentExpenses = state.factoryExpenses || [];
    const updatedExpenses = currentExpenses.map((e) => {
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
      saleInvoices: updatedInvoices,
      purchaseBills: updatedBills,
      factoryExpenses: updatedExpenses,
      ledger: updatedLedger,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Double-Entry General Ledger</h2>
          <p className="text-sm text-gray-500">Inspect full audit journals, reconcile balance sheets, and audit transactional double-entry offset legs.</p>
        </div>
      </div>

      {/* Account Directory Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedAccount("All")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              selectedAccount === "All"
                ? "bg-indigo-50 text-indigo-800 border border-indigo-100"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent"
            }`}
          >
            All Ledger Accounts
          </button>
          {accountTypesList.map((acc) => (
            <button
              key={acc}
              onClick={() => setSelectedAccount(acc)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                selectedAccount === acc
                  ? "bg-indigo-50 text-indigo-800 border border-indigo-100"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent"
              }`}
            >
              {acc}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <Search size={15} />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search memo, party, reference..."
            className="w-full pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-emerald-600 focus:outline-none bg-white"
          />
        </div>
      </div>

      {/* Ledger Journal Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {ledgerWithBalances.length === 0 ? (
          <p className="text-sm text-gray-500 py-12 text-center">No ledger journal postings found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold">
                  <th className="p-4">Date</th>
                  <th className="p-4">Journal Account</th>
                  <th className="p-4">Counterparty Leg</th>
                  <th className="p-4">Offset Reference</th>
                  <th className="p-4 text-right">Debit (Dr) (₹)</th>
                  <th className="p-4 text-right">Credit (Cr) (₹)</th>
                  <th className="p-4 text-right">Cumulative Balance (₹)</th>
                  {onUpdateState && <th className="p-4 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-600">
                {ledgerWithBalances.slice().reverse().map((entry) => {
                  const isDebit = entry.type === "Debit";
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50/40">
                      <td className="p-4 font-mono text-gray-400">{formatDate(entry.date)}</td>
                      <td className="p-4 font-bold text-gray-900">
                        {entry.accountType}
                        <span className="block text-[10px] text-gray-400 font-normal italic mt-0.5 max-w-xs truncate">
                          {entry.notes}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-gray-800">{entry.partyName}</td>
                      <td className="p-4 font-mono text-gray-400">
                        <span className="text-[9px] uppercase font-bold tracking-widest block text-gray-400">{entry.referenceType}</span>
                        <span className="text-indigo-800 font-bold">{entry.referenceId}</span>
                      </td>
                      <td className="p-4 text-right font-bold text-emerald-800 font-mono text-sm">
                        {isDebit ? formatINR(entry.amount) : "—"}
                      </td>
                      <td className="p-4 text-right font-bold text-rose-600 font-mono text-sm">
                        {!isDebit ? formatINR(entry.amount) : "—"}
                      </td>
                      <td className="p-4 text-right font-extrabold text-gray-900 font-mono text-sm">
                        {formatINR(Math.abs(entry.runningBalance))}
                        <span className="text-[10px] text-gray-400 font-semibold ml-1">
                          {entry.balanceType}
                        </span>
                      </td>
                      {onUpdateState && (
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDeleteLedgerEntry(entry)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-100 font-bold text-[10px] cursor-pointer inline-flex items-center gap-1 transition-all"
                            title="Delete ledger entry & reopen unpaid bill balances"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
