import React, { useState } from "react";
import { ERPState } from "../types";
import { formatINR } from "../utils";
import { Receipt, Search, Download } from "lucide-react";

interface GstReportsViewProps {
  state: ERPState;
}

export default function GstReportsView({ state }: GstReportsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"GSTR1" | "GSTR2">("GSTR1");

  // --- GSTR-1 Calculations (Sales) ---
  let salesTaxableVal = 0;
  let salesCgst = 0;
  let salesSgst = 0;
  let salesIgst = 0;

  state.saleInvoices.forEach((inv) => {
    if (inv.status === "Draft") return;
    salesTaxableVal += inv.subtotal;
    salesCgst += inv.cgst;
    salesSgst += inv.sgst;
    salesIgst += inv.igst;
  });

  const totalSalesTaxCollected = salesCgst + salesSgst + salesIgst;

  // --- GSTR-2 Calculations (Purchases/ITC) ---
  let purchaseTaxableVal = 0;
  let purchaseCgst = 0;
  let purchaseSgst = 0;
  let purchaseIgst = 0;

  state.purchaseBills.forEach((bill) => {
    purchaseTaxableVal += bill.subtotal;
    purchaseCgst += bill.cgst;
    purchaseSgst += bill.sgst;
    purchaseIgst += bill.igst;
  });

  const totalPurchaseITCRecouped = purchaseCgst + purchaseSgst + purchaseIgst;

  // --- Net GST Payable ---
  const netGstPayable = totalSalesTaxCollected - totalPurchaseITCRecouped;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">GST Filing &amp; Compliance (GSTR)</h2>
          <p className="text-sm text-gray-500">Inspect outward GST liability registers (GSTR-1) and reconcile inward input tax credits (GSTR-2).</p>
        </div>
      </div>

      {/* Net GST Balance Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block">GSTR-1: Tax Collected (Liability)</span>
          <h3 className="text-xl font-extrabold text-rose-600 mt-2">{formatINR(totalSalesTaxCollected)}</h3>
          <span className="text-[10px] text-gray-400 block mt-1">Taxable turnover: {formatINR(salesTaxableVal)}</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block">GSTR-2: Input Tax Credits (Assets)</span>
          <h3 className="text-xl font-extrabold text-emerald-700 mt-2">{formatINR(totalPurchaseITCRecouped)}</h3>
          <span className="text-[10px] text-gray-400 block mt-1">Accrued on purchases: {formatINR(purchaseTaxableVal)}</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs">
          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block">Net Cash GST Payable / Refund</span>
          <h3 className={`text-xl font-black mt-2 ${netGstPayable >= 0 ? "text-indigo-800" : "text-emerald-700"}`}>
            {formatINR(Math.abs(netGstPayable))} {netGstPayable >= 0 ? "Payable" : "Carry Forward Credit"}
          </h3>
          <span className="text-[10px] text-gray-400 block mt-1">Eligible for adjustment on GST portal</span>
        </div>
      </div>

      {/* GST RECONCILIATION TABS */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="border-b flex justify-between items-center px-4 bg-gray-50/50">
          <div className="flex gap-4 font-semibold text-xs py-1.5">
            <button
              onClick={() => setActiveSubTab("GSTR1")}
              className={`pb-2.5 pt-1 border-b-2 cursor-pointer ${
                activeSubTab === "GSTR1" ? "border-emerald-800 text-gray-900 font-bold" : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              GSTR-1 Outward Sales Ledger
            </button>
            <button
              onClick={() => setActiveSubTab("GSTR2")}
              className={`pb-2.5 pt-1 border-b-2 cursor-pointer ${
                activeSubTab === "GSTR2" ? "border-emerald-800 text-gray-900 font-bold" : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              GSTR-2 Inward Purchase ITC Ledger
            </button>
          </div>
        </div>

        {/* GSTR-1 REGISTER */}
        {activeSubTab === "GSTR1" && (
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-gray-700">Outward B2B Sales Tax Registers (18% and 9%+9% rates)</span>
            </div>

            {state.saleInvoices.filter((inv) => inv.status !== "Draft").length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">No outward sales invoice logs found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold">
                      <th className="p-3">Invoice No</th>
                      <th className="p-3">Buyer GSTIN</th>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-right">Taxable Value (₹)</th>
                      <th className="p-3 text-right">CGST (9%)</th>
                      <th className="p-3 text-right">SGST (9%)</th>
                      <th className="p-3 text-right">IGST (18%)</th>
                      <th className="p-3 text-right">Invoice Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-gray-600">
                    {state.saleInvoices
                      .filter((inv) => inv.status !== "Draft")
                      .map((inv) => {
                      const customer = state.parties.find((p) => p.id === inv.customerId);
                      return (
                        <tr key={inv.id} className="hover:bg-gray-50/40">
                          <td className="p-3 font-bold text-gray-900">{inv.invoiceNumber}</td>
                          <td className="p-3 font-mono">{customer?.gstin || "URD (Unregistered)"}</td>
                          <td className="p-3">{inv.date}</td>
                          <td className="p-3 text-right font-mono">{formatINR(inv.subtotal)}</td>
                          <td className="p-3 text-right font-mono text-gray-500">{formatINR(inv.cgst)}</td>
                          <td className="p-3 text-right font-mono text-gray-500">{formatINR(inv.sgst)}</td>
                          <td className="p-3 text-right font-mono text-gray-500">{formatINR(inv.igst)}</td>
                          <td className="p-3 text-right font-bold text-gray-900 font-mono">{formatINR(inv.totalAmount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* GSTR-2 REGISTER */}
        {activeSubTab === "GSTR2" && (
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-gray-700">Inward Purchase ITC Registers (Eligible Inputs)</span>
            </div>

            {state.purchaseBills.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">No inward purchase bills logged.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold">
                      <th className="p-3">Bill/Invoice No</th>
                      <th className="p-3">Supplier GSTIN</th>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-right">Assessable Value (₹)</th>
                      <th className="p-3 text-right">Input CGST</th>
                      <th className="p-3 text-right">Input SGST</th>
                      <th className="p-3 text-right">Input IGST</th>
                      <th className="p-3 text-right">Bill Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-gray-600">
                    {state.purchaseBills.map((bill) => {
                      const vendor = state.parties.find((p) => p.id === bill.vendorId);
                      return (
                        <tr key={bill.id} className="hover:bg-gray-50/40">
                          <td className="p-3 font-bold text-gray-900">{bill.billNumber}</td>
                          <td className="p-3 font-mono">{vendor?.gstin || "URD"}</td>
                          <td className="p-3">{bill.date}</td>
                          <td className="p-3 text-right font-mono">{formatINR(bill.subtotal)}</td>
                          <td className="p-3 text-right font-mono text-gray-500">{formatINR(bill.cgst)}</td>
                          <td className="p-3 text-right font-mono text-gray-500">{formatINR(bill.sgst)}</td>
                          <td className="p-3 text-right font-mono text-gray-500">{formatINR(bill.igst)}</td>
                          <td className="p-3 text-right font-bold text-gray-900 font-mono">{formatINR(bill.totalAmount)}</td>
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
    </div>
  );
}
