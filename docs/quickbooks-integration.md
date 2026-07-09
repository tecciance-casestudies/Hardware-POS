# QuickBooks Online Integration

> Placeholder — **not implemented yet.** This document captures intent only.

## Principles

- QuickBooks Online = inventory + accounting master.
- POS = cashier sales workflow.
- Do not edit stock independently in both systems.
- POS keeps a local product cache for fast checkout.
- If sync fails, keep the sale saved and retry later.

## Direction of sync

**QuickBooks → POS**

- Products / items
- Prices
- Quantity on hand

**POS → QuickBooks**

- Sales receipts
- Invoices + payments
- Payments

## Transaction mapping

| POS event           | QuickBooks result       |
| ------------------- | ----------------------- |
| Fully paid sale     | Sales Receipt           |
| Partial / credit    | Invoice + Payment       |
| Return / exchange   | Refund / Credit flow    |

## Auth

- OAuth 2.0 against the QuickBooks Online Accounting API.
- Sandbox environment first, then production.
- Credentials configured via `QBO_*` environment variables (see `.env.example`).

## Error handling

- Every outbound sync writes a **sync log** entry (pending → syncing → synced / failed).
- Failed syncs are retryable from the POS sync log UI.
