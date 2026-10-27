"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Info,
  Loader2,
  Minus,
  X,
} from "lucide-react";
export { Info }
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "quiet" | "ghost" | "danger" | "danger-quiet" | "link";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClass: Record<ButtonVariant, string> = {
  primary: "btn--primary",
  secondary: "btn--secondary",
  quiet: "btn--quiet",
  ghost: "btn--ghost",
  danger: "btn--danger",
  "danger-quiet": "btn--danger-quiet",
  link: "btn--link",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "btn--sm",
  md: "",
  lg: "btn--lg",
  icon: "btn--icon",
};

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  block = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn("btn", variantClass[variant], sizeClass[size], block && "btn--block", className)}
      disabled={disabled || loading}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  bordered = false,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string; bordered?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("icon-btn", bordered && "icon-btn--bordered", className)}
      {...props}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge / status                                                             */
/* -------------------------------------------------------------------------- */

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span className={cn("badge", `badge--${tone}`, className)} {...props}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

type StatusMeta = { label: string; tone: BadgeTone };

const statusMap: Record<string, StatusMeta> = {
  completed: { label: "Completed", tone: "success" },
  paid: { label: "Paid", tone: "success" },
  success: { label: "Paid", tone: "success" },
  active: { label: "Active", tone: "success" },
  approved: { label: "Approved", tone: "info" },
  received: { label: "Received", tone: "success" },
  completed_receipt: { label: "Received", tone: "success" },
  draft: { label: "Draft", tone: "neutral" },
  pending: { label: "Pending", tone: "warning" },
  invited: { label: "Invited", tone: "info" },
  partial: { label: "Partially received", tone: "warning" },
  partially_received: { label: "Partially received", tone: "warning" },
  refunded: { label: "Refunded", tone: "warning" },
  partially_refunded: { label: "Partially refunded", tone: "warning" },
  voided: { label: "Voided", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  canceled: { label: "Cancelled", tone: "neutral" },
  inactive: { label: "Inactive", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
  expired: { label: "Expired", tone: "danger" },
  low: { label: "Low stock", tone: "warning" },
  out: { label: "Out of stock", tone: "danger" },
  healthy: { label: "In stock", tone: "success" },
};

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  const key = (status ?? "").toLowerCase();
  const meta = statusMap[key] ?? { label: label ?? status ?? "Unknown", tone: "neutral" as BadgeTone };
  return (
    <Badge tone={meta.tone} dot>
      {label ?? meta.label}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                     */
/* -------------------------------------------------------------------------- */

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 30, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("avatar", className)}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.37)) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton / alert / empty                                                   */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} aria-hidden="true" {...props} />;
}

export function Alert({
  tone = "neutral",
  title,
  children,
  className,
}: {
  tone?: "neutral" | "danger" | "warning" | "success" | "info";
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const Icon = tone === "danger" || tone === "warning" ? AlertCircle : Info;
  return (
    <div className={cn("alert", tone !== "neutral" && `alert--${tone}`, className)} role={tone === "danger" ? "alert" : undefined}>
      <Icon aria-hidden="true" />
      <div>
        {title && <strong>{title}</strong>}
        {title && children ? " " : null}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
  compact = false,
  titleLevel = "h3",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  compact?: boolean;
  titleLevel?: "h1" | "h2" | "h3";
}) {
  const Title = titleLevel;
  return (
    <div className={cn("empty", compact && "empty--compact")}>
      {icon && <div className="empty__icon">{icon}</div>}
      <Title>{title}</Title>
      {description && <p>{description}</p>}
      {actions && <div className="empty__actions">{actions}</div>}
    </div>
  );
}

export function Spinner({ size = 16, label = "Loading" }: { size?: number; label?: string }) {
  return (
    <span className="row row-tight" role="status" aria-label={label}>
      <Loader2 style={{ width: size, height: size }} className="animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Form fields                                                                */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
  aside,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className={cn("field", className)}>
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          <span>
            {label}
            {required && (
              <span className="field__req" aria-hidden="true">
                *
              </span>
            )}
          </span>
          {aside}
        </label>
      )}
      {children}
      {error ? (
        <span className="field__error" role="alert">
          <AlertCircle aria-hidden="true" />
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("input", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn("textarea", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select className={cn("select", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.ComponentProps<"input"> & { label: React.ReactNode; description?: React.ReactNode }) {
  return (
    <label className={cn("check", className)}>
      <input type="checkbox" {...props} />
      <span>
        {label}
        {description && <span className="field__hint" style={{ display: "block" }}>{description}</span>}
      </span>
    </label>
  );
}

export function Switch({
  label,
  description,
  className,
  ...props
}: React.ComponentProps<"input"> & { label?: React.ReactNode; description?: React.ReactNode }) {
  return (
    <label className={cn("switch", className)}>
      <input type="checkbox" role="switch" {...props} />
      <span className="switch__track" aria-hidden="true" />
      {(label || description) && (
        <span>
          {label}
          {description && <span className="field__hint" style={{ display: "block" }}>{description}</span>}
        </span>
      )}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Segmented / tabs                                                           */
/* -------------------------------------------------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("segmented", className)} role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: { id: string; label: React.ReactNode; count?: number }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = event.key === "ArrowRight" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    onChange(items[next].id);
    const buttons = (event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
    buttons[next]?.focus();
  };
  return (
    <div className={cn("tabs", className)} role="tablist">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          tabIndex={value === item.id ? 0 : -1}
          className="tab"
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {item.label}
          {typeof item.count === "number" && <span className="tab__count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Delta / info tip                                                           */
/* -------------------------------------------------------------------------- */

export function Delta({
  value,
  suffix = "%",
  invert = false,
  className,
}: {
  value: number | null | undefined;
  suffix?: string;
  invert?: boolean;
  className?: string;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className="delta delta--flat">No prior data</span>;
  }
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const positive = invert ? direction === "down" : direction === "up";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  return (
    <span className={cn("delta", positive ? "delta--up" : direction === "flat" ? "delta--flat" : "delta--down", className)}>
      <Icon aria-hidden="true" />
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}
      {suffix}
    </span>
  );
}

export function InfoTip({ children, label }: { children: React.ReactNode; label: string }) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ left: number; top: number } | null>(null);
  const wrapRef = React.useRef<HTMLSpanElement>(null);
  const bubbleRef = React.useRef<HTMLSpanElement>(null);

  const place = React.useCallback(() => {
    const trigger = wrapRef.current?.querySelector<HTMLButtonElement>(".info-tip__trigger");
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;
    const triggerRect = trigger.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(
      Math.max(margin, triggerRect.left + triggerRect.width / 2 - bubbleRect.width / 2),
      window.innerWidth - bubbleRect.width - margin
    );
    const above = triggerRect.top - bubbleRect.height - 8;
    const top = above >= margin ? above : triggerRect.bottom + 8;
    setPosition({ left, top });
  }, []);

  React.useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  React.useEffect(() => {
    if (!open) return;
    const onViewportChange = () => place();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open, place]);

  return (
    <span
      ref={wrapRef}
      className="info-tip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          event.stopPropagation();
        }
      }}
    >
      <button
        type="button"
        className="info-tip__trigger"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Info aria-hidden="true" />
      </button>
      {open && (
        <span
          ref={bubbleRef}
          id={id}
          className="info-tip__bubble"
          role="tooltip"
          style={position ? { left: position.left, top: position.top } : { left: 0, top: 0, visibility: "hidden" }}
        >
          {children}
        </span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Dropdown menu                                                              */
/* -------------------------------------------------------------------------- */

type MenuContextValue = { close: () => void };
const MenuContext = React.createContext<MenuContextValue | null>(null);

export function DropdownMenu({
  trigger,
  children,
  align = "end",
  width = 210,
  label,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode | ((ctx: MenuContextValue) => React.ReactNode);
  align?: "start" | "end";
  width?: number;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"], [data-menu-item]') ?? []);
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items[next]?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"], [data-menu-item]');
    first?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="menu-wrap">
      <div
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="menu-trigger"
      >
        {trigger}
      </div>
      {open && (
        <div
          ref={menuRef}
          className="popover"
          role="menu"
          aria-label={label}
          style={{ width, [align === "end" ? "right" : "left"]: 0, top: "calc(100% + 6px)" }}
        >
          <MenuContext.Provider value={{ close }}>
            {typeof children === "function" ? children({ close }) : children}
          </MenuContext.Provider>
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
  icon,
  danger = false,
  disabled = false,
  selected = false,
  closeOnSelect = true,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  selected?: boolean;
  closeOnSelect?: boolean;
}) {
  const ctx = React.useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      className={cn("menu-item", danger && "menu-item--danger")}
      disabled={disabled}
      onClick={() => {
        onSelect?.();
        if (closeOnSelect) ctx?.close();
      }}
    >
      {icon}
      <span>{children}</span>
      {selected && <Check className="menu-check" aria-hidden="true" />}
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="menu-label">{children}</div>;
}

export function MenuSeparator() {
  return <div className="menu-sep" role="separator" />;
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                       */
/* -------------------------------------------------------------------------- */

export function PageSizeSelect({
  value,
  onChange,
  options = [10, 20, 50],
}: {
  value: number;
  onChange: (value: number) => void;
  options?: number[];
}) {
  return (
    <label className="row row-tight hint" style={{ gap: 5 }}>
      <span>Rows</span>
      <span className="relative">
        <select
          className="select input--sm"
          style={{ height: 28, width: 64, fontSize: 11.5, paddingLeft: 8 }}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label="Rows per page"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

export function ChipButton({
  active,
  children,
  count,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean; count?: number }) {
  return (
    <button type="button" className="chip" aria-pressed={active} {...props}>
      {children}
      {typeof count === "number" && <span className="chip__count">{count}</span>}
    </button>
  );
}

export function CloseButton({ label = "Close", ...props }: React.ComponentProps<"button"> & { label?: string }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} {...props}>
      <X aria-hidden="true" />
    </button>
  );
}

export function Chevron({ className }: { className?: string }) {
  return <ChevronDown className={className} aria-hidden="true" />;
}
