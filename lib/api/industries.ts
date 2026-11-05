import { apiRequest, USE_MOCK_API } from "./client";

export type Industry = {
  slug: string;
  name: string;
  shortName: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  examples: string[];
  benefits: string[];
  icon: string | null;
  terminology: Record<string, string>;
  modules: Record<string, boolean>;
};

function mapIndustry(raw: any): Industry {
  return {
    slug: String(raw.slug),
    name: raw.name,
    shortName: raw.short_name ?? raw.name,
    description: raw.description ?? null,
    sortOrder: Number(raw.sort_order ?? 0),
    isActive: !!raw.is_active,
    examples: raw.examples ?? [],
    benefits: raw.benefits ?? [],
    icon: raw.icon ?? null,
    terminology: raw.terminology ?? {},
    modules: raw.modules ?? {},
  };
}

export async function listIndustries(): Promise<Industry[]> {
  if (USE_MOCK_API) {
    return [
      { slug: "food_beverage", name: "F&B / Restaurant", shortName: "F&B", description: "", sortOrder: 1, isActive: true, examples: [], benefits: [], icon: "utensils", terminology: {}, modules: {} },
    ];
  }
  const data = await apiRequest<any>("/industries");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map(mapIndustry);
}