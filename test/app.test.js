import test from 'node:test';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { randomBytes, scrypt } from 'node:crypto';
import { closeDatabase, createAdminAccount } from '../src/database.js';
import app from '../src/app.js';

const scryptAsync = promisify(scrypt);

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
  const password = 'Admin-Test-Password-123!';
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(password, salt, 64);
  await createAdminAccount({
    name: 'Admin Tester',
    email: 'admin@testdemo.local',
    passwordHash: `${salt}:${key.toString('hex')}`
  });
  const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@testdemo.local', password }) });
  return (await login.json()).token;
}

test('health endpoint returns ok', () => withServer(async (baseUrl) => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
}));

test('root endpoint serves the Bep Xanh grocery store', () => withServer(async (baseUrl) => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(await response.text(), /Bếp Xanh — Thực phẩm tươi ngon mỗi ngày/);
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

test('grocery catalog supports category, search and price filters', () => withServer(async (baseUrl) => {
  const vegetables = await fetch(`${baseUrl}/api/products?category=vegetables`);
  const vegetablesData = await vegetables.json();
  assert.equal(vegetables.status, 200);
  assert.ok(vegetablesData.items.length >= 2);
  assert.ok(vegetablesData.items.every((product) => product.category === 'vegetables'));

  const filtered = await fetch(`${baseUrl}/api/products?q=cà chua&maxPrice=30000`);
  const filteredData = await filtered.json();
  assert.equal(filteredData.items.length, 1);
  assert.equal(filteredData.items[0].brand, 'Vườn Nhà Mình');
  assert.equal(filteredData.items[0].unit, '1kg');
}));

test('catalog offers a broad selection of fresh foods', () => withServer(async (baseUrl) => {
  const response = await fetch(`${baseUrl}/api/products`);
  const { items } = await response.json();
  assert.ok(items.length >= 34);
  assert.ok(items.every((product) => !/laptop|macbook|zenbook/i.test(product.name)));
  assert.ok(items.every((product) => product.origin && product.unit));
  assert.equal(new Set(items.map((product) => product.image)).size, items.length);
  assert.match(items.find((product) => product.name === 'Cà chua chín cây').image, /pexels-photo-29479888/);
  for (const category of ['vegetables', 'fruits', 'meat', 'seafood', 'dairy', 'pantry']) {
    assert.ok(items.some((product) => product.category === category), `expected catalog to include ${category}`);
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
    body: JSON.stringify({ name: 'Rau cải thử nghiệm', brand: 'Vườn thử nghiệm', category: 'vegetables', price: 15000, stock: 3, unit: '500g', origin: 'Đà Lạt' })
  });
  const invalidProduct = await fetch(`${baseUrl}/api/admin/products`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Unsupported test item', brand: 'Test', category: 'gaming', price: 10000000, stock: 3 })
  });
  const createdProductData = await createProduct.json();
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
  assert.equal(orderData.order.total, 18000);
  assert.equal(createProduct.status, 201);
  assert.equal(createdProductData.product.unit, '500g');
  assert.equal(createdProductData.product.origin, 'Đà Lạt');
  assert.equal(invalidProduct.status, 400);
  assert.equal(updateOrder.status, 200);
  assert.equal(cancelOrder.status, 200);
  assert.equal(restoredInventory.stock, 42);
  assert.equal(reopenOrder.status, 200);
  assert.equal(orderList.items[0].status, 'Đang xử lý');
}));

test('customers can view only their own order history and choose bank transfer', () => withServer(async (baseUrl) => {
  const register = async (email) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Order Customer', email, password: 'Password123!' })
    });
    return (await response.json()).token;
  };
  const firstToken = await register(`orders-first-${Date.now()}@example.com`);
  const secondToken = await register(`orders-second-${Date.now()}@example.com`);
  const placed = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${firstToken}` },
    body: JSON.stringify({
      customerName: 'Order Customer',
      phone: '0912345678',
      address: '1 Nguyen Hue, Ho Chi Minh City',
      paymentMethod: 'bank-transfer',
      items: [{ id: 1, quantity: 1 }]
    })
  });
  const orderData = await placed.json();
  const firstHistory = await fetch(`${baseUrl}/api/orders`, { headers: { authorization: `Bearer ${firstToken}` } });
  const secondHistory = await fetch(`${baseUrl}/api/orders`, { headers: { authorization: `Bearer ${secondToken}` } });
  const guestHistory = await fetch(`${baseUrl}/api/orders`);

  assert.equal(placed.status, 201);
  assert.equal(orderData.order.paymentMethod, 'bank-transfer');
  assert.equal(firstHistory.status, 200);
  assert.equal((await firstHistory.json()).items[0].id, orderData.order.id);
  assert.deepEqual((await secondHistory.json()).items, []);
  assert.equal(guestHistory.status, 401);
}));

test('customer accounts have profiles and welcome benefits while admins can search customers and update payment', () => withServer(async (baseUrl) => {
  const suffix = Date.now();
  const email = `account-${suffix}@example.com`;
  const registered = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Account Customer', email, password: 'Password123!' })
  });
  const account = await registered.json();
  const customerHeaders = { authorization: `Bearer ${account.token}`, 'content-type': 'application/json' };
  const profileResponse = await fetch(`${baseUrl}/api/account/profile`, { headers: customerHeaders });
  const updatedProfile = await fetch(`${baseUrl}/api/account/profile`, {
    method: 'PATCH',
    headers: customerHeaders,
    body: JSON.stringify({
      name: 'Updated Customer',
      phone: '0912345678',
      address: '12 Fresh Street',
      latitude: 10.7716,
      longitude: 106.7044
    })
  });
  const benefitsResponse = await fetch(`${baseUrl}/api/account/benefits`, { headers: customerHeaders });
  const benefits = await benefitsResponse.json();
  const markedNotification = await fetch(`${baseUrl}/api/account/notifications/${benefits.notifications[0].id}/read`, {
    method: 'PATCH',
    headers: customerHeaders
  });
  const adminToken = await registerAdmin(baseUrl);
  const adminHeaders = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
  const customersResponse = await fetch(`${baseUrl}/api/admin/customers?q=${encodeURIComponent(email)}`, { headers: adminHeaders });
  const customers = await customersResponse.json();
  const forbidden = await fetch(`${baseUrl}/api/admin/customers`, { headers: customerHeaders });
  const placed = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: customerHeaders,
    body: JSON.stringify({
      customerName: 'Updated Customer',
      phone: '0912345678',
      address: '12 Fresh Street',
      paymentMethod: 'bank-transfer',
      items: [{ id: 1, quantity: 1 }]
    })
  });
  const order = await placed.json();
  const paymentUpdate = await fetch(`${baseUrl}/api/admin/orders/${order.order.id}/payment`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ paymentStatus: 'Đã thanh toán' })
  });
  const invalidPaymentUpdate = await fetch(`${baseUrl}/api/admin/orders/${order.order.id}/payment`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ paymentStatus: 'unknown' })
  });
  const orderHistory = await fetch(`${baseUrl}/api/orders`, { headers: customerHeaders });

  assert.equal(registered.status, 201);
  assert.equal(account.user.role, 'user');
  assert.equal(profileResponse.status, 200);
  assert.equal(updatedProfile.status, 200);
  const updatedProfileData = await updatedProfile.json();
  assert.equal(updatedProfileData.profile.phone, '0912345678');
  assert.equal(updatedProfileData.profile.latitude, 10.7716);
  assert.equal(updatedProfileData.profile.longitude, 106.7044);
  assert.equal(benefitsResponse.status, 200);
  assert.equal(benefits.vouchers[0].code, 'BEPXANH10');
  assert.equal(benefits.notifications.length, 1);
  assert.equal(markedNotification.status, 204);
  assert.equal(customers.items[0].email, email);
  assert.equal('passwordHash' in customers.items[0], false);
  assert.equal(forbidden.status, 403);
  assert.equal(paymentUpdate.status, 200);
  assert.equal((await paymentUpdate.json()).order.paymentStatus, 'Đã thanh toán');
  assert.equal(invalidPaymentUpdate.status, 400);
  assert.equal((await orderHistory.json()).items[0].paymentStatus, 'Đã thanh toán');
  const invalidCoordinates = await fetch(`${baseUrl}/api/account/profile`, {
    method: 'PATCH',
    headers: customerHeaders,
    body: JSON.stringify({ name: 'Updated Customer', phone: '', address: '12 Fresh Street', latitude: 91, longitude: 106 })
  });
  assert.equal(invalidCoordinates.status, 400);
}));
