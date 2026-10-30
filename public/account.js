const accountToast = document.querySelector('#accountToast');
const accountCurrency = new Intl.NumberFormat('vi-VN');
const accountToken = localStorage.getItem('testdemo_token');
const storedAccount = JSON.parse(localStorage.getItem('testdemo_user') ?? 'null');
let accountToastTimer;
let accountMap;
let accountMarker;
const defaultLocation = [10.7716, 106.7044];

function escapeAccountHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function showAccountToast(message) {
  accountToast.textContent = message;
  accountToast.classList.add('show');
  clearTimeout(accountToastTimer);
  accountToastTimer = setTimeout(() => accountToast.classList.remove('show'), 2800);
}

async function accountRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${accountToken}`
    }
  });
  const data = response.status === 204 ? {} : await response.json();
  if (response.status === 401) {
    localStorage.removeItem('testdemo_token');
    localStorage.removeItem('testdemo_user');
    window.location.href = '/auth?next=%2Faccount';
    throw new Error('Phiên đăng nhập đã hết hạn.');
  }
  if (!response.ok) throw new Error(data.error || 'Không thể tải dữ liệu tài khoản.');
  return data;
}

function paymentLabel(method) {
  return method === 'bank-transfer' ? 'Chuyển khoản ngân hàng' : 'Tiền mặt khi nhận hàng';
}

function renderOrders(orders) {
  const target = document.querySelector('#accountOrders');
  if (!orders.length) {
    target.innerHTML = '<p class="account-muted">Bạn chưa có đơn hàng nào.</p>';
    return;
  }
  target.innerHTML = orders.map((order) => `
    <article class="order-history-card">
      <div class="order-history-main"><strong>Đơn hàng #${escapeAccountHtml(order.id)}</strong><span>${escapeAccountHtml(order.createdAt)}</span></div>
      <div class="order-history-meta"><span class="order-status">${escapeAccountHtml(order.status)}</span><span>${escapeAccountHtml(paymentLabel(order.paymentMethod))} · ${escapeAccountHtml(order.paymentStatus)}</span><strong>${accountCurrency.format(order.total)}đ</strong></div>
      <p>${(order.items || []).map((item) => `${escapeAccountHtml(item.name)} × ${escapeAccountHtml(item.quantity)}`).join(' · ') || 'Đơn hàng đã được tiếp nhận.'}</p>
    </article>`).join('');
}

function renderVouchers(vouchers) {
  const target = document.querySelector('#accountVouchers');
  if (!vouchers.length) {
    target.innerHTML = '<p class="account-muted">Hiện chưa có voucher khả dụng.</p>';
    return;
  }
  target.innerHTML = vouchers.map((voucher) => `
    <article class="account-voucher">
      <span class="account-voucher-discount">-${escapeAccountHtml(voucher.discountPercent)}%</span>
      <div><strong>${escapeAccountHtml(voucher.title)}</strong><p>${escapeAccountHtml(voucher.description)}</p><small>Mã: <b>${escapeAccountHtml(voucher.code)}</b> · Hạn dùng ${new Date(voucher.expiresAt).toLocaleDateString('vi-VN')}</small></div>
    </article>`).join('');
}

function renderNotifications(notifications) {
  const target = document.querySelector('#accountNotifications');
  if (!notifications.length) {
    target.innerHTML = '<p class="account-muted">Bạn chưa có thông báo mới.</p>';
    return;
  }
  target.innerHTML = notifications.map((notification) => `
    <article class="account-notification${notification.readAt ? '' : ' unread'}">
      <div><strong>${escapeAccountHtml(notification.title)}</strong><p>${escapeAccountHtml(notification.message)}</p><small>${escapeAccountHtml(new Date(notification.createdAt).toLocaleString('vi-VN'))}</small></div>
      ${notification.readAt ? '' : `<button class="outline-button" type="button" data-read-notification="${Number(notification.id)}">Đã đọc</button>`}
    </article>`).join('');
}

function updateSelectedLocation(latitude, longitude, pan = true) {
    const point = [latitude, longitude];
    accountMarker.setLatLng(point);
    if (pan) accountMap.setView(point, Math.max(accountMap.getZoom(), 16));
    document.querySelector('[name="latitude"]').value = latitude.toFixed(7);
    document.querySelector('[name="longitude"]').value = longitude.toFixed(7);
    document.querySelector('#coordinateReadout').textContent = `Vị trí đã chọn: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function initializeAccountMap(profile) {
    const hasSavedLocation = Number.isFinite(profile.latitude) && Number.isFinite(profile.longitude);
    const point = hasSavedLocation ? [profile.latitude, profile.longitude] : defaultLocation;
    accountMap = L.map('accountMap', { scrollWheelZoom: false }).setView(point, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
    }).addTo(accountMap);
    accountMarker = L.marker(point, { draggable: true, title: 'Kéo ghim để chọn vị trí giao hàng' }).addTo(accountMap);
    if (hasSavedLocation) updateSelectedLocation(profile.latitude, profile.longitude, false);
    accountMarker.on('dragend', () => {
      const { lat, lng } = accountMarker.getLatLng();
      updateSelectedLocation(lat, lng, false);
    });
    accountMap.on('click', (event) => updateSelectedLocation(event.latlng.lat, event.latlng.lng, false));
    document.querySelectorAll('[data-place]').forEach((button) => button.addEventListener('click', () => {
      document.querySelector('[name="address"]').value = button.dataset.place;
      updateSelectedLocation(Number(button.dataset.lat), Number(button.dataset.lng));
    }));
    document.querySelector('#useCurrentLocation').addEventListener('click', () => {
      if (!navigator.geolocation) {
        showAccountToast('Trình duyệt này không hỗ trợ lấy vị trí.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => updateSelectedLocation(coords.latitude, coords.longitude),
        (error) => {
          const messages = {
            1: 'Bạn chưa cấp quyền truy cập vị trí. Hãy cho phép trong cài đặt trình duyệt.',
            2: 'Không thể xác định vị trí hiện tại. Vui lòng thử lại hoặc chọn trên bản đồ.',
            3: 'Yêu cầu vị trí đã hết thời gian. Vui lòng thử lại.'
          };
          showAccountToast(messages[error.code] || 'Không thể lấy vị trí hiện tại.');
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      );
    });
    window.setTimeout(() => accountMap.invalidateSize(), 0);
}

async function loadAccount() {
  if (!accountToken || storedAccount?.role !== 'user') {
    window.location.href = storedAccount?.role === 'admin' ? '/admin' : '/auth?next=%2Faccount';
    return;
  }
  document.querySelector('#welcomeName').textContent = storedAccount.name;
  const [profileData, benefitsData, ordersData] = await Promise.all([
    accountRequest('/api/account/profile'),
    accountRequest('/api/account/benefits'),
    accountRequest('/api/orders')
  ]);
  const form = document.querySelector('#profileForm');
  for (const [field, value] of Object.entries(profileData.profile)) {
    if (form.elements.namedItem(field)) form.elements.namedItem(field).value = value ?? '';
  }
  initializeAccountMap(profileData.profile);
  document.querySelector('#welcomeName').textContent = profileData.profile.name;
  renderVouchers(benefitsData.vouchers);
  renderNotifications(benefitsData.notifications);
  renderOrders(ordersData.items);
}

document.querySelector('#profileForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.querySelector('#profileMessage');
  message.textContent = '';
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form));
  delete payload.email;
  payload.latitude = payload.latitude ? Number(payload.latitude) : null;
  payload.longitude = payload.longitude ? Number(payload.longitude) : null;
  try {
    const data = await accountRequest('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    document.querySelector('#welcomeName').textContent = data.profile.name;
    const user = { ...storedAccount, name: data.profile.name };
    localStorage.setItem('testdemo_user', JSON.stringify(user));
    message.textContent = 'Thông tin tài khoản đã được cập nhật.';
  } catch (error) {
    message.textContent = error.message;
  }
});

document.querySelector('#accountNotifications').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-read-notification]');
  if (!button) return;
  try {
    await accountRequest(`/api/account/notifications/${button.dataset.readNotification}/read`, { method: 'PATCH' });
    await loadAccount();
  } catch (error) {
    showAccountToast(error.message);
  }
});

document.querySelector('#accountLogout').addEventListener('click', async () => {
  try {
    await accountRequest('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('Unable to end account session.', error);
  } finally {
    localStorage.removeItem('testdemo_token');
    localStorage.removeItem('testdemo_user');
    window.location.href = '/';
  }
});

loadAccount().catch((error) => showAccountToast(error.message));
