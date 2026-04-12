# Pipeline Architecture & Flow

Detailed documentation of the Jenkins CI/CD pipeline architecture, stages, and workflows.

---

## Table of Contents

1. [Pipeline Overview](#pipeline-overview)
2. [Pipeline Architecture](#pipeline-architecture)
3. [Stage Details](#stage-details)
4. [Jenkins Credential Management](#jenkins-credential-management)
5. [Docker Build Strategy](#docker-build-strategy)
6. [Kubernetes Deployment Strategy](#kubernetes-deployment-strategy)
7. [Monitoring Pipeline](#monitoring-pipeline)
8. [Pipeline Per Service](#pipeline-per-service)

---

## Pipeline Overview

Each microservice has its own `Jenkinsfile` with a **declarative Groovy pipeline**. The pipeline automates the full lifecycle from code commit to production deployment.

```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌─────────────┐
│ Git Push │───▶│ Checkout │───▶│ Install  │───▶│  Run Tests  │
└─────────┘    └──────────┘    │   Deps   │    └──────┬──────┘
                               └──────────┘           │
                                                      ▼
                                              ┌─────────────┐
                                              │ Docker Build │
                                              └──────┬──────┘
                                                     │
                                                     ▼
                                              ┌─────────────┐
                                              │ Docker Push  │
                                              │  (Hub)       │
                                              └──────┬──────┘
                                                     │
                                                     ▼
                                              ┌─────────────┐
                                              │  K8s Deploy  │
                                              │  (kubectl)   │
                                              └──────┬──────┘
                                                     │
                                                     ▼
                                              ┌─────────────┐
                                              │   Verify     │
                                              │  Deployment  │
                                              └─────────────┘
```

---

## Pipeline Architecture

### Key Design Decisions

| Decision                     | Rationale                                                    |
|------------------------------|--------------------------------------------------------------|
| One Jenkinsfile per service  | Independent deployments, isolated failures, parallel builds  |
| Declarative pipeline syntax  | Readable, maintainable, enforces structure                   |
| Docker multi-stage builds    | Smaller images, no dev dependencies in production            |
| Non-root container user      | Security best practice, prevents privilege escalation        |
| Jenkins credentials          | Never hardcode secrets, inject at runtime via `credentials()`|
| ClusterIP + Ingress          | Internal services only, single entry point via Ingress       |
| Build number + commit hash   | Unique, traceable image tags (e.g., `5-a1b2c3d`)            |

### Environment Variables (Set in each Jenkinsfile)

| Variable                   | Description                          | Example Value               |
|----------------------------|--------------------------------------|-----------------------------|
| `DOCKER_HUB_CREDENTIALS`  | Jenkins credential ID for Docker Hub | `docker-hub-credentials`    |
| `DOCKER_IMAGE`             | Full image name                      | `myprojectuser/user-service`|
| `DOCKER_TAG`               | Unique image tag                     | `5-a1b2c3d`                 |
| `KUBECONFIG_CREDENTIALS`   | Jenkins credential ID for kubeconfig | `kubeconfig-credentials`    |

---

## Stage Details

### Stage 1: Checkout

```groovy
stage('Checkout') {
    steps {
        checkout scm
        echo "Checked out branch: ${env.BRANCH_NAME ?: 'main'}"
    }
}
```

- Pulls the latest code from the configured SCM (Git)
- Displays the branch being built
- Triggers on Git push via webhook or polling

### Stage 2: Install Dependencies

```groovy
stage('Install Dependencies') {
    steps {
        dir('user-service') {
            sh 'npm ci'
        }
    }
}
```

- Uses `npm ci` instead of `npm install` for deterministic, clean installs
- Runs inside the specific service directory
- Ensures `node_modules` matches `package-lock.json` exactly

### Stage 3: Run Tests

```groovy
stage('Run Tests') {
    steps {
        dir('user-service') {
            sh 'npm test'
        }
    }
}
```

- Executes the test script defined in `package.json`
- Pipeline fails fast if tests don't pass
- Prevents broken code from being deployed

### Stage 4: Build Docker Image

```groovy
stage('Build Docker Image') {
    steps {
        dir('user-service') {
            sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} -t ${DOCKER_IMAGE}:latest ."
        }
    }
}
```

- Multi-stage build (builder + production)
- Tags with both unique version (`BUILD_NUMBER-COMMIT_HASH`) and `latest`
- Unique tag enables image traceability and rollback

### Stage 5: Push Docker Image

```groovy
stage('Push Docker Image') {
    steps {
        sh "echo ${DOCKER_HUB_CREDENTIALS_PSW} | docker login -u ${DOCKER_HUB_CREDENTIALS_USR} --password-stdin"
        sh "docker push ${DOCKER_IMAGE}:${DOCKER_TAG}"
        sh "docker push ${DOCKER_IMAGE}:latest"
    }
}
```

- Authenticates using Jenkins credentials (never hardcoded)
- `--password-stdin` prevents password from appearing in process list
- Pushes both tags to Docker Hub

### Stage 6: Deploy to Kubernetes

```groovy
stage('Deploy to Kubernetes') {
    steps {
        withCredentials([file(credentialsId: 'kubeconfig-credentials', variable: 'KUBECONFIG')]) {
            sh "kubectl apply -f user-service/k8s/deployment.yaml"
            sh "kubectl apply -f user-service/k8s/service.yaml"
            sh "kubectl rollout status deployment/user-service -n microservices --timeout=120s"
        }
    }
}
```

- Injects kubeconfig as a temporary file credential
- Applies deployment and service manifests
- `rollout status` waits until the deployment is fully rolled out (or times out)

### Stage 7: Verify Deployment

```groovy
stage('Verify Deployment') {
    steps {
        withCredentials([file(credentialsId: 'kubeconfig-credentials', variable: 'KUBECONFIG')]) {
            sh "kubectl get pods -n microservices -l app=user-service"
            sh "kubectl get svc -n microservices -l app=user-service"
        }
    }
}
```

- Lists running pods for the deployed service
- Confirms the service is accessible within the cluster
- Provides final verification in the Jenkins console output

### Post Actions

```groovy
post {
    success {
        echo 'Pipeline completed successfully!'
    }
    failure {
        echo 'Pipeline failed. Check logs for details.'
    }
    always {
        sh 'docker logout || true'
        cleanWs()
    }
}
```

- **success**: Logs success message
- **failure**: Logs failure message (could be extended to send Slack/email notifications)
- **always**: Logs out of Docker Hub, cleans the Jenkins workspace

---

## Jenkins Credential Management

### Credentials Used

| Credential ID            | Type                | Purpose                        |
|--------------------------|---------------------|--------------------------------|
| `docker-hub-credentials` | Username + Password | Push Docker images to Hub      |
| `kubeconfig-credentials` | Secret File         | Authenticate to K8s cluster    |

### How Credentials Are Injected

```groovy
// Username + Password credential
// Jenkins auto-creates _USR and _PSW suffixed variables
environment {
    DOCKER_HUB_CREDENTIALS = credentials('docker-hub-credentials')
}
// Access via: DOCKER_HUB_CREDENTIALS_USR, DOCKER_HUB_CREDENTIALS_PSW

// File credential — injected via withCredentials block
withCredentials([file(credentialsId: 'kubeconfig-credentials', variable: 'KUBECONFIG')]) {
    sh "kubectl get pods"  // KUBECONFIG env var points to temp file
}
```

### Security Rules

1. **Never hardcode** passwords, tokens, or API keys in Jenkinsfiles
2. **Use `--password-stdin`** for Docker login (not `-p` flag)
3. **Credentials are scoped** — only available during pipeline execution
4. **Temporary files** — kubeconfig file is auto-deleted after the block

---

## Docker Build Strategy

### Multi-Stage Build

```dockerfile
# Stage 1: Install dependencies
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/

# Stage 2: Production image
FROM node:18-alpine AS production
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -D appuser
WORKDIR /app
COPY --from=builder --chown=appuser:appgroup /app/ ./
USER appuser
CMD ["node", "src/index.js"]
```

### Why Multi-Stage?

| Benefit                  | Explanation                                              |
|--------------------------|----------------------------------------------------------|
| Smaller image size       | Only production deps, no build tools or dev deps         |
| Security                 | No unnecessary packages in final image                   |
| Non-root user            | Runs as `appuser:appgroup` (UID 1001), not root          |
| Healthcheck              | Built-in Docker HEALTHCHECK for container orchestration  |
| Alpine base              | ~5MB base image vs ~350MB for full Node.js image         |

### Image Tagging Strategy

```
myprojectuser/user-service:5-a1b2c3d     # Unique: BUILD_NUMBER-COMMIT_HASH
myprojectuser/user-service:latest         # Always points to newest build
```

- **Unique tag**: Enables rollback to any specific build
- **Latest tag**: Convenience for development/testing

---

## Kubernetes Deployment Strategy

### Resource Architecture

```
Namespace: microservices
├── Deployment: user-service    (2 replicas)
│   └── Service: user-service   (ClusterIP :3001)
├── Deployment: order-service   (2 replicas)
│   └── Service: order-service  (ClusterIP :3002)
├── Deployment: payment-service (2 replicas)
│   └── Service: payment-service (ClusterIP :3003)
├── Deployment: frontend        (2 replicas)
│   └── Service: frontend-service (ClusterIP :80)
└── Ingress: microservices-ingress
    ├── / → frontend-service:80
    ├── /api/users → user-service:3001
    ├── /api/orders → order-service:3002
    └── /api/payments → payment-service:3003
```

### Deployment Features

| Feature              | Configuration                        |
|----------------------|--------------------------------------|
| Replicas             | 2 per service (high availability)    |
| Resource requests    | CPU: 100m, Memory: 128Mi            |
| Resource limits      | CPU: 250m, Memory: 256Mi            |
| Liveness probe       | HTTP GET /health, 15s period          |
| Readiness probe      | HTTP GET /health, 10s period          |
| Rolling update       | Default strategy (max 25% unavailable)|

### Ingress Routing

The Ingress controller (nginx) routes all external traffic:

| Path            | Backend Service        | Port |
|-----------------|------------------------|------|
| `/`             | frontend-service       | 80   |
| `/api/users/*`  | user-service           | 3001 |
| `/api/orders/*` | order-service          | 3002 |
| `/api/payments/*`| payment-service       | 3003 |

The `rewrite-target` annotation strips the `/api/users` prefix so the backend receives clean paths.

---

## Monitoring Pipeline

### Data Flow

```
Microservices ──/metrics──▶ Prometheus ──▶ Grafana
    │                                         │
    │                                         │
    └──── logs ──▶ Filebeat ──▶ Logstash ──▶ Elasticsearch ──▶ Kibana
```

### Prometheus Metrics Exposed

Each microservice exposes a `/metrics` endpoint:

| Metric                           | Type    | Description                    |
|----------------------------------|---------|--------------------------------|
| `*_service_requests_total`       | Counter | Total HTTP requests received   |
| `*_service_*_total`              | Gauge   | Total records in memory        |
| `*_service_uptime_seconds`       | Gauge   | Service uptime in seconds      |
| `*_service_*_by_status`          | Gauge   | Records grouped by status      |

### Prometheus Scrape Configuration

Prometheus scrapes each microservice every 15 seconds via cross-namespace DNS:

```yaml
- job_name: 'user-service'
  static_configs:
    - targets: ['user-service.microservices.svc.cluster.local:3001']
```

---

## Pipeline Per Service

### User Service Pipeline
- **Jenkinsfile**: `user-service/Jenkinsfile`
- **Docker Image**: `myprojectuser/user-service`
- **K8s Manifests**: `user-service/k8s/`

### Order Service Pipeline
- **Jenkinsfile**: `order-service/Jenkinsfile`
- **Docker Image**: `myprojectuser/order-service`
- **K8s Manifests**: `order-service/k8s/`

### Payment Service Pipeline
- **Jenkinsfile**: `payment-service/Jenkinsfile`
- **Docker Image**: `myprojectuser/payment-service`
- **K8s Manifests**: `payment-service/k8s/`

### Frontend Pipeline
- **Jenkinsfile**: `frontend/Jenkinsfile`
- **Docker Image**: `myprojectuser/frontend`
- **K8s Manifests**: `frontend/k8s/`
- **Note**: No `npm install` or `npm test` — it's static HTML/CSS/JS served by Nginx

### Setting Up Jenkins Pipeline Jobs

For each service, create a Jenkins Pipeline job:

1. **New Item** → Enter name (e.g., `user-service-pipeline`) → Select **Pipeline**
2. **Pipeline section**:
   - Definition: **Pipeline script from SCM**
   - SCM: **Git**
   - Repository URL: `https://github.com/your-username/cicd-microservices.git`
   - Branch: `*/main`
   - Script Path: `user-service/Jenkinsfile`
3. **Build Triggers** (optional):
   - Poll SCM: `H/5 * * * *` (every 5 minutes)
   - Or configure GitHub Webhook for instant triggers
4. Click **Save** → **Build Now**
