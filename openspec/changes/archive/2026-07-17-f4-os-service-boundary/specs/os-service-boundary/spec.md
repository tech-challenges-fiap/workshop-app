## ADDED Requirements

### Requirement: OS Service owns work-order primary data
`workshop-app` SHALL be the sole system of record for `work_orders` and `work_order_status_history`. No other service SHALL write to these tables.

#### Scenario: Work-order mutation routed to OS Service
- **WHEN** any actor creates, updates, or transitions the status of a work order
- **THEN** the request is handled exclusively by `workshop-app` domain logic and persisted in the `workshop-app` PostgreSQL database

#### Scenario: Work-order state read by another service
- **WHEN** Billing Service or Execution Service needs work-order state
- **THEN** they consume it via an event, a published projection, or an authorized HTTP call to `workshop-app` — never via a direct SQL connection to the `workshop-app` database

### Requirement: Person and vehicle data is a read-only projection in OS Service
`workshop-app` SHALL maintain a local read-only copy of the person and vehicle attributes needed to populate work-order response payloads. This projection SHALL NOT be mutated through OS Service business logic.

#### Scenario: Work-order response includes customer and vehicle details
- **WHEN** a client requests work-order details
- **THEN** `workshop-app` resolves the display name, CPF, and vehicle plate/model from its local projection tables without issuing a synchronous inter-service call

#### Scenario: Agent attempts to write person record via OS Service domain logic
- **WHEN** an agent or developer proposes a use case that creates or updates a `person` record through OS Service application code
- **THEN** the change is rejected; person master data is owned by a People or Identity service and flows into OS Service as a projection only

### Requirement: OS Service validates JWT issued by workshop-edge
`workshop-app` SHALL authenticate all protected HTTP routes by validating a HS256 JWT signed with `JWT_SECRET`, issued by `workshop-edge`, and targeted at `workshop-app`.

#### Scenario: Request with valid active-user JWT
- **WHEN** a request carries a JWT where `iss=workshop-edge`, `aud=workshop-app`, the signature is valid, the token is not expired, and `status=active`
- **THEN** the middleware extracts `subject`, `personId`, `cpfHash`, `role`, and `jti` into the request context and allows the handler to proceed

#### Scenario: Request with inactive-user JWT
- **WHEN** a request carries a JWT where `status` is not `active`
- **THEN** the middleware responds with HTTP 403 and does not invoke the route handler

#### Scenario: Request with no or malformed JWT
- **WHEN** a request to a protected route carries no bearer token or a token that fails signature verification or claim validation
- **THEN** the middleware responds with HTTP 401

### Requirement: OS Service SHALL NOT access Billing or Execution databases
`workshop-app` MUST NOT open a direct database connection to any schema or database instance owned by Billing Service or Execution Service.

#### Scenario: Implementation requires data from Billing Service
- **WHEN** an implementation task needs data that originates in Billing Service
- **THEN** the developer requests an inter-service API or event feed from the Billing Service — never a direct SQL connection or shared connection string

#### Scenario: Code review detects cross-service database connection
- **WHEN** a pull request introduces a `DATABASE_URL` or `POSTGRES_*` environment variable pointing to a Billing or Execution database
- **THEN** the PR is rejected and the violation is reported to Hermes/Void for resolution

### Requirement: OS Service boundary documented before Phase 4 implementation begins
An approved OpenSpec change declaring the OS Service boundary MUST exist and validate before any Phase 4 implementation changes are made to `workshop-app` source, schema, or Kubernetes manifests.

#### Scenario: Agent receives Phase 4 implementation task without boundary spec
- **WHEN** an agent is asked to implement a Phase 4 feature in `workshop-app` and the `f4-os-service-boundary` spec is not present or not validated
- **THEN** the agent stops and raises the gap to Hermes/Void before modifying any implementation files
