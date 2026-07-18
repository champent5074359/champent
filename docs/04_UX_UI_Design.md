# UX/UI Design Blueprint

## 1. Design Goal

The interface should make daily business operations feel clear and fast for non-technical owners and staff. Prioritize concise actions, readable summaries, and mobile-friendly layouts.

## 2. Primary Navigation

- Dashboard
- Sales
- Products
- Inventory
- Purchases
- Finance (Income and Expenses)
- Suppliers
- Events and Goals
- Settings (Business, Branches, Users)

## 3. Key Screens

| Screen | Main purpose | Essential content |
| --- | --- | --- |
| Dashboard | Understand current performance | Sales, stock alerts, expenses, income, goals, branch switcher |
| Products | Maintain catalog | Search, category filter, product list, add/edit product |
| Inventory | Control stock by branch | On-hand quantity, reorder alert, stock adjustment/history |
| Sales | Record and review transactions | Product selection, cart, payment, receipt, sales history |
| Finance | Track cash movement | Income/expense list, date range, category filter, totals |
| Purchases | Receive stock and manage vendors | Supplier, purchase record, received status, totals |
| Settings | Manage organization | Business profile, branches, users, future permissions |

## 4. UX Principles

- Always show the active business and branch context.
- Use clear status labels: Draft, Confirmed, Paid, Cancelled, Active, Inactive.
- Keep common actions within one or two taps/clicks.
- Confirm actions that affect money or stock.
- Use empty states that explain the next action.
- Support responsive layouts, with tables adapting to cards on small screens.

## 5. Initial Visual Direction

- Clean, calm, business-focused interface
- High contrast for numeric values and stock alerts
- Consistent spacing and one primary action per screen
- Color reserved for state and alerts, not decoration alone

## 6. Deferred UX Work

- Wireframes and clickable prototype
- Full design system and component library
- Accessibility audit and localization rules

## 7. Sprint 6C Product Management Flow

The Products screen keeps catalog maintenance in one responsive workspace:

```text
Products → Add product / Edit product
  → check category and unit options
  → create missing category or unit inline when needed
  → automatically select the newly created master data
  → validate product fields
  → save and refresh the list
```

- The product form includes name, category, unit, SKU, barcode, description, cost price, selling price, stock-tracking preference, low-stock threshold, and active status.
- Missing categories or units are explained inside the product form with direct creation actions; the product form stays open throughout this flow.
- Search operates on the already-loaded product list by name, SKU, and barcode. Category, active status, and stock-tracking filters update immediately.
- Product sorting supports name, newest first, and selling price in either direction.
- Destructive actions require confirmation and use Soft Delete. Staff have a read-only catalog without create, edit, or delete actions.
- On small screens, the product table becomes stacked cards and forms use a single-column layout without horizontal page overflow.
