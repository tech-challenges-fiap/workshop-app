## Context

Phase 4 of the FIAP Tech Challenge splits the workshop system into three microservices: OS Service (`workshop-app`), Billing Service, and Execution Service. Each service must own its primary domain, its database schema, and its projection of any foreign data it needs for read-only display.

`workshop-app` is designated the **OS Service**. Its central aggregate is the work order (OS in Portuguese: *Ordem de Serviço*). It already holds `work_orders`, `work_order_status_history`, `persons`, `vehicles`, `services`, `service_tasks`, and `stock_items` tables from the monolithic phase. This design records the boundary lines before Phase 4 implementation changes those tables, removes cross-service joins, and introduces service-specific projections.

## Goals / Non-Goals

**Goals:**
- Declare `workshop-app` as the authoritative OS Service with unambiguous data ownership.
- Define which tables are primary domain data (owned and mutable) vs. which are read-model projections (seeded or replicated, never written via business logic).
- Document the auth contract (JWT from `workshop-edge`) so auth is never redefined or duplicated inside this service.
- Prohibit direct SQL access to Billing Service or Execution Service databases so no cross-schema join leaks into `workshop-app` code.
- Provide a stable specification reference for all Phase 4 implementation changes in this repository.

**Non-Goals:**
- Do not define the internal schema of Billing Service or Execution Service databases.
- Do not implement replication, event streaming, or projection synchronization in this change.
- Do not change any runtime code, HTTP routes, or database migrations in this change.
- Do not define inter-service communication protocols (that belongs in a separate cross-repo change).

## Decisions

### Decision: `persons` and `vehicles` rows become a read-model projection

**Rationale**: Work-order handlers need `person_id`, `vehicle_id`, a display name, and a plate/model for response payloads. Rather than querying another service on every request, `workshop-app` maintains a local read-only copy that is populated by seed, migration, or an eventual event consumer. This keeps the OS Service self-contained and avoids synchronous cross-service calls on the hot path.

**Alternative considered**: Live RPC call to a People/Fleet service. Rejected because it introduces a synchronous runtime dependency that would break work-order reads when those services are unavailable.

### Decision: `work_orders` and `work_order_status_history` are primary domain data

**Rationale**: The OS Service is the system of record for work-order lifecycle. It holds the lifecycle state machine, status transitions, and history. Billing and Execution services consume events or snapshots of work-order state — they do not own or mutate this data.

**Alternative considered**: Shared ownership with Billing. Rejected because shared ownership creates coupling and ambiguity about which service validates state transitions.

### Decision: Auth is consumed, not issued

**Rationale**: `workshop-edge` issues HS256 JWTs with the claims `sub`, `person_id`, `cpf`, `role`, `status`, and `jti`. `workshop-app` validates the signature with `JWT_SECRET` and rejects any token where `status !== "active"` with 403. This is the existing behavior; the design formalizes it as a boundary constraint rather than an implementation detail.

**Alternative considered**: Issuing service-scoped tokens. Rejected; it would require `workshop-app` to own a credential store, which is out of scope for this service.

### Decision: Cross-database access is explicitly prohibited

**Rationale**: A clear prohibition prevents future implementors from using Drizzle across multiple database connections pointing to Billing or Execution schemas. Without this decision recorded in the spec, it is ambiguous whether a read-only cross-schema SELECT would be acceptable.

## Risks / Trade-offs

- **Projection staleness** → If the event/replication mechanism that keeps `persons` and `vehicles` up to date is delayed, OS Service may return slightly stale customer names or vehicle details. Acceptable for Phase 4; a staleness SLO should be defined in the replication change.
- **Scope creep** → Phase 4 implementation may reveal that `services`, `service_tasks`, or `stock_items` also need boundary decisions (owned vs. projected). If so, update this design and the spec before implementing.
- **Missing replication mechanism** → This change does not implement projection sync. Until the replication change lands, seeds provide the initial projection dataset.
