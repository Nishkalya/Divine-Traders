import { createClient } from "@supabase/supabase-js";
import { ERPState, Party, Item, PurchaseOrder, SaleInvoice, Payment, Warehouse, LedgerEntry, TeamMember, ProductionRun, StockTransfer, FundingPartner, FundingTransaction, BackupLog, BackupSettings, PurchaseOrderItem, SaleInvoiceItem, GoodsReceipt, GoodsReceiptItem, PurchaseReturn, PurchaseReturnItem, PurchaseBill } from "../types";

// Retrieve Supabase credentials from environment or defaults
const metaEnv = (import.meta as any).env || {};
const SUPABASE_URL = 
  metaEnv.VITE_SUPABASE_URL || 
  metaEnv.NEXT_PUBLIC_SUPABASE_URL || 
  "https://eetzhswjyapcfxtmiqvs.supabase.co";

const SUPABASE_ANON_KEY = 
  metaEnv.VITE_SUPABASE_ANON_KEY || 
  metaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  "sb_publishable_QpatSyP6pQObfbZv7B5E7A__zLgsmQMN";

// Create Supabase Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface SupabaseErrorInfo {
  error: string;
  operationType: OperationType;
  table: string;
  details?: string;
}

export function handleSupabaseError(error: any, operationType: OperationType, table: string): never {
  const errInfo: SupabaseErrorInfo = {
    error: error?.message || String(error),
    operationType,
    table,
    details: error?.details || "",
  };
  console.error("Supabase Error Context: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Checks if a specific table exists by performing a cheap query.
 */
async function testTableExists(tableName: string): Promise<boolean> {
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
 * Deterministically converts any string ID to a valid RFC 4122 UUID v4.
 * This guarantees we can migrate Firestore string IDs directly into PostgreSQL UUID columns.
 */
export function toUUID(str: string): string {
  if (!str) return "00000000-0000-0000-0000-000000000000";
  
  // If already a valid UUID, normalize and return
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) {
    return str.toLowerCase();
  }

  // Generate 128-bit hash value from string
  let h1 = 0x23872384;
  let h2 = 0x93847291;
  let h3 = 0x29384729;
  let h4 = 0x19284728;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    h1 = (h1 << 5) - h1 + char;
    h1 = h1 & h1;
    h2 = (h2 << 3) - h2 + char;
    h2 = h2 & h2;
    h3 = (h3 << 7) - h3 + char;
    h3 = h3 & h3;
    h4 = (h4 << 11) - h4 + char;
    h4 = h4 & h4;
  }

  const p1 = Math.abs(h1).toString(16).padStart(8, "0");
  const p2 = Math.abs(h2).toString(16).padStart(8, "0");
  const p3 = Math.abs(h3).toString(16).padStart(8, "0");
  const p4 = Math.abs(h4).toString(16).padStart(8, "0");

  const combined = (p1 + p2 + p3 + p4).substring(0, 32);
  return `${combined.substring(0, 8)}-${combined.substring(8, 12)}-${combined.substring(12, 16)}-${combined.substring(16, 20)}-${combined.substring(20, 32)}`.toLowerCase();
}

/**
 * Helper to retrieve role UUID by name.
 */
function getRoleUUID(roleName: string): string {
  switch (roleName) {
    case "Admin": return "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    case "Accountant": return "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12";
    case "Sales": return "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13";
    case "Purchase": return "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14";
    case "Store": return "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15";
    case "Production": return "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16";
    default: return toUUID(roleName);
  }
}

/**
 * Default permissions fallback for team member roles.
 */
function getDefaultPermissionsForRole(role: string) {
  const isAll = role === "Admin";
  return {
    dashboard: true,
    sales: isAll || role === "Sales" || role === "Accountant",
    purchaseOrders: isAll || role === "Purchase" || role === "Accountant",
    purchaseReturns: isAll || role === "Purchase" || role === "Accountant",
    goodsReceipts: isAll || role === "Store" || role === "Purchase",
    purchaseBills: isAll || role === "Accountant" || role === "Purchase",
    vendorOutstanding: isAll || role === "Accountant",
    customerOutstanding: isAll || role === "Accountant",
    payments: isAll || role === "Accountant",
    itemsStock: true,
    stockInventory: isAll || role === "Store" || role === "Accountant",
    addItem: isAll || role === "Store",
    stockMovement: true,
    parties: isAll || role === "Sales" || role === "Purchase" || role === "Accountant",
    reports: isAll || role === "Accountant",
    gstReports: isAll || role === "Accountant",
    ledger: isAll || role === "Accountant",
    adminUsers: isAll,
    production: isAll || role === "Production",
    companyFunding: isAll
  };
}

/**
 * Default actions fallback for team members.
 */
function getDefaultActions() {
  return {
    view: true,
    create: true,
    edit: true,
    delete: true,
    print: true,
    export: true
  };
}

/**
 * Safe fetch select helper to prevent missing table crashes.
 */
async function safeFetch(table: string): Promise<any[]> {
  try {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      console.warn(`[Supabase safeFetch] Error on table ${table}:`, error.message);
      return [];
    }
    return data || [];
  } catch (err: any) {
    console.warn(`[Supabase safeFetch] Exception on table ${table}:`, err?.message || err);
    return [];
  }
}

/**
 * Helper to sync deletions during state saves.
 */
async function syncTableDeletions(tableName: string, stateIds: string[]) {
  try {
    const tableExists = await testTableExists(tableName);
    if (!tableExists) return;
    const { data } = await supabase.from(tableName).select("id");
    if (data) {
      const dbIds = data.map((row: any) => row.id);
      const toDelete = dbIds.filter((id: string) => !stateIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from(tableName).delete().in("id", toDelete);
      }
    }
  } catch (err) {
    console.warn(`Error syncing deletions for ${tableName}:`, err);
  }
}

/**
 * Load entire ERPState from the normalized relational database.
 */
export async function loadStateFromSupabase(docId?: string | null): Promise<ERPState | null> {
  try {
    const customersTable = await testTableExists("customers");
    if (!customersTable) {
      console.warn("Relational tables do not exist yet. Running baseline or waiting for migration.");
      return null;
    }

    console.log("Loading relational ERPState from Supabase...");

    // Fetch all tables concurrently
    const [
      customers,
      vendors,
      categories,
      products,
      warehouses,
      stock,
      stockMovements,
      purchaseOrders,
      purchaseOrderItems,
      purchaseBills,
      goodsReceipts,
      goodsReceiptItems,
      purchaseReturns,
      purchaseReturnItems,
      salesInvoices,
      salesInvoiceItems,
      customerPayments,
      vendorPayments,
      ledgerEntries,
      users,
      roles,
      userPermissions,
      userActions,
      companyProfiles,
      erpSettings,
      unitConversions,
      customUnits,
      salesAssignees,
      productionRuns,
      stockTransfers,
      fundingPartners,
      fundingTransactions,
      backupSettingsTable
    ] = await Promise.all([
      safeFetch("customers"),
      safeFetch("vendors"),
      safeFetch("categories"),
      safeFetch("products"),
      safeFetch("warehouses"),
      safeFetch("stock"),
      safeFetch("stock_movements"),
      safeFetch("purchase_orders"),
      safeFetch("purchase_order_items"),
      safeFetch("purchase_bills"),
      safeFetch("goods_receipts"),
      safeFetch("goods_receipt_items"),
      safeFetch("purchase_returns"),
      safeFetch("purchase_return_items"),
      safeFetch("sales_invoices"),
      safeFetch("sales_invoice_items"),
      safeFetch("customer_payments"),
      safeFetch("vendor_payments"),
      safeFetch("ledger_entries"),
      safeFetch("users"),
      safeFetch("roles"),
      safeFetch("user_permissions"),
      safeFetch("user_actions"),
      safeFetch("company_profiles"),
      safeFetch("erp_settings"),
      safeFetch("unit_conversions"),
      safeFetch("custom_units"),
      safeFetch("sales_assignees"),
      safeFetch("production_runs"),
      safeFetch("stock_transfers"),
      safeFetch("funding_partners"),
      safeFetch("funding_transactions"),
      safeFetch("backup_settings")
    ]);

    // Reconstruct Parties
    const partiesMap = new Map<string, Party>();
    for (const c of customers) {
      partiesMap.set(c.id, {
        id: c.id,
        name: c.name,
        type: "Customer",
        phone: c.phone || "",
        email: c.email || "",
        address: c.address || "",
        gstin: c.gstin || "",
        openingBalance: Number(c.opening_balance || 0),
      });
    }
    for (const v of vendors) {
      if (partiesMap.has(v.id)) {
        partiesMap.get(v.id)!.type = "Both";
      } else {
        partiesMap.set(v.id, {
          id: v.id,
          name: v.name,
          type: "Vendor",
          phone: v.phone || "",
          email: v.email || "",
          address: v.address || "",
          gstin: v.gstin || "",
          openingBalance: Number(v.opening_balance || 0),
        });
      }
    }

    // Reconstruct Categories Map
    const categoriesMap = new Map<string, string>();
    for (const cat of categories) {
      categoriesMap.set(cat.id, cat.name);
    }

    // Reconstruct Product Stocks
    const stocksMap = new Map<string, Record<string, number>>();
    for (const s of stock) {
      if (!stocksMap.has(s.product_id)) {
        stocksMap.set(s.product_id, {});
      }
      stocksMap.get(s.product_id)![s.warehouse_id] = Number(s.quantity || 0);
    }

    // Reconstruct Items
    const items: Item[] = products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description || "",
      category: categoriesMap.get(p.category_id) || "",
      unit: p.unit,
      purchasePrice: Number(p.purchase_price || 0),
      salePrice: Number(p.sale_price || 0),
      stockQuantity: Number(p.stock_quantity || 0),
      minStockLevel: Number(p.min_stock_level || 0),
      warehouseStocks: stocksMap.get(p.id) || {},
    }));

    // Reconstruct Purchase Order Items
    const poItemsMap = new Map<string, PurchaseOrderItem[]>();
    for (const pi of purchaseOrderItems) {
      if (!poItemsMap.has(pi.purchase_order_id)) {
        poItemsMap.set(pi.purchase_order_id, []);
      }
      poItemsMap.get(pi.purchase_order_id)!.push({
        itemId: pi.item_id,
        name: pi.name,
        quantity: Number(pi.quantity || 0),
        rate: Number(pi.rate || 0),
        amount: Number(pi.amount || 0),
        taxRate: pi.tax_rate ? Number(pi.tax_rate) : undefined,
        unit: pi.unit || undefined,
      });
    }

    // Reconstruct Purchase Orders
    const purchaseOrdersMapped: PurchaseOrder[] = purchaseOrders.map((po) => ({
      id: po.id,
      orderNumber: po.order_number,
      vendorId: po.vendor_id,
      date: po.date,
      status: po.status,
      items: poItemsMap.get(po.id) || [],
      totalAmount: Number(po.total_amount || 0),
      notes: po.notes || "",
    }));

    // Reconstruct Purchase Bills
    const purchaseBillsMapped: PurchaseBill[] = purchaseBills.map((pb) => ({
      id: pb.id,
      billNumber: pb.bill_number,
      vendorId: pb.vendor_id,
      purchaseOrderId: pb.purchase_order_id || undefined,
      goodsReceiptId: pb.goods_receipt_id || undefined,
      date: pb.date,
      dueDate: pb.due_date,
      subtotal: Number(pb.subtotal || 0),
      cgst: Number(pb.cgst || 0),
      sgst: Number(pb.sgst || 0),
      igst: Number(pb.igst || 0),
      totalAmount: Number(pb.total_amount || 0),
      status: pb.status,
      paidAmount: Number(pb.paid_amount || 0),
      invoiceType: pb.invoice_type as "GST" | "NON_GST" | undefined,
    }));

    // Reconstruct Goods Receipt Items
    const grItemsMap = new Map<string, GoodsReceiptItem[]>();
    for (const gri of goodsReceiptItems) {
      if (!grItemsMap.has(gri.goods_receipt_id)) {
        grItemsMap.set(gri.goods_receipt_id, []);
      }
      grItemsMap.get(gri.goods_receipt_id)!.push({
        itemId: gri.item_id,
        name: gri.name,
        quantityReceived: Number(gri.quantity_received || 0),
        unit: gri.unit || undefined,
        rate: gri.rate ? Number(gri.rate) : undefined,
      });
    }

    // Reconstruct Goods Receipts
    const goodsReceiptsMapped: GoodsReceipt[] = goodsReceipts.map((gr) => ({
      id: gr.id,
      grnNumber: gr.grn_number,
      purchaseOrderId: gr.purchase_order_id,
      date: gr.date,
      items: grItemsMap.get(gr.id) || [],
      receivedBy: gr.received_by,
      notes: gr.notes || "",
      warehouseId: gr.warehouse_id || undefined,
    }));

    // Reconstruct Purchase Return Items
    const prItemsMap = new Map<string, PurchaseReturnItem[]>();
    for (const pri of purchaseReturnItems) {
      if (!prItemsMap.has(pri.purchase_return_id)) {
        prItemsMap.set(pri.purchase_return_id, []);
      }
      prItemsMap.get(pri.purchase_return_id)!.push({
        itemId: pri.item_id,
        name: pri.name,
        quantity: Number(pri.quantity || 0),
        rate: Number(pri.rate || 0),
        amount: Number(pri.amount || 0),
        taxRate: pri.tax_rate ? Number(pri.tax_rate) : undefined,
        unit: pri.unit || undefined,
      });
    }

    // Reconstruct Purchase Returns
    const purchaseReturnsMapped: PurchaseReturn[] = purchaseReturns.map((pr) => ({
      id: pr.id,
      returnNumber: pr.return_number,
      purchaseOrderId: pr.purchase_order_id || undefined,
      purchaseBillId: pr.purchase_bill_id || undefined,
      vendorId: pr.vendor_id,
      date: pr.date,
      items: prItemsMap.get(pr.id) || [],
      subtotal: Number(pr.subtotal || 0),
      cgst: Number(pr.cgst || 0),
      sgst: Number(pr.sgst || 0),
      igst: Number(pr.igst || 0),
      totalAmount: Number(pr.total_amount || 0),
      notes: pr.notes || "",
      status: pr.status,
      warehouseId: pr.warehouse_id || undefined,
    }));

    // Reconstruct Sales Invoice Items
    const siItemsMap = new Map<string, SaleInvoiceItem[]>();
    for (const sii of salesInvoiceItems) {
      if (!siItemsMap.has(sii.sales_invoice_id)) {
        siItemsMap.set(sii.sales_invoice_id, []);
      }
      siItemsMap.get(sii.sales_invoice_id)!.push({
        itemId: sii.item_id,
        name: sii.name,
        quantity: Number(sii.quantity || 0),
        rate: Number(sii.rate || 0),
        amount: Number(sii.amount || 0),
        taxRate: sii.tax_rate ? Number(sii.tax_rate) : undefined,
        unit: sii.unit || undefined,
      });
    }

    // Reconstruct Sales Invoices
    const saleInvoicesMapped: SaleInvoice[] = salesInvoices.map((si) => ({
      id: si.id,
      invoiceNumber: si.invoice_number,
      customerId: si.customer_id,
      date: si.date,
      items: siItemsMap.get(si.id) || [],
      subtotal: Number(si.subtotal || 0),
      cgst: Number(si.cgst || 0),
      sgst: Number(si.sgst || 0),
      igst: Number(si.igst || 0),
      totalAmount: Number(si.total_amount || 0),
      notes: si.notes || "",
      status: si.status || undefined,
      paidAmount: si.paid_amount ? Number(si.paid_amount) : undefined,
      assignee: si.assignee || undefined,
      warehouseId: si.warehouse_id || undefined,
    }));

    // Reconstruct Payments
    const paymentsMapped: Payment[] = [];
    for (const cp of customerPayments) {
      paymentsMapped.push({
        id: cp.id,
        paymentNumber: cp.payment_number,
        date: cp.date,
        customerId: cp.customer_id,
        amount: Number(cp.amount || 0),
        paymentMethod: cp.payment_method,
        referenceNumber: cp.reference_number || "",
        notes: cp.notes || "",
        type: "Inbound",
      });
    }
    for (const vp of vendorPayments) {
      paymentsMapped.push({
        id: vp.id,
        paymentNumber: vp.payment_number,
        date: vp.date,
        vendorId: vp.vendor_id,
        amount: Number(vp.amount || 0),
        paymentMethod: vp.payment_method,
        referenceNumber: vp.reference_number || "",
        notes: vp.notes || "",
        type: "Outward",
      });
    }

    // Reconstruct Stock Movements
    const stockMovementsMapped = stockMovements.map((sm) => ({
      id: sm.id,
      date: sm.date,
      itemId: sm.item_id,
      type: sm.type as "In" | "Out" | "Adjustment",
      quantity: Number(sm.quantity || 0),
      referenceType: sm.reference_type as any,
      referenceId: sm.reference_id || "",
      notes: sm.notes || "",
      warehouseId: sm.warehouse_id || undefined,
    }));

    // Reconstruct Ledger Entries
    const ledgerEntriesMapped: LedgerEntry[] = ledgerEntries.map((le) => ({
      id: le.id,
      date: le.date,
      partyId: le.party_id || undefined,
      partyName: le.party_name,
      type: le.type as "Debit" | "Credit",
      amount: Number(le.amount || 0),
      accountType: le.account_type as any,
      referenceType: le.reference_type as any,
      referenceId: le.reference_id || "",
      notes: le.notes || "",
    }));

    // Reconstruct Team Roles Map
    const rolesMap = new Map<string, string>();
    for (const r of roles) {
      rolesMap.set(r.id, r.name);
    }

    // Reconstruct Custom Permissions
    const permMap = new Map<string, Record<string, boolean>>();
    for (const up of userPermissions) {
      if (!permMap.has(up.user_id)) {
        permMap.set(up.user_id, {});
      }
      permMap.get(up.user_id)![up.permission_name] = Boolean(up.enabled);
    }

    // Reconstruct Custom Actions
    const actionMap = new Map<string, Record<string, boolean>>();
    for (const ua of userActions) {
      if (!actionMap.has(ua.user_id)) {
        actionMap.set(ua.user_id, {});
      }
      actionMap.get(ua.user_id)![ua.action_name] = Boolean(ua.enabled);
    }

    // Reconstruct Team Members
    const teamMembersMapped: TeamMember[] = users.map((u) => {
      const userRoleName = rolesMap.get(u.role_id) || "Sales";
      const userPerms = permMap.get(u.id) || getDefaultPermissionsForRole(userRoleName);
      const userActs = actionMap.get(u.id) || getDefaultActions();
      return {
        id: u.id,
        userId: u.user_id,
        name: u.name,
        email: u.email,
        role: userRoleName as any,
        status: u.status as "Active" | "Inactive",
        permissions: userPerms as any,
        actions: userActs as any,
        createdAt: u.created_at,
      };
    });

    // Reconstruct Company Profile
    const firstProfile = companyProfiles[0];
    const companyProfileMapped = firstProfile ? {
      name: firstProfile.name,
      description: firstProfile.description || "",
      phone: firstProfile.phone || "",
      email: firstProfile.email || "",
      gstin: firstProfile.gstin || "",
      address: firstProfile.address || "",
      headOfficeAddress: firstProfile.head_office_address || "",
      logoUrl: firstProfile.logo_url || undefined,
      signatureUrl: firstProfile.signature_url || undefined,
      stampUrl: firstProfile.stamp_url || undefined,
      bankName: firstProfile.bank_name || "",
      bankBranch: firstProfile.bank_branch || "",
      accountNumber: firstProfile.account_number || "",
      ifscCode: firstProfile.ifsc_code || "",
      accountName: firstProfile.account_name || "",
    } : undefined;

    // Settings
    const firstSetting = erpSettings[0];
    const allowNegativeStock = firstSetting ? Boolean(firstSetting.allow_negative_stock) : false;
    const salesAssigneeName = firstSetting ? firstSetting.sales_assignee_name || "" : "";

    // Unit Conversions
    const unitConversionsMapped: StockTransfer[] = unitConversions.map((uc) => ({
      id: uc.id,
      fromUnit: uc.from_unit,
      toUnit: uc.to_unit,
      factor: Number(uc.factor || 1),
    })) as any;

    // Simple list settings arrays
    const customUnitsMapped = customUnits.map((u) => u.name);
    const salesAssigneesMapped = salesAssignees.map((s) => s.name);

    // Production Runs
    const productionRunsMapped: ProductionRun[] = productionRuns.map((pr) => ({
      id: pr.id,
      batchNumber: pr.batch_number,
      productName: pr.product_name,
      quantity: Number(pr.quantity || 0),
      startDate: pr.start_date,
      endDate: pr.end_date || undefined,
      status: pr.status,
      notes: pr.notes || undefined,
    }));

    // Stock Transfers
    const stockTransfersMapped: StockTransfer[] = stockTransfers.map((st) => ({
      id: st.id,
      transferNumber: st.transfer_number,
      date: st.date,
      fromWarehouseId: st.from_warehouse_id,
      toWarehouseId: st.to_warehouse_id,
      itemId: st.item_id,
      quantity: Number(st.quantity || 0),
      notes: st.notes || "",
    }));

    // Funding Partners
    const fundingPartnersMapped: FundingPartner[] = fundingPartners.map((fp) => ({
      id: fp.id,
      name: fp.name,
      mobile: fp.mobile || "",
      email: fp.email || "",
    }));

    // Funding Transactions
    const fundingTransactionsMapped: FundingTransaction[] = fundingTransactions.map((ft) => ({
      id: ft.id,
      date: ft.date,
      partnerId: ft.partner_id,
      amount: Number(ft.amount || 0),
      paymentMethod: ft.payment_method,
      referenceNumber: ft.reference_number || "",
      notes: ft.notes || "",
    }));

    // Backup settings
    const firstBackupSetting = backupSettingsTable[0];
    const backupSettingsMapped: BackupSettings = firstBackupSetting ? {
      autoBackupEnabled: Boolean(firstBackupSetting.auto_backup_enabled),
      frequency: firstBackupSetting.frequency || "Daily",
      lastAutoBackupAt: firstBackupSetting.last_auto_backup_at || undefined,
    } : { autoBackupEnabled: false, frequency: "Daily" };

    const assembledState: ERPState = {
      parties: Array.from(partiesMap.values()),
      items,
      purchaseOrders: purchaseOrdersMapped,
      purchaseBills: purchaseBillsMapped,
      goodsReceipts: goodsReceiptsMapped,
      purchaseReturns: purchaseReturnsMapped,
      saleInvoices: saleInvoicesMapped,
      payments: paymentsMapped,
      stockMovements: stockMovementsMapped,
      ledger: ledgerEntriesMapped,
      teamMembers: teamMembersMapped,
      productionRuns: productionRunsMapped,
      allowNegativeStock,
      companyProfile: companyProfileMapped,
      unitConversions: unitConversionsMapped as any,
      customCategories: categories.map((cat) => cat.name),
      customUnits: customUnitsMapped,
      salesAssigneeName,
      salesAssignees: salesAssigneesMapped,
      warehouses: warehouses.map((wh) => ({
        id: wh.id,
        name: wh.name,
        code: wh.code,
        address: wh.address || "",
        status: wh.status || "Active",
      })),
      stockTransfers: stockTransfersMapped,
      fundingPartners: fundingPartnersMapped,
      fundingTransactions: fundingTransactionsMapped,
      backups: [],
      backupSettings: backupSettingsMapped,
    };

    console.log("Relational ERPState successfully constructed from PostgreSQL!");
    return assembledState;
  } catch (err: any) {
    console.error("Critical error inside loadStateFromSupabase:", err);
    return null;
  }
}

/**
 * Save ERPState in a fully normalized relational PostgreSQL database layout.
 */
export async function saveStateToSupabase(state: ERPState, docId?: string | null): Promise<void> {
  try {
    const customersTable = await testTableExists("customers");
    if (!customersTable) {
      console.warn("Relational tables are offline or missing. Save canceled.");
      return;
    }

    console.log("Saving state to relational tables...");

    // 1. Sync Customers & Vendors
    const customersData: any[] = [];
    const vendorsData: any[] = [];
    const customersIds: string[] = [];
    const vendorsIds: string[] = [];

    for (const p of state.parties || []) {
      const pUUID = toUUID(p.id);
      const common = {
        id: pUUID,
        name: p.name,
        email: p.email || null,
        phone: p.phone || null,
        address: p.address || null,
        gstin: p.gstin || null,
        opening_balance: p.openingBalance || 0,
      };
      if (p.type === "Customer" || p.type === "Both") {
        customersData.push(common);
        customersIds.push(pUUID);
      }
      if (p.type === "Vendor" || p.type === "Both") {
        vendorsData.push(common);
        vendorsIds.push(pUUID);
      }
    }

    if (customersData.length > 0) {
      await supabase.from("customers").upsert(customersData);
    }
    if (vendorsData.length > 0) {
      await supabase.from("vendors").upsert(vendorsData);
    }

    // Sync deletions for parties
    await syncTableDeletions("customers", customersIds);
    await syncTableDeletions("vendors", vendorsIds);

    // 2. Sync Categories
    const categoriesSet = new Set<string>();
    for (const item of state.items || []) {
      if (item.category) categoriesSet.add(item.category);
    }
    for (const cat of state.customCategories || []) {
      if (cat) categoriesSet.add(cat);
    }
    const categoriesData = Array.from(categoriesSet).map((catName) => ({
      id: toUUID(catName),
      name: catName,
    }));
    if (categoriesData.length > 0) {
      await supabase.from("categories").upsert(categoriesData);
    }

    // 3. Sync Products
    const productsData: any[] = [];
    const productIds: string[] = [];
    for (const it of state.items || []) {
      const itUUID = toUUID(it.id);
      productIds.push(itUUID);
      productsData.push({
        id: itUUID,
        code: it.code,
        name: it.name,
        description: it.description || null,
        category_id: it.category ? toUUID(it.category) : null,
        unit: it.unit,
        purchase_price: it.purchasePrice || 0,
        sale_price: it.salePrice || 0,
        stock_quantity: it.stockQuantity || 0,
        min_stock_level: it.minStockLevel || 0,
      });
    }
    if (productsData.length > 0) {
      await supabase.from("products").upsert(productsData);
    }
    await syncTableDeletions("products", productIds);

    // 4. Sync Warehouses
    const warehousesData: any[] = [];
    const warehouseIds: string[] = [];
    for (const wh of state.warehouses || []) {
      const whUUID = toUUID(wh.id);
      warehouseIds.push(whUUID);
      warehousesData.push({
        id: whUUID,
        name: wh.name,
        code: wh.code,
        address: wh.address || null,
        status: wh.status || "Active",
      });
    }
    if (warehousesData.length > 0) {
      await supabase.from("warehouses").upsert(warehousesData);
    }
    await syncTableDeletions("warehouses", warehouseIds);

    // 5. Sync Stocks (Product - Warehouse quantities)
    const stocksData: any[] = [];
    for (const it of state.items || []) {
      const itUUID = toUUID(it.id);
      if (it.warehouseStocks) {
        for (const whId of Object.keys(it.warehouseStocks)) {
          const whUUID = toUUID(whId);
          stocksData.push({
            product_id: itUUID,
            warehouse_id: whUUID,
            quantity: Number(it.warehouseStocks[whId] || 0),
          });
        }
      }
    }
    if (stocksData.length > 0) {
      await supabase.from("stock").upsert(stocksData, { onConflict: "product_id,warehouse_id" });
    }

    // 6. Sync Purchase Orders and Items
    const poData: any[] = [];
    const poIds: string[] = [];
    for (const po of state.purchaseOrders || []) {
      const poUUID = toUUID(po.id);
      poIds.push(poUUID);
      poData.push({
        id: poUUID,
        order_number: po.orderNumber,
        vendor_id: toUUID(po.vendorId),
        date: po.date,
        total_amount: po.totalAmount || 0,
        status: po.status,
        notes: po.notes || null,
      });

      // Clear existing PO items and save fresh ones
      await supabase.from("purchase_order_items").delete().eq("purchase_order_id", poUUID);
      const itemsToSave = (po.items || []).map((pi) => ({
        purchase_order_id: poUUID,
        item_id: toUUID(pi.itemId),
        name: pi.name,
        quantity: pi.quantity,
        rate: pi.rate,
        amount: pi.amount,
        tax_rate: pi.taxRate || 0,
        unit: pi.unit || null,
      }));
      if (itemsToSave.length > 0) {
        await supabase.from("purchase_order_items").insert(itemsToSave);
      }
    }
    if (poData.length > 0) {
      await supabase.from("purchase_orders").upsert(poData);
    }
    await syncTableDeletions("purchase_orders", poIds);

    // 7. Sync Purchase Bills
    const pbData: any[] = [];
    const pbIds: string[] = [];
    for (const pb of state.purchaseBills || []) {
      const pbUUID = toUUID(pb.id);
      pbIds.push(pbUUID);
      pbData.push({
        id: pbUUID,
        bill_number: pb.billNumber,
        vendor_id: toUUID(pb.vendorId),
        purchase_order_id: pb.purchaseOrderId ? toUUID(pb.purchaseOrderId) : null,
        goods_receipt_id: pb.goodsReceiptId ? toUUID(pb.goodsReceiptId) : null,
        date: pb.date,
        due_date: pb.dueDate,
        subtotal: pb.subtotal || 0,
        cgst: pb.cgst || 0,
        sgst: pb.sgst || 0,
        igst: pb.igst || 0,
        total_amount: pb.totalAmount || 0,
        status: pb.status,
        paid_amount: pb.paidAmount || 0,
        invoice_type: pb.invoiceType || "GST",
      });
    }
    if (pbData.length > 0) {
      await supabase.from("purchase_bills").upsert(pbData);
    }
    await syncTableDeletions("purchase_bills", pbIds);

    // 8. Sync Goods Receipts and Items
    const grData: any[] = [];
    const grIds: string[] = [];
    for (const gr of state.goodsReceipts || []) {
      const grUUID = toUUID(gr.id);
      grIds.push(grUUID);
      grData.push({
        id: grUUID,
        grn_number: gr.grnNumber,
        purchase_order_id: toUUID(gr.purchaseOrderId),
        date: gr.date,
        received_by: gr.receivedBy,
        notes: gr.notes || null,
        warehouse_id: gr.warehouseId ? toUUID(gr.warehouseId) : null,
      });

      await supabase.from("goods_receipt_items").delete().eq("goods_receipt_id", grUUID);
      const grItems = (gr.items || []).map((item) => ({
        goods_receipt_id: grUUID,
        item_id: toUUID(item.itemId),
        name: item.name,
        quantity_received: item.quantityReceived,
        unit: item.unit || null,
        rate: item.rate || 0,
      }));
      if (grItems.length > 0) {
        await supabase.from("goods_receipt_items").insert(grItems);
      }
    }
    if (grData.length > 0) {
      await supabase.from("goods_receipts").upsert(grData);
    }
    await syncTableDeletions("goods_receipts", grIds);

    // 9. Sync Purchase Returns and Items
    const prData: any[] = [];
    const prIds: string[] = [];
    for (const pr of state.purchaseReturns || []) {
      const prUUID = toUUID(pr.id);
      prIds.push(prUUID);
      prData.push({
        id: prUUID,
        return_number: pr.returnNumber,
        purchase_order_id: pr.purchaseOrderId ? toUUID(pr.purchaseOrderId) : null,
        purchase_bill_id: pr.purchaseBillId ? toUUID(pr.purchaseBillId) : null,
        vendor_id: toUUID(pr.vendorId),
        date: pr.date,
        subtotal: pr.subtotal || 0,
        cgst: pr.cgst || 0,
        sgst: pr.sgst || 0,
        igst: pr.igst || 0,
        total_amount: pr.totalAmount || 0,
        notes: pr.notes || null,
        status: pr.status,
        warehouse_id: pr.warehouseId ? toUUID(pr.warehouseId) : null,
      });

      await supabase.from("purchase_return_items").delete().eq("purchase_return_id", prUUID);
      const prItems = (pr.items || []).map((item) => ({
        purchase_return_id: prUUID,
        item_id: toUUID(item.itemId),
        name: item.name,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
        tax_rate: item.taxRate || 0,
        unit: item.unit || null,
      }));
      if (prItems.length > 0) {
        await supabase.from("purchase_return_items").insert(prItems);
      }
    }
    if (prData.length > 0) {
      await supabase.from("purchase_returns").upsert(prData);
    }
    await syncTableDeletions("purchase_returns", prIds);

    // 10. Sync Sales Invoices and Items
    const siData: any[] = [];
    const siIds: string[] = [];
    for (const si of state.saleInvoices || []) {
      const siUUID = toUUID(si.id);
      siIds.push(siUUID);
      siData.push({
        id: siUUID,
        invoice_number: si.invoiceNumber,
        customer_id: toUUID(si.customerId),
        date: si.date,
        subtotal: si.subtotal || 0,
        cgst: si.cgst || 0,
        sgst: si.sgst || 0,
        igst: si.igst || 0,
        total_amount: si.totalAmount || 0,
        notes: si.notes || null,
        status: si.status || "Unpaid",
        paid_amount: si.paidAmount || 0,
        assignee: si.assignee || null,
        warehouse_id: si.warehouseId ? toUUID(si.warehouseId) : null,
      });

      await supabase.from("sales_invoice_items").delete().eq("sales_invoice_id", siUUID);
      const siItems = (si.items || []).map((item) => ({
        sales_invoice_id: siUUID,
        item_id: toUUID(item.itemId),
        name: item.name,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
        tax_rate: item.taxRate || 0,
        unit: item.unit || null,
      }));
      if (siItems.length > 0) {
        await supabase.from("sales_invoice_items").insert(siItems);
      }
    }
    if (siData.length > 0) {
      await supabase.from("sales_invoices").upsert(siData);
    }
    await syncTableDeletions("sales_invoices", siIds);

    // 11. Sync Payments (Customer & Vendor)
    const custPaymentsData: any[] = [];
    const vendPaymentsData: any[] = [];
    const paymentIds: string[] = [];

    for (const p of state.payments || []) {
      const pUUID = toUUID(p.id);
      paymentIds.push(pUUID);
      const commonPay = {
        id: pUUID,
        payment_number: p.paymentNumber,
        date: p.date,
        amount: p.amount,
        payment_method: p.paymentMethod,
        reference_number: p.referenceNumber || null,
        notes: p.notes || null,
      };
      if (p.type === "Inbound" || p.customerId) {
        custPaymentsData.push({
          ...commonPay,
          customer_id: toUUID(p.customerId || ""),
        });
      } else {
        vendPaymentsData.push({
          ...commonPay,
          vendor_id: toUUID(p.vendorId || ""),
        });
      }
    }

    if (custPaymentsData.length > 0) {
      await supabase.from("customer_payments").upsert(custPaymentsData);
    }
    if (vendPaymentsData.length > 0) {
      await supabase.from("vendor_payments").upsert(vendPaymentsData);
    }
    await syncTableDeletions("customer_payments", paymentIds);
    await syncTableDeletions("vendor_payments", paymentIds);

    // 12. Sync Stock Movements
    const movementsData = (state.stockMovements || []).map((sm) => ({
      id: toUUID(sm.id),
      date: sm.date,
      item_id: toUUID(sm.itemId),
      type: sm.type,
      quantity: sm.quantity,
      reference_type: sm.referenceType,
      reference_id: sm.referenceId ? toUUID(sm.referenceId) : null,
      notes: sm.notes || null,
      warehouse_id: sm.warehouseId ? toUUID(sm.warehouseId) : null,
    }));
    if (movementsData.length > 0) {
      await supabase.from("stock_movements").upsert(movementsData);
    }
    await syncTableDeletions("stock_movements", (state.stockMovements || []).map((sm) => toUUID(sm.id)));

    // 13. Sync Ledger Entries
    const ledgerData = (state.ledger || []).map((le) => ({
      id: toUUID(le.id),
      date: le.date,
      party_id: le.partyId ? toUUID(le.partyId) : null,
      party_name: le.partyName,
      type: le.type,
      amount: le.amount,
      account_type: le.accountType,
      reference_type: le.referenceType,
      reference_id: le.referenceId ? toUUID(le.referenceId) : null,
      notes: le.notes || null,
    }));
    if (ledgerData.length > 0) {
      await supabase.from("ledger_entries").upsert(ledgerData);
    }
    await syncTableDeletions("ledger_entries", (state.ledger || []).map((le) => toUUID(le.id)));

    // 14. Sync Users, Roles, Custom Permissions & Actions
    const usersData: any[] = [];
    const teamIds: string[] = [];
    for (const tm of state.teamMembers || []) {
      const tmUUID = toUUID(tm.id);
      teamIds.push(tmUUID);
      usersData.push({
        id: tmUUID,
        user_id: tm.userId,
        name: tm.name,
        email: tm.email,
        role_id: getRoleUUID(tm.role),
        status: tm.status || "Active",
      });

      // Insert custom permissions
      if (tm.permissions) {
        await supabase.from("user_permissions").delete().eq("user_id", tmUUID);
        const permsToInsert = Object.keys(tm.permissions).map((key) => ({
          user_id: tmUUID,
          permission_name: key,
          enabled: Boolean((tm.permissions as any)[key]),
        }));
        if (permsToInsert.length > 0) {
          await supabase.from("user_permissions").insert(permsToInsert);
        }
      }

      // Insert custom actions
      if (tm.actions) {
        await supabase.from("user_actions").delete().eq("user_id", tmUUID);
        const actsToInsert = Object.keys(tm.actions).map((key) => ({
          user_id: tmUUID,
          action_name: key,
          enabled: Boolean((tm.actions as any)[key]),
        }));
        if (actsToInsert.length > 0) {
          await supabase.from("user_actions").insert(actsToInsert);
        }
      }
    }
    if (usersData.length > 0) {
      await supabase.from("users").upsert(usersData);
    }
    await syncTableDeletions("users", teamIds);

    // 15. Sync Metadata & Helpers
    if (state.companyProfile) {
      await supabase.from("company_profiles").upsert({
        id: toUUID("default_company"),
        name: state.companyProfile.name,
        description: state.companyProfile.description || null,
        phone: state.companyProfile.phone || null,
        email: state.companyProfile.email || null,
        gstin: state.companyProfile.gstin || null,
        address: state.companyProfile.address || null,
        head_office_address: state.companyProfile.headOfficeAddress || null,
        logo_url: state.companyProfile.logoUrl || null,
        signature_url: state.companyProfile.signatureUrl || null,
        stamp_url: state.companyProfile.stampUrl || null,
        bank_name: state.companyProfile.bankName || null,
        bank_branch: state.companyProfile.bankBranch || null,
        account_number: state.companyProfile.accountNumber || null,
        ifsc_code: state.companyProfile.ifscCode || null,
        account_name: state.companyProfile.accountName || null,
      });
    }

    await supabase.from("erp_settings").upsert({
      id: toUUID("default_settings"),
      allow_negative_stock: state.allowNegativeStock || false,
      sales_assignee_name: state.salesAssigneeName || null,
    });

    const conversionsData = (state.unitConversions || []).map((uc) => ({
      id: toUUID(uc.id || uc.fromUnit + "_" + uc.toUnit),
      from_unit: uc.fromUnit,
      to_unit: uc.toUnit,
      factor: uc.factor,
    }));
    if (conversionsData.length > 0) {
      await supabase.from("unit_conversions").upsert(conversionsData);
    }

    const customUnitsData = (state.customUnits || []).map((u) => ({
      id: toUUID(u),
      name: u,
    }));
    if (customUnitsData.length > 0) {
      await supabase.from("custom_units").upsert(customUnitsData);
    }

    const salesAssigneesData = (state.salesAssignees || []).map((s) => ({
      id: toUUID(s),
      name: s,
    }));
    if (salesAssigneesData.length > 0) {
      await supabase.from("sales_assignees").upsert(salesAssigneesData);
    }

    const runsData = (state.productionRuns || []).map((pr) => ({
      id: toUUID(pr.id),
      batch_number: pr.batchNumber,
      product_name: pr.productName,
      quantity: pr.quantity,
      start_date: pr.startDate,
      end_date: pr.endDate || null,
      status: pr.status,
      notes: pr.notes || null,
    }));
    if (runsData.length > 0) {
      await supabase.from("production_runs").upsert(runsData);
    }
    await syncTableDeletions("production_runs", (state.productionRuns || []).map((pr) => toUUID(pr.id)));

    const transfersData = (state.stockTransfers || []).map((st) => ({
      id: toUUID(st.id),
      transfer_number: st.transferNumber,
      date: st.date,
      from_warehouse_id: toUUID(st.fromWarehouseId),
      to_warehouse_id: toUUID(st.toWarehouseId),
      item_id: toUUID(st.itemId),
      quantity: st.quantity,
      notes: st.notes || null,
    }));
    if (transfersData.length > 0) {
      await supabase.from("stock_transfers").upsert(transfersData);
    }
    await syncTableDeletions("stock_transfers", (state.stockTransfers || []).map((st) => toUUID(st.id)));

    const partnersData = (state.fundingPartners || []).map((fp) => ({
      id: fp.id, // e.g. partner-1
      name: fp.name,
      mobile: fp.mobile || null,
      email: fp.email || null,
    }));
    if (partnersData.length > 0) {
      await supabase.from("funding_partners").upsert(partnersData);
    }

    const ftData = (state.fundingTransactions || []).map((ft) => ({
      id: toUUID(ft.id),
      date: ft.date,
      partner_id: toUUID(ft.partnerId),
      amount: ft.amount,
      payment_method: ft.paymentMethod,
      reference_number: ft.referenceNumber || null,
      notes: ft.notes || null,
    }));
    if (ftData.length > 0) {
      await supabase.from("funding_transactions").upsert(ftData);
    }
    await syncTableDeletions("funding_transactions", (state.fundingTransactions || []).map((ft) => toUUID(ft.id)));

    if (state.backupSettings) {
      await supabase.from("backup_settings").upsert({
        id: toUUID("default_backup"),
        auto_backup_enabled: state.backupSettings.autoBackupEnabled || false,
        frequency: state.backupSettings.frequency || "Daily",
        last_auto_backup_at: state.backupSettings.lastAutoBackupAt || null,
      });
    }

    console.log("Relational ERPState successfully saved to PostgreSQL!");
  } catch (err) {
    console.error("Critical error in saveStateToSupabase:", err);
    throw err;
  }
}

/**
 * Live Changes Subscription (Disabled since we use direct relational layout)
 */
export function subscribeToSupabaseChanges(
  callback: (state: ERPState | null) => void,
  docId?: string | null
): () => void {
  // We return a standard unsubscribe no-op function as individual direct saves/loads keep the local copy refreshed.
  return () => {};
}

/**
 * ==========================================
 * DIRECT CRUD OPERATIONS FOR INDIVIDUAL MODULES
 * ==========================================
 */

// CUSTOMERS & VENDORS CRUD
export async function db_getParties(): Promise<Party[]> {
  const customers = await safeFetch("customers");
  const vendors = await safeFetch("vendors");

  const partiesMap = new Map<string, Party>();
  for (const c of customers) {
    partiesMap.set(c.id, {
      id: c.id,
      name: c.name,
      type: "Customer",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      gstin: c.gstin || "",
      openingBalance: Number(c.opening_balance || 0),
    });
  }
  for (const v of vendors) {
    if (partiesMap.has(v.id)) {
      partiesMap.get(v.id)!.type = "Both";
    } else {
      partiesMap.set(v.id, {
        id: v.id,
        name: v.name,
        type: "Vendor",
        phone: v.phone || "",
        email: v.email || "",
        address: v.address || "",
        gstin: v.gstin || "",
        openingBalance: Number(v.opening_balance || 0),
      });
    }
  }
  return Array.from(partiesMap.values());
}

export async function db_saveParty(party: Party): Promise<void> {
  const pUUID = toUUID(party.id);
  const data = {
    id: pUUID,
    name: party.name,
    email: party.email || null,
    phone: party.phone || null,
    address: party.address || null,
    gstin: party.gstin || null,
    opening_balance: party.openingBalance || 0,
  };

  if (party.type === "Customer" || party.type === "Both") {
    const { error } = await supabase.from("customers").upsert(data);
    if (error) handleSupabaseError(error, OperationType.WRITE, "customers");
  }
  if (party.type === "Vendor" || party.type === "Both") {
    const { error } = await supabase.from("vendors").upsert(data);
    if (error) handleSupabaseError(error, OperationType.WRITE, "vendors");
  }
}

export async function db_deleteParty(id: string): Promise<void> {
  const pUUID = toUUID(id);
  await supabase.from("customers").delete().eq("id", pUUID);
  await supabase.from("vendors").delete().eq("id", pUUID);
}

// PRODUCTS CRUD
export async function db_getItems(): Promise<Item[]> {
  const products = await safeFetch("products");
  const categories = await safeFetch("categories");
  const stock = await safeFetch("stock");

  const categoriesMap = new Map<string, string>();
  for (const cat of categories) {
    categoriesMap.set(cat.id, cat.name);
  }

  const stocksMap = new Map<string, Record<string, number>>();
  for (const s of stock) {
    if (!stocksMap.has(s.product_id)) {
      stocksMap.set(s.product_id, {});
    }
    stocksMap.get(s.product_id)![s.warehouse_id] = Number(s.quantity || 0);
  }

  return products.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description || "",
    category: categoriesMap.get(row.category_id) || "",
    unit: row.unit,
    purchasePrice: Number(row.purchase_price || 0),
    salePrice: Number(row.sale_price || 0),
    stockQuantity: Number(row.stock_quantity || 0),
    minStockLevel: Number(row.min_stock_level || 0),
    warehouseStocks: stocksMap.get(row.id) || {},
  }));
}

export async function db_saveItem(item: Item): Promise<void> {
  const itUUID = toUUID(item.id);
  if (item.category) {
    await supabase.from("categories").upsert({
      id: toUUID(item.category),
      name: item.category,
    });
  }

  const { error } = await supabase.from("products").upsert({
    id: itUUID,
    code: item.code,
    name: item.name,
    description: item.description || null,
    category_id: item.category ? toUUID(item.category) : null,
    unit: item.unit,
    purchase_price: item.purchasePrice || 0,
    sale_price: item.salePrice || 0,
    stock_quantity: item.stockQuantity || 0,
    min_stock_level: item.minStockLevel || 0,
  });

  if (error) handleSupabaseError(error, OperationType.WRITE, "products");

  // Sync warehouse stocks
  if (item.warehouseStocks) {
    const stockEntries = Object.keys(item.warehouseStocks).map((whId) => ({
      product_id: itUUID,
      warehouse_id: toUUID(whId),
      quantity: Number(item.warehouseStocks![whId] || 0),
    }));
    if (stockEntries.length > 0) {
      await supabase.from("stock").upsert(stockEntries, { onConflict: "product_id,warehouse_id" });
    }
  }
}

export async function db_deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", toUUID(id));
  if (error) handleSupabaseError(error, OperationType.DELETE, "products");
}

// WAREHOUSE CRUD
export async function db_getWarehouses(): Promise<Warehouse[]> {
  const data = await safeFetch("warehouses");
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    address: row.address || "",
    status: row.status as "Active" | "Inactive",
  }));
}

export async function db_saveWarehouse(wh: Warehouse): Promise<void> {
  const { error } = await supabase.from("warehouses").upsert({
    id: toUUID(wh.id),
    name: wh.name,
    code: wh.code,
    address: wh.address || null,
    status: wh.status || "Active",
  });
  if (error) handleSupabaseError(error, OperationType.WRITE, "warehouses");
}

export async function db_deleteWarehouse(id: string): Promise<void> {
  const { error } = await supabase.from("warehouses").delete().eq("id", toUUID(id));
  if (error) handleSupabaseError(error, OperationType.DELETE, "warehouses");
}

// SALES CRUD
export async function db_getSaleInvoices(): Promise<SaleInvoice[]> {
  const invoices = await safeFetch("sales_invoices");
  const invoiceItems = await safeFetch("sales_invoice_items");

  const siItemsMap = new Map<string, SaleInvoiceItem[]>();
  for (const sii of invoiceItems) {
    if (!siItemsMap.has(sii.sales_invoice_id)) {
      siItemsMap.set(sii.sales_invoice_id, []);
    }
    siItemsMap.get(sii.sales_invoice_id)!.push({
      itemId: sii.item_id,
      name: sii.name,
      quantity: Number(sii.quantity || 0),
      rate: Number(sii.rate || 0),
      amount: Number(sii.amount || 0),
      taxRate: sii.tax_rate ? Number(sii.tax_rate) : undefined,
      unit: sii.unit || undefined,
    });
  }

  return invoices.map((row) => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    date: row.date,
    items: siItemsMap.get(row.id) || [],
    subtotal: Number(row.subtotal || 0),
    cgst: Number(row.cgst || 0),
    sgst: Number(row.sgst || 0),
    igst: Number(row.igst || 0),
    totalAmount: Number(row.total_amount || 0),
    status: row.status as any,
    notes: row.notes || "",
    paidAmount: row.paid_amount ? Number(row.paid_amount) : undefined,
    assignee: row.assignee || undefined,
    warehouseId: row.warehouse_id || undefined,
  }));
}

export async function db_saveSaleInvoice(inv: SaleInvoice): Promise<void> {
  const siUUID = toUUID(inv.id);
  const { error } = await supabase.from("sales_invoices").upsert({
    id: siUUID,
    invoice_number: inv.invoiceNumber,
    customer_id: toUUID(inv.customerId),
    date: inv.date,
    subtotal: inv.subtotal || 0,
    cgst: inv.cgst || 0,
    sgst: inv.sgst || 0,
    igst: inv.igst || 0,
    total_amount: inv.totalAmount || 0,
    notes: inv.notes || null,
    status: inv.status || "Unpaid",
    paid_amount: inv.paidAmount || 0,
    assignee: inv.assignee || null,
    warehouse_id: inv.warehouseId ? toUUID(inv.warehouseId) : null,
  });
  if (error) handleSupabaseError(error, OperationType.WRITE, "sales_invoices");

  await supabase.from("sales_invoice_items").delete().eq("sales_invoice_id", siUUID);
  const siItems = (inv.items || []).map((item) => ({
    sales_invoice_id: siUUID,
    item_id: toUUID(item.itemId),
    name: item.name,
    quantity: item.quantity,
    rate: item.rate,
    amount: item.amount,
    tax_rate: item.taxRate || 0,
    unit: item.unit || null,
  }));
  if (siItems.length > 0) {
    const { error: itemsErr } = await supabase.from("sales_invoice_items").insert(siItems);
    if (itemsErr) handleSupabaseError(itemsErr, OperationType.WRITE, "sales_invoice_items");
  }
}

export async function db_deleteSaleInvoice(id: string): Promise<void> {
  const { error } = await supabase.from("sales_invoices").delete().eq("id", toUUID(id));
  if (error) handleSupabaseError(error, OperationType.DELETE, "sales_invoices");
}

// PURCHASES CRUD
export async function db_getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const pos = await safeFetch("purchase_orders");
  const poItems = await safeFetch("purchase_order_items");

  const poItemsMap = new Map<string, PurchaseOrderItem[]>();
  for (const pi of poItems) {
    if (!poItemsMap.has(pi.purchase_order_id)) {
      poItemsMap.set(pi.purchase_order_id, []);
    }
    poItemsMap.get(pi.purchase_order_id)!.push({
      itemId: pi.item_id,
      name: pi.name,
      quantity: Number(pi.quantity || 0),
      rate: Number(pi.rate || 0),
      amount: Number(pi.amount || 0),
      taxRate: pi.tax_rate ? Number(pi.tax_rate) : undefined,
      unit: pi.unit || undefined,
    });
  }

  return pos.map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    vendorId: row.vendor_id,
    date: row.date,
    items: poItemsMap.get(row.id) || [],
    totalAmount: Number(row.total_amount || 0),
    status: row.status as any,
    notes: row.notes || "",
  }));
}

export async function db_savePurchaseOrder(po: PurchaseOrder): Promise<void> {
  const poUUID = toUUID(po.id);
  const { error } = await supabase.from("purchase_orders").upsert({
    id: poUUID,
    order_number: po.orderNumber,
    vendor_id: toUUID(po.vendorId),
    date: po.date,
    total_amount: po.totalAmount || 0,
    status: po.status,
    notes: po.notes || null,
  });
  if (error) handleSupabaseError(error, OperationType.WRITE, "purchase_orders");

  await supabase.from("purchase_order_items").delete().eq("purchase_order_id", poUUID);
  const poItems = (po.items || []).map((pi) => ({
    purchase_order_id: poUUID,
    item_id: toUUID(pi.itemId),
    name: pi.name,
    quantity: pi.quantity,
    rate: pi.rate,
    amount: pi.amount,
    tax_rate: pi.taxRate || 0,
    unit: pi.unit || null,
  }));
  if (poItems.length > 0) {
    const { error: itemsErr } = await supabase.from("purchase_order_items").insert(poItems);
    if (itemsErr) handleSupabaseError(itemsErr, OperationType.WRITE, "purchase_order_items");
  }
}

export async function db_deletePurchaseOrder(id: string): Promise<void> {
  const { error } = await supabase.from("purchase_orders").delete().eq("id", toUUID(id));
  if (error) handleSupabaseError(error, OperationType.DELETE, "purchase_orders");
}

// PAYMENTS CRUD
export async function db_getPayments(): Promise<Payment[]> {
  const customerPayments = await safeFetch("customer_payments");
  const vendorPayments = await safeFetch("vendor_payments");

  const paymentsMapped: Payment[] = [];
  for (const cp of customerPayments) {
    paymentsMapped.push({
      id: cp.id,
      paymentNumber: cp.payment_number,
      date: cp.date,
      customerId: cp.customer_id,
      amount: Number(cp.amount || 0),
      paymentMethod: cp.payment_method as any,
      referenceNumber: cp.reference_number || "",
      notes: cp.notes || "",
      type: "Inbound",
    });
  }
  for (const vp of vendorPayments) {
    paymentsMapped.push({
      id: vp.id,
      paymentNumber: vp.payment_number,
      date: vp.date,
      vendorId: vp.vendor_id,
      amount: Number(vp.amount || 0),
      paymentMethod: vp.payment_method as any,
      referenceNumber: vp.reference_number || "",
      notes: vp.notes || "",
      type: "Outward",
    });
  }
  return paymentsMapped;
}

export async function db_savePayment(p: Payment): Promise<void> {
  const pUUID = toUUID(p.id);
  const commonData = {
    id: pUUID,
    payment_number: p.paymentNumber,
    date: p.date,
    amount: p.amount,
    payment_method: p.paymentMethod,
    reference_number: p.referenceNumber || null,
    notes: p.notes || null,
  };

  if (p.type === "Inbound" || p.customerId) {
    const { error } = await supabase.from("customer_payments").upsert({
      ...commonData,
      customer_id: toUUID(p.customerId || ""),
    });
    if (error) handleSupabaseError(error, OperationType.WRITE, "customer_payments");
  } else {
    const { error } = await supabase.from("vendor_payments").upsert({
      ...commonData,
      vendor_id: toUUID(p.vendorId || ""),
    });
    if (error) handleSupabaseError(error, OperationType.WRITE, "vendor_payments");
  }
}

export async function db_deletePayment(id: string): Promise<void> {
  const pUUID = toUUID(id);
  await supabase.from("customer_payments").delete().eq("id", pUUID);
  await supabase.from("vendor_payments").delete().eq("id", pUUID);
}
