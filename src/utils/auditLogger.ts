import { ERPState, AuditLogEntry, AuditLogChange } from "../types";
import { formatINR } from "../utils";

const generateAuditId = () => `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

/**
 * Creates a normalized Audit Log Entry
 */
export function createAuditLogEntry(params: {
  userId: string;
  userName: string;
  userEmail?: string;
  role?: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "IMPORT" | "TRANSFER" | "LOGIN" | "STATUS_CHANGE" | "RESET" | string;
  module: string;
  entityId?: string;
  entityName?: string;
  description: string;
  changes?: AuditLogChange[];
  metadata?: Record<string, any>;
  ipAddress?: string;
}): AuditLogEntry {
  return {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    userId: params.userId || "system",
    userName: params.userName || "System Operator",
    userEmail: params.userEmail,
    role: params.role || "Operator",
    action: params.action,
    module: params.module,
    entityId: params.entityId,
    entityName: params.entityName,
    description: params.description,
    changes: params.changes || [],
    metadata: params.metadata,
    ipAddress: params.ipAddress || (typeof window !== "undefined" && window.location.hostname === "localhost" ? "127.0.0.1" : "192.168.1.104"),
  };
}

/**
 * Compares two collection arrays by `id` to detect created, deleted, and modified records
 */
function diffCollection<T extends { id: string }>(
  prevArr: T[] = [],
  nextArr: T[] = [],
  moduleName: string,
  entityLabel: string,
  getIdentifier: (item: T) => { entityId: string; entityName: string },
  getCreateSummary: (item: T) => string,
  getDeleteSummary: (item: T) => string,
  getUpdateChanges: (oldItem: T, newItem: T) => { description: string; changes: AuditLogChange[] } | null,
  user: { userId: string; userName: string; userEmail?: string; role?: string }
): AuditLogEntry[] {
  const entries: AuditLogEntry[] = [];
  const prevMap = new Map<string, T>();
  const nextMap = new Map<string, T>();

  prevArr.forEach((item) => {
    if (item && item.id) prevMap.set(item.id, item);
  });
  nextArr.forEach((item) => {
    if (item && item.id) nextMap.set(item.id, item);
  });

  // 1. Detect CREATED items (in next but not in prev)
  for (const [id, newItem] of nextMap.entries()) {
    if (!prevMap.has(id)) {
      const { entityId, entityName } = getIdentifier(newItem);
      entries.push(
        createAuditLogEntry({
          ...user,
          action: "CREATE",
          module: moduleName,
          entityId,
          entityName,
          description: getCreateSummary(newItem),
        })
      );
    }
  }

  // 2. Detect DELETED items (in prev but not in next)
  for (const [id, oldItem] of prevMap.entries()) {
    if (!nextMap.has(id)) {
      const { entityId, entityName } = getIdentifier(oldItem);
      entries.push(
        createAuditLogEntry({
          ...user,
          action: "DELETE",
          module: moduleName,
          entityId,
          entityName,
          description: getDeleteSummary(oldItem),
        })
      );
    }
  }

  // 3. Detect UPDATED items (in both, check changes)
  for (const [id, newItem] of nextMap.entries()) {
    const oldItem = prevMap.get(id);
    if (oldItem) {
      const updateResult = getUpdateChanges(oldItem, newItem);
      if (updateResult) {
        const { entityId, entityName } = getIdentifier(newItem);
        entries.push(
          createAuditLogEntry({
            ...user,
            action: "UPDATE",
            module: moduleName,
            entityId,
            entityName,
            description: updateResult.description,
            changes: updateResult.changes,
          })
        );
      }
    }
  }

  return entries;
}

/**
 * Deep inspection engine that analyzes state mutations across all ERP business collections
 */
export function detectStateMutations(
  prevState: ERPState,
  nextState: ERPState,
  user: { userId: string; userName: string; userEmail?: string; role?: string }
): AuditLogEntry[] {
  if (!prevState || !nextState) return [];
  const entries: AuditLogEntry[] = [];

  // Helper for basic value diffing
  const checkField = (changes: AuditLogChange[], label: string, field: string, oldVal: any, newVal: any) => {
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        field,
        label,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  };

  // 1. Sales Invoices
  entries.push(
    ...diffCollection(
      prevState.saleInvoices,
      nextState.saleInvoices,
      "Sales & Invoicing",
      "Sales Invoice",
      (inv) => ({
        entityId: inv.id,
        entityName: `Invoice #${inv.invoiceNumber || inv.id}`,
      }),
      (inv) => `Created Sales Invoice #${inv.invoiceNumber || inv.id} for ${formatINR(inv.totalAmount || 0)} (${inv.items?.length || 0} items)`,
      (inv) => `Deleted Sales Invoice #${inv.invoiceNumber || inv.id}`,
      (oldInv, newInv) => {
        const changes: AuditLogChange[] = [];
        checkField(changes, "Invoice Total", "totalAmount", oldInv.totalAmount, newInv.totalAmount);
        checkField(changes, "Status", "status", oldInv.status, newInv.status);
        checkField(changes, "Items Count", "items.length", oldInv.items?.length, newInv.items?.length);
        checkField(changes, "Paid Amount", "paidAmount", oldInv.paidAmount, newInv.paidAmount);
        if (changes.length > 0) {
          return {
            description: `Modified Sales Invoice #${newInv.invoiceNumber || newInv.id} (Status: ${newInv.status || "Active"}, Total: ${formatINR(newInv.totalAmount || 0)})`,
            changes,
          };
        }
        return null;
      },
      user
    )
  );

  // 2. Purchase Orders
  entries.push(
    ...diffCollection(
      prevState.purchaseOrders,
      nextState.purchaseOrders,
      "Purchase Orders",
      "Purchase Order",
      (po) => ({
        entityId: po.id,
        entityName: `PO #${po.orderNumber || po.id}`,
      }),
      (po) => `Created Purchase Order #${po.orderNumber || po.id} for ${formatINR(po.totalAmount || 0)} (Status: ${po.status || "Draft"})`,
      (po) => `Deleted Purchase Order #${po.orderNumber || po.id}`,
      (oldPo, newPo) => {
        const changes: AuditLogChange[] = [];
        checkField(changes, "Status", "status", oldPo.status, newPo.status);
        checkField(changes, "Total Amount", "totalAmount", oldPo.totalAmount, newPo.totalAmount);
        checkField(changes, "Items Count", "items.length", oldPo.items?.length, newPo.items?.length);
        if (changes.length > 0) {
          return {
            description: `Updated Purchase Order #${newPo.orderNumber} (Status: ${newPo.status}, Amount: ${formatINR(newPo.totalAmount)})`,
            changes,
          };
        }
        return null;
      },
      user
    )
  );

  // 3. Purchase Returns
  entries.push(
    ...diffCollection(
      prevState.purchaseReturns,
      nextState.purchaseReturns,
      "Purchase Returns",
      "Purchase Return (Debit Note)",
      (pr) => ({
        entityId: pr.id,
        entityName: `Debit Note #${pr.returnNumber || pr.id}`,
      }),
      (pr) => `Issued Purchase Return #${pr.returnNumber || pr.id} for ${formatINR(pr.totalAmount || 0)}`,
      (pr) => `Deleted Purchase Return #${pr.returnNumber || pr.id}`,
      (oldPr, newPr) => {
        const changes: AuditLogChange[] = [];
        checkField(changes, "Total Amount", "totalAmount", oldPr.totalAmount, newPr.totalAmount);
        if (changes.length > 0) {
          return {
            description: `Updated Purchase Return #${newPr.returnNumber || newPr.id}`,
            changes,
          };
        }
        return null;
      },
      user
    )
  );

  // 4. Goods Receipts (GRN)
  entries.push(
    ...diffCollection(
      prevState.goodsReceipts,
      nextState.goodsReceipts,
      "Goods Receipts",
      "Goods Receipt Note",
      (gr) => ({
        entityId: gr.id,
        entityName: `GRN #${gr.grnNumber || gr.id}`,
      }),
      (gr) => `Received Goods Receipt Note #${gr.grnNumber || gr.id} (Received by: ${gr.receivedBy || "Storekeeper"})`,
      (gr) => `Deleted Goods Receipt Note #${gr.grnNumber || gr.id}`,
      (oldGr, newGr) => {
        const changes: AuditLogChange[] = [];
        checkField(changes, "Received By", "receivedBy", oldGr.receivedBy, newGr.receivedBy);
        checkField(changes, "Warehouse", "warehouseId", oldGr.warehouseId, newGr.warehouseId);
        checkField(changes, "Notes", "notes", oldGr.notes, newGr.notes);
        if (changes.length > 0) {
          return {
            description: `Modified GRN #${newGr.grnNumber || newGr.id}`,
            changes,
          };
        }
        return null;
      },
      user
    )
  );

  // 5. Purchase Bills
  entries.push(
    ...diffCollection(
      prevState.purchaseBills,
      nextState.purchaseBills,
      "Purchase Bills",
      "Purchase Bill",
      (pb) => ({
        entityId: pb.id,
        entityName: `Bill #${pb.billNumber || pb.id}`,
      }),
      (pb) => `Logged Vendor Purchase Bill #${pb.billNumber || pb.id} for ${formatINR(pb.totalAmount || 0)}`,
      (pb) => `Deleted Purchase Bill #${pb.billNumber || pb.id}`,
      (oldPb, newPb) => {
        const changes: AuditLogChange[] = [];
        checkField(changes, "Total Amount", "totalAmount", oldPb.totalAmount, newPb.totalAmount);
        checkField(changes, "Paid Amount", "paidAmount", oldPb.paidAmount, newPb.paidAmount);
        checkField(changes, "Status", "status", oldPb.status, newPb.status);
        if (changes.length > 0) {
          return {
            description: `Updated Purchase Bill #${newPb.billNumber || newPb.id} (Paid: ${formatINR(newPb.paidAmount || 0)}/${formatINR(newPb.totalAmount || 0)})`,
            changes,
          };
        }
        return null;
      },
      user
    )
  );

  // 6. Payments
  entries.push(
    ...diffCollection(
      prevState.payments,
      nextState.payments,
      "Payments",
      "Payment Voucher",
      (pay) => ({
        entityId: pay.id,
        entityName: `Payment #${pay.paymentNumber || pay.id}`,
      }),
      (pay) => `Recorded ${pay.type || "Payment"} #${pay.paymentNumber || pay.id} of ${formatINR(pay.amount || 0)} via ${pay.paymentMethod || "Bank"}`,
      (pay) => `Deleted Payment #${pay.paymentNumber || pay.id} (${formatINR(pay.amount || 0)})`,
      (oldPay, newPay) => {
        const changes: AuditLogChange[] = [];
        checkField(changes, "Amount", "amount", oldPay.amount, newPay.amount);
        checkField(changes, "Method", "paymentMethod", oldPay.paymentMethod, newPay.paymentMethod);
        if (changes.length > 0) {
          return {
            description: `Updated Payment #${newPay.paymentNumber || newPay.id} (Amount: ${formatINR(newPay.amount)})`,
            changes,
          };
        }
        return null;
      },
      user
    )
  );

  // 7. Items & Stock Catalog
  entries.push(
    ...diffCollection(
      prevState.items,
      nextState.items,
      "Items & Stock",
      "Inventory Item",
      (item) => ({
        entityId: item.id,
        entityName: `${item.code} - ${item.name}`,
      }),
      (item) => `Registered new Inventory Item '${item.name}' (${item.code}) with initial stock of ${item.stockQuantity || 0} ${item.unit || "units"}`,
      (item) => `Deleted Inventory Item '${item.name}' (${item.code})`,
      (oldItem, newItem) => {
        const changes: AuditLogChange[] = [];
        checkField(changes, "Stock Qty", "stockQuantity", oldItem.stockQuantity, newItem.stockQuantity);
        checkField(changes, "Sale Price", "salePrice", oldItem.salePrice, newItem.salePrice);
        checkField(changes, "Purchase Price", "purchasePrice", oldItem.purchasePrice, newItem.purchasePrice);
        checkField(changes, "Item Name", "name", oldItem.name, newItem.name);
        checkField(changes, "Warehouse Stocks", "warehouseStocks", oldItem.warehouseStocks, newItem.warehouseStocks);
        if (changes.length > 0) {
          return {
            description: `Adjusted Item '${newItem.name}' (${newItem.code}) [Stock: ${oldItem.stockQuantity ?? 0} -> ${newItem.stockQuantity ?? 0} ${newItem.unit}, Price: ₹${newItem.salePrice}]`,
            changes,
          };
        }
        return null;
      },
      user
    )
  );

  // 8. Parties (Vendors & Customers)
  entries.push(
    ...diffCollection(
      prevState.parties,
      nextState.parties,
      "Parties & Contacts",
      "Party",
      (party) => ({
        entityId: party.id,
        entityName: `${party.name} (${party.type})`,
      }),
      (party) => `Added new ${party.type}: '${party.name}' (GSTIN: ${party.gstin || "Unregistered"}, Mobile: ${party.phone || "N/A"})`,
      (party) => `Removed Party: '${party.name}' (${party.type})`,
      (oldParty, newParty) => {
        const changes: AuditLogChange[] = [];
        checkField(changes, "Party Name", "name", oldParty.name, newParty.name);
        checkField(changes, "Phone", "phone", oldParty.phone, newParty.phone);
        checkField(changes, "GSTIN", "gstin", oldParty.gstin, newParty.gstin);
        checkField(changes, "Opening Balance", "openingBalance", oldParty.openingBalance, newParty.openingBalance);
        if (changes.length > 0) {
          return {
            description: `Updated contact info/GST details for Party '${newParty.name}'`,
            changes,
          };
        }
        return null;
      },
      user
    )
  );

  // 9. Stock Transfers
  entries.push(
    ...diffCollection(
      prevState.stockTransfers || [],
      nextState.stockTransfers || [],
      "Stock Transfer",
      "Stock Transfer",
      (st) => ({
        entityId: st.id,
        entityName: `Transfer #${st.transferNumber || st.id}`,
      }),
      (st) => `Transferred ${st.quantity} units under Transfer #${st.transferNumber || st.id}`,
      (st) => `Deleted Stock Transfer #${st.transferNumber || st.id}`,
      (oldSt, newSt) => {
        const changes: AuditLogChange[] = [];
        checkField(changes, "Quantity", "quantity", oldSt.quantity, newSt.quantity);
        if (changes.length > 0) {
          return {
            description: `Updated Stock Transfer #${newSt.transferNumber || newSt.id}`,
            changes,
          };
        }
        return null;
      },
      user
    )
  );

  // 10. Warehouses
  entries.push(
    ...diffCollection(
      prevState.warehouses || [],
      nextState.warehouses || [],
      "Warehouse Master",
      "Warehouse Location",
      (wh) => ({
        entityId: wh.id,
        entityName: `${wh.name} (${wh.code})`,
      }),
      (wh) => `Created Warehouse location '${wh.name}' (${wh.code})`,
      (wh) => `Removed Warehouse location '${wh.name}' (${wh.code})`,
      (oldWh, newWh) => {
        const changes: AuditLogChange[] = [];
        checkField(changes, "Name", "name", oldWh.name, newWh.name);
        checkField(changes, "Status", "status", oldWh.status, newWh.status);
        if (changes.length > 0) {
          return {
            description: `Updated Warehouse '${newWh.name}' (${newWh.code}) settings`,
            changes,
          };
        }
        return null;
      },
      user
    )
  );

  // 11. Factory Expenses
  entries.push(
    ...diffCollection(
      prevState.factoryExpenses || [],
      nextState.factoryExpenses || [],
      "Factory Expenses",
      "Factory Expense",
      (exp) => ({
        entityId: exp.id,
        entityName: `${exp.expenseNumber || exp.id} - ${exp.category}`,
      }),
      (exp) => `Recorded Factory Expense #${exp.expenseNumber || exp.id} (${exp.category}) for ${formatINR(exp.totalAmount || 0)} to ${exp.payeeName}`,
      (exp) => `Deleted Factory Expense #${exp.expenseNumber || exp.id}`,
      (oldExp, newExp) => {
        const changes: AuditLogChange[] = [];
        checkField(changes, "Total Amount", "totalAmount", oldExp.totalAmount, newExp.totalAmount);
        checkField(changes, "Paid Amount", "paidAmount", oldExp.paidAmount, newExp.paidAmount);
        checkField(changes, "Status", "status", oldExp.status, newExp.status);
        if (changes.length > 0) {
          return {
            description: `Updated Factory Expense #${newExp.expenseNumber} [Status: ${newExp.status}]`,
            changes,
          };
        }
        return null;
      },
      user
    )
  );

  // 12. Team Members & Access Control
  entries.push(
    ...diffCollection(
      prevState.teamMembers || [],
      nextState.teamMembers || [],
      "User Management",
      "Team Member",
      (tm) => ({
        entityId: tm.id,
        entityName: `${tm.name} (${tm.role})`,
      }),
      (tm) => `Provisioned new user account for '${tm.name}' (${tm.email}) with role '${tm.role}'`,
      (tm) => `Revoked/Deleted user account '${tm.name}' (${tm.email})`,
      (oldTm, newTm) => {
        const changes: AuditLogChange[] = [];
        checkField(changes, "Role", "role", oldTm.role, newTm.role);
        checkField(changes, "Status", "status", oldTm.status, newTm.status);
        checkField(changes, "Permissions", "permissions", oldTm.permissions, newTm.permissions);
        checkField(changes, "Actions", "actions", oldTm.actions, newTm.actions);
        if (changes.length > 0) {
          return {
            description: `Updated security permissions & role profile for user '${newTm.name}' (${newTm.email})`,
            changes,
          };
        }
        return null;
      },
      user
    )
  );

  // 13. Production Runs
  entries.push(
    ...diffCollection(
      prevState.productionRuns || [],
      nextState.productionRuns || [],
      "Production Logs",
      "Production Batch",
      (pr) => ({
        entityId: pr.id,
        entityName: `Batch #${pr.batchNumber || pr.id}`,
      }),
      (pr) => `Scheduled Production Batch #${pr.batchNumber || pr.id} for ${pr.quantity} units of ${pr.productName}`,
      (pr) => `Deleted Production Batch #${pr.batchNumber || pr.id}`,
      (oldPr, newPr) => {
        const changes: AuditLogChange[] = [];
        checkField(changes, "Status", "status", oldPr.status, newPr.status);
        checkField(changes, "Quantity", "quantity", oldPr.quantity, newPr.quantity);
        if (changes.length > 0) {
          return {
            description: `Updated Production Batch #${newPr.batchNumber} status to '${newPr.status}'`,
            changes,
          };
        }
        return null;
      },
      user
    )
  );

  // 14. Company Profile Changes
  if (JSON.stringify(prevState.companyProfile) !== JSON.stringify(nextState.companyProfile) && nextState.companyProfile) {
    const changes: AuditLogChange[] = [];
    checkField(changes, "Company Name", "name", prevState.companyProfile?.name, nextState.companyProfile.name);
    checkField(changes, "GSTIN", "gstin", prevState.companyProfile?.gstin, nextState.companyProfile.gstin);
    checkField(changes, "Bank Account", "accountNumber", prevState.companyProfile?.accountNumber, nextState.companyProfile.accountNumber);
    checkField(changes, "Address", "address", prevState.companyProfile?.address, nextState.companyProfile.address);
    if (changes.length > 0) {
      entries.push(
        createAuditLogEntry({
          ...user,
          action: "UPDATE",
          module: "Company Profile",
          entityId: "company-profile",
          entityName: nextState.companyProfile.name || "Company Profile",
          description: `Updated organization settings and bank invoice details`,
          changes,
        })
      );
    }
  }

  // 15. Backups Created
  const prevBackupsCount = prevState.backups?.length || 0;
  const nextBackupsCount = nextState.backups?.length || 0;
  if (nextBackupsCount > prevBackupsCount && nextState.backups && nextState.backups.length > 0) {
    const latestBackup = nextState.backups[0];
    entries.push(
      createAuditLogEntry({
        ...user,
        action: "CREATE",
        module: "Data Backup",
        entityId: latestBackup.id,
        entityName: latestBackup.filename,
        description: `Generated ${latestBackup.type} data snapshot archive (${latestBackup.size})`,
      })
    );
  }

  return entries;
}

/**
 * Returns a new ERPState that automatically encapsulates detected state mutations into `auditLogs`
 */
export function recordStateWithAudit(
  prevState: ERPState,
  nextState: ERPState,
  user: { userId: string; userName: string; userEmail?: string; role?: string },
  explicitEntries?: AuditLogEntry[]
): ERPState {
  const detected = detectStateMutations(prevState, nextState, user);
  const toAppend = [...(explicitEntries || []), ...detected];

  if (toAppend.length === 0) {
    return nextState;
  }

  // Keep existing logs + new logs, deduplicated, capped to latest 1500 to keep high performance
  const existing = nextState.auditLogs || prevState.auditLogs || [];
  const combined = [...toAppend, ...existing];
  
  // Deduplicate by ID
  const seen = new Set<string>();
  const deduplicated: AuditLogEntry[] = [];
  for (const log of combined) {
    if (log && log.id && !seen.has(log.id)) {
      seen.add(log.id);
      deduplicated.push(log);
    }
  }

  const cappedLogs = deduplicated.slice(0, 1500);

  return {
    ...nextState,
    auditLogs: cappedLogs,
  };
}
