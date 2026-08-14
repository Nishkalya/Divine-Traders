export interface Party {
  id: string;
  name: string;
  type: "Customer" | "Vendor" | "Both";
  email: string;
  phone: string;
  address: string;
  headOfficeAddress?: string;
  otherAddress?: string;
  gstin: string;
  openingBalance: number;
}

export interface Item {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  purchasePrice: number;
  salePrice: number;
  stockQuantity: number;
  unit: string; // Base Unit
  purchaseUnit?: string;
  salesUnit?: string;
  minStockLevel: number;
  item_tax_type?: "GST" | "NON_GST";
  hsnCode?: string | null;
  gstRate?: number;
  warehouseStocks?: Record<string, number>;
}

export interface PurchaseOrderItem {
  itemId: string;
  name: string;
  quantity: number;
  rate: number;
  amount: number;
  taxRate?: number;
  unit?: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  vendorId: string;
  date: string;
  status: "Draft" | "Approved" | "Partially Received" | "Received" | "Closed";
  items: PurchaseOrderItem[];
  totalAmount: number;
  notes: string;
  warehouseId?: string;
}

export interface GoodsReceiptItem {
  itemId: string;
  name: string;
  quantityReceived: number;
  unit?: string;
  stockQuantityReceived?: number;
  rate?: number;
}

export interface GoodsReceipt {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  date: string;
  items: GoodsReceiptItem[];
  receivedBy: string;
  notes: string;
  warehouseId?: string;
}

export interface PurchaseBill {
  id: string;
  billNumber: string;
  vendorId: string;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
  date: string;
  dueDate: string;
  subtotal: number;
  cgst: number; // 9% usually
  sgst: number; // 9% usually
  igst: number; // 18% if out of state
  totalAmount: number;
  status: "Unpaid" | "Partially Paid" | "Paid";
  paidAmount: number;
  invoiceType?: "GST" | "NON_GST";
  warehouseId?: string;
}

export interface SaleInvoiceItem {
  itemId: string;
  name: string;
  quantity: number;
  rate: number;
  amount: number;
  taxRate?: number;
  unit?: string;
}

export interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  date: string;
  items: SaleInvoiceItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  notes: string;
  status?: "Draft" | "Posted" | "Paid" | "Partial" | "Unpaid" | "Cancelled" | "Returned";
  paidAmount?: number;
  assignee?: string;
  warehouseId?: string;
}

export interface PurchaseReturnItem {
  itemId: string;
  name: string;
  quantity: number;
  rate: number;
  amount: number;
  taxRate?: number;
  unit?: string;
}

export interface PurchaseReturn {
  id: string;
  returnNumber: string;
  purchaseOrderId?: string;
  purchaseBillId?: string;
  vendorId: string;
  date: string;
  items: PurchaseReturnItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  notes: string;
  status: "Draft" | "Returned";
  warehouseId?: string;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  date: string;
  vendorId?: string;
  customerId?: string;
  partnerId?: string;
  expenseId?: string;
  type?: "Outward" | "Inbound" | "PartnerInbound";
  amount: number;
  paymentMethod: "Cash" | "Bank Transfer" | "Cheque" | "UPI";
  referenceNumber: string;
  notes: string;
  receivedBy?: string;
  warehouseId?: string;
}

export interface StockMovement {
  id: string;
  date: string;
  itemId: string;
  type: "In" | "Out" | "Adjustment";
  quantity: number;
  referenceType: "GRN" | "Sale Invoice" | "Adjustment" | "Opening" | "Stock Transfer" | "Purchase Return" | "Production" | "Sales Return";
  referenceId: string;
  notes: string;
  warehouseId?: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  partyId?: string; // can be blank for direct ledger accounts like Stock / Cash
  partyName: string;
  type: "Debit" | "Credit";
  amount: number;
  accountType: "Cash" | "Bank" | "Stock" | "Purchase" | "Sales" | "Tax" | "Accounts Receivable" | "Accounts Payable";
  referenceType: "Invoice" | "Bill" | "Payment" | "GRN" | "Adjustment" | "Purchase Return" | "Sales Return";
  referenceId: string;
  notes: string;
}

export interface FactoryExpenseItem {
  particulars: string;
  quantity: number;
  rate: number;
  amount: number;
  taxRate?: number;
}

export interface FactoryExpense {
  id: string;
  expenseNumber: string; // e.g. EXP-00001
  category: "Electricity" | "Factory Rent" | "Machinery Repair" | "Labor Charges" | "Packaging Materials" | "Fuel / Diesel" | "Maintenance" | "Utilities" | "Other Overhead";
  payeeName: string;
  payeeAddress?: string;
  vendorId?: string;
  invoiceNumber?: string;
  date: string;
  dueDate: string;
  items?: FactoryExpenseItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  paidAmount: number;
  status: "Unpaid" | "Partially Paid" | "Paid";
  notes?: string;
  warehouseId?: string;
}

export interface TeamMemberPermissions {
  dashboard: boolean;
  sales: boolean;
  purchaseOrders: boolean;
  purchaseReturns: boolean;
  goodsReceipts: boolean;
  purchaseBills: boolean;
  vendorOutstanding: boolean;
  customerOutstanding: boolean;
  payments: boolean;
  itemsStock: boolean;
  stockInventory: boolean;
  addItem: boolean;
  stockMovement: boolean;
  parties: boolean;
  reports: boolean;
  gstReports: boolean;
  ledger: boolean;
  adminUsers: boolean;
  production: boolean;
  companyFunding?: boolean;
  factoryExpenses?: boolean;
  dataBackup?: boolean;
  backupView?: boolean;
  backupExport?: boolean;
  backupRestore?: boolean;
}

export interface ProductionRun {
  id: string;
  batchNumber: string;
  productName: string;
  quantity: number;
  startDate: string;
  endDate?: string;
  status: "Scheduled" | "In Progress" | "Completed";
  notes?: string;
}

export interface TeamMemberActions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  print: boolean;
  export: boolean;
}

export interface ModulePermissionActions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
  print: boolean;
}

export interface UserRole {
  id: string;
  name: string;
  description: string;
  isSystem?: boolean;
  modulePermissions?: Record<string, ModulePermissionActions>;
  createdAt?: string;
}

export interface UserActivityLog {
  id: string;
  timestamp: string;
  userName: string;
  userEmail: string;
  role: string;
  action: string;
  module: string;
  details: string;
  ipAddress?: string;
  status: "Success" | "Failed" | "Warning";
}

export interface UserLoginHistory {
  id: string;
  timestamp: string;
  userName: string;
  userEmail: string;
  role: string;
  loginMethod: string;
  ipAddress: string;
  deviceInfo: string;
  status: "Success" | "Failed";
}

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "Admin" | "Accountant" | "Sales" | "Purchase" | "Store" | "Production" | string;
  status: "Active" | "Inactive";
  permissions: TeamMemberPermissions;
  actions?: TeamMemberActions;
  modulePermissions?: Record<string, ModulePermissionActions>;
  createdAt: string;
  password?: string;
  lastLogin?: string;
  allowedWarehouseIds?: string[];
}

export interface CompanyProfile {
  name: string;
  description: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
  headOfficeAddress?: string;
  logoUrl?: string;
  signatureUrl?: string;
  stampUrl?: string;
  bankName: string;
  bankBranch: string;
  accountNumber: string;
  ifscCode: string;
  accountName: string;
}

export interface UnitConversion {
  id: string;
  fromUnit: string;
  toUnit: string;
  factor: number; // Base Quantity = Invoice Quantity * factor
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string;
  status: "Active" | "Inactive";
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  date: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  itemId: string;
  quantity: number;
  notes: string;
}

export interface FundingPartner {
  id: string; // "partner-1", "partner-2", "partner-3"
  name: string;
  mobile: string;
  email: string;
}

export interface FundingTransaction {
  id: string;
  date: string;
  partnerId: string; // references partner-1, partner-2, partner-3
  amount: number;
  paymentMethod: "Cash" | "Bank Transfer" | "Cheque" | "UPI";
  referenceNumber: string;
  notes: string;
}

export interface BackupLog {
  id: string;
  date: string;
  time: string;
  size: string; // e.g. "12 KB"
  filename: string;
  type: "Auto" | "Manual" | "One-Click";
  data: string; // JSON string of the state
  createdBy?: string;
  databaseVersion?: string;
  status?: string;
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  frequency: "Daily" | "Weekly" | "Monthly";
  lastAutoBackupAt?: string;
}

export interface ERPState {
  parties: Party[];
  items: Item[];
  purchaseOrders: PurchaseOrder[];
  purchaseReturns: PurchaseReturn[];
  goodsReceipts: GoodsReceipt[];
  purchaseBills: PurchaseBill[];
  saleInvoices: SaleInvoice[];
  payments: Payment[];
  stockMovements: StockMovement[];
  ledger: LedgerEntry[];
  teamMembers?: TeamMember[];
  productionRuns?: ProductionRun[];
  allowNegativeStock?: boolean;
  companyProfile?: CompanyProfile;
  unitConversions?: UnitConversion[];
  customCategories?: string[];
  customUnits?: string[];
  salesAssigneeName?: string;
  salesAssignees?: string[];
  warehouses?: Warehouse[];
  stockTransfers?: StockTransfer[];
  fundingPartners?: FundingPartner[];
  fundingTransactions?: FundingTransaction[];
  backups?: BackupLog[];
  backupSettings?: BackupSettings;
  factoryExpenses?: FactoryExpense[];
  roles?: UserRole[];
  activityLogs?: UserActivityLog[];
  loginHistory?: UserLoginHistory[];
}
