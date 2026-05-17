# Diagrama de Componentes — workshop-app

Este documento apresenta a visão de componentes do serviço `workshop-app`, incluindo sua posição na infraestrutura de nuvem e a estrutura interna de camadas.

---

## 1. Visão de Nuvem (AWS EKS)

O diagrama abaixo representa a topologia de nuvem completa, com os componentes externos ao repositório (API Gateway, Lambda, RDS, Datadog) e os recursos internos ao cluster EKS.

```mermaid
flowchart TD
    Client["Cliente\n(Admin / Atendente)"]

    subgraph AWS["AWS Cloud"]
        APIGW["API Gateway\n(workshop-edge)"]

        subgraph Lambda["Lambda"]
            AuthLambda["auth-cpf\n(emite JWT HS256)"]
        end

        subgraph EKS["EKS Cluster"]
            subgraph NS_STAG["Namespace: stag"]
                APP_STAG["workshop-app\n(Deployment, 2 réplicas)"]
                HPA_STAG["HPA\n(CPU 70% / Mem 75%\nmin 1 / max 3)"]
                INGRESS_STAG["Ingress\nworkshop-app-stag"]
                HPA_STAG -. escala .-> APP_STAG
                INGRESS_STAG --> APP_STAG
            end

            subgraph NS_PROD["Namespace: prod"]
                APP_PROD["workshop-app\n(Deployment, 2 réplicas)"]
                HPA_PROD["HPA\n(CPU 70% / Mem 75%\nmin 1 / max 3)"]
                INGRESS_PROD["Ingress\nworkshop-app-prod"]
                HPA_PROD -. escala .-> APP_PROD
                INGRESS_PROD --> APP_PROD
            end
        end

        RDS["Amazon RDS\n(workshop-db / PostgreSQL)"]
        ECR["Amazon ECR\n(image registry)"]
        Datadog["Datadog\n(OTLP endpoint)"]
    end

    Client -->|"HTTPS"| APIGW
    APIGW -->|"invoca"| AuthLambda
    AuthLambda -->|"JWT"| APIGW
    APIGW -->|"HTTP + Bearer JWT"| INGRESS_STAG
    APIGW -->|"HTTP + Bearer JWT"| INGRESS_PROD
    APP_STAG -->|"SQL :5432"| RDS
    APP_PROD -->|"SQL :5432"| RDS
    APP_STAG -->|"OTLP (condicional)"| Datadog
    APP_PROD -->|"OTLP (condicional)"| Datadog
    ECR -->|"image pull"| APP_STAG
    ECR -->|"image pull"| APP_PROD
```

> **Nota:** A Lambda `auth-cpf`, o API Gateway, o cluster EKS, o RDS e o agente Datadog são provisionados e gerenciados fora deste repositório (`workshop-edge` e infraestrutura compartilhada). O `workshop-app` consome esses recursos mas não os provisiona.

---

## 2. Componentes Internos do workshop-app

O diagrama abaixo detalha as camadas internas da aplicação, seguindo a arquitetura limpa (Clean Architecture) com dependências fluindo apenas em direção ao domínio.

```mermaid
flowchart LR
    subgraph Presentation["Camada: Presentation (Hono)"]
        Routes["Rotas HTTP\n/health, /ready\n/stock-items, /services\n/service-tasks, /vehicles\n/person, /work-orders\n/webhooks, /docs"]
        AuthMW["Middleware de Auth\nadminAuthMiddleware\nmechanicAuthMiddleware"]
        LogMW["requestLoggingMiddleware"]
    end

    subgraph Application["Camada: Application (Use Cases)"]
        WO["WorkOrder Use Cases\nCreateWorkOrder\nStartDiagnosis\nCompleteDiagnosis\nStartExecution\nFinalizeWorkOrder\nDeliverVehicle\nCancelWorkOrder"]
        ST["ServiceTask Use Cases\nAddServiceTask\nApproveServiceTask\nRejectServiceTask\nStartServiceExecution\nCompleteServiceTask\nCancelServiceTask"]
        Stock["Stock Use Cases\nDecreaseStock\nIncreaseStock"]
        Other["Outros Use Cases\nPerson, Vehicle\nService, Webhook"]
    end

    subgraph Domain["Camada: Domain"]
        Aggregates["Agregados\nWorkOrder\nServiceTask\nStockItem\nPerson\nVehicle\nService"]
        VO["Value Objects\nMoney (DECIMAL 15,2)\nCPF\nPlaca"]
        Events["Eventos de Domínio\nWorkOrderCreated\nDiagnosisCompleted\nServiceTaskApproved\nServiceTaskRejected\nWorkOrderFinalized\nWorkOrderCanceled"]
        DomainErrors["Erros de Domínio"]
        RepoInterfaces["Interfaces de Repositório"]
    end

    subgraph Infrastructure["Camada: Infrastructure"]
        DrizzleRepos["Repositórios Drizzle\n(PostgreSQL)"]
        JWTAdapter["Adaptador JWT\n(validação HS256)"]
        Notifier["Adaptador de Notificação\n(Beeceptor / no-op)"]
        OTel["OpenTelemetry\n(OTLP → Datadog)\ncondicional"]
        Logger["Logger JSON\n(x-request-id\ntrace-id, span-id)"]
        DBConn["Conexão PostgreSQL\n(Drizzle ORM)"]
        Migrations["Migrations SQL\n(Job Kubernetes)"]
    end

    Routes --> AuthMW
    Routes --> WO
    Routes --> ST
    Routes --> Stock
    Routes --> Other
    AuthMW --> JWTAdapter
    WO --> Aggregates
    WO --> Events
    ST --> Aggregates
    Stock --> Aggregates
    Other --> Aggregates
    WO --> RepoInterfaces
    ST --> RepoInterfaces
    Stock --> RepoInterfaces
    Other --> RepoInterfaces
    DrizzleRepos --> RepoInterfaces
    DrizzleRepos --> DBConn
    JWTAdapter --> Domain
    Notifier --> Events
    OTel --> LogMW
```

---

## 3. Legenda dos Componentes

| Componente | Camada | Responsabilidade |
|---|---|---|
| Hono Routes | Presentation | Roteamento HTTP, validação de entrada, mapeamento de erros para status HTTP |
| adminAuthMiddleware | Presentation | Valida JWT para rotas administrativas (roles: admin, front desk) |
| mechanicAuthMiddleware | Presentation | Valida JWT para rotas de mecânico |
| requestLoggingMiddleware | Presentation | Emite log JSON por request com request-id, trace-id, método, rota, status, duração |
| Use Cases | Application | Orquestra operações de domínio e persistência; não contém regras de negócio |
| Agregados | Domain | WorkOrder, ServiceTask, StockItem — fonte única de verdade para invariantes |
| Value Objects | Domain | Money (DECIMAL 15,2 BRL), CPF, placa veicular — tipos sem identidade própria |
| Eventos de Domínio | Domain | Sinalizam transições de estado; disparam notificações assíncronas |
| Interfaces de Repositório | Domain | Contratos de persistência; domínio não depende de infraestrutura |
| Drizzle Repos | Infrastructure | Implementações PostgreSQL dos repositórios de domínio via Drizzle ORM |
| JWT Adapter | Infrastructure | Valida HS256, `iss=workshop-edge`, `aud=workshop-app`, claims obrigatórios |
| Notifier | Infrastructure | Envia notificações via Beeceptor ou no-op; não altera estado de domínio |
| OpenTelemetry | Infrastructure | Exporta traces via OTLP apenas quando `OTEL_EXPORTER_OTLP_ENDPOINT` está configurado |
| Logger JSON | Infrastructure | Logs estruturados com correlação por `x-request-id` |
| API Gateway (AWS) | Externo | Ponto de entrada público; integra Lambda auth-cpf; roteia para workshop-app |
| Lambda auth-cpf | Externo | Autentica via CPF e emite JWT; mantido por `workshop-edge` |
| Amazon RDS | Externo | Instância PostgreSQL gerenciada; provisionada fora deste repositório |
| Datadog | Externo | Recebe telemetria OTLP; agente provisionado fora deste repositório |
| Amazon ECR | Externo | Registry de imagens Docker; pipeline de CI/CD publica a imagem após cada deploy |
| HPA | Kubernetes | Escala o Deployment horizontalmente com base em CPU (70%) e memória (75%) |
| Ingress | Kubernetes | Roteamento HTTP interno ao cluster para o serviço workshop-app |
