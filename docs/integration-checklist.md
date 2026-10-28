# Frontend/Backend Integration Checklist

## Implemented against (mocked) contracts
- Auth: login, logout, me, forgot-password (mock always succeeds)
- Business: getBusiness, listOutlets, listPaymentMethods
- Products: list, get, create, update, listCategories
- Menu: getMenu (availability + modifier groups), modifier group/option CRUD, product/category attach + detach, 86/restore, dayparts CRUD, product serving windows
- Sales/Transactions: list, get, checkout (idempotency key supported, modifier options priced server-side)
- Inventory: stockByOutlet, adjustStock, listMovements
- Purchasing: listSuppliers, listPurchaseOrders
- Employees: listEmployees, listRoles
- Reports: dashboardMetrics

## Not yet verified / missing backend contracts
- Refresh token / session expiration handling
- Returns, refunds, voids
- Cash registers, shifts
- Customers directory and history
- Stock transfers, stocktakes, receiving
- Purchase order create/edit/approve/receive
- Roles/permissions mutation endpoints
- Outlets/devices management
- Taxes, receipt settings, notifications, security settings
- Report export endpoints
- Real-time stock updates
- Idempotency key server contract (assumed)

## Notes
- Mock mode is controlled by NEXT_PUBLIC_USE_MOCK_API (defaults to true when no API base URL).
- Production must set NEXT_PUBLIC_API_BASE_URL and disable mock mode.
- Client-calculated totals are provisional only; checkout returns authoritative totals from the server.
- The POS fetches `getMenu` only when the member has `menu.view`; otherwise it falls back to `listProducts` with no modifier picker, so cashiers can still sell plain items.
- Menu back office (`/menu`) gates availability on `menu.availability`, modifiers on `menu.manage`, and dayparts on `menu.dayparts`.
