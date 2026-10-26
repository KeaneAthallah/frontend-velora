import { apiRequest, USE_MOCK_API } from "./client";
import { mockEmployees, mockRoles } from "./mock-data";
import type { Employee, Role } from "./types";

export async function listEmployees(): Promise<Employee[]> {
  if (USE_MOCK_API) return [...mockEmployees];
  const data = await apiRequest<any>("/memberships");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map((m: any) => ({
    id: String(m.id),
    name: m.user?.name ?? "",
    email: m.user?.email ?? "",
    role: m.role?.name ?? m.role?.slug ?? "",
    outlets: [],
    active: m.status === "active",
  }));
}

export async function listRoles(): Promise<Role[]> {
  if (USE_MOCK_API) return [...mockRoles];
  const data = await apiRequest<any>("/roles");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map((r: any) => ({ id: String(r.id), name: r.name, permissions: (r.permissions ?? []).map((p: any) => p.slug ?? p.name ?? String(p)) }));
}
