const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// In-memory data store
let payments = [
  { id: 1, orderId: 1, userId: 1, amount: 1299.99, method: 'credit_card', status: 'completed', transactionId: 'TXN-20250120-001', createdAt: '2025-01-20T08:05:00Z' },
  { id: 2, orderId: 2, userId: 2, amount: 59.98, method: 'paypal', status: 'completed', transactionId: 'TXN-20250214-002', createdAt: '2025-02-14T12:35:00Z' },
  { id: 3, orderId: 3, userId: 1, amount: 49.99, method: 'debit_card', status: 'pending', transactionId: 'TXN-20250301-003', createdAt: '2025-03-01T15:50:00Z' },
  { id: 4, orderId: 5, userId: 5, amount: 399.99, method: 'credit_card', status: 'completed', transactionId: 'TXN-20250402-004', createdAt: '2025-04-02T09:25:00Z' },
  { id: 5, orderId: 6, userId: 2, amount: 79.99, method: 'bank_transfer', status: 'processing', transactionId: 'TXN-20250410-005', createdAt: '2025-04-10T14:15:00Z' }
];
let nextId = 6;

// Helper to generate transaction ID
function generateTransactionId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `TXN-${dateStr}-${random}`;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'payment-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
  const statusCounts = payments.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});
  let metrics =
    `# HELP payment_service_requests_total Total number of requests\n` +
    `# TYPE payment_service_requests_total counter\n` +
    `payment_service_requests_total ${requestCount}\n` +
    `# HELP payment_service_payments_total Total number of payments in memory\n` +
    `# TYPE payment_service_payments_total gauge\n` +
    `payment_service_payments_total ${payments.length}\n` +
    `# HELP payment_service_revenue_total Total completed payment revenue\n` +
    `# TYPE payment_service_revenue_total gauge\n` +
    `payment_service_revenue_total ${totalRevenue.toFixed(2)}\n` +
    `# HELP payment_service_uptime_seconds Service uptime in seconds\n` +
    `# TYPE payment_service_uptime_seconds gauge\n` +
    `payment_service_uptime_seconds ${Math.floor(process.uptime())}\n`;
  for (const [status, count] of Object.entries(statusCounts)) {
    metrics += `payment_service_payments_by_status{status="${status}"} ${count}\n`;
  }
  res.send(metrics);
});

let requestCount = 0;
app.use((req, res, next) => {
  requestCount++;
  next();
});

// GET all payments
app.get('/', (req, res) => {
  console.log(`[PAYMENT-SERVICE] GET / — returning ${payments.length} payments`);
  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
  res.json({ success: true, count: payments.length, totalRevenue: totalRevenue.toFixed(2), data: payments });
});

// GET payment by ID
app.get('/:id', (req, res) => {
  const payment = payments.find(p => p.id === parseInt(req.params.id));
  if (!payment) {
    console.log(`[PAYMENT-SERVICE] GET /${req.params.id} — not found`);
    return res.status(404).json({ success: false, message: 'Payment not found' });
  }
  console.log(`[PAYMENT-SERVICE] GET /${req.params.id} — found payment ${payment.transactionId}`);
  res.json({ success: true, data: payment });
});

// GET payments by order ID
app.get('/order/:orderId', (req, res) => {
  const orderPayments = payments.filter(p => p.orderId === parseInt(req.params.orderId));
  console.log(`[PAYMENT-SERVICE] GET /order/${req.params.orderId} — found ${orderPayments.length} payments`);
  res.json({ success: true, count: orderPayments.length, data: orderPayments });
});

// POST create payment
app.post('/', (req, res) => {
  const { orderId, userId, amount, method } = req.body;
  if (!orderId || !userId || !amount) {
    return res.status(400).json({ success: false, message: 'orderId, userId, and amount are required' });
  }
  const validMethods = ['credit_card', 'debit_card', 'paypal', 'bank_transfer'];
  const paymentMethod = validMethods.includes(method) ? method : 'credit_card';
  const newPayment = {
    id: nextId++,
    orderId,
    userId,
    amount,
    method: paymentMethod,
    status: 'pending',
    transactionId: generateTransactionId(),
    createdAt: new Date().toISOString()
  };
  payments.push(newPayment);
  console.log(`[PAYMENT-SERVICE] POST / — created payment ${newPayment.transactionId} for $${amount}`);
  res.status(201).json({ success: true, data: newPayment });
});

// PUT update payment status
app.put('/:id', (req, res) => {
  const index = payments.findIndex(p => p.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Payment not found' });
  }
  const { status } = req.body;
  const validStatuses = ['pending', 'processing', 'completed', 'failed', 'refunded'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}` });
  }
  payments[index] = { ...payments[index], status: status || payments[index].status };
  console.log(`[PAYMENT-SERVICE] PUT /${req.params.id} — updated payment status to ${payments[index].status}`);
  res.json({ success: true, data: payments[index] });
});

// DELETE payment
app.delete('/:id', (req, res) => {
  const index = payments.findIndex(p => p.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Payment not found' });
  }
  const deleted = payments.splice(index, 1)[0];
  console.log(`[PAYMENT-SERVICE] DELETE /${req.params.id} — deleted payment ${deleted.transactionId}`);
  res.json({ success: true, data: deleted });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[PAYMENT-SERVICE] Running on port ${PORT}`);
  console.log(`[PAYMENT-SERVICE] Health check: http://localhost:${PORT}/health`);
  console.log(`[PAYMENT-SERVICE] Metrics: http://localhost:${PORT}/metrics`);
});
