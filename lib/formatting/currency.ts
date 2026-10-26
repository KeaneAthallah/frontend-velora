export function formatCurrency(amount: number, currency = "IDR", locale = "id-ID") {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: currency === "IDR" ? 0 : 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function formatDate(iso: string, locale = "id-ID") {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}
