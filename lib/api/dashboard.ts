import { DashboardMetrics, TrendPoint } from "@/lib/api/types";

export interface DashboardData {
  totalRevenue: number;
  totalOrders: number;
  avgTicket: number;
  conversionRate: number;
  todaySales: number;
  yesterdaySales: number;
  growthPercent: number;
  topProducts: { id: string; name: string; sku: string; price: number; quantity: number }[];
  trafficData: { label: string; value: number }[];
}

export async function getDashboardData(outletId: string): Promise<DashboardData> {
  // Mock data for now - will be replaced with actual API calls
  return {
    totalRevenue: 12547000,
    totalOrders: 892,
    avgTicket: 14050,
    conversionRate: 3.2,
    todaySales: 4520000,
    yesterdaySales: 3890000,
    growthPercent: 16.2,
    topProducts: [
      { id: "1", name: "Product A", sku: "SKU-001", price: 150000, quantity: 45 },
      { id: "2", name: "Product B", sku: "SKU-002", price: 250000, quantity: 32 },
      { id: "3", name: "Product C", sku: "SKU-003", price: 89000, quantity: 67 },
    ],
    trafficData: [
      { label: "Jan", value: 1200 },
      { label: "Feb", value: 980 },
      { label: "Mar", value: 1500 },
      { label: "Apr", value: 1350 },
    ],
  };
}