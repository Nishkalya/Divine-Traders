import { TeamMember, Warehouse, ERPState } from "../types";

/**
 * Checks if a user has access to a specific warehouse ID.
 * Rules:
 * 1. Super Admin (or Admin with no explicit restrictions) -> ALLOWED (access to all warehouses)
 * 2. If user.allowedWarehouseIds === undefined or null -> "Not Restricted" -> ALLOWED (access to all warehouses)
 * 3. If user.allowedWarehouseIds is an array of string IDs -> ALLOWED ONLY IF warehouseId is in array
 * 4. If warehouseId is empty/undefined on a record -> ALLOWED (legacy or unassigned record)
 */
export function isWarehouseAllowed(
  user: TeamMember | undefined | null,
  warehouseId: string | undefined | null
): boolean {
  if (!user) return true;

  const roleLower = (user.role || "").toLowerCase();
  
  // Super Admin can access all warehouses.
  if (
    roleLower === "admin" ||
    roleLower === "super admin" ||
    roleLower === "ceo" ||
    user.email === "vishal291137@gmail.com"
  ) {
    if (
      user.email === "vishal291137@gmail.com" ||
      roleLower === "super admin" ||
      user.allowedWarehouseIds === undefined ||
      user.allowedWarehouseIds === null
    ) {
      return true;
    }
  }

  // Unrestricted users (warehouse access not configured yet)
  if (user.allowedWarehouseIds === undefined || user.allowedWarehouseIds === null) {
    return true;
  }

  // Record with no warehouse ID (legacy or global)
  if (!warehouseId) {
    return true;
  }

  return user.allowedWarehouseIds.includes(warehouseId);
}

/**
 * Get all warehouses that the user is authorized to access.
 */
export function getAllowedWarehouses(
  user: TeamMember | undefined | null,
  warehouses: Warehouse[] | undefined
): Warehouse[] {
  if (!warehouses) return [];
  return warehouses.filter((wh) => wh.status === "Active" && isWarehouseAllowed(user, wh.id));
}

/**
 * Filter items or records based on warehouse authorization.
 */
export function filterRecordsByWarehouse<T extends { warehouseId?: string }>(
  user: TeamMember | undefined | null,
  records: T[] | undefined
): T[] {
  if (!records || !Array.isArray(records)) return [];
  return records.filter((rec) => isWarehouseAllowed(user, rec.warehouseId));
}

/**
 * Checks if user has both module permission AND warehouse access for a given record.
 */
export function canUserAccessRecord(
  user: TeamMember | undefined | null,
  recordWarehouseId: string | undefined | null,
  hasModulePermission: boolean
): boolean {
  if (!hasModulePermission) return false;
  return isWarehouseAllowed(user, recordWarehouseId);
}
