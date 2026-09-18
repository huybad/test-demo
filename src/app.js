import express from 'express';
import { promisify } from 'node:util';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const publicDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const scryptAsync = promisify(scrypt);
const users = [];
const sessions = new Map();
const deployments = [
  { id: 1, release: 'v2.4.1', environment: 'production', commit: '8f3a2c1', author: 'Huy Tran', status: 'deployed', createdAt: 'Today, 09:41' },
  { id: 2, release: 'v2.4.0', environment: 'staging', commit: '1b9de44', author: 'Alex Morgan', status: 'deployed', createdAt: 'Yesterday, 16:20' },
  { id: 3, release: 'v2.3.9', environment: 'production', commit: 'ae412c8', author: 'Linh Nguyen', status: 'failed', createdAt: 'Sep 02, 11:05' }
];
const logs = [
  '[09:42:04] deploy: verifying production health checks',
  '[09:41:48] deploy: container duan2-ci-cd started',
  '[09:41:31] test: 2 tests passed in 440ms',
  '[09:40:12] build: image ghcr.io/duan2:8f3a2c1 pushed'
];

app.disable('x-powered-by');
app.use(express.json());
app.use(express.static(publicDirectory));

app.get('/', (_request, response) => {
  response.sendFile(path.join(publicDirectory, 'index.html'));
});

app.get('/admin', (_request, response) => {
  response.sendFile(path.join(publicDirectory, 'admin.html'));
});

app.get('/auth', (_request, response) => {
  response.sendFile(path.join(publicDirectory, 'auth.html'));
});

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedPassword) {
  const [salt, storedKey] = storedPassword.split(':');
  const derivedKey = await scryptAsync(password, salt, 64);
  const storedBuffer = Buffer.from(storedKey, 'hex');
  return storedBuffer.length === derivedKey.length && timingSafeEqual(storedBuffer, derivedKey);
}

function createSession(user) {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  return token;
}

function getSessionUser(request) {
  const authorization = request.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return users.find((user) => user.id === session.userId) ?? null;
}

function requireAuth(request, response, next) {
  const user = getSessionUser(request);
  if (!user) return response.status(401).json({ error: 'authentication required' });
  request.user = user;
  return next();
}

function requireAdmin(request, response, next) {
  if (request.user.role !== 'admin') return response.status(403).json({ error: 'admin access required' });
  return next();
}

app.post('/api/auth/register', async (request, response) => {
  const { name = '', email = '', password = '' } = request.body ?? {};
  const normalizedEmail = email.trim().toLowerCase();
  if (!name.trim() || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || password.length < 8) {
    return response.status(400).json({ error: 'name, valid email and password of at least 8 characters are required' });
  }
  if (users.some((user) => user.email === normalizedEmail)) {
    return response.status(409).json({ error: 'email is already registered' });
  }
  const user = { id: users.length + 1, name: name.trim(), email: normalizedEmail, role: normalizedEmail === 'admin@duan2.local' ? 'admin' : 'user', passwordHash: await hashPassword(password) };
  users.push(user);
  const token = createSession(user);
  return response.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/auth/login', async (request, response) => {
  const { email = '', password = '' } = request.body ?? {};
  const user = users.find((item) => item.email === email.trim().toLowerCase());
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return response.status(401).json({ error: 'email or password is incorrect' });
  }
  const token = createSession(user);
  return response.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/api/auth/me', requireAuth, (request, response) => {
  const { id, name, email, role } = request.user;
  response.json({ user: { id, name, email, role } });
});

app.post('/api/auth/logout', requireAuth, (request, response) => {
  const token = request.get('authorization')?.slice(7);
  sessions.delete(token);
  response.status(204).end();
});

app.get('/api/admin/overview', requireAuth, requireAdmin, (_request, response) => {
  const deployed = deployments.filter((deployment) => deployment.status === 'deployed').length;
  response.json({
    service: 'duan2-ci-cd',
    environment: 'production',
    uptime: '99.98%',
    deployments: deployments.length,
    successRate: `${Math.round((deployed / deployments.length) * 100)}%`,
    activeBranches: 7,
    lastRelease: deployments[0]
  });
});

app.get('/api/admin/deployments', requireAuth, requireAdmin, (_request, response) => {
  response.json({ items: deployments });
});

app.get('/api/admin/logs', requireAuth, requireAdmin, (_request, response) => {
  response.json({ items: logs });
});

app.post('/api/admin/deployments', requireAuth, requireAdmin, (request, response) => {
  const { environment = 'staging', release = 'next', commit = 'local', author = 'Admin' } = request.body ?? {};
  if (!['staging', 'production'].includes(environment)) {
    return response.status(400).json({ error: 'environment must be staging or production' });
  }

  const deployment = {
    id: deployments.length + 1,
    release,
    environment,
    commit,
    author,
    status: 'queued',
    createdAt: 'Just now'
  };
  deployments.unshift(deployment);
  logs.unshift(`[now] deploy: ${release} queued for ${environment}`);
  return response.status(201).json(deployment);
});

app.post('/api/admin/deployments/:id/rollback', requireAuth, requireAdmin, (request, response) => {
  const deployment = deployments.find((item) => item.id === Number(request.params.id));
  if (!deployment) {
    return response.status(404).json({ error: 'deployment not found' });
  }

  deployment.status = 'rollback queued';
  logs.unshift(`[now] rollback: ${deployment.release} queued by Admin`);
  return response.json(deployment);
});

export default app;
