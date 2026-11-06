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
  getAccountBenefits,
  getAccountProfile,
  getSessionUser,
  initializeDatabase,
  listCustomers,
  listOrders,
  listUserOrders,
  listProducts,
  markAccountNotificationRead,
  updateOrderStatus,
  updateOrderPaymentStatus,
  updateAccountProfile,
  updateProduct,
  deleteProduct
} from './database.js';

const app = express();
const publicDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const scryptAsync = promisify(scrypt);
const deployments = [
  { id: 1, release: 'v2.4.1', environment: 'production', commit: '8f3a2c1', author: 'Huy Tran', status: 'deployed', createdAt: 'Today, 09:41' },
  { id: 2, release: 'v2.4.0', environment: 'staging', commit: '1b9de44', author: 'Alex Morgan', status: 'deployed', createdAt: 'Yesterday, 16:20' },
  { id: 3, release: 'v2.3.9', environment: 'production', commit: 'ae412c8', author: 'Linh Nguyen', status: 'failed', createdAt: 'Sep 02, 11:05' }
];
const imageByProduct = {
  'Rau cải ngọt': 'https://images.pexels.com/photos/12150346/pexels-photo-12150346.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Cà chua chín cây': 'https://images.pexels.com/photos/29479888/pexels-photo-29479888.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Cà rốt Đà Lạt': 'https://images.pexels.com/photos/1306559/pexels-photo-1306559.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Bông cải xanh': 'https://images.pexels.com/photos/7676044/pexels-photo-7676044.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Rau muống sạch': 'https://images.pexels.com/photos/13768938/pexels-photo-13768938.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Khoai tây vàng': 'https://images.pexels.com/photos/36400786/pexels-photo-36400786.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Dưa leo baby': 'https://images.pexels.com/photos/39490165/pexels-photo-39490165.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Ớt chuông ba màu': 'https://images.pexels.com/photos/35525568/pexels-photo-35525568.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Xà lách thủy canh': 'https://images.pexels.com/photos/28524414/pexels-photo-28524414.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Nấm đùi gà': 'https://images.pexels.com/photos/17630122/pexels-photo-17630122.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Táo Fuji nhập khẩu': 'https://images.pexels.com/photos/39309054/pexels-photo-39309054.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Cam sành mọng nước': 'https://images.pexels.com/photos/38322939/pexels-photo-38322939.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Chuối già Nam Mỹ': 'https://images.pexels.com/photos/30893278/pexels-photo-30893278.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Dâu tây Đà Lạt': 'https://images.pexels.com/photos/18018686/pexels-photo-18018686.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Bơ sáp Tây Nguyên': 'https://images.pexels.com/photos/27462724/pexels-photo-27462724.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Xoài cát Hòa Lộc': 'https://images.pexels.com/photos/37816783/pexels-photo-37816783.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Thịt heo ba rọi': 'https://images.pexels.com/photos/10647859/pexels-photo-10647859.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Ức gà tươi': 'https://images.pexels.com/photos/8251004/pexels-photo-8251004.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Trứng gà ta': 'https://images.pexels.com/photos/4110225/pexels-photo-4110225.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Thịt bò Úc nhập khẩu': 'https://images.pexels.com/photos/33157191/pexels-photo-33157191.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Cá hồi phi lê': 'https://images.pexels.com/photos/28161760/pexels-photo-28161760.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Tôm sú tươi': 'https://images.pexels.com/photos/5273798/pexels-photo-5273798.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Cá basa phi lê': 'https://images.pexels.com/photos/4619577/pexels-photo-4619577.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Mực ống làm sạch': 'https://images.pexels.com/photos/30648997/pexels-photo-30648997.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Sữa tươi thanh trùng': 'https://images.pexels.com/photos/4578396/pexels-photo-4578396.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Sữa chua ăn tự nhiên': 'https://images.pexels.com/photos/373882/pexels-photo-373882.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Phô mai lát': 'https://images.pexels.com/photos/36570893/pexels-photo-36570893.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Bơ lạt': 'https://images.pexels.com/photos/7966386/pexels-photo-7966386.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Gạo ST25 thơm ngon': 'https://images.pexels.com/photos/36346840/pexels-photo-36346840.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Yến mạch nguyên hạt': 'https://images.pexels.com/photos/5988273/pexels-photo-5988273.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Đậu xanh nguyên vỏ': 'https://images.pexels.com/photos/18358654/pexels-photo-18358654.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Mật ong hoa cà phê': 'https://images.pexels.com/photos/4921856/pexels-photo-4921856.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Dầu ô liu nguyên chất': 'https://images.pexels.com/photos/25745506/pexels-photo-25745506.jpeg?auto=compress&cs=tinysrgb&w=900',
  'Hạt điều rang muối': 'https://images.pexels.com/photos/6730156/pexels-photo-6730156.jpeg?auto=compress&cs=tinysrgb&w=900'
};
const products = [
  ['Rau cải ngọt', 'vegetables', 18000, 22000, 42, 'Nông trại Đà Lạt', '500g', 'Đà Lạt', 'Rau mới thu hoạch'],
  ['Cà chua chín cây', 'vegetables', 25000, 30000, 36, 'Vườn Nhà Mình', '1kg', 'Lâm Đồng', 'Tươi mỗi ngày'],
  ['Cà rốt Đà Lạt', 'vegetables', 22000, 26000, 30, 'Nông trại Đà Lạt', '1kg', 'Đà Lạt', 'Giàu vitamin A'],
  ['Bông cải xanh', 'vegetables', 35000, 42000, 24, 'Nông trại Đà Lạt', '500g', 'Đà Lạt', 'Rau hữu cơ'],
  ['Rau muống sạch', 'vegetables', 15000, 18000, 50, 'Vườn Nhà Mình', '500g', 'TP. Hồ Chí Minh', 'Thu hoạch sáng nay'],
  ['Khoai tây vàng', 'vegetables', 28000, 32000, 28, 'Nông sản Tây Nguyên', '1kg', 'Đắk Lắk', 'Củ chắc, bùi ngon'],
  ['Dưa leo baby', 'vegetables', 20000, 24000, 32, 'Vườn Nhà Mình', '500g', 'Lâm Đồng', 'Giòn ngọt'],
  ['Ớt chuông ba màu', 'vegetables', 39000, 45000, 20, 'Nông trại Đà Lạt', '500g', 'Đà Lạt', 'Combo nhiều màu'],
  ['Xà lách thủy canh', 'vegetables', 32000, 38000, 25, 'Vườn Xanh Farm', '300g', 'Đà Lạt', 'Chuẩn VietGAP'],
  ['Nấm đùi gà', 'vegetables', 29000, 34000, 22, 'Nấm sạch Việt', '300g', 'TP. Hồ Chí Minh', 'Đóng gói trong ngày'],
  ['Táo Fuji nhập khẩu', 'fruits', 68000, 78000, 40, 'Trái Cây Tươi', '1kg', 'Nhật Bản', 'Ngọt giòn'],
  ['Cam sành mọng nước', 'fruits', 35000, 42000, 38, 'Vườn Miền Tây', '1kg', 'Vĩnh Long', 'Ép nước rất ngon'],
  ['Chuối già Nam Mỹ', 'fruits', 32000, 38000, 34, 'Trái Cây Tươi', '1 nải', 'Ecuador', 'Chín tự nhiên'],
  ['Dâu tây Đà Lạt', 'fruits', 85000, 99000, 18, 'Nông trại Đà Lạt', '250g', 'Đà Lạt', 'Hái trong ngày'],
  ['Bơ sáp Tây Nguyên', 'fruits', 55000, 65000, 26, 'Nông sản Tây Nguyên', '1kg', 'Đắk Lắk', 'Dẻo thơm'],
  ['Xoài cát Hòa Lộc', 'fruits', 72000, 85000, 21, 'Vườn Miền Tây', '1kg', 'Tiền Giang', 'Đặc sản miền Tây'],
  ['Thịt heo ba rọi', 'meat', 145000, 159000, 16, 'Thực phẩm An Tâm', '500g', 'TP. Hồ Chí Minh', 'Kiểm dịch an toàn'],
  ['Ức gà tươi', 'meat', 69000, 79000, 22, 'Thực phẩm An Tâm', '500g', 'Đồng Nai', 'Ít mỡ, giàu đạm'],
  ['Trứng gà ta', 'meat', 38000, 45000, 30, 'Trang trại Bình Minh', '10 quả', 'Bình Dương', 'Gà thả vườn'],
  ['Thịt bò Úc nhập khẩu', 'meat', 189000, 210000, 12, 'Thực phẩm An Tâm', '500g', 'Úc', 'Mềm ngon, chuẩn lạnh'],
  ['Cá hồi phi lê', 'seafood', 175000, 199000, 10, 'Hải sản Biển Xanh', '300g', 'Na Uy', 'Bảo quản lạnh'],
  ['Tôm sú tươi', 'seafood', 155000, 179000, 14, 'Hải sản Biển Xanh', '500g', 'Cà Mau', 'Tôm tươi loại 1'],
  ['Cá basa phi lê', 'seafood', 52000, 62000, 19, 'Hải sản Biển Xanh', '500g', 'Đồng Tháp', 'Thịt cá mềm ngọt'],
  ['Mực ống làm sạch', 'seafood', 135000, 155000, 11, 'Hải sản Biển Xanh', '500g', 'Phú Quốc', 'Sơ chế sạch'],
  ['Sữa tươi thanh trùng', 'dairy', 38000, 44000, 35, 'Trang trại Mộc Châu', '1 lít', 'Mộc Châu', 'Không đường'],
  ['Sữa chua ăn tự nhiên', 'dairy', 32000, 38000, 28, 'Trang trại Mộc Châu', '4 hũ', 'Mộc Châu', 'Men sống tự nhiên'],
  ['Phô mai lát', 'dairy', 59000, 69000, 17, 'Bếp Nhà Mình', '200g', 'Việt Nam', 'Béo thơm tiện dụng'],
  ['Bơ lạt', 'dairy', 65000, 75000, 15, 'Bếp Nhà Mình', '200g', 'Việt Nam', 'Dùng làm bánh'],
  ['Gạo ST25 thơm ngon', 'pantry', 145000, 165000, 26, 'Nông sản miền Tây', '5kg', 'Sóc Trăng', 'Gạo ngon đặc sản'],
  ['Yến mạch nguyên hạt', 'pantry', 78000, 89000, 18, 'Bếp Nhà Mình', '1kg', 'Úc', 'Bữa sáng lành mạnh'],
  ['Đậu xanh nguyên vỏ', 'pantry', 42000, 49000, 23, 'Nông sản miền Tây', '500g', 'An Giang', 'Hạt đều, thơm bùi'],
  ['Mật ong hoa cà phê', 'pantry', 125000, 145000, 13, 'Nông sản Tây Nguyên', '500ml', 'Đắk Lắk', 'Nguyên chất tự nhiên'],
  ['Dầu ô liu nguyên chất', 'pantry', 159000, 179000, 9, 'Bếp Nhà Mình', '500ml', 'Ý', 'Ép lạnh nguyên chất'],
  ['Hạt điều rang muối', 'pantry', 89000, 105000, 20, 'Nông sản Tây Nguyên', '500g', 'Bình Phước', 'Giòn thơm, ít muối']
].map(([name, category, price, originalPrice, stock, brand, unit, origin, badge], index) => ({
  id: index + 1,
  name,
  brand,
  category,
  price,
  originalPrice,
  processor: origin,
  memory: '',
  storage: unit,
  display: '',
  origin,
  unit,
  description: badge,
  stock,
  badge,
  image: imageByProduct[name]
}));
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

app.get('/account', (_request, response) => {
  response.sendFile(path.join(publicDirectory, 'account.html'));
});

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/api/products', async (request, response) => {
  const items = await getProducts(request.query);
  response.json({ items });
});

app.post('/api/orders', async (request, response) => {
  const authorization = request.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const user = token ? await getAuthenticatedUser(request) : null;
  if (token && !user) return response.status(401).json({ error: 'authentication required' });
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
    paymentMethod,
    userId: user?.id ?? null
  }, orderItems);
  if (result.error) return response.status(result.status).json({ error: result.error });
  const { order } = result;
  logs.unshift(`[now] order: #${order.id} received (${order.items.length} product types)`);
  return response.status(201).json({ order: { id: order.id, total: order.total, status: order.status, paymentMethod: order.paymentMethod } });
});

app.get('/api/orders', requireAuth, async (request, response) => {
  response.json({ items: await listUserOrders(request.user.id) });
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

function requireCustomer(request, response, next) {
  if (request.user.role !== 'user') return response.status(403).json({ error: 'customer account required' });
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
    role: 'user',
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

app.get('/api/account/profile', requireAuth, requireCustomer, async (request, response) => {
  const profile = await getAccountProfile(request.user.id);
  if (!profile) return response.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  const { id, name, email, phone, address, latitude, longitude, createdAt } = profile;
  return response.json({ profile: { id, name, email, phone, address, latitude, longitude, createdAt } });
});

app.patch('/api/account/profile', requireAuth, requireCustomer, async (request, response) => {
  const { name = '', phone = '', address = '', latitude = null, longitude = null } = request.body ?? {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100
    || typeof phone !== 'string' || phone.length > 20 || (phone && !/^[0-9+() .-]{9,20}$/.test(phone.trim()))
    || typeof address !== 'string' || !address.trim() || address.length > 300
    || (latitude !== null && (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90))
    || (longitude !== null && (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180))
    || ((latitude === null) !== (longitude === null))) {
    return response.status(400).json({ error: 'Thông tin hồ sơ không hợp lệ.' });
  }
  const profile = await updateAccountProfile(request.user.id, {
    name: name.trim(),
    phone: phone.trim(),
    address: address.trim(),
    latitude,
    longitude
  });
  if (!profile) return response.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  const { id, email, createdAt } = profile;
  return response.json({
    profile: {
      id, name: profile.name, email, phone: profile.phone, address: profile.address,
      latitude: profile.latitude, longitude: profile.longitude, createdAt
    }
  });
});

app.get('/api/account/benefits', requireAuth, requireCustomer, async (request, response) => {
  response.json(await getAccountBenefits(request.user.id));
});

app.patch('/api/account/notifications/:id/read', requireAuth, requireCustomer, async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return response.status(400).json({ error: 'Thông báo không hợp lệ.' });
  const updated = await markAccountNotificationRead(request.user.id, id);
  if (!updated) return response.status(404).json({ error: 'Không tìm thấy thông báo.' });
  return response.status(204).end();
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
  const { name = '', brand = '', category = '', price, originalPrice, origin = '', unit = 'kg', description = '', stock, image = '', badge = '' } = request.body ?? {};
  if (typeof name !== 'string' || !name.trim() || name.length > 120
    || typeof brand !== 'string' || !brand.trim() || brand.length > 50
    || !['vegetables', 'fruits', 'meat', 'seafood', 'dairy', 'pantry'].includes(category)
    || !Number.isSafeInteger(price) || price < 1
    || (originalPrice !== undefined && (!Number.isSafeInteger(originalPrice) || originalPrice < price))
    || !Number.isSafeInteger(stock) || stock < 0 || stock > 10000
    || ![origin, unit, description, image, badge].every((field) => typeof field === 'string' && field.length <= 500)) {
    return response.status(400).json({ error: 'Thông tin sản phẩm không hợp lệ.' });
  }
  const product = await createProduct({
    name: name.trim(), brand: brand.trim(), category, price, originalPrice: originalPrice ?? price,
    processor: origin, memory: '', storage: unit, display: '', origin, unit, description, stock, image, badge
  });
  logs.unshift(`[now] inventory: ${product.name} added by admin`);
  return response.status(201).json({ product });
});

app.patch('/api/admin/products/:id', requireAuth, requireAdmin, async (request, response) => {
  const id = Number(request.params.id);
  const { name, brand, category, price, originalPrice, stock, origin, unit, description, badge, image } = request.body ?? {};

  if (stock !== undefined && (!Number.isSafeInteger(stock) || stock < 0 || stock > 10000)) {
    return response.status(400).json({ error: 'Số lượng tồn kho không hợp lệ.' });
  }
  if (price !== undefined && (!Number.isSafeInteger(price) || price < 1)) {
    return response.status(400).json({ error: 'Giá bán không hợp lệ.' });
  }
  if (originalPrice !== undefined && (!Number.isSafeInteger(originalPrice) || originalPrice < (price ?? 0))) {
    return response.status(400).json({ error: 'Giá niêm yết không hợp lệ.' });
  }
  if (category !== undefined && !['vegetables', 'fruits', 'meat', 'seafood', 'dairy', 'pantry'].includes(category)) {
    return response.status(400).json({ error: 'Phân loại không hợp lệ.' });
  }
  if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 120)) {
    return response.status(400).json({ error: 'Tên sản phẩm không hợp lệ.' });
  }
  if (brand !== undefined && (typeof brand !== 'string' || !brand.trim() || brand.length > 50)) {
    return response.status(400).json({ error: 'Nguồn hàng không hợp lệ.' });
  }
  if ([origin, unit, description, image, badge].some((f) => f !== undefined && (typeof f !== 'string' || f.length > 500))) {
    return response.status(400).json({ error: 'Thông tin chi tiết không hợp lệ.' });
  }

  const updates = {};
  if (stock !== undefined) updates.stock = stock;
  if (price !== undefined) updates.price = price;
  if (originalPrice !== undefined) updates.originalPrice = originalPrice;
  if (name !== undefined) updates.name = name.trim();
  if (brand !== undefined) updates.brand = brand.trim();
  if (category !== undefined) updates.category = category;
  if (origin !== undefined) updates.origin = origin.trim();
  if (unit !== undefined) updates.unit = unit.trim();
  if (description !== undefined) updates.description = description.trim();
  if (badge !== undefined) updates.badge = badge.trim();
  if (image !== undefined) updates.image = image.trim();

  const product = await updateProduct(id, updates);
  if (!product) return response.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
  logs.unshift(`[now] inventory: ${product.name} updated by admin`);
  return response.json({ product });
});

app.delete('/api/admin/products/:id', requireAuth, requireAdmin, async (request, response) => {
  const id = Number(request.params.id);
  try {
    const success = await deleteProduct(id);
    if (!success) return response.status(404).json({ error: 'Không tìm thấy sản phẩm để xóa.' });
    logs.unshift(`[now] inventory: product #${id} deleted by admin`);
    return response.json({ message: 'Đã xóa sản phẩm thành công.' });
  } catch (error) {
    return response.status(400).json({ error: error.message || 'Không thể xóa sản phẩm.' });
  }
});

app.get('/api/admin/orders', requireAuth, requireAdmin, async (_request, response) => {
  response.json({ items: await listOrders() });
});

app.get('/api/admin/customers', requireAuth, requireAdmin, async (request, response) => {
  const search = typeof request.query.q === 'string' ? request.query.q.slice(0, 100) : '';
  response.json({ items: await listCustomers(search) });
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

app.patch('/api/admin/orders/:id/payment', requireAuth, requireAdmin, async (request, response) => {
  const { paymentStatus } = request.body ?? {};
  if (!['Chưa thanh toán', 'Đã thanh toán', 'Hoàn tiền'].includes(paymentStatus)) {
    return response.status(400).json({ error: 'Trạng thái thanh toán không hợp lệ.' });
  }
  const order = await updateOrderPaymentStatus(Number(request.params.id), paymentStatus);
  if (!order) return response.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
  logs.unshift(`[now] payment: order #${order.id} updated to ${paymentStatus}`);
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
