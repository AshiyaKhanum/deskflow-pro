# DeskFlow Pro — API Reference

Base URL (local): `http://localhost:8000/api`

All responses use the envelope:

```json
{ "success": true, "data": { ... } }
```

or, on error:

```json
{ "success": false, "message": "Human readable message", "details": [ ... optional ... ] }
```

Authenticated endpoints require `Authorization: Bearer <jwt>`. Role requirements are enforced
independently on the backend (`authorize()` middleware) regardless of what the frontend shows.

---

## Auth

### `POST /auth/register`
- Auth: none
- Body: `{ name, email, password }`
- Any `role` field sent by the client is ignored — every self-registered account is created as
  `customer`. Only an admin can change a role afterward (`PATCH /users/:id`).
- Responses: `201` `{ token, user }` · `400` validation · `409` email already in use

### `POST /auth/login`
- Auth: none
- Body: `{ email, password }`
- Responses: `200` `{ token, user }` · `401` invalid credentials · `403` account deactivated

### `POST /auth/logout`
- Auth: none required (JWTs are stateless; this is a client-side contract point)
- Responses: `200`

### `GET /auth/me`
- Auth: required
- Responses: `200` current user · `401` missing/invalid/expired token

---

## Tickets

### `GET /tickets`
- Auth: required (role-scoped automatically — see below)
- Role scope:
  - `customer` → only their own tickets
  - `agent` → tickets assigned to them, plus the unassigned queue
  - `admin` → all tickets
- Query params: `page`, `limit` (max 100), `search` (ticket #, title, customer name/email),
  `status`, `priority`, `category`, `assignedAgent`, `slaStatus` (`within_sla`|`due_soon`|`breached`),
  `dateFrom`, `dateTo`, `sortBy` (`createdAt`|`updatedAt`|`priority`|`slaDueAt`|`status`), `sortOrder` (`asc`|`desc`)
- Response: `200` `{ tickets: Ticket[], pagination: { page, limit, total, totalPages } }`

### `POST /tickets`
- Auth: required, role: `customer`
- Body: `{ title, description, category, priority }`
- The backend calculates `slaDueAt` from the active SLA policy for that priority — the client
  cannot supply or influence it.
- Responses: `201` created ticket · `400` validation · `403` non-customer caller

### `GET /tickets/:id`
- Auth: required
- A customer requesting a ticket that isn't theirs gets `404` (not `403`) so ticket existence
  isn't leaked to people who shouldn't see it.
- Responses: `200` ticket (includes derived `slaStatus`) · `404`

### `PATCH /tickets/:id`
- Auth: required, role: `agent` or `admin`
- Body (all optional): `{ title, description, category, priority, assignedAgent }`
- Only an `admin` may set `assignedAgent`.
- Responses: `200` updated ticket · `403` · `404`

### `PATCH /tickets/:id/status`
- Auth: required, role: `agent` or `admin`
- Body: `{ status, note? }`
- Status changes are validated against the explicit state machine
  (`open→in_progress|pending`, `in_progress→pending|resolved`, `pending→in_progress`,
  `resolved→closed|in_progress`, `closed` is terminal). Any other transition (e.g. `open→closed`)
  is rejected.
- Responses: `200` updated ticket · `400` invalid transition · `403` customer attempting to change status

### `DELETE /tickets/:id`
- Auth: required, role: `admin`
- Responses: `200` · `403` · `404`

### `GET /tickets/:id/comments`
- Auth: required
- **Customer responses never include `visibility: "internal"` comments** — the filter is applied
  in the database query itself, not stripped afterward.
- Responses: `200` comment array

### `POST /tickets/:id/comments`
- Auth: required
- Body: `{ body, visibility }` (`visibility` defaults to `public`)
- A `customer` may not set `visibility: "internal"` (`403` if attempted).
- Responses: `201` created comment

---

## Users (admin-only, except `/users/agents`)

### `GET /users/agents`
- Auth: required, role: `agent` or `admin` (needed to populate assignment dropdowns)
- Response: `200` array of active agents

### `GET /users`
- Auth: required, role: `admin`
- Query: `page`, `limit`, `search`, `role`, `isActive` (`true`|`false`)
- Response: `200` `{ users, pagination }`

### `POST /users`
- Auth: required, role: `admin`
- Body: `{ name, email, password, role }`
- Response: `201` created user · `409` email in use

### `PATCH /users/:id`
- Auth: required, role: `admin`
- Body (all optional): `{ role, isActive, name }`
- An admin cannot deactivate their own account (`400`). No client-supplied role is ever trusted
  outside this endpoint.
- Response: `200` updated user

---

## SLA Policies

### `GET /sla-policies`
- Auth: required (any authenticated role — needed to show SLA info in ticket UIs)
- Response: `200` array of policies

### `POST /sla-policies`
- Auth: required, role: `admin`
- Body: `{ priority, responseTimeHours, resolutionTimeHours, isActive? }`
- Upserts the policy for that priority.

### `PATCH /sla-policies/:id`
- Auth: required, role: `admin`
- Body (all optional): `{ responseTimeHours, resolutionTimeHours, isActive }`
- **Behavior when a policy changes:** each ticket stores a snapshot of the SLA policy
  (`slaPolicySnapshot`) and its computed `slaDueAt` at creation time. Changing a policy here only
  affects tickets created **after** the change — it never retroactively moves the deadline on a
  ticket already in flight.

---

## Dashboard

### `GET /dashboard/stats`
- Auth: required, role: `admin`
- Response: `200`
  ```json
  {
    "statusCounts": { "total": 0, "open": 0, "in_progress": 0, "pending": 0, "resolved": 0, "closed": 0 },
    "priorityBreakdown": { "low": 0, "medium": 0, "high": 0, "urgent": 0 },
    "sla": { "breachedOpenCount": 0, "dueSoonCount": 0, "totalOpenCount": 0, "slaComplianceRate": null, "resolvedWithinSlaCount": 0, "resolvedCount": 0 },
    "performance": { "ticketsCreated": 0, "ticketsResolved": 0, "ticketsCurrentlyOpen": 0, "averageResolutionHours": null, "rangeDays": 30 },
    "agentWorkload": [ { "agentId": "...", "name": "...", "assignedCount": 0, "openCount": 0, "resolvedCount": 0, "breachedCount": 0 } ],
    "recentActivity": [ /* Ticket[] */ ]
  }
  ```
- Every field is computed with a MongoDB aggregation query against the live collections — nothing
  is hard-coded, and nothing is computed by downloading the full ticket set into Node.

---

## Error status codes used throughout

| Code | Meaning |
|---|---|
| 400 | Bad request — validation failure, or an illegal ticket status transition |
| 401 | Missing, malformed, or expired auth token; or wrong credentials at login |
| 403 | Authenticated, but the role/ownership rules forbid this action |
| 404 | Resource not found (including "not yours to see") |
| 409 | Conflict — e.g. duplicate email |
| 422 | Mongoose validation error surfaced from the database layer |
| 500 | Unexpected server error (message is generic in production; never leaks internals) |
