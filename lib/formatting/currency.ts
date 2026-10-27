export function formatCurrency(amount: number, currency = "IDR", locale = "id-ID") {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function formatCompactCurrency(amount: number, currency = "IDR", locale = "id-ID") {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return formatCurrency(amount, currency, locale);
  }
}

export function formatNumber(value: number, locale = "id-ID") {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

export function formatCompactNumber(value: number, locale = "en-GB") {
  try {
    return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  } catch {
    return String(value);
  }
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

/** Date only. Example: 27 Oct 2026 */
export function formatDate(iso: string | Date, locale = "en-GB") {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return typeof iso === "string" ? iso : "";
  try {
    return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(date);
  } catch {
    return date.toDateString();
  }
}

/** Date + time. Example: 27 Oct 2026, 14:32 */
export function formatDateTime(iso: string | Date, locale = "en-GB") {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return typeof iso === "string" ? iso : "";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function formatTime(iso: string | Date, locale = "en-GB") {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  } catch {
    return date.toTimeString().slice(0, 5);
  }
}

export function formatShortDate(iso: string | Date, locale = "en-GB") {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date);
  } catch {
    return date.toDateString();
  }
}

export function formatWeekday(iso: string | Date, locale = "en-GB") {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  } catch {
    return date.toDateString();
  }
}

/** "just now", "4 min ago", "2 hr ago", then a date. */
export function formatRelative(iso: string | Date) {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(date);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
