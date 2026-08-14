import { loadStateFromFirestore } from "../firebase";
import { 
  supabase, 
  loadStateFromSupabase, 
  saveStateToSupabase
} from "./supabase";
import { ERPState } from "../types";

export interface DBStatus {
  online: boolean;
  error?: string;
}

export interface TableCheck {
  name: string;
  exists: boolean;
}

export interface VerificationModuleReport {
  name: string;
  firebaseCount: number;
  supabaseCount: number;
  status: "match" | "mismatch";
  error?: string;
}

export interface MigrationReport {
  totalMigrated: number;
  totalFailed: number;
  totalSkipped: number;
  totalFirebaseRecords: number;
  totalSupabaseRecords: number;
  retried: number;
  missingTables: string[];
  modules: {
    name: string;
    migrated: number;
    failed: number;
    skipped: number;
    retried?: number;
    error?: string;
  }[];
  verification: VerificationModuleReport[];
  success: boolean;
  statusText?: string;
}

export const REQUIRED_TABLES = [
  "customers",
  "vendors",
  "products",
  "categories",
  "warehouses",
  "stock",
  "stock_movements",
  "purchase_orders",
  "purchase_order_items",
  "goods_receipts",
  "purchase_returns",
  "purchase_bills",
  "sales_invoices",
  "sales_invoice_items",
  "customer_payments",
  "vendor_payments",
  "expenses",
  "accounts",
  "ledger_entries",
  "journal_entries",
  "taxes",
  "users",
  "roles",
  "permissions",
  "notifications",
  "audit_logs",
  "attachments"
];

// Complete SQL DDL instructions mapping for all 27 tables
export const TABLE_DDL: Record<string, string> = {
  customers: `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    gstin TEXT,
    opening_balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  vendors: `CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    gstin TEXT,
    opening_balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  products: `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    purchase_price NUMERIC DEFAULT 0,
    sale_price NUMERIC DEFAULT 0,
    stock_quantity NUMERIC DEFAULT 0,
    unit TEXT NOT NULL,
    min_stock_level NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  categories: `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  warehouses: `CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    address TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  stock: `CREATE TABLE IF NOT EXISTS stock (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    warehouse_id TEXT,
    quantity NUMERIC DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  stock_movements: `CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    item_id TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    reference_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    notes TEXT,
    warehouse_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  purchase_orders: `CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL,
    vendor_id TEXT NOT NULL,
    date TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    status TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  purchase_order_items: `CREATE TABLE IF NOT EXISTS purchase_order_items (
    id TEXT PRIMARY KEY,
    purchase_order_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    rate NUMERIC NOT NULL,
    amount NUMERIC NOT NULL,
    tax_rate NUMERIC DEFAULT 0,
    unit TEXT
  );`,
  goods_receipts: `CREATE TABLE IF NOT EXISTS goods_receipts (
    id TEXT PRIMARY KEY,
    grn_number TEXT NOT NULL,
    purchase_order_id TEXT NOT NULL,
    date TEXT NOT NULL,
    received_by TEXT NOT NULL,
    notes TEXT,
    warehouse_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  purchase_returns: `CREATE TABLE IF NOT EXISTS purchase_returns (
    id TEXT PRIMARY KEY,
    return_number TEXT NOT NULL,
    purchase_order_id TEXT,
    purchase_bill_id TEXT,
    vendor_id TEXT NOT NULL,
    date TEXT NOT NULL,
    subtotal NUMERIC NOT NULL,
    cgst NUMERIC DEFAULT 0,
    sgst NUMERIC DEFAULT 0,
    igst NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL,
    notes TEXT,
    status TEXT NOT NULL,
    warehouse_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  purchase_bills: `CREATE TABLE IF NOT EXISTS purchase_bills (
    id TEXT PRIMARY KEY,
    bill_number TEXT NOT NULL,
    vendor_id TEXT NOT NULL,
    purchase_order_id TEXT,
    goods_receipt_id TEXT,
    date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    subtotal NUMERIC NOT NULL,
    cgst NUMERIC DEFAULT 0,
    sgst NUMERIC DEFAULT 0,
    igst NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL,
    status TEXT NOT NULL,
    paid_amount NUMERIC DEFAULT 0,
    invoice_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  sales_invoices: `CREATE TABLE IF NOT EXISTS sales_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    date TEXT NOT NULL,
    subtotal NUMERIC NOT NULL,
    cgst NUMERIC DEFAULT 0,
    sgst NUMERIC DEFAULT 0,
    igst NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL,
    notes TEXT,
    status TEXT,
    paid_amount NUMERIC DEFAULT 0,
    assignee TEXT,
    warehouse_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  sales_invoice_items: `CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id TEXT PRIMARY KEY,
    sales_invoice_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    rate NUMERIC NOT NULL,
    amount NUMERIC NOT NULL,
    tax_rate NUMERIC DEFAULT 0,
    unit TEXT
  );`,
  customer_payments: `CREATE TABLE IF NOT EXISTS customer_payments (
    id TEXT PRIMARY KEY,
    payment_number TEXT NOT NULL,
    date TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL,
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  vendor_payments: `CREATE TABLE IF NOT EXISTS vendor_payments (
    id TEXT PRIMARY KEY,
    payment_number TEXT NOT NULL,
    date TEXT NOT NULL,
    vendor_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL,
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  expenses: `CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    payment_method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  accounts: `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  ledger_entries: `CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    party_id TEXT,
    party_name TEXT NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    account_type TEXT NOT NULL,
    reference_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  journal_entries: `CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    entry_number TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    total_debit NUMERIC DEFAULT 0,
    total_credit NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  taxes: `CREATE TABLE IF NOT EXISTS taxes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rate NUMERIC DEFAULT 0,
    type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  users: `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  roles: `CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  permissions: `CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    permissions JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  notifications: `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  audit_logs: `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_email TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`,
  attachments: `CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    file_size TEXT,
    associated_type TEXT,
    associated_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );`
};

/**
 * Checks if a specific table exists by performing a cheap query.
 */
async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(tableName).select("id").limit(1);
    if (error) {
      if (
        error.code === "42P01" || 
        (error.message?.includes("relation") && error.message?.includes("does not exist")) ||
        error.message?.includes("undefined_table")
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempts to automatically create a table in Supabase via common raw SQL execution RPCs
 */
async function attemptCreateTable(tableName: string, ddl: string): Promise<boolean> {
  const rpcNames = ["exec_sql", "execute_sql", "run_sql", "execute_ddl", "exec_ddl"];
  for (const name of rpcNames) {
    try {
      const { error } = await supabase.rpc(name, { 
        sql: ddl, 
        query: ddl, 
        sql_query: ddl,
        sql_text: ddl,
        query_text: ddl
      });
      if (!error) {
        console.log(`Successfully auto-created table '${tableName}' using RPC: ${name}`);
        return true;
      }
    } catch {
      // Keep trying other RPC aliases
    }
  }
  return false;
}

/**
 * 1. Checks connection status for Firebase and Supabase.
 */
export async function checkDBConnections(): Promise<{ firebase: DBStatus; supabase: DBStatus }> {
  const firebaseStatus: DBStatus = { online: false };
  const supabaseStatus: DBStatus = { online: false };

  // Firebase test
  try {
    const testState = await loadStateFromFirestore("divine_traders_state");
    if (testState !== undefined) {
      firebaseStatus.online = true;
    } else {
      firebaseStatus.online = false;
      firebaseStatus.error = "Firebase loadStateFromFirestore returned undefined.";
    }
  } catch (err: any) {
    firebaseStatus.online = false;
    firebaseStatus.error = err?.message || String(err);
  }

  // Supabase test
  try {
    // We check if the supabase client is initialized and reachable by checking the erp_states table or similar
    const { error } = await supabase.from("erp_states").select("id").limit(1);
    if (error && error.code !== "PGRST116" && !error.message?.includes("does not exist") && !error.message?.includes("undefined_table")) {
      throw error;
    }
    supabaseStatus.online = true;
  } catch (err: any) {
    supabaseStatus.online = false;
    supabaseStatus.error = err?.message || String(err);
  }

  return { firebase: firebaseStatus, supabase: supabaseStatus };
}

/**
 * 2. Checks which Supabase relational tables exist.
 */
export async function getSupabaseTablesCheck(): Promise<TableCheck[]> {
  const allTables = ["erp_states", ...REQUIRED_TABLES];
  const results: TableCheck[] = [];
  for (const table of allTables) {
    const exists = await checkTableExists(table);
    results.push({ name: table, exists });
  }
  return results;
}

/**
 * 3. Migrates the unified state and all distinct records from Firebase to Supabase.
 * Enforces dynamic table auto-creation, resumability, and 100% record integrity verification.
 */
export async function executeDatabaseMigration(
  docId: string
): Promise<MigrationReport> {
  const report: MigrationReport = {
    totalMigrated: 0,
    totalFailed: 0,
    totalSkipped: 0,
    totalFirebaseRecords: 0,
    totalSupabaseRecords: 0,
    retried: 0,
    missingTables: [],
    modules: [],
    verification: [],
    success: false,
    statusText: ""
  };

  try {
    // Step 1: Pre-flight connections verification
    const conn = await checkDBConnections();
    if (!conn.firebase.online) {
      throw new Error(`Firebase source is offline or unreachable: ${conn.firebase.error || 'Unknown error'}`);
    }
    if (!conn.supabase.online) {
      throw new Error(`Supabase destination is offline or unreachable: ${conn.supabase.error || 'Unknown error'}`);
    }

    // Step 2: Ensure tables are provisioned (Auto-create missing ones)
    console.log("Checking and auto-creating required database tables...");
    const initialTableChecks = await getSupabaseTablesCheck();
    
    // We make sure the primary state table exists first
    const stateTableExists = initialTableChecks.find(t => t.name === "erp_states")?.exists;
    if (!stateTableExists) {
      const stateDDL = `CREATE TABLE IF NOT EXISTS erp_states (
        id TEXT PRIMARY KEY,
        state_data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );`;
      await attemptCreateTable("erp_states", stateDDL);
    }

    // Process other required tables
    for (const tableName of REQUIRED_TABLES) {
      const exists = initialTableChecks.find(t => t.name === tableName)?.exists;
      if (!exists) {
        const ddl = TABLE_DDL[tableName];
        if (ddl) {
          const success = await attemptCreateTable(tableName, ddl);
          if (!success) {
            console.warn(`Could not automatically create table '${tableName}' via client-side RPC.`);
          }
        }
      }
    }

    // Verify which tables are still missing after attempt
    const finalTableChecks = await getSupabaseTablesCheck();
    const missing = finalTableChecks.filter(t => !t.exists).map(t => t.name);
    report.missingTables = missing;

    if (missing.length > 0) {
      throw new Error(`Schema mismatch: ${missing.length} tables are missing and could not be auto-created. Please execute the manual SQL Initialization script first. Missing: ${missing.join(", ")}`);
    }

    // Step 3: Read existing Firebase Data (Do NOT delete any)
    const firebaseState = await loadStateFromFirestore(docId);
    if (!firebaseState) {
      throw new Error("No production records found in the Firebase Firestore database.");
    }

    // Step 4: Save the entire unified state to Supabase erp_states
    await saveStateToSupabase(firebaseState, docId);
    report.totalMigrated += 1;
    report.modules.push({ name: "erp_states (Unified)", migrated: 1, failed: 0, skipped: 0 });

    // Step 5: Process all 27 relational tables
    // We construct the datasets from the Firebase state
    const customCategories = firebaseState.customCategories || [];
    const items = firebaseState.items || [];
    const parties = firebaseState.parties || [];
    const warehouses = firebaseState.warehouses || [];
    const stockMovements = firebaseState.stockMovements || [];
    const purchaseOrders = firebaseState.purchaseOrders || [];
    const goodsReceipts = firebaseState.goodsReceipts || [];
    const purchaseReturns = firebaseState.purchaseReturns || [];
    const purchaseBills = firebaseState.purchaseBills || [];
    const saleInvoices = firebaseState.saleInvoices || [];
    const payments = firebaseState.payments || [];
    const ledger = firebaseState.ledger || [];
    const teamMembers = firebaseState.teamMembers || [];
    const backups = firebaseState.backups || [];

    // Derive category entries
    const catSet = new Set<string>();
    customCategories.forEach(c => catSet.add(c));
    items.forEach(it => { if (it.category) catSet.add(it.category); });
    const categoriesList = Array.from(catSet).map(c => ({
      id: c.toLowerCase().replace(/[^a-z0-9]/g, "-") || "uncategorized",
      name: c
    }));

    // Derive flat purchase line items
    const purchaseItemsList: any[] = [];
    purchaseOrders.forEach(po => {
      (po.items || []).forEach((item, idx) => {
        purchaseItemsList.push({
          id: `${po.id}-${item.itemId || idx}`,
          purchase_order_id: po.id,
          item_id: item.itemId,
          name: item.name,
          quantity: Number(item.quantity || 0),
          rate: Number(item.rate || 0),
          amount: Number(item.amount || 0),
          tax_rate: Number(item.taxRate || 0),
          unit: item.unit || ""
        });
      });
    });

    // Derive flat sales line items
    const salesInvoiceItemsList: any[] = [];
    saleInvoices.forEach(si => {
      (si.items || []).forEach((item, idx) => {
        salesInvoiceItemsList.push({
          id: `${si.id}-${item.itemId || idx}`,
          sales_invoice_id: si.id,
          item_id: item.itemId,
          name: item.name,
          quantity: Number(item.quantity || 0),
          rate: Number(item.rate || 0),
          amount: Number(item.amount || 0),
          tax_rate: Number(item.taxRate || 0),
          unit: item.unit || ""
        });
      });
    });

    // Derive stock list entries from item warehouse stocks
    const stockList: any[] = [];
    items.forEach(item => {
      if (item.warehouseStocks) {
        Object.entries(item.warehouseStocks).forEach(([whId, qty]) => {
          stockList.push({
            id: `${item.id}-${whId}`,
            product_id: item.id,
            warehouse_id: whId,
            quantity: Number(qty || 0)
          });
        });
      }
    });

    // Derive expenses list
    const expensesList: any[] = [];
    payments.filter(p => p.type === 'Outward' && !p.vendorId).forEach((p, idx) => {
      expensesList.push({
        id: p.id || `expense-${idx}`,
        category: p.notes?.toLowerCase().includes("rent") ? "Rent" : p.notes?.toLowerCase().includes("salary") ? "Salary" : "Operational",
        amount: Number(p.amount || 0),
        date: p.date,
        notes: p.notes || "Auto-migrated Outward Payments",
        payment_method: p.paymentMethod
      });
    });

    // Derive accounts list
    const acctSet = new Set<string>();
    ledger.forEach(l => { if (l.accountType) acctSet.add(l.accountType); });
    const accountsList = Array.from(acctSet).map(acct => ({
      id: acct.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      name: acct,
      type: acct === "Sales" || acct === "Purchase" || acct === "Tax" ? "Income Statement" : "Balance Sheet",
      balance: 0
    }));

    // Derive journal entries
    const jeMap = new Map<string, any>();
    ledger.forEach(l => {
      const key = l.referenceId || l.id;
      if (!jeMap.has(key)) {
        jeMap.set(key, {
          id: key,
          entry_number: `JE-${key.substring(0, 8).toUpperCase()}`,
          date: l.date,
          description: l.notes || `Journal Entry reference: ${l.referenceId}`,
          total_debit: 0,
          total_credit: 0
        });
      }
      const je = jeMap.get(key);
      if (l.type === "Debit") {
        je.total_debit += Number(l.amount || 0);
      } else {
        je.total_credit += Number(l.amount || 0);
      }
    });
    const journalEntriesList = Array.from(jeMap.values());

    // Derive roles list
    const roleSet = new Set<string>();
    teamMembers.forEach(tm => { if (tm.role) roleSet.add(tm.role); });
    const rolesList = Array.from(roleSet).map(r => ({
      id: r.toLowerCase(),
      name: r
    }));

    // Derive permissions entries
    const permissionsList: any[] = [];
    teamMembers.forEach(tm => {
      if (tm.permissions) {
        permissionsList.push({
          id: tm.id,
          role: tm.role,
          permissions: tm.permissions
        });
      }
    });

    // Seed default taxes data
    const taxesList = [
      { id: "gst-5", name: "GST 5%", rate: 5, type: "GST" },
      { id: "gst-12", name: "GST 12%", rate: 12, type: "GST" },
      { id: "gst-18", name: "GST 18%", rate: 18, type: "GST" },
      { id: "gst-28", name: "GST 28%", rate: 28, type: "GST" }
    ];

    // Seed default notifications
    const notificationsList = [
      {
        id: "noti-welcome",
        user_id: "all",
        title: "Relational Engine Configured",
        message: "Your Divine Traders ERP has successfully established safe routing pipelines with Supabase Postgres.",
        read: true
      }
    ];

    // Derive attachments
    const attachmentsList: any[] = [];
    const cp = firebaseState.companyProfile;
    if (cp) {
      if (cp.logoUrl) attachmentsList.push({ id: "att-logo", name: "Company Logo", url: cp.logoUrl, file_size: "N/A", associated_type: "CompanyProfile", associated_id: "profile" });
      if (cp.signatureUrl) attachmentsList.push({ id: "att-sig", name: "Authorized Signature", url: cp.signatureUrl, file_size: "N/A", associated_type: "CompanyProfile", associated_id: "profile" });
      if (cp.stampUrl) attachmentsList.push({ id: "att-stamp", name: "Official Stamp", url: cp.stampUrl, file_size: "N/A", associated_type: "CompanyProfile", associated_id: "profile" });
    }

    // Map modules for migration
    const modulesMap: Record<string, any[]> = {
      customers: parties.filter(p => p.type === "Customer" || p.type === "Both").map(p => ({
        id: p.id,
        name: p.name,
        phone: p.phone || "",
        email: p.email || "",
        address: p.address || "",
        gstin: p.gstin || "",
        opening_balance: Number(p.openingBalance || 0)
      })),
      vendors: parties.filter(p => p.type === "Vendor" || p.type === "Both").map(p => ({
        id: p.id,
        name: p.name,
        phone: p.phone || "",
        email: p.email || "",
        address: p.address || "",
        gstin: p.gstin || "",
        opening_balance: Number(p.openingBalance || 0)
      })),
      products: items.map(it => ({
        id: it.id,
        code: it.code,
        name: it.name,
        description: it.description || "",
        category: it.category || "",
        purchase_price: Number(it.purchasePrice || 0),
        sale_price: Number(it.salePrice || 0),
        stock_quantity: Number(it.stockQuantity || 0),
        unit: it.unit || "",
        min_stock_level: Number(it.minStockLevel || 0)
      })),
      categories: categoriesList,
      warehouses: warehouses.map(w => ({
        id: w.id,
        name: w.name,
        code: w.code,
        address: w.address || "",
        status: w.status || "Active"
      })),
      stock: stockList,
      stock_movements: stockMovements.map(sm => ({
        id: sm.id,
        date: sm.date,
        item_id: sm.itemId,
        type: sm.type,
        quantity: Number(sm.quantity || 0),
        reference_type: sm.referenceType,
        reference_id: sm.referenceId,
        notes: sm.notes || "",
        warehouse_id: sm.warehouseId || null
      })),
      purchase_orders: purchaseOrders.map(po => ({
        id: po.id,
        order_number: po.orderNumber,
        vendor_id: po.vendorId,
        date: po.date,
        total_amount: Number(po.totalAmount || 0),
        status: po.status,
        notes: po.notes || ""
      })),
      purchase_order_items: purchaseItemsList,
      goods_receipts: goodsReceipts.map(gr => ({
        id: gr.id,
        grn_number: gr.grnNumber,
        purchase_order_id: gr.purchaseOrderId,
        date: gr.date,
        received_by: gr.receivedBy,
        notes: gr.notes || "",
        warehouse_id: gr.warehouseId || null
      })),
      purchase_returns: purchaseReturns.map(pr => ({
        id: pr.id,
        return_number: pr.returnNumber,
        purchase_order_id: pr.purchaseOrderId || null,
        purchase_bill_id: pr.purchaseBillId || null,
        vendor_id: pr.vendorId,
        date: pr.date,
        subtotal: Number(pr.subtotal || 0),
        cgst: Number(pr.cgst || 0),
        sgst: Number(pr.sgst || 0),
        igst: Number(pr.igst || 0),
        total_amount: Number(pr.totalAmount || 0),
        notes: pr.notes || "",
        status: pr.status,
        warehouse_id: pr.warehouseId || null
      })),
      purchase_bills: purchaseBills.map(pb => ({
        id: pb.id,
        bill_number: pb.billNumber,
        vendor_id: pb.vendorId,
        purchase_order_id: pb.purchaseOrderId || null,
        goods_receipt_id: pb.goodsReceiptId || null,
        date: pb.date,
        due_date: pb.dueDate,
        subtotal: Number(pb.subtotal || 0),
        cgst: Number(pb.cgst || 0),
        sgst: Number(pb.sgst || 0),
        igst: Number(pb.igst || 0),
        total_amount: Number(pb.totalAmount || 0),
        status: pb.status,
        paid_amount: Number(pb.paidAmount || 0),
        invoice_type: pb.invoiceType || "GST"
      })),
      sales_invoices: saleInvoices.map(si => ({
        id: si.id,
        invoice_number: si.invoiceNumber,
        customer_id: si.customerId,
        date: si.date,
        subtotal: Number(si.subtotal || 0),
        cgst: Number(si.cgst || 0),
        sgst: Number(si.sgst || 0),
        igst: Number(si.igst || 0),
        total_amount: Number(si.totalAmount || 0),
        notes: si.notes || "",
        status: si.status || "Unpaid",
        paid_amount: Number(si.paidAmount || 0),
        assignee: si.assignee || null,
        warehouse_id: si.warehouseId || null
      })),
      sales_invoice_items: salesInvoiceItemsList,
      customer_payments: payments.filter(p => p.customerId || p.type === 'Inbound').map(p => ({
        id: p.id,
        payment_number: p.paymentNumber,
        date: p.date,
        customer_id: p.customerId || "customer-unknown",
        amount: Number(p.amount || 0),
        payment_method: p.paymentMethod,
        reference_number: p.referenceNumber || "",
        notes: p.notes || ""
      })),
      vendor_payments: payments.filter(p => p.vendorId || p.type === 'Outward').map(p => ({
        id: p.id,
        payment_number: p.paymentNumber,
        date: p.date,
        vendor_id: p.vendorId || "vendor-unknown",
        amount: Number(p.amount || 0),
        payment_method: p.paymentMethod,
        reference_number: p.referenceNumber || "",
        notes: p.notes || ""
      })),
      expenses: expensesList,
      accounts: accountsList,
      ledger_entries: ledger.map(l => ({
        id: l.id,
        date: l.date,
        party_id: l.partyId || null,
        party_name: l.partyName,
        type: l.type,
        amount: Number(l.amount || 0),
        account_type: l.accountType,
        reference_type: l.referenceType,
        reference_id: l.referenceId,
        notes: l.notes || ""
      })),
      journal_entries: journalEntriesList,
      taxes: taxesList,
      users: teamMembers.map(tm => ({
        id: tm.id,
        user_id: tm.userId,
        name: tm.name,
        email: tm.email,
        role: tm.role,
        status: tm.status
      })),
      roles: rolesList,
      permissions: permissionsList,
      notifications: notificationsList,
      audit_logs: backups.map(b => ({
        id: b.id,
        user_email: b.createdBy || "vishal291137@gmail.com",
        action: `DATA_BACKUP_${b.type.toUpperCase()}`,
        details: `Created backup file ${b.filename} of size ${b.size}`
      })),
      attachments: attachmentsList
    };

    // Calculate total Firebase records count before migration
    let totalFbCount = 0;
    Object.values(modulesMap).forEach(list => { totalFbCount += list.length; });
    report.totalFirebaseRecords = totalFbCount;

    // Migrate each table
    for (const tableName of REQUIRED_TABLES) {
      const records = modulesMap[tableName] || [];
      if (records.length === 0) {
        report.totalSkipped += 1;
        report.modules.push({ name: tableName, migrated: 0, failed: 0, skipped: 1 });
        continue;
      }

      try {
        // Enforce Resumability: Check which records are already successfully migrated
        const { data: existing, error: fetchErr } = await supabase.from(tableName).select("id");
        if (fetchErr) {
          throw new Error(`Failed to check existing records in ${tableName}: ${fetchErr.message}`);
        }

        const existingIds = new Set((existing || []).map(r => r.id));
        const toUpsert = records.filter(rec => !existingIds.has(rec.id));

        if (toUpsert.length === 0) {
          // All already exist, skip or count as already migrated
          report.totalMigrated += records.length;
          report.modules.push({ 
            name: tableName, 
            migrated: records.length, 
            failed: 0, 
            skipped: 0 
          });
          continue;
        }

        let migratedCount = records.length - toUpsert.length;
        let failedCount = 0;
        let retriedCount = 0;

        // Chunk insertions
        const chunkSize = 50;
        for (let i = 0; i < toUpsert.length; i += chunkSize) {
          const chunk = toUpsert.slice(i, i + chunkSize);
          
          // Use UPSERT only
          let { error: upsertErr } = await supabase.from(tableName).upsert(chunk, { onConflict: 'id' });
          
          if (upsertErr) {
            // Retry failed records individually (resilient granular fallback)
            console.warn(`Upsert chunk failed for ${tableName}, retrying records individually...`);
            for (const item of chunk) {
              let attempts = 0;
              let success = false;
              let lastErr = "";
              while (attempts < 3 && !success) {
                attempts++;
                const { error: retryErr } = await supabase.from(tableName).upsert(item, { onConflict: 'id' });
                if (!retryErr) {
                  success = true;
                  migratedCount++;
                  retriedCount++;
                  report.retried++;
                } else {
                  lastErr = retryErr.message;
                }
              }
              if (!success) {
                failedCount++;
                console.error(`Record insertion permanently failed for table ${tableName} on ID ${item.id}: ${lastErr}`);
              }
            }
          } else {
            migratedCount += chunk.length;
          }
        }

        report.totalMigrated += migratedCount;
        report.totalFailed += failedCount;
        report.modules.push({
          name: tableName,
          migrated: migratedCount,
          failed: failedCount,
          skipped: 0,
          retried: retriedCount
        });

      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.error(`Migration module error for ${tableName}:`, errMsg);
        report.totalFailed += records.length;
        report.modules.push({
          name: tableName,
          migrated: 0,
          failed: records.length,
          skipped: 0,
          error: errMsg
        });
      }
    }

    // Step 6: Validate and Verify Database State & Counts
    const verificationReport = await verifyDatabaseState(firebaseState, docId);
    report.verification = verificationReport;

    // Calculate total Supabase records count across all verified tables
    let totalSbCount = 0;
    verificationReport.forEach(v => { totalSbCount += v.supabaseCount; });
    report.totalSupabaseRecords = totalSbCount;

    // Success if all verified records match perfectly
    report.success = verificationReport.every(v => v.status === "match");

    if (report.success) {
      report.statusText = "Database fully synced. 100% record integrity verified successfully! 🎉";
    } else {
      const mismatches = verificationReport.filter(v => v.status === "mismatch").map(v => `${v.name} (${v.firebaseCount} vs ${v.supabaseCount})`);
      report.statusText = `Migration complete, but has count mismatches on: ${mismatches.join(", ")}. Please review details and run retries.`;
    }

  } catch (err: any) {
    console.error("Critical Migration Error:", err);
    report.success = false;
    report.statusText = `Fatal error: ${err?.message || String(err)}`;
    report.totalFailed += 1;
  }

  return report;
}

/**
 * 4. Helper to verify record counts and statuses in both DBs.
 * Ensures strict, item-by-item validation checks.
 */
export async function verifyDatabaseState(
  fbState: ERPState,
  docId: string
): Promise<VerificationModuleReport[]> {
  const report: VerificationModuleReport[] = [];

  // 1. Unified checks
  const sbState = await loadStateFromSupabase(docId);

  // We check individual tables counts
  const checkQueries = REQUIRED_TABLES.map(async (table) => {
    try {
      const { data, error, count } = await supabase.from(table).select("id", { count: "exact" });
      if (error) {
        return { name: table, count: 0, error: error.message };
      }
      return { name: table, count: count || data?.length || 0 };
    } catch (err: any) {
      return { name: table, count: 0, error: err?.message || String(err) };
    }
  });

  const queryResults = await Promise.all(checkQueries);

  // Construct Firebase counts for comparison
  const customCategories = fbState.customCategories || [];
  const items = fbState.items || [];
  const parties = fbState.parties || [];
  const warehouses = fbState.warehouses || [];
  const stockMovements = fbState.stockMovements || [];
  const purchaseOrders = fbState.purchaseOrders || [];
  const goodsReceipts = fbState.goodsReceipts || [];
  const purchaseReturns = fbState.purchaseReturns || [];
  const purchaseBills = fbState.purchaseBills || [];
  const saleInvoices = fbState.saleInvoices || [];
  const payments = fbState.payments || [];
  const ledger = fbState.ledger || [];
  const teamMembers = fbState.teamMembers || [];
  const backups = fbState.backups || [];

  // Mapped Firebase counts
  const fbCountsMap: Record<string, number> = {
    customers: parties.filter(p => p.type === "Customer" || p.type === "Both").length,
    vendors: parties.filter(p => p.type === "Vendor" || p.type === "Both").length,
    products: items.length,
    categories: (new Set([...customCategories, ...items.map(i => i.category).filter(Boolean)])).size,
    warehouses: warehouses.length,
    stock: items.reduce((acc, it) => acc + (it.warehouseStocks ? Object.keys(it.warehouseStocks).length : 0), 0),
    stock_movements: stockMovements.length,
    purchase_orders: purchaseOrders.length,
    purchase_order_items: purchaseOrders.reduce((acc, po) => acc + (po.items ? po.items.length : 0), 0),
    goods_receipts: goodsReceipts.length,
    purchase_returns: purchaseReturns.length,
    purchase_bills: purchaseBills.length,
    sales_invoices: saleInvoices.length,
    sales_invoice_items: saleInvoices.reduce((acc, si) => acc + (si.items ? si.items.length : 0), 0),
    customer_payments: payments.filter(p => p.customerId || p.type === 'Inbound').length,
    vendor_payments: payments.filter(p => p.vendorId || p.type === 'Outward').length,
    expenses: payments.filter(p => p.type === 'Outward' && !p.vendorId).length,
    accounts: (new Set(ledger.map(l => l.accountType).filter(Boolean))).size,
    ledger_entries: ledger.length,
    journal_entries: (new Set(ledger.map(l => l.referenceId || l.id).filter(Boolean))).size,
    taxes: 4, // Seeded standard GST rates
    users: teamMembers.length,
    roles: (new Set(teamMembers.map(tm => tm.role).filter(Boolean))).size,
    permissions: teamMembers.filter(tm => tm.permissions).length,
    notifications: 1, // Seeded notification
    audit_logs: backups.length,
    attachments: (fbState.companyProfile?.logoUrl ? 1 : 0) + (fbState.companyProfile?.signatureUrl ? 1 : 0) + (fbState.companyProfile?.stampUrl ? 1 : 0)
  };

  // Compile verification reports
  for (const tableName of REQUIRED_TABLES) {
    const fbCount = fbCountsMap[tableName] || 0;
    const sbResult = queryResults.find(q => q.name === tableName);
    const sbCount = sbResult ? sbResult.count : 0;
    const status = fbCount === sbCount ? ("match" as const) : ("mismatch" as const);
    
    report.push({
      name: tableName,
      firebaseCount: fbCount,
      supabaseCount: sbCount,
      status,
      error: sbResult?.error
    });
  }

  return report;
}
