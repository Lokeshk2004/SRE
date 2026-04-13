const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

let users = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', createdAt: '2025-01-15T10:30:00Z' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'customer', createdAt: '2025-02-20T14:45:00Z' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'customer', createdAt: '2025-03-10T09:15:00Z' },
  { id: 4, name: 'Diana Ross', email: 'diana@example.com', role: 'manager', createdAt: '2025-04-05T16:00:00Z' },
  { id: 5, name: 'Eve Williams', email: 'eve@example.com', role: 'customer', createdAt: '2025-05-12T11:20:00Z' },
  { id: 6, name: 'Ajay Williams', email: 'ajay@example.com', role: 'customer', createdAt: '2025-05-12T11:20:00Z' },
  { id: 7, name: 'Shane Watson', email: 'shane@example.com', role: 'customer', createdAt: '2025-05-13T11:20:00Z' }
];
let nextId = 8;

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(
    `# HELP user_service_requests_total Total number of requests\n` +
    `# TYPE user_service_requests_total counter\n` +
    `user_service_requests_total ${requestCount}\n` +
    `# HELP user_service_users_total Total number of users in memory\n` +
    `# TYPE user_service_users_total gauge\n` +
    `user_service_users_total ${users.length}\n` +
    `# HELP user_service_uptime_seconds Service uptime in seconds\n` +
    `# TYPE user_service_uptime_seconds gauge\n` +
    `user_service_uptime_seconds ${Math.floor(process.uptime())}\n`
  );
});

let requestCount = 0;
app.use((req, res, next) => {
  requestCount++;
  next();
});

app.get('/', (req, res) => {
  console.log(`[USER-SERVICE] GET / — returning ${users.length} users`);
  res.json({ success: true, count: users.length, data: users });
});

app.get('/:id', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  res.json({ success: true, data: user });
});

app.post('/', (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Name and email are required' });
  }
  const newUser = {
    id: nextId++,
    name,
    email,
    role: role || 'customer',
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  console.log(`[USER-SERVICE] POST / — created user ${newUser.name} (id: ${newUser.id})`);
  res.status(201).json({ success: true, data: newUser });
});

app.put('/:id', (req, res) => {
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  const { name, email, role } = req.body;
  users[index] = { ...users[index], name: name || users[index].name, email: email || users[index].email, role: role || users[index].role };
  res.json({ success: true, data: users[index] });
});

app.delete('/:id', (req, res) => {
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  const deleted = users.splice(index, 1)[0];
  res.json({ success: true, data: deleted });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[USER-SERVICE] Running on port ${PORT}`);
});
