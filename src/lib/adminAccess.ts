import {
  type AdminCapability,
  type AdminRole,
  type AdminStatus,
  adminRoleCapabilities,
} from "@/types/admin";

export const hasAdminCapability = (
  role: AdminRole | null | undefined,
  status: AdminStatus | null | undefined,
  capability: AdminCapability
) => {
  if (!role || status !== "active") {
    return false;
  }

  return adminRoleCapabilities[role].includes(capability);
};
