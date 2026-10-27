import { apiRequest, USE_MOCK_API } from "./client";
import { mockDb, mockId } from "./mock-db";
import type { TaxRate } from "./types";

function mapTaxRate(rate: any): TaxRate {
  return {
    id: String(rate.id),
    name: rate.name,
    rate: Number(rate.rate ?? 0),
    type: rate.type === "inclusive" ? "inclusive" : "exclusive",
    isDefault: Boolean(rate.is_default),
    isActive: Boolean(rate.is_active),
  };
}

export async function listTaxRates(): Promise<TaxRate[]> {
  if (USE_MOCK_API) return mockDb.taxRates.map((rate) => ({ ...rate }));
  const data = await apiRequest<any>("/tax-rates");
  const items = Array.isArray(data) ? data : (data?.data ?? []);
  return items.map(mapTaxRate);
}

export async function createTaxRate(input: {
  name: string;
  rate: number;
  type: "inclusive" | "exclusive";
  isDefault: boolean;
}): Promise<TaxRate> {
  if (input.isDefault) await clearDefault();
  if (USE_MOCK_API) {
    const rate: TaxRate = {
      id: mockId("tr"),
      name: input.name,
      rate: input.rate,
      type: input.type,
      isDefault: input.isDefault,
      isActive: true,
    };
    mockDb.taxRates = [...mockDb.taxRates, rate];
    return rate;
  }
  const data = await apiRequest<any>("/tax-rates", {
    method: "POST",
    body: {
      name: input.name,
      rate: input.rate,
      type: input.type,
      is_default: input.isDefault,
      is_active: true,
    },
  });
  return mapTaxRate(data);
}

export async function updateTaxRate(
  id: string,
  input: Partial<{ name: string; rate: number; type: "inclusive" | "exclusive"; isDefault: boolean; isActive: boolean }>
): Promise<TaxRate> {
  if (input.isDefault) await clearDefault(id);
  if (USE_MOCK_API) {
    const index = mockDb.taxRates.findIndex((rate) => rate.id === id);
    if (index < 0) throw new Error("Tax rate not found");
    mockDb.taxRates[index] = { ...mockDb.taxRates[index], ...input };
    return { ...mockDb.taxRates[index] };
  }
  const data = await apiRequest<any>(`/tax-rates/${id}`, {
    method: "PUT",
    body: {
      name: input.name,
      rate: input.rate,
      type: input.type,
      is_default: input.isDefault,
      is_active: input.isActive,
    },
  });
  return mapTaxRate(data);
}

export async function deleteTaxRate(id: string): Promise<void> {
  if (USE_MOCK_API) {
    mockDb.taxRates = mockDb.taxRates.filter((rate) => rate.id !== id);
    return;
  }
  await apiRequest<void>(`/tax-rates/${id}`, { method: "DELETE" });
}

async function clearDefault(exceptId?: string) {
  const rates = await listTaxRates().catch(() => [] as TaxRate[]);
  await Promise.all(
    rates
      .filter((rate) => rate.isDefault && rate.id !== exceptId)
      .map((rate) =>
        USE_MOCK_API
          ? Promise.resolve(
              (() => {
                const target = mockDb.taxRates.find((item) => item.id === rate.id);
                if (target) target.isDefault = false;
              })()
            )
          : apiRequest<void>(`/tax-rates/${rate.id}`, {
              method: "PUT",
              body: { is_default: false },
            })
      )
  );
}
