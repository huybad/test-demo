const toast = document.querySelector('#toast');
const productGrid = document.querySelector('#productGrid');
const cartDrawer = document.querySelector('#cartDrawer');
const cartOverlay = document.querySelector('#cartOverlay');
const checkoutDialog = document.querySelector('#checkoutDialog');
const currency = new Intl.NumberFormat('vi-VN');
let toastTimer;
let selectedCategory = 'all';
let products = [];

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
    const saved = JSON.parse(localStorage.getItem('lapzone_cart') ?? '[]');
    return Array.isArray(saved) ? saved.filter((item) => Number.isSafeInteger(item.id) && Number.isSafeInteger(item.quantity) && item.quantity > 0) : [];
  } catch (error) {
    console.error('Unable to read saved cart.', error);
    showToast('Không thể đọc giỏ hàng đã lưu. Vui lòng thử tải lại trang.');
    return [];
  }
}

let cart = readCart();

function saveCart() {
  try {
    localStorage.setItem('lapzone_cart', JSON.stringify(cart));
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
  const visibleProducts = products;
  document.querySelector('#resultCount').textContent = `${visibleProducts.length} sản phẩm`;
  document.querySelector('#emptyProducts').hidden = visibleProducts.length > 0;
  productGrid.innerHTML = visibleProducts.map((product) => {
    const discount = product.originalPrice > product.price ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;
    return `<article class="product-card">
      <div class="product-image-wrap"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy"><span class="product-badge">${escapeHtml(product.badge || 'Laptop chính hãng')}</span><span class="product-discount">${discount ? `-${discount}%` : ''}</span></div>
      <div class="product-card-content"><small class="product-brand">${escapeHtml(product.brand)}</small><h3>${escapeHtml(product.name)}</h3>
      <div class="product-specs"><span>${escapeHtml(product.processor)}</span><span>${escapeHtml(product.memory)} RAM</span><span>${escapeHtml(product.storage)}</span></div>
      <div class="product-price"><strong>${currency.format(product.price)}đ</strong>${product.originalPrice > product.price ? `<del>${currency.format(product.originalPrice)}đ</del>` : ''}</div>
      <div class="product-card-footer"><span class="${product.stock ? 'stock-ready' : 'stock-empty'}">${product.stock ? `Còn ${product.stock} máy` : 'Tạm hết hàng'}</span><button class="add-cart-button" type="button" data-add="${product.id}" ${product.stock ? '' : 'disabled'} aria-label="Thêm ${escapeHtml(product.name)} vào giỏ hàng">Thêm vào giỏ <span>+</span></button></div></div>
    </article>`;
  }).join('');
}

async function loadProducts() {
  const query = new URLSearchParams();
  const search = document.querySelector('#searchInput').value.trim();
  const brand = document.querySelector('#brandFilter').value;
  const maxPrice = document.querySelector('#priceFilter').value;
  const sort = document.querySelector('#sortSelect').value;
  if (search) query.set('q', search);
  if (selectedCategory !== 'all') query.set('category', selectedCategory);
  if (brand) query.set('brand', brand);
  if (maxPrice) query.set('maxPrice', maxPrice);
  query.set('sort', sort);
  productGrid.innerHTML = '<div class="product-loading">Đang tải laptop...</div>';
  try {
    const response = await fetch(`/api/products?${query}`);
    if (!response.ok) throw new Error('Không tải được danh sách laptop.');
    const data = await response.json();
    products = data.items;
    renderProducts();
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

function setCategory(category) {
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

productGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-add]');
  if (!button) return;
  const id = Number(button.dataset.add);
  const product = products.find((item) => item.id === id);
  if (!product) return;
  const entry = cart.find((item) => item.id === id);
  if (entry && entry.quantity >= product.stock) return showToast('Số lượng trong giỏ đã đạt tồn kho hiện có.');
  if (entry) entry.quantity += 1;
  else cart.push({ id, quantity: 1 });
  saveCart();
  renderCart();
  showToast(`Đã thêm ${product.name} vào giỏ hàng.`);
});

document.querySelector('#cartItems').addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-remove]');
  const quantityButton = event.target.closest('[data-quantity]');
  if (removeButton) cart = cart.filter((item) => item.id !== Number(removeButton.dataset.remove));
  if (quantityButton) {
    const id = Number(quantityButton.dataset.quantity);
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
  document.querySelector('#searchInput').value = '';
  document.querySelector('#brandFilter').value = '';
  document.querySelector('#priceFilter').value = '';
  document.querySelector('#sortSelect').value = 'featured';
  setCategory('all');
});
document.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => setCategory(button.dataset.category)));
document.querySelector('#cartButton').addEventListener('click', openCart);
document.querySelector('#closeCart').addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);
document.querySelector('#checkoutButton').addEventListener('click', () => {
  if (!getCartItems().length) return showToast('Giỏ hàng đang trống.');
  closeCart();
  checkoutDialog.showModal();
});
document.querySelector('#closeCheckout').addEventListener('click', () => checkoutDialog.close());
document.querySelector('#checkoutForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorElement = document.querySelector('#checkoutError');
  errorElement.textContent = '';
  const form = event.currentTarget;
  const formData = Object.fromEntries(new FormData(form));
  const items = getCartItems().map((item) => ({ id: item.id, quantity: item.quantity }));
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, items })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Không thể tạo đơn hàng.');
    cart = [];
    saveCart();
    renderCart();
    form.reset();
    checkoutDialog.close();
    showToast(`Đặt hàng thành công! Mã đơn #${data.order.id}.`);
    await loadProducts();
  } catch (error) {
    errorElement.textContent = error.message;
  }
});

try {
  const user = JSON.parse(localStorage.getItem('testdemo_user') ?? 'null');
  if (user) {
    document.querySelector('#accountName').textContent = user.name;
    document.querySelector('#accountLink').href = '/auth';
    if (user.role === 'admin') document.querySelector('#adminLink').hidden = false;
  }
} catch (error) {
  console.error('Unable to read account information.', error);
}

renderCart();
loadProducts();
