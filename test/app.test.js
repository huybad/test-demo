import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

async function withServer(callback) {
  const server = app.listen(0);
  const { port } = server.address();
  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function registerAdmin(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Admin Tester', email: 'admin@testdemo.local', password: 'Admin123!' })
  });
  if (response.status === 201) return (await response.json()).token;
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@testdemo.local', password: 'Admin123!' }) });
  return (await login.json()).token;
}

test('health endpoint returns ok', () => withServer(async (baseUrl) => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
}));

test('root endpoint serves the dashboard', () => withServer(async (baseUrl) => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(await response.text(), /TestDemo Deploy Console/);
}));

test('admin page and overview endpoint are available', () => withServer(async (baseUrl) => {
  const page = await fetch(`${baseUrl}/admin`);
  const token = await registerAdmin(baseUrl);
  const overview = await fetch(`${baseUrl}/api/admin/overview`, { headers: { authorization: `Bearer ${token}` } });

  assert.equal(page.status, 200);
  assert.match(await page.text(), /Control room/);
  assert.equal(overview.status, 200);
  assert.equal((await overview.json()).environment, 'production');
}));

test('admin can queue a deployment and reject invalid environments', () => withServer(async (baseUrl) => {
  const token = await registerAdmin(baseUrl);
  const created = await fetch(`${baseUrl}/api/admin/deployments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ release: 'v-test', commit: 'abc1234', environment: 'staging', author: 'Test User' })
  });
  const invalid = await fetch(`${baseUrl}/api/admin/deployments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ environment: 'localhost' })
  });

  assert.equal(created.status, 201);
  assert.equal((await created.json()).status, 'queued');
  assert.equal(invalid.status, 400);
}));

test('auth supports registration, login, me and logout', () => withServer(async (baseUrl) => {
  const email = `user-${Date.now()}@example.com`;
  const registered = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Regular User', email, password: 'Password123!' }) });
  const registeredData = await registered.json();
  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { authorization: `Bearer ${registeredData.token}` } });
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) });
  const loginData = await login.json();
  const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${loginData.token}` } });
  const afterLogout = await fetch(`${baseUrl}/api/auth/me`, { headers: { authorization: `Bearer ${loginData.token}` } });

  assert.equal(registered.status, 201);
  assert.equal((await me.json()).user.role, 'user');
  assert.equal(login.status, 200);
  assert.equal(logout.status, 204);
  assert.equal(afterLogout.status, 401);
}));
