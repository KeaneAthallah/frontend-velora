export const idr = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
export const categories = ["All", "Coffee", "Non-coffee", "Food", "Snacks"];
export const products = [
  { id: 1, name: "Americano", cat: "Coffee", sku: "COF-001", price: 25000, cost: 8000, stock: 84 },
  { id: 2, name: "Caffe Latte", cat: "Coffee", sku: "COF-002", price: 32000, cost: 11000, stock: 62 },
  { id: 3, name: "Cappuccino", cat: "Coffee", sku: "COF-003", price: 32000, cost: 11000, stock: 9 },
  { id: 4, name: "Espresso", cat: "Coffee", sku: "COF-004", price: 20000, cost: 6000, stock: 120 },
  { id: 5, name: "Matcha Latte", cat: "Non-coffee", sku: "NCF-001", price: 34000, cost: 13000, stock: 40 },
  { id: 6, name: "Lemon Tea", cat: "Non-coffee", sku: "NCF-002", price: 22000, cost: 6000, stock: 0 },
  { id: 7, name: "Chicken Rice Bowl", cat: "Food", sku: "FOD-001", price: 38000, cost: 16000, stock: 25 },
  { id: 8, name: "Beef Sandwich", cat: "Food", sku: "FOD-002", price: 42000, cost: 19000, stock: 7 },
  { id: 9, name: "Butter Croissant", cat: "Snacks", sku: "SNK-001", price: 24000, cost: 9000, stock: 33 },
  { id: 10, name: "French Fries", cat: "Snacks", sku: "SNK-002", price: 20000, cost: 7000, stock: 48 },
];
export const customers = [
  { id: 1, name: "Andi Pratama", phone: "0812-5550-0101", visits: 24, spent: 1840000, last: "Today" },
  { id: 2, name: "Siti Rahma", phone: "0813-5550-0178", visits: 17, spent: 1260000, last: "Yesterday" },
  { id: 3, name: "Budi Santoso", phone: "0821-5550-0233", visits: 9, spent: 640000, last: "3 days ago" },
  { id: 4, name: "Maya Lestari", phone: "0857-5550-0312", visits: 3, spent: 215000, last: "Last week" },
];
export const orders = [
  { id: "INV-2041", time: "10:42", customer: "Andi Pratama", items: 3, total: 89000, method: "QRIS", status: "Paid" },
  { id: "INV-2040", time: "10:18", customer: "Walk-in", items: 1, total: 25000, method: "Cash", status: "Paid" },
  { id: "INV-2039", time: "09:55", customer: "Siti Rahma", items: 4, total: 132000, method: "Card", status: "Paid" },
  { id: "INV-2038", time: "09:31", customer: "Walk-in", items: 2, total: 64000, method: "Cash", status: "Refunded" },
  { id: "INV-2037", time: "09:05", customer: "Budi Santoso", items: 2, total: 58000, method: "QRIS", status: "Paid" },
];
export const purchaseOrders = [
  { id: "PO-0112", supplier: "Kopi Nusantara", items: 6, total: 4200000, date: "26 Oct", status: "Received" },
  { id: "PO-0113", supplier: "Dairy Fresh", items: 3, total: 1350000, date: "27 Oct", status: "Ordered" },
  { id: "PO-0114", supplier: "Bakery Supply Co", items: 4, total: 980000, date: "27 Oct", status: "Draft" },
];
export const sales7 = [8.2, 9.1, 7.6, 10.4, 11.8, 14.2, 12.6];
export const days7 = ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"];
