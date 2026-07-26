# Phase 4 Kubernetes demonstrable evidence

Date: 2026-07-19  
Scope: final operational checklist item 3 — render/apply Kubernetes manifests, capture `kubectl get pods/services`, health/ready, smoke, or document the blocker honestly.  
Cluster: local `kind` cluster named `workshop-f4-k8s` on Docker. No paid or external Kubernetes service was used.

## Status

**Checklist item 3 status: Complete with documented caveat.**

What was proven live:

- `kubectl` and `kind` were installed locally for evidence collection.
- Platform Kustomize base rendered successfully.
- OS/app `k8s/overlays/stag` rendered successfully.
- A local `kind` cluster was created and reached `Ready`.
- Platform manifests were applied to the cluster.
- RabbitMQ StatefulSet became `1/1 Running`; RabbitMQ diagnostics returned `Ping succeeded`.
- Platform Services for RabbitMQ, Order, Billing, and Execution were created.
- OS/app image was built from `workshop-app/Dockerfile`, loaded into `kind`, applied from `k8s/overlays/stag`, and rolled out `1/1`.
- A local PostgreSQL helper Deployment/Service was applied only to satisfy the OS readiness dependency in the disposable cluster; generated secret values were not printed and are treated as `[REDACTED]`.
- OS `/health` and `/ready` returned HTTP 200 JSON responses from inside the cluster.

Honest caveat/blocker:

- The shared platform Deployment manifests for `order-service`, `billing-service`, and `execution-service` intentionally use placeholder images under `example.invalid/...:replace-me`. Kubernetes accepted/applied those Deployments and Services, but the three placeholder pods cannot run and show `ImagePullBackOff` until real service images are published/overridden by delivery workflows.
- Therefore this evidence proves render/apply and live Kubernetes operation for RabbitMQ plus the OS/app overlay, but it is **not** a full three-service Kubernetes E2E smoke for OS + Billing + Execution.
- `workshop-app` HPA was created, but local `kind` has no metrics-server, so HPA metric targets show `<unknown>`; this does not block Deployment readiness.
- OpenTelemetry export attempted to reach a Datadog/OTLP endpoint derived from `DD_AGENT_HOST` and logged `ConnectionRefused` because no collector/agent was installed in the local evidence cluster; this did not block health/readiness.

## Tool availability

Command:

```bash
for t in kubectl kustomize kind minikube docker; do
  printf '%s: ' "$t"
  command -v "$t" || true
  if command -v "$t" >/dev/null 2>&1; then
    "$t" version --client 2>/dev/null || "$t" --version 2>/dev/null || true
  fi
done
```

Initial result:

```text
kubectl:
kustomize:
kind:
minikube:
docker: /usr/bin/docker
Docker version 29.6.2, build dfc4efb
```

Lightweight local tools installed for the evidence run:

```text
Client Version: v1.30.8
Kustomize Version: v5.0.4-0.20230601165947-6ce0bf390ce3
kind v0.24.0 go1.22.6 linux/amd64
```

Docker state before the Kubernetes run showed existing local containers only; no unrelated containers were destroyed:

```text
NAMES                        IMAGE                      STATUS                  PORTS
workshop-f4-rabbitmq-smoke   rabbitmq:3.13-management   Up ...                  0.0.0.0:5672->5672/tcp, 0.0.0.0:15672->15672/tcp
workshop_postgres            postgres:16-alpine         Up ... (healthy)        0.0.0.0:5432->5432/tcp
```

## Render and validation

Platform render:

```bash
cd /root/repos/tech-challenges-fiap/workshop-platform
kubectl kustomize kubernetes/base >/tmp/workshop-platform-base.yaml
wc -l /tmp/workshop-platform-base.yaml
```

Result:

```text
479 /tmp/workshop-platform-base.yaml
```

OS/app render:

```bash
cd /root/repos/tech-challenges-fiap/workshop-app
kubectl kustomize k8s/overlays/stag >/tmp/workshop-app-stag.yaml
wc -l /tmp/workshop-app-stag.yaml
```

Result:

```text
153 /tmp/workshop-app-stag.yaml
```

Server-side dry-run and repository validation after the cluster existed:

```bash
cd /root/repos/tech-challenges-fiap/workshop-platform
./scripts/validate-k8s-manifests.sh
kubectl apply --dry-run=server -f /tmp/workshop-platform-base.yaml >/tmp/platform-dryrun.out && echo server-dry-run-ok
kubectl apply --dry-run=server -f /tmp/workshop-app-stag.yaml >/tmp/app-dryrun.out && echo app-server-dry-run-ok
```

Result:

```text
Validated Kubernetes manifests: 17
server-dry-run-ok
app-server-dry-run-ok
```

## Local cluster creation

Command:

```bash
kind create cluster --name workshop-f4-k8s --config /tmp/workshop-f4-kind-config.yaml --wait 120s
kubectl cluster-info --context kind-workshop-f4-k8s
kubectl get nodes -o wide
```

Result excerpt:

```text
Creating cluster "workshop-f4-k8s" ...
✓ Waiting ≤ 2m0s for control-plane = Ready
Kubernetes control plane is running at https://127.0.0.1:37033
NAME                            STATUS   ROLES           VERSION   INTERNAL-IP   OS-IMAGE
workshop-f4-k8s-control-plane   Ready    control-plane   v1.31.0   172.19.0.2    Debian GNU/Linux 12 (bookworm)
```

## Live apply evidence

Platform apply:

```bash
kubectl apply -f /tmp/workshop-platform-base.yaml
```

Result excerpt:

```text
namespace/prod created
namespace/rabbitmq created
namespace/stag created
configmap/rabbitmq-config created
secret/rabbitmq-credentials created
service/rabbitmq created
service/rabbitmq-headless created
service/billing-service created
service/execution-service created
service/order-service created
deployment.apps/billing-service created
deployment.apps/execution-service created
deployment.apps/order-service created
statefulset.apps/rabbitmq created
```

RabbitMQ readiness:

```bash
kubectl wait --for=condition=ready pod/rabbitmq-0 -n rabbitmq --timeout=240s
kubectl exec -n rabbitmq rabbitmq-0 -- rabbitmq-diagnostics -q ping
```

Result:

```text
pod/rabbitmq-0 condition met
Ping succeeded
```

OS image build/load and app overlay apply:

```bash
cd /root/repos/tech-challenges-fiap/workshop-app
docker build --tag workshop-app:latest .
kind load docker-image workshop-app:latest --name workshop-f4-k8s
```

Result excerpt:

```text
#19 naming to docker.io/library/workshop-app:latest done
Image: "workshop-app:latest" ... loading...
```

Disposable readiness dependency for local evidence:

```bash
# Secret values were generated at runtime and are redacted from evidence.
kubectl create secret generic workshop-app-secret -n stag ... | kubectl apply -f -
kubectl apply -f docs/fase-4/kubernetes-kind-postgres-helper.yaml
kubectl wait --for=condition=available deployment/postgres -n stag --timeout=180s
kubectl apply -f /tmp/workshop-app-stag.yaml
kubectl rollout status deployment/workshop-app -n stag --timeout=180s
```

Result:

```text
secret/workshop-app-secret configured with generated values [REDACTED]
service/postgres created
deployment.apps/postgres created
deployment.apps/postgres condition met
configmap/workshop-app-config created
service/workshop-app created
deployment.apps/workshop-app created
horizontalpodautoscaler.autoscaling/workshop-app created
ingress.networking.k8s.io/workshop-app created
deployment "workshop-app" successfully rolled out
```

## `kubectl get pods/services/deployments` evidence

Command:

```bash
kubectl get pods,svc,deploy,statefulset -A -o wide
```

Result excerpt:

```text
NAMESPACE   NAME                                     READY   STATUS             RESTARTS   IP
rabbitmq    pod/rabbitmq-0                           1/1     Running            0          10.244.0.9
stag        pod/billing-service-746f7cd5c-d6c55      0/1     ImagePullBackOff   0          10.244.0.5
stag        pod/execution-service-756969d547-nkvwg   0/1     ImagePullBackOff   0          10.244.0.6
stag        pod/order-service-768c7dbbf-qvr25        0/1     ImagePullBackOff   0          10.244.0.7
stag        pod/postgres-fbf57fb5b-vcxcr             1/1     Running            0          10.244.0.10
stag        pod/workshop-app-54fc58d69d-z42vf        1/1     Running            0          10.244.0.11

NAMESPACE   NAME                        TYPE        CLUSTER-IP      PORT(S)
rabbitmq    service/rabbitmq            ClusterIP   10.96.68.163    5672/TCP,15672/TCP
rabbitmq    service/rabbitmq-headless   ClusterIP   None            5672/TCP
stag        service/billing-service     ClusterIP   10.96.164.216   80/TCP
stag        service/execution-service   ClusterIP   10.96.25.39     80/TCP
stag        service/order-service       ClusterIP   10.96.54.22     80/TCP
stag        service/postgres            ClusterIP   10.96.251.124   5432/TCP
stag        service/workshop-app        ClusterIP   10.96.218.170   3000/TCP

NAMESPACE   NAME                                READY   UP-TO-DATE   AVAILABLE   CONTAINERS          IMAGES
stag        deployment.apps/billing-service     0/1     1            0           billing-service     example.invalid/workshop/billing-service:replace-me
stag        deployment.apps/execution-service   0/1     1            0           execution-service   example.invalid/workshop/execution-service:replace-me
stag        deployment.apps/order-service       0/1     1            0           order-service       example.invalid/workshop/order-service:replace-me
stag        deployment.apps/postgres            1/1     1            1           postgres            postgres:16-alpine
stag        deployment.apps/workshop-app        1/1     1            1           api                 workshop-app:latest
rabbitmq    statefulset.apps/rabbitmq           1/1                  1           rabbitmq            rabbitmq:3.13-management
```

Failure events for placeholder service images:

```text
Failed to pull image "example.invalid/workshop/order-service:replace-me": ... lookup example.invalid ... no such host
Failed to pull image "example.invalid/workshop/billing-service:replace-me": ... lookup example.invalid ... no such host
Failed to pull image "example.invalid/workshop/execution-service:replace-me": ... lookup example.invalid ... no such host
Error: ImagePullBackOff
```

## Health/ready smoke inside Kubernetes

Commands:

```bash
kubectl run workshop-f4-curl-health --rm -i --restart=Never --image=curlimages/curl:8.11.1 -n stag -- curl -fsS http://workshop-app:3000/health
kubectl run workshop-f4-curl-ready --rm -i --restart=Never --image=curlimages/curl:8.11.1 -n stag -- curl -fsS http://workshop-app:3000/ready
```

Results:

```text
{"status":"ok"}
{"status":"ready"}
```

App log excerpt:

```text
[database] Connection to PostgreSQL established successfully (attempt 1).
{"service":"workshop-app","level":"info","message":"Starting HTTP server","port":3000}
{"service":"workshop-app","env":"stag","level":"info","message":"HTTP request completed","route":"/health","status_code":200}
{"service":"workshop-app","env":"stag","level":"info","message":"HTTP request completed","route":"/ready","status_code":200}
```

RabbitMQ log excerpt:

```text
Management plugin: HTTP (non-TLS) listener started on port 15672
started TCP listener on [::]:5672
Server startup complete; 5 plugins started.
```

## Evidence files and artifacts

- Rendered platform manifest during run: `/tmp/workshop-platform-base.yaml`
- Rendered app manifest during run: `/tmp/workshop-app-stag.yaml`
- Helper manifest committed for repeatable local OS readiness dependency: `docs/fase-4/kubernetes-kind-postgres-helper.yaml`
- This evidence file: `docs/fase-4/kubernetes-evidence.md`

## Final checklist decision

Final checklist item 3 (`Validar Kubernetes demonstrável`) can be marked complete **for evidence collection** because render, server dry-run, live apply, `kubectl get pods/services`, RabbitMQ health, OS health/ready, and exact blockers were captured.

Do **not** claim a full Kubernetes E2E for OS + Billing + Execution until the placeholder images in `workshop-platform/kubernetes/base/services/*/deployment.yaml` are replaced by real locally loaded or registry-published service images and the three service pods reach Ready.
