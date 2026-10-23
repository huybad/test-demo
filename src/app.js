import express from 'express';
import { promisify } from 'node:util';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createOrder,
  createProduct,
  createSession,
  createUser,
  deleteSession,
  findProduct,
  findUserByEmail,
  getProducts,
  getSessionUser,
  initializeDatabase,
  listOrders,
  listProducts,
  updateOrderStatus,
  updateProduct
} from './database.js';

const app = express();
const publicDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const scryptAsync = promisify(scrypt);
const deployments = [
  { id: 1, release: 'v2.4.1', environment: 'production', commit: '8f3a2c1', author: 'Huy Tran', status: 'deployed', createdAt: 'Today, 09:41' },
  { id: 2, release: 'v2.4.0', environment: 'staging', commit: '1b9de44', author: 'Alex Morgan', status: 'deployed', createdAt: 'Yesterday, 16:20' },
  { id: 3, release: 'v2.3.9', environment: 'production', commit: 'ae412c8', author: 'Linh Nguyen', status: 'failed', createdAt: 'Sep 02, 11:05' }
];
const products = [
  { id: 1, name: 'MacBook Air 13 M3', brand: 'Apple', category: 'thin', price: 27990000, originalPrice: 29990000, processor: 'Apple M3', memory: '16GB', storage: '512GB SSD', display: '13.6 inch', stock: 12, badge: 'Bán chạy', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80' },
  { id: 2, name: 'ASUS Vivobook 15 OLED', brand: 'ASUS', category: 'office', price: 16990000, originalPrice: 18990000, processor: 'Intel Core i5', memory: '16GB', storage: '512GB SSD', display: '15.6 inch OLED', stock: 18, badge: 'Giảm 2 triệu', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80' },
  { id: 3, name: 'Dell Inspiron 14 Plus', brand: 'Dell', category: 'office', price: 21990000, originalPrice: 23990000, processor: 'Intel Core Ultra 5', memory: '16GB', storage: '512GB SSD', display: '14 inch 2.2K', stock: 9, badge: 'Mới về', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=900&q=80' },
  { id: 4, name: 'Lenovo LOQ 15IRX9', brand: 'Lenovo', category: 'gaming', price: 24990000, originalPrice: 26990000, processor: 'Intel Core i7', memory: '16GB', storage: '512GB SSD', display: '15.6 inch 144Hz', stock: 7, badge: 'Gaming', image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=900&q=80' },
  { id: 5, name: 'HP Pavilion Aero 13', brand: 'HP', category: 'thin', price: 18490000, originalPrice: 19990000, processor: 'AMD Ryzen 7', memory: '16GB', storage: '512GB SSD', display: '13.3 inch WUXGA', stock: 14, badge: 'Mỏng nhẹ', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=900&q=80' },
  { id: 6, name: 'MSI Katana 15 B13V', brand: 'MSI', category: 'gaming', price: 32990000, originalPrice: 35990000, processor: 'Intel Core i7', memory: '16GB', storage: '1TB SSD', display: '15.6 inch 144Hz', stock: 5, badge: 'RTX 4060', image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=900&q=80' },
  { id: 7, name: 'MacBook Pro 14 M3', brand: 'Apple', category: 'creator', price: 42990000, originalPrice: 45990000, processor: 'Apple M3', memory: '18GB', storage: '512GB SSD', display: '14.2 inch Liquid Retina', stock: 4, badge: 'Đồ họa chuyên nghiệp', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80' },
  { id: 8, name: 'ASUS Zenbook 14 OLED', brand: 'ASUS', category: 'creator', price: 28990000, originalPrice: 30990000, processor: 'Intel Core Ultra 7', memory: '16GB', storage: '1TB SSD', display: '14 inch 2.8K OLED', stock: 8, badge: 'OLED 2.8K', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80' },
  { id: 9, name: 'Acer Aspire 5 A515', brand: 'Acer', category: 'office', price: 14990000, originalPrice: 16490000, processor: 'Intel Core i5', memory: '16GB', storage: '512GB SSD', display: '15.6 inch FHD', stock: 11, badge: 'Văn phòng', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=900&q=80' },
  { id: 10, name: 'Acer Nitro V 15', brand: 'Acer', category: 'gaming', price: 23990000, originalPrice: 25990000, processor: 'Intel Core i7 · RTX 4050', memory: '16GB', storage: '512GB SSD', display: '15.6 inch 165Hz', stock: 6, badge: 'RTX 4050', image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=900&q=80' },
  { id: 11, name: 'Gigabyte G6X 9KG', brand: 'Gigabyte', category: 'gaming', price: 31990000, originalPrice: 34990000, processor: 'Intel Core i7 · RTX 4060', memory: '16GB', storage: '1TB SSD', display: '16 inch 165Hz', stock: 4, badge: 'Gaming mạnh mẽ', image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=900&q=80' },
  { id: 12, name: 'Samsung Galaxy Book4', brand: 'Samsung', category: 'thin', price: 22990000, originalPrice: 24990000, processor: 'Intel Core 7', memory: '16GB', storage: '512GB SSD', display: '15.6 inch AMOLED', stock: 7, badge: 'AMOLED', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80' },
  { id: 13, name: 'Huawei MateBook D 16', brand: 'Huawei', category: 'office', price: 17990000, originalPrice: 19490000, processor: 'Intel Core i5', memory: '16GB', storage: '512GB SSD', display: '16 inch IPS', stock: 10, badge: 'Màn hình lớn', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=900&q=80' },
  { id: 14, name: 'LG gram 14 2-in-1', brand: 'LG', category: 'thin', price: 32990000, originalPrice: 35990000, processor: 'Intel Core Ultra 5', memory: '16GB', storage: '512GB SSD', display: '14 inch cảm ứng', stock: 3, badge: 'Siêu nhẹ', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80' },
  { id: 15, name: 'Xiaomi RedmiBook Pro 15', brand: 'Xiaomi', category: 'creator', price: 21990000, originalPrice: 23990000, processor: 'AMD Ryzen 7', memory: '16GB', storage: '512GB SSD', display: '15.6 inch 3.2K', stock: 8, badge: 'Màn hình 3.2K', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80' },
  { id: 16, name: 'Razer Blade 14', brand: 'Razer', category: 'gaming', price: 59990000, originalPrice: 64990000, processor: 'AMD Ryzen 9 · RTX 4070', memory: '32GB', storage: '1TB SSD', display: '14 inch QHD+ 240Hz', stock: 2, badge: 'Gaming cao cấp', image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=900&q=80' },
  { id: 17, name: 'Lenovo IdeaPad Slim 3', brand: 'Lenovo', category: 'student', price: 12990000, originalPrice: 14490000, processor: 'AMD Ryzen 5', memory: '16GB', storage: '512GB SSD', display: '15.6 inch FHD', stock: 15, badge: 'Sinh viên · Giá tốt', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=900&q=80' },
  { id: 18, name: 'HP 15s Ryzen 5', brand: 'HP', category: 'student', price: 13990000, originalPrice: 15490000, processor: 'AMD Ryzen 5', memory: '16GB', storage: '512GB SSD', display: '15.6 inch FHD', stock: 13, badge: 'Học tập', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80' },
  { id: 19, name: 'ASUS Vivobook Go 14', brand: 'ASUS', category: 'student', price: 11990000, originalPrice: 12990000, processor: 'AMD Ryzen 5', memory: '16GB', storage: '512GB SSD', display: '14 inch FHD', stock: 10, badge: 'Gọn nhẹ · Học tập', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=900&q=80' },
  { id: 20, name: 'Acer Aspire Lite 14', brand: 'Acer', category: 'student', price: 10990000, originalPrice: 11990000, processor: 'Intel Core i3', memory: '8GB', storage: '512GB SSD', display: '14 inch FHD', stock: 9, badge: 'Phổ thông', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80' },
  { id: 21, name: 'Dell Vostro 14 3430', brand: 'Dell', category: 'business', price: 18990000, originalPrice: 20490000, processor: 'Intel Core i5', memory: '16GB', storage: '512GB SSD', display: '14 inch FHD', stock: 7, badge: 'Doanh nghiệp', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=900&q=80' },
  { id: 22, name: 'Lenovo ThinkPad E14 Gen 6', brand: 'Lenovo', category: 'business', price: 23990000, originalPrice: 25990000, processor: 'Intel Core Ultra 5', memory: '16GB', storage: '512GB SSD', display: '14 inch WUXGA', stock: 5, badge: 'Bàn phím ThinkPad', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80' },
  { id: 23, name: 'HP ProBook 440 G11', brand: 'HP', category: 'business', price: 24990000, originalPrice: 26990000, processor: 'Intel Core Ultra 5', memory: '16GB', storage: '512GB SSD', display: '14 inch WUXGA', stock: 4, badge: 'Bảo mật doanh nghiệp', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=900&q=80' },
  { id: 24, name: 'ASUS ExpertBook B1', brand: 'ASUS', category: 'business', price: 17990000, originalPrice: 19490000, processor: 'Intel Core i5', memory: '16GB', storage: '512GB SSD', display: '15.6 inch FHD', stock: 6, badge: 'Văn phòng chuyên nghiệp', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80' },
  { id: 25, name: 'ASUS TUF Gaming A15', brand: 'ASUS', category: 'gaming', price: 27990000, originalPrice: 29990000, processor: 'AMD Ryzen 7 · RTX 4060', memory: '16GB', storage: '512GB SSD', display: '15.6 inch 144Hz', stock: 5, badge: 'RTX 4060', image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=900&q=80' },
  { id: 26, name: 'Lenovo Legion Slim 5', brand: 'Lenovo', category: 'gaming', price: 36990000, originalPrice: 39990000, processor: 'AMD Ryzen 7 · RTX 4060', memory: '16GB', storage: '1TB SSD', display: '16 inch 165Hz', stock: 3, badge: 'Gaming hiệu năng cao', image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=900&q=80' },
  { id: 27, name: 'HP Victus 16', brand: 'HP', category: 'gaming', price: 26990000, originalPrice: 28990000, processor: 'Intel Core i7 · RTX 4050', memory: '16GB', storage: '512GB SSD', display: '16.1 inch 144Hz', stock: 5, badge: 'Gaming đa dụng', image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=900&q=80' },
  { id: 28, name: 'MSI Cyborg 15', brand: 'MSI', category: 'gaming', price: 22990000, originalPrice: 24990000, processor: 'Intel Core i7 · RTX 4050', memory: '16GB', storage: '512GB SSD', display: '15.6 inch 144Hz', stock: 6, badge: 'Gaming mỏng nhẹ', image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=900&q=80' },
  { id: 29, name: 'Acer Predator Helios Neo 16', brand: 'Acer', category: 'gaming', price: 38990000, originalPrice: 41990000, processor: 'Intel Core i7 · RTX 4070', memory: '16GB', storage: '1TB SSD', display: '16 inch 165Hz', stock: 3, badge: 'Predator · RTX 4070', image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=900&q=80' },
  { id: 30, name: 'Lenovo Yoga 7 2-in-1', brand: 'Lenovo', category: 'convertible', price: 27990000, originalPrice: 29990000, processor: 'AMD Ryzen 7', memory: '16GB', storage: '1TB SSD', display: '14 inch cảm ứng OLED', stock: 4, badge: 'Xoay gập 360°', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80' },
  { id: 31, name: 'ASUS Vivobook S 14 Flip', brand: 'ASUS', category: 'convertible', price: 21990000, originalPrice: 23990000, processor: 'Intel Core i5', memory: '16GB', storage: '512GB SSD', display: '14 inch cảm ứng OLED', stock: 4, badge: 'Màn hình cảm ứng', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=900&q=80' },
  { id: 32, name: 'Microsoft Surface Laptop 7', brand: 'Microsoft', category: 'thin', price: 34990000, originalPrice: 37990000, processor: 'Snapdragon X Plus', memory: '16GB', storage: '512GB SSD', display: '13.8 inch PixelSense', stock: 3, badge: 'Copilot+ PC', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80' },
  { id: 33, name: 'Microsoft Surface Pro 11', brand: 'Microsoft', category: 'convertible', price: 31990000, originalPrice: 34990000, processor: 'Snapdragon X Plus', memory: '16GB', storage: '512GB SSD', display: '13 inch cảm ứng OLED', stock: 2, badge: 'Tablet 2-in-1', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80' },
  { id: 34, name: 'Dell XPS 14', brand: 'Dell', category: 'creator', price: 52990000, originalPrice: 56990000, processor: 'Intel Core Ultra 7', memory: '32GB', storage: '1TB SSD', display: '14.5 inch OLED', stock: 2, badge: 'Cao cấp · Sáng tạo', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80' }
];
const logs = [
  '[09:42:04] deploy: verifying production health checks',
  '[09:41:48] deploy: container testdemo-ci-cd started',
  '[09:41:31] test: 2 tests passed in 440ms',
  '[09:40:12] build: image ghcr.io/testdemo:8f3a2c1 pushed'
];

await initializeDatabase(products);

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

app.get('/api/products', async (request, response) => {
  const items = await getProducts(request.query);
  response.json({ items });
});

app.post('/api/orders', async (request, response) => {
  const { customerName = '', phone = '', address = '', paymentMethod = 'cod', items: requestedItems = [] } = request.body ?? {};
  if (typeof customerName !== 'string' || !customerName.trim() || customerName.length > 100
    || typeof phone !== 'string' || !/^[0-9+() .-]{9,20}$/.test(phone.trim())
    || typeof address !== 'string' || !address.trim() || address.length > 300
    || !['cod', 'bank-transfer'].includes(paymentMethod)
    || !Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 20) {
    return response.status(400).json({ error: 'Thông tin nhận hàng hoặc sản phẩm không hợp lệ.' });
  }

  const quantities = new Map();
  for (const item of requestedItems) {
    if (!Number.isSafeInteger(item?.id) || !Number.isSafeInteger(item?.quantity) || item.quantity < 1 || item.quantity > 10) {
      return response.status(400).json({ error: 'Số lượng sản phẩm không hợp lệ.' });
    }
    quantities.set(item.id, (quantities.get(item.id) ?? 0) + item.quantity);
  }
  const orderItems = [];
  for (const [id, quantity] of quantities) {
    const product = await findProduct(id);
    if (!product) return response.status(400).json({ error: 'Một sản phẩm trong giỏ hàng không còn tồn tại.' });
    orderItems.push({ id: product.id, quantity });
  }
  const result = await createOrder({
    customerName: customerName.trim(),
    phone: phone.trim(),
    address: address.trim(),
    paymentMethod
  }, orderItems);
  if (result.error) return response.status(result.status).json({ error: result.error });
  const { order } = result;
  logs.unshift(`[now] order: #${order.id} received (${order.items.length} product types)`);
  return response.status(201).json({ order: { id: order.id, total: order.total, status: order.status } });
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

async function createAuthSession(user) {
  const token = randomBytes(32).toString('hex');
  await createSession(token, user.id);
  return token;
}

async function getAuthenticatedUser(request) {
  const authorization = request.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  return token ? getSessionUser(token) : null;
}

async function requireAuth(request, response, next) {
  const user = await getAuthenticatedUser(request);
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
  const user = await createUser({
    name: name.trim(),
    email: normalizedEmail,
    role: process.env.NODE_ENV !== 'production' && normalizedEmail === 'admin@testdemo.local' ? 'admin' : 'user',
    passwordHash: await hashPassword(password)
  });
  if (!user) return response.status(409).json({ error: 'email is already registered' });
  const token = await createAuthSession(user);
  return response.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/auth/login', async (request, response) => {
  const { email = '', password = '' } = request.body ?? {};
  const user = await findUserByEmail(email.trim().toLowerCase());
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return response.status(401).json({ error: 'email or password is incorrect' });
  }
  const token = await createAuthSession(user);
  return response.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/api/auth/me', requireAuth, (request, response) => {
  const { id, name, email, role } = request.user;
  response.json({ user: { id, name, email, role } });
});

app.post('/api/auth/logout', requireAuth, async (request, response) => {
  const token = request.get('authorization')?.slice(7);
  await deleteSession(token);
  response.status(204).end();
});

app.get('/api/admin/overview', requireAuth, requireAdmin, (_request, response) => {
  const deployed = deployments.filter((deployment) => deployment.status === 'deployed').length;
  response.json({
    service: 'testdemo-ci-cd',
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

app.get('/api/admin/products', requireAuth, requireAdmin, async (_request, response) => {
  response.json({ items: await listProducts() });
});

app.post('/api/admin/products', requireAuth, requireAdmin, async (request, response) => {
  const { name = '', brand = '', category = '', price, originalPrice, processor = '', memory = '', storage = '', display = '', stock, image = '', badge = '' } = request.body ?? {};
  if (typeof name !== 'string' || !name.trim() || name.length > 120
    || typeof brand !== 'string' || !brand.trim() || brand.length > 50
    || !['office', 'gaming', 'thin', 'creator', 'student', 'business', 'convertible'].includes(category)
    || !Number.isSafeInteger(price) || price < 1
    || (originalPrice !== undefined && (!Number.isSafeInteger(originalPrice) || originalPrice < price))
    || !Number.isSafeInteger(stock) || stock < 0 || stock > 10000
    || ![processor, memory, storage, display, image, badge].every((field) => typeof field === 'string' && field.length <= 500)) {
    return response.status(400).json({ error: 'Thông tin sản phẩm không hợp lệ.' });
  }
  const product = await createProduct({ name: name.trim(), brand: brand.trim(), category, price, originalPrice: originalPrice ?? price, processor, memory, storage, display, stock, image, badge });
  logs.unshift(`[now] inventory: ${product.name} added by admin`);
  return response.status(201).json({ product });
});

app.patch('/api/admin/products/:id', requireAuth, requireAdmin, async (request, response) => {
  const { stock, price } = request.body ?? {};
  if ((stock !== undefined && (!Number.isSafeInteger(stock) || stock < 0 || stock > 10000))
    || (price !== undefined && (!Number.isSafeInteger(price) || price < 1))) {
    return response.status(400).json({ error: 'Giá hoặc số lượng tồn kho không hợp lệ.' });
  }
  const product = await updateProduct(Number(request.params.id), { stock, price });
  if (!product) return response.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
  logs.unshift(`[now] inventory: ${product.name} updated by admin`);
  return response.json({ product });
});

app.get('/api/admin/orders', requireAuth, requireAdmin, async (_request, response) => {
  response.json({ items: await listOrders() });
});

app.patch('/api/admin/orders/:id', requireAuth, requireAdmin, async (request, response) => {
  const { status } = request.body ?? {};
  if (!['Mới', 'Đang xử lý', 'Đang giao', 'Hoàn tất', 'Đã hủy'].includes(status)) {
    return response.status(400).json({ error: 'Trạng thái đơn hàng không hợp lệ.' });
  }
  const result = await updateOrderStatus(Number(request.params.id), status);
  if (result.error) return response.status(result.status).json({ error: result.error });
  const { order } = result;
  logs.unshift(`[now] order: #${order.id} status changed to ${status}`);
  return response.json({ order });
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
