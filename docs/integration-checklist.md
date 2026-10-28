# Frontend/Backend Integration Checklist

## Implemented against (mocked) contracts
- Auth: login, logout, me, forgot-password (mock always succeeds)
- Business: getBusiness, listOutlets, listPaymentMethods
- Products: list, get, create, update, listCategories
- Menu: getMenu (availability + modifier groups), modifier group/option CRUD, product/category attach + detach, 86/restore, dayparts CRUD, product serving windows
- Sales/Transactions: list, get, checkout (idempotency key supported, modifier options priced server-side)
- Orders: list (active/all, by type and search), create open tab, edit items, kitchen status (fire/ready/served), checkout with payment, cancel; POS order types, delivery details, save-as-open-order and resume via `/sales?order=ID`
- Inventory: stockByOutlet, adjustStock, listMovements
- Ingredients: list (with per-outlet quantity/value), create (+opening stock), update, delete/deactivate, stock adjust, balanced ledger
- Recipes: list (with recipe cost + per-variant cost), get, replace product-level or variant-level BOM; mock checkout consumes ingredients and void restores them
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
- Recipes back office (`/recipes`) shows the Recipes tab for `recipes.view` and the Ingredients tab for `ingredients.view`. Editing is gated on `recipes.manage` / `ingredients.manage`. Ingredient adjustments require an active outlet because stock is per outlet.
- Deleting an ingredient that has recipe lines or stock history fails; deactivate it instead (the API blocks the delete, and the mock mirrors it).
- The order board (`/orders`) polls every 5 seconds. Status changes and checkout require `orders.manage`; cancellation requires `orders.cancel`. Opening a tab in the register requires `sales.create` and links back to `/sales?order=ID`.
- Opening an order never moves stock. Product and recipe deductions happen at checkout, when the order becomes a completed sale and gets its receipt number.
- Delivery orders require a contact phone and address in both the register and the order board; the API rejects them with `422 ORDER_ERROR` otherwise.
