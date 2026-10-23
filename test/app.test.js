import test from 'node:test';
import assert from 'node:assert/strict';
import { closeDatabase } from '../src/database.js';
import app from '../src/app.js';

test.after(async () => {
  await closeDatabase();
});

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

test('root endpoint serves the LapZone laptop store', () => withServer(async (baseUrl) => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(await response.text(), /LapZone — Laptop cho mọi hành trình/);
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

test('product catalog supports category, search and price filters', () => withServer(async (baseUrl) => {
  const gaming = await fetch(`${baseUrl}/api/products?category=gaming`);
  const gamingData = await gaming.json();
  assert.equal(gaming.status, 200);
  assert.ok(gamingData.items.length >= 2);
  assert.ok(gamingData.items.every((product) => product.category === 'gaming'));

  const filtered = await fetch(`${baseUrl}/api/products?q=zenbook&maxPrice=30000000`);
  const filteredData = await filtered.json();
  assert.equal(filteredData.items.length, 1);
  assert.equal(filteredData.items[0].brand, 'ASUS');
}));

test('catalog offers laptops from a broad range of brands', () => withServer(async (baseUrl) => {
  const response = await fetch(`${baseUrl}/api/products`);
  const { items } = await response.json();
  const brands = new Set(items.map((product) => product.brand));
  for (const brand of ['Acer', 'Apple', 'ASUS', 'Dell', 'Gigabyte', 'HP', 'Huawei', 'Lenovo', 'LG', 'Microsoft', 'MSI', 'Razer', 'Samsung', 'Xiaomi']) {
    assert.ok(brands.has(brand), `expected catalog to include ${brand}`);
  }
  assert.ok(items.length >= 34);
  for (const category of ['student', 'business', 'convertible']) {
    assert.ok(items.some((product) => product.category === category), `expected catalog to include ${category} laptops`);
  }
}));

test('guest can place an order and admin can manage store products and orders', () => withServer(async (baseUrl) => {
  const invalidOrder = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ customerName: 'Test', phone: '123', address: 'Test street', items: [{ id: 1, quantity: 1 }] })
  });
  const orderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ customerName: 'Nguyen Van A', phone: '0912345678', address: '1 Nguyen Hue, Ho Chi Minh City', paymentMethod: 'cod', items: [{ id: 1, quantity: 1 }] })
  });
  const orderData = await orderResponse.json();
  const token = await registerAdmin(baseUrl);
  const authHeaders = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const createProduct = await fetch(`${baseUrl}/api/admin/products`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Laptop Test', brand: 'Test', category: 'office', price: 10000000, stock: 3 })
  });
  const updateOrder = await fetch(`${baseUrl}/api/admin/orders/${orderData.order.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'Đang xử lý' })
  });
  const cancelOrder = await fetch(`${baseUrl}/api/admin/orders/${orderData.order.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'Đã hủy' })
  });
  const restoredProducts = await fetch(`${baseUrl}/api/admin/products`, { headers: { authorization: `Bearer ${token}` } });
  const restoredInventory = (await restoredProducts.json()).items.find((product) => product.id === 1);
  const reopenOrder = await fetch(`${baseUrl}/api/admin/orders/${orderData.order.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'Đang xử lý' })
  });
  const adminOrders = await fetch(`${baseUrl}/api/admin/orders`, { headers: { authorization: `Bearer ${token}` } });
  const orderList = await adminOrders.json();

  assert.equal(invalidOrder.status, 400);
  assert.equal(orderResponse.status, 201);
  assert.equal(orderData.order.total, 27990000);
  assert.equal(createProduct.status, 201);
  assert.equal(updateOrder.status, 200);
  assert.equal(cancelOrder.status, 200);
  assert.equal(restoredInventory.stock, 12);
  assert.equal(reopenOrder.status, 200);
  assert.equal(orderList.items[0].status, 'Đang xử lý');
}));
