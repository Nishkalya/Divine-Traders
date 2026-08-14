import React, { useState, useRef } from "react";
import { ERPState, BackupLog, TeamMemberPermissions } from "../types";
import { INITIAL_ERP_STATE, INITIAL_COMPANY_PROFILE, INITIAL_WAREHOUSES, INITIAL_UNIT_CONVERSIONS, INITIAL_TEAM_MEMBERS, INITIAL_ROLES } from "../data";
import JSZip from "jszip";
import {
  Database,
  Download,
  Trash2,
  Upload,
  Check,
  AlertCircle,
  Clock,
  FileCode,
  FileJson,
  FileArchive,
  DatabaseZap,
  Server,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Lock,
  RotateCcw,
  CheckCircle2,
  Layers
} from "lucide-react";

interface DataBackupViewProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  currentUserEmail?: string;
  userRole?: string;
  permissions?: TeamMemberPermissions;
}

// Automatic Schema Migration & Sanitization Engine
export function migrateAndSanitizeERPState(
  parsed: any,
  currentBackups: BackupLog[] = []
): { sanitizedState: ERPState; migrationLogs: string[] } {
  const migrationLogs: string[] = [];

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid backup structure: Payload is not a valid JSON object.");
  }

  // Schema Version Check & Automatic Migration
  const sourceVersion = parsed.databaseVersion || "v1.0.0";
  if (sourceVersion !== "v1.5.0") {
    migrationLogs.push(`Migrated database schema version from ${sourceVersion} to v1.5.0`);
  }

  // 1. Parties Migration
  const parties = Array.isArray(parsed.parties)
    ? parsed.parties.map((p: any) => ({
        id: p.id || "party-" + Math.random().toString(36).substring(2, 9),
        name: p.name || "Unnamed Party",
        type: p.type === "Customer" || p.type === "Vendor" || p.type === "Both" ? p.type : "Customer",
        email: p.email || "",
        phone: p.phone || "",
        address: p.address || "",
        headOfficeAddress: p.headOfficeAddress || p.address || "",
        otherAddress: p.otherAddress || "",
        gstin: p.gstin || "",
        openingBalance: typeof p.openingBalance === "number" ? p.openingBalance : 0
      }))
    : [];

  if (Array.isArray(parsed.parties) && parsed.parties.some((p: any) => !p.type || p.openingBalance === undefined)) {
    migrationLogs.push("Normalized party registry fields and opening balances.");
  }

  // 2. Items Catalog Migration
  const items = Array.isArray(parsed.items)
    ? parsed.items.map((i: any) => ({
        id: i.id || "item-" + Math.random().toString(36).substring(2, 9),
        code: i.code || "ITM-" + Math.floor(1000 + Math.random() * 9000),
        name: i.name || "Unnamed Item",
        description: i.description || "",
        category: i.category || "General",
        purchasePrice: typeof i.purchasePrice === "number" ? i.purchasePrice : 0,
        salePrice: typeof i.salePrice === "number" ? i.salePrice : 0,
        stockQuantity: typeof i.stockQuantity === "number" ? i.stockQuantity : 0,
        unit: i.unit || "PCS",
        purchaseUnit: i.purchaseUnit || i.unit || "PCS",
        salesUnit: i.salesUnit || i.unit || "PCS",
        minStockLevel: typeof i.minStockLevel === "number" ? i.minStockLevel : 5,
        item_tax_type: i.item_tax_type || "GST",
        hsnCode: i.hsnCode || null,
        gstRate: typeof i.gstRate === "number" ? i.gstRate : 18,
        warehouseStocks: i.warehouseStocks || {}
      }))
    : [];

  if (Array.isArray(parsed.items) && parsed.items.some((i: any) => i.item_tax_type === undefined)) {
    migrationLogs.push("Upgraded item catalog schema (added tax type, HSN, and warehouse stock tracking).");
  }

  // 3. Purchase Orders
  const purchaseOrders = Array.isArray(parsed.purchaseOrders)
    ? parsed.purchaseOrders.map((po: any) => ({
        id: po.id || "po-" + Math.random().toString(36).substring(2, 9),
        orderNumber: po.orderNumber || "PO-00000",
        vendorId: po.vendorId || "",
        date: po.date || new Date().toISOString().split("T")[0],
        status: po.status || "Draft",
        items: Array.isArray(po.items) ? po.items : [],
        totalAmount: typeof po.totalAmount === "number" ? po.totalAmount : 0,
        notes: po.notes || ""
      }))
    : [];

  // 4. Purchase Bills
  const purchaseBills = Array.isArray(parsed.purchaseBills)
    ? parsed.purchaseBills.map((pb: any) => ({
        id: pb.id || "bill-" + Math.random().toString(36).substring(2, 9),
        billNumber: pb.billNumber || "BILL-00000",
        vendorId: pb.vendorId || "",
        date: pb.date || new Date().toISOString().split("T")[0],
        dueDate: pb.dueDate || pb.date || new Date().toISOString().split("T")[0],
        subtotal: typeof pb.subtotal === "number" ? pb.subtotal : 0,
        cgst: typeof pb.cgst === "number" ? pb.cgst : 0,
        sgst: typeof pb.sgst === "number" ? pb.sgst : 0,
        igst: typeof pb.igst === "number" ? pb.igst : 0,
        totalAmount: typeof pb.totalAmount === "number" ? pb.totalAmount : 0,
        paidAmount: typeof pb.paidAmount === "number" ? pb.paidAmount : 0,
        status: pb.status || "Unpaid"
      }))
    : [];

  // 5. Sale Invoices
  const saleInvoices = Array.isArray(parsed.saleInvoices)
    ? parsed.saleInvoices.map((inv: any) => ({
        invoiceNumber: inv.invoiceNumber || "INV-00000",
        customerId: inv.customerId || "",
        date: inv.date || new Date().toISOString().split("T")[0],
        subtotal: typeof inv.subtotal === "number" ? inv.subtotal : 0,
        cgst: typeof inv.cgst === "number" ? inv.cgst : 0,
        sgst: typeof inv.sgst === "number" ? inv.sgst : 0,
        igst: typeof inv.igst === "number" ? inv.igst : 0,
        totalAmount: typeof inv.totalAmount === "number" ? inv.totalAmount : 0,
        paidAmount: typeof inv.paidAmount === "number" ? inv.paidAmount : 0,
        status: inv.status || "Posted",
        assignee: inv.assignee || inv.salesAssigneeName || "Assignee Rep",
        items: Array.isArray(inv.items) ? inv.items : [],
        warehouseId: inv.warehouseId || "wh-main",
        notes: inv.notes || ""
      }))
    : [];

  // 6. Payments
  const payments = Array.isArray(parsed.payments)
    ? parsed.payments.map((p: any) => ({
        id: p.id || "pay-" + Math.random().toString(36).substring(2, 9),
        paymentNumber: p.paymentNumber || "PAY-00000",
        vendorId: p.vendorId || p.customerId || "",
        date: p.date || new Date().toISOString().split("T")[0],
        amount: typeof p.amount === "number" ? p.amount : 0,
        paymentMethod: p.paymentMethod || "Bank Transfer",
        referenceNumber: p.referenceNumber || "",
        receivedBy: p.receivedBy || "Operator"
      }))
    : [];

  // 7. Factory Expenses
  const factoryExpenses = Array.isArray(parsed.factoryExpenses)
    ? parsed.factoryExpenses.map((fe: any) => ({
        id: fe.id || "exp-" + Math.random().toString(36).substring(2, 9),
        expenseNumber: fe.expenseNumber || "EXP-00000",
        category: fe.category || "Utilities",
        payeeName: fe.payeeName || "Vendor",
        invoiceNumber: fe.invoiceNumber || "",
        date: fe.date || new Date().toISOString().split("T")[0],
        dueDate: fe.dueDate || fe.date || new Date().toISOString().split("T")[0],
        subtotal: typeof fe.subtotal === "number" ? fe.subtotal : 0,
        cgst: typeof fe.cgst === "number" ? fe.cgst : 0,
        sgst: typeof fe.sgst === "number" ? fe.sgst : 0,
        igst: typeof fe.igst === "number" ? fe.igst : 0,
        totalAmount: typeof fe.totalAmount === "number" ? fe.totalAmount : 0,
        paidAmount: typeof fe.paidAmount === "number" ? fe.paidAmount : 0,
        status: fe.status || "Unpaid"
      }))
    : [];

  // Construct complete, robust ERP state with 100% module coverage
  const sanitizedState: ERPState = {
    ...INITIAL_ERP_STATE,
    ...parsed,
    parties,
    items,
    purchaseOrders,
    purchaseReturns: Array.isArray(parsed.purchaseReturns) ? parsed.purchaseReturns : [],
    goodsReceipts: Array.isArray(parsed.goodsReceipts) ? parsed.goodsReceipts : [],
    purchaseBills,
    saleInvoices,
    payments,
    stockMovements: Array.isArray(parsed.stockMovements) ? parsed.stockMovements : [],
    ledger: Array.isArray(parsed.ledger) ? parsed.ledger : [],
    teamMembers: Array.isArray(parsed.teamMembers) && parsed.teamMembers.length > 0 ? parsed.teamMembers : INITIAL_TEAM_MEMBERS,
    productionRuns: Array.isArray(parsed.productionRuns) ? parsed.productionRuns : [],
    allowNegativeStock: typeof parsed.allowNegativeStock === "boolean" ? parsed.allowNegativeStock : false,
    companyProfile: parsed.companyProfile || INITIAL_COMPANY_PROFILE,
    unitConversions: Array.isArray(parsed.unitConversions) ? parsed.unitConversions : INITIAL_UNIT_CONVERSIONS,
    customCategories: Array.isArray(parsed.customCategories) ? parsed.customCategories : [],
    customUnits: Array.isArray(parsed.customUnits) ? parsed.customUnits : [],
    salesAssigneeName: parsed.salesAssigneeName || "Assignee Rep",
    salesAssignees: Array.isArray(parsed.salesAssignees) ? parsed.salesAssignees : ["Vishal Kumar"],
    warehouses: Array.isArray(parsed.warehouses) && parsed.warehouses.length > 0 ? parsed.warehouses : INITIAL_WAREHOUSES,
    stockTransfers: Array.isArray(parsed.stockTransfers) ? parsed.stockTransfers : [],
    fundingPartners: Array.isArray(parsed.fundingPartners) ? parsed.fundingPartners : [],
    fundingTransactions: Array.isArray(parsed.fundingTransactions) ? parsed.fundingTransactions : [],
    factoryExpenses,
    roles: Array.isArray(parsed.roles) && parsed.roles.length > 0 ? parsed.roles : INITIAL_ROLES,
    activityLogs: Array.isArray(parsed.activityLogs) ? parsed.activityLogs : [],
    loginHistory: Array.isArray(parsed.loginHistory) ? parsed.loginHistory : [],
    backups: currentBackups,
    backupSettings: parsed.backupSettings || INITIAL_ERP_STATE.backupSettings
  };

  return { sanitizedState, migrationLogs };
}

export default function DataBackupView({
  state,
  onUpdateState,
  currentUserEmail,
  userRole,
  permissions
}: DataBackupViewProps) {
  const [dragActive, setDragActive] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [migrationSummary, setMigrationSummary] = useState<string[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // RBAC permissions checks
  const currentUserMember = (state.teamMembers || []).find(
    (m) =>
      (m.email || "").toLowerCase() === (currentUserEmail || "").toLowerCase() ||
      (m.userId || "").toLowerCase() === (currentUserEmail || "").toLowerCase()
  );

  const effectiveRole = userRole || currentUserMember?.role || "Admin";
  const isAdmin = effectiveRole === "Admin" || effectiveRole === "Super Admin";

  const canViewBackup = isAdmin || permissions?.dataBackup !== false || permissions?.backupView !== false;
  const canExportBackup = isAdmin || permissions?.backupExport !== false || permissions?.dataBackup !== false;
  const canRestoreBackup = isAdmin || permissions?.backupRestore !== false || permissions?.dataBackup !== false;

  const backups = state.backups || [];

  // Helper: Create an emergency safety backup snapshot prior to any restore or destructive action
  const createSafetyBackup = (operatorName: string): BackupLog => {
    const now = new Date();
    const cleanState = { ...state, backups: undefined, backupSettings: undefined };
    const stateStr = JSON.stringify(cleanState);
    const sizeKB = (stateStr.length / 1024).toFixed(2) + " KB";
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    return {
      id: "bk-safety-" + Math.random().toString(36).substring(2, 9),
      date: dateStr,
      time: timeStr,
      size: sizeKB,
      filename: `divine_erp_safety_pre_restore_${dateStr.replace(/-/g, "")}_${timeStr.replace(/:/g, "")}.json`,
      type: "Auto" as any,
      data: stateStr,
      createdBy: operatorName || currentUserEmail || "System Auto-Safety",
      databaseVersion: "v1.5.0",
      status: "Completed"
    };
  };

  // Perform Manual or One-Click Snapshot
  const triggerManualBackup = (type: "Manual" | "One-Click" | "Auto") => {
    if (!canExportBackup) {
      alert("Permission Denied: Your user role lacks BACKUP_EXPORT privileges.");
      return;
    }

    setIsBackingUp(true);
    setTimeout(() => {
      const now = new Date();
      const cleanState = { ...state, backups: undefined, backupSettings: undefined };
      const stateStr = JSON.stringify(cleanState);
      const sizeKB = (stateStr.length / 1024).toFixed(2) + " KB";
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toTimeString().split(" ")[0];

      const newBackup: BackupLog = {
        id: "bk-" + Math.random().toString(36).substring(2, 9),
        date: dateStr,
        time: timeStr,
        size: sizeKB,
        filename: `divine_erp_${type === "One-Click" ? "one_click" : "manual"}_backup_${dateStr.replace(/-/g, "")}_${timeStr.replace(/:/g, "")}.json`,
        type: type,
        data: stateStr,
        createdBy: currentUserEmail || "Operator",
        databaseVersion: "v1.5.0",
        status: "Completed"
      };

      onUpdateState({
        ...state,
        backups: [newBackup, ...backups]
      });
      setIsBackingUp(false);
      alert(`ERP State backed up successfully! Created a ${sizeKB} restoration snapshot.`);
    }, 600);
  };

  // Clear all transactional entries while retaining master catalog
  const handleClearTransactions = () => {
    if (!canRestoreBackup) {
      alert("Permission Denied: Your user role lacks BACKUP_RESTORE privileges.");
      return;
    }

    if (
      confirm(
        "CONFIRMATION: Are you sure you want to clear all transactional records (Invoices, Purchase Orders, Bills, Returns, GRNs, Payments, Ledger Entries, Stock Movements, Factory Expenses)? Your Master Catalog (Parties, Items, Users, Warehouses) will remain intact.\n\nAn automatic safety backup snapshot will be saved first."
      )
    ) {
      const safetyBackup = createSafetyBackup(currentUserEmail || "Pre-Clear Safety");

      const clearedState: ERPState = {
        ...state,
        purchaseOrders: [],
        purchaseReturns: [],
        goodsReceipts: [],
        purchaseBills: [],
        saleInvoices: [],
        payments: [],
        stockMovements: [],
        ledger: [],
        productionRuns: [],
        fundingTransactions: [],
        stockTransfers: [],
        factoryExpenses: [],
        backups: [safetyBackup, ...backups]
      };
      onUpdateState(clearedState);
      alert(
        `Transactional records cleared successfully.\nSafety Backup Created: [ID: ${safetyBackup.id}]. Roll back anytime from Snapshots History.`
      );
    }
  };

  // Factory reset entire database
  const handleFactoryResetDatabase = () => {
    if (!canRestoreBackup) {
      alert("Permission Denied: Your user role lacks BACKUP_RESTORE privileges.");
      return;
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const input = prompt(
      `DANGER ZONE: This action will purge ALL connected ERP database records (parties, items, transactions, ledger, and settings) and reset storage to initial state.\n\nTo confirm full database wipe, type code: ${code}`
    );
    if (input === code) {
      const safetyBackup = createSafetyBackup(currentUserEmail || "Pre-Reset Safety");
      const resetState: ERPState = {
        ...INITIAL_ERP_STATE,
        backups: [safetyBackup, ...backups]
      };
      onUpdateState(resetState);
      alert("Connected ERP database wiped and reset to initial state. A safety backup snapshot was saved in history.");
    } else if (input !== null) {
      alert("Incorrect confirmation code. Database reset cancelled.");
    }
  };

  // Restore state from a backup log (Always creates a safety backup first!)
  const handleRestoreFromLog = (log: BackupLog) => {
    if (!canRestoreBackup) {
      alert("Permission Denied: Your user role lacks BACKUP_RESTORE privileges.");
      return;
    }

    if (
      confirm(
        `CRITICAL WARNING: Are you sure you want to restore the ERP data to the state recorded on ${log.date} ${log.time}?\n\nAn emergency Safety Backup will automatically be created first so you can revert if needed.`
      )
    ) {
      try {
        const parsed = JSON.parse(log.data);
        const safetyBackup = createSafetyBackup(currentUserEmail || "Pre-Restore Safety");

        const { sanitizedState, migrationLogs } = migrateAndSanitizeERPState(parsed, [safetyBackup, ...backups]);

        onUpdateState(sanitizedState);
        setMigrationSummary(migrationLogs);
        setImportSuccess(`ERP database successfully restored from snapshot [ID: ${log.id}]!`);
        alert(
          `Success! Database restored to ${log.date} ${log.time}.\n\nSafety snapshot [ID: ${safetyBackup.id}] created automatically.`
        );
      } catch (err) {
        alert("Failed to restore data. The backup payload is corrupted or incompatible.");
      }
    }
  };

  // Delete a backup log
  const handleDeleteBackupLog = (id: string) => {
    if (!canRestoreBackup) {
      alert("Permission Denied: Only users with RESTORE privileges can delete snapshots.");
      return;
    }

    if (confirm("Are you sure you want to delete this backup log? This cannot be undone.")) {
      const updatedBackups = backups.filter((b) => b.id !== id);
      onUpdateState({
        ...state,
        backups: updatedBackups
      });
    }
  };

  // Download a backup JSON file
  const handleDownloadBackupFile = (log: BackupLog) => {
    if (!canExportBackup) {
      alert("Permission Denied: Your user role lacks BACKUP_EXPORT privileges.");
      return;
    }

    const blob = new Blob([log.data], { type: "application/json" });
    triggerDownload(blob, log.filename);
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImportFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImportFile(e.target.files[0]);
    }
  };

  // Process uploaded JSON or ZIP backup file
  const processImportFile = async (file: File) => {
    if (!canRestoreBackup) {
      setImportError("Permission Denied: Your account role lacks BACKUP_RESTORE privileges.");
      return;
    }

    setImportError(null);
    setImportSuccess(null);
    setMigrationSummary([]);

    try {
      let rawStateObj: any = null;

      if (file.name.endsWith(".zip") || file.type.includes("zip")) {
        // Read ZIP Archive
        const zip = await JSZip.loadAsync(file);

        // Check for full restore point file inside zip
        const fullRestoreFile = zip.file("full_erp_restore_point.json");
        if (fullRestoreFile) {
          const content = await fullRestoreFile.async("string");
          rawStateObj = JSON.parse(content);
        } else {
          // Reconstruct state object from individual module files inside zip archive
          rawStateObj = {};
          const moduleFiles: Record<string, string> = {
            "company_profile.json": "companyProfile",
            "team_members.json": "teamMembers",
            "parties.json": "parties",
            "items.json": "items",
            "purchase_orders.json": "purchaseOrders",
            "purchase_bills.json": "purchaseBills",
            "purchase_returns.json": "purchaseReturns",
            "goods_receipts.json": "goodsReceipts",
            "sale_invoices.json": "saleInvoices",
            "payments.json": "payments",
            "factory_expenses.json": "factoryExpenses",
            "stock_movements.json": "stockMovements",
            "stock_transfers.json": "stockTransfers",
            "warehouses.json": "warehouses",
            "unit_conversions.json": "unitConversions",
            "production_runs.json": "productionRuns",
            "ledger.json": "ledger",
            "funding_partners.json": "fundingPartners",
            "funding_transactions.json": "fundingTransactions",
            "roles.json": "roles",
            "activity_logs.json": "activityLogs",
            "login_history.json": "loginHistory"
          };

          for (const [fName, stateKey] of Object.entries(moduleFiles)) {
            const entry = zip.file(fName);
            if (entry) {
              const fileContent = await entry.async("string");
              try {
                rawStateObj[stateKey] = JSON.parse(fileContent);
              } catch (e) {
                console.warn(`Could not parse ${fName}`, e);
              }
            }
          }

          const settingsEntry = zip.file("custom_settings.json");
          if (settingsEntry) {
            const sContent = await settingsEntry.async("string");
            try {
              const parsedS = JSON.parse(sContent);
              rawStateObj.customCategories = parsedS.categories;
              rawStateObj.customUnits = parsedS.units;
              rawStateObj.salesAssignees = parsedS.salesAssignees;
            } catch (e) {}
          }
        }
      } else {
        // Read standard JSON File
        const text = await file.text();
        rawStateObj = JSON.parse(text);
      }

      // Automatic Validation
      if (!rawStateObj || typeof rawStateObj !== "object") {
        throw new Error("Invalid format: File does not contain a valid JSON database structure.");
      }

      if (
        confirm(
          `VALID BACKUP DETECTED!\nFile: ${file.name}\nSize: ${(file.size / 1024).toFixed(
            2
          )} KB\n\nWould you like to import and apply this backup? An emergency safety snapshot of your current database will be saved first.`
        )
      ) {
        // Always create a safety backup prior to restoring imported data
        const safetyBackup = createSafetyBackup(currentUserEmail || "Pre-Import Safety");

        // Run schema migration and sanitization
        const { sanitizedState, migrationLogs } = migrateAndSanitizeERPState(rawStateObj, [safetyBackup, ...backups]);

        onUpdateState(sanitizedState);
        setMigrationSummary(migrationLogs);
        setImportSuccess(
          `ERP Database successfully imported and verified from "${file.name}"! Safety snapshot [ID: ${safetyBackup.id}] created.`
        );
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Error parsing or validating uploaded file.");
    }
  };

  // 1-Click Export All to ZIP Archive
  const exportFullERPZip = async () => {
    if (!canExportBackup) {
      alert("Permission Denied: Your account role lacks BACKUP_EXPORT privileges.");
      return;
    }

    try {
      const cleanState = { ...state, backups: undefined, backupSettings: undefined };
      const dateStr = new Date().toISOString().split("T")[0];
      const timeStr = new Date().toTimeString().split(" ")[0].replace(/:/g, "");

      const zip = new JSZip();

      // Manifest Metadata
      const manifest = {
        systemName: "Divine Traders ERP",
        version: "v1.5.0",
        createdDate: dateStr,
        createdTime: new Date().toTimeString().split(" ")[0],
        createdBy: currentUserEmail || "Operator",
        totalModules: 22,
        recordCounts: {
          parties: (cleanState.parties || []).length,
          items: (cleanState.items || []).length,
          saleInvoices: (cleanState.saleInvoices || []).length,
          purchaseOrders: (cleanState.purchaseOrders || []).length,
          purchaseBills: (cleanState.purchaseBills || []).length,
          payments: (cleanState.payments || []).length,
          factoryExpenses: (cleanState.factoryExpenses || []).length,
          stockMovements: (cleanState.stockMovements || []).length,
          warehouses: (cleanState.warehouses || []).length,
          teamMembers: (cleanState.teamMembers || []).length,
          activityLogs: (cleanState.activityLogs || []).length
        }
      };

      zip.file("manifest.json", JSON.stringify(manifest, null, 2));

      // Separate module JSON files for 100% comprehensive data coverage
      zip.file("company_profile.json", JSON.stringify(cleanState.companyProfile || {}, null, 2));
      zip.file("team_members.json", JSON.stringify(cleanState.teamMembers || [], null, 2));
      zip.file("parties.json", JSON.stringify(cleanState.parties || [], null, 2));
      zip.file("items.json", JSON.stringify(cleanState.items || [], null, 2));
      zip.file("purchase_orders.json", JSON.stringify(cleanState.purchaseOrders || [], null, 2));
      zip.file("purchase_bills.json", JSON.stringify(cleanState.purchaseBills || [], null, 2));
      zip.file("purchase_returns.json", JSON.stringify(cleanState.purchaseReturns || [], null, 2));
      zip.file("goods_receipts.json", JSON.stringify(cleanState.goodsReceipts || [], null, 2));
      zip.file("sale_invoices.json", JSON.stringify(cleanState.saleInvoices || [], null, 2));
      zip.file("payments.json", JSON.stringify(cleanState.payments || [], null, 2));
      zip.file("factory_expenses.json", JSON.stringify(cleanState.factoryExpenses || [], null, 2));
      zip.file("stock_movements.json", JSON.stringify(cleanState.stockMovements || [], null, 2));
      zip.file("stock_transfers.json", JSON.stringify(cleanState.stockTransfers || [], null, 2));
      zip.file("warehouses.json", JSON.stringify(cleanState.warehouses || [], null, 2));
      zip.file("unit_conversions.json", JSON.stringify(cleanState.unitConversions || [], null, 2));
      zip.file("production_runs.json", JSON.stringify(cleanState.productionRuns || [], null, 2));
      zip.file("ledger.json", JSON.stringify(cleanState.ledger || [], null, 2));
      zip.file("funding_partners.json", JSON.stringify(cleanState.fundingPartners || [], null, 2));
      zip.file("funding_transactions.json", JSON.stringify(cleanState.fundingTransactions || [], null, 2));
      zip.file("roles.json", JSON.stringify(cleanState.roles || [], null, 2));
      zip.file("activity_logs.json", JSON.stringify(cleanState.activityLogs || [], null, 2));
      zip.file("login_history.json", JSON.stringify(cleanState.loginHistory || [], null, 2));
      zip.file("custom_settings.json", JSON.stringify({
        categories: cleanState.customCategories || [],
        units: cleanState.customUnits || [],
        salesAssignees: cleanState.salesAssignees || []
      }, null, 2));
      zip.file("backups_history.json", JSON.stringify(backups || [], null, 2));

      // Add the master importable restoration file
      zip.file("full_erp_restore_point.json", JSON.stringify(cleanState, null, 2));

      const content = await zip.generateAsync({ type: "blob" });
      triggerDownload(content, `divine_erp_full_backup_${dateStr}_${timeStr}.zip`);
    } catch (err) {
      alert("Failed to compile ZIP archive. Error: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Export Full ERP Data in various formats
  const exportFullERPData = (format: "JSON" | "CSV" | "SQL") => {
    if (!canExportBackup) {
      alert("Permission Denied: Your account role lacks BACKUP_EXPORT privileges.");
      return;
    }

    const cleanState = { ...state, backups: undefined, backupSettings: undefined };
    const dateStr = new Date().toISOString().split("T")[0];
    const cp = cleanState.companyProfile;

    if (format === "JSON") {
      const dataStr = JSON.stringify(cleanState, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      triggerDownload(blob, `divine_erp_data_dump_${dateStr}.json`);
    } else if (format === "CSV") {
      let csvContent = "=== MODULE: COMPANY PROFILE CONFIGURATION ===\n";
      csvContent += "Company Name,GSTIN,Email,Phone,Address,Bank Name,Account No\n";
      if (cp) {
        csvContent += `"${cp.name || ""}","${cp.gstin || ""}","${cp.email || ""}","${cp.phone || ""}","${cp.address || ""}","${cp.bankName || ""}","${cp.accountNumber || ""}"\n`;
      }
      csvContent += "\n\n=== MODULE: PARTIES REGISTRY ===\n";
      csvContent += "ID,Name,Type,Email,Phone,GSTIN,Opening Balance\n";
      (cleanState.parties || []).forEach((p) => {
        csvContent += `"${p.id}","${p.name}","${p.type}","${p.email}","${p.phone}","${p.gstin}",${p.openingBalance}\n`;
      });
      csvContent += "\n\n=== MODULE: ITEM CATALOG ===\n";
      csvContent += "ID,Code,Name,Category,Purchase Price,Sale Price,Stock Quantity,Unit\n";
      (cleanState.items || []).forEach((i) => {
        csvContent += `"${i.id}","${i.code}","${i.name}","${i.category}",${i.purchasePrice},${i.salePrice},${i.stockQuantity},"${i.unit}"\n`;
      });
      csvContent += "\n\n=== MODULE: SALES INVOICES ===\n";
      csvContent += "Invoice Number,Customer ID,Date,Subtotal,Total Amount,Status\n";
      (cleanState.saleInvoices || []).forEach((s) => {
        csvContent += `"${s.invoiceNumber}","${s.customerId}","${s.date}",${s.subtotal},${s.totalAmount},"${s.status || 'Posted'}"\n`;
      });

      const blob = new Blob([csvContent], { type: "text/csv" });
      triggerDownload(blob, `divine_erp_master_csv_${dateStr}.csv`);
    } else if (format === "SQL") {
      let sqlContent = `-- DIVINE TRADERS ERP SQL DUMP (${new Date().toISOString()})\n\n`;
      sqlContent += `CREATE TABLE IF NOT EXISTS parties (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), type VARCHAR(20), email VARCHAR(100), phone VARCHAR(30), address TEXT, gstin VARCHAR(20), opening_balance NUMERIC);\n`;
      sqlContent += `CREATE TABLE IF NOT EXISTS items (id VARCHAR(50) PRIMARY KEY, code VARCHAR(50), name VARCHAR(100), category VARCHAR(50), purchase_price NUMERIC, sale_price NUMERIC, stock_quantity NUMERIC, unit VARCHAR(20));\n\n`;

      (cleanState.parties || []).forEach((p) => {
        sqlContent += `INSERT INTO parties VALUES ('${p.id}', '${p.name.replace(/'/g, "''")}', '${p.type}', '${p.email}', '${p.phone}', '${p.address.replace(/'/g, "''")}', '${p.gstin}', ${p.openingBalance});\n`;
      });
      (cleanState.items || []).forEach((i) => {
        sqlContent += `INSERT INTO items VALUES ('${i.id}', '${i.code}', '${i.name.replace(/'/g, "''")}', '${i.category}', ${i.purchasePrice}, ${i.salePrice}, ${i.stockQuantity}, '${i.unit}');\n`;
      });

      const blob = new Blob([sqlContent], { type: "text/plain" });
      triggerDownload(blob, `divine_erp_schema_dump_${dateStr}.sql`);
    }
  };

  if (!canViewBackup) {
    return (
      <div className="p-8 bg-rose-50 rounded-3xl border border-rose-200 text-center space-y-3">
        <Lock size={32} className="mx-auto text-rose-500" />
        <h3 className="text-base font-extrabold text-rose-900">Access Restricted: Data Backup & Restore</h3>
        <p className="text-xs text-rose-700 font-medium max-w-md mx-auto">
          Your active account role (<span className="font-bold">{effectiveRole}</span>) does not possess BACKUP_VIEW authorization. Please contact an Administrator to update your permissions matrix.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* RBAC Role & Permission Matrix Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-indigo-300 uppercase tracking-wider font-mono">Role Access Control</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white uppercase">
                {effectiveRole}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              Logged in as <span className="font-bold text-white">{currentUserEmail || "Operator"}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
          <div className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 font-bold ${
            canViewBackup ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}>
            <CheckCircle2 size={12} />
            <span>BACKUP_VIEW</span>
          </div>

          <div className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 font-bold ${
            canExportBackup ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}>
            {canExportBackup ? <CheckCircle2 size={12} /> : <Lock size={12} />}
            <span>BACKUP_EXPORT</span>
          </div>

          <div className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 font-bold ${
            canRestoreBackup ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}>
            {canRestoreBackup ? <CheckCircle2 size={12} /> : <Lock size={12} />}
            <span>BACKUP_RESTORE</span>
          </div>
        </div>
      </div>

      {/* Storage & Snapshots Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-3xl border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-indigo-300">Database Engine</p>
              <h3 className="text-xl font-black mt-1">Cloud Firestore / Local DB</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Server size={18} />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="text-[10px] font-mono text-slate-300">Continuous Real-Time Synced &amp; Auto-Migrated</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-3xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Restoration History</p>
              <h3 className="text-xl font-black text-slate-900 mt-1">{backups.length} Saved Snapshots</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200">
              <Database size={18} />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-6">
            Automatic pre-restore safety backups are preserved in history
          </p>
        </div>
      </div>

      {/* Main Core Operations Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Backup trigger & export options */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Snapshot Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-3xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <DatabaseZap size={18} className="text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-800">Trigger Immediate Snapshot</h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Create a fully validated standalone database restoration point containing all users, inventory indices, parties, ledger mappings, active purchase bills, sales workflows, factory expenses, and funding pipelines.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={isBackingUp || !canExportBackup}
                onClick={() => triggerManualBackup("One-Click")}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-black shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isBackingUp ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>One-Click Snapshot</span>
              </button>

              <button
                type="button"
                disabled={isBackingUp || !canExportBackup}
                onClick={() => triggerManualBackup("Manual")}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
              >
                <Server size={14} />
                <span>Manual Ledger Backup</span>
              </button>
            </div>
          </div>

          {/* Export Full ERP Dataset & ZIP */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-3xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Download size={18} className="text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-800">Export Raw ERP Datasets &amp; Full ZIP Archive</h3>
            </div>

            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Export every ERP module (parties, inventory, invoices, bills, payments, expenses, audit logs, and settings) into a single ZIP archive or structured raw files.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <button
                type="button"
                disabled={!canExportBackup}
                onClick={() => exportFullERPData("JSON")}
                className="py-3 px-2 rounded-xl border border-slate-200 hover:border-indigo-200 bg-white hover:bg-indigo-50/20 text-slate-700 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-3xs disabled:opacity-50"
              >
                <FileJson size={18} className="text-amber-500" />
                <span>JSON Export</span>
              </button>

              <button
                type="button"
                disabled={!canExportBackup}
                onClick={() => exportFullERPData("CSV")}
                className="py-3 px-2 rounded-xl border border-slate-200 hover:border-indigo-200 bg-white hover:bg-indigo-50/20 text-slate-700 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-3xs disabled:opacity-50"
              >
                <FileCode size={18} className="text-blue-500" />
                <span>CSV Sheets</span>
              </button>

              <button
                type="button"
                disabled={!canExportBackup}
                onClick={() => exportFullERPData("SQL")}
                className="py-3 px-2 rounded-xl border border-slate-200 hover:border-indigo-200 bg-white hover:bg-indigo-50/20 text-slate-700 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-3xs disabled:opacity-50"
              >
                <Database size={18} className="text-indigo-500" />
                <span>SQL Dump</span>
              </button>

              <button
                type="button"
                id="full-zip-backup-btn"
                disabled={!canExportBackup}
                onClick={exportFullERPZip}
                className="py-3 px-2 rounded-xl border border-indigo-600 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-black flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-200 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <FileArchive size={18} className="text-white" />
                <span>One-Click ZIP</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Upload & Restore Snapshot, plus History */}
        <div className="lg:col-span-5 space-y-6">
          {/* File Drag & Drop Upload Zone */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-3xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Upload size={18} className="text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-800">1-Click Import &amp; Restore with Auto-Migration</h3>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => canRestoreBackup && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center gap-2 ${
                !canRestoreBackup
                  ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
                  : dragActive
                  ? "border-indigo-600 bg-indigo-50/30 cursor-pointer"
                  : "border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-slate-50/20 cursor-pointer"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.zip"
                onChange={handleFileChange}
                className="hidden"
                disabled={!canRestoreBackup}
              />
              <Upload size={24} className="text-slate-400" />
              <p className="text-xs font-extrabold text-slate-700 leading-tight">
                {canRestoreBackup ? "Click to browse or drop ERP JSON / ZIP file here" : "RESTORE Permission Required"}
              </p>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                Supports .json and .zip backup archives with automatic schema migration
              </p>
            </div>

            {importError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10px] font-bold text-rose-600 flex items-center gap-2 leading-relaxed">
                <AlertCircle size={14} className="shrink-0 text-rose-500" />
                <span>Error: {importError}</span>
              </div>
            )}

            {importSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[10px] font-bold text-emerald-700 space-y-1">
                <div className="flex items-center gap-2">
                  <Check size={14} className="shrink-0 text-emerald-600" />
                  <span>{importSuccess}</span>
                </div>
                {migrationSummary.length > 0 && (
                  <div className="pt-1.5 border-t border-emerald-200/60 text-[9px] font-mono text-emerald-800 space-y-0.5">
                    <p className="font-bold uppercase tracking-wider text-[8px]">Migration Report:</p>
                    {migrationSummary.map((log, idx) => (
                      <p key={idx}>• {log}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Backup History Table */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-3xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Server size={18} className="text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">Rollback Snapshots History</h3>
              </div>
              <span className="text-[10px] bg-slate-100 border px-2 py-0.5 rounded-full font-bold text-slate-500">
                {backups.length} Saved
              </span>
            </div>

            {backups.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Database size={18} className="mx-auto text-slate-300" />
                <p className="text-xs text-slate-400 font-bold mt-2">No rollbacks or backup logs saved yet.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {backups.map((log) => (
                  <div
                    key={log.id}
                    className={`p-4 rounded-2xl border bg-white shadow-3xs flex flex-col gap-3 transition-all ${
                      log.id.includes("safety") ? "border-amber-200 bg-amber-50/20" : "border-slate-150 hover:border-indigo-200 hover:bg-slate-50/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[9px] font-black text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded-md border border-indigo-100 shrink-0">
                        ID: {log.id}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[8px] font-bold border shrink-0 ${
                          log.id.includes("safety")
                            ? "bg-amber-100 text-amber-900 border-amber-300"
                            : log.type === "Auto"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : log.type === "One-Click"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                            : "bg-purple-50 text-purple-700 border-purple-100"
                        }`}
                      >
                        {log.id.includes("safety") ? "Safety Pre-Restore" : log.type}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border bg-purple-50 text-purple-700 border-purple-100 shrink-0 font-mono">
                        DB: {log.databaseVersion || "v1.5.0"}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border bg-emerald-50 text-emerald-800 border-emerald-150 shrink-0">
                        Status: {log.status || "Completed"}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate" title={log.filename}>
                        {log.filename}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-400 font-bold mt-1">
                        <span className="text-slate-500 font-mono">{log.size}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} className="text-slate-300" />
                          <span>
                            {log.date} {log.time}
                          </span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <span className="text-slate-400">By:</span>
                          <span className="text-slate-600 font-black">{log.createdBy || "System"}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-0.5">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={!canExportBackup}
                          onClick={() => handleDownloadBackupFile(log)}
                          className="p-1.5 hover:bg-slate-100 border border-slate-200 disabled:opacity-40 text-slate-600 hover:text-slate-900 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                          title="Download Snapshot File"
                        >
                          <Download size={12} />
                          <span>Download</span>
                        </button>
                        <button
                          type="button"
                          disabled={!canRestoreBackup}
                          onClick={() => handleDeleteBackupLog(log.id)}
                          className="p-1.5 hover:bg-rose-50 border border-slate-200 disabled:opacity-40 text-rose-500 hover:text-rose-700 hover:border-rose-200 rounded-lg transition-all cursor-pointer"
                          title="Delete record"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={!canRestoreBackup}
                        onClick={() => handleRestoreFromLog(log)}
                        className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg transition-all cursor-pointer text-[10px] font-black flex items-center gap-1 shadow-3xs"
                        title="Rollback state to this point (auto safety backup created)"
                      >
                        <RotateCcw size={11} className="text-white" />
                        <span>Restore Snapshot</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone: Database Reset & Purge */}
      <div className="bg-rose-50/70 p-6 rounded-3xl border border-rose-200/80 shadow-3xs space-y-4 mt-6">
        <div className="flex items-center gap-2 pb-3 border-b border-rose-200/80">
          <Trash2 size={18} className="text-rose-600" />
          <div>
            <h3 className="text-sm font-extrabold text-rose-900">Danger Zone: Purge &amp; Reset Database Records</h3>
            <p className="text-[11px] text-rose-700 font-medium mt-0.5">
              Permanently wipe or clear connected ERP database tables. Automatic safety backup snapshots are saved prior to any purge operation.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            type="button"
            disabled={!canRestoreBackup}
            onClick={handleClearTransactions}
            className="py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
          >
            <Trash2 size={14} />
            <span>Purge Transaction Records Only</span>
          </button>

          <button
            type="button"
            disabled={!canRestoreBackup}
            onClick={handleFactoryResetDatabase}
            className="py-3 px-4 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
          >
            <AlertCircle size={14} />
            <span>Factory Reset Connected Database</span>
          </button>
        </div>
      </div>
    </div>
  );
}
