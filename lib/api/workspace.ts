import { apiRequest, USE_MOCK_API } from "./client";
import type { Workspace } from "./types";

function mapWorkspace(raw: any): Workspace {
  return {
    industry: raw.industry,
    industryLabel: raw.industry_label ?? raw.industry,
    modules: raw.modules ?? {},
    features: raw.features ?? {},
    limits: raw.limits ?? {},
    terminology: raw.terminology ?? {},
    defaultRoute: raw.default_route ?? "/",
  };
}

export async function getWorkspace(): Promise<Workspace> {
  if (USE_MOCK_API) {
    return {
      industry: "food_beverage",
      industryLabel: "F&B / Restaurant",
      modules: {},
      features: {},
      limits: {},
      terminology: {},
      defaultRoute: "/",
    };
  }
  const data = await apiRequest<any>("/workspace");
  const payload = (data && typeof data === "object" && "data" in data) ? data.data : data;
  return mapWorkspace(payload);
}