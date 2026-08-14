import React from "react";
import { motion } from "motion/react";
import {
  LayoutGrid,
  ShoppingCart,
  ClipboardList,
  Package,
  Receipt,
  Landmark,
  Wallet,
  Boxes,
  ArrowLeftRight,
  Users,
  BarChart3,
  Percent,
  BookOpen,
  ShieldCheck,
  LogOut,
  Sparkles,
  RefreshCw,
  Undo2,
  Warehouse,
  Trash2,
  PlusCircle,
  Cloud,
  Database,
  Coins,
  Building2,
} from "lucide-react";
import { TeamMemberPermissions } from "../types";

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onReset: () => void;
  userEmail: string;
  userName?: string;
  userRole?: string;
  permissions?: TeamMemberPermissions;
  syncStatus?: "synced" | "syncing" | "error" | "loading" | "local";
  onLogOut?: () => void;
}

export default function Sidebar({
  currentTab,
  setCurrentTab,
  onReset,
  userEmail,
  userName = "Vishal Kumar",
  userRole = "Administrator",
  permissions,
  syncStatus = "synced",
  onLogOut,
}: SidebarProps) {

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "sales", label: "Sales", icon: ShoppingCart },
    { id: "purchase-orders", label: "Purchase Orders", icon: ClipboardList },
    { id: "purchase-returns", label: "Purchase Returns", icon: Undo2 },
    { id: "goods-receipts", label: "Goods Receipts", icon: Package },
    { id: "purchase-bills", label: "Purchase Bills", icon: Receipt },
    { id: "vendor-outstanding", label: "Vendor Payables", icon: Landmark },
    { id: "customer-outstanding", label: "Customer Outstanding", icon: Landmark },
    { id: "payments", label: "Payments", icon: Wallet },
    { id: "factory-expenses", label: "Factory Expenses", icon: Building2 },
    { id: "stock-inventory", label: "Stock & Inventory", icon: Warehouse },
    { id: "warehouse-master", label: "Warehouse Master", icon: Boxes },
    { id: "stock-transfer", label: "Stock Transfer", icon: ArrowLeftRight },
    { id: "add-item", label: "Add Item", icon: PlusCircle },
    { id: "stock-movement", label: "Stock Movement", icon: ArrowLeftRight },
    { id: "parties", label: "Parties", icon: Users },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "gst-reports", label: "GST Reports", icon: Percent },
    { id: "ledger", label: "Ledger", icon: BookOpen },
    { id: "company-funding", label: "Company Funding", icon: Coins },
    { id: "production", label: "Production Logs", icon: ArrowLeftRight },
    { id: "admin-users", label: "User Module & Admin", icon: ShieldCheck },
    { id: "data-backup", label: "Data Backup & Restore", icon: Database },
  ];

  const camelCaseMap: Record<string, keyof TeamMemberPermissions> = {
    "dashboard": "dashboard",
    "sales": "sales",
    "purchase-orders": "purchaseOrders",
    "purchase-returns": "purchaseReturns",
    "goods-receipts": "goodsReceipts",
    "purchase-bills": "purchaseBills",
    "vendor-outstanding": "vendorOutstanding",
    "customer-outstanding": "customerOutstanding",
    "payments": "payments",
    "factory-expenses": "factoryExpenses",
    "stock-inventory": "stockInventory",
    "warehouse-master": "stockInventory",
    "stock-transfer": "stockInventory",
    "add-item": "addItem",
    "stock-movement": "stockMovement",
    "parties": "parties",
    "reports": "reports",
    "gst-reports": "gstReports",
    "ledger": "ledger",
    "company-funding": "companyFunding",
    "admin-users": "adminUsers",
    "production": "production",
    "data-backup": "dataBackup",
  };

  const allowedMenuItems = menuItems.filter((item) => {
    if (!permissions) return true;
    const permKey = camelCaseMap[item.id];
    return permKey ? !!permissions[permKey] : true;
  });

  return (
    <div className="w-64 h-full bg-white text-slate-800 flex flex-col justify-between select-none shrink-0 border-r border-slate-200">
      {/* Brand Header */}
      <div className="p-6 flex flex-col gap-1.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg italic shadow-sm">
            D
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 italic">
            DIVINE TRADERS
          </h1>
        </div>
        
        <div className="flex flex-col gap-1 mt-1.5">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-slate-500 font-bold">
              v4.2.1-STABLE
            </span>
          </div>

          <div className="mt-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between w-full">
            <span className="text-[9px] font-mono tracking-wider uppercase text-slate-400 font-extrabold px-1">Data Store</span>
            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm font-bold border border-slate-150 bg-white shadow-3xs">
              <div className={`w-1.5 h-1.5 rounded-full ${
                syncStatus === "synced" 
                  ? "bg-emerald-500 animate-pulse" 
                  : syncStatus === "syncing"
                  ? "bg-blue-500 animate-spin"
                  : syncStatus === "loading"
                  ? "bg-amber-500 animate-bounce"
                  : "bg-indigo-500 animate-pulse"
              }`}></div>
              <span className="text-[8px] font-mono uppercase text-slate-600">
                {syncStatus === "synced" && "Cloud Live"}
                {syncStatus === "syncing" && "Saving..."}
                {syncStatus === "loading" && "Loading..."}
                {syncStatus === "local" && "Offline DB"}
                {syncStatus === "error" && "Sync Err"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav Menu Items */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-200 relative z-10">
        {allowedMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              id={`sidebar-tab-${item.id}`}
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all group cursor-pointer relative"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabBackground"
                  className="absolute inset-0 bg-indigo-50 rounded-xl -z-10 border border-indigo-100 shadow-3xs"
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                />
              )}
              <Icon
                size={18}
                className={`transition-all duration-200 ${
                  isActive ? "text-indigo-600 scale-105" : "text-slate-400 group-hover:text-slate-600 group-hover:scale-105"
                }`}
              />
              <span className={`truncate transition-colors ${
                isActive ? "text-indigo-700 font-bold" : "text-slate-500 group-hover:text-slate-900"
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sidebar Footer with Profile & Logout */}
      {onLogOut && (
        <div className="p-4 border-t border-slate-100 flex flex-col gap-2 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5 px-1 py-0.5">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm uppercase shrink-0">
              {userName.substring(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate leading-tight">{userName}</p>
              <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">{userRole}</p>
            </div>
          </div>
          <button
            id="sidebar-logout-btn"
            onClick={onLogOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 hover:border-rose-200 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-3xs"
          >
            <LogOut size={13} />
            <span>Sign Out Session</span>
          </button>
        </div>
      )}
    </div>
  );
}
