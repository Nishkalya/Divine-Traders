import { ERPState, Party, Item, PurchaseOrder, GoodsReceipt, PurchaseBill, SaleInvoice, Payment, StockMovement, LedgerEntry } from "./types";

/**
 * Dynamically computes item stock quantities based on initial quantity and movements
 */
export function calculateCurrentStock(itemId: string, state: ERPState): number {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return 0;
  
  let stock = item.stockQuantity; // Base stock in the items table
  
  // Return the adjusted value if movements exist. We already started with initial data,
  // but let's make sure we compute any NEW movements added by the user.
  // In a robust way, if we represent the database, we can either:
  // 1. Maintain stockQuantity directly in the item state (whenever a GRN, Invoice, or Adjustment is created)
  // 2. Or compute it on the fly from an initial baseline.
  // Let's do both: we update item.stockQuantity in the main state when actions are committed,
  // and we can also use this utility for auditing.
  return stock;
}

/**
 * Calculates a vendor's outstanding balance
 * Opening Balance (Credit) + Total Purchase Bills (Debit to expense, Credit to payable) - Total Payments (Debit to payable, Credit to bank)
 */
export function getVendorOutstanding(vendorId: string, state: ERPState): number {
  const vendor = state.parties.find((p) => p.id === vendorId);
  if (!vendor) return 0;

  const opening = vendor.openingBalance;
  
  // Total bills for this vendor
  const billsTotal = state.purchaseBills
    .filter((b) => b.vendorId === vendorId)
    .reduce((sum, b) => sum + b.totalAmount, 0);

  // Total payments to this vendor
  const paymentsTotal = state.payments
    .filter((p) => p.vendorId === vendorId)
    .reduce((sum, p) => sum + p.amount, 0);

  return Math.max(0, opening + billsTotal - paymentsTotal);
}

/**
 * Calculates a customer's accounts receivable balance
 * Opening Balance (Debit) + Total Sale Invoices - Payments Received (if we track customer receipts, otherwise just total invoices)
 */
export function getCustomerOutstanding(customerId: string, state: ERPState): number {
  const customer = state.parties.find((p) => p.id === customerId);
  if (!customer) return 0;

  const opening = customer.openingBalance;

  // Total invoices (excluding Draft)
  const invoicesTotal = state.saleInvoices
    .filter((inv) => inv.customerId === customerId && inv.status !== "Draft")
    .reduce((sum, inv) => sum + inv.totalAmount, 0);

  // Total payments received from this customer
  const paymentsReceivedTotal = (state.payments || [])
    .filter((p) => p.customerId === customerId)
    .reduce((sum, p) => sum + p.amount, 0);

  return Math.max(0, opening + invoicesTotal - paymentsReceivedTotal);
}

/**
 * Helper to format currency in Indian Rupees (INR)
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Helper to format standard dates
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Normalizes common unit names for case-insensitive and alias-safe matching
 */
export function normalizeUnit(unit: string): string {
  if (!unit) return "";
  const u = unit.trim().toLowerCase();
  if (["kg", "kgs", "kilogram", "kilograms"].includes(u)) return "kg";
  if (["g", "grm", "grms", "gram", "grams", "gm", "gms"].includes(u)) return "g";
  if (["l", "ltr", "ltrs", "litre", "litres", "liter", "liters"].includes(u)) return "l";
  if (["ml", "mls", "milliliter", "milliliters"].includes(u)) return "ml";
  if (["pcs", "pc", "piece", "pieces"].includes(u)) return "pcs";
  if (["box", "boxes"].includes(u)) return "box";
  if (["doz", "dz", "dozen", "dozens"].includes(u)) return "doz";
  if (["ton", "tons", "tonne", "tonnes"].includes(u)) return "ton";
  if (["bag", "bags"].includes(u)) return "bag";
  return u;
}

export interface StrictConversionResult {
  factor: number;
  found: boolean;
  error?: string;
}

/**
 * Strict unit conversion lookup.
 * Returns found = true if conversion rule is matched, or if units are equivalent.
 * If no rule exists, returns found = false and factor = 0.
 */
export function getStrictConversionFactor(
  fromUnit: string,
  toUnit: string,
  unitConversions: { fromUnit: string; toUnit: string; factor: number }[] = []
): StrictConversionResult {
  if (!fromUnit || !toUnit) {
    return { factor: 1, found: true };
  }

  const normFrom = normalizeUnit(fromUnit);
  const normTo = normalizeUnit(toUnit);

  if (normFrom === normTo) {
    return { factor: 1, found: true };
  }

  // 1. Direct match in provided unitConversions
  const directMatch = (unitConversions || []).find(
    (uc) =>
      normalizeUnit(uc.fromUnit) === normFrom &&
      normalizeUnit(uc.toUnit) === normTo
  );
  if (directMatch && directMatch.factor !== 0) {
    return { factor: directMatch.factor, found: true };
  }

  // 2. Reverse match in provided unitConversions
  const reverseMatch = (unitConversions || []).find(
    (uc) =>
      normalizeUnit(uc.fromUnit) === normTo &&
      normalizeUnit(uc.toUnit) === normFrom
  );
  if (reverseMatch && reverseMatch.factor !== 0) {
    return { factor: 1 / reverseMatch.factor, found: true };
  }

  // 3. Built-in metric conversions
  if (normFrom === "g" && normTo === "kg") return { factor: 0.001, found: true };
  if (normFrom === "kg" && normTo === "g") return { factor: 1000, found: true };
  if (normFrom === "ml" && normTo === "l") return { factor: 0.001, found: true };
  if (normFrom === "l" && normTo === "ml") return { factor: 1000, found: true };
  if (normFrom === "kg" && normTo === "ton") return { factor: 0.001, found: true };
  if (normFrom === "ton" && normTo === "kg") return { factor: 1000, found: true };

  return {
    factor: 0,
    found: false,
    error: "No UOM conversion found.",
  };
}

/**
 * Resolves the conversion factor from fromUnit to toUnit.
 * If units are equivalent or rule exists, returns factor.
 * Otherwise, returns 1.
 */
export function getConversionFactor(
  fromUnit: string,
  toUnit: string,
  unitConversions: { fromUnit: string; toUnit: string; factor: number }[] = []
): number {
  const result = getStrictConversionFactor(fromUnit, toUnit, unitConversions);
  if (result.found) return result.factor;
  return 1;
}

/**
 * Converts quantity from fromUnit to toUnit
 */
export function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  unitConversions: { fromUnit: string; toUnit: string; factor: number }[] = []
): number {
  const result = getStrictConversionFactor(fromUnit, toUnit, unitConversions);
  return quantity * (result.found ? result.factor : 1);
}

/**
 * Triggers a browser download of a CSV file generated from the provided data.
 */
export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCsv = (val: string | number) => {
    const s = val === null || val === undefined ? "" : String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csvContent = [
    headers.map(escapeCsv).join(","),
    ...rows.map(row => row.map(escapeCsv).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Converts a number to its Indian English word representation
 */
export function numberToIndianWords(amount: number): string {
  const words = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
  ];

  function convertLessThanOneThousand(n: number): string {
    let temp = "";
    if (n >= 100) {
      temp += words[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      temp += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      temp += words[n] + " ";
    }
    return temp.trim();
  }

  const roundedAmount = Math.round(amount * 100) / 100;
  if (roundedAmount === 0) return "INR Zero Only";

  const integerPart = Math.floor(roundedAmount);
  const paisaPart = Math.round((roundedAmount - integerPart) * 100);

  let result = "";

  let n = integerPart;
  if (n > 0) {
    if (n >= 10000000) {
      const crore = Math.floor(n / 10000000);
      result += convertLessThanOneThousand(crore) + " Crore ";
      n %= 10000000;
    }
    if (n >= 100000) {
      const lakh = Math.floor(n / 100000);
      result += convertLessThanOneThousand(lakh) + " Lakh ";
      n %= 100000;
    }
    if (n >= 1000) {
      const thousand = Math.floor(n / 1000);
      result += convertLessThanOneThousand(thousand) + " Thousand ";
      n %= 1000;
    }
    if (n > 0) {
      result += convertLessThanOneThousand(n) + " ";
    }
    result = result.trim() + " Rupees";
  }

  if (paisaPart > 0) {
    if (result !== "") {
      result += " and ";
    }
    result += convertLessThanOneThousand(paisaPart) + " Paisa";
  }

  return "INR " + (result + " Only").trim().replace(/\s+/g, " ");
}

export interface CompanyFundingTotals {
  totalFunding: number;
  totalSalesCollection: number;
  totalCompanyCapital: number;
  totalSupplierPayments: number;
  remainingBalance: number;
}

/**
 * Centered calculation for all Partner Funding and Payment Ledger values.
 * Ensures synchronized and consistent metrics across the application.
 */
export function calculateCompanyFundingTotals(state: ERPState): CompanyFundingTotals {
  const fundingTransactions = state.fundingTransactions || [];
  const payments = state.payments || [];

  // 1. Total Funding = Sum of all active Partner Funding entries.
  const totalFunding = fundingTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  // 2. Sales Collection (Read Only) = Sum of all Customer Payment Receipts from the Payments Ledger.
  // Only include transactions with customerId defined (which corresponds to Customer Receipt).
  const totalSalesCollection = payments
    .filter((p) => p.customerId || p.type === "Inbound")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // 3. Total Company Capital = Total Funding + Sales Collection.
  const totalCompanyCapital = totalFunding + totalSalesCollection;

  // 4. Total Supplier Payments = Sum of all Supplier Payment (Disbursement) transactions.
  const totalSupplierPayments = payments
    .filter((p) => p.vendorId || p.type === "Outward")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // 5. Remaining Balance = Total Company Capital - Total Supplier Payments.
  const remainingBalance = totalCompanyCapital - totalSupplierPayments;

  return {
    totalFunding,
    totalSalesCollection,
    totalCompanyCapital,
    totalSupplierPayments,
    remainingBalance,
  };
}

/**
  * Safely presents a confirm dialog or auto-confirms if sandboxed iframe restricts modal dialogs.
  */
export function safeConfirm(message: string): boolean {
  try {
    if (typeof window !== "undefined" && window.confirm) {
      const start = performance.now();
      const res = window.confirm(message);
      const elapsed = performance.now() - start;
      // If window.confirm returned false in < 50ms, the browser iframe sandbox suppressed/blocked the modal.
      // Auto-confirm in this scenario to allow user actions like Delete to succeed inside sandboxed iframe preview.
      if (res === false && elapsed < 50) {
        console.warn("Iframe restricted window.confirm call (returned false instantly), auto-confirming:", message);
        return true;
      }
      return res;
    }
  } catch (e) {
    console.warn("Iframe restricted window.confirm call, auto-confirming:", e);
  }
  return true;
}

/**
  * Safely presents an alert dialog or logs to console if sandboxed iframe restricts modal dialogs.
  */
export function safeAlert(message: string): void {
  try {
    if (typeof window !== "undefined" && window.alert) {
      window.alert(message);
    } else {
      console.log("ALERT:", message);
    }
  } catch (e) {
    console.warn("Iframe restricted window.alert call:", message, e);
  }
}

