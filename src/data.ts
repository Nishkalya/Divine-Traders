import { ERPState, Party, Item, PurchaseOrder, GoodsReceipt, PurchaseBill, SaleInvoice, Payment, StockMovement, LedgerEntry, TeamMember, Warehouse, StockTransfer, FactoryExpense, UserRole } from "./types";

// Helper to generate IDs
const uuid = () => Math.random().toString(36).substring(2, 9);

export const INITIAL_PARTIES: Party[] = [];

export const INITIAL_ITEMS: Item[] = [];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [];

export const INITIAL_GOODS_RECEIPTS: GoodsReceipt[] = [];

export const INITIAL_PURCHASE_BILLS: PurchaseBill[] = [];

export const INITIAL_SALE_INVOICES: SaleInvoice[] = [];

export const INITIAL_PAYMENTS: Payment[] = [];

export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [];

export const INITIAL_LEDGER: LedgerEntry[] = [];

export const INITIAL_FACTORY_EXPENSES: FactoryExpense[] = [
  {
    id: "exp-001",
    expenseNumber: "EXP-00001",
    category: "Electricity",
    payeeName: "MSEDCL Power Distribution Ltd",
    invoiceNumber: "BILL-2026-8812",
    date: "2026-06-10",
    dueDate: "2026-06-25",
    items: [
      { particulars: "Factory High Tension Industrial Power tariff", quantity: 1, rate: 40000, amount: 40000, taxRate: 18 }
    ],
    subtotal: 40000,
    cgst: 3600,
    sgst: 3600,
    igst: 0,
    totalAmount: 47200,
    paidAmount: 20000,
    status: "Partially Paid",
    notes: "Overdue monthly factory power bill",
    warehouseId: "wh-main"
  },
  {
    id: "exp-002",
    expenseNumber: "EXP-00002",
    category: "Machinery Repair",
    payeeName: "Divine Engineering Works",
    invoiceNumber: "DEW-INV-992",
    date: "2026-07-02",
    dueDate: "2026-07-16",
    items: [
      { particulars: "Granulator Belt Repair & Alignment Service", quantity: 1, rate: 15000, amount: 15000, taxRate: 18 }
    ],
    subtotal: 15000,
    cgst: 1350,
    sgst: 1350,
    igst: 0,
    totalAmount: 17700,
    paidAmount: 0,
    status: "Unpaid",
    notes: "Urgent conveyor overhaul",
    warehouseId: "wh-main"
  }
];

export const INITIAL_TEAM_MEMBERS: TeamMember[] = [
  {
    id: "tm-super-2",
    userId: "Vishal",
    name: "Vishal Kumar (Admin)",
    email: "vishal291137@gmail.com",
    role: "Admin",
    status: "Active",
    permissions: {
      dashboard: true,
      sales: true,
      purchaseOrders: true,
      purchaseReturns: true,
      goodsReceipts: true,
      purchaseBills: true,
      vendorOutstanding: true,
      customerOutstanding: true,
      payments: true,
      itemsStock: true,
      stockInventory: true,
      addItem: true,
      stockMovement: true,
      parties: true,
      reports: true,
      gstReports: true,
      ledger: true,
      adminUsers: true,
      production: true,
      companyFunding: true,
      factoryExpenses: true,
      dataBackup: true,
    },
    actions: {
      view: true,
      create: true,
      edit: true,
      delete: true,
      print: true,
      export: true,
    },
    createdAt: "2026-01-15",
    password: "1234",
  }
];

export const INITIAL_PRODUCTION_RUNS: any[] = [];

export const INITIAL_UNIT_CONVERSIONS = [
  { id: "uc-1", fromUnit: "kg", toUnit: "g", factor: 1000 },
  { id: "uc-2", fromUnit: "g", toUnit: "kg", factor: 0.001 },
  { id: "uc-3", fromUnit: "L", toUnit: "ml", factor: 1000 },
  { id: "uc-4", fromUnit: "ml", toUnit: "L", factor: 0.001 },
  { id: "uc-5", fromUnit: "Box", toUnit: "Piece", factor: 12 },
  { id: "uc-6", fromUnit: "Dozen", toUnit: "Piece", factor: 12 },
  { id: "uc-7", fromUnit: "GRM", toUnit: "KG", factor: 0.001 },
  { id: "uc-8", fromUnit: "KG", toUnit: "GRM", factor: 1000 },
  { id: "uc-9", fromUnit: "ML", toUnit: "LTR", factor: 0.001 },
  { id: "uc-10", fromUnit: "LTR", toUnit: "ML", factor: 1000 },
  { id: "uc-11", fromUnit: "PCS", toUnit: "BOX", factor: 0.08333333333333333 },
  { id: "uc-12", fromUnit: "BOX", toUnit: "PCS", factor: 12 },
];

export const INITIAL_COMPANY_PROFILE = {
  name: "DIVINE TRADERS",
  description: "Primary Distributors of Premium Grains, White Sugar, and Fortified Soyabean Oils.",
  phone: "+91 99000 88000",
  email: "billing@divinetraders.com",
  gstin: "27AAADD5522A1ZM",
  address: "123, Divine Corporate Tower, Sector 15, Vashi, Navi Mumbai, Maharashtra - 400703",
  headOfficeAddress: "456, Imperial Heights, BKC, Mumbai, Maharashtra - 400051",
  bankName: "State Bank of India",
  bankBranch: "Vashi Commercial Branch",
  accountNumber: "38291048293",
  ifscCode: "SBIN0001234",
  accountName: "DIVINE TRADERS",
};

export const INITIAL_WAREHOUSES: Warehouse[] = [
  {
    id: "wh-main",
    name: "Main Warehouse",
    code: "MWH-01",
    address: "Central Logistics Park, Sector 10, Vashi, Navi Mumbai",
    status: "Active",
  },
  {
    id: "wh-secondary",
    name: "Secondary Warehouse",
    code: "SWH-02",
    address: "MIDC Industrial Area, Taloja, Navi Mumbai",
    status: "Active",
  },
];

export const INITIAL_ROLES: UserRole[] = [
  {
    id: "role-ceo",
    name: "CEO",
    description: "Chief Executive Officer with complete top-level executive & oversight privileges.",
    isSystem: true,
    createdAt: "2026-01-01"
  },
  {
    id: "role-admin",
    name: "System Administrator",
    description: "Full administrative access across all 18 ERP modules and configuration settings.",
    isSystem: true,
    createdAt: "2026-01-01"
  },
  {
    id: "role-accountant",
    name: "Accountant & Finance",
    description: "Full access to Bills, Invoices, Ledger, GST Filings, Payments, and Factory Expenses.",
    isSystem: true,
    createdAt: "2026-01-01"
  },
  {
    id: "role-sales",
    name: "Sales Executive",
    description: "Access to Sales Invoices, Customer Outstanding, Payments, and Item Catalog.",
    isSystem: true,
    createdAt: "2026-01-01"
  },
  {
    id: "role-purchase",
    name: "Purchase Officer",
    description: "Manage Purchase Orders, GRNs, Vendor Payables, and Purchase Bills.",
    isSystem: true,
    createdAt: "2026-01-01"
  },
  {
    id: "role-store",
    name: "Storekeeper / Inventory",
    description: "Manage Warehouse Stock, Stock Transfers, GRN Receipts, and Stock Movement Logs.",
    isSystem: true,
    createdAt: "2026-01-01"
  },
  {
    id: "role-production",
    name: "Production Supervisor",
    description: "Manage Production Runs, Batch Tracking, and Stock Movement Logs.",
    isSystem: true,
    createdAt: "2026-01-01"
  }
];

export const INITIAL_ERP_STATE: ERPState = {
  parties: INITIAL_PARTIES,
  items: INITIAL_ITEMS,
  purchaseOrders: INITIAL_PURCHASE_ORDERS,
  purchaseReturns: [],
  goodsReceipts: INITIAL_GOODS_RECEIPTS,
  purchaseBills: INITIAL_PURCHASE_BILLS,
  saleInvoices: INITIAL_SALE_INVOICES,
  payments: INITIAL_PAYMENTS,
  stockMovements: INITIAL_STOCK_MOVEMENTS,
  ledger: INITIAL_LEDGER,
  teamMembers: INITIAL_TEAM_MEMBERS,
  productionRuns: INITIAL_PRODUCTION_RUNS,
  allowNegativeStock: false,
  companyProfile: INITIAL_COMPANY_PROFILE,
  unitConversions: INITIAL_UNIT_CONVERSIONS,
  warehouses: INITIAL_WAREHOUSES,
  stockTransfers: [],
  fundingPartners: [],
  fundingTransactions: [],
  factoryExpenses: INITIAL_FACTORY_EXPENSES,
  salesAssigneeName: "Vishal Kumar",
  salesAssignees: ["Vishal Kumar"],
  roles: INITIAL_ROLES,
};
