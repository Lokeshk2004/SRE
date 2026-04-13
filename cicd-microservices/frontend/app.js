const API_BASE = {
  users: '/api/users',
  orders: '/api/orders',
  payments: '/api/payments'
};

const HEALTH_ENDPOINTS = [
  { name: 'User Service', url: '/api/users/health', key: 'user' },
  { name: 'Order Service', url: '/api/orders/health', key: 'order' },
  { name: 'Payment Service', url: '/api/payments/health', key: 'payment' }
];

//state to store all

const state = {
  currentSection: 'dashboard',
  users: [],
  orders: [],
  payments: [],
  health: {}
};

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const section = item.dataset.section;
    navigateTo(section);
  });
});

function navigateTo(section) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-section="${section}"]`).classList.add('active');

  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById(`section-${section}`).classList.remove('hidden');

  const titles = {
    dashboard: { title: 'Dashboard', subtitle: 'Overview of all microservices here' },
    users: { title: 'Users', subtitle: 'Manage user accounts' },
    orders: { title: 'Orders', subtitle: 'Track and manage orders' },
    payments: { title: 'Payments', subtitle: 'Payment transactions' },
    health: { title: 'Service Health', subtitle: 'Real-time health monitoring' }
  };
  document.getElementById('page-title').textContent = titles[section].title;
  document.getElementById('page-subtitle').textContent = titles[section].subtitle;

  state.currentSection = section;
  loadSectionData(section);
}

async function fetchJSON(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error.message);
    return null;
  }
}

async function checkHealth(endpoint) {
  try {
    const start = Date.now();
    const response = await fetch(endpoint.url, { signal: AbortSignal.timeout(3000) });
    const latency = Date.now() - start;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { ...data, latency, healthy: true };
  } catch (error) {
    return { status: 'unhealthy', service: endpoint.name, healthy: false, latency: -1, error: error.message };
  }
}

async function loadSectionData(section) {
  switch (section) {
    case 'dashboard': await loadDashboard(); break;
    case 'users': await loadUsers(); break;
    case 'orders': await loadOrders(); break;
    case 'payments': await loadPayments(); break;
    case 'health': await loadHealthDetails(); break;
  }
  updateTimestamp();
}

async function loadDashboard() {
  const [usersData, ordersData, paymentsData, ...healthResults] = await Promise.all([
    fetchJSON(API_BASE.users),
    fetchJSON(API_BASE.orders),
    fetchJSON(API_BASE.payments),
    ...HEALTH_ENDPOINTS.map(ep => checkHealth(ep))
  ]);

  document.getElementById('stat-users-count').textContent = usersData ? usersData.count : '—';
  document.getElementById('stat-orders-count').textContent = ordersData ? ordersData.count : '—';
  document.getElementById('stat-payments-count').textContent = paymentsData ? paymentsData.count : '—';
  document.getElementById('stat-revenue-amount').textContent = paymentsData ? `$${paymentsData.totalRevenue}` : '—';

  if (usersData) state.users = usersData.data;
  if (ordersData) state.orders = ordersData.data;
  if (paymentsData) state.payments = paymentsData.data;

  const healthSummaryEl = document.getElementById('health-summary');
  healthSummaryEl.innerHTML = healthResults.map((h, i) => `
    <div class="health-summary-item">
      <div class="health-summary-left">
        <span class="health-summary-dot ${h.healthy ? 'healthy' : 'unhealthy'}"></span>
        <span class="health-summary-name">${HEALTH_ENDPOINTS[i].name}</span>
      </div>
      <span class="health-summary-uptime">${h.healthy ? h.latency + 'ms' : 'Down'}</span>
    </div>
  `).join('');

  const allHealthy = healthResults.every(h => h.healthy);
  const someHealthy = healthResults.some(h => h.healthy);
  const statusDot = document.getElementById('overall-status-dot');
  const statusText = document.getElementById('overall-status-text');
  statusDot.className = 'status-dot ' + (allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'down');
  statusText.textContent = allHealthy ? 'All Systems Go' : someHealthy ? 'Degraded' : 'Systems Down';

  const recentOrdersEl = document.getElementById('recent-orders-list');
  if (ordersData && ordersData.data.length > 0) {
    const recent = ordersData.data.slice(-5).reverse();
    recentOrdersEl.innerHTML = recent.map(o => `
      <div class="recent-order-item">
        <span class="recent-order-product">${o.product}</span>
        <span class="order-status-badge ${o.status}">${o.status}</span>
        <span class="recent-order-price">$${o.price.toFixed(2)}</span>
      </div>
    `).join('');
  } else {
    recentOrdersEl.innerHTML = '<p class="loading-text">No orders available</p>';
  }
}

async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = '<tr><td colspan="5" class="loading-text">Loading users...</td></tr>';

  const data = await fetchJSON(API_BASE.users);
  if (!data) {
    tbody.innerHTML = '<tr><td colspan="5" class="error-text">Failed to load users. Is the User Service running?</td></tr>';
    return;
  }

  state.users = data.data;
  tbody.innerHTML = data.data.map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td><span class="order-status-badge ${u.role === 'admin' ? 'delivered' : u.role === 'manager' ? 'shipped' : 'pending'}">${u.role}</span></td>
      <td>${new Date(u.createdAt).toLocaleDateString()}</td>
    </tr>
  `).join('');
}

async function loadOrders() {
  const tbody = document.getElementById('orders-table-body');
  tbody.innerHTML = '<tr><td colspan="7" class="loading-text">Loading orders...</td></tr>';

  const data = await fetchJSON(API_BASE.orders);
  if (!data) {
    tbody.innerHTML = '<tr><td colspan="7" class="error-text">Failed to load orders. Is the Order Service running?</td></tr>';
    return;
  }

  state.orders = data.data;
  tbody.innerHTML = data.data.map(o => `
    <tr>
      <td>${o.id}</td>
      <td>${o.userId}</td>
      <td>${o.product}</td>
      <td>${o.quantity}</td>
      <td>$${o.price.toFixed(2)}</td>
      <td><span class="order-status-badge ${o.status}">${o.status}</span></td>
      <td>${new Date(o.createdAt).toLocaleDateString()}</td>
    </tr>
  `).join('');
}

async function loadPayments() {
  const tbody = document.getElementById('payments-table-body');
  tbody.innerHTML = '<tr><td colspan="7" class="loading-text">Loading payments...</td></tr>';

  const data = await fetchJSON(API_BASE.payments);
  if (!data) {
    tbody.innerHTML = '<tr><td colspan="7" class="error-text">Failed to load payments. Is the Payment Service running?</td></tr>';
    return;
  }

  state.payments = data.data;
  tbody.innerHTML = data.data.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.orderId}</td>
      <td>$${p.amount.toFixed(2)}</td>
      <td>${p.method.replace('_', ' ')}</td>
      <td><span class="order-status-badge ${p.status === 'completed' ? 'delivered' : p.status === 'processing' ? 'processing' : p.status === 'failed' ? 'shipped' : 'pending'}">${p.status}</span></td>
      <td><code>${p.transactionId}</code></td>
      <td>${new Date(p.createdAt).toLocaleDateString()}</td>
    </tr>
  `).join('');
}

async function loadHealthDetails() {
  const grid = document.getElementById('health-detail-grid');
  grid.innerHTML = HEALTH_ENDPOINTS.map(ep => `
    <div class="health-card" id="health-card-${ep.key}">
      <div class="health-card-header">
        <span class="health-card-title">${ep.name}</span>
        <span class="health-badge" id="health-badge-${ep.key}">Checking...</span>
      </div>
      <div id="health-details-${ep.key}">
        <p class="loading-text">Checking health...</p>
      </div>
    </div>
  `).join('');

  for (const ep of HEALTH_ENDPOINTS) {
    const result = await checkHealth(ep);
    state.health[ep.key] = result;

    const badge = document.getElementById(`health-badge-${ep.key}`);
    badge.textContent = result.healthy ? 'Healthy' : 'Unhealthy';
    badge.className = `health-badge ${result.healthy ? 'healthy' : 'unhealthy'}`;

    const details = document.getElementById(`health-details-${ep.key}`);
    if (result.healthy) {
      details.innerHTML = `
        <div class="health-detail">
          <span class="health-detail-label">Status</span>
          <span class="health-detail-value">${result.status}</span>
        </div>
        <div class="health-detail">
          <span class="health-detail-label">Service</span>
          <span class="health-detail-value">${result.service}</span>
        </div>
        <div class="health-detail">
          <span class="health-detail-label">Uptime</span>
          <span class="health-detail-value">${formatUptime(result.uptime)}</span>
        </div>
        <div class="health-detail">
          <span class="health-detail-label">Latency</span>
          <span class="health-detail-value">${result.latency}ms</span>
        </div>
        <div class="health-detail">
          <span class="health-detail-label">Timestamp</span>
          <span class="health-detail-value">${new Date(result.timestamp).toLocaleTimeString()}</span>
        </div>
      `;
    } else {
      details.innerHTML = `
        <div class="health-detail">
          <span class="health-detail-label">Status</span>
          <span class="health-detail-value" style="color: var(--danger);">Unreachable</span>
        </div>
        <div class="health-detail">
          <span class="health-detail-label">Error</span>
          <span class="health-detail-value" style="color: var(--danger);">${result.error}</span>
        </div>
      `;
    }
  }

  const allHealthy = Object.values(state.health).every(h => h.healthy);
  const someHealthy = Object.values(state.health).some(h => h.healthy);
  const statusDot = document.getElementById('overall-status-dot');
  const statusText = document.getElementById('overall-status-text');
  statusDot.className = 'status-dot ' + (allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'down');
  statusText.textContent = allHealthy ? 'All Systems Go' : someHealthy ? 'Degraded' : 'Systems Down';
}

function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function updateTimestamp() {
  document.getElementById('last-updated').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

document.getElementById('btn-refresh').addEventListener('click', () => {
  loadSectionData(state.currentSection);
});

setInterval(() => {
  loadSectionData(state.currentSection);
}, 30000);

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
});
