import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  Building2,
  FileText,
  LifeBuoy,
  LineChart,
  PackageCheck,
  Plug,
  ShieldCheck,
  Store,
  ChefHat,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Flame,
  FlaskConical,
  LayoutDashboard,
  LayoutGrid,
  Package,
  PackageSearch,
  Receipt,
  Settings,
  ShoppingCart,
  Wallet,
  Tag,
  Truck,
  Users,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  permissions?: string[];
  /** Only visible to platform administrators (billing administration). */
  platformAdmin?: boolean;
  description?: string;
  count?: number;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Operate",
    items: [
      {
        label: "Overview",
        href: "/",
        icon: LayoutDashboard,
        permission: "reports.view",
        description: "Sales, stock, and store health",
      },
      {
        label: "New sale",
        href: "/sales",
        icon: ShoppingCart,
        permission: "sales.create",
        description: "Open the point of sale",
      },
      {
        label: "Orders",
        href: "/orders",
        icon: ClipboardList,
        permission: "orders.view",
        description: "Open tabs and the kitchen queue",
        count: 5,
      },
      {
        label: "Kitchen",
        href: "/kitchen",
        icon: Flame,
        permission: "kitchen.view",
        description: "Station tickets and printing",
      },
      {
        label: "Floor plan",
        href: "/tables",
        icon: LayoutGrid,
        permission: "tables.view",
        description: "Dine-in tables and live occupancy",
      },
      {
        label: "Channels",
        href: "/channels",
        icon: Truck,
        permission: "channels.view",
        description: "Marketplace and online orders",
      },
      {
        label: "Cash registers",
        href: "/shifts",
        icon: Wallet,
        permission: "shifts.view",
        description: "Open tills and reconcile drawers",
      },
      {
        label: "Transactions",
        href: "/transactions",
        icon: Receipt,
        permission: "sales.view",
        description: "Receipts, payments, and voids",
      },
      {
        label: "Deliveries",
        href: "/deliveries",
        icon: PackageCheck,
        permission: "deliveries.view",
        description: "Dispatch board and proof of delivery",
      },
      {
        label: "Storefront",
        href: "/storefronts",
        icon: Store,
        permission: "storefront.view",
        description: "Online catalogue and orders",
      },
    ],
  },
  {
    label: "Catalog & stock",
    items: [
      {
        label: "Products",
        href: "/products",
        icon: Package,
        permission: "products.view",
        description: "Items, prices, and categories",
      },
      {
        label: "Menu",
        href: "/menu",
        icon: UtensilsCrossed,
        permission: "menu.view",
        description: "Modifiers, combos, and availability",
      },
      {
        label: "Stock transfers",
        href: "/stock-transfers",
        icon: Truck,
        permission: "inventory.adjust",
        description: "Draft → complete transfers between outlets",
      },
      {
        label: "Inventory",
        href: "/inventory",
        icon: Boxes,
        permission: "inventory.view",
        description: "Stock levels and movements",
        count: 4,
      },
      {
        label: "Stocktakes",
        href: "/stocktakes",
        icon: ClipboardCheck,
        permission: "inventory.view",
        description: "Count stock and post adjustments",
      },
      {
        label: "Recipes",
        href: "/recipes",
        icon: ChefHat,
        permissions: ["recipes.view", "ingredients.view"],
        description: "Ingredient costing and recipes",
      },
      {
        label: "Ingredients",
        href: "/ingredients",
        icon: FlaskConical,
        permission: "ingredients.view",
        description: "Stock left and the items it limits",
      },
      {
        label: "Purchasing",
        href: "/purchasing",
        icon: ClipboardList,
        permission: "purchasing.view",
        description: "Purchase orders and receiving",
      },
      {
        label: "Reorder copilot",
        href: "/reorder",
        icon: PackageSearch,
        permission: "purchasing.manage",
        description: "Demand forecast and what to buy",
      },
      {
        label: "Suppliers",
        href: "/suppliers",
        icon: Truck,
        permission: "suppliers.view",
        description: "Supply contacts and terms",
      },
    ],
  },
  {
    label: "People & insight",
    items: [
      {
        label: "Customers",
        href: "/customers",
        icon: Users,
        permission: "customers.view",
        description: "Directory and loyalty",
      },
      {
        label: "Promotions",
        href: "/promotions",
        icon: Tag,
        permission: "promotions.view",
        description: "Discount codes and automatic offers",
      },
      {
        label: "Reports",
        href: "/reports",
        icon: BarChart3,
        permission: "reports.view",
        description: "Sales performance and detail",
      },
      {
        label: "Analytics",
        href: "/analytics",
        icon: LineChart,
        permission: "analytics.view",
        description: "Comparisons, margins, and operations",
      },
      {
        label: "Documents",
        href: "/documents",
        icon: FileText,
        permission: "documents.view",
        description: "Contracts, invoices, and files",
      },
      {
        label: "Integrations",
        href: "/integrations",
        icon: Plug,
        permissions: ["api_keys.view", "webhooks.view"],
        description: "API keys and webhooks",
      },
      {
        label: "Support",
        href: "/support",
        icon: LifeBuoy,
        permission: "support.view",
        description: "Tickets and conversations",
      },
      {
        label: "Team",
        href: "/employees",
        icon: UserRound,
        permission: "employees.view",
        description: "Members, roles, and access",
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        permissions: ["businesses.view", "outlets.view", "settings.manage"],
        description: "Business, outlets, and tax",
      },
      {
        label: "Subscription",
        href: "/settings/subscription",
        icon: CreditCard,
        description: "Plan, usage limits, and billing",
      },
      {
        label: "Admin billing",
        href: "/admin/billing",
        icon: Building2,
        permission: "platform.admin",
        platformAdmin: true,
        description: "Platform subscriptions and revenue",
      },
      {
        label: "Platform admin",
        href: "/admin",
        icon: ShieldCheck,
        permission: "platform.admin",
        platformAdmin: true,
        description: "Tenants, support, and configuration",
      },
    ],
  },
];

export const bottomNavItems: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard, permission: "reports.view" },
  { label: "Sell", href: "/sales", icon: ShoppingCart, permission: "sales.create" },
  { label: "Products", href: "/products", icon: Package, permission: "products.view" },
  { label: "Stock", href: "/inventory", icon: Boxes, permission: "inventory.view" },
];

export function filterNavGroups(has: (permission: string) => boolean, isPlatformAdmin = false): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.platformAdmin && !isPlatformAdmin) return false;
        if (item.permissions?.length) return item.permissions.some(has);
        return !item.permission || has(item.permission);
      }),
    }))
    .filter((group) => group.items.length > 0);
}

export function findNavItem(pathname: string): NavItem | null {
  const all = navGroups.flatMap((group) => group.items);
  if (pathname === "/") return all.find((item) => item.href === "/") ?? null;
  return all.find((item) => item.href !== "/" && pathname.startsWith(item.href)) ?? null;
}

export function navTrail(pathname: string): { label: string; href?: string }[] {
  if (pathname === "/") return [{ label: "Overview" }];
  const segments = pathname.split("/").filter(Boolean);
  const trail: { label: string; href?: string }[] = [];
  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const item = findNavItem(href);
    trail.push({
      label:
        item?.label ??
        segment
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
      href: index === segments.length - 1 ? undefined : href,
    });
  });
  return trail;
}

/** First page a member can actually open, used after sign-in. */
export function defaultRoute(has: (permission: string) => boolean) {
  if (has("reports.view")) return "/";
  if (has("sales.create")) return "/sales";
  if (has("orders.view")) return "/orders";
  if (has("kitchen.view")) return "/kitchen";
  if (has("tables.view")) return "/tables";
  if (has("sales.view")) return "/transactions";
  if (has("products.view")) return "/products";
  if (has("inventory.view")) return "/inventory";
  if (has("ingredients.view")) return "/recipes";
  if (has("purchasing.view")) return "/purchasing";
  if (has("customers.view")) return "/customers";
  if (has("employees.view")) return "/employees";
  return "/settings";
}
