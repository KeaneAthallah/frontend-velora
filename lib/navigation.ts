import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  UserRound,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  permissions?: string[];
  description?: string;
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
        label: "Transactions",
        href: "/transactions",
        icon: Receipt,
        permission: "sales.view",
        description: "Receipts, payments, and voids",
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
        label: "Inventory",
        href: "/inventory",
        icon: Boxes,
        permission: "inventory.view",
        description: "Stock levels and movements",
      },
      {
        label: "Purchasing",
        href: "/purchasing",
        icon: ClipboardList,
        permission: "purchasing.view",
        description: "Purchase orders and receiving",
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
    label: "Relationships",
    items: [
      {
        label: "Customers",
        href: "/customers",
        icon: Users,
        permission: "customers.view",
        description: "Directory and loyalty",
      },
    ],
  },
  {
    label: "Analyze",
    items: [
      {
        label: "Reports",
        href: "/reports",
        icon: BarChart3,
        permission: "reports.view",
        description: "Sales performance and detail",
      },
    ],
  },
  {
    label: "Manage",
    items: [
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
    ],
  },
];

export const bottomNavItems: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard, permission: "reports.view" },
  { label: "Sell", href: "/sales", icon: ShoppingCart, permission: "sales.create" },
  { label: "Products", href: "/products", icon: Package, permission: "products.view" },
  { label: "Stock", href: "/inventory", icon: Boxes, permission: "inventory.view" },
];

export function filterNavGroups(has: (permission: string) => boolean): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
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
  if (has("sales.view")) return "/transactions";
  if (has("products.view")) return "/products";
  if (has("inventory.view")) return "/inventory";
  if (has("purchasing.view")) return "/purchasing";
  if (has("customers.view")) return "/customers";
  if (has("employees.view")) return "/employees";
  return "/settings";
}
