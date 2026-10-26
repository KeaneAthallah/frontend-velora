import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, ShoppingCart, Receipt, CreditCard, Banknote, Clock, Package, Tags, Layers, Percent,
  Warehouse, ArrowLeftRight, ClipboardList, Truck, AlertTriangle, Users, Shield, Building2, Monitor,
  BarChart3, TrendingUp, PieChart, UserCog,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon; permission?: string };
export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    label: "Sales",
    items: [
      { label: "POS / New Sale", href: "/pos", icon: ShoppingCart },
      { label: "Transactions", href: "/transactions", icon: Receipt },
      { label: "Returns & Refunds", href: "/returns", icon: ArrowLeftRight },
      { label: "Payments", href: "/payments", icon: CreditCard },
      { label: "Cash Registers", href: "/cash-registers", icon: Banknote },
      { label: "Shifts", href: "/shifts", icon: Clock },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", href: "/products", icon: Package },
      { label: "Categories", href: "/categories", icon: Tags },
      { label: "Product Variants", href: "/variants", icon: Layers },
      { label: "Pricing & Discounts", href: "/pricing", icon: Percent },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Stock Overview", href: "/inventory", icon: Warehouse },
      { label: "Inventory Movements", href: "/inventory/movements", icon: ArrowLeftRight },
      { label: "Stock Adjustments", href: "/inventory/adjustments", icon: ClipboardList },
      { label: "Stock Transfers", href: "/inventory/transfers", icon: Truck },
      { label: "Stocktakes", href: "/inventory/stocktakes", icon: ClipboardList },
      { label: "Low Stock", href: "/inventory/low-stock", icon: AlertTriangle },
    ],
  },
  {
    label: "Purchasing",
    items: [
      { label: "Suppliers", href: "/suppliers", icon: Truck },
      { label: "Purchase Orders", href: "/purchase-orders", icon: ClipboardList },
      { label: "Goods Receiving", href: "/receiving", icon: Warehouse },
    ],
  },
  {
    label: "Customers",
    items: [
      { label: "Customer Directory", href: "/customers", icon: Users },
      { label: "Purchase History", href: "/customers/history", icon: Receipt },
    ],
  },
  {
    label: "Business Management",
    items: [
      { label: "Employees", href: "/employees", icon: UserCog },
      { label: "Roles & Permissions", href: "/roles", icon: Shield },
      { label: "Outlets", href: "/outlets", icon: Building2 },
      { label: "POS Devices", href: "/devices", icon: Monitor },
    ],
  },
  {
    label: "Analytics",
    items: [
      { label: "Sales Reports", href: "/reports/sales", icon: BarChart3 },
      { label: "Product Performance", href: "/reports/products", icon: TrendingUp },
      { label: "Inventory Reports", href: "/reports/inventory", icon: PieChart },
      { label: "Payment Reports", href: "/reports/payments", icon: CreditCard },
      { label: "Cashier Reports", href: "/reports/cashiers", icon: UserCog },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Business Profile", href: "/settings/business", icon: Building2 },
      { label: "Taxes", href: "/settings/taxes", icon: Percent },
      { label: "Payment Methods", href: "/settings/payment-methods", icon: CreditCard },
      { label: "Receipt Settings", href: "/settings/receipts", icon: Receipt },
      { label: "Notifications", href: "/settings/notifications", icon: AlertTriangle },
      { label: "Security", href: "/settings/security", icon: Shield },
      { label: "Account", href: "/settings/account", icon: UserCog },
    ],
  },
];
