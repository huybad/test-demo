const toast = document.querySelector('#toast');
const productsElement = document.querySelector('#adminProducts');
const ordersElement = document.querySelector('#adminOrders');
const logsElement = document.querySelector('#systemLogs');
const money = new Intl.NumberFormat('vi-VN');
let currentProducts = [];
let currentOrders = [];
let currentLogs = [];
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

async function request(url, options = {}) {
  const token = localStorage.getItem('testdemo_token');
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.headers ?? {}), Authorization: `Bearer ${token ?? ''}` }
  });
  const data = response.status === 204 ? {} : await response.json();
  if (response.status === 401 || response.status === 403) {
    window.location.href = '/auth';
    throw new Error('Vui lòng đăng nhập bằng tài khoản quản trị.');
  }
  if (!response.ok) throw new Error(data.error || 'Yêu cầu không thành công.');
  return data;
}

function renderProducts() {
  productsElement.innerHTML = currentProducts.map((product) => `<tr>
    <td><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.processor || 'Laptop')}</small></td>
    <td>${escapeHtml(product.brand)}</td><td>${money.format(product.price)}đ</td>
    <td><input class="inventory-input" type="number" min="0" max="10000" value="${product.stock}" data-stock="${product.id}" aria-label="Tồn kho ${escapeHtml(product.name)}"></td>
    <td><span class="badge ${product.stock ? 'success' : 'failed'}">${product.stock ? 'Còn hàng' : 'Hết hàng'}</span></td>
    <td><button class="outline-button save-stock" type="button" data-save-stock="${product.id}">Lưu</button></td>
  </tr>`).join('');
  productsElement.querySelectorAll('[data-save-stock]').forEach((button) => button.addEventListener('click', async () => {
    const input = productsElement.querySelector(`[data-stock="${button.dataset.saveStock}"]`);
    const stock = Number(input.value);
    try {
      await request(`/api/admin/products/${button.dataset.saveStock}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock })
      });
      showToast('Đã cập nhật tồn kho.');
      await loadAdminData();
    } catch (error) {
      showToast(error.message);
    }
  }));
}

function renderOrders() {
  document.querySelector('#emptyOrders').hidden = currentOrders.length > 0;
  ordersElement.innerHTML = currentOrders.map((order) => `<tr>
    <td><strong>#${order.id} · ${escapeHtml(order.customerName)}</strong><small>${escapeHtml(order.createdAt)} · ${escapeHtml(order.paymentMethod)}</small></td>
    <td>${escapeHtml(order.phone)}<small>${escapeHtml(order.address)}</small></td>
    <td>${order.items.map((item) => `${escapeHtml(item.name)} × ${item.quantity}`).join('<br>')}</td>
    <td><strong>${money.format(order.total)}đ</strong></td>
    <td><select class="order-status" data-order-status="${order.id}" aria-label="Trạng thái đơn hàng #${order.id}">${['Mới', 'Đang xử lý', 'Đang giao', 'Hoàn tất', 'Đã hủy'].map((status) => `<option ${status === order.status ? 'selected' : ''}>${status}</option>`).join('')}</select></td>
    <td><button class="outline-button save-order" type="button" data-save-order="${order.id}">Lưu</button></td>
  </tr>`).join('');
  ordersElement.querySelectorAll('[data-save-order]').forEach((button) => button.addEventListener('click', async () => {
    const select = ordersElement.querySelector(`[data-order-status="${button.dataset.saveOrder}"]`);
    try {
      await request(`/api/admin/orders/${button.dataset.saveOrder}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: select.value })
      });
      showToast('Đã cập nhật trạng thái đơn hàng.');
      await loadAdminData();
    } catch (error) {
      showToast(error.message);
    }
  }));
}

async function loadAdminData() {
  const [productData, orderData, logData] = await Promise.all([
    request('/api/admin/products'),
    request('/api/admin/orders'),
    request('/api/admin/logs')
  ]);
  currentProducts = productData.items;
  currentOrders = orderData.items;
  currentLogs = logData.items;
  document.querySelector('#productCount').textContent = currentProducts.length;
  document.querySelector('#orderCount').textContent = currentOrders.length;
  document.querySelector('#pendingCount').textContent = currentOrders.filter((order) => order.status === 'Mới' || order.status === 'Đang xử lý').length;
  document.querySelector('#stockCount').textContent = currentProducts.reduce((sum, product) => sum + product.stock, 0);
  logsElement.textContent = currentLogs.join('\n');
  renderProducts();
  renderOrders();
}

document.querySelector('#productForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = Object.fromEntries(new FormData(form));
  const product = {
    ...fields,
    price: Number(fields.price),
    originalPrice: fields.originalPrice ? Number(fields.originalPrice) : undefined,
    stock: Number(fields.stock)
  };
  try {
    await request('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    form.reset();
    showToast('Đã thêm laptop vào danh mục.');
    await loadAdminData();
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector('#refreshAdmin').addEventListener('click', () => loadAdminData().then(() => showToast('Dữ liệu đã được làm mới.')).catch((error) => showToast(error.message)));
document.querySelector('#copyLogs').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(currentLogs.join('\n'));
    showToast('Đã sao chép nhật ký.');
  } catch (error) {
    showToast('Không thể sao chép nhật ký trên trình duyệt này.');
    console.error('Unable to copy logs.', error);
  }
});
document.querySelector('#exportData').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ products: currentProducts, orders: currentOrders, logs: currentLogs }, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'lapzone-store-snapshot.json';
  link.click();
  URL.revokeObjectURL(link.href);
});
document.querySelector('#logoutButton').addEventListener('click', async () => {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('Unable to end session on server.', error);
  } finally {
    localStorage.removeItem('testdemo_token');
    localStorage.removeItem('testdemo_user');
    window.location.href = '/auth';
  }
});

try {
  const adminUser = JSON.parse(localStorage.getItem('testdemo_user') ?? 'null');
  if (!adminUser || adminUser.role !== 'admin') window.location.href = '/auth';
  else document.querySelector('#adminName').textContent = adminUser.name;
} catch (error) {
  console.error('Unable to read administrator account.', error);
  window.location.href = '/auth';
}

loadAdminData().catch((error) => showToast(error.message));
