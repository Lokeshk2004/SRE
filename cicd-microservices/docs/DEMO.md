# 🎯 Project Demonstration Guide

A step-by-step guide to **execute, verify, and demonstrate** the entire CI/CD pipeline — from zero to a fully running microservices platform on Kubernetes.

> **Estimated Time**: 30–45 minutes for full demonstration

---

## Table of Contents

1. [Phase 1 — Environment Setup (Prerequisites)](#phase-1--environment-setup-prerequisites)
2. [Phase 2 — Start Minikube Cluster](#phase-2--start-minikube-cluster)
3. [Phase 3 — Build Docker Images Locally](#phase-3--build-docker-images-locally)
4. [Phase 4 — Deploy Everything to Kubernetes](#phase-4--deploy-everything-to-kubernetes)
5. [Phase 5 — Verify All Services Are Running](#phase-5--verify-all-services-are-running)
6. [Phase 6 — Test APIs via Ingress](#phase-6--test-apis-via-ingress)
7. [Phase 7 — Access the Frontend Dashboard](#phase-7--access-the-frontend-dashboard)
8. [Phase 8 — Verify Monitoring (Prometheus & Grafana)](#phase-8--verify-monitoring-prometheus--grafana)
9. [Phase 9 — Verify Logging (ELK Stack)](#phase-9--verify-logging-elk-stack)
10. [Phase 10 — Demonstrate the Jenkins CI/CD Pipeline](#phase-10--demonstrate-the-jenkins-cicd-pipeline)
11. [Phase 11 — Demonstrate a Full CI/CD Cycle (Code Change → Deployment)](#phase-11--demonstrate-a-full-cicd-cycle-code-change--deployment)
12. [Phase 12 — Demonstrate Self-Healing & Resilience](#phase-12--demonstrate-self-healing--resilience)
13. [Phase 13 — Cleanup](#phase-13--cleanup)
14. [Quick Demo Script (5-Minute Version)](#quick-demo-script-5-minute-version)
15. [Common Issues & Fixes](#common-issues--fixes)

---

## Phase 1 — Environment Setup (Prerequisites)

### 1.1 Verify all tools are installed

```bash
# Check each tool — all commands should return a version number
docker --version          # Docker 20.10+
minikube version          # Minikube 1.32+
kubectl version --client  # kubectl 1.28+
node --version            # Node.js 18+
git --version             # Git 2.30+
```

**Expected Output (example):**
```
Docker version 24.0.7, build afdd53b
minikube version: v1.32.0
Client Version: v1.28.4
v18.19.0
git version 2.43.0
```

> **If any tool is missing**, install it before proceeding. See [SETUP.md](./SETUP.md) for installation instructions.

### 1.2 Verify Docker is running

```bash
docker info | head -5
# Should show "Server: Docker Engine" — not an error
```

---

## Phase 2 — Start Minikube Cluster

### 2.1 Start the cluster

```bash
minikube start --driver=docker --cpus=4 --memory=6144
```

**Expected Output:**
```
😄  minikube v1.32.0 on Ubuntu 22.04
✨  Using the docker driver
📌  Using Docker driver with root privileges
🧯  Creating docker container (CPUs=4, Memory=6144MB)
🐳  Preparing Kubernetes v1.28.3 on Docker
🔎  Verifying Kubernetes components...
🌟  Enabled addons: storage-provisioner, default-storageclass
🏄  Done! kubectl is now configured to use "minikube" cluster
```

### 2.2 Enable the Ingress addon

```bash
minikube addons enable ingress
```

**Expected Output:**
```
💡  ingress is an addon maintained by Kubernetes. For any concerns contact minikube on GitHub.
🔎  Verifying ingress addon...
🌟  The 'ingress' addon is enabled
```

### 2.3 Verify the cluster is healthy

```bash
kubectl cluster-info
kubectl get nodes
```

**Expected Output:**
```
Kubernetes control plane is running at https://192.168.49.2:8443
CoreDNS is running at https://192.168.49.2:8443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy

NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   1m    v1.28.3
```

> ✅ **Checkpoint**: Cluster is running and ready. Node status must be `Ready`.

### 2.4 Get the Minikube IP (save this — you'll use it throughout)

```bash
export MINIKUBE_IP=$(minikube ip)
echo "Minikube IP: $MINIKUBE_IP"
```

---

## Phase 3 — Build Docker Images Locally

We'll build images **directly inside Minikube's Docker daemon** so we don't need to push to Docker Hub for the demo.

### 3.1 Connect to Minikube's Docker

```bash
eval $(minikube docker-env)

# Verify — should show Minikube's Docker, not your host's
docker info | grep "Name:"
# Output: Name: minikube
```

### 3.2 Build all 4 images

```bash
# Navigate to the project root
cd cicd-microservices

# Build User Service
echo "========== Building User Service =========="
docker build -t myprojectuser/user-service:latest ./user-service/
echo "✅ User Service built"

# Build Order Service
echo "========== Building Order Service =========="
docker build -t myprojectuser/order-service:latest ./order-service/
echo "✅ Order Service built"

# Build Payment Service
echo "========== Building Payment Service =========="
docker build -t myprojectuser/payment-service:latest ./payment-service/
echo "✅ Payment Service built"

# Build Frontend
echo "========== Building Frontend =========="
docker build -t myprojectuser/frontend:latest ./frontend/
echo "✅ Frontend built"
```

### 3.3 Verify all images exist

```bash
docker images | grep myprojectuser
```

**Expected Output:**
```
myprojectuser/user-service      latest   abc123def456   10 seconds ago   125MB
myprojectuser/order-service     latest   bcd234efg567   20 seconds ago   125MB
myprojectuser/payment-service   latest   cde345fgh678   30 seconds ago   125MB
myprojectuser/frontend          latest   def456ghi789   40 seconds ago   45MB
```

> ✅ **Checkpoint**: All 4 images built successfully. Frontend image should be smaller (~45MB) because it's just Nginx + static files.

---

## Phase 4 — Deploy Everything to Kubernetes

### 4.1 Create namespaces

```bash
kubectl apply -f namespaces.yaml
```

**Expected Output:**
```
namespace/microservices created
namespace/monitoring created
namespace/logging created
```

**Verify:**
```bash
kubectl get namespaces | grep -E "microservices|monitoring|logging"
```

**Expected Output:**
```
logging          Active   5s
microservices    Active   5s
monitoring       Active   5s
```

### 4.2 Deploy microservices (update imagePullPolicy first)

Since we built images locally inside Minikube, we need to tell Kubernetes **not** to pull from Docker Hub:

```bash
# Patch all deployments to use imagePullPolicy: Never
# This tells K8s to use local images instead of pulling from Docker Hub

# User Service
kubectl apply -f user-service/k8s/deployment.yaml
kubectl patch deployment user-service -n microservices \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"user-service","imagePullPolicy":"Never"}]}}}}'
kubectl apply -f user-service/k8s/service.yaml

# Order Service
kubectl apply -f order-service/k8s/deployment.yaml
kubectl patch deployment order-service -n microservices \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"order-service","imagePullPolicy":"Never"}]}}}}'
kubectl apply -f order-service/k8s/service.yaml

# Payment Service
kubectl apply -f payment-service/k8s/deployment.yaml
kubectl patch deployment payment-service -n microservices \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"payment-service","imagePullPolicy":"Never"}]}}}}'
kubectl apply -f payment-service/k8s/service.yaml

# Frontend
kubectl apply -f frontend/k8s/deployment.yaml
kubectl patch deployment frontend -n microservices \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"frontend","imagePullPolicy":"Never"}]}}}}'
kubectl apply -f frontend/k8s/service.yaml

echo "✅ All microservices deployed"
```

### 4.3 Apply the Ingress

```bash
kubectl apply -f ingress.yaml
```

### 4.4 Wait for all pods to be ready

```bash
echo "Waiting for all pods to be ready..."
kubectl wait --for=condition=ready pod -l app=user-service -n microservices --timeout=120s
kubectl wait --for=condition=ready pod -l app=order-service -n microservices --timeout=120s
kubectl wait --for=condition=ready pod -l app=payment-service -n microservices --timeout=120s
kubectl wait --for=condition=ready pod -l app=frontend -n microservices --timeout=120s
echo "✅ All application pods are ready!"
```

### 4.5 Deploy monitoring stack

```bash
kubectl apply -f monitoring/prometheus/
kubectl apply -f monitoring/grafana/
echo "✅ Monitoring stack deployed"
```

### 4.6 Deploy logging stack

```bash
# Elasticsearch first (others depend on it)
kubectl apply -f logging/elasticsearch/
echo "Waiting for Elasticsearch to start (this takes ~60 seconds)..."
kubectl wait --for=condition=ready pod -l app=elasticsearch -n logging --timeout=180s

# Then the rest
kubectl apply -f logging/logstash/
kubectl apply -f logging/kibana/
kubectl apply -f logging/filebeat/
echo "✅ Logging stack deployed"
```

> ✅ **Checkpoint**: All resources are deployed. Move to verification.

---

## Phase 5 — Verify All Services Are Running

### 5.1 Check ALL pods across ALL namespaces

```bash
echo "==================== MICROSERVICES ===================="
kubectl get pods -n microservices -o wide

echo ""
echo "==================== MONITORING ===================="
kubectl get pods -n monitoring -o wide

echo ""
echo "==================== LOGGING ===================="
kubectl get pods -n logging -o wide
```

**Expected Output** — Every pod should show `Running` and `READY 1/1` or `2/2`:
```
==================== MICROSERVICES ====================
NAME                               READY   STATUS    RESTARTS   AGE
frontend-xxxxxxxxx-xxxxx           1/1     Running   0          2m
frontend-xxxxxxxxx-yyyyy           1/1     Running   0          2m
order-service-xxxxxxxxx-xxxxx      1/1     Running   0          2m
order-service-xxxxxxxxx-yyyyy      1/1     Running   0          2m
payment-service-xxxxxxxxx-xxxxx    1/1     Running   0          2m
payment-service-xxxxxxxxx-yyyyy    1/1     Running   0          2m
user-service-xxxxxxxxx-xxxxx       1/1     Running   0          2m
user-service-xxxxxxxxx-yyyyy       1/1     Running   0          2m

==================== MONITORING ====================
NAME                          READY   STATUS    RESTARTS   AGE
grafana-xxxxxxxxx-xxxxx       1/1     Running   0          1m
prometheus-xxxxxxxxx-xxxxx    1/1     Running   0          1m

==================== LOGGING ====================
NAME                             READY   STATUS    RESTARTS   AGE
elasticsearch-xxxxxxxxx-xxxxx    1/1     Running   0          1m
filebeat-xxxxxxxxx-xxxxx         1/1     Running   0          30s
kibana-xxxxxxxxx-xxxxx           1/1     Running   0          30s
logstash-xxxxxxxxx-xxxxx         1/1     Running   0          30s
```

> 🔴 **If any pod shows `ImagePullBackOff`**: You forgot `eval $(minikube docker-env)` before building, or forgot the `imagePullPolicy: Never` patch.

### 5.2 Check all services

```bash
kubectl get svc -n microservices
kubectl get svc -n monitoring
kubectl get svc -n logging
```

### 5.3 Check the Ingress

```bash
kubectl get ingress -n microservices
kubectl describe ingress microservices-ingress -n microservices
```

**Expected Output:**
```
NAME                     CLASS   HOSTS   ADDRESS          PORTS   AGE
microservices-ingress    nginx   *       <MINIKUBE_IP>    80      2m
```

### 5.4 Overall health check (one command)

```bash
echo "=== Pod Summary ==="
echo "Microservices: $(kubectl get pods -n microservices --no-headers | grep Running | wc -l) running"
echo "Monitoring:    $(kubectl get pods -n monitoring --no-headers | grep Running | wc -l) running"
echo "Logging:       $(kubectl get pods -n logging --no-headers | grep Running | wc -l) running"
echo ""
echo "Total Pods Running: $(kubectl get pods -A --no-headers | grep Running | wc -l)"
```

**Expected Output:**
```
=== Pod Summary ===
Microservices: 8 running
Monitoring:    2 running
Logging:       4 running

Total Pods Running: 14
```

> ✅ **Checkpoint**: 14 pods running across 3 namespaces.

---

## Phase 6 — Test APIs via Ingress

### 6.1 Test health endpoints (prove services are alive)

```bash
MINIKUBE_IP=$(minikube ip)

echo "=== Health Checks ==="
echo "User Service:"
curl -s http://$MINIKUBE_IP/api/users/health | python3 -m json.tool

echo ""
echo "Order Service:"
curl -s http://$MINIKUBE_IP/api/orders/health | python3 -m json.tool

echo ""
echo "Payment Service:"
curl -s http://$MINIKUBE_IP/api/payments/health | python3 -m json.tool
```

**Expected Output:**
```json
{
    "status": "healthy",
    "service": "user-service",
    "timestamp": "2025-04-12T17:30:00.000Z",
    "uptime": 120.456
}
```

> ✅ All three services must return `"status": "healthy"`.

### 6.2 Test GET endpoints (prove data is returned)

```bash
echo "=== Users ==="
curl -s http://$MINIKUBE_IP/api/users | python3 -m json.tool

echo ""
echo "=== Orders ==="
curl -s http://$MINIKUBE_IP/api/orders | python3 -m json.tool

echo ""
echo "=== Payments ==="
curl -s http://$MINIKUBE_IP/api/payments | python3 -m json.tool
```

**Expected Output (Users example):**
```json
{
    "success": true,
    "count": 5,
    "data": [
        {
            "id": 1,
            "name": "Alice Johnson",
            "email": "alice@example.com",
            "role": "admin",
            "createdAt": "2025-01-15T10:30:00Z"
        },
        ...
    ]
}
```

### 6.3 Test POST endpoint (prove write operations work)

```bash
# Create a new user
echo "=== Creating a new user ==="
curl -s -X POST http://$MINIKUBE_IP/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo User","email":"demo@example.com","role":"customer"}' | python3 -m json.tool
```

**Expected Output:**
```json
{
    "success": true,
    "data": {
        "id": 6,
        "name": "Demo User",
        "email": "demo@example.com",
        "role": "customer",
        "createdAt": "2025-04-12T17:35:00.000Z"
    }
}
```

```bash
# Create a new order
echo "=== Creating a new order ==="
curl -s -X POST http://$MINIKUBE_IP/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":6,"product":"Demo Product","quantity":2,"price":99.99}' | python3 -m json.tool
```

```bash
# Create a new payment
echo "=== Creating a new payment ==="
curl -s -X POST http://$MINIKUBE_IP/api/payments \
  -H "Content-Type: application/json" \
  -d '{"orderId":7,"userId":6,"amount":199.98,"method":"credit_card"}' | python3 -m json.tool
```

### 6.4 Test GET by ID (prove routing and path params work)

```bash
curl -s http://$MINIKUBE_IP/api/users/1 | python3 -m json.tool
curl -s http://$MINIKUBE_IP/api/orders/1 | python3 -m json.tool
curl -s http://$MINIKUBE_IP/api/payments/1 | python3 -m json.tool
```

### 6.5 Test metrics endpoint (prove Prometheus can scrape)

```bash
echo "=== User Service Metrics ==="
curl -s http://$MINIKUBE_IP/api/users/metrics

echo ""
echo "=== Order Service Metrics ==="
curl -s http://$MINIKUBE_IP/api/orders/metrics
```

**Expected Output (Prometheus format):**
```
# HELP user_service_requests_total Total number of requests
# TYPE user_service_requests_total counter
user_service_requests_total 15
# HELP user_service_users_total Total number of users in memory
# TYPE user_service_users_total gauge
user_service_users_total 6
# HELP user_service_uptime_seconds Service uptime in seconds
# TYPE user_service_uptime_seconds gauge
user_service_uptime_seconds 180
```

> ✅ **Checkpoint**: All APIs working — GET, POST, health, metrics all return valid responses through Ingress.

---

## Phase 7 — Access the Frontend Dashboard

### 7.1 Open the dashboard in your browser

```bash
echo "Open in your browser: http://$MINIKUBE_IP"
```

Or use:
```bash
# This opens the browser automatically (Linux/Mac)
xdg-open http://$(minikube ip) 2>/dev/null || open http://$(minikube ip) 2>/dev/null

# Windows (PowerShell)
Start-Process "http://$(minikube ip)"
```

### 7.2 What you should see on the dashboard

**Dashboard Page (default):**
- ✅ **Stats cards** at the top showing: Total Users (5+), Total Orders (6+), Total Payments (5+), Revenue ($1,889.94+)
- ✅ **Service Health** panel showing all 3 services as green/healthy with latency
- ✅ **Recent Orders** panel listing the most recent orders with status badges

**Users Page (click sidebar):**
- ✅ Table with 5+ user records (Name, Email, Role, Created Date)

**Orders Page (click sidebar):**
- ✅ Table with 6+ orders showing Product, Qty, Price, Status badges (delivered/shipped/processing/pending)

**Payments Page (click sidebar):**
- ✅ Table with 5+ payments showing Amount, Method, Status, Transaction IDs

**Health Page (click sidebar):**
- ✅ 3 health cards — one per service — each showing: Status, Service Name, Uptime, Latency, Timestamp

### 7.3 Verify auto-refresh

- Wait 30 seconds on the dashboard
- The **"Last updated"** timestamp in the top-right should change automatically
- The data refreshes without page reload

> ✅ **Checkpoint**: Frontend dashboard is live, fetching data from all 3 backend services via the Ingress.

---

## Phase 8 — Verify Monitoring (Prometheus & Grafana)

### 8.1 Port-forward Prometheus

```bash
kubectl port-forward svc/prometheus-service -n monitoring 9090:9090 &
echo "Prometheus available at: http://localhost:9090"
```

### 8.2 Verify Prometheus is scraping targets

Open **http://localhost:9090** in your browser, then:

1. Go to **Status → Targets**
2. You should see **4 targets** — all with state `UP`:
   - `prometheus` (self)
   - `user-service`
   - `order-service`
   - `payment-service`

**Or verify via CLI:**
```bash
# Check Prometheus targets via API
curl -s http://localhost:9090/api/v1/targets | python3 -m json.tool | grep -E '"job"|"health"'
```

**Expected Output:**
```
"job": "prometheus",
"health": "up",
"job": "user-service",
"health": "up",
"job": "order-service",
"health": "up",
"job": "payment-service",
"health": "up",
```

### 8.3 Run a Prometheus query

In the Prometheus UI, go to **Graph** and enter these queries:

```promql
# Total requests per service
user_service_requests_total
order_service_requests_total
payment_service_requests_total

# Total records in memory
user_service_users_total
order_service_orders_total
payment_service_payments_total

# Service uptime
user_service_uptime_seconds
```

Each query should return results with values matching your API interactions.

### 8.4 Port-forward Grafana

```bash
kubectl port-forward svc/grafana-service -n monitoring 3000:3000 &
echo "Grafana available at: http://localhost:3000"
```

### 8.5 Login to Grafana

1. Open **http://localhost:3000**
2. Login with: **admin / admin123**
3. Skip the password change prompt (or change it)

### 8.6 Add Prometheus as a data source

1. Go to **⚙️ Configuration → Data Sources → Add data source**
2. Select **Prometheus**
3. URL: `http://prometheus-service.monitoring.svc.cluster.local:9090`
4. Click **Save & Test**
5. You should see: **"Data source is working"** ✅

### 8.7 Create a quick dashboard panel (optional demo)

1. Go to **+ → New Dashboard → Add visualization**
2. Select the Prometheus data source
3. Query: `user_service_uptime_seconds`
4. Click **Run queries** — the graph should show the uptime increasing
5. Click **Apply**

> ✅ **Checkpoint**: Prometheus is scraping all services. Grafana is connected and can visualize metrics.

---

## Phase 9 — Verify Logging (ELK Stack)

### 9.1 Verify Elasticsearch is healthy

```bash
# Port-forward Elasticsearch
kubectl port-forward svc/elasticsearch-service -n logging 9200:9200 &

# Check cluster health
curl -s http://localhost:9200/_cluster/health | python3 -m json.tool
```

**Expected Output:**
```json
{
    "cluster_name": "microservices-logs",
    "status": "green",
    "number_of_nodes": 1,
    "number_of_data_nodes": 1,
    "active_primary_shards": 0,
    "active_shards": 0
}
```

> Status should be `green` or `yellow` (yellow is normal for single-node).

### 9.2 Check if log indices exist

```bash
curl -s http://localhost:9200/_cat/indices?v
```

**Expected Output (after Filebeat sends logs):**
```
health status index                           docs.count
yellow open   microservices-logs-2025.04.12   152
```

### 9.3 Search logs in Elasticsearch

```bash
# Search for user-service logs
curl -s "http://localhost:9200/microservices-logs-*/_search?q=user-service&size=3" | python3 -m json.tool
```

### 9.4 Port-forward Kibana

```bash
kubectl port-forward svc/kibana-service -n logging 5601:5601 &
echo "Kibana available at: http://localhost:5601"
```

### 9.5 Setup Kibana index pattern

1. Open **http://localhost:5601**
2. Go to **☰ Menu → Stack Management → Index Patterns**
3. Click **Create index pattern**
4. Pattern: `microservices-logs-*`
5. Time field: `@timestamp`
6. Click **Create index pattern**

### 9.6 View logs in Kibana Discover

1. Go to **☰ Menu → Discover**
2. Select the `microservices-logs-*` index pattern
3. Set the time range to **Last 1 hour**
4. You should see log entries from all microservices

**Generate some logs to verify:**
```bash
# Hit the APIs a few times to generate log entries
for i in $(seq 1 10); do
  curl -s http://$MINIKUBE_IP/api/users > /dev/null
  curl -s http://$MINIKUBE_IP/api/orders > /dev/null
  curl -s http://$MINIKUBE_IP/api/payments > /dev/null
done
echo "Generated 30 log entries"
```

Wait 30 seconds, then refresh Kibana Discover — you should see the new log entries.

> ✅ **Checkpoint**: ELK stack is operational — logs flowing from services → Filebeat → Logstash → Elasticsearch → Kibana.

---

## Phase 10 — Demonstrate the Jenkins CI/CD Pipeline

### 10.1 Start Jenkins

```bash
docker run -d \
  --name jenkins \
  -p 8080:8080 \
  -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins/jenkins:lts

# Wait for Jenkins to start
echo "Waiting for Jenkins to start..."
sleep 30

# Get the initial admin password
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

### 10.2 Setup Jenkins

1. Open **http://localhost:8080**
2. Enter the initial admin password
3. Click **Install suggested plugins**
4. Create your admin user
5. Install additional plugins: **Docker Pipeline**, **Kubernetes CLI**

### 10.3 Add credentials

Go to **Manage Jenkins → Credentials → System → Global credentials → Add Credentials**

**Docker Hub Credential:**
| Field    | Value |
|----------|-------|
| Kind     | Username with password |
| ID       | `docker-hub-credentials` |
| Username | Your Docker Hub username |
| Password | Your Docker Hub access token |

**Kubeconfig Credential:**
```bash
# Generate the kubeconfig file
minikube kubectl -- config view --flatten > /tmp/kubeconfig.yaml
```

| Field | Value |
|-------|-------|
| Kind  | Secret file |
| ID    | `kubeconfig-credentials` |
| File  | Upload the `kubeconfig.yaml` file from above |

### 10.4 Create a pipeline job (User Service example)

1. **New Item** → Name: `user-service-pipeline` → Select **Pipeline** → OK
2. Scroll to **Pipeline** section:
   - Definition: **Pipeline script from SCM**
   - SCM: **Git**
   - Repository URL: Your Git repo URL (or local path)
   - Script Path: `user-service/Jenkinsfile`
3. Click **Save**

### 10.5 Run the pipeline

1. Click **Build Now**
2. Click on the build number → **Console Output**
3. Watch each stage execute:

**Expected Console Output (abbreviated):**
```
[Pipeline] stage (Checkout)
Checking out revision abc123 from https://github.com/...
[Pipeline] stage (Install Dependencies)
added 57 packages in 3s
[Pipeline] stage (Run Tests)
Running user-service tests...
All tests passed.
[Pipeline] stage (Build Docker Image)
Successfully built abc123def456
Successfully tagged myprojectuser/user-service:1-abc123d
[Pipeline] stage (Push Docker Image)
Login Succeeded
1-abc123d: digest: sha256:... size: 1234
[Pipeline] stage (Deploy to Kubernetes)
deployment.apps/user-service configured
service/user-service unchanged
deployment "user-service" successfully rolled out
[Pipeline] stage (Verify Deployment)
NAME                            READY   STATUS    RESTARTS   AGE
user-service-xxxxxxxxx-xxxxx    1/1     Running   0          10s
[Pipeline] echo: User Service pipeline completed successfully!
```

### 10.6 Repeat for other services

Create similar pipeline jobs for:
- `order-service-pipeline` → Script Path: `order-service/Jenkinsfile`
- `payment-service-pipeline` → Script Path: `payment-service/Jenkinsfile`
- `frontend-pipeline` → Script Path: `frontend/Jenkinsfile`

> ✅ **Checkpoint**: Jenkins pipeline runs all 7 stages successfully — from checkout to verified deployment.

---

## Phase 11 — Demonstrate a Full CI/CD Cycle (Code Change → Deployment)

This is the **most impressive demo** — showing a code change flowing automatically through the pipeline.

### 11.1 Make a code change

Edit `user-service/src/index.js` — add a new seed user:

```bash
# Add this user to the users array in user-service/src/index.js
# { id: 6, name: 'Frank Demo', email: 'frank@example.com', role: 'customer', createdAt: '2025-04-12T00:00:00Z' }
```

### 11.2 Commit and push

```bash
git add user-service/src/index.js
git commit -m "feat: add new seed user Frank Demo"
git push origin main
```

### 11.3 Trigger the pipeline

- If you configured a **webhook**: Jenkins triggers automatically
- If using **SCM polling**: Wait for the next poll interval
- **Manual trigger**: Click **Build Now** on the `user-service-pipeline` job

### 11.4 Watch the pipeline execute

1. Open Jenkins → `user-service-pipeline` → Latest build → **Console Output**
2. Watch all 7 stages run
3. Confirm the build completes successfully

### 11.5 Verify the change is live

```bash
# The new user should appear in the API response
curl -s http://$MINIKUBE_IP/api/users | python3 -m json.tool | grep "Frank"
```

**Expected Output:**
```json
{
    "id": 6,
    "name": "Frank Demo",
    "email": "frank@example.com",
    "role": "customer"
}
```

### 11.6 Verify on the frontend dashboard

1. Open **http://$MINIKUBE_IP** in the browser
2. Click on **Users** in the sidebar
3. The new user **"Frank Demo"** should appear in the table
4. The **Total Users** stat card should now show **6**

> ✅ **Checkpoint**: Complete CI/CD cycle demonstrated — code change → Git push → Jenkins build → Docker image → K8s deployment → live on frontend.

---

## Phase 12 — Demonstrate Self-Healing & Resilience

### 12.1 Kill a pod and watch Kubernetes recreate it

```bash
# Get a user-service pod name
USER_POD=$(kubectl get pods -n microservices -l app=user-service -o jsonpath='{.items[0].metadata.name}')
echo "Deleting pod: $USER_POD"

# Delete the pod
kubectl delete pod $USER_POD -n microservices

# Watch Kubernetes recreate it automatically
kubectl get pods -n microservices -l app=user-service -w
```

**Expected Output:**
```
NAME                            READY   STATUS        RESTARTS   AGE
user-service-xxxxxxxxx-xxxxx    1/1     Terminating   0          10m
user-service-xxxxxxxxx-zzzzz    0/1     Pending       0          1s
user-service-xxxxxxxxx-zzzzz    0/1     ContainerCreating   0    2s
user-service-xxxxxxxxx-zzzzz    1/1     Running       0          5s
user-service-xxxxxxxxx-yyyyy    1/1     Running       0          10m
```

> The killed pod is immediately replaced. Service never goes down because we have 2 replicas.

Press `Ctrl+C` to stop watching.

### 12.2 Verify the service is still responsive during pod deletion

```bash
# While one pod is being replaced, the service still works via the other replica
curl -s http://$MINIKUBE_IP/api/users/health | python3 -m json.tool
# Should still return "healthy"
```

### 12.3 Scale a deployment up

```bash
kubectl scale deployment user-service -n microservices --replicas=4
kubectl get pods -n microservices -l app=user-service
```

**Expected Output:**
```
NAME                            READY   STATUS    RESTARTS   AGE
user-service-xxxxxxxxx-aaaaa    1/1     Running   0          30s
user-service-xxxxxxxxx-bbbbb    1/1     Running   0          30s
user-service-xxxxxxxxx-ccccc    1/1     Running   0          10m
user-service-xxxxxxxxx-ddddd    1/1     Running   0          10m
```

```bash
# Scale back down
kubectl scale deployment user-service -n microservices --replicas=2
```

### 12.4 View pod logs

```bash
# View logs from a specific service
kubectl logs -n microservices -l app=user-service --tail=20

# Follow logs in real-time
kubectl logs -n microservices -l app=order-service -f
# (Press Ctrl+C to stop)
```

> ✅ **Checkpoint**: Kubernetes self-healing demonstrated — pod deletion, automatic recovery, zero-downtime scaling.

---

## Phase 13 — Cleanup

### 13.1 Stop port-forwarding

```bash
# Kill all background port-forward processes
kill $(jobs -p) 2>/dev/null
```

### 13.2 Delete all Kubernetes resources

```bash
kubectl delete -f ingress.yaml
kubectl delete -f frontend/k8s/
kubectl delete -f user-service/k8s/
kubectl delete -f order-service/k8s/
kubectl delete -f payment-service/k8s/
kubectl delete -f monitoring/prometheus/
kubectl delete -f monitoring/grafana/
kubectl delete -f logging/filebeat/
kubectl delete -f logging/kibana/
kubectl delete -f logging/logstash/
kubectl delete -f logging/elasticsearch/
kubectl delete -f namespaces.yaml
```

### 13.3 Stop Jenkins

```bash
docker stop jenkins
docker rm jenkins
```

### 13.4 Stop Minikube

```bash
minikube stop
# Or delete the cluster entirely:
minikube delete
```

### 13.5 Reset Docker context (if you used Minikube's Docker)

```bash
eval $(minikube docker-env -u)
```

---

## Quick Demo Script (5-Minute Version)

If you only have 5 minutes, run this condensed version:

```bash
#!/bin/bash
# ===== 5-MINUTE DEMO SCRIPT =====

set -e

echo "🚀 Starting CI/CD Pipeline Demo..."

# Start cluster
echo "1/6 — Starting Minikube..."
minikube start --driver=docker --cpus=4 --memory=6144
minikube addons enable ingress
eval $(minikube docker-env)

# Build images
echo "2/6 — Building Docker images..."
cd cicd-microservices
docker build -t myprojectuser/user-service:latest ./user-service/ -q
docker build -t myprojectuser/order-service:latest ./order-service/ -q
docker build -t myprojectuser/payment-service:latest ./payment-service/ -q
docker build -t myprojectuser/frontend:latest ./frontend/ -q
echo "✅ Images built"

# Deploy
echo "3/6 — Deploying to Kubernetes..."
kubectl apply -f namespaces.yaml
for svc in user-service order-service payment-service frontend; do
  kubectl apply -f $svc/k8s/
  kubectl patch deployment ${svc} -n microservices \
    -p '{"spec":{"template":{"spec":{"containers":[{"name":"'${svc}'","imagePullPolicy":"Never"}]}}}}' 2>/dev/null || true
done
kubectl apply -f ingress.yaml
kubectl apply -f monitoring/prometheus/ -f monitoring/grafana/

# Wait
echo "4/6 — Waiting for pods..."
sleep 30
kubectl wait --for=condition=ready pod --all -n microservices --timeout=120s

# Test
echo "5/6 — Testing APIs..."
MINIKUBE_IP=$(minikube ip)
echo "Users API:"
curl -s http://$MINIKUBE_IP/api/users/health
echo ""
echo "Orders API:"
curl -s http://$MINIKUBE_IP/api/orders/health
echo ""
echo "Payments API:"
curl -s http://$MINIKUBE_IP/api/payments/health

# Display
echo ""
echo "6/6 — All services running!"
echo ""
echo "==========================================="
echo "  🎯 DEMO READY"
echo "==========================================="
echo "  Frontend:  http://$MINIKUBE_IP"
echo "  Users:     http://$MINIKUBE_IP/api/users"
echo "  Orders:    http://$MINIKUBE_IP/api/orders"
echo "  Payments:  http://$MINIKUBE_IP/api/payments"
echo "==========================================="
kubectl get pods -n microservices
```

---

## Common Issues & Fixes

| Problem | Symptom | Fix |
|---------|---------|-----|
| Pods stuck in `ImagePullBackOff` | `ErrImagePull` in pod events | Run `eval $(minikube docker-env)` before building images, patch `imagePullPolicy: Never` |
| Ingress returns 404/502 | `curl` gets error page | Wait 1-2 minutes for Ingress controller to sync; check `kubectl describe ingress` |
| Ingress not accessible | Connection refused | Run `minikube tunnel` in a separate terminal (required on macOS/Windows) |
| Elasticsearch CrashLoop | OOMKilled or vm.max_map_count | Run `minikube ssh` → `sudo sysctl -w vm.max_map_count=262144` → restart ES pod |
| Jenkins can't access Docker | Permission denied on socket | Add Jenkins user to docker group or mount Docker socket correctly |
| Port-forward drops connection | Connection reset | Re-run the `kubectl port-forward` command; it's expected to drop after idle |
| Frontend shows "—" for all stats | API calls failing | Check Ingress is routing correctly; open browser devtools → Network tab for errors |
| Minikube won't start | Resource allocation error | Reduce `--cpus` and `--memory` values, or free up host resources |

### Debug commands cheat sheet

```bash
# View pod events (most useful for debugging)
kubectl describe pod <pod-name> -n <namespace>

# View pod logs
kubectl logs <pod-name> -n <namespace>

# View logs for all pods of a service
kubectl logs -l app=user-service -n microservices --tail=50

# Get events sorted by time
kubectl get events -n microservices --sort-by='.lastTimestamp'

# Execute into a pod for debugging
kubectl exec -it <pod-name> -n microservices -- sh

# Check DNS resolution inside a pod
kubectl exec -it <pod-name> -n microservices -- nslookup order-service.microservices.svc.cluster.local
```
