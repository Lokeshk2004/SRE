# Setup Guide

Complete setup instructions for the CI/CD Microservices Pipeline project.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Install Minikube](#install-minikube)
3. [Start the Cluster](#start-the-cluster)
4. [Install Jenkins](#install-jenkins)
5. [Configure Jenkins Credentials](#configure-jenkins-credentials)
6. [Build & Push Docker Images](#build--push-docker-images)
7. [Deploy to Kubernetes](#deploy-to-kubernetes)
8. [Deploy Monitoring Stack](#deploy-monitoring-stack)
9. [Deploy Logging Stack](#deploy-logging-stack)
10. [Verify Everything](#verify-everything)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Ensure you have the following installed:

| Tool       | Version  | Purpose              |
|------------|----------|----------------------|
| Docker     | 20.10+   | Container runtime    |
| Minikube   | 1.32+    | Local K8s cluster    |
| kubectl    | 1.28+    | K8s CLI              |
| Node.js    | 18+      | Local development    |
| Git        | 2.30+    | Version control      |
| Jenkins    | 2.400+   | CI/CD server         |

---

## Install Minikube

### Linux
```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
rm minikube-linux-amd64
```

### macOS
```bash
brew install minikube
```

### Windows
```powershell
choco install minikube
# OR download from https://minikube.sigs.k8s.io/docs/start/
```

### Verify Installation
```bash
minikube version
```

---

## Start the Cluster

```bash
# Start Minikube with recommended settings
minikube start --driver=docker --cpus=4 --memory=6144

# Enable Ingress addon (required for routing)
minikube addons enable ingress

# Verify the cluster is running
kubectl cluster-info
kubectl get nodes

# Get the Minikube IP (save this — you'll use it to access services)
minikube ip
```

### Use Minikube's Docker daemon (optional, for local builds)
```bash
# This makes 'docker build' push directly into Minikube's registry
eval $(minikube docker-env)
```

---

## Install Jenkins

### Option A: Run Jenkins in Docker (Recommended)
```bash
docker run -d \
  --name jenkins \
  -p 8080:8080 \
  -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins/jenkins:lts

# Get the initial admin password
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

### Option B: Install Jenkins locally
Follow the [official Jenkins installation guide](https://www.jenkins.io/doc/book/installing/).

### Required Jenkins Plugins
Install these plugins from **Manage Jenkins → Plugins → Available**:

- **Docker Pipeline** — Docker integration
- **Kubernetes CLI** — kubectl in pipelines
- **Git** — Git SCM
- **Pipeline** — Declarative pipelines
- **Credentials Binding** — Credential injection

---

## Configure Jenkins Credentials

Navigate to **Manage Jenkins → Credentials → System → Global credentials → Add Credentials**

### 1. Docker Hub Credentials
| Field          | Value                    |
|----------------|--------------------------|
| Kind           | Username with password   |
| ID             | `docker-hub-credentials` |
| Username       | Your Docker Hub username |
| Password       | Your Docker Hub password or access token |

### 2. Kubeconfig File
| Field          | Value                    |
|----------------|--------------------------|
| Kind           | Secret file              |
| ID             | `kubeconfig-credentials` |
| File           | Upload your `~/.kube/config` file |

To get your kubeconfig:
```bash
# Copy the kubeconfig file
cat ~/.kube/config
# Or on Minikube specifically:
minikube kubectl -- config view --flatten
```

---

## Build & Push Docker Images

### Set your Docker Hub username
```bash
export DOCKER_USER="your-dockerhub-username"
```

### Build all images
```bash
# Use Minikube's Docker daemon (skip Docker Hub push if using this)
eval $(minikube docker-env)

# Build User Service
cd user-service
docker build -t ${DOCKER_USER}/user-service:latest .
cd ..

# Build Order Service
cd order-service
docker build -t ${DOCKER_USER}/order-service:latest .
cd ..

# Build Payment Service
cd payment-service
docker build -t ${DOCKER_USER}/payment-service:latest .
cd ..

# Build Frontend
cd frontend
docker build -t ${DOCKER_USER}/frontend:latest .
cd ..
```

### Push to Docker Hub (if not using Minikube's Docker)
```bash
docker login -u ${DOCKER_USER}

docker push ${DOCKER_USER}/user-service:latest
docker push ${DOCKER_USER}/order-service:latest
docker push ${DOCKER_USER}/payment-service:latest
docker push ${DOCKER_USER}/frontend:latest
```

---

## Deploy to Kubernetes

### Step 1: Create Namespaces
```bash
kubectl apply -f namespaces.yaml

# Verify
kubectl get namespaces
```

### Step 2: Deploy Microservices
```bash
# Deploy all services
kubectl apply -f user-service/k8s/
kubectl apply -f order-service/k8s/
kubectl apply -f payment-service/k8s/
kubectl apply -f frontend/k8s/

# Verify all pods are running
kubectl get pods -n microservices
kubectl get svc -n microservices
```

### Step 3: Apply Ingress
```bash
kubectl apply -f ingress.yaml

# Verify Ingress
kubectl get ingress -n microservices
```

### Step 4: Update Deployment Images (if using your own Docker Hub)
```bash
# Replace myprojectuser with your Docker Hub username
kubectl set image deployment/user-service user-service=${DOCKER_USER}/user-service:latest -n microservices
kubectl set image deployment/order-service order-service=${DOCKER_USER}/order-service:latest -n microservices
kubectl set image deployment/payment-service payment-service=${DOCKER_USER}/payment-service:latest -n microservices
kubectl set image deployment/frontend frontend=${DOCKER_USER}/frontend:latest -n microservices
```

---

## Deploy Monitoring Stack

```bash
# Prometheus
kubectl apply -f monitoring/prometheus/prometheus-configmap.yaml
kubectl apply -f monitoring/prometheus/prometheus-deployment.yaml
kubectl apply -f monitoring/prometheus/prometheus-service.yaml

# Grafana
kubectl apply -f monitoring/grafana/grafana-deployment.yaml
kubectl apply -f monitoring/grafana/grafana-service.yaml

# Verify
kubectl get pods -n monitoring
kubectl get svc -n monitoring
```

### Access Prometheus
```bash
kubectl port-forward svc/prometheus-service -n monitoring 9090:9090
# Open http://localhost:9090
```

### Access Grafana
```bash
kubectl port-forward svc/grafana-service -n monitoring 3000:3000
# Open http://localhost:3000
# Login: admin / admin123
```

### Add Prometheus as Grafana Data Source
1. Go to **Configuration → Data Sources → Add data source**
2. Select **Prometheus**
3. URL: `http://prometheus-service.monitoring.svc.cluster.local:9090`
4. Click **Save & Test**

---

## Deploy Logging Stack

```bash
# Elasticsearch (deploy first — others depend on it)
kubectl apply -f logging/elasticsearch/
# Wait for Elasticsearch to be ready
kubectl wait --for=condition=ready pod -l app=elasticsearch -n logging --timeout=120s

# Logstash
kubectl apply -f logging/logstash/

# Kibana
kubectl apply -f logging/kibana/

# Filebeat
kubectl apply -f logging/filebeat/

# Verify
kubectl get pods -n logging
kubectl get svc -n logging
```

### Access Kibana
```bash
kubectl port-forward svc/kibana-service -n logging 5601:5601
# Open http://localhost:5601
```

### Create Kibana Index Pattern
1. Go to **Stack Management → Index Patterns**
2. Create pattern: `microservices-logs-*`
3. Time field: `@timestamp`
4. Click **Create index pattern**

---

## Verify Everything

### Check all pods across all namespaces
```bash
kubectl get pods -A | grep -E "microservices|monitoring|logging"
```

### Test API endpoints
```bash
MINIKUBE_IP=$(minikube ip)

# Frontend
curl -s http://$MINIKUBE_IP/ | head -5

# Users API
curl -s http://$MINIKUBE_IP/api/users | python3 -m json.tool

# Orders API
curl -s http://$MINIKUBE_IP/api/orders | python3 -m json.tool

# Payments API
curl -s http://$MINIKUBE_IP/api/payments | python3 -m json.tool

# Health checks
curl -s http://$MINIKUBE_IP/api/users/health
curl -s http://$MINIKUBE_IP/api/orders/health
curl -s http://$MINIKUBE_IP/api/payments/health
```

### Create a Jenkins pipeline job
1. Go to Jenkins → **New Item**
2. Name: `user-service-pipeline`
3. Type: **Pipeline**
4. Pipeline → Definition: **Pipeline script from SCM**
5. SCM: **Git**
6. Repository URL: Your Git repo URL
7. Script Path: `user-service/Jenkinsfile`
8. Click **Save** → **Build Now**

Repeat for `order-service`, `payment-service`, and `frontend`.

---

## Troubleshooting

### Pods stuck in ImagePullBackOff
```bash
# If using Minikube's Docker:
eval $(minikube docker-env)
# Then rebuild images — they'll be available locally

# Or set imagePullPolicy to Never in deployment.yaml:
# imagePullPolicy: Never
```

### Ingress not working
```bash
# Check Ingress controller is running
kubectl get pods -n ingress-nginx

# Check Ingress resource
kubectl describe ingress microservices-ingress -n microservices

# On macOS/Windows, you may need minikube tunnel:
minikube tunnel
```

### Elasticsearch won't start (CrashLoopBackOff)
```bash
# Check logs
kubectl logs -n logging deployment/elasticsearch

# Common fix: increase vm.max_map_count on the Minikube node
minikube ssh
sudo sysctl -w vm.max_map_count=262144
exit
# Then restart the pod
kubectl delete pod -l app=elasticsearch -n logging
```

### Jenkins can't connect to Kubernetes
```bash
# Ensure kubeconfig is correct
kubectl cluster-info
# Re-upload the kubeconfig to Jenkins credentials
minikube kubectl -- config view --flatten > kubeconfig.yaml
```

### Port forwarding for monitoring/logging
```bash
# All port-forwards in one terminal
kubectl port-forward svc/prometheus-service -n monitoring 9090:9090 &
kubectl port-forward svc/grafana-service -n monitoring 3000:3000 &
kubectl port-forward svc/kibana-service -n logging 5601:5601 &
```

---

## Cleanup

```bash
# Delete all resources
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

# Stop Minikube
minikube stop

# Delete Minikube cluster entirely
minikube delete
```
