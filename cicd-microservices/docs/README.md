# CI/CD Microservices Pipeline

A complete, production-grade CI/CD pipeline project featuring **3 microservices**, a **frontend dashboard**, **Jenkins pipelines**, **Docker** containerization, and **Kubernetes** orchestration on **Minikube** — with full **Prometheus/Grafana** monitoring and **ELK** logging.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                        MINIKUBE CLUSTER                        │
│                                                                │
│  ┌──────────────── Namespace: microservices ──────────────────┐ │
│  │                                                            │ │
│  │   ┌─────────────┐  ┌──────────────┐  ┌────────────────┐   │ │
│  │   │ User Service │  │ Order Service │  │Payment Service │   │ │
│  │   │   :3001      │  │    :3002      │  │    :3003       │   │ │
│  │   └──────┬───────┘  └──────┬────────┘  └───────┬────────┘   │ │
│  │          │                 │                    │            │ │
│  │   ┌──────┴─────────────────┴────────────────────┴──────┐    │ │
│  │   │              Frontend (Nginx :80)                  │    │ │
│  │   └────────────────────────────────────────────────────┘    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                  │
│                    ┌─────────┴─────────┐                        │
│                    │  Ingress (nginx)   │                        │
│                    └─────────┬─────────┘                        │
│                              │                                  │
│  ┌────── Namespace: monitoring ──────┐  ┌── Namespace: logging ─┐│
│  │  Prometheus :9090                 │  │  Elasticsearch :9200  ││
│  │  Grafana    :3000                 │  │  Logstash      :5044  ││
│  └───────────────────────────────────┘  │  Kibana        :5601  ││
│                                         │  Filebeat              ││
│                                         └────────────────────────┘│
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                     CI/CD PIPELINE (Jenkins)                    │
│                                                                │
│  Git Push → Jenkins → npm install → npm test → Docker Build    │
│           → Docker Push (Hub) → kubectl apply → Verify         │
└────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer          | Technology                        |
|----------------|-----------------------------------|
| Backend        | Node.js 18 + Express.js           |
| Frontend       | HTML/CSS/JS + Nginx               |
| CI/CD          | Jenkins (Declarative Pipelines)   |
| Containerization | Docker (multi-stage builds)     |
| Orchestration  | Kubernetes on Minikube            |
| Monitoring     | Prometheus + Grafana              |
| Logging        | Elasticsearch + Logstash + Kibana + Filebeat |

---

## Microservices

| Service         | Port | Endpoints                              |
|-----------------|------|----------------------------------------|
| User Service    | 3001 | `GET/POST/PUT/DELETE /`, `GET /health`, `GET /metrics` |
| Order Service   | 3002 | `GET/POST/PUT/DELETE /`, `GET /health`, `GET /metrics` |
| Payment Service | 3003 | `GET/POST/PUT/DELETE /`, `GET /health`, `GET /metrics` |
| Frontend        | 80   | Dashboard UI, `/nginx-health`          |

---

## Quick Start

```bash
# 1. Start Minikube
minikube start --driver=docker --cpus=4 --memory=6144
minikube addons enable ingress

# 2. Create namespaces
kubectl apply -f namespaces.yaml

# 3. Deploy microservices
kubectl apply -f user-service/k8s/
kubectl apply -f order-service/k8s/
kubectl apply -f payment-service/k8s/
kubectl apply -f frontend/k8s/

# 4. Apply Ingress
kubectl apply -f ingress.yaml

# 5. Deploy monitoring
kubectl apply -f monitoring/prometheus/
kubectl apply -f monitoring/grafana/

# 6. Deploy logging
kubectl apply -f logging/elasticsearch/
kubectl apply -f logging/logstash/
kubectl apply -f logging/kibana/
kubectl apply -f logging/filebeat/

# 7. Access the dashboard
echo "Dashboard: http://$(minikube ip)"
```

---

## Folder Structure

```
cicd-microservices/
├── namespaces.yaml
├── ingress.yaml
├── user-service/          # User CRUD microservice
├── order-service/         # Order management microservice
├── payment-service/       # Payment processing microservice
├── frontend/              # Nginx-served dashboard
├── monitoring/            # Prometheus + Grafana
├── logging/               # ELK Stack + Filebeat
└── docs/                  # Documentation
```

---

## Kubernetes Namespaces

| Namespace       | Purpose                         |
|-----------------|----------------------------------|
| `microservices` | All app services + frontend      |
| `monitoring`    | Prometheus + Grafana             |
| `logging`       | Elasticsearch + Logstash + Kibana + Filebeat |

---

## CI/CD Pipeline Stages

1. **Checkout** — Clone repository from Git
2. **Install Dependencies** — `npm ci`
3. **Run Tests** — `npm test`
4. **Build Docker Image** — Multi-stage build with version tag
5. **Push Docker Image** — Push to Docker Hub via Jenkins credentials
6. **Deploy to Kubernetes** — `kubectl apply` with kubeconfig credential
7. **Verify Deployment** — Rollout status + pod/service check

---

## Documentation

- **[SETUP.md](./SETUP.md)** — Complete setup guide (Minikube, Jenkins, Docker, credentials)
- **[PIPELINE.md](./PIPELINE.md)** — Detailed pipeline architecture and flow

---

## Accessing Services

After deployment, access services via Minikube IP:

```bash
MINIKUBE_IP=$(minikube ip)

# Frontend Dashboard
curl http://$MINIKUBE_IP/

# API Endpoints
curl http://$MINIKUBE_IP/api/users
curl http://$MINIKUBE_IP/api/orders
curl http://$MINIKUBE_IP/api/payments

# Health Checks
curl http://$MINIKUBE_IP/api/users/health
curl http://$MINIKUBE_IP/api/orders/health
curl http://$MINIKUBE_IP/api/payments/health

# Monitoring (port-forward)
kubectl port-forward svc/prometheus-service -n monitoring 9090:9090
kubectl port-forward svc/grafana-service -n monitoring 3000:3000

# Logging (port-forward)
kubectl port-forward svc/kibana-service -n logging 5601:5601
```

---

## Docker Hub Username

All files use `myprojectuser` as the Docker Hub username placeholder. To use your own:

```bash
# Find and replace across all files
grep -r "myprojectuser" --include="*.yaml" --include="Jenkinsfile" --include="Dockerfile"
# Then replace with your actual Docker Hub username
```

---

## License

This project is created for educational and assessment purposes.
