import React, { useState, useEffect, useRef } from "react";
import { ERPState, PurchaseOrderItem, PurchaseReturnItem, GoodsReceiptItem } from "./types";
import { INITIAL_ERP_STATE, INITIAL_TEAM_MEMBERS } from "./data";
import Sidebar from "./components/Sidebar";
import DashboardView from "./components/DashboardView";
import SalesView from "./components/SalesView";
import PurchaseOrdersView from "./components/PurchaseOrdersView";
import PurchaseReturnsView from "./components/PurchaseReturnsView";
import GoodsReceiptsView from "./components/GoodsReceiptsView";
import PurchaseBillsView from "./components/PurchaseBillsView";
import VendorOutstandingView from "./components/VendorOutstandingView";
import CustomerOutstandingView from "./components/CustomerOutstandingView";
import PaymentsView from "./components/PaymentsView";
import ItemsStockView from "./components/ItemsStockView";
import AddItemView from "./components/AddItemView";
import StockInventoryView from "./components/StockInventoryView";
import StockMovementView from "./components/StockMovementView";
import PartiesView from "./components/PartiesView";
import ReportsView from "./components/ReportsView";
import GstReportsView from "./components/GstReportsView";
import LedgerView from "./components/LedgerView";
import AdminUsersView from "./components/AdminUsersView";
import AiAssistant from "./components/AiAssistant";
import LoginView from "./components/LoginView";
import ProductionView from "./components/ProductionView";
import WarehouseMasterView from "./components/WarehouseMasterView";
import StockTransferView from "./components/StockTransferView";
import CompanyFundingView from "./components/CompanyFundingView";
import FactoryExpensesView from "./components/FactoryExpensesView";
import DataBackupView from "./components/DataBackupView";
import { loadStateFromFirestore, saveStateToFirestore, subscribeToStateChanges } from "./firebase";
import { loadStateFromSupabase, saveStateToSupabase, subscribeToSupabaseChanges } from "./lib/supabase";
import { Sparkles, X, CloudLightning, AlertTriangle, CheckCircle, RefreshCw, Loader2, Database, Search, Plus, Calendar, Clock, Bell, ChevronRight, Check, Settings, Menu } from "lucide-react";
import { formatINR, formatDate } from "./utils";
import { motion, AnimatePresence } from "motion/react";

// Helper function to deduplicate collection items by id while preserving order
const deduplicateById = <T extends { id?: string }>(arr: T[] | undefined): T[] => {
  if (!arr || !Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of arr) {
    if (item && typeof item === "object" && item.id) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
      }
    } else if (item) {
      result.push(item);
    }
  }
  return result;
};

// State sanitization helper to guarantee primary Super Admin security while preserving other team members
const sanitizeState = (s: ERPState): ERPState => {
  if (!s) {
    return INITIAL_ERP_STATE;
  }
  
  // Guarantee that every key exists and is of the expected type
  const defaultFundingPartners: any[] = [];

  // Deduplicate sales assignees names
  const rawAssignees = Array.isArray(s.salesAssignees) ? s.salesAssignees : ["Vishal Kumar"];
  const assigneeMap = new Map<string, string>();
  rawAssignees.forEach((name) => {
    if (name && typeof name === "string" && name.trim()) {
      const clean = name.trim();
      const key = clean.toLowerCase();
      if (!assigneeMap.has(key)) {
        assigneeMap.set(key, clean);
      }
    }
  });
  const cleanSalesAssignees = Array.from(assigneeMap.values());

  const merged: ERPState = {
    parties: deduplicateById(s.parties || INITIAL_ERP_STATE.parties || []),
    items: deduplicateById(s.items || INITIAL_ERP_STATE.items || []),
    purchaseOrders: deduplicateById(s.purchaseOrders || INITIAL_ERP_STATE.purchaseOrders || []),
    purchaseReturns: deduplicateById(s.purchaseReturns || INITIAL_ERP_STATE.purchaseReturns || []),
    goodsReceipts: deduplicateById(s.goodsReceipts || INITIAL_ERP_STATE.goodsReceipts || []),
    purchaseBills: deduplicateById(s.purchaseBills || INITIAL_ERP_STATE.purchaseBills || []),
    saleInvoices: deduplicateById(s.saleInvoices || INITIAL_ERP_STATE.saleInvoices || []),
    payments: deduplicateById(s.payments || INITIAL_ERP_STATE.payments || []),
    stockMovements: deduplicateById(s.stockMovements || INITIAL_ERP_STATE.stockMovements || []),
    ledger: deduplicateById(s.ledger || INITIAL_ERP_STATE.ledger || []),
    teamMembers: deduplicateById(s.teamMembers || INITIAL_ERP_STATE.teamMembers || []),
    allowNegativeStock: s.allowNegativeStock ?? INITIAL_ERP_STATE.allowNegativeStock ?? false,
    companyProfile: s.companyProfile || INITIAL_ERP_STATE.companyProfile,
    unitConversions: s.unitConversions || INITIAL_ERP_STATE.unitConversions || [],
    customCategories: Array.from(new Set(s.customCategories || [])),
    customUnits: Array.from(new Set(s.customUnits || [])),
    salesAssignees: cleanSalesAssignees,
    salesAssigneeName: s.salesAssigneeName || "Vishal Kumar",
    warehouses: deduplicateById(s.warehouses || INITIAL_ERP_STATE.warehouses || []),
    stockTransfers: deduplicateById(s.stockTransfers || INITIAL_ERP_STATE.stockTransfers || []),
    fundingPartners: deduplicateById(s.fundingPartners || defaultFundingPartners),
    fundingTransactions: deduplicateById(s.fundingTransactions || []),
    productionRuns: deduplicateById(s.productionRuns || INITIAL_ERP_STATE.productionRuns || []),
    backups: s.backups || [],
    backupSettings: s.backupSettings || { autoBackupEnabled: false, frequency: "Daily" },
    factoryExpenses: deduplicateById(s.factoryExpenses || INITIAL_ERP_STATE.factoryExpenses || []),
  };

  // Make sure team member permissions include companyFunding and factoryExpenses, and actions are initialized
  if (merged.teamMembers) {
    const defaultActions = {
      view: true,
      create: true,
      edit: true,
      delete: true,
      print: true,
      export: true,
    };
    merged.teamMembers = merged.teamMembers.map((m) => {
      const updatedPermissions = {
        ...m.permissions,
        companyFunding: m.permissions.companyFunding !== undefined ? m.permissions.companyFunding : true,
        factoryExpenses: m.permissions.factoryExpenses !== undefined ? m.permissions.factoryExpenses : true,
      };
      const updatedActions = m.actions || defaultActions;
      return {
        ...m,
        permissions: updatedPermissions,
        actions: updatedActions,
      };
    });
  }

  // Migrate item warehouse stocks
  merged.items = merged.items.map((item) => {
    const warehouseStocks = item.warehouseStocks || {};
    const keys = Object.keys(warehouseStocks);
    if (keys.length === 0) {
      const firstWhId = merged.warehouses?.[0]?.id || "wh-main";
      return {
        ...item,
        warehouseStocks: {
          [firstWhId]: item.stockQuantity || 0,
        },
      };
    }
    // Recalculate total stock quantity as sum of all warehouse stocks
    const totalWhStock = Object.values(warehouseStocks).reduce((sum: number, val) => sum + (val || 0), 0);
    return {
      ...item,
      stockQuantity: totalWhStock,
      warehouseStocks,
    };
  });

  // Deduplicate items in existing Purchase Orders (Same item, same vendor)
  merged.purchaseOrders = merged.purchaseOrders.map((po) => {
    const uniqueItems: PurchaseOrderItem[] = [];
    let hasDuplicates = false;
    (po.items || []).forEach((item) => {
      const existing = uniqueItems.find((ui) => ui.itemId === item.itemId);
      if (existing) {
        hasDuplicates = true;
        const oldQty = existing.quantity;
        const newQty = item.quantity;
        existing.quantity += newQty;
        if (oldQty + newQty > 0) {
          existing.rate = (oldQty * existing.rate + newQty * item.rate) / (oldQty + newQty);
        }
        existing.amount = existing.quantity * existing.rate;
      } else {
        uniqueItems.push({ ...item });
      }
    });
    if (hasDuplicates) {
      const subtotal = uniqueItems.reduce((sum, item) => sum + item.amount, 0);
      let cgst = 0;
      let sgst = 0;
      let igst = 0;
      const vendor = merged.parties.find((p) => p.id === po.vendorId);
      const isInterstate = vendor?.gstin ? !vendor.gstin.startsWith("27") : false;
      const isGst = !po.orderNumber.startsWith("DIVI-NG-");
      
      uniqueItems.forEach((item) => {
        const rate = !isGst ? 0 : (item.taxRate || 0);
        if (rate > 0) {
          if (isInterstate) {
            igst += Math.round(item.amount * (rate / 100));
          } else {
            cgst += Math.round(item.amount * (rate / 200));
            sgst += Math.round(item.amount * (rate / 200));
          }
        }
      });
      return {
        ...po,
        items: uniqueItems,
        totalAmount: subtotal + cgst + sgst + igst,
      };
    }
    return po;
  });

  // Deduplicate items in existing Purchase Returns
  merged.purchaseReturns = merged.purchaseReturns.map((pr) => {
    const uniqueItems: PurchaseReturnItem[] = [];
    let hasDuplicates = false;
    (pr.items || []).forEach((item) => {
      const existing = uniqueItems.find((ui) => ui.itemId === item.itemId);
      if (existing) {
        hasDuplicates = true;
        const oldQty = existing.quantity;
        const newQty = item.quantity;
        existing.quantity += newQty;
        if (oldQty + newQty > 0) {
          existing.rate = (oldQty * existing.rate + newQty * item.rate) / (oldQty + newQty);
        }
        existing.amount = existing.quantity * existing.rate;
      } else {
        uniqueItems.push({ ...item });
      }
    });
    if (hasDuplicates) {
      const subtotal = uniqueItems.reduce((sum, item) => sum + item.amount, 0);
      let cgst = 0;
      let sgst = 0;
      let igst = 0;
      const vendor = merged.parties.find((p) => p.id === pr.vendorId);
      const isInterstate = vendor?.gstin ? !vendor.gstin.startsWith("27") : false;
      
      uniqueItems.forEach((item) => {
        const rate = item.taxRate || 0;
        if (rate > 0) {
          if (isInterstate) {
            igst += Math.round(item.amount * (rate / 100));
          } else {
            cgst += Math.round(item.amount * (rate / 200));
            sgst += Math.round(item.amount * (rate / 200));
          }
        }
      });
      return {
        ...pr,
        items: uniqueItems,
        subtotal,
        cgst: Math.round(cgst * 100) / 100,
        sgst: Math.round(sgst * 100) / 100,
        igst: Math.round(igst * 100) / 100,
        totalAmount: Math.round((subtotal + cgst + sgst + igst) * 100) / 100,
      };
    }
    return pr;
  });

  // Deduplicate items in existing Goods Receipts
  merged.goodsReceipts = merged.goodsReceipts.map((grn) => {
    const uniqueItems: GoodsReceiptItem[] = [];
    let hasDuplicates = false;
    (grn.items || []).forEach((item) => {
      const existing = uniqueItems.find((ui) => ui.itemId === item.itemId);
      if (existing) {
        hasDuplicates = true;
        existing.quantityReceived += item.quantityReceived;
      } else {
        uniqueItems.push({ ...item });
      }
    });
    if (hasDuplicates) {
      return {
        ...grn,
        items: uniqueItems,
      };
    }
    return grn;
  });

  const members = merged.teamMembers || [];
  const hasAdmin = members.some((m) => m.role === "Admin" || m.role === "Super Admin");
  
  let finalMembers = [...members];
  if (!hasAdmin && INITIAL_TEAM_MEMBERS.length > 0) {
    finalMembers = [...INITIAL_TEAM_MEMBERS, ...members];
  }

  merged.teamMembers = finalMembers.map((m) => {
    if (m.role === "Admin" || m.role === "Super Admin") {
      return {
        ...m,
        status: "Active" as const,
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
          backupView: true,
          backupExport: true,
          backupRestore: true,
        },
        actions: {
          view: true,
          create: true,
          edit: true,
          delete: true,
          print: true,
          export: true,
        },
      };
    }
    return m;
  });

  return merged;
};

export default function App() {
  const [currentUserEmail, setCurrentUserEmail] = useState<string>(() => {
    return localStorage.getItem("erp_logged_in_email_v1") || "Vishal";
  });

  const [currentUser, setCurrentUser] = useState<any>(() => {
    const loggedIn = localStorage.getItem("erp_logged_in_v1") === "true";
    const email = localStorage.getItem("erp_logged_in_email_v1") || "Vishal";
    return loggedIn ? { uid: "divine-user", email } : null;
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error" | "loading" | "local">("local");
  const [activeDb, setActiveDb] = useState<"firebase" | "supabase">(() => {
    return (localStorage.getItem("erp_primary_db_v1") as "firebase" | "supabase") || "firebase";
  });

  // Keep track of the user email whose data is currently loaded in the 'state' variable
  const loadedEmailRef = useRef<string>(currentUserEmail);

  // Login session state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem("erp_logged_in_v1") === "true";
  });

  const handleLoginSuccess = (userId: string) => {
    localStorage.setItem("erp_logged_in_v1", "true");
    localStorage.setItem("erp_logged_in_email_v1", userId);
    setCurrentUserEmail(userId);
    setCurrentUser({ uid: "divine-user", email: userId });
    setIsLoggedIn(true);
  };

  const handleLogOutSession = () => {
    localStorage.removeItem("erp_logged_in_v1");
    localStorage.removeItem("erp_logged_in_email_v1");
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  // Custom global reset states
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStatePhase, setResetStatePhase] = useState<"idle" | "processing" | "success">("idle");
  const [resetProgressText, setResetProgressText] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const SHARED_STORAGE_KEY = "divine_traders_erp_state_v2_shared";

  const loadSavedLocalState = (): ERPState | null => {
    const savedShared = localStorage.getItem(SHARED_STORAGE_KEY);
    if (savedShared) {
      try {
        return sanitizeState(JSON.parse(savedShared));
      } catch (e) {
        console.error("Failed to parse saved shared state");
      }
    }
    // Fallback search across legacy keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("divine_traders_erp_state_v2_")) {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            const parsed = sanitizeState(JSON.parse(val));
            localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(parsed));
            return parsed;
          } catch (e) {}
        }
      }
    }
    return null;
  };

  const currentSandboxDocId = "divine_traders_state";

  const [state, setState] = useState<ERPState>(() => {
    const loaded = loadSavedLocalState();
    return loaded || sanitizeState(INITIAL_ERP_STATE);
  });

  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [isAiOpen, setIsAiOpen] = useState(false);

  // Navigation pre-fill state variables for upgraded Sales screen actions
  const [paymentsPrefill, setPaymentsPrefill] = useState<any>(null);
  const [ledgerPrefillSearchTerm, setLedgerPrefillSearchTerm] = useState<string>("");
  const [customerOutstandingPrefillSearchTerm, setCustomerOutstandingPrefillSearchTerm] = useState<string>("");
  const [partiesPrefillSearchTerm, setPartiesPrefillSearchTerm] = useState<string>("");
  const [stockMovementPrefillSearchTerm, setStockMovementPrefillSearchTerm] = useState<string>("");

  const [globalSearch, setGlobalSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number>(-1);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Reset active search index on query changes
  useEffect(() => {
    setActiveSearchIndex(-1);
  }, [globalSearch]);

  // Scroll active search item into view
  useEffect(() => {
    if (activeSearchIndex >= 0) {
      const el = document.getElementById(`search-item-${activeSearchIndex}`);
      if (el) {
        el.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeSearchIndex]);

  // Real-time clock updater
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync state changes with localStorage for offline continuity (shared) with safe quota fallback
  useEffect(() => {
    try {
      localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("localStorage quota exceeded, storing pruned state for offline fallback:", e);
      try {
        const { backups, activityLogs, loginHistory, companyProfile, ...rest } = state;
        const cleanCompanyProfile = companyProfile ? {
          ...companyProfile,
          logoUrl: companyProfile.logoUrl?.startsWith("data:") ? "" : companyProfile.logoUrl
        } : undefined;
        const pruned = {
          ...rest,
          companyProfile: cleanCompanyProfile,
          activityLogs: (activityLogs || []).slice(0, 30),
          loginHistory: (loginHistory || []).slice(0, 15),
          backups: []
        };
        localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(pruned));
      } catch (innerErr) {
        console.error("Failed to save pruned state to localStorage:", innerErr);
      }
    }
  }, [state]);

  // Unified loading and synchronization effect (loads local storage state first, then syncs with Firestore)
  useEffect(() => {
    // 1. Load from local storage synchronously first to avoid flash of stale state
    const loadedLocal = loadSavedLocalState();
    let activeState = loadedLocal || sanitizeState(INITIAL_ERP_STATE);
    setState(activeState);
    loadedEmailRef.current = currentUserEmail;

    // 2. If no active sandbox doc, stop here
    if (!currentSandboxDocId) {
      setSyncStatus("local");
      return;
    }

    let isCurrent = true;
    let unsubscribe: (() => void) | null = null;

    async function initSandbox() {
      try {
        setSyncStatus("loading");
        console.log(`ERP Active Database Mode initialized as: ${activeDb}`);

        const dbState = activeDb === "supabase"
          ? await loadStateFromSupabase(currentSandboxDocId)
          : await loadStateFromFirestore(currentSandboxDocId);

        if (!isCurrent) return;

        if (dbState) {
          const sanitizedDb = sanitizeState(dbState as ERPState);
          setState(sanitizedDb);
          localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(sanitizedDb));
          if (JSON.stringify(dbState) !== JSON.stringify(sanitizedDb)) {
            if (activeDb === "supabase") {
              await saveStateToSupabase(sanitizedDb, currentSandboxDocId);
            } else {
              await saveStateToFirestore(sanitizedDb, currentSandboxDocId);
            }
          }
          if (!isCurrent) return;
          setSyncStatus("synced");
        } else {
          // Initialize remote sandbox with the CORRECT loaded state
          if (activeDb === "supabase") {
            await saveStateToSupabase(activeState, currentSandboxDocId);
          } else {
            await saveStateToFirestore(activeState, currentSandboxDocId);
          }
          if (!isCurrent) return;
          setSyncStatus("synced");
        }

        // Live subscription to snapshots
        const sub = activeDb === "supabase"
          ? subscribeToSupabaseChanges((updatedState) => {
              if (!isCurrent) return;
              if (updatedState) {
                setState((prev) => {
                  const sanitized = sanitizeState(updatedState as ERPState);
                  if (JSON.stringify(prev) !== JSON.stringify(sanitized)) {
                    localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(sanitized));
                    return sanitized;
                  }
                  return prev;
                });
              }
            }, currentSandboxDocId)
          : subscribeToStateChanges((updatedState) => {
              if (!isCurrent) return;
              if (updatedState) {
                setState((prev) => {
                  const sanitized = sanitizeState(updatedState as ERPState);
                  if (JSON.stringify(prev) !== JSON.stringify(sanitized)) {
                    localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(sanitized));
                    return sanitized;
                  }
                  return prev;
                });
              }
            }, currentSandboxDocId);

        if (!isCurrent) {
          sub();
        } else {
          unsubscribe = sub;
        }

      } catch (err) {
        if (isCurrent) {
          console.error(`Failed to sync with ${activeDb}, switching to local cache:`, err);
          setSyncStatus("error");
        }
      }
    }

    initSandbox();

    return () => {
      isCurrent = false;
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser, currentSandboxDocId, currentUserEmail, activeDb]);

  const handleUpdateState = (newState: ERPState) => {
    setState(newState);
    if (currentUser && currentSandboxDocId) {
      setSyncStatus("syncing");
      
      const savePromise = activeDb === "supabase"
        ? saveStateToSupabase(newState, currentSandboxDocId)
        : saveStateToFirestore(newState, currentSandboxDocId);

      savePromise
        .then(() => setSyncStatus("synced"))
        .catch((err) => {
          console.error(`Failed to save to ${activeDb}:`, err);
          setSyncStatus("error");
        });
    }
  };

  const triggerResetModal = () => {
    setResetStatePhase("idle");
    setResetProgressText("");
    setShowResetModal(true);
  };

  const executeSystemHardReset = async () => {
    setResetStatePhase("processing");
    
    const stages = [
      "Securing ERP core database pipeline...",
      "Purging customized sales invoices & customer orders...",
      "Flushing ledger records & clearing GST balances...",
      "Recalibrating item registers & physical stock values...",
      "Re-establishing main Super Admin: vishal291137@gmail.com...",
      "Committing default baseline register dataset to storage..."
    ];

    for (let i = 0; i < stages.length; i++) {
      setResetProgressText(stages[i]);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Erase and set state
    localStorage.removeItem(SHARED_STORAGE_KEY);
    setState(INITIAL_ERP_STATE);
    setCurrentUserEmail("vishal291137@gmail.com");
    setSyncStatus("local");

    if (currentUser && currentSandboxDocId) {
      try {
        await saveStateToFirestore(INITIAL_ERP_STATE, currentSandboxDocId);
        setSyncStatus("synced");
      } catch (err) {
        console.error("Firebase cloud wipe error:", err);
        setSyncStatus("error");
      }
    }

    setResetStatePhase("success");
  };

  const getSearchResults = () => {
    if (!globalSearch.trim()) return [];
    const query = globalSearch.toLowerCase().trim();
    const results: Array<{
      id: string;
      title: string;
      category: "Navigation" | "Invoices" | "Purchase Orders" | "Parties" | "Items";
      subtitle: string;
      action: () => void;
    }> = [];

    // 1. Navigation items
    const navs = [
      { id: "dashboard", label: "Dashboard", sub: "Executive metrics & real-time analytics" },
      { id: "sales", label: "Sales & Invoicing", sub: "Issue bills, download GST tax invoices" },
      { id: "purchase-orders", label: "Purchase Orders", sub: "Procurement, track approvals & arrivals" },
      { id: "purchase-returns", label: "Purchase Returns (Debit Note)", sub: "Record goods return & purchase reversals" },
      { id: "goods-receipts", label: "Goods Receipts (GRN)", sub: "Acknowledge incoming warehouse deliveries" },
      { id: "purchase-bills", label: "Purchase Bills", sub: "Record vendor purchase invoices" },
      { id: "vendor-outstanding", label: "Vendor Payables", sub: "Track unpaid purchase liabilities" },
      { id: "customer-outstanding", label: "Customer Outstanding", sub: "Monitor buyer outstanding balances" },
      { id: "payments", label: "Payments Ledger", sub: "Issue, receive, and link payment vouchers" },
      { id: "stock-inventory", label: "Stock & Inventory", sub: "Track warehouse levels, valuations & alerts" },
      { id: "add-item", label: "Add New Item / Service", sub: "Register item codes, tax rates & prices" },
      { id: "stock-movement", label: "Stock Movement Log", sub: "Audit trail of ins, outs, and conversions" },
      { id: "parties", label: "Parties & Contacts", sub: "Manage vendors, customers, and GSTINs" },
      { id: "reports", label: "Financial Reports", sub: "Profit/loss projections & stock summaries" },
      { id: "gst-reports", label: "GST Reports (GSTR-1 / GSTR-2)", sub: "Extract tax liabilities and CGST/SGST breakdowns" },
      { id: "ledger", label: "Double-Entry Ledger Book", sub: "Audit ledger book accounts & journal vouchers" },
      { id: "admin-users", label: "User Management & Settings", sub: "Configure operator permissions, super admin" },
    ];

    navs.forEach((n) => {
      if (n.label.toLowerCase().includes(query) || n.sub.toLowerCase().includes(query)) {
        results.push({
          id: `nav-${n.id}`,
          title: n.label,
          category: "Navigation",
          subtitle: n.sub,
          action: () => {
            setCurrentTab(n.id);
            setGlobalSearch("");
          },
        });
      }
    });

    // 2. Sales Invoices
    (state.saleInvoices || []).forEach((inv) => {
      const customer = state.parties.find((p) => p.id === inv.customerId);
      const custName = customer?.name || "Cash Customer";
      if (
        (inv.invoiceNumber || "").toLowerCase().includes(query) ||
        custName.toLowerCase().includes(query)
      ) {
        results.push({
          id: `inv-${inv.id}`,
          title: `Invoice ${inv.invoiceNumber}`,
          category: "Invoices",
          subtitle: `${custName} • ${formatDate(inv.date)} • Total: ${formatINR(inv.totalAmount)}`,
          action: () => {
            setSelectedInvoiceId(inv.id);
            setCurrentTab("sales");
            setGlobalSearch("");
          },
        });
      }
    });

    // 3. Purchase Orders
    (state.purchaseOrders || []).forEach((po) => {
      const vendor = state.parties.find((p) => p.id === po.vendorId);
      const vendName = vendor?.name || "Unknown Vendor";
      if (
        (po.orderNumber || "").toLowerCase().includes(query) ||
        vendName.toLowerCase().includes(query)
      ) {
        results.push({
          id: `po-${po.id}`,
          title: `Purchase Order ${po.orderNumber}`,
          category: "Purchase Orders",
          subtitle: `${vendName} • Status: ${po.status} • Total: ${formatINR(po.totalAmount)}`,
          action: () => {
            setSelectedOrderId(po.id);
            setCurrentTab("purchase-orders");
            setGlobalSearch("");
          },
        });
      }
    });

    // 4. Parties
    (state.parties || []).forEach((p) => {
      if (
        (p.name || "").toLowerCase().includes(query) ||
        (p.phone && p.phone.toLowerCase().includes(query)) ||
        (p.type || "").toLowerCase().includes(query)
      ) {
        results.push({
          id: `party-${p.id}`,
          title: p.name,
          category: "Parties",
          subtitle: `${p.type} • GSTIN: ${p.gstin || "None"} • Phone: ${p.phone || "N/A"}`,
          action: () => {
            setCurrentTab("parties");
            setGlobalSearch("");
          },
        });
      }
    });

    // 5. Items
    (state.items || []).forEach((item) => {
      if (
        (item.name || "").toLowerCase().includes(query) ||
        (item.code || "").toLowerCase().includes(query) ||
        (item.category || "").toLowerCase().includes(query)
      ) {
        results.push({
          id: `item-${item.id}`,
          title: `${item.code} - ${item.name}`,
          category: "Items",
          subtitle: `Category: ${item.category} • Price: ${formatINR(item.salePrice)} • Stock: ${item.stockQuantity} ${item.unit}`,
          action: () => {
            setCurrentTab("stock-inventory");
            setGlobalSearch("");
          },
        });
      }
    });

    return results.slice(0, 8);
  };

  const teamMembers = state.teamMembers || INITIAL_TEAM_MEMBERS;
  const userQuery = (currentUserEmail || "").toLowerCase();
  const currentMember = teamMembers.find(
    (m) =>
      (m?.userId || "").toLowerCase() === userQuery ||
      (m?.email || "").toLowerCase() === userQuery
  ) || teamMembers[0] || {
    id: "tm-admin-fallback",
    userId: currentUserEmail || "Admin",
    name: currentUserEmail ? currentUserEmail.split("@")[0] : "Administrator",
    email: currentUserEmail || "admin@divinetraders.com",
    role: "Admin",
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
      backupView: true,
      backupExport: true,
      backupRestore: true,
    },
    actions: {
      view: true,
      create: true,
      edit: true,
      delete: true,
      print: true,
      export: true,
    }
  };

  // Check if current tab is allowed. If not, redirect to the first allowed tab.
  useEffect(() => {
    const camelCaseMap: Record<string, string> = {
      "dashboard": "dashboard",
      "sales": "sales",
      "purchase-orders": "purchaseOrders",
      "purchase-returns": "purchaseReturns",
      "goods-receipts": "goodsReceipts",
      "purchase-bills": "purchaseBills",
      "vendor-outstanding": "vendorOutstanding",
      "customer-outstanding": "customerOutstanding",
      "payments": "payments",
      "item-catalog": "itemsStock",
      "stock-inventory": "stockInventory",
      "add-item": "addItem",
      "stock-movement": "stockMovement",
      "parties": "parties",
      "reports": "reports",
      "gst-reports": "gstReports",
      "ledger": "ledger",
      "admin-users": "adminUsers",
      "production": "production",
    };

    const permKey = camelCaseMap[currentTab];
    if (permKey && currentMember.permissions && !(currentMember.permissions as any)[permKey]) {
      // Find first allowed tab
      const orderedTabs = [
        "dashboard",
        "sales",
        "purchase-orders",
        "purchase-returns",
        "goods-receipts",
        "purchase-bills",
        "vendor-outstanding",
        "customer-outstanding",
        "payments",
        "item-catalog",
        "stock-inventory",
        "add-item",
        "stock-movement",
        "parties",
        "reports",
        "gst-reports",
        "ledger",
        "production",
        "admin-users"
      ];
      const allowedTab = orderedTabs.find((tab) => {
        const k = camelCaseMap[tab];
        return k && (currentMember.permissions as any)[k];
      });
      if (allowedTab) {
        setCurrentTab(allowedTab);
      }
    }
  }, [currentUserEmail, currentTab, currentMember.permissions]);

  // Navigation controller mapping
  const renderTabContent = () => {
    switch (currentTab) {
      case "dashboard":
        return (
          <DashboardView
            state={state}
            currentUserEmail={currentUserEmail}
            setCurrentTab={(tab) => {
              if (tab === "po") {
                setCurrentTab("purchase-orders");
              } else {
                setCurrentTab(tab);
              }
            }}
            setSelectedOrderId={setSelectedOrderId}
            setSelectedInvoiceId={setSelectedInvoiceId}
          />
        );
      case "sales":
        return (
          <SalesView
            state={state}
            currentUserEmail={currentUserEmail}
            onUpdateState={handleUpdateState}
            selectedInvoiceId={selectedInvoiceId}
            setSelectedInvoiceId={setSelectedInvoiceId}
            setCurrentTab={setCurrentTab}
            setPaymentsPrefill={setPaymentsPrefill}
            setLedgerPrefillSearchTerm={setLedgerPrefillSearchTerm}
            setCustomerOutstandingPrefillSearchTerm={setCustomerOutstandingPrefillSearchTerm}
            setPartiesPrefillSearchTerm={setPartiesPrefillSearchTerm}
            setStockMovementPrefillSearchTerm={setStockMovementPrefillSearchTerm}
          />
        );
      case "purchase-orders":
        return (
          <PurchaseOrdersView
            state={state}
            currentUserEmail={currentUserEmail}
            onUpdateState={handleUpdateState}
            selectedOrderId={selectedOrderId}
            setSelectedOrderId={setSelectedOrderId}
            setCurrentTab={setCurrentTab}
          />
        );
      case "purchase-returns":
        return (
          <PurchaseReturnsView
            state={state}
            currentUserEmail={currentUserEmail}
            onUpdateState={handleUpdateState}
            setCurrentTab={setCurrentTab}
          />
        );
      case "goods-receipts":
        return (
          <GoodsReceiptsView
            state={state}
            currentUserEmail={currentUserEmail}
            onUpdateState={handleUpdateState}
            setCurrentTab={setCurrentTab}
          />
        );
      case "purchase-bills":
        return (
          <PurchaseBillsView
            state={state}
            currentUserEmail={currentUserEmail}
            onUpdateState={handleUpdateState}
            setCurrentTab={setCurrentTab}
          />
        );
      case "vendor-outstanding":
        return <VendorOutstandingView state={state} currentUserEmail={currentUserEmail} onUpdateState={handleUpdateState} setCurrentTab={setCurrentTab} />;
      case "customer-outstanding":
        return (
          <CustomerOutstandingView
            state={state}
            currentUserEmail={currentUserEmail}
            onUpdateState={handleUpdateState}
            setCurrentTab={setCurrentTab}
            prefillSearchTerm={customerOutstandingPrefillSearchTerm}
            clearPrefill={() => setCustomerOutstandingPrefillSearchTerm("")}
          />
        );
      case "payments":
        return (
          <PaymentsView
            state={state}
            currentUserEmail={currentUserEmail}
            onUpdateState={handleUpdateState}
            prefill={paymentsPrefill}
            clearPrefill={() => setPaymentsPrefill(null)}
          />
        );
      case "item-catalog":
        return <ItemsStockView state={state} onUpdateState={handleUpdateState} />;
      case "stock-inventory":
        return <StockInventoryView state={state} currentUserEmail={currentUserEmail} onUpdateState={handleUpdateState} />;
      case "warehouse-master":
        return <WarehouseMasterView state={state} onUpdateState={handleUpdateState} />;
      case "stock-transfer":
        return <StockTransferView state={state} currentUserEmail={currentUserEmail} onUpdateState={handleUpdateState} />;
      case "add-item":
        return <AddItemView state={state} onUpdateState={handleUpdateState} setCurrentTab={setCurrentTab} />;
      case "stock-movement":
        return (
          <StockMovementView
            state={state}
            currentUserEmail={currentUserEmail}
            prefillSearchTerm={stockMovementPrefillSearchTerm}
            clearPrefill={() => setStockMovementPrefillSearchTerm("")}
          />
        );
      case "parties":
        return (
          <PartiesView
            state={state}
            onUpdateState={handleUpdateState}
            prefillSearchTerm={partiesPrefillSearchTerm}
            clearPrefill={() => setPartiesPrefillSearchTerm("")}
          />
        );
      case "reports":
        return <ReportsView state={state} currentUserEmail={currentUserEmail} onUpdateState={handleUpdateState} />;
      case "gst-reports":
        return <GstReportsView state={state} />;
      case "ledger":
        return (
          <LedgerView
            state={state}
            onUpdateState={handleUpdateState}
            prefillSearchTerm={ledgerPrefillSearchTerm}
            clearPrefill={() => setLedgerPrefillSearchTerm("")}
          />
        );
      case "company-funding":
        return (
          <CompanyFundingView
            state={state}
            onUpdateState={handleUpdateState}
            currentUserRole={currentMember.role}
            currentUserEmail={currentUserEmail}
          />
        );
      case "admin-users":
        return (
          <AdminUsersView
            state={state}
            onUpdateState={handleUpdateState}
            currentUserEmail={currentUserEmail}
            onChangeCurrentUser={setCurrentUserEmail}
            onTriggerReset={triggerResetModal}
            activeDb={activeDb}
            setActiveDb={setActiveDb}
          />
        );
      case "production":
        return (
          <ProductionView
            state={state}
            onUpdateState={handleUpdateState}
          />
        );
      case "factory-expenses":
        return (
          <FactoryExpensesView
            state={state}
            onUpdateState={handleUpdateState}
          />
        );
      case "data-backup":
        return (
          <DataBackupView
            state={state}
            onUpdateState={handleUpdateState}
            currentUserEmail={currentUserEmail}
            userRole={currentMember.role}
            permissions={currentMember.permissions}
          />
        );
      default:
        return (
          <div className="p-8 text-center bg-white border rounded-xl">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">WIP Module</h3>
            <p className="text-gray-500 mt-1">This screen is undergoing operational initialization.</p>
          </div>
        );
    }
  };

  if (!isLoggedIn) {
    return <LoginView onLoginSuccess={handleLoginSuccess} teamMembers={teamMembers} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900 antialiased flex-col lg:flex-row">
      {/* Mobile/Tablet Top Navigation Bar */}
      <div className="flex lg:hidden items-center justify-between bg-white border-b border-slate-200 px-5 py-3 shrink-0 z-30">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-1.5 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Open Menu"
            id="mobile-hamburger-btn"
          >
            {/* Hamburger icon SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-sm italic shadow-xs">
              D
            </div>
            <span className="font-extrabold text-sm tracking-tight text-slate-800 italic">DIVINE TRADERS</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            syncStatus === "synced" 
              ? "bg-emerald-500 animate-pulse" 
              : "bg-amber-500 animate-pulse"
          }`}></div>
          <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">
            {syncStatus === "synced" ? "Online" : syncStatus === "local" ? "Local" : "Syncing"}
          </span>
        </div>
      </div>

      {/* Sidebar with overlay backdrop for mobile */}
      {/* Desktop Sidebar (visible on lg+) */}
      <div className="hidden lg:flex h-full">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onReset={triggerResetModal}
          userEmail={currentMember.email}
          userName={currentMember.name}
          userRole={currentMember.role}
          permissions={currentMember.permissions}
          syncStatus={syncStatus}
          onLogOut={handleLogOutSession}
        />
      </div>

      {/* Mobile/Tablet Sidebar overlay (Drawer slide-in) */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileSidebarOpen(false)}
          ></div>
          {/* Sidebar Drawer */}
          <div className="relative flex flex-col w-64 max-w-xs bg-white h-full shadow-2xl transition-transform">
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition-colors cursor-pointer border border-slate-200 bg-white"
              >
                <X size={14} />
              </button>
            </div>
            <Sidebar
              currentTab={currentTab}
              setCurrentTab={(tab) => {
                setCurrentTab(tab);
                setIsMobileSidebarOpen(false);
              }}
              onReset={() => {
                triggerResetModal();
                setIsMobileSidebarOpen(false);
              }}
              userEmail={currentMember.email}
              userName={currentMember.name}
              userRole={currentMember.role}
              permissions={currentMember.permissions}
              syncStatus={syncStatus}
              onLogOut={() => {
                handleLogOutSession();
                setIsMobileSidebarOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content Stage */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Header Bar (Google Workspace Style) */}
        <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between shrink-0 relative z-40 select-none gap-2">
          {/* Left: Mobile Toggle & Section title / path */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-1.5 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Open Navigation Menu"
            >
              <Menu size={20} />
            </button>
            <div className="hidden lg:flex flex-col">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider font-mono">
                DIVINE ERP v4.2
              </span>
              <span className="text-sm font-extrabold text-slate-800 tracking-tight capitalize">
                {currentTab.replace("-", " ")}
              </span>
            </div>
          </div>

          {/* Center: Search Box */}
          <div className="flex-1 max-w-lg mx-4 relative">
            <div className={`flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 border rounded-2xl transition-all ${
              isSearchFocused ? "bg-white ring-2 ring-indigo-500/25 border-indigo-500" : "border-slate-200 hover:bg-slate-200/50"
            }`}>
              <Search size={16} className={isSearchFocused ? "text-indigo-600" : "text-slate-400"} />
              <input
                type="text"
                value={globalSearch}
                onFocus={() => {
                  setIsSearchFocused(true);
                  setActiveSearchIndex(-1);
                }}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => {
                  const results = getSearchResults();
                  if (results.length === 0) return;

                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveSearchIndex((prev) => 
                      prev < results.length - 1 ? prev + 1 : 0
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveSearchIndex((prev) => 
                      prev > 0 ? prev - 1 : results.length - 1
                    );
                  } else if (e.key === "Enter") {
                    if (activeSearchIndex >= 0 && activeSearchIndex < results.length) {
                      e.preventDefault();
                      results[activeSearchIndex].action();
                      e.currentTarget.blur();
                    }
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setGlobalSearch("");
                    e.currentTarget.blur();
                  }
                }}
                placeholder="Search items, invoices, customers, settings... (e.g., vishal, inv-01)"
                className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              {globalSearch && (
                <button
                  onClick={() => setGlobalSearch("")}
                  className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Suggestions dropdown */}
            {(() => {
              const searchResults = getSearchResults();
              if (!isSearchFocused || globalSearch.trim().length === 0) return null;
              
              return (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-[360px] overflow-y-auto z-50">
                  <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>Search Suggestions</span>
                    <span>{searchResults.length} Found</span>
                  </div>
                  {searchResults.length === 0 ? (
                    <p className="p-4 text-xs text-slate-400 text-center italic">No records match your search criteria</p>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {searchResults.map((item, idx) => {
                        const isHighlighted = idx === activeSearchIndex;
                        return (
                          <button
                            key={item.id}
                            id={`search-item-${idx}`}
                            onMouseDown={item.action}
                            className={`w-full text-left p-3 flex items-start gap-3 transition-colors cursor-pointer group ${
                              isHighlighted 
                                ? "bg-indigo-50 border-l-4 border-indigo-600 pl-2" 
                                : "hover:bg-slate-50/70"
                            }`}
                          >
                            <div className={`p-1.5 rounded-lg shrink-0 ${
                              isHighlighted ? "bg-indigo-100 text-indigo-700" :
                              item.category === "Navigation" ? "bg-indigo-50 text-indigo-600" :
                              item.category === "Invoices" ? "bg-emerald-50 text-emerald-600" :
                              item.category === "Purchase Orders" ? "bg-amber-50 text-amber-600" :
                              item.category === "Parties" ? "bg-blue-50 text-blue-600" :
                              "bg-purple-50 text-purple-600"
                            }`}>
                              {item.category === "Navigation" && <Database size={14} />}
                              {item.category === "Invoices" && <CheckCircle size={14} />}
                              {item.category === "Purchase Orders" && <Plus size={14} />}
                              {item.category === "Parties" && <X size={14} />}
                              {item.category === "Items" && <Database size={14} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs font-bold transition-colors ${
                                isHighlighted ? "text-indigo-900" : "text-slate-800 group-hover:text-indigo-600"
                              }`}>
                                {item.title}
                              </p>
                              <p className={`text-[10px] truncate mt-0.5 ${
                                isHighlighted ? "text-indigo-600" : "text-slate-400"
                              }`}>
                                {item.subtitle}
                              </p>
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md self-center ${
                              isHighlighted ? "bg-indigo-200/50 text-indigo-700" : "bg-slate-100 text-slate-400"
                            }`}>
                              {item.category}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Right: Actions, clock, and user */}
          <div className="flex items-center gap-3">
            {/* Live Monospace Clock */}
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1 text-[11px] font-mono font-semibold text-slate-600">
              <Clock size={12} className="text-slate-400" />
              <span>
                {currentTime.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </span>
            </div>

            {/* Ask CFO AI Sparkle Button */}
            <button
              onClick={() => setIsAiOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-xs font-extrabold shadow-sm hover:shadow-md hover:scale-103 active:scale-98 transition-all cursor-pointer group"
            >
              <Sparkles size={13} className="text-indigo-200 animate-pulse group-hover:rotate-12 transition-transform" />
              <span className="hidden md:inline">Ask CFO AI</span>
            </button>

            {/* Quick Action + Dropdown */}
            <div className="relative group/action">
              <button
                className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-colors cursor-pointer"
                title="Quick Creation"
              >
                <Plus size={15} />
              </button>
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 hidden group-hover/action:block z-50">
                <button
                  onClick={() => {
                    setCurrentTab("sales");
                    setSelectedInvoiceId("");
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Plus size={13} />
                  New Sales Invoice
                </button>
                <button
                  onClick={() => {
                    setCurrentTab("purchase-orders");
                    setSelectedOrderId("");
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Plus size={13} />
                  New Purchase Order
                </button>
                <button
                  onClick={() => setCurrentTab("add-item")}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Plus size={13} />
                  New Inventory Item
                </button>
                <button
                  onClick={() => setCurrentTab("parties")}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Plus size={13} />
                  New Customer/Vendor
                </button>
              </div>
            </div>

            {/* Mini Profile / Logout Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center cursor-pointer select-none border border-indigo-400 shadow-sm uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                {currentMember.name.substring(0, 2)}
              </button>
              
              {/* Dropdown menu */}
              {isProfileOpen && (
                <>
                  {/* Backdrop to close the dropdown on click outside */}
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-1.5 w-56 bg-slate-950 text-white border border-slate-800 rounded-2xl shadow-2xl p-4 z-50 animate-scaleUp">
                    <div className="pb-2 border-b border-slate-800">
                      <p className="text-[9px] uppercase tracking-wider text-indigo-400 font-bold">{currentMember.role}</p>
                      <p className="text-xs font-bold text-slate-100 truncate mt-0.5">{currentMember.name}</p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">{currentMember.email}</p>
                    </div>
                    <div className="pt-2 space-y-1">
                      <button
                        onClick={() => {
                          setCurrentTab("admin-users");
                          setIsProfileOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 text-[11px] text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Settings size={12} />
                        System Settings
                      </button>
                      <button
                        onClick={() => {
                          handleLogOutSession();
                          setIsProfileOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <X size={12} />
                        Sign Out Session
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8 scrollbar-thin scrollbar-thumb-slate-200">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </main>



        {/* Expanding CFO AI Panel overlay drawer */}
        {isAiOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-xs flex justify-end z-50 animate-fadeIn">
            <div className="w-full max-w-4xl lg:max-w-5xl bg-white h-screen shadow-2xl flex flex-col justify-between relative border-l animate-slideIn">
              {/* Close handler */}
              <button
                onClick={() => setIsAiOpen(false)}
                className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-gray-150 text-gray-500 hover:text-gray-900 border rounded-xl z-55 cursor-pointer transition-colors"
                title="Minimize CFO Chat"
              >
                <X size={16} />
              </button>

              <div className="flex-1 overflow-hidden p-4">
                <AiAssistant state={state} />
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
