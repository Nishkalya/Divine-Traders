import React, { useState, useEffect, useMemo } from "react";
import {
  ERPState,
  TeamMember,
  TeamMemberPermissions,
  TeamMemberActions,
  CompanyProfile,
  UserRole,
  UserActivityLog,
  UserLoginHistory,
  ModulePermissionActions
} from "../types";
import { INITIAL_COMPANY_PROFILE, INITIAL_ROLES, INITIAL_WAREHOUSES } from "../data";
import { isWarehouseAllowed } from "../utils/warehouseAuth";
import DataBackupView from "./DataBackupView";
import {
  checkDBConnections,
  getSupabaseTablesCheck,
  executeDatabaseMigration,
  verifyDatabaseState,
  MigrationReport,
  TableCheck,
  DBStatus,
  VerificationModuleReport
} from "../lib/migration";
import {
  Shield,
  User,
  Users,
  Building,
  Database,
  UserPlus,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Key,
  Check,
  Power,
  RefreshCw,
  Search,
  Server,
  Lock,
  Unlock,
  FileText,
  Activity,
  History,
  CheckSquare,
  Square,
  Plus,
  X,
  Filter,
  Download,
  Printer,
  ChevronRight,
  Eye,
  Sliders,
  AlertTriangle,
  Layers,
  Sparkles,
  ExternalLink,
  Laptop
} from "lucide-react";

interface AdminUsersViewProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  currentUserEmail: string;
  onChangeCurrentUser: (userId: string) => void;
  onTriggerReset?: () => void;
  activeDb?: "firebase" | "supabase";
  setActiveDb?: (db: "firebase" | "supabase") => void;
}

// 18 ERP Modules strictly matching user prompt specifications
export interface ERPModuleDefinition {
  id: string;
  name: string;
  category: "Core" | "Sales" | "Purchase" | "Inventory" | "Parties" | "Finance" | "Admin";
  permissionKey: keyof TeamMemberPermissions | string;
}

export const ERP_MODULES: ERPModuleDefinition[] = [
  { id: "dashboard", name: "Dashboard", category: "Core", permissionKey: "dashboard" },
  { id: "sales", name: "Sales", category: "Sales", permissionKey: "sales" },
  { id: "purchase-orders", name: "Purchase Orders", category: "Purchase", permissionKey: "purchaseOrders" },
  { id: "purchase-bills", name: "Purchase Bills", category: "Purchase", permissionKey: "purchaseBills" },
  { id: "goods-receipt", name: "Goods Receipt", category: "Purchase", permissionKey: "goodsReceipts" },
  { id: "inventory", name: "Inventory", category: "Inventory", permissionKey: "stockInventory" },
  { id: "warehouse", name: "Warehouse", category: "Inventory", permissionKey: "stockInventory" },
  { id: "stock-transfer", name: "Stock Transfer", category: "Inventory", permissionKey: "stockInventory" },
  { id: "stock-movement", name: "Stock Movement", category: "Inventory", permissionKey: "stockMovement" },
  { id: "customers", name: "Customers", category: "Parties", permissionKey: "customerOutstanding" },
  { id: "vendors", name: "Vendors", category: "Parties", permissionKey: "vendorOutstanding" },
  { id: "payments", name: "Payments", category: "Finance", permissionKey: "payments" },
  { id: "gst-reports", name: "GST Reports", category: "Finance", permissionKey: "gstReports" },
  { id: "ledger", name: "Ledger", category: "Finance", permissionKey: "ledger" },
  { id: "factory-expenses", name: "Factory Expenses", category: "Finance", permissionKey: "factoryExpenses" },
  { id: "reports", name: "Reports", category: "Finance", permissionKey: "reports" },
  { id: "admin-users", name: "User Administration", category: "Admin", permissionKey: "adminUsers" },
  { id: "data-backup", name: "Data Backup & Restore", category: "Admin", permissionKey: "dataBackup" },
  { id: "settings", name: "Settings", category: "Admin", permissionKey: "companyProfile" },
];

// The 7 columns strictly requested in Permission Matrix
export const PERMISSION_ACTIONS: Array<{ key: keyof ModulePermissionActions; label: string; desc: string }> = [
  { key: "view", label: "View", desc: "Allows accessing and viewing records & module" },
  { key: "create", label: "Create", desc: "Allows adding new records or entries" },
  { key: "edit", label: "Edit", desc: "Allows modifying existing records" },
  { key: "delete", label: "Delete", desc: "Allows deleting or canceling records" },
  { key: "approve", label: "Approve", desc: "Allows approving financial or order workflows" },
  { key: "export", label: "Export", desc: "Allows exporting records to Excel, CSV, or PDF" },
  { key: "print", label: "Print", desc: "Allows printing physical vouchers or reports" },
];



// Seed Activity Logs
const INITIAL_ACTIVITY_LOGS: UserActivityLog[] = [
  {
    id: "log-1",
    timestamp: "2026-07-24 10:15:22",
    userName: "Vishal (Super Admin)",
    userEmail: "vishal291137@gmail.com",
    role: "Admin",
    action: "UPDATE_PERMISSION",
    module: "User Administration",
    details: "Updated 7-column permission matrix for user 'Rahul Sharma' (Sales Manager)",
    ipAddress: "192.168.1.102",
    status: "Success"
  },
  {
    id: "log-2",
    timestamp: "2026-07-24 09:42:10",
    userName: "Priya Patel",
    userEmail: "priya.p@divine.com",
    role: "Accountant",
    action: "CREATE_BILL",
    module: "Factory Expenses",
    details: "Created Factory Expense bill EXP-00001 for MSEDCL Power tariff ₹47,200",
    ipAddress: "192.168.1.108",
    status: "Success"
  },
  {
    id: "log-3",
    timestamp: "2026-07-24 09:15:00",
    userName: "Vishal (Super Admin)",
    userEmail: "vishal291137@gmail.com",
    role: "Admin",
    action: "APPROVE_DISBURSEMENT",
    module: "Payments",
    details: "Approved payment voucher PAY-EXP-8812 for ₹20,000 to MSEDCL",
    ipAddress: "192.168.1.102",
    status: "Success"
  },
  {
    id: "log-4",
    timestamp: "2026-07-23 17:30:45",
    userName: "Amit Kumar",
    userEmail: "store.mgr@divine.com",
    role: "Store",
    action: "STOCK_TRANSFER",
    module: "Stock Transfer",
    details: "Initiated stock transfer ST-002 from Main Warehouse to Processing Unit",
    ipAddress: "192.168.1.115",
    status: "Success"
  },
  {
    id: "log-5",
    timestamp: "2026-07-23 16:10:05",
    userName: "Unknown",
    userEmail: "guest@divine.com",
    role: "Guest",
    action: "LOGIN_ATTEMPT",
    module: "Security",
    details: "Failed login attempt: Invalid password credentials provided",
    ipAddress: "49.36.12.89",
    status: "Failed"
  }
];

// Seed Login History
const INITIAL_LOGIN_HISTORY: UserLoginHistory[] = [
  {
    id: "lh-1",
    timestamp: "2026-07-24 08:30:12",
    userName: "Vishal (Super Admin)",
    userEmail: "vishal291137@gmail.com",
    role: "Admin",
    loginMethod: "Password / Auth Token",
    ipAddress: "192.168.1.102",
    deviceInfo: "Chrome 126.0 (Windows 11 Desktop)",
    status: "Success"
  },
  {
    id: "lh-2",
    timestamp: "2026-07-24 09:00:45",
    userName: "Priya Patel",
    userEmail: "priya.p@divine.com",
    role: "Accountant",
    loginMethod: "Password",
    ipAddress: "192.168.1.108",
    deviceInfo: "Edge 125.0 (Windows 10)",
    status: "Success"
  },
  {
    id: "lh-3",
    timestamp: "2026-07-23 16:10:05",
    userName: "guest@divine.com",
    userEmail: "guest@divine.com",
    role: "Unknown",
    loginMethod: "Password",
    ipAddress: "49.36.12.89",
    deviceInfo: "Firefox 124.0 (Linux)",
    status: "Failed"
  },
  {
    id: "lh-4",
    timestamp: "2026-07-23 08:15:30",
    userName: "Rahul Sharma",
    userEmail: "sales.mgr@divine.com",
    role: "Sales",
    loginMethod: "Password",
    ipAddress: "192.168.1.110",
    deviceInfo: "Safari 17.4 (macOS)",
    status: "Success"
  }
];

// Helper to construct full default module permission map
export function getDefaultModulePermissions(role: string, userPermissions?: TeamMemberPermissions): Record<string, ModulePermissionActions> {
  const isExecutiveOrAdmin =
    role === "Admin" ||
    role === "CEO" ||
    role.toLowerCase().includes("admin") ||
    role.toLowerCase().includes("ceo");

  const map: Record<string, ModulePermissionActions> = {};

  ERP_MODULES.forEach((mod) => {
    let hasAccess = isExecutiveOrAdmin;
    if (!isExecutiveOrAdmin && userPermissions) {
      const pKey = mod.permissionKey as keyof TeamMemberPermissions;
      hasAccess = !!userPermissions[pKey];
    } else if (!isExecutiveOrAdmin) {
      if (role === "Accountant" && ["purchase-bills", "sales", "ledger", "payments", "gst-reports", "factory-expenses", "reports", "data-backup"].includes(mod.id)) {
        hasAccess = true;
      } else if (role === "Sales" && ["sales", "customers", "payments", "inventory"].includes(mod.id)) {
        hasAccess = true;
      } else if (role === "Purchase" && ["purchase-orders", "purchase-bills", "goods-receipt", "vendors"].includes(mod.id)) {
        hasAccess = true;
      } else if (role === "Store" && ["inventory", "warehouse", "stock-transfer", "stock-movement", "goods-receipt"].includes(mod.id)) {
        hasAccess = true;
      } else if (role === "Production" && ["inventory", "stock-movement"].includes(mod.id)) {
        hasAccess = true;
      }
    }

    map[mod.id] = {
      view: hasAccess,
      create: hasAccess,
      edit: hasAccess,
      delete: isExecutiveOrAdmin,
      approve: isExecutiveOrAdmin || role === "Accountant",
      export: hasAccess,
      print: hasAccess
    };
  });

  return map;
}

export default function AdminUsersView({
  state,
  onUpdateState,
  currentUserEmail,
  onChangeCurrentUser,
  onTriggerReset,
  activeDb = "firebase",
  setActiveDb
}: AdminUsersViewProps) {
  // Navigation Tabs strictly including required User Administration tabs
  const [activeTab, setActiveTab] = useState<
    "users" | "roles" | "matrix" | "activity" | "loginHistory" | "company" | "database"
  >("users");

  // State Collections
  const teamMembers = useMemo(() => {
    const raw = state.teamMembers || [];
    const seen = new Set<string>();
    const unique: TeamMember[] = [];
    for (const m of raw) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        unique.push(m);
      }
    }
    return unique;
  }, [state.teamMembers]);

  const rawRoles = (state.roles && state.roles.length > 0) ? state.roles : INITIAL_ROLES;
  const roles = useMemo(() => {
    const seen = new Set<string>();
    const unique: UserRole[] = [];
    for (const r of rawRoles) {
      const nameKey = r.name.toLowerCase().trim();
      if (!seen.has(nameKey) && !seen.has(r.id)) {
        seen.add(nameKey);
        seen.add(r.id);
        unique.push(r);
      }
    }
    return unique;
  }, [rawRoles]);
  const activityLogs = state.activityLogs || INITIAL_ACTIVITY_LOGS;
  const loginHistory = state.loginHistory || INITIAL_LOGIN_HISTORY;

  // Search and Filter States
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [activitySearch, setActivitySearch] = useState("");
  const [activityStatusFilter, setActivityStatusFilter] = useState("All");

  const [loginSearch, setLoginSearch] = useState("");
  const [loginStatusFilter, setLoginStatusFilter] = useState("All");

  // Modals State
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  // User Form State
  const [formUserId, setFormUserId] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("1234");
  const [formRole, setFormRole] = useState<string>("Sales");
  const [formStatus, setFormStatus] = useState<TeamMember["status"]>("Active");
  const [formWarehouseRestriction, setFormWarehouseRestriction] = useState<boolean>(false);
  const [formAllowedWarehouseIds, setFormAllowedWarehouseIds] = useState<string[]>([]);

  const activeWarehouses = useMemo(
    () => (state.warehouses && state.warehouses.length > 0 ? state.warehouses : INITIAL_WAREHOUSES).filter((w) => w.status === "Active"),
    [state.warehouses]
  );

  // Role Form State
  const [roleFormName, setRoleFormName] = useState("");
  const [roleFormDesc, setRoleFormDesc] = useState("");

  // PERMISSION MATRIX EDITOR STATE
  const [matrixTargetType, setMatrixTargetType] = useState<"user" | "role">("user");
  const [selectedTargetId, setSelectedTargetId] = useState<string>(teamMembers[0]?.id || "");
  const [matrixState, setMatrixState] = useState<Record<string, ModulePermissionActions>>({});
  const [matrixSavedAlert, setMatrixSavedAlert] = useState(false);

  // Migration & DB State (preserves existing DB check capabilities)
  const [dbStatusCheck, setDbStatusCheck] = useState<{ firebase: DBStatus; supabase: DBStatus } | null>(null);
  const [isCheckingDB, setIsCheckingDB] = useState(false);
  const [tableChecks, setTableChecks] = useState<TableCheck[] | null>(null);
  const [isCheckingTables, setIsCheckingTables] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationModuleReport[] | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [migrationStatusText, setMigrationStatusText] = useState("");

  // Company Profile Form
  const [companyForm, setCompanyForm] = useState<CompanyProfile>(
    state.companyProfile || INITIAL_COMPANY_PROFILE
  );

  // Initialize Matrix State when switching selected user / role or target type
  useEffect(() => {
    if (matrixTargetType === "user") {
      const user = teamMembers.find((m) => m.id === selectedTargetId) || teamMembers[0];
      if (user) {
        if (user.modulePermissions && Object.keys(user.modulePermissions).length > 0) {
          setMatrixState(user.modulePermissions);
        } else {
          setMatrixState(getDefaultModulePermissions(user.role, user.permissions));
        }
      }
    } else {
      const role = roles.find((r) => r.id === selectedTargetId) || roles[0];
      if (role) {
        if (role.modulePermissions && Object.keys(role.modulePermissions).length > 0) {
          setMatrixState(role.modulePermissions);
        } else {
          setMatrixState(getDefaultModulePermissions(role.name));
        }
      }
    }
  }, [matrixTargetType, selectedTargetId, state.teamMembers, state.roles]);

  // Keep target ID valid when switching target type
  useEffect(() => {
    if (matrixTargetType === "user" && teamMembers.length > 0) {
      if (!teamMembers.some((m) => m.id === selectedTargetId)) {
        setSelectedTargetId(teamMembers[0].id);
      }
    } else if (matrixTargetType === "role" && roles.length > 0) {
      if (!roles.some((r) => r.id === selectedTargetId)) {
        setSelectedTargetId(roles[0].id);
      }
    }
  }, [matrixTargetType]);

  // Helper to log user activities
  const createAuditLog = (
    action: string,
    module: string,
    details: string,
    status: "Success" | "Failed" | "Warning" = "Success"
  ): UserActivityLog => {
    const currentMember = teamMembers.find((m) => m.email === currentUserEmail) || teamMembers[0];
    return {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      userName: currentMember ? currentMember.name : "Admin User",
      userEmail: currentUserEmail,
      role: currentMember ? currentMember.role : "Admin",
      action,
      module,
      details,
      ipAddress: "192.168.1.100",
      status
    };
  };

  const addAuditLog = (
    action: string,
    module: string,
    details: string,
    status: "Success" | "Failed" | "Warning" = "Success"
  ) => {
    const newLog = createAuditLog(action, module, details, status);
    onUpdateState({
      ...state,
      activityLogs: [newLog, ...(state.activityLogs || INITIAL_ACTIVITY_LOGS)]
    });
  };

  // Create or Update User
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      alert("Please enter Name and User Email/ID.");
      return;
    }

    const defaultPerms = {
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
      adminUsers: formRole === "Admin" || formRole.toLowerCase().includes("admin"),
      production: true,
      companyFunding: true,
      factoryExpenses: true,
      dataBackup: formRole === "Admin" || formRole.toLowerCase().includes("admin") || formRole === "Accountant"
    };

    const initialMatrix = getDefaultModulePermissions(formRole, defaultPerms);
    const resolvedUserId = (formUserId.trim() || formEmail.trim().split("@")[0] || formEmail.trim()).toLowerCase();

    // Determine final warehouse access list (undefined means "Not Restricted")
    const finalAllowedWarehouseIds: string[] | undefined = formWarehouseRestriction
      ? formAllowedWarehouseIds
      : undefined;

    const newWarehouseText = finalAllowedWarehouseIds === undefined
      ? "Not Restricted (All Warehouses)"
      : (finalAllowedWarehouseIds.length === 0 ? "None" : finalAllowedWarehouseIds.join(", "));

    let warehouseLog: UserActivityLog | null = null;

    if (editingUserId) {
      // Update
      const existingUser = teamMembers.find((m) => m.id === editingUserId);
      const oldRole = existingUser?.role || "";
      const roleChanged = oldRole !== formRole;

      const prevAllowedWhIds = existingUser?.allowedWarehouseIds;
      const prevWarehouseText = prevAllowedWhIds === undefined
        ? "Not Restricted (All Warehouses)"
        : (prevAllowedWhIds.length === 0 ? "None" : prevAllowedWhIds.join(", "));

      if (prevWarehouseText !== newWarehouseText) {
        let whAction = "WAREHOUSE_PERMISSION_CHANGED";
        if (prevAllowedWhIds === undefined && finalAllowedWarehouseIds !== undefined) {
          whAction = "WAREHOUSE_ACCESS_ADDED";
        } else if (prevAllowedWhIds !== undefined && finalAllowedWarehouseIds === undefined) {
          whAction = "WAREHOUSE_ACCESS_REMOVED";
        }

        warehouseLog = createAuditLog(
          whAction,
          "User Administration",
          `User: ${formName.trim()} (${formEmail.trim()}) | Changed By: ${currentUserEmail} | Previous Warehouse IDs: ${prevWarehouseText} | New Warehouse IDs: ${newWarehouseText} | Date/Time: ${new Date().toISOString().replace("T", " ").slice(0, 19)}`
        );
      }

      const updatedMembers = teamMembers.map((m) => {
        if (m.id === editingUserId) {
          return {
            ...m,
            name: formName.trim(),
            email: formEmail.trim(),
            userId: resolvedUserId,
            role: formRole,
            status: formStatus,
            password: formPassword || m.password,
            allowedWarehouseIds: finalAllowedWarehouseIds,
            permissions: roleChanged ? defaultPerms : (m.permissions || defaultPerms),
            actions: roleChanged 
              ? { view: true, create: true, edit: true, delete: formRole.toLowerCase().includes("admin") || formRole.toLowerCase().includes("ceo"), print: true, export: true }
              : (m.actions || { view: true, create: true, edit: true, delete: true, print: true, export: true }),
            modulePermissions: roleChanged ? initialMatrix : (m.modulePermissions || initialMatrix)
          };
        }
        return m;
      });

      const currentAssignees = state.salesAssignees || ["Vishal Kumar"];
      const updatedAssignees = Array.from(new Set([...currentAssignees, formName.trim()]));
      const logDetails = roleChanged
        ? `Updated user ${formName} (${formEmail}): Role changed from '${oldRole}' to '${formRole}' (permissions auto-recalculated)`
        : `Updated details for user ${formName} (${formEmail})`;
      const newLog = createAuditLog("EDIT_USER", "User Administration", logDetails);

      const newLogs = warehouseLog ? [warehouseLog, newLog] : [newLog];

      onUpdateState({
        ...state,
        teamMembers: updatedMembers,
        salesAssignees: updatedAssignees,
        activityLogs: [...newLogs, ...(state.activityLogs || INITIAL_ACTIVITY_LOGS)]
      });
    } else {
      // Create
      const newUser: TeamMember = {
        id: `tm-${Date.now()}`,
        userId: resolvedUserId,
        name: formName.trim(),
        email: formEmail.trim(),
        role: formRole,
        status: formStatus,
        password: formPassword || "1234",
        allowedWarehouseIds: finalAllowedWarehouseIds,
        permissions: defaultPerms,
        actions: { view: true, create: true, edit: true, delete: formRole.toLowerCase().includes("admin"), print: true, export: true },
        modulePermissions: initialMatrix,
        createdAt: new Date().toISOString().split("T")[0],
        lastLogin: "Never"
      };

      if (formWarehouseRestriction) {
        warehouseLog = createAuditLog(
          "WAREHOUSE_ACCESS_ADDED",
          "User Administration",
          `User: ${formName.trim()} (${formEmail.trim()}) | Changed By: ${currentUserEmail} | Previous Warehouse IDs: Not Restricted (All Warehouses) | New Warehouse IDs: ${newWarehouseText} | Date/Time: ${new Date().toISOString().replace("T", " ").slice(0, 19)}`
        );
      }

      const updatedMembers = [...teamMembers, newUser];
      const currentAssignees = state.salesAssignees || ["Vishal Kumar"];
      const updatedAssignees = Array.from(new Set([...currentAssignees, newUser.name]));
      const newLog = createAuditLog("CREATE_USER", "User Administration", `Created new user ${formName} (${formEmail}) with role ${formRole}`);

      const newLogs = warehouseLog ? [warehouseLog, newLog] : [newLog];

      onUpdateState({
        ...state,
        teamMembers: updatedMembers,
        salesAssignees: updatedAssignees,
        activityLogs: [...newLogs, ...(state.activityLogs || INITIAL_ACTIVITY_LOGS)]
      });
    }

    setIsCreatingUser(false);
    setEditingUserId(null);
    resetUserForm();
  };

  const resetUserForm = () => {
    setFormUserId("");
    setFormName("");
    setFormEmail("");
    setFormPassword("1234");
    setFormRole(roles[0]?.name || "System Administrator");
    setFormStatus("Active");
    setFormWarehouseRestriction(false);
    setFormAllowedWarehouseIds([]);
  };

  const openEditUser = (user: TeamMember) => {
    setEditingUserId(user.id);
    setFormUserId(user.userId || user.email);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword(user.password || "1234");
    setFormRole(user.role);
    setFormStatus(user.status);
    if (user.allowedWarehouseIds === undefined || user.allowedWarehouseIds === null) {
      setFormWarehouseRestriction(false);
      setFormAllowedWarehouseIds(activeWarehouses.map((w) => w.id));
    } else {
      setFormWarehouseRestriction(true);
      setFormAllowedWarehouseIds([...user.allowedWarehouseIds]);
    }
    setIsCreatingUser(true);
  };

  const handleDeleteUser = (userId: string) => {
    const target = teamMembers.find((m) => m.id === userId);
    if (!target) return;
    if (target.email === currentUserEmail) {
      alert("You cannot delete your own active logged-in account.");
      return;
    }
    if (confirm(`Are you sure you want to remove user '${target.name}'?`)) {
      const updatedMembers = teamMembers.filter((m) => m.id !== userId);
      const newLog = createAuditLog("DELETE_USER", "User Administration", `Deleted user account ${target.name} (${target.email})`, "Warning");
      onUpdateState({
        ...state,
        teamMembers: updatedMembers,
        activityLogs: [newLog, ...(state.activityLogs || INITIAL_ACTIVITY_LOGS)]
      });
    }
  };

  // Toggle Single Permission Checkbox in Matrix
  const handleToggleMatrixCheckbox = (moduleId: string, actionKey: keyof ModulePermissionActions) => {
    const currentModulePerms = matrixState[moduleId] || {
      view: false,
      create: false,
      edit: false,
      delete: false,
      approve: false,
      export: false,
      print: false
    };

    const newModulePerms = { ...currentModulePerms };

    if (actionKey === "view") {
      const nextView = !currentModulePerms.view;
      newModulePerms.view = nextView;
      // If View is turned off, force all sub-actions to false
      if (!nextView) {
        newModulePerms.create = false;
        newModulePerms.edit = false;
        newModulePerms.delete = false;
        newModulePerms.approve = false;
        newModulePerms.export = false;
        newModulePerms.print = false;
      }
    } else {
      // If View is false, cannot turn on other actions unless View is also enabled
      if (!currentModulePerms.view) {
        newModulePerms.view = true;
      }
      newModulePerms[actionKey] = !currentModulePerms[actionKey];
    }

    setMatrixState({
      ...matrixState,
      [moduleId]: newModulePerms
    });
  };

  // Bulk Matrix Actions
  const handleBulkMatrixRow = (moduleId: string, type: "all" | "readonly" | "none") => {
    const updated = { ...matrixState };
    if (type === "all") {
      updated[moduleId] = { view: true, create: true, edit: true, delete: true, approve: true, export: true, print: true };
    } else if (type === "readonly") {
      updated[moduleId] = { view: true, create: false, edit: false, delete: false, approve: false, export: false, print: false };
    } else {
      updated[moduleId] = { view: false, create: false, edit: false, delete: false, approve: false, export: false, print: false };
    }
    setMatrixState(updated);
  };

  const handleBulkMatrixColumn = (actionKey: keyof ModulePermissionActions, value: boolean) => {
    const updated = { ...matrixState };
    ERP_MODULES.forEach((mod) => {
      const cur = updated[mod.id] || { view: false, create: false, edit: false, delete: false, approve: false, export: false, print: false };
      if (actionKey === "view") {
        cur.view = value;
        if (!value) {
          cur.create = false;
          cur.edit = false;
          cur.delete = false;
          cur.approve = false;
          cur.export = false;
          cur.print = false;
        }
      } else {
        if (value) cur.view = true;
        cur[actionKey] = value;
      }
      updated[mod.id] = cur;
    });
    setMatrixState(updated);
  };

  const handlePresetMatrix = (preset: "full" | "readonly" | "clear") => {
    const updated: Record<string, ModulePermissionActions> = {};
    ERP_MODULES.forEach((mod) => {
      if (preset === "full") {
        updated[mod.id] = { view: true, create: true, edit: true, delete: true, approve: true, export: true, print: true };
      } else if (preset === "readonly") {
        updated[mod.id] = { view: true, create: false, edit: false, delete: false, approve: false, export: false, print: false };
      } else {
        updated[mod.id] = { view: false, create: false, edit: false, delete: false, approve: false, export: false, print: false };
      }
    });
    setMatrixState(updated);
  };

  // Save Permission Matrix Changes
  const handleSavePermissionMatrix = () => {
    if (matrixTargetType === "user") {
      const targetUser = teamMembers.find((m) => m.id === selectedTargetId);
      if (!targetUser) return;

      // Sync legacy permissions object so sidebar & existing checks stay aligned
      const updatedPermissions: TeamMemberPermissions = { ...targetUser.permissions };
      ERP_MODULES.forEach((mod) => {
        const modActions = matrixState[mod.id];
        const pKey = mod.permissionKey as keyof TeamMemberPermissions;
        if (pKey && modActions) {
          updatedPermissions[pKey] = modActions.view;
        }
      });

      const updatedMembers = teamMembers.map((m) => {
        if (m.id === selectedTargetId) {
          return {
            ...m,
            modulePermissions: matrixState,
            permissions: updatedPermissions,
            actions: {
              view: true,
              create: Object.values(matrixState).some((v) => (v as ModulePermissionActions).create),
              edit: Object.values(matrixState).some((v) => (v as ModulePermissionActions).edit),
              delete: Object.values(matrixState).some((v) => (v as ModulePermissionActions).delete),
              export: Object.values(matrixState).some((v) => (v as ModulePermissionActions).export),
              print: Object.values(matrixState).some((v) => (v as ModulePermissionActions).print)
            }
          };
        }
        return m;
      });

      const newLog = createAuditLog(
        "UPDATE_MATRIX",
        "Permission Matrix",
        `Updated 7-column Permission Matrix for user '${targetUser.name}' (${targetUser.role})`
      );
      onUpdateState({
        ...state,
        teamMembers: updatedMembers,
        activityLogs: [newLog, ...(state.activityLogs || INITIAL_ACTIVITY_LOGS)]
      });
    } else {
      const targetRole = roles.find((r) => r.id === selectedTargetId);
      if (!targetRole) return;

      const updatedRoles = roles.map((r) => {
        if (r.id === selectedTargetId) {
          return {
            ...r,
            modulePermissions: matrixState
          };
        }
        return r;
      });

      // Update all users who belong to this role
      const updatedMembers = teamMembers.map((m) => {
        if (m.role === targetRole.name) {
          const updatedPermissions: TeamMemberPermissions = { ...m.permissions };
          ERP_MODULES.forEach((mod) => {
            const modActions = matrixState[mod.id];
            const pKey = mod.permissionKey as keyof TeamMemberPermissions;
            if (pKey && modActions) {
              updatedPermissions[pKey] = modActions.view;
            }
          });
          return {
            ...m,
            modulePermissions: matrixState,
            permissions: updatedPermissions
          };
        }
        return m;
      });

      const newLog = createAuditLog(
        "UPDATE_ROLE_MATRIX",
        "Permission Matrix",
        `Updated master 7-column Permission Matrix for role '${targetRole.name}'`
      );
      onUpdateState({
        ...state,
        roles: updatedRoles,
        teamMembers: updatedMembers,
        activityLogs: [newLog, ...(state.activityLogs || INITIAL_ACTIVITY_LOGS)]
      });
    }

    setMatrixSavedAlert(true);
    setTimeout(() => setMatrixSavedAlert(false), 3000);
  };

  // Create Role
  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    const name = roleFormName.trim();
    if (!name) {
      alert("Please enter a valid Role Name.");
      return;
    }

    const newRole: UserRole = {
      id: `role-${Date.now()}`,
      name,
      description: roleFormDesc.trim() || "Custom configured user access role.",
      isSystem: false,
      modulePermissions: getDefaultModulePermissions(name),
      createdAt: new Date().toISOString().split("T")[0]
    };

    const existingIndex = roles.findIndex((r) => r.name.toLowerCase() === name.toLowerCase());
    let updatedRoles: UserRole[];
    if (existingIndex >= 0) {
      updatedRoles = roles.map((r, i) => (i === existingIndex ? newRole : r));
    } else {
      updatedRoles = [...roles, newRole];
    }

    const newLog = createAuditLog("CREATE_ROLE", "User Administration", `Created custom role '${name}'`);

    onUpdateState({
      ...state,
      roles: updatedRoles,
      activityLogs: [newLog, ...(state.activityLogs || INITIAL_ACTIVITY_LOGS)]
    });

    setIsCreatingRole(false);
    setRoleFormName("");
    setRoleFormDesc("");
  };

  // Delete Role
  const handleDeleteRole = (roleId: string) => {
    const targetRole = roles.find((r) => r.id === roleId);
    if (!targetRole) return;
    if (targetRole.isSystem) {
      alert("System core roles cannot be deleted.");
      return;
    }
    if (confirm(`Are you sure you want to delete custom role '${targetRole.name}'?`)) {
      const updatedRoles = roles.filter((r) => r.id !== roleId);
      const newLog = createAuditLog("DELETE_ROLE", "User Administration", `Deleted custom role '${targetRole.name}'`, "Warning");
      onUpdateState({
        ...state,
        roles: updatedRoles,
        activityLogs: [newLog, ...(state.activityLogs || INITIAL_ACTIVITY_LOGS)]
      });
    }
  };

  // Save Company Profile
  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    const newLog = createAuditLog("UPDATE_COMPANY", "Settings", `Updated company profile details for '${companyForm.name}'`);
    onUpdateState({
      ...state,
      companyProfile: companyForm,
      activityLogs: [newLog, ...(state.activityLogs || INITIAL_ACTIVITY_LOGS)]
    });
    alert("Company Profile saved successfully.");
  };

  // Filtered Lists
  const filteredUsers = teamMembers.filter((u) => {
    const sTerm = userSearch.toLowerCase().trim();
    const matchesSearch =
      !sTerm ||
      (u.name && u.name.toLowerCase().includes(sTerm)) ||
      (u.email && u.email.toLowerCase().includes(sTerm)) ||
      (u.userId && u.userId.toLowerCase().includes(sTerm)) ||
      (u.role && u.role.toLowerCase().includes(sTerm));

    const matchesRole =
      roleFilter === "All" ||
      u.role === roleFilter ||
      (u.role && roleFilter.toLowerCase().includes(u.role.toLowerCase())) ||
      (u.role && u.role.toLowerCase().includes(roleFilter.toLowerCase()));

    const matchesStatus = statusFilter === "All" || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredLogs = activityLogs.filter((l) => {
    const actTerm = (activitySearch || "").toLowerCase();
    const matchesSearch =
      (l?.userName || "").toLowerCase().includes(actTerm) ||
      (l?.module || "").toLowerCase().includes(actTerm) ||
      (l?.details || "").toLowerCase().includes(actTerm) ||
      (l?.action || "").toLowerCase().includes(actTerm);
    const matchesStatus = activityStatusFilter === "All" || l.status === activityStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredLoginHistory = loginHistory.filter((lh) => {
    const logTerm = (loginSearch || "").toLowerCase();
    const matchesSearch =
      (lh?.userName || "").toLowerCase().includes(logTerm) ||
      (lh?.userEmail || "").toLowerCase().includes(logTerm) ||
      (lh?.ipAddress || "").toLowerCase().includes(logTerm) ||
      (lh?.deviceInfo || "").toLowerCase().includes(logTerm);
    const matchesStatus = loginStatusFilter === "All" || lh.status === loginStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Database Migration Handlers (Preserves Existing Functionality)
  const handleCheckDBConnections = async () => {
    setIsCheckingDB(true);
    const result = await checkDBConnections();
    setDbStatusCheck(result);
    setIsCheckingDB(false);
  };

  const handleCheckTables = async () => {
    setIsCheckingTables(true);
    const checks = await getSupabaseTablesCheck();
    setTableChecks(checks);
    setIsCheckingTables(false);
  };

  const handleRunMigration = async () => {
    setIsMigrating(true);
    setMigrationStatusText("Initiating schema migration to Supabase...");
    const report = await executeDatabaseMigration("default");
    setMigrationReport(report);
    setIsMigrating(false);
    if (report.success) {
      alert("Database Migration executed successfully!");
    }
  };

  const handleVerifyDB = async () => {
    setIsVerifying(true);
    const result = await verifyDatabaseState(state, "default");
    setVerificationResult(result);
    setIsVerifying(false);
  };

  return (
    <div className="space-y-6 select-none pb-12">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-[10px] uppercase tracking-wider font-mono">
              Enterprise Access Control
            </span>
            <span className="text-xs text-slate-400 font-bold">• Security Console</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Shield className="text-indigo-600" size={26} />
            User Administration & Permissions
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage system users, custom roles, 7-column permission matrices across all 18 ERP modules, security logs, and login sessions.
          </p>
        </div>

        {/* Quick User Switcher */}
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
              {currentUserEmail.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Identity</div>
              <div className="text-xs font-black text-slate-800 max-w-[140px] truncate" title={currentUserEmail}>
                {currentUserEmail}
              </div>
            </div>
          </div>
          <select
            value={currentUserEmail}
            onChange={(e) => {
              onChangeCurrentUser(e.target.value);
              addAuditLog("SWITCH_USER", "Security", `Switched active logged-in user to ${e.target.value}`);
            }}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-indigo-500"
            title="Switch logged-in testing identity"
          >
            {teamMembers.map((m) => (
              <option key={m.id} value={m.email}>
                {m.name} ({m.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "users"
              ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <Users size={16} />
          <span>User List</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono">
            {teamMembers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("roles")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "roles"
              ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <Shield size={16} />
          <span>Role List</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono">
            {roles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("matrix")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "matrix"
              ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <Sliders size={16} />
          <span>Permission Matrix</span>
          <span className="ml-1 px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-extrabold font-mono">
            7-Cols
          </span>
        </button>

        <button
          onClick={() => setActiveTab("activity")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "activity"
              ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <Activity size={16} />
          <span>Activity Log</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono">
            {activityLogs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("loginHistory")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "loginHistory"
              ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <History size={16} />
          <span>Login History</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono">
            {loginHistory.length}
          </span>
        </button>

        <div className="h-5 w-px bg-slate-300 mx-1 hidden md:block"></div>

        <button
          onClick={() => setActiveTab("company")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "company"
              ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <Building size={16} />
          <span>Company Profile</span>
        </button>


      </div>

      {/* TAB 1: USER LIST */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search User Name, Email, ID..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="All">All Roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {/* Add User Action Button */}
            <button
              onClick={() => {
                resetUserForm();
                setEditingUserId(null);
                setIsCreatingUser(true);
              }}
              className="w-full md:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <UserPlus size={16} />
              <span>Add New User</span>
            </button>
          </div>

          {/* User Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-3xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">User Info</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Last Login</th>
                    <th className="py-3 px-3">Module Access Summary</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No team users match your current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isCurrentLoggedIn = user.email === currentUserEmail;
                      const userModuleCount = user.modulePermissions
                        ? Object.values(user.modulePermissions).filter((m: any) => m && m.view).length
                        : ERP_MODULES.filter((m) => user.permissions?.[m.permissionKey as keyof TeamMemberPermissions]).length;

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/80 transition-colors h-[64px]">
                          {/* User Info */}
                          <td className="py-3 px-4 align-middle">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xs shrink-0">
                                {user.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                                  <span>{user.name}</span>
                                  {isCurrentLoggedIn && (
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 text-[9px] font-black uppercase">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">{user.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3 px-3 align-middle font-bold">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                              {user.role}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 align-middle text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                user.status === "Active"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                              }`}
                            >
                              {user.status === "Active" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                              {user.status}
                            </span>
                          </td>

                          {/* Last Login */}
                          <td className="py-3 px-3 align-middle text-center text-slate-400 text-[11px] font-mono">
                            {user.lastLogin || "2026-07-24 08:30"}
                          </td>

                          {/* Module Access Summary */}
                          <td className="py-3 px-3 align-middle">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden max-w-[100px]">
                                  <div
                                    className="bg-indigo-600 h-full rounded-full"
                                    style={{ width: `${(userModuleCount / ERP_MODULES.length) * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-[11px] font-bold text-slate-700 font-mono">
                                  {userModuleCount}/{ERP_MODULES.length} Modules
                                </span>
                              </div>
                              <div className="text-[10px]">
                                {user.allowedWarehouseIds === undefined || user.allowedWarehouseIds === null ? (
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                    🏬 All Warehouses
                                  </span>
                                ) : (
                                  <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                    🏬 {user.allowedWarehouseIds.length} Warehouse{user.allowedWarehouseIds.length !== 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 align-middle text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Open Matrix for User */}
                              <button
                                onClick={() => {
                                  setMatrixTargetType("user");
                                  setSelectedTargetId(user.id);
                                  setActiveTab("matrix");
                                }}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[11px] border border-indigo-100 cursor-pointer transition-all"
                                title="Configure 7-column Matrix for this user"
                              >
                                🔑 Matrix
                              </button>

                              {/* Edit User */}
                              <button
                                onClick={() => openEditUser(user)}
                                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg font-bold text-[11px] border border-slate-200 cursor-pointer transition-all"
                                title="Edit User Account"
                              >
                                ✏️ Edit
                              </button>

                              {/* Switch logged in identity */}
                              {!isCurrentLoggedIn && (
                                <button
                                  onClick={() => {
                                    onChangeCurrentUser(user.email);
                                    addAuditLog("SWITCH_USER", "Security", `Switched active logged-in user to ${user.email}`);
                                  }}
                                  className="px-2 py-1 bg-slate-50 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 rounded-lg font-bold text-[11px] border border-slate-200 cursor-pointer transition-all"
                                  title="Switch logged-in testing user"
                                >
                                  ⚡ Test As
                                </button>
                              )}

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="px-2 py-1 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg font-bold text-[11px] border border-slate-200 hover:border-rose-200 cursor-pointer transition-all"
                                title="Delete User"
                              >
                                🗑
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROLE LIST */}
      {activeTab === "roles" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                System Role Definitions & Governance
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Define functional role baselines. Updating a role's permission matrix automatically propagates to assigned users.
              </p>
            </div>

            <button
              onClick={() => {
                setRoleFormName("");
                setRoleFormDesc("");
                setIsCreatingRole(true);
              }}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus size={16} />
              <span>Create New Role</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => {
              const assignedUserCount = teamMembers.filter((m) => m.role === role.name).length;

              return (
                <div
                  key={role.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-3xs flex flex-col justify-between hover:border-indigo-200 transition-all space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-900 text-sm flex items-center gap-2">
                        <Shield className="text-indigo-600" size={18} />
                        {role.name}
                      </span>
                      {role.isSystem && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                          SYSTEM
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium line-clamp-2">{role.description}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-xs text-slate-600 font-bold flex items-center gap-1.5">
                      <Users size={14} className="text-slate-400" />
                      <span>{assignedUserCount} Assigned Users</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {!role.isSystem && (
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="px-2 py-1.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all border border-rose-200 cursor-pointer flex items-center gap-1"
                          title="Delete Custom Role"
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setMatrixTargetType("role");
                          setSelectedTargetId(role.id);
                          setActiveTab("matrix");
                        }}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 text-xs font-bold rounded-xl transition-all border border-indigo-100 cursor-pointer"
                      >
                        Configure Matrix →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: PERMISSION MATRIX (7 COLUMNS ONLY, 18 ERP MODULE ROWS) */}
      {activeTab === "matrix" && (
        <div className="space-y-4">
          {/* Matrix Header & Target Selector */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-3xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100">
                  Granular Authorization Engine
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">{ERP_MODULES.length} ERP Module Permission Matrix</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Configure explicit action permissions (View, Create, Edit, Delete, Approve, Export, Print) for every ERP module.
                </p>
              </div>

              {/* Target Selection Controls */}
              <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                {/* Type Toggle */}
                <div className="flex items-center bg-white rounded-xl border border-slate-200 p-0.5 text-xs font-bold">
                  <button
                    onClick={() => setMatrixTargetType("user")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      matrixTargetType === "user" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    By User
                  </button>
                  <button
                    onClick={() => setMatrixTargetType("role")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      matrixTargetType === "role" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    By Role
                  </button>
                </div>

                {/* Dropdown Selector */}
                <select
                  value={selectedTargetId}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer min-w-[200px]"
                >
                  {matrixTargetType === "user"
                    ? teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          👤 {m.name} ({m.role})
                        </option>
                      ))
                    : roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          🛡️ {r.name}
                        </option>
                      ))}
                </select>
              </div>
            </div>

            {/* Presets and Quick Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mr-1">Quick Presets:</span>
                <button
                  onClick={() => handlePresetMatrix("full")}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-bold rounded-xl border border-slate-200 transition-all cursor-pointer"
                >
                  ⚡ Full Access (All 7-Cols)
                </button>
                <button
                  onClick={() => handlePresetMatrix("readonly")}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-700 font-bold rounded-xl border border-slate-200 transition-all cursor-pointer"
                >
                  👁 Read Only (View Only)
                </button>
                <button
                  onClick={() => handlePresetMatrix("clear")}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold rounded-xl border border-slate-200 transition-all cursor-pointer"
                >
                  🚫 Clear All
                </button>
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-3">
                {matrixSavedAlert && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5 animate-bounce">
                    <CheckCircle2 size={14} /> Matrix Changes Saved!
                  </span>
                )}
                <button
                  onClick={handleSavePermissionMatrix}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-sm cursor-pointer active:scale-95 flex items-center gap-2"
                >
                  <Check size={16} />
                  <span>Save Permission Matrix</span>
                </button>
              </div>
            </div>
          </div>

          {/* PERMISSION MATRIX TABLE (18 ROWS, 7 COLUMNS ONLY) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-3xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold text-[11px] uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-64">ERP Module ({ERP_MODULES.length} Total)</th>
                    {PERMISSION_ACTIONS.map((act) => (
                      <th key={act.key} className="py-3.5 px-3 text-center w-28">
                        <div className="flex flex-col items-center gap-1">
                          <span>{act.label}</span>
                          <div className="flex items-center gap-1 text-[9px]">
                            <button
                              onClick={() => handleBulkMatrixColumn(act.key, true)}
                              className="text-indigo-600 hover:underline cursor-pointer"
                              title={`Check all ${act.label}`}
                            >
                              All
                            </button>
                            <span className="text-slate-300">•</span>
                            <button
                              onClick={() => handleBulkMatrixColumn(act.key, false)}
                              className="text-slate-400 hover:underline cursor-pointer"
                              title={`Uncheck all ${act.label}`}
                            >
                              None
                            </button>
                          </div>
                        </div>
                      </th>
                    ))}
                    <th className="py-3.5 px-4 text-right w-36">Row Quick Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 text-slate-700 font-medium">
                  {ERP_MODULES.map((mod, index) => {
                    const modPerms = matrixState[mod.id] || {
                      view: false,
                      create: false,
                      edit: false,
                      delete: false,
                      approve: false,
                      export: false,
                      print: false
                    };

                    const isViewChecked = modPerms.view;

                    return (
                      <tr
                        key={mod.id}
                        className={`hover:bg-slate-50/80 transition-colors h-[54px] ${
                          !isViewChecked ? "bg-slate-50/40 opacity-75" : ""
                        }`}
                      >
                        {/* Module Name & Category */}
                        <td className="py-3 px-4 font-bold text-slate-900 align-middle">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-300 font-mono text-[10px] w-5">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div>
                              <div className="font-extrabold text-slate-800 text-xs">{mod.name}</div>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                {mod.category}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 7 PERMISSION ACTION CHECKBOXES */}
                        {PERMISSION_ACTIONS.map((act) => {
                          const isChecked = !!modPerms[act.key];
                          const isDisabled = act.key !== "view" && !isViewChecked;

                          return (
                            <td key={act.key} className="py-3 px-3 text-center align-middle">
                              <label className="inline-flex items-center justify-center cursor-pointer p-1 rounded-lg hover:bg-slate-100">
                                <input
                                  type="checkbox"
                                  disabled={isDisabled}
                                  checked={isChecked}
                                  onChange={() => handleToggleMatrixCheckbox(mod.id, act.key)}
                                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </label>
                            </td>
                          );
                        })}

                        {/* Row Level Quick Control Buttons */}
                        <td className="py-3 px-4 text-right align-middle">
                          <div className="flex items-center justify-end gap-1 text-[10px]">
                            <button
                              onClick={() => handleBulkMatrixRow(mod.id, "all")}
                              className="px-2 py-1 bg-slate-100 hover:bg-indigo-100 hover:text-indigo-800 font-bold rounded text-slate-600 transition-all cursor-pointer"
                              title="Check all 7 permissions for this module"
                            >
                              Grant All
                            </button>
                            <button
                              onClick={() => handleBulkMatrixRow(mod.id, "none")}
                              className="px-2 py-1 bg-slate-100 hover:bg-rose-100 hover:text-rose-800 font-bold rounded text-slate-600 transition-all cursor-pointer"
                              title="Deny all permissions for this module"
                            >
                              Deny
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ACTIVITY LOG */}
      {activeTab === "activity" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search Activity Logs..."
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <select
                value={activityStatusFilter}
                onChange={(e) => setActivityStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="All">All Audit Statuses</option>
                <option value="Success">Success</option>
                <option value="Warning">Warning</option>
                <option value="Failed">Failed</option>
              </select>
            </div>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} />
              <span>Print Audit Log</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-3xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-3">User & Role</th>
                    <th className="py-3 px-3">Action & Module</th>
                    <th className="py-3 px-4">Audit Details</th>
                    <th className="py-3 px-3 text-center">IP Address</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No activity audit logs found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors h-[54px]">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-extrabold text-slate-800">{log.userName}</div>
                          <div className="text-[10px] text-slate-400">{log.role}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px] uppercase font-mono">
                            {log.action}
                          </span>
                          <div className="text-[10px] text-slate-500 font-medium mt-0.5">{log.module}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-md">{log.details}</td>
                        <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-400">
                          {log.ipAddress || "192.168.1.1"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              log.status === "Success"
                                ? "bg-emerald-100 text-emerald-800"
                                : log.status === "Warning"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: LOGIN HISTORY */}
      {activeTab === "loginHistory" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search Login Sessions..."
                  value={loginSearch}
                  onChange={(e) => setLoginSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <select
                value={loginStatusFilter}
                onChange={(e) => setLoginStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="All">All Login Attempts</option>
                <option value="Success">Success Only</option>
                <option value="Failed">Failed Only</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-3xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Session Timestamp</th>
                    <th className="py-3 px-3">User & Email</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Login Method</th>
                    <th className="py-3 px-3">IP Address</th>
                    <th className="py-3 px-4">Browser & Device</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                  {filteredLoginHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No login history entries found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLoginHistory.map((lh) => (
                      <tr key={lh.id} className="hover:bg-slate-50/80 transition-colors h-[52px]">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{lh.timestamp}</td>
                        <td className="py-3 px-3">
                          <div className="font-extrabold text-slate-800">{lh.userName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{lh.userEmail}</div>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-700">{lh.role}</td>
                        <td className="py-3 px-3 text-slate-600">{lh.loginMethod}</td>
                        <td className="py-3 px-3 font-mono text-slate-500">{lh.ipAddress}</td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">{lh.deviceInfo}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              lh.status === "Success"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {lh.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: COMPANY PROFILE */}
      {activeTab === "company" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-3xs max-w-3xl space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-lg font-black text-slate-900">Company & Organization Master Settings</h3>
            <p className="text-xs text-slate-500 font-medium">
              Update official business details printed on Sales Invoices, GRNs, and Purchase Bills.
            </p>
          </div>

          <form onSubmit={handleSaveCompany} className="space-y-4 text-xs font-medium text-slate-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Company Trade Name *</label>
                <input
                  type="text"
                  required
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">GSTIN Registration Number *</label>
                <input
                  type="text"
                  required
                  value={companyForm.gstin}
                  onChange={(e) => setCompanyForm({ ...companyForm, gstin: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Phone / Mobile Contact</label>
                <input
                  type="text"
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Official Email Address</label>
                <input
                  type="email"
                  value={companyForm.email}
                  onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Registered Factory / Office Address</label>
              <textarea
                rows={3}
                value={companyForm.address}
                onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-800"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer shadow-sm"
              >
                Save Company Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 7: DATABASE & BACKUPS */}
      {activeTab === "database" && (
        <div className="space-y-6">
          <DataBackupView state={state} onUpdateState={onUpdateState} currentUserEmail={currentUserEmail} />

          {/* Database Check & Migration Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-3xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Database Engine Diagnostics & Sync</h3>
              <p className="text-xs text-slate-500 font-medium">
                Verify Firestore / Supabase connectivity and schema integrity.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCheckDBConnections}
                disabled={isCheckingDB}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                {isCheckingDB ? "Checking Databases..." : "Check Database Connections"}
              </button>

              <button
                onClick={handleCheckTables}
                disabled={isCheckingTables}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                {isCheckingTables ? "Checking Schema..." : "Inspect Schema Tables"}
              </button>

              <button
                onClick={handleVerifyDB}
                disabled={isVerifying}
                className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-xl cursor-pointer"
              >
                {isVerifying ? "Verifying Records..." : "Verify System Records"}
              </button>
            </div>

            {dbStatusCheck && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono">
                <div>Firebase Status: <span className="font-bold">{dbStatusCheck.firebase.connected ? "Connected ✅" : "Disconnected ❌"}</span></div>
                <div>Supabase Status: <span className="font-bold">{dbStatusCheck.supabase.connected ? "Connected ✅" : "Disconnected ❌"}</span></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE / EDIT USER */}
      {isCreatingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {editingUserId ? "Edit Existing User" : "New User Registration"}
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {editingUserId ? "Modify User Account" : "Add Team Member"}
                </h3>
              </div>
              <button
                onClick={() => setIsCreatingUser(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs font-medium text-slate-700">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">User Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. rahul@divinetraders.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">Login User ID / Handle</label>
                  <input
                    type="text"
                    placeholder="e.g. rahul (auto-fills if empty)"
                    value={formUserId}
                    onChange={(e) => setFormUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">System Role *</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 cursor-pointer"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                    {formRole && !roles.some((r) => r.name.toLowerCase().trim() === formRole.toLowerCase().trim()) && (
                      <option value={formRole}>{formRole}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">Account Status *</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Account Password</label>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono text-slate-800"
                />
              </div>

              {/* Warehouse Access Permission Layer */}
              <div className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                      <Building size={14} className="text-indigo-600" />
                      Warehouse Access Permissions
                    </label>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Restrict data visibility and transactions to specific warehouses
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formWarehouseRestriction}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setFormWarehouseRestriction(enabled);
                        if (enabled && formAllowedWarehouseIds.length === 0) {
                          setFormAllowedWarehouseIds(activeWarehouses.map((w) => w.id));
                        }
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-700">Enable Restriction</span>
                  </label>
                </div>

                {!formWarehouseRestriction ? (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-xl text-[11px] font-semibold flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>
                      <strong>Not Restricted:</strong> User can access data across all active warehouses.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Authorized Warehouses:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-slate-200 max-h-48 overflow-y-auto">
                      {activeWarehouses.map((wh) => {
                        const isChecked = formAllowedWarehouseIds.includes(wh.id);
                        return (
                          <label
                            key={wh.id}
                            className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? "bg-indigo-50/80 border-indigo-200 text-indigo-900 font-bold shadow-2xs"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setFormAllowedWarehouseIds(formAllowedWarehouseIds.filter((id) => id !== wh.id));
                                } else {
                                  setFormAllowedWarehouseIds([...formAllowedWarehouseIds, wh.id]);
                                }
                              }}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                            />
                            <div className="text-xs min-w-0">
                              <span className="block font-extrabold truncate">{wh.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{wh.code || wh.id}</span>
                            </div>
                          </label>
                        );
                      })}
                      {activeWarehouses.length === 0 && (
                        <p className="text-xs text-slate-400 italic col-span-2">No active warehouses configured.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreatingUser(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer shadow-sm"
                >
                  {editingUserId ? "Update User" : "Save User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE ROLE */}
      {isCreatingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  System Governance
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">Create Custom Role</h3>
              </div>
              <button
                onClick={() => setIsCreatingRole(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-4 text-xs font-medium text-slate-700">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Role Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Factory Operations Manager"
                  value={roleFormName}
                  onChange={(e) => setRoleFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Role Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe access responsibilities..."
                  value={roleFormDesc}
                  onChange={(e) => setRoleFormDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreatingRole(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer shadow-sm"
                >
                  Create & Save Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
