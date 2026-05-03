const presentationDomainExceptions = [
  "^src/presentation/stock-items\\.ts$",
  "^src/presentation/vehicles\\.ts$",
  "^src/presentation/person\\.ts$",
  "^src/presentation/work-orders/error-mapping\\.ts$",
  "^src/presentation/services\\.ts$",
  "^src/presentation/service-tasks\\.ts$",
  "^src/presentation/webhooks/work-order-events\\.ts$",
].join("|");

const presentationInfrastructureExceptions = [
  "^src/presentation/auth\\.ts$",
  "^src/presentation/middleware/auth\\.ts$",
].join("|");

const infrastructureApplicationExceptions = [
  "^src/infrastructure/notification/beeceptor-notification\\.ts$",
  "^src/infrastructure/work-order/create-work-order-with-full-payload-unit-of-work-postgres\\.ts$",
].join("|");

module.exports = {
  forbidden: [
    {
      name: "no-domain-to-outer-layers",
      comment:
        "Domain must remain isolated from application, presentation, and infrastructure layers.",
      severity: "error",
      from: { path: "^src/domain" },
      to: { path: "^src/(application|presentation|infrastructure)" },
    },
    {
      name: "no-application-to-presentation",
      comment: "Application use cases must stay transport-agnostic.",
      severity: "error",
      from: { path: "^src/application" },
      to: { path: "^src/presentation" },
    },
    {
      name: "no-application-to-infrastructure",
      comment: "Application must depend on contracts, not concrete adapters.",
      severity: "error",
      from: { path: "^src/application" },
      to: { path: "^src/infrastructure" },
    },
    {
      name: "no-presentation-to-domain",
      comment:
        "Presentation-to-domain imports are blocked outside the temporary accepted dispositions tracked in closure mapping.",
      severity: "error",
      from: {
        path: "^src/presentation",
        pathNot: presentationDomainExceptions,
      },
      to: { path: "^src/domain" },
    },
    {
      name: "no-presentation-to-infrastructure",
      comment:
        "Presentation must not depend on infrastructure outside the temporary auth-related accepted dispositions tracked in closure mapping.",
      severity: "error",
      from: {
        path: "^src/presentation",
        pathNot: presentationInfrastructureExceptions,
      },
      to: { path: "^src/infrastructure" },
    },
    {
      name: "no-infrastructure-to-presentation",
      comment: "Infrastructure adapters must not import controllers or HTTP glue.",
      severity: "error",
      from: { path: "^src/infrastructure" },
      to: { path: "^src/presentation" },
    },
    {
      name: "no-infrastructure-to-application",
      comment:
        "Infrastructure-to-application imports are blocked outside the temporary accepted dispositions tracked in closure mapping.",
      severity: "error",
      from: {
        path: "^src/infrastructure",
        pathNot: infrastructureApplicationExceptions,
      },
      to: { path: "^src/application" },
    },
  ],
  options: {
    tsConfig: {
      fileName: "tsconfig.json",
    },
    includeOnly: "^src/(presentation|application|domain|infrastructure)",
    exclude: "(^node_modules)|\\.(test|spec)\\.[jt]sx?$",
    doNotFollow: {
      path: "^node_modules",
    },
  },
};
