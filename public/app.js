const toast = document.querySelector('#toast');
const productGrid = document.querySelector('#productGrid');
const cartDrawer = document.querySelector('#cartDrawer');
const cartOverlay = document.querySelector('#cartOverlay');
const checkoutDialog = document.querySelector('#checkoutDialog');
const currency = new Intl.NumberFormat('vi-VN');
let toastTimer;
let selectedCategory = 'all';
let products = [];
let showFavorites = false;
let currentUser = null;
let authToken = '';
let pendingProductId = Number(new URLSearchParams(window.location.search).get('addProduct'));

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem('bepxanh_cart') ?? '[]');
    return Array.isArray(saved) ? saved.filter((item) => Number.isSafeInteger(item.id) && Number.isSafeInteger(item.quantity) && item.quantity > 0) : [];
  } catch (error) {
    console.error('Unable to read saved cart.', error);
    showToast('Không thể đọc giỏ hàng đã lưu. Vui lòng thử tải lại trang.');
    return [];
  }
}

let cart = readCart();
let favoriteIds = new Set();
try {
  const savedFavorites = JSON.parse(localStorage.getItem('bepxanh_favorites') ?? '[]');
  if (Array.isArray(savedFavorites)) favoriteIds = new Set(savedFavorites.filter(Number.isSafeInteger));
} catch (error) {
  console.error('Unable to read saved favorites.', error);
  showToast('Không thể đọc danh sách yêu thích đã lưu.');
}

function saveCart() {
  try {
    localStorage.setItem('bepxanh_cart', JSON.stringify(cart));
  } catch (error) {
    console.error('Unable to save cart.', error);
    showToast('Không thể lưu giỏ hàng trên thiết bị này.');
  }
}

function getCartItems() {
  return cart.map((entry) => {
    const product = products.find((item) => item.id === entry.id);
    return product ? { ...product, quantity: Math.min(entry.quantity, product.stock) } : null;
  }).filter((item) => item && item.quantity > 0);
}

function renderProducts() {
  const visibleProducts = showFavorites ? products.filter((product) => favoriteIds.has(product.id)) : products;
  document.querySelector('#resultCount').textContent = `${visibleProducts.length} sản phẩm`;
  document.querySelector('#emptyProducts').hidden = visibleProducts.length > 0;
  document.querySelector('#emptyProducts').textContent = showFavorites
    ? 'Bạn chưa có sản phẩm yêu thích. Hãy nhấn ♡ trên sản phẩm để lưu lại.'
    : 'Không tìm thấy thực phẩm phù hợp. Hãy thử thay đổi bộ lọc nhé.';
  document.querySelector('#favoritesButton').setAttribute('aria-pressed', String(showFavorites));
  document.querySelector('#favoritesButton').classList.toggle('active', showFavorites);
  document.querySelector('#favoriteCount').textContent = favoriteIds.size;
  productGrid.innerHTML = visibleProducts.map((product) => {
    const discount = product.originalPrice > product.price ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;
    return `<article class="product-card">
      <div class="product-image-wrap"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy"><span class="product-badge">${escapeHtml(product.badge || 'Tươi ngon mỗi ngày')}</span><button class="favorite-button${favoriteIds.has(product.id) ? ' selected' : ''}" type="button" data-favorite="${product.id}" aria-pressed="${favoriteIds.has(product.id)}" aria-label="${favoriteIds.has(product.id) ? 'Bỏ yêu thích' : 'Thêm yêu thích'} ${escapeHtml(product.name)}">${favoriteIds.has(product.id) ? '♥' : '♡'}</button><span class="product-discount">${discount ? `-${discount}%` : ''}</span></div>
      <div class="product-card-content"><small class="product-brand">${escapeHtml(product.brand)}</small><h3>${escapeHtml(product.name)}</h3>
      <div class="product-specs"><span>${escapeHtml(product.origin || product.brand)}</span><span>${escapeHtml(product.unit || product.storage || 'Theo quy cách')}</span><span>${escapeHtml(product.description || 'Tươi ngon')}</span></div>
      <div class="product-price"><strong>${currency.format(product.price)}đ</strong>${product.originalPrice > product.price ? `<del>${currency.format(product.originalPrice)}đ</del>` : ''}</div>
      <div class="product-card-footer"><span class="${product.stock ? 'stock-ready' : 'stock-empty'}">${product.stock ? `Còn ${product.stock} sản phẩm` : 'Tạm hết hàng'}</span><button class="add-cart-button" type="button" data-add="${product.id}" ${product.stock ? '' : 'disabled'} aria-label="Thêm ${escapeHtml(product.name)} vào giỏ hàng">Thêm vào giỏ <span>+</span></button></div></div>
    </article>`;
  }).join('');
}

async function loadProducts() {
  const query = new URLSearchParams();
  const search = showFavorites ? '' : document.querySelector('#searchInput').value.trim();
  const brand = showFavorites ? '' : document.querySelector('#brandFilter').value;
  const maxPrice = showFavorites ? '' : document.querySelector('#priceFilter').value;
  const sort = document.querySelector('#sortSelect').value;
  if (search) query.set('q', search);
  if (!showFavorites && selectedCategory !== 'all') query.set('category', selectedCategory);
  if (brand) query.set('brand', brand);
  if (maxPrice) query.set('maxPrice', maxPrice);
  query.set('sort', sort);
  productGrid.innerHTML = '<div class="product-loading">Đang tải thực phẩm...</div>';
  try {
    const response = await fetch(`/api/products?${query}`);
    if (!response.ok) throw new Error('Không tải được danh sách thực phẩm.');
    const data = await response.json();
    products = data.items;
    renderProducts();
    if (pendingProductId > 0 && authToken && currentUser) {
      window.history.replaceState(null, '', '/#products');
      addProductToCart(pendingProductId);
      pendingProductId = 0;
    }
    renderCart();
  } catch (error) {
    productGrid.innerHTML = '';
    document.querySelector('#emptyProducts').hidden = false;
    document.querySelector('#emptyProducts').textContent = error.message;
    showToast(error.message);
  }
}

function renderCart() {
  const items = getCartItems();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  document.querySelector('#cartCount').textContent = count;
  document.querySelector('#drawerCount').textContent = `(${count})`;
  document.querySelector('#cartSubtotal').textContent = `${currency.format(total)}đ`;
  document.querySelector('#checkoutTotal').textContent = `${currency.format(total)}đ`;
  document.querySelector('#cartEmpty').hidden = items.length > 0;
  document.querySelector('#cartItems').innerHTML = items.map((item) => `<article class="cart-item">
    <img src="${escapeHtml(item.image)}" alt="">
    <div class="cart-item-info"><strong>${escapeHtml(item.name)}</strong><span>${currency.format(item.price)}đ</span><div class="cart-quantity"><button type="button" data-quantity="${item.id}" data-delta="-1" aria-label="Giảm số lượng">−</button><span>${item.quantity}</span><button type="button" data-quantity="${item.id}" data-delta="1" aria-label="Tăng số lượng" ${item.quantity >= item.stock ? 'disabled' : ''}>+</button><button class="cart-remove" type="button" data-remove="${item.id}">Xóa</button></div></div>
  </article>`).join('');
  document.querySelector('#checkoutButton').disabled = items.length === 0;
}

function addProductToCart(id) {
  if (!authToken || !currentUser) {
    const next = `/?addProduct=${id}#products`;
    window.location.href = `/auth?next=${encodeURIComponent(next)}`;
    return;
  }
  const product = products.find((item) => item.id === id);
  if (!product || product.stock < 1) return showToast('Sản phẩm hiện đã hết hàng.');
  const entry = cart.find((item) => item.id === id);
  if (entry && entry.quantity >= product.stock) return showToast('Số lượng trong giỏ đã đạt tồn kho hiện có.');
  if (entry) entry.quantity += 1;
  else cart.push({ id, quantity: 1 });
  saveCart();
  renderCart();
  showToast(`Đã thêm ${product.name} vào giỏ hàng.`);
}

function setCategory(category) {
  showFavorites = false;
  selectedCategory = category;
  document.querySelectorAll('[data-category]').forEach((button) => button.classList.toggle('active', button.dataset.category === category));
  loadProducts();
}

function openCart() {
  cartDrawer.classList.add('open');
  cartDrawer.setAttribute('aria-hidden', 'false');
  cartOverlay.hidden = false;
}

function closeCart() {
  cartDrawer.classList.remove('open');
  cartDrawer.setAttribute('aria-hidden', 'true');
  cartOverlay.hidden = true;
}

async function prefillCheckoutFromProfile() {
  if (!authToken || currentUser?.role !== 'user') return;
  const response = await fetch('/api/account/profile', {
    headers: { authorization: `Bearer ${authToken}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Không thể tải địa chỉ giao hàng đã lưu.');
  const form = document.querySelector('#checkoutForm');
  for (const [field, value] of Object.entries({
    customerName: data.profile.name,
    phone: data.profile.phone,
    address: data.profile.address
  })) {
    const input = form.elements.namedItem(field);
    if (input && !input.value.trim()) input.value = value ?? '';
  }
}

productGrid.addEventListener('click', (event) => {
  const favoriteButton = event.target.closest('[data-favorite]');
  if (favoriteButton) {
    const id = Number(favoriteButton.dataset.favorite);
    if (favoriteIds.has(id)) favoriteIds.delete(id);
    else favoriteIds.add(id);
    try {
      localStorage.setItem('bepxanh_favorites', JSON.stringify([...favoriteIds]));
    } catch (error) {
      console.error('Unable to save favorite products.', error);
      showToast('Không thể lưu danh sách yêu thích trên thiết bị này.');
    }
    renderProducts();
    const updatedFavoriteButton = productGrid.querySelector(`[data-favorite="${id}"]`);
    if (favoriteIds.has(id)) updatedFavoriteButton?.classList.add('heart-pop');
    return;
  }
  const button = event.target.closest('[data-add]');
  if (!button) return;
  const id = Number(button.dataset.add);
  addProductToCart(id);
});

document.querySelector('#cartItems').addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-remove]');
  const quantityButton = event.target.closest('[data-quantity]');
  if (removeButton) cart = cart.filter((item) => item.id !== Number(removeButton.dataset.remove));
  if (quantityButton) {
    const id = Number(quantityButton.dataset.quantity);
    if (Number(quantityButton.dataset.delta) > 0) {
      addProductToCart(id);
      return;
    }
    const entry = cart.find((item) => item.id === id);
    const product = products.find((item) => item.id === id);
    if (!entry || !product) return;
    entry.quantity += Number(quantityButton.dataset.delta);
    if (entry.quantity <= 0) cart = cart.filter((item) => item.id !== id);
    else if (entry.quantity > product.stock) entry.quantity = product.stock;
  }
  saveCart();
  renderCart();
});

document.querySelector('#searchForm').addEventListener('submit', (event) => {
  event.preventDefault();
  loadProducts();
  document.querySelector('#products').scrollIntoView({ behavior: 'smooth' });
});
document.querySelector('#brandFilter').addEventListener('change', loadProducts);
document.querySelector('#priceFilter').addEventListener('change', loadProducts);
document.querySelector('#sortSelect').addEventListener('change', loadProducts);
document.querySelector('#clearFilters').addEventListener('click', () => {
  showFavorites = false;
  document.querySelector('#searchInput').value = '';
  document.querySelector('#brandFilter').value = '';
  document.querySelector('#priceFilter').value = '';
  document.querySelector('#sortSelect').value = 'featured';
  setCategory('all');
});
document.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => setCategory(button.dataset.category)));
document.querySelector('#cartButton').addEventListener('click', openCart);
document.querySelector('#favoritesButton').addEventListener('click', () => {
  showFavorites = !showFavorites;
  if (showFavorites) {
    selectedCategory = 'all';
    document.querySelectorAll('[data-category]').forEach((button) => button.classList.toggle('active', button.dataset.category === 'all'));
    document.querySelector('#searchInput').value = '';
    document.querySelector('#brandFilter').value = '';
    document.querySelector('#priceFilter').value = '';
  }
  loadProducts();
  document.querySelector('#products').scrollIntoView({ behavior: 'smooth' });
});
document.querySelector('#closeCart').addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);
document.querySelector('#checkoutButton').addEventListener('click', () => {
  if (!getCartItems().length) return showToast('Giỏ hàng đang trống.');
  closeCart();
  checkoutDialog.showModal();
  prefillCheckoutFromProfile().catch((error) => showToast(error.message));
});
document.querySelector('#closeCheckout').addEventListener('click', () => checkoutDialog.close());
document.querySelector('[name="paymentMethod"]').addEventListener('change', (event) => {
  document.querySelector('#bankTransferNote').hidden = event.target.value !== 'bank-transfer';
});
document.querySelector('#checkoutForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorElement = document.querySelector('#checkoutError');
  errorElement.textContent = '';
  const form = event.currentTarget;
  const formData = Object.fromEntries(new FormData(form));
  const items = getCartItems().map((item) => ({ id: item.id, quantity: item.quantity }));
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers.authorization = `Bearer ${authToken}`;
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...formData, items })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Không thể tạo đơn hàng.');
    cart = [];
    saveCart();
    renderCart();
    if (!currentUser) saveGuestOrder({ ...data.order, createdAt: new Date().toLocaleString('vi-VN') });
    form.reset();
    document.querySelector('#bankTransferNote').hidden = true;
    checkoutDialog.close();
    showToast(`Đặt hàng thành công! Mã đơn #${data.order.id}.`);
    await loadProducts();
    await loadOrderHistory();
  } catch (error) {
    errorElement.textContent = error.message;
  }
});

try {
  authToken = localStorage.getItem('testdemo_token') ?? '';
  const user = JSON.parse(localStorage.getItem('testdemo_user') ?? 'null');
  currentUser = user;
  if (user) {
    document.querySelector('#accountName').textContent = user.name;
    document.querySelector('#accountLink').href = user.role === 'admin' ? '/admin' : '/account';
    if (user.role === 'admin') document.querySelector('#adminLink').hidden = false;
  }
} catch (error) {
  console.error('Unable to read account information.', error);
}

function paymentLabel(method) {
  return method === 'bank-transfer' ? 'Chuyển khoản ngân hàng' : 'Tiền mặt khi nhận hàng';
}

function renderOrderHistory(orders, message = '') {
  const list = document.querySelector('#orderHistoryList');
  if (!orders.length) {
    list.innerHTML = `<p class="order-history-empty">${escapeHtml(message || 'Chưa có đơn hàng nào.')}</p>`;
    return;
  }
  list.innerHTML = `${message ? `<p class="order-history-message">${escapeHtml(message)}</p>` : ''}${orders.map((order) => `
    <article class="order-history-card">
      <div class="order-history-main"><strong>Đơn hàng #${escapeHtml(order.id)}</strong><span>${escapeHtml(order.createdAt || '')}</span></div>
      <div class="order-history-meta"><span class="order-status">${escapeHtml(order.status)}</span><span>${escapeHtml(paymentLabel(order.paymentMethod))}</span><strong>${currency.format(order.total)}đ</strong></div>
      <p>${(order.items || []).map((item) => `${escapeHtml(item.name)} × ${escapeHtml(item.quantity)}`).join(' · ') || 'Đơn hàng đã được tiếp nhận.'}</p>
    </article>`).join('')}`;
}

function readGuestOrders() {
  try {
    const orders = JSON.parse(localStorage.getItem('bepxanh_recent_orders') ?? '[]');
    return Array.isArray(orders) ? orders : [];
  } catch (error) {
    console.error('Unable to read recent guest orders.', error);
    return [];
  }
}

function saveGuestOrder(order) {
  try {
    const orders = readGuestOrders();
    orders.unshift(order);
    localStorage.setItem('bepxanh_recent_orders', JSON.stringify(orders.slice(0, 10)));
  } catch (error) {
    console.error('Unable to save recent guest order.', error);
    showToast('Đơn hàng đã đặt nhưng không thể lưu lịch sử trên thiết bị.');
  }
}

async function loadOrderHistory() {
  const loginLink = document.querySelector('#ordersLogin');
  if (!authToken || !currentUser) {
    loginLink.hidden = false;
    renderOrderHistory(readGuestOrders(), 'Đăng nhập để đồng bộ đơn hàng trên tài khoản. Đơn vừa đặt trên thiết bị này vẫn được lưu bên dưới.');
    return;
  }
  loginLink.hidden = true;
  try {
    const response = await fetch('/api/orders', { headers: { authorization: `Bearer ${authToken}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Không thể tải lịch sử đơn hàng.');
    renderOrderHistory(data.items);
  } catch (error) {
    console.error('Unable to load order history.', error);
    if (error.message === 'authentication required') {
      localStorage.removeItem('testdemo_token');
      localStorage.removeItem('testdemo_user');
      authToken = '';
      currentUser = null;
      loginLink.hidden = false;
      renderOrderHistory(readGuestOrders(), 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để đồng bộ đơn hàng.');
      return;
    }
    renderOrderHistory([], error.message);
  }
}

renderCart();
loadProducts();
loadOrderHistory();
