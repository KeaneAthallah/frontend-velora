import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";
import type { Employee, Role } from "./types";

function mapEmployee(membership: any): Employee {
  return {
    id: String(membership.id),
    userId: membership.user_id ? String(membership.user_id) : undefined,
    name: membership.user?.name ?? "",
    email: membership.user?.email ?? "",
    role: membership.role?.name ?? membership.role?.slug ?? "",
    roleId: membership.role_id ? String(membership.role_id) : undefined,
    roleSlug: membership.role?.slug ? String(membership.role.slug) : undefined,
    outlets: (membership.outlets ?? []).map((outlet: any) => String(outlet.id ?? outlet)),
    active: membership.status === "active",
    status: membership.status ?? "active",
    joinedAt: membership.joined_at ?? undefined,
  };
}

export async function listEmployees(): Promise<Employee[]> {
  if (USE_MOCK_API) {
    return mockDb.employees.map((employee) => ({ ...employee, outlets: [...employee.outlets] }));
  }
  const data = await apiRequest<any>("/memberships?per_page=50");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map(mapEmployee);
}

export async function listRoles(): Promise<Role[]> {
  if (USE_MOCK_API) {
    return mockDb.roles.map((role) => ({ ...role, permissions: [...role.permissions] }));
  }
  const data = await apiRequest<any>("/roles?per_page=50");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map((role: any) => ({
    id: String(role.id),
    slug: role.slug ? String(role.slug) : undefined,
    name: role.name,
    description: role.description,
    permissions: (role.permissions ?? []).map((permission: any) =>
      typeof permission === "string" ? permission : permission.slug ?? permission.name ?? String(permission)
    ),
  }));
}

export async function inviteEmployee(input: {
  email: string;
  roleId: string;
  outletIds?: string[];
}): Promise<void> {
  if (USE_MOCK_API) {
    const role = mockDb.roles.find((item) => item.id === input.roleId);
    const employee: Employee = {
      id: mockId("e"),
      name: input.email.split("@")[0],
      email: input.email,
      role: role?.name ?? "Cashier",
      roleId: input.roleId,
      roleSlug: role?.slug ?? role?.name.toLowerCase(),
      outlets: input.outletIds ?? [],
      active: false,
      status: "invited",
      joinedAt: new Date().toISOString(),
    };
    mockDb.employees = [employee, ...mockDb.employees];
    return;
  }
  await apiRequest<void>("/memberships/invite", {
    method: "POST",
    body: {
      email: input.email,
      role_id: Number(input.roleId),
      ...(input.outletIds ? { outlet_ids: input.outletIds.map(Number) } : {}),
    },
  });
}

export async function updateEmployee(
  id: string,
  input: { roleId?: string; status?: "active" | "inactive" | "invited"; outletIds?: string[] }
): Promise<void> {
  if (USE_MOCK_API) {
    const employee = mockDb.employees.find((item) => item.id === id);
    if (!employee) throw new Error("Team member not found");
    if (input.roleId) {
      const role = mockDb.roles.find((item) => item.id === input.roleId);
      employee.roleId = input.roleId;
      employee.role = role?.name ?? employee.role;
    }
    if (input.status) {
      employee.status = input.status;
      employee.active = input.status === "active";
    }
    if (input.outletIds) {
      employee.outlets = [...input.outletIds];
    }
    return;
  }
  await apiRequest<void>(`/memberships/${id}`, {
    method: "PUT",
    body: {
      role_id: input.roleId ? Number(input.roleId) : undefined,
      status: input.status,
      outlet_ids: input.outletIds ? input.outletIds.map(Number) : undefined,
    },
  });
}

export async function removeEmployee(id: string): Promise<void> {
  if (USE_MOCK_API) {
    mockDb.employees = mockDb.employees.filter((employee) => employee.id !== id);
    return;
  }
  await apiRequest<void>(`/memberships/${id}`, { method: "DELETE" });
}
