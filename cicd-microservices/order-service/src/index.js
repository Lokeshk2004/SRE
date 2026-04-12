const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// In-memory data store
let orders = [
  { id: 1, userId: 1, product: 'Laptop Pro 15', quantity: 1, price: 1299.99, status: 'delivered', createdAt: '2025-01-20T08:00:00Z' },
  { id: 2, userId: 2, product: 'Wireless Mouse', quantity: 2, price: 29.99, status: 'shipped', createdAt: '2025-02-14T12:30:00Z' },
  { id: 3, userId: 1, product: 'USB-C Hub', quantity: 1, price: 49.99, status: 'processing', createdAt: '2025-03-01T15:45:00Z' },
  { id: 4, userId: 3, product: 'Mechanical Keyboard', quantity: 1, price: 149.99, status: 'pending', createdAt: '2025-03-18T10:00:00Z' },
  { id: 5, userId: 5, product: 'Monitor 27"', quantity: 1, price: 399.99, status: 'delivered', createdAt: '2025-04-02T09:20:00Z' },
  { id: 6, userId: 2, product: 'Webcam ', quantity: 1, price: 79.99, status: 'shipped', createdAt: '2025-04-10T14:10:00Z' }
];
let nextId = 7;

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'order-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  const statusCounts = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
  let metrics =
    `# HELP order_service_requests_total Total number of requests\n` +
    `# TYPE order_service_requests_total counter\n` +
    `order_service_requests_total ${requestCount}\n` +
    `# HELP order_service_orders_total Total number of orders in memory\n` +
    `# TYPE order_service_orders_total gauge\n` +
    `order_service_orders_total ${orders.length}\n` +
    `# HELP order_service_uptime_seconds Service uptime in seconds\n` +
    `# TYPE order_service_uptime_seconds gauge\n` +
    `order_service_uptime_seconds ${Math.floor(process.uptime())}\n`;
  for (const [status, count] of Object.entries(statusCounts)) {
    metrics += `# HELP order_service_orders_by_status Orders by status\n`;
    metrics += `# TYPE order_service_orders_by_status gauge\n`;
    metrics += `order_service_orders_by_status{status="${status}"} ${count}\n`;
  }
  res.send(metrics);
});

let requestCount = 0;
app.use((req, res, next) => {
  requestCount++;
  next();
});

// GET all orders
app.get('/', (req, res) => {
  console.log(`[ORDER-SERVICE] GET / — returning ${orders.length} orders`);
  const totalRevenue = orders.reduce((sum, o) => sum + o.price * o.quantity, 0);
  res.json({ success: true, count: orders.length, totalRevenue: totalRevenue.toFixed(2), data: orders });
});

// GET order by ID
app.get('/:id', (req, res) => {
  const order = orders.find(o => o.id === parseInt(req.params.id));
  if (!order) {
    console.log(`[ORDER-SERVICE] GET /${req.params.id} — not found`);
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  console.log(`[ORDER-SERVICE] GET /${req.params.id} — found order for product ${order.product}`);
  res.json({ success: true, data: order });
});

// GET orders by user ID
app.get('/user/:userId', (req, res) => {
  const userOrders = orders.filter(o => o.userId === parseInt(req.params.userId));
  console.log(`[ORDER-SERVICE] GET /user/${req.params.userId} — found ${userOrders.length} orders`);
  res.json({ success: true, count: userOrders.length, data: userOrders });
});

// POST create order
app.post('/', (req, res) => {
  const { userId, product, quantity, price } = req.body;
  if (!userId || !product || !price) {
    return res.status(400).json({ success: false, message: 'userId, product, and price are required' });
  }
  const newOrder = {
    id: nextId++,
    userId,
    product,
    quantity: quantity || 1,
    price,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  orders.push(newOrder);
  console.log(`[ORDER-SERVICE] POST / — created order #${newOrder.id} for product ${newOrder.product}`);
  res.status(201).json({ success: true, data: newOrder });
});

// PUT update order status
app.put('/:id', (req, res) => {
  const index = orders.findIndex(o => o.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  const { status, product, quantity, price } = req.body;
  orders[index] = {
    ...orders[index],
    status: status || orders[index].status,
    product: product || orders[index].product,
    quantity: quantity || orders[index].quantity,
    price: price || orders[index].price
  };
  console.log(`[ORDER-SERVICE] PUT /${req.params.id} — updated order`);
  res.json({ success: true, data: orders[index] });
});

// DELETE order
app.delete('/:id', (req, res) => {
  const index = orders.findIndex(o => o.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  const deleted = orders.splice(index, 1)[0];
  console.log(`[ORDER-SERVICE] DELETE /${req.params.id} — deleted order for ${deleted.product}`);
  res.json({ success: true, data: deleted });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ORDER-SERVICE] Running on port ${PORT}`);
  console.log(`[ORDER-SERVICE] Health check: http://localhost:${PORT}/health`);
  console.log(`[ORDER-SERVICE] Metrics: http://localhost:${PORT}/metrics`);
});
