# System Flow

## 1. Workspace Setup Flow

```text
Create Business → Create Branch(es) → Invite/Add User(s) → Configure catalog → Begin operations
```

## 2. Product and Inventory Flow

```text
Create Category → Create Product → Set branch inventory → Receive stock through Purchase → Update inventory balance
```

Future implementation should record all stock changes in an inventory movement ledger for auditability.

## 3. Sales Flow

```text
Select Branch → Create Sale → Add Product line items → Confirm payment → Save Sale and SaleItems → Deduct inventory → Update dashboard metrics
```

## 4. Expense and Income Flow

```text
Select Branch → Enter transaction details → Categorize → Confirm amount/date → Save record → Include in financial reporting
```

## 5. Purchase Flow

```text
Select Branch and Supplier → Record Purchase → Confirm receipt → Increase inventory → Track purchasing history
```

## 6. Planning Flow

```text
Create Goal or Event → Assign business or branch scope → Track progress/status → Review from dashboard
```

## 7. Permission Direction

The first role model will distinguish owner, manager, and staff. Detailed permissions and authentication are explicitly deferred until after the Sprint 1 foundation.
